# SAW2026Melaccio

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.11.

## Demo

Applicazione pubblicata su Firebase Hosting:
[`https://saw2026melaccio.web.app`](https://saw2026melaccio.web.app).

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## RAWG import

Gli utenti admin possono usare l'integrazione RAWG dal form di creazione/modifica del catalogo.
La API key RAWG non viene versionata nel repository: per la demo e configurata su Firestore e viene
recuperata automaticamente dall'app. Dopo la ricerca, i dati importati compilano la scheda del gioco,
ma il catalogo viene aggiornato solo premendo il pulsante `Salva`.

La documentazione di supporto per configurazione, uso e motivazioni dell'integrazione si trova in
[`docs/rawg-integration.md`](docs/rawg-integration.md).

## PWA

GameShelf include manifest, icone, service worker, fallback offline e una notifica di test dal
profilo utente. La documentazione dei dettagli PWA si trova in [`docs/pwa.md`](docs/pwa.md).

## Deploy

Per pubblicare l'app su Firebase Hosting:

```bash
npm run build
firebase deploy --only hosting
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
