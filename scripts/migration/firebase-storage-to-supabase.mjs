import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, realpathSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const require = createRequire(import.meta.url);
const firebaseAuth = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client, getAccessToken } = require('firebase-tools/lib/apiv2');

const PROJECT_ID = 'sat-mobile-de6f1';
const SOURCE_BUCKET = 'sat-mobile-de6f1.firebasestorage.app';
const IS_PRODUCTION_BUCKET_COPY = process.argv.includes('--production-bucket-copy');
const TARGET_BUCKET = IS_PRODUCTION_BUCKET_COPY ? 'sat-mobile-media' : 'firebase-migration-staging';
const STORAGE_VALIDATION_NAME = IS_PRODUCTION_BUCKET_COPY
  ? 'storage_object_bytes_sha256_production'
  : 'storage_object_bytes_sha256';
const migrationRunArgument = process.argv.find((argument) => argument.startsWith('--migration-run='));
const MIGRATION_RUN_ID = migrationRunArgument?.slice('--migration-run='.length)
  ?? '895c54f0-d4ae-4b48-8ba9-5962c0413ec9';
const STATUS_BATCH_SIZE = 10;
const USE_EDGE_TRANSFER = process.argv.includes('--edge-transfer');
const EDGE_INGEST_URL = 'https://ftbsocbwxbfqejapdthj.supabase.co/functions/v1/sat-migration-ingest';
let activeStage = 'startup';
let firebaseOperatorToken = null;

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(MIGRATION_RUN_ID)) {
  throw Object.assign(new Error('Migration run ID is invalid'), { code: 'INVALID_MIGRATION_RUN_ID' });
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
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

function directSupabaseBinary() {
  const packageDirectory = realpathSync(resolve(process.cwd(), 'node_modules', 'supabase'));
  return resolve(packageDirectory, '..', '@supabase', 'cli-windows-x64', 'bin', 'supabase.exe');
}

async function runProcess(executable, args, { timeoutMs = 600_000, stdin = null, json = false, maxStdoutBytes = 8_000_000 } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(executable, args, {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      windowsHide: true,
      stdio: [stdin === null ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let stdinFailed = false;
    let timedOut = false;
    let settled = false;
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      callback();
    };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      if (stdout.length < maxStdoutBytes) stdout += chunk;
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 64_000) stderr += chunk;
    });
    if (child.stdin) child.stdin.on('error', () => { stdinFailed = true; });
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.on('error', () => {
      clearTimeout(timeout);
      settle(() => rejectPromise(Object.assign(new Error('Child process could not start'), { code: 'PROCESS_START_FAILED' })));
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0 || stdinFailed || timedOut) {
        settle(() => rejectPromise(Object.assign(new Error('Child process failed'), {
          code: timedOut ? 'PROCESS_TIMEOUT' : stdinFailed ? 'PROCESS_STDIN_CLOSED' : 'PROCESS_FAILED',
          exitCode: code,
          diagnostic: stderr,
        })));
        return;
      }
      if (!json) {
        settle(() => resolvePromise(null));
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        settle(() => resolvePromise(parsed));
      } catch {
        settle(() => rejectPromise(Object.assign(new Error('Child result was invalid'), { code: 'PROCESS_RESULT_INVALID' })));
      }
    });
    if (child.stdin) child.stdin.end(stdin);
  });
}

async function runSupabaseSql(sql, { json = false, maxStdoutBytes } = {}) {
  return runProcess(directSupabaseBinary(), [
    '--agent', 'no', '--output-format', json ? 'json' : 'text',
    'db', 'query', '--linked',
  ], { stdin: sql, json, timeoutMs: 180_000, maxStdoutBytes });
}

