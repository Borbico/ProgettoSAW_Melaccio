import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { deleteApp, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getFirestore, setDoc } from 'firebase/firestore';
import ts from 'typescript';

const require = createRequire(import.meta.url);

const firebaseConfig = {
  apiKey: 'AIzaSyCITPQ-q5h1YiEYFErAz1ZG6egw8wlUyfQ',
  authDomain: 'saw2026melaccio.firebaseapp.com',
  projectId: 'saw2026melaccio',
  storageBucket: 'saw2026melaccio.firebasestorage.app',
  messagingSenderId: '289950510856',
  appId: '1:289950510856:web:3269f2b69228708a6b06bd',
};

const demoPassword = 'GameShelfDemo2026!';
const demoUsers = [
  {
    email: 'admin@gameshelf.demo',
    displayName: 'Admin GameShelf',
    role: 'admin',
    entries: {
      hades: entry(
        'In corso',
        4,
        31,
        62,
        'Account demo admin per verificare CRUD catalogo e import RAWG.',
        'Provare modifica catalogo e salvataggio controllato.',
      ),
      'outer-wilds': entry(
        'Completato',
        5,
        22,
        100,
        'Ottimo esempio di gioco esplorativo e narrativo.',
        'Conservarlo tra i preferiti della shelf demo.',
      ),
      'stardew-valley': entry(
        'In corso',
        4,
        44,
        55,
        'Sessioni brevi, utile per mostrare progressi personali.',
        'Aggiornare ore e obiettivo dalla MyShelf.',
      ),
    },
  },
  {
    email: 'marta.platform@gameshelf.demo',
    displayName: 'Marta Platform',
    role: 'standard',
    entries: {
      'hollow-knight': entry(
        'Completato',
        5,
        58,
        100,
        'Tutto completato tranne poche sfide extra.',
        'Provare una run senza guida.',
      ),
      celeste: entry(
        'Completato',
        5,
        24,
        100,
        'Completata la storia principale con qualche lato B.',
        'Finire altri lati B.',
      ),
      hades: entry('Backlog', 0, 3, 8, 'Provato poco, da riprendere.', 'Capire quale arma usare.'),
      'outer-wilds': entry(
        'Wishlist',
        0,
        0,
        0,
        'Tenere lontani gli spoiler.',
        'Iniziarlo in un weekend libero.',
      ),
      'stardew-valley': entry(
        'In corso',
        4,
        27,
        42,
        'Fattoria avviata e prime routine stabili.',
        'Arrivare al primo inverno.',
      ),
      'dead-cells': entry(
        'In corso',
        4,
        23,
        48,
        'Buon ritmo, ancora poche armi sbloccate.',
        'Superare una run completa.',
      ),
      'elden-ring': entry(
        'Backlog',
        0,
        6,
        9,
        'Troppo grande per ora.',
        'Riprenderlo dopo Celeste.',
      ),
      'zelda-breath-of-the-wild': entry(
        'Completato',
        5,
        98,
        100,
        'Completata la storia con molte esplorazioni.',
        'Recuperare sacrari rimanenti.',
      ),
      'disco-elysium': entry(
        'Wishlist',
        0,
        0,
        0,
        'Sembra perfetto per sessioni lente.',
        'Iniziarlo senza distrazioni.',
      ),
      'portal-2': entry(
        'Completato',
        5,
        12,
        100,
        'Campagna chiusa, co-op ancora da fare.',
        'Giocare la co-op.',
      ),
      minecraft: entry(
        'In corso',
        4,
        68,
        36,
        'Mondo survival rilassato.',
        'Costruire una base automatizzata.',
      ),
      'the-witcher-3': entry(
        'Backlog',
        0,
        4,
        6,
        'Troppo narrativo per sessioni brevi.',
        'Ripartire con una run ordinata.',
      ),
    },
  },
  {
    email: 'luca.rpg@gameshelf.demo',
    displayName: 'Luca RPG',
    role: 'standard',
    entries: {
      'hollow-knight': entry(
        'Backlog',
        0,
        5,
        10,
        'Apprezzo lo stile, ma devo entrarci meglio.',
        'Sbloccare nuove aree.',
      ),
      celeste: entry(
        'Wishlist',
        0,
        0,
        0,
        'Lo tengo per una pausa dagli RPG.',
        'Provare la storia principale.',
      ),
      hades: entry(
        'Completato',
        5,
        54,
        100,
        'Loop fantastico e build molto varie.',
        'Sbloccare altri dialoghi post-finale.',
      ),
      'outer-wilds': entry(
        'Completato',
        5,
        24,
        100,
        'Esperienza memorabile, da non spoilerare.',
        'Rigiocarlo con commento personale.',
      ),
      'stardew-valley': entry(
        'Wishlist',
        0,
        0,
        0,
        'Lo usero come gioco tranquillo.',
        'Avviare una fattoria nuova.',
      ),
      'dead-cells': entry(
        'In corso',
        4,
        18,
        34,
        'Combattimento molto solido.',
        'Arrivare piu stabilmente ai boss finali.',
      ),
      'elden-ring': entry(
        'In corso',
        5,
        116,
        84,
        'Build forza/fede molto divertente.',
        'Completare quest secondarie prima del finale.',
      ),
      'zelda-breath-of-the-wild': entry(
        'Completato',
        5,
        112,
        100,
        'Esplorazione eccellente.',
        'Provare il DLC.',
      ),
      'disco-elysium': entry(
        'In corso',
        5,
        18,
        40,
        'Scrittura incredibile e scelte interessanti.',
        'Finire il caso senza spoiler.',
      ),
      'portal-2': entry(
        'Completato',
        4,
        10,
        100,
        'Puzzle design pulitissimo.',
        'Rigiocare alcune camere.',
      ),
      minecraft: entry(
        'Backlog',
        0,
        9,
        14,
        'Mi interessa piu in multiplayer.',
        'Entrare in un server con amici.',
      ),
      'the-witcher-3': entry(
        'In corso',
        5,
        76,
        58,
        'Quest secondarie ottime.',
        'Finire Novigrad prima di cambiare gioco.',
      ),
    },
  },
  {
    email: 'giulia.coop@gameshelf.demo',
    displayName: 'Giulia Coop',
    role: 'standard',
    entries: {
      'hollow-knight': entry(
        'Wishlist',
        0,
        0,
        0,
        'Mi incuriosisce ma temo la difficolta.',
        'Provarlo per almeno due ore.',
      ),
      celeste: entry(
        'In corso',
        4,
        11,
        52,
        'Difficile ma molto leggibile.',
        'Finire la storia principale.',
      ),
      hades: entry(
        'In corso',
        4,
        36,
        70,
        'Run rapide perfette per sessioni brevi.',
        'Completare una fuga.',
      ),
      'outer-wilds': entry(
        'Backlog',
        0,
        2,
        4,
        'Atmosfera bellissima.',
        'Riprenderlo senza interruzioni.',
      ),
      'stardew-valley': entry(
        'In corso',
        5,
        72,
        64,
        'Giocato spesso in co-op.',
        'Ottimizzare la fattoria condivisa.',
      ),
      'dead-cells': entry(
        'Backlog',
        0,
        8,
        20,
        'Lo tengo per quando voglio action puro.',
        'Sbloccare altri percorsi.',
      ),
      'elden-ring': entry(
        'Wishlist',
        0,
        0,
        0,
        'Lo guardo da lontano per ora.',
        'Provare una build semplice.',
      ),
      'zelda-breath-of-the-wild': entry(
        'In corso',
        5,
        63,
        72,
        'Esplorazione libera molto piacevole.',
        'Finire la storia principale.',
      ),
      'disco-elysium': entry(
        'Wishlist',
        0,
        0,
        0,
        'Sembra molto narrativo.',
        'Iniziarlo in vacanza.',
      ),
      'portal-2': entry(
        'Completato',
        5,
        16,
        100,
        'Co-op completata con ottimi momenti.',
        'Rigiocare le stanze avanzate.',
      ),
      minecraft: entry(
        'In corso',
        5,
        184,
        76,
        'Mondo condiviso con amici.',
        'Costruire villaggio e farm automatiche.',
      ),
      'the-witcher-3': entry(
        'Wishlist',
        0,
        0,
        0,
        'Troppo lungo per ora.',
        'Metterlo in backlog dopo Zelda.',
      ),
    },
  },
];

