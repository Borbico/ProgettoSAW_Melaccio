# GameShelf

Progetto di esame per il corso di Sviluppo Applicazioni Web 2026.

GameShelf è una web app per esplorare un catalogo di videogiochi, salvare i propri giochi in una
shelf personale e confrontare i progressi con altri utenti registrati. Il progetto è sviluppato con
Angular e Firebase, integra l'API esterna RAWG e include funzionalità PWA.

- Demo Firebase Hosting: [https://saw2026melaccio.web.app](https://saw2026melaccio.web.app)
- Repository pubblico: [https://github.com/Borbico/ProgettoSAW_Melaccio](https://github.com/Borbico/ProgettoSAW_Melaccio)

## Funzionalità principali

- Catalogo pubblico con ricerca, filtri, schede gioco e pagina di dettaglio.
- MyShelf personale per utenti registrati, con stato, valutazione, ore giocate, progresso, note e
  obiettivi personali.
- Dati personali separati dal catalogo: il catalogo contiene solo informazioni generali del gioco,
  mentre le statistiche sono salvate per singolo utente.
- Ruoli applicativi: ospite, utente standard e admin.
- CRUD del catalogo riservato agli admin.
- Import da RAWG per compilare le schede gioco partendo da una API esterna HTTP/JSON.
- Community con profili pubblici, utenti seguiti e visualizzazione delle shelf altrui.
- Feedback utente per salvataggi, errori Firebase/RAWG, permessi e azioni PWA.
- PWA installabile con manifest, icone, service worker, fallback offline e notifica di test.

## Requisiti del corso

| Requisito | Stato nel progetto |
| --- | --- |
| Front-end con framework | Angular 21 |
| Autenticazione utenti | Firebase Authentication con email e password |
| Comunicazione con API esterna | RAWG API per ricerca e import giochi |
| Persistenza dati | Firebase Firestore |
| PWA installabile | Manifest, icone, install prompt e Firebase Hosting HTTPS |
| Offline/fallback | Service worker con app shell cache e `offline.html` |
| Notifiche | Notifica di test dal profilo utente |
| Repository pubblico | GitHub |
| README con istruzioni | Questo file e documenti in `docs/` |

La checklist completa dei requisiti si trova in
[`docs/requisiti-progetto.md`](docs/requisiti-progetto.md).

## Ruoli

| Ruolo | Permessi |
| --- | --- |
| Ospite | Vede il catalogo e la pagina profilo con login/registrazione. Non vede MyShelf o Community. |
| Utente standard | Gestisce la propria MyShelf, vede Community e shelf pubbliche degli altri utenti. |
| Admin | Ha gli stessi permessi dell'utente standard e può creare, modificare o eliminare giochi dal catalogo. |

Il ruolo admin viene letto da Firestore nel documento `userRoles/{uid}` con campo `role: "admin"`.

## Credenziali demo

Password comune per gli account demo:

```text
GameShelfDemo2026!
```

| Email | Nome | Ruolo previsto |
| --- | --- | --- |
| `admin@gameshelf.demo` | Admin GameShelf | admin |
| `marta.platform@gameshelf.demo` | Marta Platform | standard |
| `luca.rpg@gameshelf.demo` | Luca RPG | standard |
| `giulia.coop@gameshelf.demo` | Giulia Coop | standard |

Gli account demo sono generati dallo script `npm run seed:demo`. Per creare anche ruoli, profili
pubblici e catalogo demo su Firestore occorre eseguire lo script con privilegi admin:

```bash
npm run seed:demo -- --admin
```

## Stack tecnico

- Angular 21
- Angular Router, Forms e Signals
- Firebase Authentication
- Firebase Firestore
- Firebase Hosting
- RAWG Video Games Database API
- Service worker custom per PWA
- Vitest per i test

## Avvio locale

Installare le dipendenze:

```bash
npm install
```

Avviare il server di sviluppo:

```bash
npm run start
```

Aprire:

```text
http://localhost:4200
```

In locale il service worker viene disattivato volontariamente per evitare cache stale durante lo
sviluppo. Le funzionalità PWA vanno provate sul deploy HTTPS.

## Firebase

Il progetto Firebase usato per la demo e `saw2026melaccio`.

Prodotti Firebase utilizzati:

- Authentication, con provider email/password;
- Firestore, per catalogo, shelf, profili, ruoli, social e configurazione RAWG;
- Hosting, per pubblicare la build Angular.

Le regole Firestore sono in `firestore.rules` e possono essere pubblicate con:

```bash
npm run deploy:rules
```

Per rendere admin un utente registrato:

1. registrare o far accedere l'utente;
2. copiare il suo UID dalla pagina profilo;
3. creare in Firestore il documento `userRoles/{uid}`;
4. impostare il campo `role` a `admin`.

## RAWG

L'integrazione RAWG è disponibile nel form admin di creazione/modifica gioco. L'admin può cercare un
gioco, importare i dati nel form, controllarli e salvare manualmente nel catalogo.

La API key RAWG non è versionata nel repository. Per la demo viene letta da Firestore nel documento
`integrations/rawg`, campo `apiKey`, accessibile solo agli admin tramite Security Rules.

Documentazione completa:
[`docs/rawg-integration.md`](docs/rawg-integration.md).

## PWA

GameShelf include:

- `public/manifest.webmanifest`;
- icone installabili e maskable;
- `public/service-worker.js`;
- `public/offline.html`;
- pannello PWA nella pagina profilo;
- notifica di test.

Documentazione completa:
[`docs/pwa.md`](docs/pwa.md).

## Test e build

Eseguire i test:

```bash
npm run test
```

Eseguire la build di produzione:

```bash
npm run build
```

## Deploy

Deploy solo hosting:

```bash
npm run deploy:hosting
```

Deploy completo, inclusi hosting e regole Firestore:

```bash
npm run deploy
```

Firebase Hosting pubblica la cartella:

```text
dist/SAW2026_Melaccio/browser
```

## Struttura del progetto

```text
src/app/pages        Pagine principali dell'app
src/app/services     Auth, catalogo, storage, RAWG, community e PWA
src/app/models       Tipi e modelli dati
src/app/utils        Helper condivisi
src/app/data         Catalogo iniziale/mock
public               Manifest, service worker, offline page e icone
docs                 Documentazione di supporto
scripts              Seed demo e migrazioni Firebase
```

## Documentazione

- [`docs/requisiti-progetto.md`](docs/requisiti-progetto.md): checklist requisiti del corso.
- [`docs/rawg-integration.md`](docs/rawg-integration.md): configurazione e uso della API RAWG.
- [`docs/pwa.md`](docs/pwa.md): dettagli PWA, deploy e Lighthouse.
