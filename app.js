/* =====================================================================
   Kalkulator kosztów projektu architektonicznego – logika aplikacji.
   Stawki i współczynniki są w pliku parametry.js. Ten plik zawiera:
   1) definicję formularza, 2) obliczenia (funkcja oblicz), 3) wyświetlanie wyników.
   ===================================================================== */
const P = PARAMETRY, F = P.formalnosci, B = P.bim, D = P.doplaty;
const $ = id => document.getElementById(id);
const fmtPln = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 });
const zl = v => fmtPln.format(Math.round(v));
const TN = ['Tak', 'Nie'];
const ZAKRES = ['Tylko architektura', 'Architektura + konstrukcja', 'Wszystkie branże (A+K+instalacje)'];
const TRYB_POZWOLENIE = Object.keys(P.tryb)[0];   // „Pozwolenie na budowę”
/* Harmonogram płatności: etykiety w formularzu oraz odstęp w miesiącach.
   Ostatni tryb (0) oznacza raty przypisane do 4 etapów z kanbanu. */
const PLATNOSCI = ['Co miesiąc', 'Co 3 miesiące', 'Co 6 miesięcy', 'Według etapów'];
const ODSTEPY_PLATNOSCI = [1, 3, 6, 0];
/* Pola formularza dla ról zespołu (klucz roli -> pole w FORMULARZ). */
const POLA_ZESPOLU = { kier: 'zKier', arch: 'zArch', proj: 'zProj', bim: 'zBim', asyst: 'zAsyst', ekipa: 'zEkipa' };
/* Zakresy opracowania (rodzaje projektu) – każdy jako osobna opcja. */
const ZAKRESY = P.zakresy;
const klucze = Object.keys;
const esc = v => String(v).replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/* ---------- 0. PARAMETRY: edycja stawek i własne pozycje ----------
   Oryginał parametrów trzymamy w kopii, aby móc przywrócić domyślne wartości.
   Zmiany nakładamy „na miejsce” na obiekt PARAMETRY, dzięki czemu aliasy
   F, B, D (formalnosci, bim, doplaty) zawsze widzą aktualne wartości. */
const PARAMETRY_DOMYSLNE = JSON.parse(JSON.stringify(PARAMETRY));
const KLUCZ_PARAM = 'kalkulator-projektu-parametry';
const KLUCZ_WLASNE = 'kalkulator-projektu-parametry-wlasne';

function flattenParams(obj, path, out) {
  path = path || []; out = out || [];
  Object.keys(obj).forEach(k => {
    const v = obj[k], p = path.concat(k);
    if (typeof v === 'number') out.push({ path: p, value: v });
    else if (v && typeof v === 'object') flattenParams(v, p, out);
  });
  return out;
}
function getWartosc(obj, path) { return path.reduce((o, k) => o[k], obj); }
function setWartosc(obj, path, value) {
  const parent = path.slice(0, -1).reduce((o, k) => o[k], obj);
  parent[path[path.length - 1]] = value;
}
const sciezka = path => JSON.stringify(path);
const etykietaParametru = path => path.map(k => typeof k === 'number' ? '#' + (k + 1) : k).join(' · ');

let nadpisania = {};
try { nadpisania = JSON.parse(localStorage.getItem(KLUCZ_PARAM) || '{}') || {}; } catch (e) { nadpisania = {}; }
Object.keys(nadpisania).forEach(pk => {
  try {
    const path = JSON.parse(pk), v = Number(nadpisania[pk]);
    if (Array.isArray(path) && Number.isFinite(v)) setWartosc(PARAMETRY, path, v);
  } catch (e) { /* zignoruj uszkodzony zapis */ }
});

let wlasne = [];
try { wlasne = JSON.parse(localStorage.getItem(KLUCZ_WLASNE) || '[]') || []; } catch (e) { wlasne = []; }
if (!Array.isArray(wlasne)) wlasne = [];
const saveWlasne = () => { try { localStorage.setItem(KLUCZ_WLASNE, JSON.stringify(wlasne)); } catch (e) { } };

function zbudujEdytorParametrow() {
  const grupy = {};
  flattenParams(PARAMETRY_DOMYSLNE).forEach(p => { const g = p.path[0]; (grupy[g] = grupy[g] || []).push(p); });
  let i = 0;
  $('paramEditor').innerHTML = Object.keys(grupy).map(g =>
    `<div class="param-group">${esc(g)}</div><div class="param-grid">` +
    grupy[g].map(p => {
      const pk = sciezka(p.path), val = getWartosc(PARAMETRY, p.path), changed = val !== getWartosc(PARAMETRY_DOMYSLNE, p.path);
      return `<label for="pv_${i}">${esc(etykietaParametru(p.path))}</label>` +
        `<input id="pv_${i++}" data-path="${esc(pk)}" type="number" step="any" class="${changed ? 'changed' : ''}" value="${val}">`;
    }).join('') + '</div>').join('');

  $('paramEditor').oninput = e => {
    const el = e.target; if (!el.dataset.path) return;
    const path = JSON.parse(el.dataset.path), v = parseFloat(el.value);
    if (!Number.isFinite(v)) return;
    setWartosc(PARAMETRY, path, v);
    nadpisania[el.dataset.path] = v;
    try { localStorage.setItem(KLUCZ_PARAM, JSON.stringify(nadpisania)); } catch (x) { }
    el.classList.toggle('changed', v !== getWartosc(PARAMETRY_DOMYSLNE, path));
    $('paramStatus').textContent = 'Zapisano zmianę parametru. Wynik przeliczony.';
    pokazWyniki();
  };
}

function renderWlasne() {
  const el = $('customList');
  el.innerHTML = wlasne.length ? wlasne.map((p, i) =>
    `<div class="custom-item">
       <label class="inline" title="Wlicz do kosztu projektu"><input type="checkbox" class="cst-in" data-i="${i}" ${p.wKoszcie ? 'checked' : ''}></label>
       <span class="nm">${esc(p.nazwa)}</span>
       <span class="val">${zl(p.wartosc)}</span>
       <button type="button" class="del" data-i="${i}" title="Usuń parametr">×</button>
     </div>`).join('')
    : '<div class="empty">Brak własnych parametrów. Dodaj pierwszy powyżej.</div>';

  el.onclick = e => {
    const b = e.target.closest('button.del'); if (!b) return;
    wlasne.splice(Number(b.dataset.i), 1); saveWlasne(); renderWlasne(); pokazWyniki();
    $('paramStatus').textContent = 'Usunięto parametr.';
  };
  el.onchange = e => {
    const c = e.target.closest('input.cst-in'); if (!c) return;
    wlasne[Number(c.dataset.i)].wKoszcie = c.checked; saveWlasne(); pokazWyniki();
  };
}

function dodajWlasny() {
  const nazwa = $('npNazwa').value.trim(), wartosc = parseFloat($('npWartosc').value);
  if (!nazwa || !Number.isFinite(wartosc)) {
    $('paramStatus').textContent = 'Podaj nazwę i poprawną wartość parametru.';
    (!nazwa ? $('npNazwa') : $('npWartosc')).focus(); return;
  }
  wlasne.push({ nazwa, wartosc, wKoszcie: $('npWKoszcie').checked });
  saveWlasne();
  $('npNazwa').value = ''; $('npWartosc').value = '';
  renderWlasne(); pokazWyniki();
  $('paramStatus').textContent = 'Dodano parametr „' + nazwa + '”.';
}

function resetParametrow() {
  nadpisania = {};
  try { localStorage.removeItem(KLUCZ_PARAM); } catch (e) { }
  flattenParams(PARAMETRY_DOMYSLNE).forEach(p => setWartosc(PARAMETRY, p.path, getWartosc(PARAMETRY_DOMYSLNE, p.path)));
  zbudujEdytorParametrow();
  $('paramStatus').textContent = 'Przywrócono domyślne parametry (własne pozycje zostały).';
  pokazWyniki();
}

/* ---------- 1. FORMULARZ ----------
   Każde pole: [klucz, etykieta, lista opcji]. Brak listy = pole liczbowe.
   Aby dodać pole: dodaj je tu, dodaj wartość domyślną w DOMYSLNE i użyj s.klucz w obliczeniach. */