const games = await loadMockGames();
const catalogGames = games.map(toCatalogGame);
const firebaseApp = initializeApp(firebaseConfig, 'demo-seed');
const firebaseAuth = getAuth(firebaseApp);
const firebaseDb = getFirestore(firebaseApp);
const seedAdminCatalog = process.argv.includes('--admin');
const adminAccessToken = seedAdminCatalog ? await tryGetFirebaseCliAccessToken() : null;
let catalogSynced = false;

if (adminAccessToken) {
  console.log(`Syncing ${catalogGames.length} catalog games...`);
  await writeFirestoreDocument(
    ['catalog', 'default'],
    {
      games: catalogGames,
      updatedAt: new Date().toISOString(),
    },
    adminAccessToken,
  );
  catalogSynced = true;
} else {
  console.log('Catalog admin seed skipped.');
}

const createdUsers = [];

for (const [userIndex, user] of demoUsers.entries()) {
  console.log(`Preparing demo user ${user.email}...`);
  const authUser = await ensureAuthUser(user.email, demoPassword, user.displayName);
  const entries = completeEntries(user.entries, userIndex);

  if (adminAccessToken) {
    await writeFirestoreDocument(
      ['userProfiles', authUser.localId],
      publicProfile(user, authUser, userIndex, entries),
      adminAccessToken,
    );

    await writeFirestoreDocument(
      ['userRoles', authUser.localId],
      {
        role: user.role ?? 'standard',
      },
      adminAccessToken,
    );
  }

  await writeUserShelf(user.email, authUser.localId, entries);
  console.log(`Shelf written for ${user.email}.`);

  createdUsers.push({
    email: user.email,
    displayName: user.displayName,
    role: user.role ?? 'standard',
    uid: authUser.localId,
  });
}

