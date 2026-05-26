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
| Offline e/o pagina offline di fallback | Coperto | `service-worker.js` con cache app shell e `offline.html` | Firebase e RAWG restano online-first perche dipendono da dati dinamici. |
| Notifiche, iOS escluso | Coperto | Notifica di test dal profilo tramite service worker | Da provare sul deploy HTTPS prima della consegna finale. |
| Codice su repository pubblico versionato | Da completare | Repository Git locale presente | Inserire nel README il link GitHub pubblico definitivo. |
| README con istruzioni e informazioni necessarie | Coperto | README con demo, requisiti, ruoli, setup, Firebase, RAWG, PWA, test e deploy | Da mantenere aggiornato prima della consegna. |
| Credenziali utente di test nel README | Coperto | README e `scripts/seed-demo-data.mjs` includono account demo standard e admin | Prima della consegna eseguire il seed admin sul progetto Firebase pubblico. |
| Consegna via mail con link repository | Da fare alla fine | Non riguarda il codice | Oggetto richiesto: `[SAW] Consegna progetto <DataAppello> <Nome> <Cognome> <Matricola>`. |

## Requisiti tecnici dimostrabili

| Area | Stato | Evidenza |
| --- | --- | --- |
| Routing client-side | Coperto | Rotte `catalogo`, `giochi/:id`, `profilo`, `myshelf`, `community`, `community/:userId`. |
| CRUD catalogo | Coperto | Admin puo creare, modificare ed eliminare giochi; utenti non admin bloccati. |
| Dati personali per utente | Coperto | MyShelf separata per utente; catalogo senza statistiche personali. |
| Community / profili pubblici | Coperto | Lista community, profili seguiti/scopri, shelf pubblica per utenti registrati. |
| Persistenza e fallback locale | Coperto | Servizi storage con Firestore e fallback locale quando Firebase non risponde. |
| Sicurezza Firestore | Coperto | Rules per catalogo, ruoli, profili, shelf, social e integrazione RAWG. |
| Responsivita | Quasi coperto | UI rivista su desktop e mobile | Fare un ultimo pass manuale prima della consegna. |
| Feedback utente | Coperto | Toast/notifiche per salvataggi, errori RAWG/Firebase, permessi e PWA. |
| Test automatici | Coperto | Test su auth guards, catalogo, community e RAWG | Ultima verifica: `npm test` passato con 17 test. |
| Build produzione | Coperto | `npm run build` passato | Rimane solo warning budget iniziale, non bloccante. |
| Lighthouse PWA | Coperto | Report documentato in `docs/pwa.md` | Ripetere dopo deploy finale allineato. |
| Firebase Hosting | Coperto, da riallineare | URL pubblico `https://saw2026melaccio.web.app` | Fare deploy finale dopo README e ultime rifiniture. |

## Cose da fare prima della consegna

- Verificare che README e documenti siano aggiornati all'ultima versione dell'app.
- Verificare che il deploy Firebase Hosting sia allineato all'ultima versione locale.
- Eseguire il seed demo admin se si vogliono garantire account demo completi nel database pubblico.
- Eseguire `npm test` e `npm run build` come verifica finale.
- Ripetere Lighthouse sull'URL pubblico dopo il deploy finale.
- Fare un ultimo controllo manuale responsive su desktop e mobile.
- Preparare la mail di consegna con oggetto e contenuto richiesti dalle slide.
