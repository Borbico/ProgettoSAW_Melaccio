# Checklist requisiti progetto

Fonte principale: slide `SAW26_01_-_Introduzione.pdf`, pagine 7-9 e 38.

## Requisiti ufficiali

| Requisito | Stato | Evidenza nel progetto | Note |
| --- | --- | --- | --- |
| Oggetto del progetto concordato con il docente | Coperto | Idea GameShelf approvata via mail dal professore | Conservare la mail di approvazione; non serve versionarla nel repository. |
| Front-end scritto con un framework a scelta | Coperto | Angular 21, routing lazy, componenti standalone, servizi e signals | Da descrivere meglio nel README. |
| Autenticazione utenti | Coperto | Firebase Authentication con login, registrazione e logout | Gli ospiti vedono solo catalogo e form profilo. |
| Gestione autorizzazioni / ruoli | Coperto | Ruoli guest, standard e admin; `AccessControl`; `firestore.rules` | L'admin gestisce il catalogo, gli utenti standard gestiscono la propria shelf. |
| Comunicazione con API esterna | Coperto | Integrazione RAWG via HTTP/JSON per cercare e importare giochi | Documentata in `docs/rawg-integration.md`. |
| Uso di Firestore | Coperto | Catalogo, shelf personali, profili pubblici, ruoli e configurazione RAWG | Le regole limitano letture e scritture in base al ruolo. |
| Web app installabile come PWA | Coperto | `manifest.webmanifest`, icone, `PwaService`, install prompt | Documentata in `docs/pwa.md`. |
| Offline e/o pagina offline di fallback | Coperto | Service worker con app shell cache, `offline.html`, disattivazione controlli UI offline e coda locale con sincronizzazione automatica al rientro online |
| Notifiche, iOS escluso | Coperto | Notifiche di test dal profilo e notifiche di sistema native in tempo reale per follow e completamenti gioco | Funzionalita disponibile sul deploy HTTPS e gestita tramite `SocialNotificationService` |
| Codice su repository pubblico versionato | Coperto | Repository GitHub pubblico: `https://github.com/Borbico/ProgettoSAW_Melaccio` | Ultimo commit locale allineato a `origin/master`. |
| README con istruzioni e informazioni necessarie | Coperto | README con demo, requisiti, ruoli, setup, Firebase, RAWG, PWA, test e deploy | Da mantenere aggiornato prima della consegna. |
| Credenziali utente di test nel README | Coperto | README e `scripts/seed-demo-data.mjs` includono account demo standard e admin | Seed admin gia eseguito su Firebase: account demo, profili, ruoli e catalogo sincronizzati. |
| Consegna via mail con link repository | Da fare alla fine | Non riguarda il codice | Oggetto richiesto: `[SAW] Consegna progetto <DataAppello> <Nome> <Cognome> <Matricola>`. |

## Requisiti tecnici dimostrabili

| Area | Stato | Evidenza |
| --- | --- | --- |
| Routing client-side | Coperto | Rotte `catalogo`, `giochi/:id`, `profilo`, `myshelf`, `community`, `community/:userId`. |
| CRUD catalogo | Coperto | Admin puo creare, modificare ed eliminare giochi; utenti non admin bloccati. |
| Dati personali per utente | Coperto | MyShelf separata per utente; catalogo senza statistiche personali. |
| Community / profili pubblici | Coperto | Lista community, profili seguiti/scopri, shelf pubblica per utenti registrati. |
| Persistenza e fallback locale | Coperto | Servizi storage con Firestore e fallback locale quando Firebase non risponde. |
| Sicurezza Firestore | Coperto | Rules per catalogo, ruoli, profili, shelf, social, notifiche e activities. |
| Responsivita | Quasi coperto | UI rivista su desktop e mobile | Fare un ultimo pass manuale prima della consegna. |
| Feedback utente | Coperto | Toast/notifiche di sistema native per salvataggi, errori RAWG/Firebase, permessi e PWA. |
| Test automatici | Coperto | Test su auth guards, catalogo, community, RAWG e notifiche social | Ultima verifica: `npm test` passato con 27 test. |
| Build produzione | Coperto | `npm run build` passato | Rimane solo warning budget iniziale, non bloccante. |
| Lighthouse PWA | Coperto | Report documentato in `docs/pwa.md` e in `reports/lighthouse.html` | Ottimo punteggio finale su Accessibilita (95), Best Practices (100) e SEO (91). |
| Firebase Hosting | Coperto | URL pubblico `https://saw2026melaccio.web.app` | Deploy finale completato e URL verificato online. |

## Cose da fare prima della consegna

- Valutare se chiudere o discutere con il professore l'alert GitHub sulla Firebase Web API key.
- Ripetere Lighthouse sull'URL pubblico se si vuole allegare o citare un risultato aggiornato.
- Fare un ultimo controllo manuale responsive su desktop e mobile prima dell'invio.
- Preparare la mail di consegna con oggetto e contenuto richiesti dalle slide.