await firebaseAuth.signOut();
await deleteApp(firebaseApp);

console.log(
  JSON.stringify(
    {
      catalogGames: catalogGames.length,
      catalogSynced,
      catalogSyncSkippedReason: catalogSynced
        ? null
        : 'Run firebase login --reauth, then npm run seed:demo -- --admin to sync Firestore catalog.',
      demoPassword,
      users: createdUsers,
    },
    null,
    2,
  ),
);

function entry(status, rating, hoursPlayed, progress, notes, personalGoal) {
  return {
    status,
    rating,
    hoursPlayed,
    progress,
    notes,
    personalGoal,
  };
}

function completeEntries(entries, userIndex) {
  return Object.fromEntries(
    games.map((game, gameIndex) => {
      const savedEntry = entries[game.id] ?? {};
      const updatedAt = new Date(
        Date.now() - (userIndex * games.length + gameIndex) * 36 * 60 * 60 * 1000,
      ).toISOString();

      return [
        game.id,
        {
          status: 'Wishlist',
          rating: 0,
          hoursPlayed: 0,
          progress: 0,
          notes: '',
          personalGoal: '',
          ...savedEntry,
          updatedAt: savedEntry.updatedAt ?? updatedAt,
        },
      ];
    }),
  );
}

function publicProfile(user, authUser, index, entries) {
  return {
    displayName: user.displayName,
    handle: `@${user.email.split('@')[0].replace(/[^a-z0-9-]/g, '-')}`,
    createdAt: authUser.createdAt
      ? new Date(Number(authUser.createdAt)).toISOString()
      : new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    shelfSummary: publicShelfSummary(entries),
  };
}

function publicShelfSummary(entries) {
  const shelfGames = catalogGames.flatMap((game) => {
    const entry = entries[game.id];

    return entry ? [{ ...game, ...entry }] : [];
  });
  const recentGames = [...shelfGames]
    .sort((first, second) => updatedAtTime(second) - updatedAtTime(first))
    .slice(0, 3)
    .map((game) => ({
      id: game.id,
      title: game.title,
      status: game.status,
      rating: game.rating,
      hoursPlayed: game.hoursPlayed,
      progress: game.progress,
      updatedAt: plainDateString(game.updatedAt),
    }));

  return {
    savedCount: shelfGames.length,
    activeCount: shelfGames.filter((game) => game.status === 'In corso').length,
    completedCount: shelfGames.filter((game) => game.status === 'Completato').length,
    totalHours: shelfGames.reduce((total, game) => total + game.hoursPlayed, 0),
    lastActivityAt: recentGames[0]?.updatedAt ?? '',
    recentGames,
  };
}