const FORMULARZ = [
  ['Obiekt', [
    ['obj', 'Rodzaj obiektu', klucze(P.obiekty)], ['char', 'Charakter prac', klucze(P.charakterPrac)],
    ['pu', 'Powierzchnia użytkowa [m²]'], ['pz', 'Powierzchnia zabudowy [m²]'], ['kond', 'Kondygnacje nadziemne'],
    ['podp', 'Podpiwniczenie', TN], ['geo', 'Kategoria geotechniczna', ['1', '2', '3']], ['zab', 'Zabytek lub strefa ochrony', TN]]],
  ['Projekt', [
    ['typ', 'Typ projektu', ['Indywidualny', 'Gotowy + adaptacja']], ['gcena', 'Cena projektu gotowego [zł]'],
    ['lok', 'Lokalizacja', klucze(P.lokalizacja)], ['skompl', 'Skomplikowanie', klucze(P.skomplikowanie)],
    ['instal', 'Standard instalacji', klucze(P.instalacje)], ['wyk', 'Projekt wykonawczy', TN],
    ['kosztorys', 'Kosztorys inwestorski', TN], ['wiz', 'Wizyty nadzoru autorskiego']]],
  ['Zakres opracowania (rodzaj projektu)', ZAKRESY.map(([k, n]) => [k, n, TN])],
  ['Praca w BIM', [
    ['bim', 'Projekt w technologii BIM', TN], ['lod', 'Poziom szczegółowości (LOD)', klucze(B.lod)],
    ['zakres', 'Zakres branż w modelu', ZAKRES], ['koord', 'Koordynacja międzybranżowa', TN],
    ['eir', 'Wymagania BIM (EIR) i Plan BIM (BEP)', TN], ['ifc', 'Przekazanie modelu', ['Nie', 'IFC', 'IFC + COBie']],
    ['d5', 'Zestawienia ilości z modelu (5D)', TN], ['wizn', 'Liczba wizualizacji z modelu'],
    ['cde', 'Wspólne środowisko danych CDE [mies.]']]],
  ['Projekty branżowe (dodatkowe)', P.branze.map(([k, n]) => ['br_' + k, n, TN])],
  ['Koszty drukowania dokumentacji', [
    ['drukKomplet', 'Liczba kompletów dokumentacji'], ['drukA4', 'Arkuszy A4 w komplecie'],
    ['drukA3', 'Arkuszy A3 w komplecie'], ['drukA1', 'Arkuszy A1 (ploty) w komplecie'],
    ['drukOprawa', 'Oprawa / bindowanie kompletu', TN]]],
  ['Zespół projektowy (wpływa na czas)', [
    ['zKier', 'Kierownik projektu – osoby'], ['zArch', 'Architekt – osoby'],
    ['zProj', 'Projektant / konstruktor – osoby'], ['zBim', 'Modelarz BIM – osoby'],
    ['zAsyst', 'Asystent / stażysta – osoby'], ['zEkipa', 'Ekipa budowlana – osoby'],
    ['zKoszty', 'Pokaż koszty zespołu (opcja dodatkowa)', TN]]],
  ['Rozłożenie płatności', [
    ['platnosc', 'Harmonogram płatności', PLATNOSCI]]],
  ['Formalności', [
    ['podst', 'Podstawa planistyczna', ['MPZP', 'WZ - nowy wniosek', 'WZ - już posiadam', 'Do ustalenia']],
    ['tryb', 'Tryb formalny', klucze(P.tryb)], ['pelnom', 'Wniosek składa pełnomocnik', TN],
    ['bliska', 'Pełnomocnik to osoba bliska', TN], ['mapa', 'Mapa do celów projektowych', TN],
    ['przyl', 'Przyłącza wymagają warunków', TN], ['zjazd', 'Działka bez zjazdu z drogi', TN],
    ['wodno', 'Pozwolenie wodnoprawne', TN], ['rolna', 'Grunt rolny lub leśny do wyłączenia', TN],
    ['kb', 'Kierownik budowy', TN], ['inz', 'Inspektor nadzoru', TN],
    ['kosztm2', 'Szacunkowy koszt budowy [zł/m²]'], ['spread', 'Rozrzut cen ±[%]'], ['vat', 'VAT na usługi projektowe [%]']]],
];

/* Wartości początkowe formularza (przykład: dom 150 m²). */
const DOMYSLNE = {
  obj: 'Dom jednorodzinny wolnostojący', char: 'Nowa budowa', pu: 150, pz: 100, kond: 2, podp: 'Nie', geo: '2', zab: 'Nie',
  typ: 'Indywidualny', gcena: 5000, lok: 'Miasto 50–200 tys.', skompl: 'Standardowy', instal: 'Standardowy',
  wyk: 'Tak', kosztorys: 'Nie', wiz: 4,
  bim: 'Tak', lod: 'LOD 300', zakres: ZAKRES[2], koord: 'Tak', eir: 'Nie', ifc: 'IFC', d5: 'Nie', wizn: 3, cde: 6,
  ...Object.fromEntries(P.branze.map(([k]) => ['br_' + k, 'Nie'])),
  ...Object.fromEntries(ZAKRESY.map(([k]) => [k, 'Nie'])),
  drukKomplet: 3, drukA4: 60, drukA3: 25, drukA1: 2, drukOprawa: 'Tak',
  zKier: 1, zArch: 1, zProj: 1, zBim: 1, zAsyst: 0, zEkipa: 2, zKoszty: 'Nie',
  platnosc: PLATNOSCI[0],
  podst: 'MPZP', tryb: TRYB_POZWOLENIE, pelnom: 'Tak', bliska: 'Nie', mapa: 'Tak', przyl: 'Tak', zjazd: 'Nie',
  wodno: 'Nie', rolna: 'Nie', kb: 'Tak', inz: 'Tak', kosztm2: 4000, spread: 20, vat: 23,
};

/* Stan formularza (s) – wczytywany z pamięci przeglądarki, jeśli jest. */
let s = { ...DOMYSLNE };
try { Object.assign(s, JSON.parse(localStorage.getItem('kalkulator-projektu') || '{}')); } catch (e) { }

function zbudujFormularz() {
  $('form').innerHTML = FORMULARZ.map(([tytul, pola]) =>
    `<fieldset><legend class="${tytul === 'Praca w BIM' ? 'bim' : ''}">${tytul}</legend>` +
    pola.map(([k, etykieta, opcje]) => `<label for="${k}">${etykieta}</label>` + (opcje
      ? `<select id="${k}">${opcje.map(o => `<option${String(s[k]) === String(o) ? ' selected' : ''}>${o}</option>`).join('')}</select>`
      : `<input id="${k}" type="number" min="0" step="any" value="${s[k]}">`)).join('') + '</fieldset>').join('');
  $('form').oninput = e => {
    const el = e.target, k = el.id; if (!k) return;
    s[k] = el.tagName === 'INPUT' ? (parseFloat(el.value) || 0) : el.value;
    try { localStorage.setItem('kalkulator-projektu', JSON.stringify(s)); } catch (x) { }
    pokazWyniki();
  };
}

