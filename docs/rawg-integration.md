# Integrazione RAWG

GameShelf usa RAWG come API esterna per aiutare gli admin a creare e modificare le schede del
catalogo. RAWG viene usato solo come fonte dati di supporto: il catalogo effettivo dell'app resta
salvato su Firebase Firestore.

## Perche RAWG

RAWG espone dati pubblici sui videogiochi tramite API HTTP/JSON. Per questo progetto viene usato
per recuperare metadati non personali, per esempio:

- titolo;
- anno di uscita;
- genere;
- piattaforme;
- sviluppatore;
- publisher;
- descrizione;
- immagine di copertina;
- link alla pagina RAWG del gioco.

Questa integrazione aiuta a rispettare il requisito del corso relativo alla comunicazione con una
API esterna.

## Configurazione della API key

La API key non e inclusa nel repository pubblico. Per la demo viene salvata su Firestore nel
documento `integrations/rawg`, campo `apiKey`, leggibile solo dagli utenti admin tramite Security
Rules. L'app la recupera automaticamente quando un admin usa l'import RAWG.

Per ottenere o rigenerare la key:

1. Aprire la documentazione RAWG: `https://rawg.io/apidocs`.
2. Richiedere una API key con il form "Get an API Key".
3. Usare come URL dell'app il link del repository pubblico o, dopo il deploy, l'URL Firebase Hosting.
4. Salvare la key nel campo `apiKey` del documento Firestore `integrations/rawg`.

Se una key era stata salvata nel vecchio documento pubblico `catalog/default`, la migrazione si puo
eseguire con:

```bash
npm run migrate:rawg-config
```

Il comando copia la key in `integrations/rawg` e rimuove il vecchio campo `rawgApiKey` dal catalogo
pubblico.

## Flusso di import

1. L'admin apre il form `Nuovo gioco` o `Modifica gioco`.
2. Cerca un titolo nel pannello `Import RAWG`.
3. L'app chiama la API esterna RAWG.
4. L'admin seleziona un risultato con `Importa`.
5. I dati RAWG compilano il form locale.
6. L'admin controlla e, se necessario, corregge i campi.
7. Solo premendo `Salva` i dati vengono registrati nel catalogo Firestore.

Questa scelta evita modifiche automatiche al catalogo e lascia all'utente admin un controllo finale
prima del salvataggio.

La ricerca mostra 12 risultati alla volta. Se RAWG segnala altri risultati disponibili, l'app mostra
il pulsante `Carica altri` per consultare la pagina successiva senza perdere i risultati gia
visualizzati.

## Sicurezza e limiti

In un'app solo frontend una API key letta dal browser non puo essere considerata davvero segreta,
anche se viene conservata su Firestore e resa leggibile solo agli admin. Per il progetto didattico e
sufficiente non versionarla nel repository e limitarne la lettura con le Security Rules. In un
progetto reale sarebbe preferibile spostare la chiamata RAWG dietro un backend o una Firebase
Function, cosi da non esporre la key al client.

## Attribuzione

Quando un gioco viene importato da RAWG, GameShelf conserva anche il link alla pagina RAWG come
fonte. Questo rende chiaro che i dati di partenza provengono da un servizio esterno e permette di
fornire un backlink alla fonte.