async function runSupabaseStorageCopy(source, destination, { contentType, cacheControl } = {}) {
  const args = [
    '--agent', 'no', '--experimental', '--output-format', 'text',
    'storage', 'cp', '--linked', '--jobs', '1',
    '--content-type', contentType || 'application/octet-stream',
    '--cache-control', cacheControl || 'max-age=3600',
    source, destination,
  ];
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await runProcess(directSupabaseBinary(), args, { timeoutMs: 600_000 });
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 3) break;
      process.stderr.write(`${JSON.stringify({ progress: 'storage_cli_retry', attempt })}\n`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 1_000));
    }
  }
  const safeDiagnostic = (lastError?.diagnostic ?? '')
    .replaceAll(source, '<local-temporary-file>')
    .replaceAll(destination, 'ss:///<private-destination>')
    .replace(/(authorization|token|key)[:=]\s*\S+/gi, '$1=<redacted>')
    .slice(0, 600);
  throw Object.assign(lastError, { safeDiagnostic });
}

async function runEdgeRequest(body) {
  if (!firebaseOperatorToken) throw Object.assign(new Error('Firebase operator token unavailable'), { code: 'NO_FIREBASE_OPERATOR_TOKEN' });
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch(EDGE_INGEST_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${firebaseOperatorToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => null);
      if (response.ok && result?.ok === true) return result;
    } catch {
      // Retry with a fresh bounded request.
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < 3) await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 1_000));
  }
  throw Object.assign(new Error('Migration edge request failed'), { code: 'EDGE_REQUEST_FAILED' });
}

async function loadEdgeStorageCheckpoint() {
  const checkpoint = new Map();
  let afterSourcePath = null;
  while (true) {
    const result = await runEdgeRequest({
      operation: 'storage-checkpoint-page',
      migrationRunId: MIGRATION_RUN_ID,
      afterSourcePath,
    });
    if (!Array.isArray(result.rows)) throw Object.assign(new Error('Storage checkpoint page was invalid'), { code: 'STORAGE_CHECKPOINT_INVALID' });
    for (const row of result.rows) checkpoint.set(row.source_path, row);
    if (result.rows.length < 1000) break;
    afterSourcePath = result.rows.at(-1).source_path;
  }
  return checkpoint;
}

async function uploadSupabaseObjectViaSignedUrl(sourcePath, object, contentType, cacheControl) {
  const signed = await runEdgeRequest({ operation: 'storage-upload-url', path: object.name });
  const response = await fetch(signed.signedUrl, {
    method: 'PUT',
    headers: {
      'content-type': contentType || 'application/octet-stream',
      'cache-control': cacheControl || 'max-age=3600',
      'x-upsert': 'true',
    },
    body: createReadStream(sourcePath),
    duplex: 'half',
  });
  if (!response.ok) throw Object.assign(new Error('Signed Supabase upload failed'), { code: 'SIGNED_UPLOAD_FAILED', status: response.status });
}

async function downloadSupabaseObjectViaSignedUrl(object, destinationPath) {
  const signed = await runEdgeRequest({ operation: 'storage-download-url', path: object.name });
  const response = await fetch(signed.signedUrl);
  if (!response.ok || !response.body) {
    throw Object.assign(new Error('Signed Supabase download failed'), { code: 'SIGNED_DOWNLOAD_FAILED', status: response.status });
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destinationPath, { flags: 'wx' }));
}

async function authenticateFirebase() {
  const account = firebaseAuth.getProjectDefaultAccount(process.cwd());
  if (!account) throw Object.assign(new Error('Firebase CLI account unavailable'), { code: 'NO_FIREBASE_ACCOUNT' });
  const options = { project: PROJECT_ID, projectRoot: process.cwd(), nonInteractive: true };
  firebaseAuth.setActiveAccount(options, account);
  await requireAuth(options);
  firebaseOperatorToken = await getAccessToken();
}

async function listSourceObjects() {
  const client = new Client({ urlPrefix: 'https://storage.googleapis.com/storage/v1', auth: true });
  const objects = [];
  let pageToken;
  do {
    const response = await client.get(`/b/${encodeURIComponent(SOURCE_BUCKET)}/o`, {
      queryParams: { maxResults: 1_000, ...(pageToken ? { pageToken } : {}) },
    });
    objects.push(...(response.body.items ?? []));
    pageToken = response.body.nextPageToken;
  } while (pageToken);
  return objects.sort((a, b) => a.name.localeCompare(b.name));
}

