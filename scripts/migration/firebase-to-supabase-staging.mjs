import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const firebaseAuth = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client, getAccessToken } = require('firebase-tools/lib/apiv2');
const firebaseApi = require('firebase-tools/lib/api');

const PROJECT_ID = 'sat-mobile-de6f1';
const DATABASE_ID = '(default)';
const STORAGE_BUCKET = 'sat-mobile-de6f1.firebasestorage.app';
const PAGE_SIZE = 500;
const BATCH_ROWS = 250;
const BATCH_BYTES = 96 * 1024;
const FIRESTORE_PARENT_CONCURRENCY = 3;
const FIRESTORE_COLLECTION_CONCURRENCY = 2;
const INTER_BATCH_DELAY_MS = 300;
const FIRESTORE_REQUEST_TIMEOUT_MS = 120_000;
let activeStage = 'startup';
let firestoreRequestCount = 0;
let firebaseOperatorToken = null;
const EDGE_INGEST_URL = 'https://ftbsocbwxbfqejapdthj.supabase.co/functions/v1/sat-migration-ingest';

async function boundedFirestoreRequest(promise) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(Object.assign(new Error('Firestore request timed out'), { code: 'FIRESTORE_REQUEST_TIMEOUT' })), FIRESTORE_REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
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

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

function jsonbExpression(value) {
  return `convert_from(decode('${encodeJson(value)}','base64'),'utf8')::jsonb`;
}

function timestampFromMillis(value) {
  if (value === undefined || value === null || value === '') return null;
  const milliseconds = Number(value);
  if (!Number.isFinite(milliseconds)) return null;
  return new Date(milliseconds).toISOString();
}

function pathPattern(collectionPath) {
  return collectionPath
    .split('/')
    .map((segment, index) => (index % 2 === 1 ? '*' : segment))
    .join('/');
}

function stringField(fields, key) {
  return fields?.[key]?.stringValue ?? null;
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

function parsedCustomClaims(customAttributes) {
  if (!customAttributes) return {};
  try {
    const value = JSON.parse(customAttributes);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function customRoleState(customAttributes) {
  if (!customAttributes) return 'missing';
  try {
    const claims = JSON.parse(customAttributes);
    if (claims?.role === 'authenticated') return 'authenticated';
    if (claims && typeof claims === 'object' && Object.hasOwn(claims, 'role')) return 'other';
    return 'missing';
  } catch {
    return 'invalid_json';
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  let nextIndex = 0;
  const results = new Array(items.length);
  async function runWorker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}

async function runSupabaseQueryOnce(sql, { target = 'local', json = false, maxStdoutBytes = 2_000_000 } = {}) {
  const supabasePackageDirectory = realpathSync(resolve(process.cwd(), 'node_modules', 'supabase'));
  const directWindowsBinary = resolve(
    supabasePackageDirectory,
    '..',
    '@supabase',
    'cli-windows-x64',
    'bin',
    'supabase.exe',
  );
  const executable = process.platform === 'win32' ? directWindowsBinary : process.execPath;
  const args = [
    ...(process.platform === 'win32'
      ? []
      : [resolve(process.cwd(), 'node_modules', 'supabase', 'dist', 'supabase.js')]),
    '--agent',
    'no',
    '--output-format',
    json ? 'json' : 'text',
    'db',
    'query',
    target === 'linked' ? '--linked' : '--local',
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let stdinFailed = false;
    let timedOut = false;
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      callback();
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      if (stdout.length < maxStdoutBytes) stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 64_000) stderr += chunk;
    });
    child.stdin.on('error', () => {
      stdinFailed = true;
    });
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 120_000);
    child.on('error', () => {
      clearTimeout(timeout);
      finish(() => reject(Object.assign(new Error('Supabase CLI could not start'), { code: 'SUPABASE_CLI_START' })));
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0 || stdinFailed || timedOut) {
        finish(() => reject(Object.assign(new Error('Supabase query failed'), {
          code: timedOut ? 'SUPABASE_QUERY_TIMEOUT' : stdinFailed ? 'SUPABASE_STDIN_CLOSED' : 'SUPABASE_QUERY_FAILED',
          exitCode: code,
        })));
        return;
      }
      if (!json) {
        finish(() => resolve(null));
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        finish(() => resolve(parsed));
      } catch {
        finish(() => reject(Object.assign(new Error('Supabase result was not valid JSON'), { code: 'SUPABASE_RESULT_INVALID' })));
      }
    });
    try {
      child.stdin.end(sql);
    } catch {
      stdinFailed = true;
    }
  });
}

async function runSupabaseQuery(sql, options = {}) {
  const attempts = options.target === 'linked' ? 3 : 1;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await runSupabaseQueryOnce(sql, options);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      process.stderr.write(`${JSON.stringify({ progress: 'supabase_query_retry', target: options.target ?? 'local', attempt })}\n`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 1_000));
    }
  }
  throw lastError;
}

async function runEdgeIngest(body) {
  if (!firebaseOperatorToken) throw Object.assign(new Error('Firebase operator token unavailable'), { code: 'NO_FIREBASE_OPERATOR_TOKEN' });
  let lastCode = 'EDGE_INGEST_FAILED';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch(EDGE_INGEST_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${firebaseOperatorToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => null);
      if (response.ok && result?.ok === true) return result;
      lastCode = typeof result?.code === 'string'
        ? `${result.code}${typeof result?.dbCode === 'string' ? `_${result.dbCode}` : ''}`
        : `EDGE_HTTP_${response.status}`;
    } catch (error) {
      lastCode = error?.name === 'AbortError' ? 'EDGE_INGEST_TIMEOUT' : 'EDGE_INGEST_NETWORK';
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < 3) {
      process.stderr.write(`${JSON.stringify({ progress: 'edge_ingest_retry', attempt, code: lastCode })}\n`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 1_000));
    }
  }
  throw Object.assign(new Error('Migration edge ingest failed'), { code: lastCode });
}

class JsonBatchWriter {
  constructor(kind, migrationRunId, target) {
    this.kind = kind;
    this.migrationRunId = migrationRunId;
    this.target = target;
    this.rows = [];
    this.bytes = 2;
    this.batchCount = 0;
    this.rowCount = 0;
    this.writeChain = Promise.resolve();
  }

  async add(row) {
    const serialized = JSON.stringify(row);
    this.rows.push(serialized);
    this.bytes += Buffer.byteLength(serialized, 'utf8') + 1;
    if (this.rows.length >= BATCH_ROWS || this.bytes >= BATCH_BYTES) await this.flush();
  }

  async flush() {
    if (this.rows.length === 0) return;
    const payload = `[${this.rows.join(',')}]`;
    const sql = batchInsertSql(this.kind, this.migrationRunId, payload);
    const rowsInBatch = this.rows.length;
    this.rows = [];
    this.bytes = 2;
    const writeBatch = async () => {
      process.stderr.write(`${JSON.stringify({
        progress: 'staging_batch_start',
        kind: this.kind,
        rowsInBatch,
        payloadBytes: Buffer.byteLength(payload, 'utf8'),
      })}\n`);
      if (this.target === 'edge') {
        await runEdgeIngest({
          operation: 'ingest',
          migrationRunId: this.migrationRunId,
          kind: this.kind,
          rows: JSON.parse(payload),
        });
      } else {
        await runSupabaseQuery(sql, { target: this.target });
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, INTER_BATCH_DELAY_MS));
      this.batchCount += 1;
      this.rowCount += rowsInBatch;
      process.stderr.write(`${JSON.stringify({ progress: 'staging_batch', kind: this.kind, batchCount: this.batchCount, rowCount: this.rowCount })}\n`);
    };
    this.writeChain = this.writeChain.then(writeBatch);
    await this.writeChain;
  }
}

