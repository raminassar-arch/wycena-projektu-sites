/* ==========================================================================
   Kalkulator projektu 1.7.0 – wersja statyczna (WWW / Google Sites)
   payment-web.js – odpowiednik mostu Electrona (window.desktopAPI).

   Dzięki temu pliki app.js i widoki.js pozostają identyczne jak w wersji
   desktopowej: logika wyceny, blokada wyników i obsługa zdarzeń płatności
   działają bez zmian. Różnica jest tylko w tym, skąd biorą się pieniądze
   i jak powstaje PDF (okno drukowania przeglądarki zamiast printToPDF()).
   ========================================================================== */
(function () {
  'use strict';

  var query = new URLSearchParams(location.search);
  var cfg = window.KALKULATOR_CONFIG || {};
  var appInfo = cfg.app || {};
  var apiBase = String(query.get('api') || cfg.paymentApi || 'http://127.0.0.1:8787').replace(/\/+$/, '');
  var demo = query.get('demo') === '1' || cfg.demo === true;
  var priceLabel = cfg.priceLabel || '100,00 zł';
  var listeners = [];
  var job = null;
  var demoCounter = 0;

  function emit(status, extra) {
    var ev = Object.assign({ status: status }, extra || {});
    listeners.slice().forEach(function (fn) {
      try { fn(ev); } catch (e) { /* uszkodzony listener nie psuje płatności */ }
    });
  }

  function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  function parseBody(res) {
    return res.text().then(function (text) {
      var body = null;
      try { body = text ? JSON.parse(text) : null; } catch (e) { /* brak JSON */ }
      if (!res.ok) {
        var message = (body && (body.message || body.reason)) || ('HTTP ' + res.status);
        var err = new Error(message);
        err.body = body;
        throw err;
      }
      return body || {};
    });
  }

  async function request(path, options) {
    var opts = Object.assign({
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    }, options || {});
    try {
      var res = await fetch(apiBase + path, opts);
      return { ok: true, body: await parseBody(res) };
    } catch (e) {
      return { ok: false, error: e, body: e.body || null };
    }
  }

  /* PDF powstaje w ukrytym iframie: dzięki temu druk nie wymaga gestu użytkownika
     po powrocie z bramki płatności. Klasa pdf-render jest odpowiednikiem klasy,
     którą w Electronie dodawał main.js przed printToPDF(). */
  function printReport(suggestedName) {
    return new Promise(function (resolve) {
      var source = document.getElementById('viewCalc');
      if (!source) { resolve(); return; }

      document.body.classList.add('pdf-render');
      var frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.title = 'Raport PDF';
      frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0;opacity:0';
      document.body.appendChild(frame);

      var clone = source.cloneNode(true);
      clone.removeAttribute('hidden');
      var doc = frame.contentWindow.document;
      doc.open();
      doc.write('<!doctype html><html lang="pl" data-theme="light"><head><meta charset="utf-8">');
      doc.write('<base href="' + location.href + '">');
      ['styles.css?v=1.7.0b', 'wizard.css?v=1.7.0b', 'site.css?v=1.7.0b'].forEach(function (href) {
        doc.write('<link rel="stylesheet" href="' + href + '">');
      });
      var demoBanner = demo
        ? '<div style="border:2px solid #8a6b20;background:#fbf4df;color:#5b4410;padding:8px 12px;margin:0 0 10px;font:700 12px Arial,sans-serif;text-align:center">WERSJA DEMONSTRACYJNA – RAPORT BEZ OPŁATY</div>'
        : '';
      doc.write('</head><body class="pdf-render">' + demoBanner + clone.outerHTML + '</body></html>');
      doc.close();

      setTimeout(function () {
        try { frame.contentWindow.focus(); frame.contentWindow.print(); }
        catch (e) { try { window.print(); } catch (ignored) { /* przeglądarka blokuje druk */ } }
        setTimeout(function () {
          try { frame.remove(); } catch (e) { /* już usunięty */ }
          document.body.classList.remove('pdf-render');
          resolve();
        }, 1200);
      }, 400);
    });
  }

  async function exportPdf(suggestedName) {
    if (job) return { ok: false, message: 'Trwa już generowanie raportu.' };
    var current = { sessionId: null, redirectUrl: null, canceled: false };
    job = current;

    try {
      /* Tryb demonstracyjny – bez prawdziwej opłaty, wyraźnie oznaczony. */
      if (demo) {
        demoCounter++;
        var sid = 'DEMO-' + String(Date.now()).slice(-8) + '-' + demoCounter;
        current.sessionId = sid;
        emit('awaiting', { sessionId: sid, priceLabel: priceLabel });
        await sleep(800);
        if (current.canceled) { emit('cancelled'); return { ok: false, canceled: true }; }
        emit('paid', { sessionId: sid });
        await sleep(350);
        emit('consumed', { receipt: 'RCP-DEMO-' + sid, priceLabel: priceLabel });
        await printReport(suggestedName);
        emit('done', { message: 'Gotowe – raport demonstracyjny został zapisany.' });
        return { ok: true, fileName: suggestedName, demo: true };
      }

      var created = await request('/api/payment/create', {
        method: 'POST',
        body: JSON.stringify({ description: 'Raport PDF – kalkulator projektu (WWW)' })
      });
      if (!created.ok || !created.body || !created.body.ok || !created.body.sessionId) {
        var message = (created.body && (created.body.message || created.body.reason)) ||
          ('Nie można połączyć się z serwerem płatności (' + apiBase + '): ' +
            (created.error ? created.error.message : 'brak sesji'));
        emit('error', { message: message });
        return { ok: false, message: message };
      }

      var b = created.body;
      current.sessionId = b.sessionId;
      current.redirectUrl = b.redirectUrl;
      emit('awaiting', {
        sessionId: b.sessionId,
        redirectUrl: b.redirectUrl,
        amount: b.amount,
        currency: b.currency,
        expiresAt: b.expiresAt,
        priceLabel: priceLabel
      });
      if (b.redirectUrl) {
        try { window.open(b.redirectUrl, '_blank', 'noopener,noreferrer'); } catch (e) { /* blokada popupów */ }
      }

      var timeoutMs = (Number(cfg.paymentTimeoutMinutes) || 20) * 60000;
      var started = Date.now();
      var paid = false;
      while (!current.canceled && Date.now() - started < timeoutMs) {
        await sleep(2000);
        if (current.canceled) break;
        var st = await request('/api/payment/status/' + encodeURIComponent(b.sessionId));
        if (!st.ok || !st.body || !st.body.ok) continue;
        if (st.body.status === 'paid' || st.body.status === 'consumed') { paid = true; break; }
        if (st.body.status === 'expired') {
          var timeoutMessage = 'Czas płatności minął. Kliknij „Pokaż wyniki i zapisz PDF” ponownie.';
          emit('timeout', { message: timeoutMessage });
          return { ok: false, canceled: true, message: timeoutMessage };
        }
      }

      if (current.canceled) { emit('cancelled'); return { ok: false, canceled: true }; }
      if (!paid) {
        var noPay = 'Nie potwierdzono płatności w wyznaczonym czasie.';
        emit('timeout', { message: noPay });
        return { ok: false, canceled: true, message: noPay };
      }

      emit('paid', { sessionId: b.sessionId });
      var consumed = await request('/api/payment/consume', {
        method: 'POST',
        body: JSON.stringify({ sessionId: b.sessionId })
      });
      var reason = consumed.body && consumed.body.reason;
      if (!consumed.ok || !consumed.body || !consumed.body.ok) {
        var consumeMessage = reason === 'already_consumed'
          ? 'Ta płatność została już wykorzystana. Rozpocznij nową sesję.'
          : 'Nie udało się potwierdzić opłaty: ' + (reason || (consumed.error && consumed.error.message) || 'nieznany błąd');
        emit('error', { message: consumeMessage });
        return { ok: false, message: consumeMessage };
      }

      emit('consumed', { receipt: consumed.body.receipt, priceLabel: priceLabel });
      await printReport(suggestedName);
      emit('done', { message: 'Gotowe – raport został zapisany.' });
      return { ok: true, fileName: suggestedName, receipt: consumed.body.receipt };
    } catch (e) {
      emit('error', { message: 'Nie udało się zapisać PDF: ' + e.message });
      return { ok: false, message: e.message };
    } finally {
      job = null;
    }
  }

  window.desktopAPI = {
    isElectron: false,
    getAppInfo: function () {
      return Promise.resolve({
        name: appInfo.name || 'Kalkulator projektu',
        author: appInfo.author || 'Rami Nassar',
        company: appInfo.company || 'BIM architects & consultants',
        email: appInfo.email || 'raminassar.arch@gmail.com',
        year: appInfo.year || 2026,
        version: appInfo.version || '1.7.0 · WWW'
      });
    },
    getPaymentState: function () {
      return Promise.resolve({
        bypass: false,
        demo: demo,
        priceLabel: priceLabel,
        priceGross: Number(cfg.priceGross) || 10000,
        serverUrl: apiBase
      });
    },
    onPaymentChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
    cancelPayment: function () {
      if (!job) return Promise.resolve({ ok: false });
      job.canceled = true;
      emit('cancelled');
      return Promise.resolve({ ok: true });
    },
    openPaymentPage: function () {
      if (job && job.redirectUrl) {
        try { window.open(job.redirectUrl, '_blank', 'noopener,noreferrer'); } catch (e) { /* blokada popupów */ }
      }
      return Promise.resolve({ ok: true });
    },
    exportPdf: exportPdf,
    checkUpdates: function () {
      return Promise.resolve({ status: 'disabled', message: 'Aktualizacje automatyczne są dostępne tylko w wersji desktopowej.' });
    },
    installUpdate: function () { return Promise.resolve({ ok: false }); },
    getUpdateStatus: function () {
      return Promise.resolve({ status: 'disabled', message: 'Aktualizacje automatyczne są dostępne tylko w wersji desktopowej.' });
    },
    onUpdateStatus: function () { }
  };
})();