async function downloadFirebaseObject(object, destinationPath) {
  const mediaUrl = `https://storage.googleapis.com/download/storage/v1/b/${encodeURIComponent(SOURCE_BUCKET)}/o/${encodeURIComponent(object.name)}?alt=media&generation=${encodeURIComponent(object.generation ?? '')}`;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const token = await getAccessToken();
    const response = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (response.ok && response.body) {
      await pipeline(Readable.fromWeb(response.body), createWriteStream(destinationPath, { flags: 'wx' }));
      return;
    }
    if (response.status !== 401 || attempt === 2) {
      throw Object.assign(new Error('Firebase Storage download failed'), { code: 'FIREBASE_STORAGE_DOWNLOAD', status: response.status });
    }
  }
}

async function hashFile(path) {
  const sha256 = createHash('sha256');
  const md5 = createHash('md5');
  let size = 0;
  await new Promise((resolvePromise, rejectPromise) => {
    const stream = createReadStream(path);
    stream.on('data', (chunk) => {
      size += chunk.length;
      sha256.update(chunk);
      md5.update(chunk);
    });
    stream.on('end', resolvePromise);
    stream.on('error', rejectPromise);
  });
  return { size, sha256Hex: sha256.digest('hex'), md5Base64: md5.digest('base64') };
}

function storageUri(objectName) {
  const encodedPath = objectName.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  return `ss:///${TARGET_BUCKET}/${encodedPath}`;
}

async function flushVerifiedStatuses(rows) {
  if (rows.length === 0) return;
  const payload = `convert_from(decode('${encodeJson(rows)}','base64'),'utf8')::jsonb`;
  await runSupabaseSql(`
update migration_staging.storage_objects s
set target_bucket = '${TARGET_BUCKET}',
    target_path = x.source_path,
    copy_status = 'verified',
    error_code = null
from jsonb_to_recordset(${payload}) as x(source_path text)
where s.migration_run_id = '${MIGRATION_RUN_ID}'::uuid
  and s.source_bucket = '${SOURCE_BUCKET}'
  and s.source_path = x.source_path;`);
}

async function recordStorageValidation(result) {
  const expected = { objectCount: result.objectCount, totalBytes: result.totalBytes, aggregateSha256: result.aggregateSha256 };
  const actual = { objectCount: result.verifiedCount, totalBytes: result.verifiedBytes, aggregateSha256: result.aggregateSha256 };
  await runSupabaseSql(`
insert into migration_staging.validation_results
  (migration_run_id, check_name, scope, expected, actual, passed, details)
values (
  '${MIGRATION_RUN_ID}'::uuid,
  '${STORAGE_VALIDATION_NAME}',
  'private_storage_bucket',
  convert_from(decode('${encodeJson(expected)}','base64'),'utf8')::jsonb,
  convert_from(decode('${encodeJson(actual)}','base64'),'utf8')::jsonb,
  ${result.objectCount === result.verifiedCount && result.totalBytes === result.verifiedBytes ? 'true' : 'false'},
  'Each Firebase object was downloaded, SHA-256 hashed, uploaded serially, downloaded from Supabase, and byte-compared.'
);`);
}

async function compareStoragePaths() {
  const rows = await runSupabaseSql(`
select
  (select count(*)::int
   from migration_staging.storage_objects source_object
   left join storage.objects target_object
     on target_object.bucket_id = '${TARGET_BUCKET}'
    and target_object.name = source_object.source_path
   where source_object.migration_run_id = '${MIGRATION_RUN_ID}'::uuid
     and source_object.source_bucket = '${SOURCE_BUCKET}'
     and target_object.id is null) as source_only_objects,
  (select count(*)::int
   from storage.objects target_object
   left join migration_staging.storage_objects source_object
     on source_object.migration_run_id = '${MIGRATION_RUN_ID}'::uuid
    and source_object.source_bucket = '${SOURCE_BUCKET}'
    and source_object.source_path = target_object.name
   where target_object.bucket_id = '${TARGET_BUCKET}'
     and source_object.source_path is null) as target_only_objects;`, { json: true, maxStdoutBytes: 1_000_000 });
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw Object.assign(new Error('Storage path comparison was invalid'), { code: 'STORAGE_PATH_COMPARISON_INVALID' });
  }
  return {
    sourceOnlyObjects: Number(rows[0].source_only_objects),
    targetOnlyObjects: Number(rows[0].target_only_objects),
  };
}