/* ---------- 2. OBLICZENIA ---------- */
function oblicz() {
  const [wspObiektu, minimum, ppoz, sanepid] = P.obiekty[s.obj];
  const L = P.lokalizacja[s.lok];                       // współczynnik lokalizacji
  const tryb = P.tryb[s.tryb];
  const skala = P.skala.filter(x => s.pu >= x[0]).pop()[1];
  const indywidualny = s.typ === 'Indywidualny';

  // Baza projektu podstawowego = stawka × m² × wszystkie współczynniki, nie mniej niż minimum.
  const wspolczynnik = wspObiektu * skala * L * P.skomplikowanie[s.skompl] * P.charakterPrac[s.char] * tryb;
  const baza = Math.max(s.pu * P.stawkaBazowa * wspolczynnik, minimum * tryb);

  // Czynniki szczegółowe poszczególnych etapów.
  const inst = P.instalacje[s.instal];
  const podpArch = s.podp === 'Tak' ? 1 + D.podpiwniczenieArchitektura : 1;
  const podpKons = s.podp === 'Tak' ? 1 + D.podpiwniczenieKonstrukcja : 1;
  const kondyg = 1 + D.naKondygnacjePonad2 * Math.max(0, s.kond - 2);
  const zabytek = s.zab === 'Tak' ? 1 + D.zabytek : 1;
  const czynnikEtapu = [1, 1, 1, podpArch * zabytek, P.geotechnika[s.geo][0] * podpKons * kondyg, inst, inst, 1, zabytek];

  // Etapy E1-E9: baza × udział etapu × czynnik etapu (przy projekcie gotowym etapy = 0).
  const wiersze = P.etapy.map(([kod, nazwa, udzial], i) =>
    ({ k: kod, n: nazwa, v: indywidualny ? baza * udzial * czynnikEtapu[i] : 0, bim: 0 }));
  const kwota = i => wiersze[i].v;

  // Usługi dodatkowe E10-E13 oraz projekt gotowy G1-G2.
  const sumaE4E8 = wiersze.slice(3, 8).reduce((a, r) => a + r.v, 0);
  const dodatkowe = [
    ['E10', 'Projekt wykonawczy', s.wyk === 'Tak' && indywidualny ? sumaE4E8 * P.wykonawczyUdzial : 0],
    ['E11', 'Kosztorys inwestorski', s.kosztorys === 'Tak' ? s.pu * P.kosztorysZaM2 * L : 0],
    ['E12', 'Nadzór autorski', s.wiz * P.wizytaNadzoru * L],
    ['E13', 'Inwentaryzacja architektoniczna', s.char !== 'Nowa budowa' ? s.pu * P.inwentaryzacjaZaM2 : 0],
    ['P1', 'Program funkcjonalno-użytkowy (PFU)', s.bim === 'Nie' && indywidualny ? baza * D.programowaniePFU : 0],
    ['G1', 'Zakup projektu gotowego', !indywidualny ? s.gcena : 0],
    ['G2', 'Adaptacja projektu gotowego', !indywidualny ? P.adaptacjaProjektuGotowego * L : 0],
  ].map(([k, n, v]) => ({ k, n, v, bim: 0 }));

  // BIM: dopłata za modelowanie liczona od etapów objętych modelem (zależnie od zakresu branż).
  let bim = [];
  if (s.bim === 'Tak') {
    const bazaModelu = s.zakres === ZAKRES[0] ? kwota(3)
      : s.zakres === ZAKRES[1] ? kwota(3) + kwota(4)
      : kwota(3) + kwota(4) + kwota(5) + kwota(6);
    bim = [
      ['B1', 'BIM: konfiguracja projektu', B.konfiguracja * L],
      ['B2', 'BIM: modelowanie 3D, ' + s.lod, bazaModelu * B.lod[s.lod]],
      ['B3', 'BIM: koordynacja międzybranżowa', s.koord === 'Tak' && s.zakres !== ZAKRES[0] ? bazaModelu * B.koordynacjaUdzial : 0],
      ['B4', 'BIM: wymagania EIR i Plan BIM (BEP)', s.eir === 'Tak' ? B.eirBep * L : 0],
      ['B5', 'BIM: eksport ' + s.ifc, s.ifc === 'Nie' ? 0 : B.ifc + (s.ifc === 'IFC + COBie' ? B.cobieZaM2 * s.pu : 0)],
      ['B6', 'BIM: zestawienia ilości (5D)', s.d5 === 'Tak' ? B.ilosciZaM2 * s.pu : 0],
      ['B7', 'BIM: wizualizacje z modelu', s.wizn * B.wizualizacja],
      ['B8', 'BIM: wspólne środowisko danych (CDE)', s.cde * B.cdeZaMiesiac],
    ].map(([k, n, v]) => ({ k, n, v, bim: 1 }));
  }

  // Projekty branżowe dodatkowe – nie są w bazie E1–E9, więc nie podwajają E5–E7.
  // Koszt = stawka zł/m² × powierzchnia użytkowa × współczynnik lokalizacji.
  const branze = P.branze.map(([k, nazwa, stawka], i) => ({
    k: 'Br' + (i + 1), n: nazwa, v: s['br_' + k] === 'Tak' ? stawka * s.pu * L : 0,
    bim: 0, stawka: Number(stawka) || 0,
  }));

  // Druk dokumentacji – wydruki i oprawa dla inwestora / urzędu (bez współczynnika lokalizacji).
  const druk = [];
  const komplet = Math.max(0, Number(s.drukKomplet) || 0);
  if (komplet > 0) {
    const ilosc = k => Math.max(0, Number(s[k]) || 0);
    const a4 = ilosc('drukA4'), a3 = ilosc('drukA3'), a1 = ilosc('drukA1');
    if (a4) druk.push({ k: 'K1', n: 'Wydruki A4 (' + komplet + ' kompl. × ' + a4 + ' ark.)', v: komplet * a4 * P.druk.cenaA4, bim: 0, stawka: P.druk.cenaA4 });
    if (a3) druk.push({ k: 'K2', n: 'Wydruki A3 (' + komplet + ' kompl. × ' + a3 + ' ark.)', v: komplet * a3 * P.druk.cenaA3, bim: 0, stawka: P.druk.cenaA3 });
    if (a1) druk.push({ k: 'K3', n: 'Ploty A1 (' + komplet + ' kompl. × ' + a1 + ' ark.)', v: komplet * a1 * P.druk.cenaA1, bim: 0, stawka: P.druk.cenaA1 });
    if (s.drukOprawa === 'Tak') druk.push({ k: 'K4', n: 'Oprawa dokumentacji (' + komplet + ' kompl.)', v: komplet * P.druk.oprawa, bim: 0, stawka: P.druk.oprawa });
  }

  // Zakresy opracowania – dodatkowe pakiety projektu (koncepcja, wykonawczy,
  // wielobranżowy, wnętrza, instalacje, konstrukcja). Wycena z bazy E1–E9
  // albo ze stawki zł/m² – niezależnie od pozostałych usług.
  const zakresy = ZAKRESY.map(([klucz, nazwa, udzial, stawkaM2], i) => ({
    k: 'Z' + (i + 1), klucz, n: nazwa,
    v: s[klucz] === 'Tak' ? (stawkaM2 ? stawkaM2 * s.pu * L : baza * udzial) : 0,
    udzial: Number(udzial) || 0, stawkaM2: Number(stawkaM2) || 0,
  }));

  // Własne parametry zaznaczone jako „wlicz do kosztu” stają się dodatkowymi pozycjami kosztu.
  const wlasneWiersze = wlasne.filter(p => p.wKoszcie && Number.isFinite(Number(p.wartosc)) && Number(p.wartosc) !== 0)
    .map((p, i) => ({ k: 'D' + (i + 1), n: p.nazwa, v: Number(p.wartosc), bim: 0 }));
  const wszystkie = [...wiersze, ...dodatkowe.filter(r => r.v > 0), ...bim.filter(r => r.v > 0),
    ...zakresy.filter(r => r.v > 0), ...branze.filter(r => r.v > 0), ...druk, ...wlasneWiersze];
  const netto = wszystkie.reduce((a, r) => a + r.v, 0);
  const brutto = netto * (1 + s.vat / 100);

  // Formalności: [faza, nazwa, dotyczy (TAK/NIE/SPRAWDŹ), koszt (null = wycena indywidualna), czy ze źródła].
  const kosztBudowy = s.pu * s.kosztm2;
  const A = 'Przed projektem', W = 'Wniosek i uzgodnienia', R = 'Realizacja i odbiór';
  const TAK = 'TAK', NIE = 'NIE', SPR = 'SPRAWDŹ', tn = c => c ? TAK : NIE;
  const pozwolenie = s.tryb === TRYB_POZWOLENIE;
  const formalnosci = [
    [A, 'Wypis i wyrys z MPZP', tn(s.podst === 'MPZP'), F.wypisMpzp, 0],
    [A, 'Decyzja o warunkach zabudowy (WZ)', s.podst === 'WZ - nowy wniosek' ? TAK : s.podst === 'Do ustalenia' ? SPR : NIE, F.decyzjaWZ, 1],
    [A, 'Mapa do celów projektowych', tn(s.mapa === 'Tak'), F.mapaProjektowa, 0],
    [A, 'Dokumentacja geotechniczna', s.obj.startsWith('Garaż') ? SPR : TAK, P.geotechnika[s.geo][1], 0],
    [A, 'Warunki przyłączenia mediów', tn(s.przyl === 'Tak'), null, 0],
    [A, 'Dokument prawa do dysponowania gruntem', TAK, F.odpisKsiegiWieczystej, 0],
    [A, 'Wyłączenie gruntu z produkcji rolnej lub leśnej', tn(s.rolna === 'Tak'), null, 0],
    [A, 'Decyzja środowiskowa', s.obj.startsWith('Budynek produkcyjno') ? SPR : NIE, null, 0],
    [W, 'Uzgodnienie w ZUD', tn(s.przyl === 'Tak' && pozwolenie), F.zud, 0],
    [W, 'Zezwolenie zarządcy drogi na zjazd', tn(s.zjazd === 'Tak'), F.zjazd, 0],
    [W, 'Uzgodnienie rzeczoznawcy ppoż.', tn(ppoz), F.rzeczoznawcaPpoz, 0],
    [W, 'Opinia sanitarna (sanepid)', tn(sanepid), F.sanepid, 0],
    [W, 'Uzgodnienie konserwatora zabytków', tn(s.zab === 'Tak'), F.konserwator, 0],
    [W, 'Pozwolenie lub zgłoszenie wodnoprawne', tn(s.wodno === 'Tak'), F.wodnoprawne, 0],
    [W, 'Opłata skarbowa za pozwolenie na budowę', tn(pozwolenie), Math.min(F.oplataSkarbowaMax, F.oplataSkarbowaZaM2 * s.pu), 1],
    [W, 'Zgłoszenie robót (21 dni na sprzeciw)', tn(!pozwolenie), 0, 1],
    [W, 'Zaświadczenie o braku sprzeciwu', tn(!pozwolenie), F.zaswiadczenieBrakSprzeciwu, 1],
    [W, 'Pełnomocnictwo', tn(s.pelnom === 'Tak' && s.bliska === 'Nie'), F.pelnomocnictwo, 1],
    [W, 'Umowa z zapisami BIM (LOD, licencje, formaty)', tn(s.bim === 'Tak'), 0, 0],
    [W, 'Dokumentacja dla urzędu w wymaganej formie (nie sam model BIM)', s.bim === 'Tak' ? SPR : NIE, 0, 0],
    [R, 'Dziennik budowy', s.tryb.includes('bez projektu') ? SPR : TAK, F.dziennikBudowy, 0],
    [R, 'Kierownik budowy', tn(s.kb === 'Tak'), Math.max(F.kierownikMinimum, F.kierownikProcent * kosztBudowy), 0],
    [R, 'Inspektor nadzoru inwestorskiego', tn(s.inz === 'Tak'), F.inspektorProcent * kosztBudowy, 0],
    [R, 'Geodeta: wytyczenie budynku', TAK, F.tyczenie, 0],
    [R, 'Protokoły odbiorowe (kominiarski, elektryczne, gaz)', TAK, F.protokolyOdbiorowe, 0],
    [R, 'Geodeta: inwentaryzacja powykonawcza', TAK, F.inwentaryzacjaPowykonawcza, 0],
    [R, 'Zawiadomienie o zakończeniu budowy', TAK, F.zawiadomienieZakonczenie, 0],
  ];
  return { wiersze: wszystkie, netto, brutto, rozrzut: s.spread / 100, formalnosci, branze, druk, zakresy };
}