function batchInsertSql(kind, migrationRunId, serializedPayload) {
  const payloadExpression = `convert_from(decode('${Buffer.from(serializedPayload, 'utf8').toString('base64')}','base64'),'utf8')::jsonb`;
  if (kind === 'firestore') {
    return `
insert into migration_staging.firestore_documents (
  migration_run_id, document_path, collection_path, document_id, church_id, payload,
  source_created_at, source_updated_at, source_checksum
)
select
  '${migrationRunId}'::uuid, x.document_path, x.collection_path, x.document_id,
  x.church_id, x.payload, x.source_created_at::timestamptz,
  x.source_updated_at::timestamptz, x.source_checksum
from jsonb_to_recordset(${payloadExpression}) as x(
  document_path text, collection_path text, document_id text, church_id text,
  payload jsonb, source_created_at text, source_updated_at text, source_checksum text
)
on conflict (migration_run_id, document_path) do update set
  collection_path = excluded.collection_path,
  document_id = excluded.document_id,
  church_id = excluded.church_id,
  payload = excluded.payload,
  source_created_at = excluded.source_created_at,
  source_updated_at = excluded.source_updated_at,
  source_checksum = excluded.source_checksum,
  imported_at = now()
where migration_staging.firestore_documents.source_checksum is distinct from excluded.source_checksum;`;
  }
  if (kind === 'auth') {
    return `
insert into migration_staging.auth_identity_map (
  migration_run_id, firebase_uid, email, email_verified, disabled, provider_ids,
  source_created_at, source_last_sign_in_at, source_checksum, source_tenant_id,
  source_last_refresh_at, source_profile, source_custom_claims, role_claim_state
)
select
  '${migrationRunId}'::uuid, x.firebase_uid, x.email, x.email_verified, x.disabled,
  x.provider_ids, x.source_created_at::timestamptz, x.source_last_sign_in_at::timestamptz,
  x.source_checksum, x.source_tenant_id, x.source_last_refresh_at::timestamptz,
  x.source_profile, x.source_custom_claims, x.role_claim_state
from jsonb_to_recordset(${payloadExpression}) as x(
  firebase_uid text, email text, email_verified boolean, disabled boolean,
  provider_ids jsonb, source_created_at text, source_last_sign_in_at text,
  source_checksum text, source_tenant_id text, source_last_refresh_at text,
  source_profile jsonb, source_custom_claims jsonb, role_claim_state text
)
on conflict (migration_run_id, firebase_uid) do update set
  email = excluded.email,
  email_verified = excluded.email_verified,
  disabled = excluded.disabled,
  provider_ids = excluded.provider_ids,
  source_created_at = excluded.source_created_at,
  source_last_sign_in_at = excluded.source_last_sign_in_at,
  source_checksum = excluded.source_checksum,
  source_tenant_id = excluded.source_tenant_id,
  source_last_refresh_at = excluded.source_last_refresh_at,
  source_profile = excluded.source_profile,
  source_custom_claims = excluded.source_custom_claims,
  role_claim_state = excluded.role_claim_state
where migration_staging.auth_identity_map.source_checksum is distinct from excluded.source_checksum
   or migration_staging.auth_identity_map.source_profile is distinct from excluded.source_profile
   or migration_staging.auth_identity_map.source_custom_claims is distinct from excluded.source_custom_claims;`;
  }
  if (kind === 'storage') {
    return `
insert into migration_staging.storage_objects (
  migration_run_id, source_bucket, source_path, size_bytes, content_type,
  source_checksum, source_generation, source_updated_at, source_md5,
  source_crc32c, source_metadata
)
select
  '${migrationRunId}'::uuid, x.source_bucket, x.source_path, x.size_bytes::bigint,
  x.content_type, x.source_checksum, x.source_generation,
  x.source_updated_at::timestamptz, x.source_md5, x.source_crc32c, x.source_metadata
from jsonb_to_recordset(${payloadExpression}) as x(
  source_bucket text, source_path text, size_bytes text, content_type text,
  source_checksum text, source_generation text, source_updated_at text,
  source_md5 text, source_crc32c text, source_metadata jsonb
)
on conflict (migration_run_id, source_bucket, source_path) do update set
  size_bytes = excluded.size_bytes,
  content_type = excluded.content_type,
  source_checksum = excluded.source_checksum,
  source_generation = excluded.source_generation,
  source_updated_at = excluded.source_updated_at,
  source_md5 = excluded.source_md5,
  source_crc32c = excluded.source_crc32c,
  source_metadata = excluded.source_metadata
where migration_staging.storage_objects.source_checksum is distinct from excluded.source_checksum
   or migration_staging.storage_objects.source_metadata is distinct from excluded.source_metadata;`;
  }
  throw Object.assign(new Error('Unsupported staging batch kind'), { code: 'UNSUPPORTED_BATCH_KIND' });
}

async function authenticateFirebase() {
  const account = firebaseAuth.getProjectDefaultAccount(process.cwd());
  if (!account) throw Object.assign(new Error('Firebase CLI account unavailable'), { code: 'NO_FIREBASE_ACCOUNT' });
  const options = { project: PROJECT_ID, projectRoot: process.cwd(), nonInteractive: true };
  firebaseAuth.setActiveAccount(options, account);
  await requireAuth(options);
  firebaseOperatorToken = await getAccessToken();
}

async function listCollectionIds(client, parentResource) {
  const ids = [];
  let pageToken;
  do {
    const response = await boundedFirestoreRequest(client.post(`/v1/${parentResource}:listCollectionIds`, {
      pageSize: 1_000,
      ...(pageToken ? { pageToken } : {}),
    }));
    firestoreRequestCount += 1;
    ids.push(...(response.body.collectionIds ?? []));
    pageToken = response.body.nextPageToken;
  } while (pageToken);
  return [...new Set(ids)].sort();
}

async function listDocuments(client, parentResource, collectionId) {
  const documents = [];
  const startedAt = Date.now();
  let pageCount = 0;
  let pageToken;
  do {
    if (Date.now() - startedAt > 10 * 60_000) {
      throw Object.assign(new Error('Firestore collection scan exceeded its bound'), { code: 'FIRESTORE_COLLECTION_TIMEOUT' });
    }
    const response = await boundedFirestoreRequest(client.get(`/v1/${parentResource}/${encodeURIComponent(collectionId)}`, {
      queryParams: { pageSize: 1_000, showMissing: 'true', ...(pageToken ? { pageToken } : {}) },
    }));
    firestoreRequestCount += 1;
    documents.push(...(response.body.documents ?? []));
    pageCount += 1;
    if (pageCount % 10 === 0) {
      process.stderr.write(`${JSON.stringify({ progress: 'firestore_collection_pages', pageCount, documentsInCollection: documents.length, firestoreRequestCount })}\n`);
    }
    pageToken = response.body.nextPageToken;
  } while (pageToken);
  return documents.sort((a, b) => a.name.localeCompare(b.name));
}

