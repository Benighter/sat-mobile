import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import JSZip from 'jszip';

const require = createRequire(import.meta.url);
const firebaseAuth = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client } = require('firebase-tools/lib/apiv2');

const PROJECT_ID = 'sat-mobile-de6f1';
const functionName = process.argv.slice(2).find((argument) => argument !== '--');
if (!functionName || !/^[A-Za-z][A-Za-z0-9_]{0,99}$/.test(functionName)) {
  throw new Error('Provide one deployed function name');
}

const account = firebaseAuth.getProjectDefaultAccount(process.cwd());
if (!account) throw new Error('Firebase CLI account unavailable');
const options = { project: PROJECT_ID, projectRoot: process.cwd(), nonInteractive: true };
firebaseAuth.setActiveAccount(options, account);
await requireAuth(options);

const inventoryBytes = await readFile('migration-artifacts/firebase-functions-independence-inventory.json');
const inventoryText = inventoryBytes[0] === 0xff && inventoryBytes[1] === 0xfe
  ? inventoryBytes.subarray(2).toString('utf16le')
  : inventoryBytes.toString('utf8').replace(/^\uFEFF/, '');
const inventory = JSON.parse(inventoryText);
const deployed = inventory.result?.find((item) => item.id === functionName);
if (!deployed) throw new Error('Deployed function was not found in the inventory');

const functionsClient = new Client({ urlPrefix: 'https://cloudfunctions.googleapis.com', auth: true });
const functionResponse = await functionsClient.get(
  `/v1/projects/${PROJECT_ID}/locations/${deployed.region}/functions/${functionName}`,
);
const archiveUrl = String(functionResponse.body?.sourceArchiveUrl ?? '');
if (!archiveUrl.startsWith('gs://')) {
  process.stdout.write(JSON.stringify({
    functionName,
    recoverable: false,
    reason: 'NO_READABLE_SOURCE_ARCHIVE',
  }));
} else {
const archivePath = archiveUrl.slice('gs://'.length);
const separator = archivePath.indexOf('/');
const bucket = archivePath.slice(0, separator);
const object = archivePath.slice(separator + 1);
const client = new Client({ urlPrefix: 'https://storage.googleapis.com', auth: true });
const response = await client.get(
  `/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(object)}?alt=media`,
  {
  responseType: 'stream',
  resolveOnHTTPError: true,
  },
);
if (response.status >= 400) throw new Error(`Deployed source download failed with HTTP ${response.status}`);

const chunks = [];
for await (const chunk of response.body) chunks.push(Buffer.from(chunk));
const archive = await JSZip.loadAsync(Buffer.concat(chunks));

let sourcePath = '';
let source = '';
for (const [path, entry] of Object.entries(archive.files)) {
  if (entry.dir || !/\.[cm]?[jt]s$/i.test(path)) continue;
  const candidate = await entry.async('string');
  if (candidate.includes(functionName)) {
    sourcePath = path;
    source = candidate;
    if (candidate.includes(`exports.${functionName}`)) break;
  }
}
if (!source) throw new Error('Function name was not present in the deployed source archive');

const marker = source.indexOf(`exports.${functionName}`);
const start = marker >= 0 ? marker : source.indexOf(functionName);
const nextExport = source.indexOf('\nexports.', start + functionName.length);
const snippet = source.slice(start, nextExport >= 0 ? nextExport : source.length);
const staticCollections = [...snippet.matchAll(/\.collection\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/g)]
  .map((match) => match[1]);
const staticDocumentRoots = [...snippet.matchAll(/\.doc\(\s*[`'"]([A-Za-z0-9_-]+)/g)]
  .map((match) => match[1]);

process.stdout.write(JSON.stringify({
  functionName,
  sourcePath,
  sourceSha256: createHash('sha256').update(snippet).digest('hex'),
  sourceBytes: Buffer.byteLength(snippet),
  sourceLines: snippet.split(/\r?\n/).length,
  staticCollections: [...new Set(staticCollections)].sort(),
  staticDocumentRoots: [...new Set(staticDocumentRoots)].sort(),
  operations: {
    authDeleteUser: /auth\(\)\.deleteUser|auth\.deleteUser/.test(snippet),
    authUpdateUser: /auth\(\)\.updateUser|auth\.updateUser/.test(snippet),
    revokeRefreshTokens: /revokeRefreshTokens/.test(snippet),
    firestoreTransaction: /runTransaction/.test(snippet),
    firestoreBatch: /\.batch\(\)/.test(snippet),
    storageDelete: /bucket\(|\.file\(|deleteFiles|\.delete\(\)/.test(snippet),
    callableHttpsError: /HttpsError/.test(snippet),
  },
}));
}