/* ---------- 2b. SZACOWANY CZAS REALIZACJI I KANBAN ----------
   Na podstawie stawek czasowych z PARAMETRY.czas oraz danych formularza.
   Kolumny kanbanu odpowiadają czterem fazom inwestycji. Każda karta to
   zadanie z szacowanym czasem trwania (dni). Część zadań może biec
   równolegle – suma jest szacunkiem „scieżka krytyczna uproszczona”. */
function obliczCzas(r) {
  const C = P.czas;
  const o = P.obiekty[s.obj];
  const ppoz = o[2], sanepid = o[3];
  const pozwolenie = s.tryb === TRYB_POZWOLENIE;
  const gotowy = s.typ !== 'Indywidualny';
  const wspObj = o[4] || 1;
  const wspSkom = C.wspSkomplikowanie[s.skompl] || 1;
  const wspLok = C.wspLokalizacja[s.lok] || 1;
  const skala = 1 + C.skala * (Math.sqrt((s.pu || 100) / 100) - 1);
  const mnoznikProjekt = wspObj * wspSkom * skala * (s.bim === 'Tak' ? C.wspBim : 1);
  const mnoznikUzgod = wspLok * (0.5 + 0.5 * wspObj);
  const dni = v => Math.max(1, Math.round(v));
  const k = (faza, kod, nazwa, wartosc, mnoznik, tag) => ({ faza, kod, nazwa, dni: dni(wartosc * mnoznik), tag: tag || '' });

  const karty = [];

  // FAZA 1: Przygotowanie (przed projektem).
  const przyg = C.przygotowanie;
  if (s.podst === 'MPZP') karty.push(k('przyg', 'P1', 'Wypis i wyrys z MPZP', przyg.wypisMpzp, mnoznikUzgod));
  if (s.podst === 'WZ - nowy wniosek') karty.push(k('przyg', 'P2', 'Decyzja o warunkach zabudowy (WZ)', przyg.WZ, mnoznikUzgod));
  if (s.mapa === 'Tak') karty.push(k('przyg', 'P3', 'Mapa do celów projektowych', przyg.mapa, mnoznikUzgod));
  if (!s.obj.startsWith('Garaż')) karty.push(k('przyg', 'P4', 'Dokumentacja geotechniczna', przyg.geotech, mnoznikUzgod));
  if (s.przyl === 'Tak') karty.push(k('przyg', 'P5', 'Warunki przyłączenia mediów', przyg.przylacza, mnoznikUzgod));
  karty.push(k('przyg', 'P6', 'Dokument prawa do dysponowania gruntem', przyg.grunt, mnoznikUzgod));

  // FAZA 2: Projektowanie – etapy E1–E9 + branże + BIM.
  const mp = mnoznikProjekt * (gotowy ? C.wspGotowy : 1);
  P.etapy.forEach(([kod, nazwa]) => {
    karty.push(k('projekt', kod, nazwa, C.etapy[kod] || 0, mp, gotowy ? 'adaptacja' : ''));
  });
  r.branze.filter(x => x.v > 0).forEach((b, i) => {
    karty.push(k('projekt', 'Br' + (i + 1), b.n, C.branzaDni, mnoznikProjekt, 'branża'));
  });
  if (s.bim === 'Tak') karty.push(k('projekt', 'BIM', 'Model BIM, IFC i koordynacja', 10, mnoznikProjekt, 'BIM'));
  ZAKRESY.forEach(([klucz, nazwa], i) => {
    if (s[klucz] !== 'Tak') return;
    const d = (C.zakresyDni && C.zakresyDni[klucz]) || 10;
    karty.push(k('projekt', 'Z' + (i + 1), nazwa, d, mnoznikProjekt, 'zakres'));
  });

  // FAZA 3: Uzgodnienia i pozwolenie.
  const uz = C.uzgodnienia;
  if (s.przyl === 'Tak' && pozwolenie) karty.push(k('uzgod', 'U1', 'Uzgodnienie w ZUD', uz.zud, mnoznikUzgod));
  if (s.zjazd === 'Tak') karty.push(k('uzgod', 'U2', 'Zezwolenie zarządcy drogi na zjazd', uz.zjazd, mnoznikUzgod));
  if (ppoz) karty.push(k('uzgod', 'U3', 'Uzgodnienie rzeczoznawcy ppoż.', uz.ppoz, mnoznikUzgod));
  if (sanepid) karty.push(k('uzgod', 'U4', 'Opinia sanitarna (sanepid)', uz.sanepid, mnoznikUzgod));
  if (s.zab === 'Tak') karty.push(k('uzgod', 'U5', 'Uzgodnienie konserwatora zabytków', uz.konserwator, mnoznikUzgod));
  if (s.wodno === 'Tak') karty.push(k('uzgod', 'U6', 'Pozwolenie wodnoprawne', uz.wodnoprawne, mnoznikUzgod));
  karty.push(pozwolenie
    ? k('uzgod', 'U7', 'Decyzja o pozwoleniu na budowę', uz.pozwolenie, mnoznikUzgod)
    : k('uzgod', 'U7', 'Zgłoszenie (21 dni na sprzeciw)', uz.zgloszenie, mnoznikUzgod));

  // FAZA 4: Realizacja i odbiór.
  const rz = C.realizacja;
  /* Czas budowy rośnie potęgowo z powierzchnią (wykładnik < 1), więc duży
     obiekt nie dostaje nierealnych tysięcy dni. Dla 150 m² wynik jest
     taki sam jak w poprzednim modelu liniowym (90 dni). */
  const pow = Math.max(1, s.pu || rz.budowaRefM2);
  const budowaBazowa = rz.budowaMin * Math.pow(pow / rz.budowaRefM2, rz.budowaWykladnik);
  const budowa = Math.max(rz.budowaMin * 0.25, budowaBazowa) * wspObj * wspSkom;
  karty.push(k('realiz', 'R1', 'Roboty budowlane', budowa, 1, 'budowa'));
  karty.push(k('realiz', 'R2', 'Geodeta: wytyczenie budynku', rz.tyczenie, 1));
  karty.push(k('realiz', 'R3', 'Protokoły odbiorowe', rz.protokoly, 1));
  karty.push(k('realiz', 'R4', 'Geodeta: inwentaryzacja powykonawcza', rz.inwentaryzacja, 1));
  karty.push(k('realiz', 'R5', 'Zawiadomienie o zakończeniu budowy', rz.zawiadomienie, 1));

  // Kolumny kanbanu z sumami dni.
  const kolumny = [
    { id: 'przyg', tytul: 'Przygotowanie', pod: 'Przed projektem', kolor: 'var(--acc)' },
    { id: 'projekt', tytul: 'Projektowanie', pod: 'E1–E9, BIM, branże', kolor: 'var(--bim)' },
    { id: 'uzgod', tytul: 'Uzgodnienia', pod: 'Pozwolenie / zgłoszenie', kolor: 'var(--warn)' },
    { id: 'realiz', tytul: 'Realizacja', pod: 'Budowa i odbiór', kolor: 'var(--ok)' },
  ].map(col => {
    const lista = karty.filter(x => x.faza === col.id);
    return { ...col, karty: lista, dni: lista.reduce((a, x) => a + x.dni, 0) };
  });
  /* 1.6.0: korekta czasu o obsadę zespołu. Zdolność fazy to obsada ważona
     udziałami ról, znormalizowana tak, że domyślny zespół daje mnożnik 1.
     Więcej osób skraca czas z zwrotami malejącymi (exp), ale nigdy poniżej
     części niepodlegającej skróceniu (min) – np. terminy urzędowe. */
  const Z = P.zespol;
  const liczbyZ = {};
  Object.keys(POLA_ZESPOLU).forEach(r => { liczbyZ[r] = Math.max(0, Number(s[POLA_ZESPOLU[r]]) || 0); });
  const zdolnosc = {}, korekta = {};
  kolumny.forEach(col => {
    const ust = Z.fazy[col.id];
    const sumaBaz = Z.role.reduce((a, r) => a + liczbyZ[r.k] * (r.fazy[col.id] || 0), 0);
    const sumaDom = Z.role.reduce((a, r) => a + r.dom * (r.fazy[col.id] || 0), 0) || 1;
    const cap = sumaBaz / sumaDom;
    const wsp = Math.pow(Math.max(cap, 0.05), ust.exp);
    korekta[col.id] = Math.min(ust.max || 3, Math.max(ust.min, 1 / wsp));
    zdolnosc[col.id] = cap;
  });
  karty.forEach(x => { x.dni = Math.max(1, Math.round(x.dni * korekta[x.faza])); });
  kolumny.forEach(col => { col.dni = karty.filter(x => x.faza === col.id).reduce((a, x) => a + x.dni, 0); });
  const dniRazem = kolumny.reduce((a, x) => a + x.dni, 0);

  return {
    kolumny, karty, dniRazem,
    zespol: {
      liczby: liczbyZ, zdolnosc, korekta,
      lacznie: Object.keys(liczbyZ).reduce((a, r) => a + liczbyZ[r], 0),
    },
    miesiace: (dniRazem / 30).toFixed(1),
    dniProjektu: kolumny[1].dni,
    dniFormalnosci: kolumny[0].dni + kolumny[2].dni,
    dniRealizacji: kolumny[3].dni,
  };
}

