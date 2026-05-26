# Funzionalita PWA

GameShelf include una configurazione PWA completa per rendere l'app installabile e consultabile
anche quando la rete non e disponibile.

URL pubblico: `https://saw2026melaccio.web.app`.

## Elementi implementati

- manifest web in `public/manifest.webmanifest`;
- icone installabili in `public/icons`;
- service worker custom in `public/service-worker.js`;
- pagina offline in `public/offline.html`;
- registrazione del service worker tramite `PwaService`;
- pannello PWA nella pagina profilo con stato, installazione e notifica di test;
- header Firebase Hosting dedicati a service worker e manifest.

## Manifest

Il manifest definisce nome, descrizione, tema grafico, icone, modalita `standalone` e scorciatoie
rapide verso `Catalogo` e l'area personale `Profilo/MyShelf`. Il browser puo quindi proporre
l'installazione di GameShelf come app.

## Service worker

Il service worker precachea la shell minima dell'app:

- home e `index.html`;
- pagina offline;
- manifest;
- favicon;
- icone PWA.

Per le navigazioni usa una strategia network-first: prova a caricare la pagina dalla rete e, se la
connessione non e disponibile, usa la shell in cache o la pagina offline. Per gli asset statici usa
una strategia cache-first.

Le chiamate verso Firebase e RAWG restano online-first, perche contengono dati dinamici e dipendono
dalla sessione utente.

## Notifiche

Dal profilo e disponibile una notifica di test. Serve a dimostrare il supporto alle Web
Notifications e l'integrazione con il service worker. Il click sulla notifica riporta l'utente al
catalogo.

## Test manuale

1. Avviare l'app con `npm run start`.
2. Aprire `http://localhost:4200/profilo`.
3. Verificare il pannello PWA.
4. Usare `Notifica test` e concedere il permesso al browser.
5. Eseguire una build con `npm run build`.
6. Dopo il deploy su Firebase Hosting, aprire DevTools, sezione Application, e verificare manifest,
   service worker e cache.

## Deploy verificato

Il deploy su Firebase Hosting pubblica la cartella `dist/SAW2026_Melaccio/browser`. Sono stati
verificati su HTTPS:

- home dell'app;
- rotta `/catalogo`;
- rotta `/profilo`;
- `manifest.webmanifest`;
- `service-worker.js`;
- `offline.html`.

Il service worker viene servito con `Cache-Control: no-cache`, cosi il browser puo rilevare
rapidamente gli aggiornamenti della PWA dopo un nuovo deploy.

## Audit Lighthouse

Audit eseguito da CLI con Lighthouse `11.7.1` sull'URL pubblico
`https://saw2026melaccio.web.app`.

Risultato categoria PWA: `100/100`.

Controlli automatici superati:

- manifest e service worker soddisfano i requisiti di installabilita;
- splash screen configurato;
- theme color impostato;
- contenuto correttamente dimensionato per il viewport;
- meta viewport presente;
- icona maskable presente.

Lighthouse segnala anche tre controlli manuali non conteggiati nel punteggio: compatibilita
cross-browser, transizioni tra pagine e presenza di URL dedicati per ogni pagina.
