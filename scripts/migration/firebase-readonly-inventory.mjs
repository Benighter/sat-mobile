import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const firebaseAuth = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client } = require('firebase-tools/lib/apiv2');
const firebaseApi = require('firebase-tools/lib/api');

const PROJECT_ID = 'sat-mobile-de6f1';
const DATABASE_ID = '(default)';
const STORAGE_BUCKET = 'sat-mobile-de6f1.firebasestorage.app';
const PAGE_SIZE = 500;
let activeStage = 'startup';
let firestoreRequestCount = 0;
const REQUEST_TIMEOUT_MS = 120_000;

async function boundedRequest(promise, stage) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(Object.assign(new Error('Inventory request timed out'), { code: 'REQUEST_TIMEOUT', stage })), REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function reportFirestoreProgress() {
  firestoreRequestCount += 1;
  if (firestoreRequestCount % 250 === 0) {
    process.stderr.write(
      `${JSON.stringify({ progress: 'firestore_requests', firestoreRequestCount, activeStage })}\n`,
    );
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function digestList(values) {
  return digest([...values].sort());
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function sortedObject(map) {
  return Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()),
  );
  return results;
}

function pathPattern(collectionPath) {
  return collectionPath
    .split('/')
    .map((segment, index) => (index % 2 === 1 ? '*' : segment))
    .join('/');
}

function stringField(fields, key) {
  const value = fields?.[key];
  return value?.stringValue ?? null;
}

function churchIdForDocument(documentPath, fields) {
  const segments = documentPath.split('/');
  if (segments[0] === 'churches' && segments.length > 1) return segments[1];
  return (
    stringField(fields, 'churchId') ??
    stringField(fields, 'churchID') ??
    stringField(fields, 'church_id')
  );
}

function providerIds(user) {
  return [...new Set((user.providerUserInfo ?? []).map((entry) => entry.providerId).filter(Boolean))].sort();
}

function customRoleState(customAttributes) {
  if (!customAttributes) return 'missing';
  try {
    const claims = JSON.parse(customAttributes);
    if (claims.role === 'authenticated') return 'authenticated';
    if (Object.hasOwn(claims, 'role')) return 'other';
    return 'missing';
  } catch {
    return 'invalid_json';
  }
}

async function authenticate() {
  const account = firebaseAuth.getProjectDefaultAccount(process.cwd());
  if (!account) throw Object.assign(new Error('Firebase CLI account unavailable'), { code: 'NO_FIREBASE_ACCOUNT' });

  const options = {
    project: PROJECT_ID,
    projectRoot: process.cwd(),
    nonInteractive: true,
  };
  firebaseAuth.setActiveAccount(options, account);
  await requireAuth(options);
}

async function listCollectionIds(client, parentResource) {
  activeStage = `firestore_list_collection_ids_depth_${Math.max(0, parentResource.split('/documents/')[1]?.split('/').length ?? 0)}`;
  const ids = [];
  let pageToken;
  do {
    const response = await boundedRequest(client.post(`/v1/${parentResource}:listCollectionIds`, {
      pageSize: 1000,
      ...(pageToken ? { pageToken } : {}),
    }), activeStage);
    reportFirestoreProgress();
    ids.push(...(response.body.collectionIds ?? []));
    pageToken = response.body.nextPageToken;
  } while (pageToken);
  return [...new Set(ids)].sort();
}

async function listDocuments(client, parentResource, collectionId) {
  activeStage = `firestore_list_documents_depth_${Math.max(0, parentResource.split('/documents/')[1]?.split('/').length ?? 0)}`;
  const documents = [];
  let pageToken;
  do {
    const response = await boundedRequest(client.get(`/v1/${parentResource}/${encodeURIComponent(collectionId)}`, {
      queryParams: {
        pageSize: 1000,
        showMissing: 'true',
        ...(pageToken ? { pageToken } : {}),
      },
    }), activeStage);
    reportFirestoreProgress();
    documents.push(...(response.body.documents ?? []));
    pageToken = response.body.nextPageToken;
  } while (pageToken);
  return documents.sort((a, b) => a.name.localeCompare(b.name));
}

async function inventoryFirestore() {
  const client = new Client({ urlPrefix: 'https://firestore.googleapis.com', auth: true });
  const rootResource = `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
  let parents = [{ parentResource: rootResource, parentPath: '' }];
  const collectionCounts = new Map();
  const rootCollectionCounts = new Map();
  const churchCounts = new Map();
  const documentDigests = [];
  let documentCount = 0;
  let parentCount = 0;
  let depth = 0;

  while (parents.length > 0) {
    const nextParentsByParent = await mapWithConcurrency(parents, 1, async ({ parentResource, parentPath }) => {
      const collectionIds = await listCollectionIds(client, parentResource);
      const childrenByCollection = await mapWithConcurrency(collectionIds, 1, async (collectionId) => {
        const collectionPath = parentPath ? `${parentPath}/${collectionId}` : collectionId;
        const documents = await listDocuments(client, parentResource, collectionId);
        const existingDocuments = documents.filter((document) => document.createTime || document.updateTime);
        increment(collectionCounts, pathPattern(collectionPath), existingDocuments.length);
        if (!parentPath) increment(rootCollectionCounts, collectionId, existingDocuments.length);

        return documents.map((document) => {
          const documentPath = document.name.slice(rootResource.length + 1);
          if (document.createTime || document.updateTime) {
            const documentId = documentPath.split('/').at(-1);
            const fields = document.fields ?? {};
            const churchId = churchIdForDocument(documentPath, fields);
            if (churchId) increment(churchCounts, digest(`church:${churchId}`).slice(0, 16));

            documentDigests.push(
              digest({
                documentPath,
                documentId,
                collectionPath,
                createTime: document.createTime ?? null,
                updateTime: document.updateTime ?? null,
                fields,
              }),
            );
            documentCount += 1;
          }
          return { parentResource: document.name, parentPath: documentPath };
        });
      });
      return childrenByCollection.flat();
    });

    parentCount += parents.length;
    parents = nextParentsByParent.flat();
    process.stderr.write(
      `${JSON.stringify({ progress: 'firestore', depth, parentCount, documentCount, nextParentCount: parents.length })}\n`,
    );
    depth += 1;
  }

  return {
    databaseId: DATABASE_ID,
    documentCount,
    rootCollectionCounts: sortedObject(rootCollectionCounts),
    collectionPatternCounts: sortedObject(collectionCounts),
    churchBoundaryCount: churchCounts.size,
    churchBoundaryDocumentCounts: sortedObject(churchCounts),
    checksumSha256: digestList(documentDigests),
  };
}

async function inventoryStorage() {
  const client = new Client({ urlPrefix: 'https://storage.googleapis.com/storage/v1', auth: true });
  const prefixCounts = new Map();
  const objectDigests = [];
  let objectCount = 0;
  let totalBytes = 0n;
  let pageToken;

  do {
    const response = await boundedRequest(client.get(`/b/${encodeURIComponent(STORAGE_BUCKET)}/o`, {
      queryParams: {
        maxResults: 1000,
        ...(pageToken ? { pageToken } : {}),
      },
    }), 'storage_inventory');
    for (const object of response.body.items ?? []) {
      const size = BigInt(object.size ?? '0');
      const prefix = object.name.includes('/') ? object.name.split('/')[0] : '(root)';
      increment(prefixCounts, prefix);
      objectCount += 1;
      totalBytes += size;
      objectDigests.push(
        digest({
          name: object.name,
          generation: object.generation ?? null,
          size: object.size ?? '0',
          contentType: object.contentType ?? null,
          md5Hash: object.md5Hash ?? null,
          crc32c: object.crc32c ?? null,
          updated: object.updated ?? null,
        }),
      );
    }
    pageToken = response.body.nextPageToken;
  } while (pageToken);

  return {
    bucket: STORAGE_BUCKET,
    objectCount,
    totalBytes: totalBytes.toString(),
    topLevelPrefixCounts: sortedObject(prefixCounts),
    checksumSha256: digestList(objectDigests),
  };
}

async function inventoryAuth() {
  const client = new Client({ urlPrefix: firebaseApi.identityOrigin(), auth: true });
  const providerCounts = new Map();
  const roleCounts = new Map();
  const userDigests = [];
  let offset = 0;
  let userCount = 0;
  let disabledCount = 0;
  let verifiedCount = 0;
  let passwordBackedCount = 0;

  while (true) {
    const response = await boundedRequest(client.post(`/v1/projects/${PROJECT_ID}/accounts:query`, {
      offset: String(offset),
      limit: String(PAGE_SIZE),
    }), 'auth_inventory');
    const users = response.body.userInfo ?? [];
    const recordsCount = Number(response.body.recordsCount ?? users.length);
    if (recordsCount === 0) break;

    for (const user of users) {
      const providers = providerIds(user);
      for (const provider of providers) increment(providerCounts, provider);
      const roleState = customRoleState(user.customAttributes);
      increment(roleCounts, roleState);
      if (user.disabled === true) disabledCount += 1;
      if (user.emailVerified === true) verifiedCount += 1;
      if (typeof user.passwordHash === 'string' && user.passwordHash.length > 0) passwordBackedCount += 1;

      userDigests.push(
        digest({
          uid: user.localId,
          email: user.email ?? null,
          emailVerified: user.emailVerified === true,
          disabled: user.disabled === true,
          providers,
          createdAt: user.createdAt ?? null,
          lastLoginAt: user.lastLoginAt ?? null,
          roleState,
        }),
      );
      userCount += 1;
    }
    offset += recordsCount;
  }

  return {
    userCount,
    disabledCount,
    verifiedCount,
    passwordBackedCount,
    providerCounts: sortedObject(providerCounts),
    roleClaimCounts: sortedObject(roleCounts),
    checksumSha256: digestList(userDigests),
  };
}

async function main() {
  activeStage = 'authenticate';
  await authenticate();
  const startedAt = new Date().toISOString();
  activeStage = 'firestore_inventory';
  const firestore = await inventoryFirestore();
  activeStage = 'storage_inventory';
  const storage = await inventoryStorage();
  activeStage = 'auth_inventory';
  const auth = await inventoryAuth();
  const completedAt = new Date().toISOString();

  process.stdout.write(
    `${JSON.stringify(
      {
        projectId: PROJECT_ID,
        mode: 'read-only-counts-and-hashes',
        startedAt,
        completedAt,
        firestore,
        storage,
        auth,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: {
        stage: activeStage,
        name: error?.name ?? 'Error',
        code: error?.code ?? error?.original?.code ?? null,
        status: error?.status ?? error?.original?.status ?? null,
      },
    })}\n`,
  );
  process.exitCode = 1;
});