/* ---------- 2c. HARMONOGRAM PŁATNOŚCI ----------
   Łączny koszt inwestycji (projekt + formalności + realizacja) rozkładamy na raty.
   Tryby czasowe (1/3/6 miesięcy) dostosowują LICZBĘ RAT do szacowanego czasu
   z obliczCzas(): liczba rat = ceil(miesiące / odstęp). Tryb „Według etapów”
   przypisuje jedną ratę do każdej z czterech faz kanbanu, a termin raty do
   końca czasu trwania danej fazy. Kwoty faz sumują się do kwoty całkowitej. */
function obliczPlatnosci(r, czas, razem) {
  const idx = Math.max(0, PLATNOSCI.indexOf(s.platnosc));
  const tryb = PLATNOSCI[idx];
  const odstep = ODSTEPY_PLATNOSCI[idx] || 1;
  const miesiace = Math.max(1, czas.dniRazem / 30);
  const sumaFazy = faza => r.formalnosci
    .filter(x => x[0] === faza && x[2] === 'TAK' && x[3])
    .reduce((a, x) => a + x[3], 0);
  const raty = [];
  let opisTrybu;

  if (idx === 3) {
    // Według etapów – 4 fazy inwestycji z kanbanu; kwota wg udziału kosztów fazy.
    opisTrybu = 'według 4 etapów inwestycji';
    const fazy = [
      { nazwa: 'Przygotowanie', kolor: 'var(--acc)', kwota: sumaFazy('Przed projektem'), dni: czas.kolumny[0].dni },
      { nazwa: 'Projektowanie', kolor: 'var(--bim)', kwota: r.brutto, dni: czas.kolumny[1].dni },
      { nazwa: 'Uzgodnienia', kolor: 'var(--warn)', kwota: sumaFazy('Wniosek i uzgodnienia'), dni: czas.kolumny[2].dni },
      { nazwa: 'Realizacja', kolor: 'var(--ok)', kwota: sumaFazy('Realizacja i odbiór'), dni: czas.kolumny[3].dni },
    ];
    let doDnia = 0;
    fazy.forEach((f, i) => {
      doDnia += f.dni;
      raty.push({
        lp: i + 1, termin: f.nazwa, miesiac: doDnia / 30, dniDo: doDnia,
        kwota: f.kwota, kolor: f.kolor, opis: 'koniec etapu · ' + f.dni + ' dni',
      });
    });
  } else {
    opisTrybu = odstep === 1 ? 'co miesiąc' : 'co ' + odstep + ' miesiące';
    const liczba = Math.max(1, Math.ceil(miesiace / odstep));
    const kwota = razem / liczba;
    const kolor = idx === 2 ? 'var(--warn)' : idx === 1 ? 'var(--bim)' : 'var(--acc)';
    for (let i = 0; i < liczba; i++) {
      raty.push({
        lp: i + 1,
        termin: i === 0 ? 'Zaliczka / rozpoczęcie' : 'Rata ' + (i + 1),
        miesiac: i * odstep, dniDo: i * odstep * 30,
        kwota, kolor, opis: 'miesiąc ' + (i * odstep),
      });
    }
  }

  // Korekta zaokrągleń: ostatnia rata domyka sumę do kwoty całkowitej.
  if (raty.length) {
    const roznica = razem - raty.reduce((a, x) => a + x.kwota, 0);
    raty[raty.length - 1].kwota += roznica;
  }
  raty.forEach(x => { x.udzial = razem > 0 ? x.kwota / razem : 0; });

  return {
    tryb, opisTrybu, odstep, raty, razem,
    liczbaRat: raty.length,
    miesiace: Number(miesiace.toFixed(1)),
    srednio: raty.length ? razem / raty.length : 0,
    sumaRat: raty.reduce((a, x) => a + x.kwota, 0),
  };
}