async function copyFirestore(migrationRunId, target) {
  activeStage = 'firestore_copy';
  const client = new Client({ urlPrefix: 'https://firestore.googleapis.com', auth: true });
  const rootResource = `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
  const writer = new JsonBatchWriter('firestore', migrationRunId, target);
  let parents = [{ parentResource: rootResource, parentPath: '' }];
  const documentDigests = [];
  const collectionPatternCounts = new Map();
  const churchIds = new Set();
  let documentCount = 0;
  let parentCount = 0;
  let depth = 0;

  while (parents.length > 0) {
    const nested = await mapWithConcurrency(parents, FIRESTORE_PARENT_CONCURRENCY, async ({ parentResource, parentPath }) => {
      const collectionIds = await listCollectionIds(client, parentResource);
      const byCollection = await mapWithConcurrency(collectionIds, FIRESTORE_COLLECTION_CONCURRENCY, async (collectionId) => {
        const collectionPath = parentPath ? `${parentPath}/${collectionId}` : collectionId;
        const documents = await listDocuments(client, parentResource, collectionId);
        for (const document of documents) {
          if (!document.createTime && !document.updateTime) continue;
          const documentPath = document.name.slice(rootResource.length + 1);
          const documentId = documentPath.split('/').at(-1);
          const fields = document.fields ?? {};
          const churchId = churchIdForDocument(documentPath, fields);
          const sourceChecksum = digest({
            documentPath,
            documentId,
            collectionPath,
            createTime: document.createTime ?? null,
            updateTime: document.updateTime ?? null,
            fields,
          });
          await writer.add({
            document_path: documentPath,
            collection_path: collectionPath,
            document_id: documentId,
            church_id: churchId,
            payload: fields,
            source_created_at: document.createTime ?? null,
            source_updated_at: document.updateTime ?? null,
            source_checksum: sourceChecksum,
          });
          documentDigests.push(sourceChecksum);
          collectionPatternCounts.set(pathPattern(collectionPath), (collectionPatternCounts.get(pathPattern(collectionPath)) ?? 0) + 1);
          if (churchId) churchIds.add(churchId);
          documentCount += 1;
        }
        return documents.map((document) => ({
          parentResource: document.name,
          parentPath: document.name.slice(rootResource.length + 1),
        }));
      });
      return byCollection.flat();
    });
    parentCount += parents.length;
    parents = nested.flat();
    process.stderr.write(`${JSON.stringify({ progress: 'firestore_copy', depth, parentCount, documentCount, nextParentCount: parents.length, firestoreRequestCount })}\n`);
    depth += 1;
  }
  await writer.flush();
  return {
    documentCount,
    checksumSha256: digestList(documentDigests),
    churchBoundaryCount: churchIds.size,
    collectionPatternCounts: Object.fromEntries([...collectionPatternCounts.entries()].sort(([a], [b]) => a.localeCompare(b))),
  };
}

async function loadStagedFirestoreIndex(migrationRunId, target) {
  activeStage = 'load_staged_firestore_index';
  const index = new Map();
  let cursor = null;
  while (true) {
    const rows = await runSupabaseQuery(`
select document_path, source_checksum
from migration_staging.firestore_documents
where migration_run_id = '${migrationRunId}'::uuid
  ${cursor === null ? '' : `and document_path > convert_from(decode('${Buffer.from(cursor, 'utf8').toString('base64')}','base64'),'utf8')`}
order by document_path
limit 5000;`, { target, json: true, maxStdoutBytes: 16 * 1024 * 1024 });
    if (!Array.isArray(rows)) {
      throw Object.assign(new Error('Staged Firestore index result was invalid'), { code: 'STAGED_INDEX_INVALID' });
    }
    for (const row of rows) index.set(row.document_path, row.source_checksum);
    process.stderr.write(`${JSON.stringify({ progress: 'load_staged_firestore_index', rows: index.size })}\n`);
    if (rows.length < 5000) break;
    cursor = rows.at(-1).document_path;
  }
  return index;
}

async function loadPublishedFirestoreIndex(target) {
  activeStage = 'load_published_firestore_index';
  const index = new Map();
  let cursor = null;
  while (true) {
    const rows = await runSupabaseQuery(`
select document_path, source_checksum
from public.sat_documents
where ${cursor === null ? 'true' : `document_path > convert_from(decode('${Buffer.from(cursor, 'utf8').toString('base64')}','base64'),'utf8')`}
order by document_path
limit 5000;`, { target, json: true, maxStdoutBytes: 16 * 1024 * 1024 });
    if (!Array.isArray(rows)) {
      throw Object.assign(new Error('Published Firestore index result was invalid'), { code: 'PUBLISHED_INDEX_INVALID' });
    }
    for (const row of rows) index.set(row.document_path, row.source_checksum);
    process.stderr.write(`${JSON.stringify({ progress: 'load_published_firestore_index', rows: index.size })}\n`);
    if (rows.length < 5000) break;
    cursor = rows.at(-1).document_path;
  }
  return index;
}

async function loadStagedCollectionPaths(migrationRunId, target) {
  activeStage = 'load_staged_collection_paths';
  if (target === 'edge') {
    const result = await runEdgeIngest({ operation: 'reference-paths', referenceRunId: migrationRunId });
    if (!Array.isArray(result.collectionPaths)) {
      throw Object.assign(new Error('Edge collection path result was invalid'), { code: 'EDGE_COLLECTION_PATHS_INVALID' });
    }
    return result.collectionPaths;
  }
  const rows = await runSupabaseQuery(`
select distinct collection_path
from migration_staging.firestore_documents
where migration_run_id = '${migrationRunId}'::uuid
order by collection_path;`, { target, json: true, maxStdoutBytes: 4 * 1024 * 1024 });
  if (!Array.isArray(rows)) {
    throw Object.assign(new Error('Staged collection path result was invalid'), { code: 'STAGED_COLLECTION_PATHS_INVALID' });
  }
  return rows.map((row) => row.collection_path);
}

async function loadEdgeFirestoreCheckpoint(migrationRunId) {
  activeStage = 'load_edge_firestore_checkpoint';
  const checkpoint = new Map();
  let afterDocumentPath = null;
  while (true) {
    const result = await runEdgeIngest({
      operation: 'checkpoint-page',
      migrationRunId,
      afterDocumentPath,
    });
    if (!Array.isArray(result.rows)) {
      throw Object.assign(new Error('Edge checkpoint page was invalid'), { code: 'EDGE_CHECKPOINT_INVALID' });
    }
    for (const row of result.rows) checkpoint.set(row.document_path, row.source_checksum);
    process.stderr.write(`${JSON.stringify({ progress: 'load_edge_firestore_checkpoint', rows: checkpoint.size })}\n`);
    if (result.rows.length < 1000) break;
    afterDocumentPath = result.rows.at(-1).document_path;
  }
  return checkpoint;
}

async function pruneEdgeFirestoreCheckpoint(migrationRunId, documentPaths) {
  let deletedRows = 0;
  const paths = [...documentPaths].sort();
  for (let offset = 0; offset < paths.length; offset += BATCH_ROWS) {
    const result = await runEdgeIngest({
      operation: 'prune-checkpoint',
      migrationRunId,
      documentPaths: paths.slice(offset, offset + BATCH_ROWS),
    });
    deletedRows += Number(result.deletedRows ?? 0);
  }
  return deletedRows;
}

async function publishChangedFirestoreDocuments(migrationRunId, documentPaths, target) {
  activeStage = 'publish_known_path_delta';
  let publishedDocuments = 0;
  const paths = [...documentPaths].sort();
  for (let offset = 0; offset < paths.length; offset += BATCH_ROWS) {
    const batch = paths.slice(offset, offset + BATCH_ROWS);
    await runSupabaseQuery(`
with changed_paths as (
  select jsonb_array_elements_text(${jsonbExpression(batch)}) as document_path
)
insert into public.sat_documents (
  document_path, collection_path, document_id, church_id, payload,
  source_created_at, source_updated_at, source_checksum, migrated_at, updated_at
)
select
  s.document_path, s.collection_path, s.document_id, s.church_id,
  sat_private.firestore_document_to_jsonb(s.payload), s.source_created_at,
  s.source_updated_at, s.source_checksum, now(), now()
from migration_staging.firestore_documents s
join changed_paths c using (document_path)
where s.migration_run_id = '${migrationRunId}'::uuid
on conflict (document_path) do update set
  collection_path = excluded.collection_path,
  document_id = excluded.document_id,
  church_id = excluded.church_id,
  payload = excluded.payload,
  source_created_at = excluded.source_created_at,
  source_updated_at = excluded.source_updated_at,
  source_checksum = excluded.source_checksum,
  migrated_at = now(),
  updated_at = now()
where public.sat_documents.source_checksum is distinct from excluded.source_checksum;`, { target });
    publishedDocuments += batch.length;
    process.stderr.write(`${JSON.stringify({ progress: 'publish_known_path_delta', publishedDocuments, changedDocuments: paths.length })}\n`);
  }
  return publishedDocuments;
}

async function copyTargetedFirestoreCompletion(migrationRunId, target) {
  activeStage = 'targeted_firestore_completion';
  const client = new Client({ urlPrefix: 'https://firestore.googleapis.com', auth: true });
  const rootResource = `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
  const stagedIndex = await loadStagedFirestoreIndex(migrationRunId, target);
  const churchParents = [...stagedIndex.keys()].filter((path) => /^churches\/[^/]+$/.test(path)).sort();
  const churchChatParents = [...stagedIndex.keys()]
    .filter((path) => /^churches\/[^/]+\/chatThreads\/[^/]+$/.test(path))
    .sort();
  const writer = new JsonBatchWriter('firestore', migrationRunId, target);
  let documentsScanned = 0;
  let documentsQueued = 0;

  async function scanKnownCollection(parentPath, collectionId) {
    const parentResource = `${rootResource}/${parentPath}`;
    const collectionPath = `${parentPath}/${collectionId}`;
    const documents = await listDocuments(client, parentResource, collectionId);
    for (const document of documents) {
      if (!document.createTime && !document.updateTime) continue;
      const documentPath = document.name.slice(rootResource.length + 1);
      const documentId = documentPath.split('/').at(-1);
      const fields = document.fields ?? {};
      const churchId = churchIdForDocument(documentPath, fields);
      const sourceChecksum = digest({
        documentPath,
        documentId,
        collectionPath,
        createTime: document.createTime ?? null,
        updateTime: document.updateTime ?? null,
        fields,
      });
      documentsScanned += 1;
      if (stagedIndex.get(documentPath) === sourceChecksum) continue;
      await writer.add({
        document_path: documentPath,
        collection_path: collectionPath,
        document_id: documentId,
        church_id: churchId,
        payload: fields,
        source_created_at: document.createTime ?? null,
        source_updated_at: document.updateTime ?? null,
        source_checksum: sourceChecksum,
      });
      stagedIndex.set(documentPath, sourceChecksum);
      documentsQueued += 1;
    }
  }

  await mapWithConcurrency(churchParents, FIRESTORE_PARENT_CONCURRENCY, (parentPath) =>
    scanKnownCollection(parentPath, 'prayers'));
  await mapWithConcurrency(churchChatParents, FIRESTORE_PARENT_CONCURRENCY, (parentPath) =>
    scanKnownCollection(parentPath, 'messages'));
  await writer.flush();
  process.stderr.write(`${JSON.stringify({
    progress: 'targeted_firestore_completion',
    churchParentCount: churchParents.length,
    churchChatParentCount: churchChatParents.length,
    documentsScanned,
    documentsQueued,
  })}\n`);
  return { churchParentCount: churchParents.length, churchChatParentCount: churchChatParents.length, documentsScanned, documentsQueued };
}

