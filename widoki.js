/* =====================================================================
   Jedno okno, dwa widoki: kreator (pytania i odpowiedzi) i kalkulator.
   Wszystkie dane współdzielą ten sam stan `s` z app.js, więc zmiany
   w kreatorze i w kalkulatorze są widoczne w obu miejscach.

   Zmienne globalne z app.js używane poniżej: $, api, s, FORMULARZ,
   oblicz, pokazWyniki, esc, zl, toast.
   ===================================================================== */
(function () {
  'use strict';

  /* Kolejność pytań w kreatorze – grupy pól z formularza. */
  const KROKI = [
    { tytul: 'Obiekt i fundamenty', opis: 'Rodzaj budynku, powierzchnia, kondygnacje.', pola: ['obj', 'char', 'pu', 'pz', 'kond', 'podp', 'geo', 'zab'] },
    { tytul: 'Projekt i usługi', opis: 'Typ projektu, lokalizacja, zakres usług dodatkowych.', pola: ['typ', 'gcena', 'lok', 'skompl', 'instal', 'wyk', 'kosztorys', 'wiz'] },
    { tytul: 'Zakres opracowania', opis: 'Rodzaj projektu: koncepcyjny, wykonawczy, wielobranżowy, wnętrza, instalacyjny i konstrukcyjny – osobno.', pola: ZAKRESY.map(([k]) => k) },
    { tytul: 'Praca w BIM', opis: 'Modelowanie, zakres branż, formaty i wymagania.', pola: ['bim', 'lod', 'zakres', 'koord', 'eir', 'ifc', 'd5', 'wizn', 'cde'] },
    { tytul: 'Projekty branżowe', opis: 'Dodatkowe opracowania instalacyjne i specjalistyczne poza podstawą E1–E9.', pola: P.branze.map(([k]) => 'br_' + k) },
    { tytul: 'Koszty drukowania', opis: 'Komplety, arkusze i oprawa dokumentacji dla inwestora i urzędu.', pola: ['drukKomplet', 'drukA4', 'drukA3', 'drukA1', 'drukOprawa'] },
    { tytul: 'Zespół projektowy', opis: 'Obsada ról skraca lub wydłuża szacowany czas; koszty osobowe są opcją dodatkową.', pola: ['zKier', 'zArch', 'zProj', 'zBim', 'zAsyst', 'zEkipa', 'zKoszty'] },
    { tytul: 'Harmonogram płatności', opis: 'Rozłożenie kosztu inwestycji na raty: co miesiąc, co kwartał, co pół roku lub według etapów.', pola: ['platnosc'] },
    { tytul: 'Formalności – plan i wnioski', opis: 'Podstawa planistyczna, tryb i uzgodnienia.', pola: ['podst', 'tryb', 'pelnom', 'bliska', 'mapa', 'przyl', 'zjazd', 'wodno', 'rolna'] },
    { tytul: 'Formalności – realizacja i koszty', opis: 'Nadzór, rozrzut cen i podatek VAT.', pola: ['kb', 'inz', 'kosztm2', 'spread', 'vat'] },
  ];

  const POLE = {};
  FORMULARZ.forEach(([grupa, pola]) => pola.forEach(([klucz, etykieta, opcje]) => {
    POLE[klucz] = { etykieta, opcje, grupa };
  }));

  const views = { wizard: 'viewWizard', calc: 'viewCalc' };

  let currentView = null;
  let stepIdx = 0;

  /* ---------- przełączanie widoków ---------- */
  function setView(name) {
    if (!views[name]) return;
    if (name === currentView) return;
    currentView = name;
    Object.keys(views).forEach(k => { $(views[k]).hidden = (k !== name); });
    document.querySelectorAll('#viewNav button').forEach(b => {
      b.classList.toggle('active', b.dataset.view === name);
    });
    if (name === 'wizard') renderStep();
  }


  /* ---------- kreator ---------- */
  function renderStep() {
    const krok = KROKI[stepIdx];
    $('wizStepInfo').innerHTML = '<b>Krok ' + (stepIdx + 1) + ' z ' + KROKI.length + '</b> · ' + esc(krok.tytul);
    $('wizProgress').style.width = Math.round((stepIdx + 1) / KROKI.length * 100) + '%';
    $('wizQuestions').innerHTML = krok.pola.map(klucz => {
      const p = POLE[klucz];
      if (!p) return '';
      const wartosc = s[klucz];
      const kontrolka = p.opcje
        ? '<select id="w_' + klucz + '" data-k="' + klucz + '">' +
          p.opcje.map(o => '<option' + (String(wartosc) === String(o) ? ' selected' : '') + '>' + esc(o) + '</option>').join('') +
          '</select>'
        : '<input id="w_' + klucz + '" data-k="' + klucz + '" type="number" min="0" step="any" value="' + esc(wartosc) + '">';
      return '<div class="wiz-q"><label for="w_' + klucz + '">' + esc(p.etykieta) + '</label>' + kontrolka + '</div>';
    }).join('');
    $('wizQuestions').scrollTop = 0;
    $('wizBack').disabled = stepIdx === 0;
    const ostatni = stepIdx === KROKI.length - 1;
    $('wizNext').hidden = ostatni;
    $('wizPdf').hidden = !ostatni;
    updateLive();
  }

  function updateLive() {
    const r = oblicz();
    const suma = fazy => r.formalnosci
      .filter(x => fazy.includes(x[0]) && x[2] === 'TAK' && x[3])
      .reduce((a, x) => a + x[3], 0);
    const razem = r.brutto + suma(['Przed projektem', 'Wniosek i uzgodnienia']) + suma(['Realizacja i odbiór']);
    const el = $('wizTotal');
    if (el) el.textContent = zl(razem);
    const czas = obliczCzas(r);
    const czasEl = $('wizCzas');
    if (czasEl) czasEl.textContent = czas.miesiace + ' mies.';
    const pl = obliczPlatnosci(r, czas, razem);
    const platEl = $('wizPlat');
    if (platEl) platEl.textContent = pl.liczbaRat + ' rat · ' + pl.opisTrybu;
    const zespolEl = $('wizZespol');
    if (zespolEl) zespolEl.textContent = czas.zespol.lacznie + ' os.';
    const zakresEl = $('wizZakres');
    if (zakresEl) {
      const wybrane = (r.zakresy || []).filter(x => x.v > 0).map(x => x.n);
      zakresEl.textContent = wybrane.length ? wybrane.join(', ') : 'podstawowy E1–E9';
    }
  }

  /* Zmiana w kreatorze → aktualizuj stan, formularz i wyniki. */
  $('wizQuestions').oninput = e => {
    const klucz = e.target.dataset.k;
    if (!klucz) return;
    s[klucz] = e.target.tagName === 'INPUT' ? (parseFloat(e.target.value) || 0) : e.target.value;
    try { localStorage.setItem('kalkulator-projektu', JSON.stringify(s)); } catch (x) { /* brak pamięci */ }
    const pole = $(klucz);
    if (pole) pole.value = String(s[klucz]);
    pokazWyniki();
    updateLive();
  };

  /* Zmiana w kalkulatorze → odśwież widoczne pytania kreatora. */
  $('form').addEventListener('input', e => {
    const klucz = e.target.id;
    if (!klucz) return;
    const pytanie = $('w_' + klucz);
    if (pytanie) pytanie.value = String(s[klucz]);
    updateLive();
  });

  $('wizBack').onclick = () => { if (stepIdx > 0) { stepIdx--; renderStep(); } };
  $('wizNext').onclick = () => { if (stepIdx < KROKI.length - 1) { stepIdx++; renderStep(); } };
  $('wizCalc').onclick = () => setView('calc');
  $('wizPdf').onclick = () => $('pdfBtn').click();

  /* ---------- nawigacja i start ---------- */
  document.querySelectorAll('#viewNav button').forEach(b => {
    b.onclick = () => setView(b.dataset.view);
  });

  renderStep();
  setView('wizard');
  if (api && api.getAppInfo) {
    api.getAppInfo().then(info => {
      if (!info) return;
      const text = [info.name, info.author, info.company, info.email, '© ' + info.year, 'wersja ' + info.version].filter(Boolean).join(' · ');
      const el = $('wizAbout');
      if (el) el.textContent = text;
    }).catch(() => { });
  }
})();