/* ---------- 2d. KOSZTY ZESPOŁU (opcja dodatkowa) ----------
   Koszt osobowy = liczba osób × stawka miesięczna × czas inwestycji [mies.]
   × zaangażowanie roli. To alternatywny widok nakładu pracy, nie sumuje się
   z główną wyceną (brutto) – służy do porównania wariantów obsady. */
function obliczKosztyZespolu(czas) {
  const Z = P.zespol;
  const mies = Math.max(1, czas.dniRazem / 30);
  const pozycje = Z.role.map(r => {
    const liczba = Math.max(0, Number(s[POLA_ZESPOLU[r.k]]) || 0);
    const zaang = Z.zaangazowanie[r.k] || 0;
    return {
      kod: r.k, nazwa: r.n, liczba, stawka: r.stawka, zaang,
      koszt: liczba * r.stawka * mies * zaang,
    };
  });
  return {
    pozycje, mies,
    razem: pozycje.reduce((a, x) => a + x.koszt, 0),
    wlaczone: s.zKoszty === 'Tak',
  };
}

/* ---------- 3. WYŚWIETLANIE WYNIKÓW ---------- */
const kolor = (r, i) => r.bim ? 'var(--bim)' : `color-mix(in srgb,var(--acc) ${100 - i * 7}%,var(--panel))`;

