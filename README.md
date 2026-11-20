# Kalkulator kosztów projektu 1.7.0 – wersja WWW (statyczna)

Statyczna wersja kalkulatora: **same pliki HTML, CSS i JavaScript**, bez Electrona
i bez Pythona po stronie użytkownika. Działa na dowolnym hostingu statycznym
(GitHub Pages, Netlify, Cloudflare Pages) oraz jako osadzenie w Google Sites.

Silnik wyceny jest **identyczny z wersją desktopową 1.7.0** – pliki `parametry.js`,
`app.js` i `widoki.js` są kopiowane bez zmian z katalogu głównego projektu. Różni
się tylko warstwa hostingu: `js/payment-web.js` udostępnia ten sam interfejs co
`window.desktopAPI`, a PDF powstaje w oknie druku przeglądarki.

Wersja desktopowa (`dist\Wycena projektu Setup 1.7.0.exe`) pozostaje nietknięta.

## Adresy publikacji

| Co | Adres |
| --- | --- |
| Aplikacja | https://raminassar-arch.github.io/wycena-projektu-sites/ |
| Pomocnik osadzania | https://raminassar-arch.github.io/wycena-projektu-sites/embed.html |
| Repozytorium | https://github.com/raminassar-arch/wycena-projektu-sites |

Hosting: GitHub Pages, gałąź `main`, katalog główny (`/`). Plik `.nojekyll`
zapobiega przetwarzaniu przez Jekyll.

---

## Co jest w środku

| Warstwa | Plik | Rola |
| --- | --- | --- |
| Dane | `parametry.js` | stawki E1–E9, Z1–Z6, branze, czas, zespół – bez zmian |
| Silnik | `app.js` | `oblicz()`, `obliczCzas()`, `obliczPlatnosci()`, `obliczKosztyZespolu()` – bez zmian |
| Kreator | `widoki.js` | 10 kroków Q&A, przełączanie widoków – bez zmian |
| Wygląd kalkulatora | `styles.css`, `wizard.css` | identyczny jak w desktopie, wraz z blokadą wyników i regułami druku |
| Styl WWW | `site.css` | paleta PAB sites: ciemna zieleń + złoto, karty, topbar, stopka |
| Most płatności | `js/payment-web.js` | odpowiednik Electron API: płatność, anulowanie, PDF przez druk |
| Konfiguracja | `js/config.js` | adres API, cena, tryb demo, dane autora |
| Osadzanie | `embed.html` | generator kodu iframe dla Google Sites |

Zakresy Z1–Z6 są sześcioma niezależnymi pakietami dodatkowymi. Baza E1–E9
zawiera już standardową koncepcję, konstrukcję i instalacje – w kalkulatorze
jest ostrzeżenie przed podwójnym zamówieniem.

---

## Co działa bez serwera

Kalkulator i kreator działają w całości w przeglądarce:

* 10 kroków kreatora z przeliczeniem na żywo,
* edycja parametrów i własne pozycje kosztów (zapis w `localStorage`),
* koszty etapów, formalności, opłaty, wydruk, zakresy Z1–Z6, branze,
* czas realizacji (Kanban), obsada zespołu, harmonogram płatności.

**Szczegółowe wyniki w widoku „Kalkulator” oraz PDF są zablokowane do opłaty.**
Blokada nie dotyczy formularza, panelu parametrów ani szacunku w kreatorze.

---

## Płatności

Strona statyczna nie przyjmuje przelewów sama. `js/payment-web.js` rozmawia
z serwerem zgodnym z API v1 projektu (`server\payment-server.js`):

| Metoda | Endpoint |
| --- | --- |
| `POST` | `/api/payment/create` |
| `GET` | `/api/payment/status/:sessionId` |
| `POST` | `/api/payment/consume` |

Cena `10000` groszy (100,00 zł) jest ustawiona **wyłącznie na serwerze**.
Jedna opłacona sesja = jeden raport PDF (`consume` blokuje ponowne użycie).

Domyślny adres to `http://127.0.0.1:8787`. Zmień go w `js/config.js` lub
parametrem adresu:

```
https://raminassar-arch.github.io/wycena-projektu-sites/?api=https://twoj-serwer.example
```

Serwer musi zwracać nagłówki CORS (`Access-Control-Allow-Origin: *`),
tak jak wersja z katalogu `server\`. Bez działającego API wyniki pozostaną
zablokowane – to celowe.

### Tryb demonstracyjny

Do prezentacji służy parametr `?demo=1`. Symuluje przebieg płatności,
odblokowuje wyniki i wyraźnie oznacza raport jako demonstracyjny; nie pobiera
żadnych pieniędzy. Nie używaj go jako mechanizmu produkcyjnego odblokowania.

---

## Publikacja na GitHub Pages

Repozytorium `wycena-projektu-sites` jest już publiczne i puste przed pierwszym
pushami. Polecenia z katalogu `Kalkulator-projektu-sites\`:

```powershell
git add .
git commit -m "Kalkulator projektu 1.7.0 WWW"
git push -u origin main
```

Następnie w repozytorium: **Settings → Pages → Build and deployment →
Source: Deploy from a branch → Branch: `main`, folder: `/ (root)` → Save**.
Adres publikacji: `https://raminassar-arch.github.io/wycena-projektu-sites/`.

Po każdej zmianie plików podnieś numer wersji w zapytaniach `?v=1.7.0`
w `index.html`, aby przeglądarki nie trzymały starych plików z pamięci
podręcznej.

---

## Osadzenie w Google Sites

Otwórz `https://raminassar-arch.github.io/wycena-projektu-sites/embed.html`,
skopiuj wygenerowany kod i w Google Sites wybierz
**Wstaw → Osadź → Kod osadzania**. Rozciągnij blok na całą szerokość i ustaw
wysokość około 900–1100 px (Google Sites nie zmienia wysokości ramki
automatycznie).

Gotowy kod:

```html
<iframe src="https://raminassar-arch.github.io/wycena-projektu-sites/"
        title="Kalkulator kosztów projektu architektonicznego"
        style="width:100%;height:1000px;border:0;display:block"
        allow="clipboard-write"></iframe>
```

Wersja demonstracyjna do osadzenia:

```html
<iframe src="https://raminassar-arch.github.io/wycena-projektu-sites/?demo=1"
        title="Kalkulator kosztów projektu architektonicznego – wersja demonstracyjna"
        style="width:100%;height:1000px;border:0;display:block"
        allow="clipboard-write"></iframe>
```

### Ograniczenia ramki

* Dane formularza i parametry zapisują się w `localStorage`. Safari i tryb
  prywatny mogą blokować pamięć dla stron osadzonych w obcej domenie.
* Okno druku PDF otwiera się wewnątrz ramki – w części przeglądarek wygodniej
  jest otworzyć kalkulator w nowej karcie.
* Zalecenie: w Google Sites umieść odnośnik „Otwórz kalkulator” oraz ramkę
  jako podgląd. Pełna, zapisywalna wersja to samodzielna karta przeglądarki.

---

## Autor

Rami Nassar · BIM architects & consultants · raminassar.arch@gmail.com · © 2026