function updatedAtTime(game) {
  const time = Date.parse(game.updatedAt ?? '');

  return Number.isNaN(time) ? 0 : time;
}

function plainDateString(value) {
  const time = Date.parse(value ?? '');

  return Number.isNaN(time) ? '' : new Date(time).toUTCString();
}

function toCatalogGame(game) {
  const { status, rating, hoursPlayed, progress, notes, personalGoal, ...catalogGame } = game;

  return catalogGame;
}

async function loadMockGames() {
  const source = await readFile(new URL('../src/app/data/mock-games.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const sandbox = {
    exports: {},
    module: { exports: {} },
    require: () => ({}),
  };
  sandbox.exports = sandbox.module.exports;

  vm.runInNewContext(output, sandbox, { filename: 'mock-games.ts' });

  return sandbox.module.exports.MOCK_GAMES;
}

async function ensureAuthUser(email, password, displayName) {
  const signUpResponse = await identityToolkit('accounts:signUp', {
    email,
    password,
    displayName,
    returnSecureToken: true,
  });

  let user = signUpResponse;

  if (signUpResponse.error?.message === 'EMAIL_EXISTS') {
    user = await identityToolkit('accounts:signInWithPassword', {
      email,
      password,
      returnSecureToken: true,
    });
  }

  if (user.error) {
    throw new Error(`${email}: ${user.error.message}`);
  }

  const updatedUser = await identityToolkit('accounts:update', {
    idToken: user.idToken,
    displayName,
    returnSecureToken: true,
  });

  if (updatedUser.error) {
    throw new Error(`${email}: ${updatedUser.error.message}`);
  }

  return updatedUser;
}

async function identityToolkit(method, body) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${method}?key=${firebaseConfig.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  return response.json();
}

async function writeUserShelf(email, userId, entries) {
  const credential = await signInWithEmailAndPassword(firebaseAuth, email, demoPassword);

  if (credential.user.uid !== userId) {
    throw new Error(`${email}: authenticated user does not match expected UID.`);
  }

  await setDoc(
    doc(firebaseDb, 'users', userId, 'shelf', 'default'),
    {
      entries,
      updatedAt: new Date(),
    },
    { merge: true },
  );
}

async function getFirebaseCliAccessToken() {
  const auth = require('firebase-tools/lib/auth.js');
  const account = auth.getGlobalDefaultAccount();

  if (!account?.tokens?.refresh_token) {
    throw new Error('Firebase CLI non risulta autenticata. Esegui firebase login.');
  }

  if (account.tokens.access_token && account.tokens.expires_at > Date.now() + 60000) {
    return account.tokens.access_token;
  }

  const tokenData = await auth.getAccessToken(account.tokens.refresh_token, [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/datastore',
  ]);

  return tokenData.access_token;
}

async function tryGetFirebaseCliAccessToken() {
  try {
    return await getFirebaseCliAccessToken();
  } catch (error) {
    console.warn(`Catalog admin seed skipped: ${error.message}`);
    return null;
  }
}

async function writeFirestoreDocument(pathSegments, value, bearerToken) {
  const urlPath = pathSegments.map((segment) => encodeURIComponent(segment)).join('/');
  const updateMask = Object.keys(value)
    .map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
    .join('&');
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${urlPath}?${updateMask}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: toFirestoreFields(value) }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firestore write failed for ${pathSegments.join('/')}: ${error}`);
  }
}

function toFirestoreFields(value) {
  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [key, toFirestoreValue(fieldValue)]),
  );
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (typeof value === 'string') {
    return isIsoDate(value) ? { timestampValue: value } : { stringValue: value };
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }

  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }

  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((item) => toFirestoreValue(item)) } };
  }

  return { mapValue: { fields: toFirestoreFields(value) } };
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}T/.test(value);
}
