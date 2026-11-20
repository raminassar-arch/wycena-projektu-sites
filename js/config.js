/* Konfiguracja wersji WWW kalkulatora 2.3.0.
 *
 * paymentApi – adres serwera płatności zgodnego z API v1 projektu
 *              (POST /api/payment/create, GET /api/payment/status/:id,
 *               POST /api/payment/consume). Domyślnie lokalny serwer mock.
 *              Adres można nadpisać parametrem URL: ?api=https://...
 * demo       – true włącza symulację płatności do prezentacji;
 *              parametr URL ?demo=1 ma wyższy priorytet.
 *
 * UWAGA: bez własnego serwera płatności wyniki pozostaną zablokowane.
 * Kwota jest sztywno ustawiona na serwerze (10 000 gr = 100,00 zł).
 */
window.KALKULATOR_CONFIG = {
  paymentApi: 'http://127.0.0.1:8787',
  paymentTimeoutMinutes: 20,
  priceLabel: '100,00 zł',
  priceGross: 10000,
  demo: false,
  app: {
    name: 'Kalkulator kosztów projektu architektonicznego',
    author: 'Rami Nassar',
    company: 'BIM architects & consultants',
    email: 'raminassar.arch@gmail.com',
    year: 2026,
    version: '2.3.0 · WWW'
  }
};