async function copyKnownPathFirestoreDelta(referenceRunId, migrationRunId, target) {
  activeStage = 'known_path_firestore_delta';
  const client = new Client({ urlPrefix: 'https://firestore.googleapis.com', auth: true });
  const rootResource = `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
  const referenceCollectionPaths = await loadStagedCollectionPaths(referenceRunId, target);
  const checkpointIndex = target === 'edge' ? await loadEdgeFirestoreCheckpoint(migrationRunId) : new Map();
  const writer = new JsonBatchWriter('firestore', migrationRunId, target);
  const stagedCollectionPaths = new Set(referenceCollectionPaths);
  const childCollectionsByParentPattern = new Map();

  for (const collectionPath of stagedCollectionPaths) {
    const segments = collectionPath.split('/');
    if (segments.length > 1) {
      const parentPattern = pathPattern(segments.slice(0, -1).join('/'));
      const childCollectionId = segments.at(-1);
      if (!childCollectionsByParentPattern.has(parentPattern)) childCollectionsByParentPattern.set(parentPattern, new Set());
      childCollectionsByParentPattern.get(parentPattern).add(childCollectionId);
    }
  }

  const rootCollectionPaths = await listCollectionIds(client, rootResource);
  const queue = [...new Set([...rootCollectionPaths, ...stagedCollectionPaths])].sort();
  const queuedCollectionPaths = new Set(queue);
  const scannedCollections = new Set();
  // A historical collection path can occasionally be reached through more than
  // one discovery route. Reconciliation is keyed by the canonical document
  // path, so report and hash the same unique set instead of raw traversal hits.
  const documentDigestsByPath = new Map();
  const churchIds = new Set();
  const collectionPatternCounts = new Map();
  const sourceDocumentPaths = new Set();
  let documentsScanned = 0;
  let documentsQueued = 0;

  while (queue.length > 0) {
    const collectionPath = queue.shift();
    queuedCollectionPaths.delete(collectionPath);
    if (scannedCollections.has(collectionPath)) continue;
    scannedCollections.add(collectionPath);
    const segments = collectionPath.split('/');
    const collectionId = segments.at(-1);
    const parentPath = segments.slice(0, -1).join('/');
    const parentResource = parentPath ? `${rootResource}/${parentPath}` : rootResource;
    const documents = await listDocuments(client, parentResource, collectionId);

    for (const document of documents) {
      if (!document.createTime && !document.updateTime) continue;
      const documentPath = document.name.slice(rootResource.length + 1);
      const documentId = documentPath.split('/').at(-1);
      const fields = document.fields ?? {};
      const churchId = churchIdForDocument(documentPath, fields);
      const sourceChecksum = digest({
        documentPath,
        documentId,
        collectionPath,
        createTime: document.createTime ?? null,
        updateTime: document.updateTime ?? null,
        fields,
      });
      documentsScanned += 1;
      sourceDocumentPaths.add(documentPath);
      if (checkpointIndex.get(documentPath) !== sourceChecksum) {
        await writer.add({
          document_path: documentPath,
          collection_path: collectionPath,
          document_id: documentId,
          church_id: churchId,
          payload: fields,
          source_created_at: document.createTime ?? null,
          source_updated_at: document.updateTime ?? null,
          source_checksum: sourceChecksum,
        });
        checkpointIndex.set(documentPath, sourceChecksum);
        documentsQueued += 1;
      }
      documentDigestsByPath.set(documentPath, sourceChecksum);
      if (churchId) churchIds.add(churchId);
      collectionPatternCounts.set(pathPattern(collectionPath), (collectionPatternCounts.get(pathPattern(collectionPath)) ?? 0) + 1);

      const documentPattern = pathPattern(documentPath);
      for (const childCollectionId of childCollectionsByParentPattern.get(documentPattern) ?? []) {
        const childCollectionPath = `${documentPath}/${childCollectionId}`;
        if (!scannedCollections.has(childCollectionPath) && !queuedCollectionPaths.has(childCollectionPath)) {
          queue.push(childCollectionPath);
          queuedCollectionPaths.add(childCollectionPath);
        }
      }
    }
    if (scannedCollections.size % 25 === 0) {
      process.stderr.write(`${JSON.stringify({ progress: 'known_path_delta', scannedCollections: scannedCollections.size, documentsScanned, documentsQueued, queuedCollections: queue.length })}\n`);
    }
  }
  await writer.flush();

  if (target === 'edge') {
    const staleCheckpointPaths = [...checkpointIndex.keys()].filter((documentPath) => !sourceDocumentPaths.has(documentPath));
    const prunedCheckpointDocuments = await pruneEdgeFirestoreCheckpoint(migrationRunId, staleCheckpointPaths);
    return {
      documentCount: documentDigestsByPath.size,
      checksumSha256: digestList([...documentDigestsByPath.values()]),
      churchBoundaryCount: churchIds.size,
      collectionPatternCounts: Object.fromEntries([...collectionPatternCounts.entries()].sort(([a], [b]) => a.localeCompare(b))),
      scannedCollections: scannedCollections.size,
      stagedCollectionPaths: stagedCollectionPaths.size,
      documentsScanned,
      documentsQueued,
      checkpointDocuments: checkpointIndex.size - prunedCheckpointDocuments,
      staleCheckpointDocuments: staleCheckpointPaths.length,
      prunedCheckpointDocuments,
      publicationPending: true,
      sourceModified: false,
    };
  }

  activeStage = 'publish_known_path_delta';
  await runSupabaseQuery(`
insert into public.sat_documents (
  document_path, collection_path, document_id, church_id, payload,
  source_created_at, source_updated_at, source_checksum, migrated_at, updated_at
)
select
  s.document_path, s.collection_path, s.document_id, s.church_id,
  sat_private.firestore_document_to_jsonb(s.payload), s.source_created_at,
  s.source_updated_at, s.source_checksum, now(), now()
from migration_staging.firestore_documents s
where s.migration_run_id = '${migrationRunId}'::uuid
on conflict (document_path) do update set
  collection_path = excluded.collection_path,
  document_id = excluded.document_id,
  church_id = excluded.church_id,
  payload = excluded.payload,
  source_created_at = excluded.source_created_at,
  source_updated_at = excluded.source_updated_at,
  source_checksum = excluded.source_checksum,
  migrated_at = now(),
  updated_at = now()
where public.sat_documents.source_checksum is distinct from excluded.source_checksum;`, { target });

  const comparisonRows = await runSupabaseQuery(`
select
  (select count(*)::int
   from migration_staging.firestore_documents old
   left join migration_staging.firestore_documents fresh
     on fresh.migration_run_id = '${migrationRunId}'::uuid
    and fresh.document_path = old.document_path
   where old.migration_run_id = '${referenceRunId}'::uuid
     and fresh.document_path is null) as source_missing_documents,
  (select count(*)::int
   from migration_staging.firestore_documents fresh
   left join public.sat_documents published using (document_path)
   where fresh.migration_run_id = '${migrationRunId}'::uuid
     and published.document_path is null) as source_only_documents,
  (select count(*)::int
   from public.sat_documents published
   left join migration_staging.firestore_documents fresh
     on fresh.migration_run_id = '${migrationRunId}'::uuid
    and fresh.document_path = published.document_path
   where fresh.document_path is null) as published_only_documents,
  (select count(*)::int
   from migration_staging.firestore_documents fresh
   join public.sat_documents published using (document_path)
   where fresh.migration_run_id = '${migrationRunId}'::uuid
     and published.source_checksum is distinct from fresh.source_checksum) as checksum_mismatches;`, { target, json: true });
  if (!Array.isArray(comparisonRows) || comparisonRows.length !== 1) {
    throw Object.assign(new Error('Published delta comparison was invalid'), { code: 'PUBLISHED_DELTA_INVALID' });
  }
  const sourceMissingDocuments = Number(comparisonRows[0].source_missing_documents);
  const sourceOnlyDocuments = Number(comparisonRows[0].source_only_documents);
  const publishedOnlyDocuments = Number(comparisonRows[0].published_only_documents);
  const checksumMismatches = Number(comparisonRows[0].checksum_mismatches);
  const exactPublishedMatch = sourceOnlyDocuments === 0 && publishedOnlyDocuments === 0 && checksumMismatches === 0;

  return {
    documentCount: documentDigestsByPath.size,
    checksumSha256: digestList([...documentDigestsByPath.values()]),
    churchBoundaryCount: churchIds.size,
    collectionPatternCounts: Object.fromEntries([...collectionPatternCounts.entries()].sort(([a], [b]) => a.localeCompare(b))),
    scannedCollections: scannedCollections.size,
    stagedCollectionPaths: stagedCollectionPaths.size,
    documentsScanned,
    documentsQueued,
    publishedDocuments: documentsScanned,
    sourceMissingDocuments,
    sourceOnlyDocuments,
    publishedOnlyDocuments,
    checksumMismatches,
    exactPublishedMatch,
    sourceModified: false,
  };
}

async function copyStorageManifest(migrationRunId, target) {
  activeStage = 'storage_manifest_copy';
  const client = new Client({ urlPrefix: 'https://storage.googleapis.com/storage/v1', auth: true });
  const writer = new JsonBatchWriter('storage', migrationRunId, target);
  const objectDigests = [];
  let objectCount = 0;
  let totalBytes = 0n;
  let pageToken;
  do {
    const response = await client.get(`/b/${encodeURIComponent(STORAGE_BUCKET)}/o`, {
      queryParams: { maxResults: 1_000, ...(pageToken ? { pageToken } : {}) },
    });
    for (const object of response.body.items ?? []) {
      const sourceChecksum = digest({
        name: object.name,
        generation: object.generation ?? null,
        size: object.size ?? '0',
        contentType: object.contentType ?? null,
        md5Hash: object.md5Hash ?? null,
        crc32c: object.crc32c ?? null,
        updated: object.updated ?? null,
      });
      await writer.add({
        source_bucket: STORAGE_BUCKET,
        source_path: object.name,
        size_bytes: object.size ?? '0',
        content_type: object.contentType ?? null,
        source_checksum: sourceChecksum,
        source_generation: object.generation ?? null,
        source_updated_at: object.updated ?? null,
        source_md5: object.md5Hash ?? null,
        source_crc32c: object.crc32c ?? null,
        source_metadata: object,
      });
      objectDigests.push(sourceChecksum);
      objectCount += 1;
      totalBytes += BigInt(object.size ?? '0');
    }
    pageToken = response.body.nextPageToken;
  } while (pageToken);
  await writer.flush();
  return { objectCount, totalBytes: totalBytes.toString(), checksumSha256: digestList(objectDigests) };
}

async function copyAuthInventory(migrationRunId, target) {
  activeStage = 'auth_identity_copy';
  const client = new Client({ urlPrefix: firebaseApi.identityOrigin(), auth: true });
  const writer = new JsonBatchWriter('auth', migrationRunId, target);
  const userDigests = [];
  const providerCounts = new Map();
  const roleClaimCounts = new Map();
  let offset = 0;
  let userCount = 0;
  let disabledCount = 0;
  let verifiedCount = 0;
  let passwordBackedCount = 0;
  while (true) {
    const response = await client.post(`/v1/projects/${PROJECT_ID}/accounts:query`, {
      offset: String(offset),
      limit: String(PAGE_SIZE),
    });
    const users = response.body.userInfo ?? [];
    const recordsCount = Number(response.body.recordsCount ?? users.length);
    if (recordsCount === 0) break;
    for (const user of users) {
      const providers = providerIds(user);
      const roleState = customRoleState(user.customAttributes);
      const sourceChecksum = digest({
        uid: user.localId,
        email: user.email ?? null,
        emailVerified: user.emailVerified === true,
        disabled: user.disabled === true,
        providers,
        createdAt: user.createdAt ?? null,
        lastLoginAt: user.lastLoginAt ?? null,
        roleState,
      });
      await writer.add({
        firebase_uid: user.localId,
        email: user.email ?? null,
        email_verified: user.emailVerified === true,
        disabled: user.disabled === true,
        provider_ids: providers,
        source_created_at: timestampFromMillis(user.createdAt),
        source_last_sign_in_at: timestampFromMillis(user.lastLoginAt),
        source_checksum: sourceChecksum,
        source_tenant_id: user.tenantId ?? null,
        source_last_refresh_at: user.lastRefreshAt ?? null,
        source_profile: {
          displayName: user.displayName ?? null,
          phoneNumber: user.phoneNumber ?? null,
          photoUrl: user.photoUrl ?? null,
        },
        source_custom_claims: parsedCustomClaims(user.customAttributes),
        role_claim_state: roleState,
      });
      for (const provider of providers) providerCounts.set(provider, (providerCounts.get(provider) ?? 0) + 1);
      roleClaimCounts.set(roleState, (roleClaimCounts.get(roleState) ?? 0) + 1);
      if (user.disabled === true) disabledCount += 1;
      if (user.emailVerified === true) verifiedCount += 1;
      if (typeof user.passwordHash === 'string' && user.passwordHash.length > 0) passwordBackedCount += 1;
      userDigests.push(sourceChecksum);
      userCount += 1;
    }
    offset += recordsCount;
  }
  await writer.flush();
  return {
    userCount,
    disabledCount,
    verifiedCount,
    passwordBackedCount,
    providerCounts: Object.fromEntries([...providerCounts.entries()].sort(([a], [b]) => a.localeCompare(b))),
    roleClaimCounts: Object.fromEntries([...roleClaimCounts.entries()].sort(([a], [b]) => a.localeCompare(b))),
    checksumSha256: digestList(userDigests),
  };
}

function aggregateChecksumSql(tableName, runId) {
  return `encode(extensions.digest(convert_to(
    case when count(*) = 0 then '[]'
      else '["' || string_agg(source_checksum, '","' order by source_checksum) || '"]'
    end, 'UTF8'), 'sha256'), 'hex')`;
}

async function reconcileTarget(migrationRunId, target) {
  activeStage = 'target_reconciliation';
  const rows = await runSupabaseQuery(`
select
  (select count(*)::int from migration_staging.firestore_documents where migration_run_id = '${migrationRunId}'::uuid) as firestore_count,
  (select ${aggregateChecksumSql('firestore_documents', migrationRunId)} from migration_staging.firestore_documents where migration_run_id = '${migrationRunId}'::uuid) as firestore_checksum,
  (select count(*)::int from migration_staging.storage_objects where migration_run_id = '${migrationRunId}'::uuid) as storage_count,
  (select ${aggregateChecksumSql('storage_objects', migrationRunId)} from migration_staging.storage_objects where migration_run_id = '${migrationRunId}'::uuid) as storage_checksum,
  (select count(*)::int from migration_staging.auth_identity_map where migration_run_id = '${migrationRunId}'::uuid) as auth_count,
  (select ${aggregateChecksumSql('auth_identity_map', migrationRunId)} from migration_staging.auth_identity_map where migration_run_id = '${migrationRunId}'::uuid) as auth_checksum;
`, { target, json: true });
  if (!Array.isArray(rows) || rows.length !== 1) throw Object.assign(new Error('Unexpected reconciliation result'), { code: 'RECONCILIATION_RESULT_INVALID' });
  return rows[0];
}

async function recordRunStart(migrationRunId, target, startedAt) {
  await runSupabaseQuery(`
insert into migration_staging.migration_runs (id, source_project_id, source_snapshot_at, status, notes)
values ('${migrationRunId}'::uuid, '${PROJECT_ID}', '${startedAt}'::timestamptz, 'exported',
  'Read-only Firebase scan copied into private staging tables; no source mutation and no app cutover.')
on conflict (id) do nothing;`, { target });
}

async function prepareResumeRun(migrationRunId, target) {
  const rows = await runSupabaseQuery(`
select source_project_id, status
from migration_staging.migration_runs
where id = '${migrationRunId}'::uuid;`, { target, json: true });
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].source_project_id !== PROJECT_ID) {
    throw Object.assign(new Error('Resume run does not match the expected source project'), { code: 'RESUME_RUN_INVALID' });
  }
  if (!['exported', 'failed'].includes(rows[0].status)) {
    throw Object.assign(new Error('Resume run is not resumable'), { code: 'RESUME_RUN_NOT_RESUMABLE' });
  }
  await runSupabaseQuery(`
update migration_staging.migration_runs
set status = 'exported', completed_at = null,
    notes = 'Resumed read-only Firebase scan into the same private staging run after a local transport interruption.'
where id = '${migrationRunId}'::uuid;`, { target });
}

async function recordRunFailure(migrationRunId, target) {
  await runSupabaseQuery(`
update migration_staging.migration_runs
set status = 'failed', completed_at = now(), notes = 'Staging copy failed; inspect sanitized local execution logs.'
where id = '${migrationRunId}'::uuid;`, { target });
}

async function recordRunResult(migrationRunId, target, source, targetResult, passed, baselineMatch) {
  const sourceCounts = {
    firestore: source.firestore.documentCount,
    storage: source.storage.objectCount,
    storageBytes: source.storage.totalBytes,
    auth: source.auth.userCount,
  };
  const targetCounts = {
    firestore: Number(targetResult.firestore_count),
    storage: Number(targetResult.storage_count),
    auth: Number(targetResult.auth_count),
  };
  const checksums = {
    source: {
      firestore: source.firestore.checksumSha256,
      storage: source.storage.checksumSha256,
      auth: source.auth.checksumSha256,
    },
    target: {
      firestore: targetResult.firestore_checksum,
      storage: targetResult.storage_checksum,
      auth: targetResult.auth_checksum,
    },
    baselineMatch,
  };
  const validations = [
    ['firestore_count_and_hash', sourceCounts.firestore, targetCounts.firestore, source.firestore.checksumSha256, targetResult.firestore_checksum],
    ['storage_manifest_count_and_hash', sourceCounts.storage, targetCounts.storage, source.storage.checksumSha256, targetResult.storage_checksum],
    ['auth_identity_count_and_hash', sourceCounts.auth, targetCounts.auth, source.auth.checksumSha256, targetResult.auth_checksum],
  ].map(([checkName, expectedCount, actualCount, expectedHash, actualHash]) => ({
    check_name: checkName,
    scope: 'private_staging_copy',
    expected: { count: expectedCount, checksumSha256: expectedHash },
    actual: { count: actualCount, checksumSha256: actualHash },
    passed: expectedCount === actualCount && expectedHash === actualHash,
  }));
  await runSupabaseQuery(`
update migration_staging.migration_runs
set status = '${passed && baselineMatch ? 'validated' : 'imported'}',
    source_counts = ${jsonbExpression(sourceCounts)},
    target_counts = ${jsonbExpression(targetCounts)},
    checksums = ${jsonbExpression(checksums)},
    completed_at = now()
where id = '${migrationRunId}'::uuid;

insert into migration_staging.validation_results
  (migration_run_id, check_name, scope, expected, actual, passed, details)
select '${migrationRunId}'::uuid, x.check_name, x.scope, x.expected, x.actual, x.passed,
  'Count and canonical SHA-256 reconciliation; no personal data in validation output.'
from jsonb_to_recordset(${jsonbExpression(validations)}) as x(
  check_name text, scope text, expected jsonb, actual jsonb, passed boolean
);`, { target });
}

async function loadBaseline(path) {
  if (!path) return null;
  const parsed = JSON.parse(await readFile(path, 'utf8'));
  return {
    firestoreCount: parsed?.firestore?.documentCount,
    firestoreChecksum: parsed?.firestore?.checksumSha256,
    storageCount: parsed?.storage?.objectCount,
    storageChecksum: parsed?.storage?.checksumSha256,
    authCount: parsed?.auth?.userCount,
    authChecksum: parsed?.auth?.checksumSha256,
  };
}

function baselineMatches(baseline, source) {
  if (!baseline) return true;
  return (
    baseline.firestoreCount === source.firestore.documentCount &&
    baseline.firestoreChecksum === source.firestore.checksumSha256 &&
    baseline.storageCount === source.storage.objectCount &&
    baseline.storageChecksum === source.storage.checksumSha256 &&
    baseline.authCount === source.auth.userCount &&
    baseline.authChecksum === source.auth.checksumSha256
  );
}

async function runSelfTest() {
  activeStage = 'local_self_test';
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  await recordRunStart(runId, 'local', startedAt);
  const firestoreWriter = new JsonBatchWriter('firestore', runId, 'local');
  const authWriter = new JsonBatchWriter('auth', runId, 'local');
  const storageWriter = new JsonBatchWriter('storage', runId, 'local');
  const firestoreChecksum = digest({ fixture: 'firestore' });
  const authChecksum = digest({ fixture: 'auth' });
  const storageChecksum = digest({ fixture: 'storage' });
  await firestoreWriter.add({ document_path: 'churches/test/members/test', collection_path: 'churches/test/members', document_id: 'test', church_id: 'test', payload: { fixture: { booleanValue: true } }, source_created_at: startedAt, source_updated_at: startedAt, source_checksum: firestoreChecksum });
  await authWriter.add({ firebase_uid: 'fixture-uid', email: null, email_verified: false, disabled: false, provider_ids: ['password'], source_created_at: startedAt, source_last_sign_in_at: null, source_checksum: authChecksum, source_tenant_id: null, source_last_refresh_at: null, source_profile: {}, source_custom_claims: {}, role_claim_state: 'missing' });
  await storageWriter.add({ source_bucket: 'fixture-bucket', source_path: 'fixture/path', size_bytes: '1', content_type: 'application/octet-stream', source_checksum: storageChecksum, source_generation: '1', source_updated_at: startedAt, source_md5: null, source_crc32c: null, source_metadata: { fixture: true } });
  await Promise.all([firestoreWriter.flush(), authWriter.flush(), storageWriter.flush()]);
  const targetResult = await reconcileTarget(runId, 'local');
  const passed = Number(targetResult.firestore_count) === 1 && Number(targetResult.auth_count) === 1 && Number(targetResult.storage_count) === 1;
  await runSupabaseQuery(`delete from migration_staging.migration_runs where id = '${runId}'::uuid;`, { target: 'local' });
  if (!passed) throw Object.assign(new Error('Local staging self-test failed'), { code: 'LOCAL_SELF_TEST_FAILED' });
  process.stdout.write(`${JSON.stringify({ ok: true, mode: 'local-self-test', counts: { firestore: 1, storage: 1, auth: 1 }, cleanupVerified: true })}\n`);
}

async function runLinkedImport(expectedSummaryPath, resumeRunId) {
  activeStage = 'linked_import_start';
  process.stderr.write(`${JSON.stringify({
    progress: 'low_resource_configuration',
    batchRows: BATCH_ROWS,
    batchBytes: BATCH_BYTES,
    parentConcurrency: FIRESTORE_PARENT_CONCURRENCY,
    collectionConcurrency: FIRESTORE_COLLECTION_CONCURRENCY,
    interBatchDelayMs: INTER_BATCH_DELAY_MS,
  })}\n`);
  const migrationRunId = resumeRunId ?? randomUUID();
  const startedAt = new Date().toISOString();
  const baseline = await loadBaseline(expectedSummaryPath);
  if (resumeRunId) await prepareResumeRun(migrationRunId, 'linked');
  else await recordRunStart(migrationRunId, 'linked', startedAt);
  try {
    await authenticateFirebase();
    const firestore = await copyFirestore(migrationRunId, 'linked');
    const storage = await copyStorageManifest(migrationRunId, 'linked');
    const auth = await copyAuthInventory(migrationRunId, 'linked');
    const source = { firestore, storage, auth };
    const targetResult = await reconcileTarget(migrationRunId, 'linked');
    const passed = (
      firestore.documentCount === Number(targetResult.firestore_count) &&
      firestore.checksumSha256 === targetResult.firestore_checksum &&
      storage.objectCount === Number(targetResult.storage_count) &&
      storage.checksumSha256 === targetResult.storage_checksum &&
      auth.userCount === Number(targetResult.auth_count) &&
      auth.checksumSha256 === targetResult.auth_checksum
    );
    const baselineMatch = baselineMatches(baseline, source);
    await recordRunResult(migrationRunId, 'linked', source, targetResult, passed, baselineMatch);
    process.stdout.write(`${JSON.stringify({
      ok: passed,
      mode: 'linked-private-staging-copy',
      migrationRunId,
      startedAt,
      completedAt: new Date().toISOString(),
      baselineMatch,
      source,
      target: {
        firestore: { count: Number(targetResult.firestore_count), checksumSha256: targetResult.firestore_checksum },
        storage: { count: Number(targetResult.storage_count), checksumSha256: targetResult.storage_checksum },
        auth: { count: Number(targetResult.auth_count), checksumSha256: targetResult.auth_checksum },
      },
      sourceModified: false,
      storageBytesCopied: false,
    }, null, 2)}\n`);
    if (!passed) process.exitCode = 2;
  } catch (error) {
    try {
      await recordRunFailure(migrationRunId, 'linked');
    } catch {
      // Preserve the original sanitized failure code.
    }
    throw error;
  }
}

async function runTargetedLinkedCompletion(expectedSummaryPath, resumeRunId) {
  activeStage = 'targeted_linked_completion_start';
  if (!resumeRunId || !expectedSummaryPath) {
    throw Object.assign(new Error('Targeted completion requires a resume run and baseline summary'), { code: 'TARGETED_ARGUMENTS_REQUIRED' });
  }
  const baselineDocument = JSON.parse(await readFile(expectedSummaryPath, 'utf8'));
  const baseline = await loadBaseline(expectedSummaryPath);
  const startedAt = new Date().toISOString();
  await prepareResumeRun(resumeRunId, 'linked');
  try {
    await authenticateFirebase();
    const targetedFirestore = await copyTargetedFirestoreCompletion(resumeRunId, 'linked');
    const storage = await copyStorageManifest(resumeRunId, 'linked');
    const auth = await copyAuthInventory(resumeRunId, 'linked');
    const source = {
      firestore: {
        documentCount: baselineDocument.firestore.documentCount,
        checksumSha256: baselineDocument.firestore.checksumSha256,
        churchBoundaryCount: baselineDocument.firestore.churchBoundaryCount,
        collectionPatternCounts: baselineDocument.firestore.collectionPatternCounts,
      },
      storage,
      auth,
    };
    const targetResult = await reconcileTarget(resumeRunId, 'linked');
    const passed = (
      source.firestore.documentCount === Number(targetResult.firestore_count) &&
      source.firestore.checksumSha256 === targetResult.firestore_checksum &&
      storage.objectCount === Number(targetResult.storage_count) &&
      storage.checksumSha256 === targetResult.storage_checksum &&
      auth.userCount === Number(targetResult.auth_count) &&
      auth.checksumSha256 === targetResult.auth_checksum
    );
    const baselineMatch = baselineMatches(baseline, source) && passed;
    await recordRunResult(resumeRunId, 'linked', source, targetResult, passed, baselineMatch);
    process.stdout.write(`${JSON.stringify({
      ok: passed,
      mode: 'linked-private-staging-targeted-completion',
      migrationRunId: resumeRunId,
      startedAt,
      completedAt: new Date().toISOString(),
      baselineMatch,
      targetedFirestore,
      source: {
        firestore: { documentCount: source.firestore.documentCount, checksumSha256: source.firestore.checksumSha256 },
        storage,
        auth,
      },
      target: {
        firestore: { count: Number(targetResult.firestore_count), checksumSha256: targetResult.firestore_checksum },
        storage: { count: Number(targetResult.storage_count), checksumSha256: targetResult.storage_checksum },
        auth: { count: Number(targetResult.auth_count), checksumSha256: targetResult.auth_checksum },
      },
      sourceModified: false,
      storageBytesCopied: false,
    }, null, 2)}\n`);
    if (!passed) process.exitCode = 2;
  } catch (error) {
    try {
      await recordRunFailure(resumeRunId, 'linked');
    } catch {
      // Preserve the original sanitized failure code.
    }
    throw error;
  }
}

async function runKnownPathLinkedDelta(resumeRunId, edgeIngest, requestedMigrationRunId) {
  if (!resumeRunId) {
    throw Object.assign(new Error('Known-path delta requires an existing migration run'), { code: 'DELTA_RUN_REQUIRED' });
  }
  const migrationRunId = requestedMigrationRunId ?? randomUUID();
  const startedAt = new Date().toISOString();
  if (edgeIngest && !requestedMigrationRunId) {
    throw Object.assign(new Error('Edge ingest requires a pre-created migration run'), { code: 'EDGE_RUN_REQUIRED' });
  }
  if (!edgeIngest) await recordRunStart(migrationRunId, 'linked', startedAt);
  try {
    await authenticateFirebase();
    const target = edgeIngest ? 'edge' : 'linked';
    const firestore = await copyKnownPathFirestoreDelta(resumeRunId, migrationRunId, target);
    const storage = await copyStorageManifest(migrationRunId, target);
    const auth = await copyAuthInventory(migrationRunId, target);
    const source = { firestore, storage, auth };
    if (edgeIngest) {
      process.stdout.write(`${JSON.stringify({
        ok: true,
        mode: 'edge-final-delta-staging',
        referenceRunId: resumeRunId,
        migrationRunId,
        startedAt,
        completedAt: new Date().toISOString(),
        source,
        sourceModified: false,
        publicationPending: true,
        storageBytesCopied: false,
      }, null, 2)}\n`);
      return;
    }
    const targetResult = await reconcileTarget(migrationRunId, 'linked');
    const stagingMatch = (
      firestore.documentCount === Number(targetResult.firestore_count) &&
      firestore.checksumSha256 === targetResult.firestore_checksum &&
      storage.objectCount === Number(targetResult.storage_count) &&
      storage.checksumSha256 === targetResult.storage_checksum &&
      auth.userCount === Number(targetResult.auth_count) &&
      auth.checksumSha256 === targetResult.auth_checksum
    );
    const passed = stagingMatch && firestore.exactPublishedMatch;
    await recordRunResult(migrationRunId, 'linked', source, targetResult, passed, true);
    process.stdout.write(`${JSON.stringify({
      ok: passed,
      mode: 'linked-final-delta-snapshot',
      referenceRunId: resumeRunId,
      migrationRunId,
      startedAt,
      completedAt: new Date().toISOString(),
      stagingMatch,
      source: { firestore, storage, auth },
      target: {
        firestore: { count: Number(targetResult.firestore_count), checksumSha256: targetResult.firestore_checksum },
        storage: { count: Number(targetResult.storage_count), checksumSha256: targetResult.storage_checksum },
        auth: { count: Number(targetResult.auth_count), checksumSha256: targetResult.auth_checksum },
      },
      sourceModified: false,
      storageBytesCopied: false,
    }, null, 2)}\n`);
    if (!passed) process.exitCode = 2;
  } catch (error) {
    if (!edgeIngest) {
      try {
        await recordRunFailure(migrationRunId, 'linked');
      } catch {
        // Preserve the original sanitized failure code.
      }
    }
    throw error;
  }
}

function parseArguments() {
  const args = new Set(process.argv.slice(2));
  const expectedSummaryArg = process.argv.slice(2).find((arg) => arg.startsWith('--expected-summary='));
  const resumeRunArg = process.argv.slice(2).find((arg) => arg.startsWith('--resume-run='));
  const deltaRunArg = process.argv.slice(2).find((arg) => arg.startsWith('--delta-run='));
  return {
    selfTest: args.has('--self-test'),
    linkedImport: args.has('--confirm-linked-staging-copy'),
    expectedSummaryPath: expectedSummaryArg?.slice('--expected-summary='.length) ?? null,
    resumeRunId: resumeRunArg?.slice('--resume-run='.length) ?? null,
    deltaRunId: deltaRunArg?.slice('--delta-run='.length) ?? null,
    targetedCompletion: args.has('--targeted-completion'),
    knownPathDelta: args.has('--known-path-delta'),
    edgeIngest: args.has('--edge-ingest'),
  };
}

async function main() {
  const args = parseArguments();
  if (args.selfTest && !args.linkedImport) {
    await runSelfTest();
    return;
  }
  if (args.linkedImport && !args.selfTest) {
    if (args.knownPathDelta) {
      await runKnownPathLinkedDelta(args.resumeRunId, args.edgeIngest, args.deltaRunId);
      return;
    }
    if (args.targetedCompletion) {
      await runTargetedLinkedCompletion(args.expectedSummaryPath, args.resumeRunId);
      return;
    }
    await runLinkedImport(args.expectedSummaryPath, args.resumeRunId);
    return;
  }
  throw Object.assign(new Error('Choose exactly one explicit mode'), { code: 'MODE_REQUIRED' });
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    ok: false,
    error: {
      stage: activeStage,
      name: error?.name ?? 'Error',
      code: error?.code ?? null,
      exitCode: error?.exitCode ?? null,
    },
  })}\n`);
  process.exitCode = 1;
});
