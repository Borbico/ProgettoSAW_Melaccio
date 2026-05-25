import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const projectId = 'saw2026melaccio';

const accessToken = await getFirebaseCliAccessToken();
const catalogDocument = await readFirestoreDocument(['catalog', 'default'], accessToken);
const rawgApiKey = firestoreString(catalogDocument.fields?.rawgApiKey);

if (!rawgApiKey) {
  console.log('Nessuna rawgApiKey trovata in catalog/default. Migrazione non necessaria.');
  process.exit(0);
}

await writeFirestoreDocument(
  ['integrations', 'rawg'],
  {
    apiKey: rawgApiKey,
    updatedAt: new Date().toISOString(),
  },
  accessToken,
);

await deleteFirestoreFields(['catalog', 'default'], ['rawgApiKey'], accessToken);

console.log('RAWG API key migrata in integrations/rawg e rimossa da catalog/default.');

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

async function readFirestoreDocument(pathSegments, bearerToken) {
  const response = await fetch(firestoreUrl(pathSegments), {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firestore read failed for ${pathSegments.join('/')}: ${error}`);
  }

  return response.json();
}

async function writeFirestoreDocument(pathSegments, value, bearerToken) {
  const updateMask = Object.keys(value)
    .map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
    .join('&');
  const response = await fetch(`${firestoreUrl(pathSegments)}?${updateMask}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: toFirestoreFields(value) }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firestore write failed for ${pathSegments.join('/')}: ${error}`);
  }
}

async function deleteFirestoreFields(pathSegments, fieldPaths, bearerToken) {
  const updateMask = fieldPaths
    .map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
    .join('&');
  const response = await fetch(`${firestoreUrl(pathSegments)}?${updateMask}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: {} }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firestore field delete failed for ${pathSegments.join('/')}: ${error}`);
  }
}

function firestoreUrl(pathSegments) {
  const urlPath = pathSegments.map((segment) => encodeURIComponent(segment)).join('/');

  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${urlPath}`;
}

function firestoreString(field) {
  return typeof field?.stringValue === 'string' ? field.stringValue.trim() : '';
}

function toFirestoreFields(value) {
  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [key, toFirestoreValue(fieldValue)]),
  );
}

function toFirestoreValue(value) {
  if (typeof value === 'string') {
    return isIsoDate(value) ? { timestampValue: value } : { stringValue: value };
  }

  throw new Error(`Unsupported Firestore value: ${value}`);
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}T/.test(value);
}