function pokazWyniki() {
  const r = oblicz();
  const czas = obliczCzas(r);
  const suma = fazy => r.formalnosci.filter(x => fazy.includes(x[0]) && x[2] === 'TAK' && x[3]).reduce((a, x) => a + x[3], 0);
  const przedWnioskiem = suma(['Przed projektem', 'Wniosek i uzgodnienia']), realizacja = suma(['Realizacja i odbiór']);
  const razem = r.brutto + przedWnioskiem + realizacja;
  const pl = obliczPlatnosci(r, czas, razem);
  const kosztyZ = obliczKosztyZespolu(czas);
  const kosztBim = r.wiersze.filter(x => x.bim).reduce((a, x) => a + x.v, 0);
  const kosztBranze = r.branze.filter(x => x.v > 0).reduce((a, x) => a + x.v, 0);
  const kosztZakresy = (r.zakresy || []).filter(x => x.v > 0).reduce((a, x) => a + x.v, 0);
  const kosztDruk = r.druk.reduce((a, x) => a + x.v, 0);

  $('grand').textContent = zl(razem);
  $('rng').textContent = 'Przedział: ' + zl(r.brutto * (1 - r.rozrzut) + przedWnioskiem + realizacja) + ' – ' + zl(r.brutto * (1 + r.rozrzut) + przedWnioskiem + realizacja);
  $('bar').innerHTML = r.wiersze.map((x, i) => `<i style="width:${x.v / r.netto * 100}%;background:${kolor(x, i)}" title="${x.n}: ${zl(x.v)}"></i>`).join('');
  const podzial = [['Projekt i usługi architekta (brutto)', r.brutto], ['w tym praca w BIM (netto)', kosztBim]];
  if (kosztBranze) podzial.push(['w tym projekty branżowe (netto)', kosztBranze]);
  if (kosztZakresy) podzial.push(['w tym zakresy opracowania (netto)', kosztZakresy]);
  if (kosztDruk) podzial.push(['w tym druk dokumentacji (netto)', kosztDruk]);
  podzial.push(['Formalności i opłaty do wniosku', przedWnioskiem], ['Realizacja i odbiór', realizacja]);
  $('split').innerHTML = podzial.map(x => `<div><b>${zl(x[1])}</b><span>${x[0]}</span></div>`).join('');

  // Ostrzeżenia o niespójnych danych.
  const uwagi = [];
  if (s.tryb.includes('bez projektu') && (s.pz > 70 || s.obj !== Object.keys(P.obiekty)[0])) uwagi.push('Tryb „bez projektu” dotyczy domu wolnostojącego do 70 m² zabudowy. Sprawdź warunki.');
  if (s.podst === 'WZ - nowy wniosek') uwagi.push('Od 1.09.2026 nowe WZ są możliwe tylko w gminach z planem ogólnym. Sprawdź to w gminie przed wnioskiem.');
  if (s.podst === 'Do ustalenia') uwagi.push('Ustal w gminie, czy działka ma MPZP i czy gmina uchwaliła plan ogólny.');
  if (s.bim === 'Tak' && s.koord === 'Tak' && s.zakres === ZAKRES[0]) uwagi.push('Koordynacja międzybranżowa wymaga co najmniej dwóch branż w modelu. Jej koszt wynosi 0.');
  if (s.bim === 'Tak' && kosztBranze && s.zakres === ZAKRES[0]) uwagi.push('Wybrane projekty branżowe nie są objęte zakresem modelu BIM „Tylko architektura” – rozważ szerszy zakres lub potraktuj je jako odrębne opracowanie.');
  if (s.pu <= 0) uwagi.push('Wpisz powierzchnię użytkową.');
  const aktywneZakresy = (r.zakresy || []).filter(x => x.v > 0).map(x => x.n);
  if (aktywneZakresy.length) uwagi.push('Zaznaczone zakresy (' + aktywneZakresy.join(', ') +
    ') są dodatkowymi pakietami. Baza E1–E9 już obejmuje standardową koncepcję, konstrukcję i instalacje – sprawdź, czy nie zamawiasz ich podwójnie.');
  $('notes').innerHTML = uwagi.map(n => `<div class="note">${n}</div>`).join('');

  // Tabela etapów.
  $('stg').innerHTML = '<tr><th>Etap</th><th class="n">Netto</th><th class="n">Brutto</th><th class="n">Udział</th></tr>' +
    r.wiersze.map((x, i) => `<tr><td><span class="sw" style="background:${kolor(x, i)}"></span>${x.k}  ${x.n}</td><td class="n">${zl(x.v)}</td><td class="n">${zl(x.v * (1 + s.vat / 100))}</td><td class="n">${(x.v / r.netto * 100).toFixed(1)}%</td></tr>`).join('') +
    `<tr class="sum"><td>Razem projekt</td><td class="n">${zl(r.netto)}</td><td class="n">${zl(r.brutto)}</td><td class="n">${zl(r.netto / (s.pu || 1))}/m²</td></tr>`;

  // Tabela formalności (pozycje, które nie dotyczą, są pomijane).
  const dotyczy = r.formalnosci.filter(x => x[2] !== 'NIE');
  $('frm').innerHTML = '<tr><th>Wymaganie</th><th>Status</th><th class="n">Koszt</th><th>Dane</th></tr>' +
    ['Przed projektem', 'Wniosek i uzgodnienia', 'Realizacja i odbiór'].map(faza => `<tr><td colspan="4"><b>${faza}</b></td></tr>` +
      dotyczy.filter(x => x[0] === faza).map(x => `<tr><td>${x[1]}</td><td class="tag${x[2] === 'SPRAWDŹ' ? ' chk' : ''}">${x[2] === 'TAK' ? 'dotyczy' : 'sprawdź'}</td><td class="n">${x[3] === null ? 'wg wyceny' : x[2] === 'TAK' ? zl(x[3]) : '–'}</td><td class="tag">${x[4] ? 'źródło' : 'szacunek'}</td></tr>`).join('')).join('');
  $('hid').textContent = 'Pominięto ' + (r.formalnosci.length - dotyczy.length) + ' pozycji, które nie dotyczą Twoich danych.';

  // Własne parametry – tabela wynikowa i dane do nagłówka wydruku.
  const cr = $('customResult');
  if (wlasne.length) {
    cr.hidden = false;
    $('cst').innerHTML = '<tr><th>Parametr</th><th class="n">Wartość</th><th>Udział w wycenie</th></tr>' +
      wlasne.map(p => `<tr><td>${esc(p.nazwa)}</td><td class="n">${zl(p.wartosc)}</td><td class="tag">${p.wKoszcie ? 'TAK – wliczono do „Razem”' : 'NIE – tylko informacyjnie'}</td></tr>`).join('') +
      `<tr class="sum"><td>W tym wliczono do kosztu projektu</td><td class="n">${zl(wlasne.filter(p => p.wKoszcie).reduce((a, p) => a + Number(p.wartosc), 0))}</td><td class="tag">netto (przed VAT)</td></tr>`;
  } else { cr.hidden = true; }

  // Projekty branżowe – osobna tabela w kalkulatorze i w PDF.
  const brPanel = $('brzResult');
  if (brPanel) {
    const aktywneBr = r.branze.filter(x => x.v > 0);
    brPanel.hidden = !aktywneBr.length;
    if (aktywneBr.length) {
      const stawka = v => Number(v).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      $('brz').innerHTML = '<tr><th>Branża</th><th class="n">Stawka zł/m²</th><th class="n">Netto</th><th class="n">Brutto</th></tr>' +
        aktywneBr.map(x => `<tr><td>${esc(x.n)}</td><td class="n">${stawka(x.stawka)}</td><td class="n">${zl(x.v)}</td><td class="n">${zl(x.v * (1 + s.vat / 100))}</td></tr>`).join('') +
        `<tr class="sum"><td>Razem projekty branżowe</td><td class="n">–</td><td class="n">${zl(kosztBranze)}</td><td class="n">${zl(kosztBranze * (1 + s.vat / 100))}</td></tr>`;
    }
  }

  // Zakresy opracowania – osobna tabela w kalkulatorze i w PDF.
  const zkPanel = $('zakresResult');
  if (zkPanel) {
    const aktywne = r.zakresy.filter(x => x.v > 0);
    zkPanel.hidden = !aktywne.length;
    if (aktywne.length) {
      const podstawa = x => x.stawkaM2 ? x.stawkaM2 + ' zł/m²' : (x.udzial * 100).toFixed(0) + '% bazy E1–E9';
      $('zakresTab').innerHTML = '<tr><th>Zakres / rodzaj projektu</th><th class="n">Podstawa wyceny</th><th class="n">Netto</th><th class="n">Brutto</th></tr>' +
        aktywne.map(x => `<tr><td>${esc(x.n)}</td><td class="n">${esc(podstawa(x))}</td><td class="n">${zl(x.v)}</td><td class="n">${zl(x.v * (1 + s.vat / 100))}</td></tr>`).join('') +
        `<tr class="sum"><td>Razem zakresy opracowania</td><td class="n">–</td><td class="n">${zl(kosztZakresy)}</td><td class="n">${zl(kosztZakresy * (1 + s.vat / 100))}</td></tr>`;
    }
  }

  // Druk dokumentacji – osobna tabela w kalkulatorze i w PDF.
  const drPanel = $('drkResult');
  if (drPanel) {
    drPanel.hidden = !r.druk.length;
    if (r.druk.length) {
      const cena = v => Number(v).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      $('drk').innerHTML = '<tr><th>Pozycja</th><th class="n">Cena jednostkowa</th><th class="n">Netto</th><th class="n">Brutto</th></tr>' +
        r.druk.map(x => `<tr><td>${esc(x.n)}</td><td class="n">${cena(x.stawka)} zł</td><td class="n">${zl(x.v)}</td><td class="n">${zl(x.v * (1 + s.vat / 100))}</td></tr>`).join('') +
        `<tr class="sum"><td>Razem druk dokumentacji</td><td class="n">–</td><td class="n">${zl(kosztDruk)}</td><td class="n">${zl(kosztDruk * (1 + s.vat / 100))}</td></tr>`;
    }
  }

  // Szacowany czas realizacji + kanban (kolumny: przygotowanie / projekt / uzgodnienia / realizacja).
  const czasPanel = $('czasResult');
  if (czasPanel) {
    $('czasSummary').innerHTML =
      `<div class="czas-total"><b>${czas.miesiace}</b><span>miesięcy szacunkowo</span></div>` +
      `<div><b>${czas.dniRazem} dni</b><span>łącznie (suma zadań)</span></div>` +
      `<div><b>${czas.dniProjektu} dni</b><span>projektowanie</span></div>` +
      `<div><b>${czas.dniFormalnosci} dni</b><span>przygotowanie i uzgodnienia</span></div>` +
      `<div><b>${czas.dniRealizacji} dni</b><span>realizacja i odbiór</span></div>`;
    $('kanban').innerHTML = czas.kolumny.map(col =>
      `<div class="kanban-col" style="--kolor:${col.kolor}">
         <div class="kanban-head"><b>${esc(col.tytul)}</b><span>${col.dni} dni</span><small>${esc(col.pod)}</small></div>
         <div class="kanban-cards">${col.karty.map(c =>
           `<div class="kanban-card"><span class="kanban-kod">${esc(c.kod)}</span><span class="kanban-nazwa">${esc(c.nazwa)}</span>` +
           `${c.tag ? `<span class="kanban-tag">${esc(c.tag)}</span>` : ''}<b class="kanban-dni">${c.dni} d</b></div>`).join('')}</div>
       </div>`).join('');
  }

  $('printMeta').textContent = [s.obj, s.lok, 'pow. użytkowa ' + s.pu + ' m²', s.char, s.tryb,
    'szacowany czas ~' + czas.miesiace + ' mies.', 'VAT ' + s.vat + '%'].join(' · ');
   // Zespół projektowy – struktura obsady i (opcjonalnie) koszty osobowe.
   const zPanel = $('zespolResult');
   if (zPanel) {
     const Z = P.zespol;
     $('zespolSummary').innerHTML =
       `<div><b>${czas.zespol.lacznie}</b><span>osób w zespole</span></div>` +
       `<div><b>${zl(czas.zespol.korekta.projekt * 100)}%</b><span>czas projektowania vs. baza</span></div>` +
       `<div><b>${czas.zespol.korekta.uzgod * 100}%</b><span>czas uzgodnień vs. baza</span></div>` +
       `<div><b>${zl(czas.zespol.korekta.realiz * 100)}%</b><span>czas realizacji vs. baza</span></div>` +
       `<div class="czas-total"><b>${czas.dniRazem} dni</b><span>skorygowany czas całkowity (${czas.miesiace} mies.)</span></div>`;
     $('zespolTab').innerHTML =
       '<tr><th>Rola</th><th class="n">Osoby</th><th class="n">Zdolność</th><th class="n">Stawka / mies.</th><th class="n">Zaangażowanie</th><th class="n">Koszt [zł]</th></tr>' +
       Z.role.map(r => {
         const p = kosztyZ.pozycje.find(x => x.kod === r.k);
         const zd = czas.zespol.zdolnosc[r.k];
         return `<tr><td>${esc(r.n)}</td><td class="n">${p.liczba}</td>` +
           `<td class="n">${Math.round((zd || 0) * 100)}%</td>` +
           `<td class="n">${zl(p.stawka)}</td><td class="n">${Math.round(p.zaang * 100)}%</td>` +
           `<td class="n">${kosztyZ.wlaczone ? zl(p.koszt) : '—'}</td></tr>`;
       }).join('') +
       `<tr class="sum"><td colspan="5">Razem koszty osobowe${kosztyZ.wlaczone ? '' : ' (opcja wyłączona)'}</td>` +
       `<td class="n">${kosztyZ.wlaczone ? zl(kosztyZ.razem) : '—'}</td></tr>`;
     $('zespolNote').textContent = 'Czas jest korygowany obsadą: więcej osób skraca project i budowę (zwroty malejące), ' +
       'ale terminy urzędowe i czynności sekwencyjne mają minimalny czas, którego nie da się skrócić. ' +
       'Domyślny zespół (1 kierownik, 1 architekt, 1 projektant, 1 BIM, 0 asystentów, 2 ekipy) daje mnożnik 1,00. ' +
       (kosztyZ.wlaczone
         ? 'Koszty osobowe są orientacyjnym scenariuszem alternatywnym – NIE sumują się z wyceną brutto i nie wpływają na raty.'
         : 'Koszty osobowe są opcją dodatkową – włącz pole „Pokaż koszty zespołu”, aby je zobaczyć.');
   }

   // Harmonogram platnosci - liczba rat i terminy dostosowane do czasu realizacji.
   const plPanel = $('platResult');
   if (plPanel) {
     $('platSummary').innerHTML =
       `<div class="plat-total"><b>${pl.liczbaRat}</b><span>rat · ${esc(pl.opisTrybu)}</span></div>` +
       `<div><b>${zl(pl.razem)}</b><span>kwota do rozlozenia</span></div>` +
       `<div><b>${zl(pl.srednio)}</b><span>srednio na rate</span></div>` +
       `<div><b>${pl.miesiace} mies.</b><span>szacowany czas realizacji</span></div>`;
     $('plat').innerHTML = '<tr><th>Lp.</th><th>Termin / etap</th><th>Miesiac</th><th class="n">Udzial</th><th class="n">Kwota raty</th></tr>' +
       pl.raty.map(x => `<tr><td>${x.lp}</td><td><span class="sw" style="background:${x.kolor}"></span>${esc(x.termin)}</td>` +
         `<td>~${Number(x.miesiac.toFixed(1))}</td><td class="n">${(x.udzial * 100).toFixed(1)}%</td><td class="n">${zl(x.kwota)}</td></tr>`).join('') +
       `<tr class="sum"><td colspan="4">Razem ${pl.liczbaRat} rat</td><td class="n">${zl(pl.sumaRat)}</td></tr>`;
     $('platNote').textContent = 'Szacunek: liczba rat wynika z czasu realizacji (' + czas.dniRazem + ' dni ≈ ' +
       czas.miesiace + ' miesiecy) i wybranego trybu „' + pl.tryb + '”. Kwoty obejmuja projekt, formalnosci i realizacje. ' +
       'Terminy sa orientacyjne - ostateczny harmonogram ustala umowa.';
   }

  $('printDate').textContent = new Date().toLocaleString('pl-PL');
   $('printMeta').textContent += ' · platnosci: ' + pl.opisTrybu;
   $('printMeta').textContent += ' · zespol: ' + czas.zespol.lacznie + ' os. (czas ' + czas.miesiace + ' mies.)';
   if (aktywneZakresy.length) $('printMeta').textContent += ' · zakresy: ' + aktywneZakresy.join(', ');
}