async function main() {
  if (!process.argv.includes('--confirm-linked-private-storage-copy')) {
    throw Object.assign(new Error('Explicit linked storage-copy mode is required'), { code: 'MODE_REQUIRED' });
  }
  activeStage = 'authenticate';
  await authenticateFirebase();
  activeStage = 'source_inventory';
  const objects = await listSourceObjects();
  if (USE_EDGE_TRANSFER) {
    const pruneResult = await runEdgeRequest({
      operation: 'prune-storage-manifest',
      migrationRunId: MIGRATION_RUN_ID,
      sourcePaths: objects.map((object) => object.name),
    });
    process.stderr.write(`${JSON.stringify({
      progress: 'storage_manifest_pruned',
      deletedRows: Number(pruneResult.deletedRows ?? 0),
    })}\n`);
  }
  const storageCheckpoint = USE_EDGE_TRANSFER ? await loadEdgeStorageCheckpoint() : new Map();
  const totalBytes = objects.reduce((total, object) => total + Number(object.size ?? 0), 0);
  const firstPath = objects[0]?.name ?? '';
  process.stderr.write(`${JSON.stringify({
    progress: 'storage_source_inventory',
    objectCount: objects.length,
    totalBytes,
    firstObjectPathShape: {
      length: firstPath.length,
      segments: firstPath.split('/').length,
      hasSpecialCharacters: /[^A-Za-z0-9_./-]/.test(firstPath),
      hasBackslash: firstPath.includes('\\'),
      startsWithSlash: firstPath.startsWith('/'),
      destinationHasStorageScheme: storageUri(firstPath).startsWith('ss:///'),
    },
  })}\n`);
  const temporaryRoot = resolve(process.cwd(), 'migration-artifacts');
  const temporaryDirectory = resolve(temporaryRoot, `storage-transfer-${randomUUID()}`);
  if (!temporaryDirectory.startsWith(`${temporaryRoot}${sep}`)) {
    throw Object.assign(new Error('Temporary transfer directory was unsafe'), { code: 'UNSAFE_TEMPORARY_DIRECTORY' });
  }
  await mkdir(temporaryDirectory, { recursive: true });
  const verifiedRows = [];
  const objectDigests = [];
  let verifiedCount = 0;
  let verifiedBytes = 0;
  let resumedVerifiedCount = 0;
  try {
    for (const object of objects) {
      const sourceManifestChecksum = digest({
        name: object.name,
        generation: object.generation ?? null,
        size: object.size ?? '0',
        contentType: object.contentType ?? null,
        md5Hash: object.md5Hash ?? null,
        crc32c: object.crc32c ?? null,
        updated: object.updated ?? null,
      });
      const checkpoint = storageCheckpoint.get(object.name);
      if (checkpoint?.source_checksum === sourceManifestChecksum
        && Number(checkpoint.target_verified_bytes) === Number(object.size ?? 0)
        && typeof checkpoint.target_sha256 === 'string' && /^[0-9a-f]{64}$/i.test(checkpoint.target_sha256)) {
        objectDigests.push(digest({ name: object.name, size: Number(object.size ?? 0), sha256: checkpoint.target_sha256 }));
        verifiedCount += 1;
        resumedVerifiedCount += 1;
        verifiedBytes += Number(object.size ?? 0);
        process.stderr.write(`${JSON.stringify({ progress: 'storage_object_checkpoint_reused', verifiedCount, resumedVerifiedCount, verifiedBytes, totalObjects: objects.length, totalBytes })}\n`);
        continue;
      }
      activeStage = 'firebase_download';
      const sourcePath = join(temporaryDirectory, `${randomUUID()}.source`);
      const verificationPath = join(temporaryDirectory, `${randomUUID()}.target`);
      try {
        await downloadFirebaseObject(object, sourcePath);
        const sourceHash = await hashFile(sourcePath);
        if (sourceHash.size !== Number(object.size ?? 0) || (object.md5Hash && sourceHash.md5Base64 !== object.md5Hash)) {
          throw Object.assign(new Error('Firebase object checksum mismatch'), { code: 'SOURCE_OBJECT_CHECKSUM_MISMATCH' });
        }
        activeStage = 'supabase_upload';
        if (USE_EDGE_TRANSFER) {
          await uploadSupabaseObjectViaSignedUrl(sourcePath, object, object.contentType, object.cacheControl);
        } else {
          await runSupabaseStorageCopy(relative(process.cwd(), sourcePath), storageUri(object.name), {
            contentType: object.contentType,
            cacheControl: object.cacheControl,
          });
        }
        activeStage = 'supabase_download_verify';
        if (USE_EDGE_TRANSFER) {
          await downloadSupabaseObjectViaSignedUrl(object, verificationPath);
        } else {
          await runSupabaseStorageCopy(storageUri(object.name), relative(process.cwd(), verificationPath));
        }
        const targetHash = await hashFile(verificationPath);
        if (sourceHash.size !== targetHash.size || sourceHash.sha256Hex !== targetHash.sha256Hex) {
          throw Object.assign(new Error('Supabase object byte verification mismatch'), { code: 'TARGET_OBJECT_CHECKSUM_MISMATCH' });
        }
        if (USE_EDGE_TRANSFER) {
          await runEdgeRequest({
            operation: 'storage-mark-verified',
            migrationRunId: MIGRATION_RUN_ID,
            path: object.name,
            sourceChecksum: sourceManifestChecksum,
            targetSha256: targetHash.sha256Hex,
            verifiedBytes: targetHash.size,
          });
        }
        verifiedRows.push({ source_path: object.name });
        objectDigests.push(digest({ name: object.name, size: sourceHash.size, sha256: sourceHash.sha256Hex }));
        verifiedCount += 1;
        verifiedBytes += sourceHash.size;
        if (!USE_EDGE_TRANSFER && verifiedRows.length >= STATUS_BATCH_SIZE) {
          activeStage = 'record_verified_status';
          await flushVerifiedStatuses(verifiedRows.splice(0));
        }
        process.stderr.write(`${JSON.stringify({ progress: 'storage_object_verified', verifiedCount, verifiedBytes, totalObjects: objects.length, totalBytes })}\n`);
      } finally {
        await rm(sourcePath, { force: true });
        await rm(verificationPath, { force: true });
      }
    }
    if (!USE_EDGE_TRANSFER) await flushVerifiedStatuses(verifiedRows.splice(0));
    const aggregateSha256 = digestList(objectDigests);
    const pathComparison = USE_EDGE_TRANSFER
      ? { sourceOnlyObjects: null, targetOnlyObjects: null }
      : await compareStoragePaths();
    const exactTargetPaths = USE_EDGE_TRANSFER
      ? null
      : pathComparison.sourceOnlyObjects === 0 && pathComparison.targetOnlyObjects === 0;
    const result = { objectCount: objects.length, totalBytes, verifiedCount, resumedVerifiedCount, verifiedBytes, aggregateSha256, ...pathComparison, exactTargetPaths };
    if (!USE_EDGE_TRANSFER) {
      activeStage = 'record_validation';
      await recordStorageValidation(result);
    }
    process.stdout.write(`${JSON.stringify({
      ok: verifiedCount === objects.length && verifiedBytes === totalBytes && (USE_EDGE_TRANSFER || exactTargetPaths),
      mode: 'linked-private-storage-byte-copy',
      ...result,
      sourceBucketModified: false,
      temporaryCopiesRemoved: true,
      reconciliationPending: USE_EDGE_TRANSFER,
    }, null, 2)}\n`);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    ok: false,
    error: {
      stage: activeStage,
      name: error?.name ?? 'Error',
      code: error?.code ?? null,
      status: error?.status ?? null,
      exitCode: error?.exitCode ?? null,
      diagnostic: error?.safeDiagnostic ?? null,
    },
  })}\n`);
  process.exitCode = 1;
});
