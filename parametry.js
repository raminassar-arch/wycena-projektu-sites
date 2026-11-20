/* =====================================================================
   PARAMETRY – tutaj zmieniasz stawki, współczynniki i opłaty.
   Wszystkie kwoty w zł (netto, chyba że napisano inaczej).
   Po zmianie zapisz plik i uruchom aplikację ponownie (lub odśwież stronę).
   Wartości oznaczone [Ź] pochodzą z publikacji (sprawdź aktualność),
   [S] to szacunki modelu do zweryfikowania w ofercie lub urzędzie.
   ===================================================================== */
const PARAMETRY = {

  /* --- Podstawa wyceny projektu (etapy E1-E9) --- */
  stawkaBazowa: 200,            // zł / m² powierzchni użytkowej [S] (widełki rynkowe 150-300)

  /* --- Rodzaje obiektów: [współczynnik cenowy, minimalne wynagrodzenie, wymaga ppoż (1/0),
       wymaga sanepidu (1/0), współczynnik czasu realizacji] --- */
  obiekty: {
    'Dom jednorodzinny wolnostojący':   [1.00,  8000, 0, 0, 1.00],
    'Dom bliźniaczy / szeregowy':       [0.95,  8000, 0, 0, 1.10],
    'Budynek mieszkalny wielorodzinny': [0.75, 25000, 1, 0, 1.35],
    'Budynek usługowo-biurowy':         [0.85, 15000, 1, 0, 1.30],
    'Budynek handlowy / usługowy':      [0.80, 12000, 1, 1, 1.35],
    'Budynek użyteczności publicznej':  [1.30, 30000, 1, 1, 1.50],
    'Budynek produkcyjno-magazynowy':   [0.50, 15000, 1, 0, 0.85],
    'Garaż / budynek gospodarczy':      [0.80,  3000, 0, 0, 0.70],
  },

  /* --- Skala powierzchni: [od ilu m², współczynnik]. Większy obiekt = niższa stawka za m². --- */
  skala: [[0, 1.15], [100, 1.00], [200, 0.92], [400, 0.85], [800, 0.78], [1500, 0.70]],

  lokalizacja: { 'Warszawa': 1.20, 'Miasto >200 tys.': 1.10, 'Miasto 50–200 tys.': 1.00, 'Miasto <50 tys.': 0.92, 'Wieś / mała gmina': 0.88 },
  skomplikowanie: { 'Prosty': 0.85, 'Standardowy': 1.00, 'Złożony': 1.25, 'Bardzo złożony': 1.50 },
  instalacje: { 'Podstawowy': 0.85, 'Standardowy': 1.00, 'Rozszerzony (PC, rekuperacja, PV)': 1.30 },
  charakterPrac: { 'Nowa budowa': 1.00, 'Rozbudowa': 1.10, 'Przebudowa / nadbudowa': 1.15 },
  tryb: { 'Pozwolenie na budowę': 1.00, 'Zgłoszenie z projektem budowlanym': 1.00, 'Zgłoszenie bez projektu (dom do 70 m²)': 0.40 },

  /* --- Kategoria geotechniczna: [czynnik projektu konstrukcji, koszt dokumentacji geotechnicznej] --- */
  geotechnika: { 1: [0.95, 1500], 2: [1.00, 3500], 3: [1.25, 9000] },

  /* --- Udziały etapów w projekcie podstawowym (suma = 1,00) --- */
  etapy: [
    ['E1', 'Analiza działki, wizja lokalna',        0.03],
    ['E2', 'Koncepcja architektoniczna',             0.15],
    ['E3', 'Projekt zagospodarowania działki',       0.07],
    ['E4', 'Projekt architektoniczno-budowlany',     0.35],
    ['E5', 'Projekt konstrukcyjny',                  0.12],
    ['E6', 'Instalacje sanitarne',                   0.10],
    ['E7', 'Instalacje elektryczne',                 0.08],
    ['E8', 'Charakterystyka energetyczna i opracowania', 0.05],
    ['E9', 'Kompletowanie, uzgodnienia, wniosek',    0.05],
  ],

  /* --- Dopłaty do etapów --- */
  doplaty: {
    podpiwniczenieArchitektura: 0.05,   // +5% do E4
    podpiwniczenieKonstrukcja:  0.15,   // +15% do E5
    naKondygnacjePonad2:        0.05,   // +5% do E5 za każdą kondygnację powyżej 2
    zabytek:                    0.15,   // +15% do E4 i E9 (strefa ochrony konserwatorskiej)
    programowaniePFU:           0.03,   // +3% bazy za program funkcjonalno-użytkowy (PFU), gdy projekt NIE jest w BIM
  },

  /* --- Projekty branżowe dodatkowe (poza bazą E1–E9, więc nie podwajają E5–E7).
       [klucz pola, nazwa branży, stawka zł/m² powierzchni użytkowej] [S] --- */
  branze: [
    ['teletech', 'Instalacje teletechniczne (ICT, alarmy, CCTV)', 12],
    ['hvac', 'Wentylacja i klimatyzacja (HVAC)', 18],
    ['gaz', 'Instalacja gazowa', 8],
    ['ppoz', 'Systemy przeciwpożarowe (PPOŻ)', 11],
    ['bms', 'Automatyka budynkowa (BMS)', 9],
    ['oze', 'Fotowoltaika i OZE', 12],
    ['ziel', 'Projekt zieleni i zagospodarowania', 6],
    ['wnetrza', 'Projekt wnętrz', 25],
  ],

  /* --- Zakresy opracowania (rodzaje projektu) jako osobne opcje ---
     Kazdy zakres to niezalezny pakiet wyceny, ktory mozna wlaczyc obok bazy E1-E9.
     udzial – czesc bazy projektu; stawkaM2 – stawka zl/m2 powierzchni uzytkowej
     (gdy podana, ma pierwszenstwo przed udzialem). [S] szacunki do weryfikacji. */
  zakresy: [
    ['zpKoncepcyjny',   'Projekt koncepcyjny (K)',             0.25, 0],
    ['zpWykonawczy',    'Projekt wykonawczy (W)',              0.40, 0],
    ['zpWielobranzowy', 'Projekt wielobranżowy (WB)',          0.35, 0],
    ['zpWnetrza',       'Projekt wnętrz',                      0,   25],
    ['zpInstalacyjny',  'Projekt instalacyjny (osobno)',       0.18, 0],
    ['zpKonstrukcyjny', 'Projekt konstrukcyjny (osobno)',      0.12, 0],
  ],

  /* --- Koszty drukowania dokumentacji projektowej [S] --- */
  druk: {
    cenaA4: 0.7,              // zł za arkusz A4
    cenaA3: 1.4,              // zł za arkusz A3
    cenaA1: 12,               // zł za arkusz A1 (plot)
    oprawa: 22,               // zł za oprawę / bindowanie kompletu
  },

  /* --- Szacowany czas realizacji inwestycji [S] ---
       Czasy bazowe w dniach. Etapy projektowe w dniach roboczych,
       czynności urzędowe i budowa w dniach kalendarzowych.
       Wynik to szacunek – część czynności może biec równolegle. */
  czas: {
    etapy: { E1: 5, E2: 15, E3: 10, E4: 40, E5: 20, E6: 15, E7: 15, E8: 8, E9: 15 },
    przygotowanie: { wypisMpzp: 7, WZ: 60, mapa: 14, geotech: 21, przylacza: 30, grunt: 7 },
    uzgodnienia: { zud: 30, zjazd: 30, ppoz: 21, sanepid: 21, konserwator: 30, wodnoprawne: 60, pozwolenie: 60, zgloszenie: 21 },
    realizacja: { tyczenie: 2, protokoly: 10, inwentaryzacja: 7, zawiadomienie: 7,
                  budowaMin: 90,        // dni dla budynku referencyjnego 150 m²
                  budowaRefM2: 150,     // powierzchnia referencyjna
                  budowaWykladnik: 0.40 // nasycenie: duże obiekty rosną wolniej niż liniowo
                },
    branżaDni: 10,             // dodatkowy czas opracowania branżowego [dni robocze]
    zakresyDni: {              // dodatkowy czas dla wybranych zakresów opracowania [dni robocze]
      zpKoncepcyjny: 12, zpWykonawczy: 20, zpWielobranzowy: 18,
      zpWnetrza: 15, zpInstalacyjny: 12, zpKonstrukcyjny: 10,
    },
    wspSkomplikowanie: { 'Prosty': 0.85, 'Standardowy': 1.00, 'Złożony': 1.25, 'Bardzo złożony': 1.50 },
    wspLokalizacja: { 'Warszawa': 1.15, 'Miasto >200 tys.': 1.10, 'Miasto 50–200 tys.': 1.00, 'Miasto <50 tys.': 0.95, 'Wieś / mała gmina': 0.90 },
    wspBim: 0.90,              // BIM skraca czas projektowania o 10%
    wspGotowy: 0.30,           // adaptacja projektu gotowego vs. projekt indywidualny
    skala: 0.15,               // wpływ powierzchni: 1 + skala·(√(pu/100)−1)
  },

  /* --- Zespół projektowy (1.6.0) ---
     Udziały ról w fazach sumują się do 1. Służą do wyznaczenia zdolności
     przerobowej fazy (jak szybko rośnie obsada) oraz do rozłożenia kosztów.
     Stawka to orientacyjny koszt jednej osoby na miesiąc [zł/etat·mies.]. */
  zespol: {
    role: [
      { k: 'kier',  n: 'Kierownik projektu',   stawka: 12000, dom: 1, fazy: { przyg: 0.20, projekt: 0.10, uzgod: 0.50, realiz: 0.30 } },
      { k: 'arch',  n: 'Architekt projektowy', stawka: 10000, dom: 1, fazy: { przyg: 0.40, projekt: 0.40, uzgod: 0.30, realiz: 0.10 } },
      { k: 'proj',  n: 'Projektant / konstruktor', stawka: 9000, dom: 1, fazy: { przyg: 0.00, projekt: 0.30, uzgod: 0.00, realiz: 0.00 } },
      { k: 'bim',   n: 'Modelarz BIM',         stawka: 8500,  dom: 1, fazy: { przyg: 0.00, projekt: 0.20, uzgod: 0.00, realiz: 0.00 } },
      { k: 'asyst', n: 'Asystent / stażysta',  stawka: 5000,  dom: 0, fazy: { przyg: 0.40, projekt: 0.00, uzgod: 0.20, realiz: 0.00 } },
      { k: 'ekipa', n: 'Ekipa budowlana',      stawka: 14000, dom: 2, fazy: { przyg: 0.00, projekt: 0.00, uzgod: 0.00, realiz: 0.60 } },
    ],
    /* exp – wykładnik zwrotów malejących (Brooks); min – część czasu,
       której nie da się skrócić więcej osobami (np. terminy urzędowe). */
    fazy: {
      przyg:   { exp: 0.60, min: 0.35, max: 2.0 },
      projekt: { exp: 0.85, min: 0.20, max: 3.0 },
      uzgod:   { exp: 0.25, min: 0.85, max: 1.3 },
      realiz:  { exp: 0.70, min: 0.50, max: 2.0 },
    },
    /* Orientacyjne zaangażowanie roli w całym okresie inwestycji. */
    zaangazowanie: { kier: 0.35, arch: 0.80, proj: 0.70, bim: 0.60, asyst: 0.50, ekipa: 0.90 },
  },

  /* --- Usługi dodatkowe --- */
  wykonawczyUdzial: 0.40,     // projekt wykonawczy = 40% sumy E4-E8
  kosztorysZaM2: 8,           // kosztorys inwestorski, zł/m²
  wizytaNadzoru: 500,         // nadzór autorski, zł za wizytę
  inwentaryzacjaZaM2: 19,     // [Ź] cenauslug.pl (dotyczy wnętrz), zł/m²
  adaptacjaProjektuGotowego: 4500, // [Ź] widełki 2 500-7 000

  /* --- BIM (wszystkie stawki to szacunki [S]) --- */
  bim: {
    lod: { 'LOD 200': 0.08, 'LOD 300': 0.15, 'LOD 350': 0.22, 'LOD 400': 0.30 }, // % bazy modelowania
    koordynacjaUdzial: 0.06,  // koordynacja międzybranżowa, % bazy modelowania
    konfiguracja: 1500,       // szablony, struktura modelu
    eirBep: 2500,             // wymagania BIM (EIR) i Plan BIM (BEP)
    ifc: 600,                 // eksport IFC
    cobieZaM2: 8,             // dane COBie
    ilosciZaM2: 4,            // zestawienia ilości z modelu (5D)
    wizualizacja: 350,        // za ujęcie
    cdeZaMiesiac: 150,        // wspólne środowisko danych
  },

  /* --- Formalności i opłaty (kwoty końcowe) --- */
  formalnosci: {
    wypisMpzp: 50,
    decyzjaWZ: 598,                  // [Ź]
    mapaProjektowa: 2000,
    odpisKsiegiWieczystej: 20,
    zud: 300,
    zjazd: 82,
    rzeczoznawcaPpoz: 3000,
    sanepid: 300,
    konserwator: 82,
    wodnoprawne: 616,
    oplataSkarbowaZaM2: 1,           // [Ź] pozwolenie na budowę: 1 zł/m² pu...
    oplataSkarbowaMax: 539,          // [Ź] ...maksymalnie 539 zł (część źródeł podaje 47 zł – sprawdź w urzędzie)
    pelnomocnictwo: 17,              // [Ź]
    zaswiadczenieBrakSprzeciwu: 17,  // [Ź]
    dziennikBudowy: 30,
    kierownikProcent: 0.015,         // % kosztu budowy
    kierownikMinimum: 5000,
    inspektorProcent: 0.02,          // % kosztu budowy
    tyczenie: 1200,
    protokolyOdbiorowe: 1500,
    inwentaryzacjaPowykonawcza: 2000,
    zawiadomienieZakonczenie: 17,
  },
};