zbudujFormularz();
zbudujEdytorParametrow();
renderWlasne();
/* ---------- opłata 100 zł za raport PDF ---------- */
function paySet(text, percent, opts) {
  const o = opts || {};
  $('payStatus').textContent = text;
  $('payProgress').style.width = Math.max(0, Math.min(100, percent)) + '%';
  $('payOpen').hidden = !o.open;
  $('payCancel').hidden = o.cancel === false;
}
function payShow(on) { $('paymentModal').hidden = !on; }
function unlockResults() { document.body.classList.add('results-unlocked'); }
function renderPayment(ev) {
  if (!ev) return;
  if (['paid','consumed','done','bypass','save_canceled'].includes(ev.status)) unlockResults();
  const sess = $('paySession');
  switch (ev.status) {
    case 'awaiting':
      sess.textContent = 'Sesja: ' + ev.sessionId;
      sess.hidden = false;
      paySet('Otworzyliśmy stronę płatności. Po opłaceniu raport zapisze się automatycznie.', 35, { open: true });
      break;
    case 'paid':
      paySet('Płatność potwierdzona. Zapisywanie raportu…', 78, { open: false });
      break;
    case 'consumed':
      paySet('Opłata zarezerwowana. Zapis pliku…', 90, { open: false, cancel: false });
      break;
    case 'done':
      paySet('Gotowe – raport został zapisany.', 100, { open: false, cancel: false });
      break;
    case 'bypass':
      paySet('Tryb testowy – pominięto płatność.', 100, { open: false, cancel: false });
      break;
    case 'cancelled':
      paySet('Płatność anulowana. Raport nie został zapisany.', 100, { open: false, cancel: false });
      break;
    case 'timeout':
      paySet(ev.message || 'Czas płatności minął.', 100, { open: false, cancel: false });
      break;
    case 'save_canceled':
      paySet(ev.message || 'Nie wybrano pliku.', 100, { open: false, cancel: false });
      break;
    case 'error':
      paySet(ev.message || 'Wystąpił błąd płatności.', 100, { open: true, cancel: false });
      break;
  }
}

$('pdfBtn').onclick = async () => {
  const btn = $('pdfBtn');
  const d = new Date();
  const stamp = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  const safeObj = String(s.obj || 'wycena').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 55);
  const suggested = 'Wycena-' + (safeObj || 'projekt') + '-' + stamp + '.pdf';

  if (!api || !api.exportPdf) { window.print(); return; } // fallback dla przeglądarki
  const oldLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Oczekiwanie na płatność…';
  $('paySession').hidden = true;
  payShow(true);
  paySet('Przygotowywanie płatności…', 12, { cancel: true });
  try {
    const r = await api.exportPdf(suggested);
    if (r && r.ok) toast('PDF zapisany: ' + r.fileName, 'ok');
    else if (r && r.paidButCanceled) toast(r.message || 'Płatność została wykorzystana – spróbuj zapisać ponownie.', 'error');
    else if (r && r.canceled) { /* użytkownik anulował */ }
    else toast('Nie udało się zapisać PDF: ' + ((r && r.message) || 'nieznany błąd'), 'error');
  } catch (e) {
    toast('Nie udało się zapisać PDF: ' + e.message, 'error');
  } finally {
    payShow(false);
    btn.disabled = false;
    btn.textContent = oldLabel;
  }
};
$('unlockBtn').onclick = () => { if (!$('pdfBtn').disabled) $('pdfBtn').click(); };
$('payCancel').onclick = async () => {
  paySet('Anulowanie płatności…', 100, { cancel: false, open: false });
  if (api && api.cancelPayment) await api.cancelPayment();
};
$('payOpen').onclick = () => { if (api && api.openPaymentPage) api.openPaymentPage(); };
$('npDodaj').onclick = dodajWlasny;
$('npNazwa').addEventListener('keydown', e => { if (e.key === 'Enter') dodajWlasny(); });
$('npWartosc').addEventListener('keydown', e => { if (e.key === 'Enter') dodajWlasny(); });
$('paramReset').onclick = resetParametrow;
pokazWyniki();

/* ---------- 4. INTEGRACJA Z ELEKTRONEM (płatności i aktualizacje) ---------- */
function toast(msg, kind, action) {
  const t = $('toast');
  t.hidden = false;
  t.className = 'toast' + (kind === 'error' ? ' error' : '');
  t.innerHTML = esc(msg) + (action ? `<button type="button" id="toastAction">${esc(action.label)}</button>` : '');
  if (action) $('toastAction').onclick = () => { t.hidden = true; action.run(); };
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.hidden = true; }, 9000);
}
function renderUpdate(st) {
  if (!st) return;
  if (st.status === 'downloaded') toast(st.message, '', { label: 'Zainstaluj teraz', run: () => api.installUpdate() });
  else if (['available', 'error', 'up-to-date'].includes(st.status)) toast(st.message, st.status === 'error' ? 'error' : '');
}

const api = window.desktopAPI;
if (api) {
  document.body.classList.add('desktop');
  api.getAppInfo().then(info => {
    if (!info) return;
    const text = [info.name, 'Autor: ' + info.author, info.company, info.email, '© ' + info.year, 'wersja ' + info.version].filter(Boolean).join(' · ');
    const about = $('about'), printAbout = $('printAbout');
    if (about) about.textContent = text;
    if (printAbout) printAbout.textContent = text;
  }).catch(() => { });
  api.onPaymentChange(renderPayment);
  if (api.getPaymentState) api.getPaymentState().then(st => {
    if (!st) return;
    if (st.bypass) unlockResults();
    if (st.priceLabel) {
      $('payPrice').textContent = st.priceLabel;
      const unlock = $('unlockBtn');
      if (unlock) unlock.textContent = 'Pokaż wyniki i zapisz PDF · ' + st.priceLabel;
      const info = $('viewNavInfo');
      if (info) info.textContent = 'Raport PDF – ' + st.priceLabel;
      const btn = $('pdfBtn');
      if (btn) btn.textContent = 'Zapisz PDF · ' + st.priceLabel;
    }
  }).catch(() => { });
  api.onUpdateStatus(st => { if (st && st.status !== 'disabled') renderUpdate(st); });
  $('updateBtn').onclick = async () => {
    const st = await api.getUpdateStatus();
    if (st && st.status === 'disabled') { toast(st.message, 'error'); return; }
    const result = await api.checkUpdates();
    if (result) renderUpdate(result);
  };
}
