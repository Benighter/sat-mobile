import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const firebaseAuth = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const firebaseApi = require('firebase-tools/lib/api');
const { Client } = require('firebase-tools/lib/apiv2');

const PROJECT_ID = 'sat-mobile-de6f1';
const PAGE_SIZE = 1_000;
const APPLY = process.argv.includes('--apply');
const CONFIRM = process.argv.includes('--confirm-merge-authenticated-role');
const MANAGED_SCOPE_KEYS = [
  'sat_church_id',
  'sat_app_role',
  'sat_super_admin',
  'sat_ministry_church_id',
  'sat_ministry_approved',
  'sat_ministry_name',
];

function parseClaims(value) {
  if (!value) return {};
  const parsed = JSON.parse(value);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Custom claims must be a JSON object');
  }
  return parsed;
}

function digestClaims(uid, claims) {
  const stable = Object.fromEntries(Object.entries(claims).sort(([a], [b]) => a.localeCompare(b)));
  return createHash('sha256').update(JSON.stringify({ uid, claims: stable })).digest('hex');
}

async function authenticate() {
  const account = firebaseAuth.getProjectDefaultAccount(process.cwd());
  if (!account) throw new Error('Firebase CLI account unavailable');
  const options = { project: PROJECT_ID, projectRoot: process.cwd(), nonInteractive: true };
  firebaseAuth.setActiveAccount(options, account);
  await requireAuth(options);
}

async function listUsers(client) {
  const users = [];
  let offset = 0;
  while (true) {
    const response = await client.post(`/v1/projects/${PROJECT_ID}/accounts:query`, {
      offset: String(offset),
      limit: String(PAGE_SIZE),
    });
    const page = response.body.userInfo ?? [];
    const count = Number(response.body.recordsCount ?? page.length);
    if (count === 0) break;
    users.push(...page);
    offset += count;
  }
  return users;
}

function firestoreValue(value) {
  if (!value || typeof value !== 'object') return undefined;
  if (Object.hasOwn(value, 'stringValue')) return value.stringValue;
  if (Object.hasOwn(value, 'booleanValue')) return value.booleanValue === true;
  if (Object.hasOwn(value, 'mapValue')) {
    return Object.fromEntries(Object.entries(value.mapValue?.fields ?? {}).map(([key, child]) => [key, firestoreValue(child)]));
  }
  return undefined;
}

async function listUserScopes() {
  const client = new Client({ urlPrefix: 'https://firestore.googleapis.com', auth: true });
  const scopes = new Map();
  let pageToken;
  do {
    const response = await client.get(`/v1/projects/${PROJECT_ID}/databases/(default)/documents/users`, {
      queryParams: { pageSize: 1_000, ...(pageToken ? { pageToken } : {}) },
    });
    for (const document of response.body.documents ?? []) {
      const uid = document.name?.split('/').pop();
      if (!uid) continue;
      const data = Object.fromEntries(Object.entries(document.fields ?? {}).map(([key, value]) => [key, firestoreValue(value)]));
      const claims = {};
      if (typeof data.churchId === 'string' && data.churchId) claims.sat_church_id = data.churchId;
      if (typeof data.role === 'string' && data.role) claims.sat_app_role = data.role;
      if (data.superAdmin === true) claims.sat_super_admin = true;
      if (typeof data.contexts?.ministryChurchId === 'string' && data.contexts.ministryChurchId) {
        claims.sat_ministry_church_id = data.contexts.ministryChurchId;
      }
      if (data.isMinistryAccount === true && data.ministryAccess?.status === 'approved') {
        claims.sat_ministry_approved = true;
      }
      if (typeof data.preferences?.ministryName === 'string' && data.preferences.ministryName) {
        claims.sat_ministry_name = data.preferences.ministryName;
      }
      scopes.set(uid, claims);
    }
    pageToken = response.body.nextPageToken;
  } while (pageToken);
  return scopes;
}

function withoutManagedClaims(claims) {
  const result = { ...claims };
  delete result.role;
  for (const key of MANAGED_SCOPE_KEYS) delete result[key];
  return result;
}

async function main() {
  if (APPLY && !CONFIRM) {
    throw new Error('Apply mode requires --confirm-merge-authenticated-role');
  }

  await authenticate();
  const client = new Client({ urlPrefix: firebaseApi.identityOrigin(), auth: true });
  const users = await listUsers(client);
  const userScopes = await listUserScopes();
  const planned = [];
  const beforeDigests = [];
  let alreadyAuthenticated = 0;
  let conflictingRole = 0;
  let usersWithOtherClaims = 0;
  let maxMergedClaimBytes = 0;

  for (const user of users) {
    const claims = parseClaims(user.customAttributes);
    if (Object.keys(withoutManagedClaims(claims)).length > 0) usersWithOtherClaims += 1;
    if (claims.role === 'authenticated') alreadyAuthenticated += 1;
    if (Object.hasOwn(claims, 'role')) conflictingRole += 1;
    if (claims.role === 'authenticated') conflictingRole -= 1;
    const merged = { ...claims };
    for (const key of MANAGED_SCOPE_KEYS) delete merged[key];
    Object.assign(merged, userScopes.get(user.localId) ?? {}, { role: 'authenticated' });
    maxMergedClaimBytes = Math.max(maxMergedClaimBytes, Buffer.byteLength(JSON.stringify(merged), 'utf8'));
    beforeDigests.push(digestClaims(user.localId, claims));
    if (JSON.stringify(Object.fromEntries(Object.entries(claims).sort())) !== JSON.stringify(Object.fromEntries(Object.entries(merged).sort()))) {
      planned.push({ localId: user.localId, customAttributes: JSON.stringify(merged) });
    }
  }

  if (conflictingRole > 0) {
    throw new Error(`Refusing to overwrite ${conflictingRole} conflicting role claim(s)`);
  }
  if (maxMergedClaimBytes > 1_000) {
    throw new Error('Merged custom claims exceed Firebase limits');
  }

  if (APPLY) {
    for (const update of planned) {
      await client.post(`/v1/projects/${PROJECT_ID}/accounts:update`, update);
    }
  }

  const afterUsers = APPLY ? await listUsers(client) : users;
  let verifiedAuthenticated = 0;
  let preservedMismatch = 0;
  const afterDigests = [];
  for (const user of afterUsers) {
    const claims = parseClaims(user.customAttributes);
    if (claims.role === 'authenticated') verifiedAuthenticated += 1;
    afterDigests.push(digestClaims(user.localId, withoutManagedClaims(claims)));
  }

  // Compare claim payloads after excluding only the newly added role.
  const beforeWithoutRole = users.map((user) => {
    return digestClaims(user.localId, withoutManagedClaims(parseClaims(user.customAttributes)));
  }).sort();
  const afterWithoutRole = afterDigests.sort();
  if (JSON.stringify(beforeWithoutRole) !== JSON.stringify(afterWithoutRole)) preservedMismatch = 1;

  process.stdout.write(JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    totalUsers: users.length,
    alreadyAuthenticated,
    plannedUpdates: planned.length,
    conflictingRole,
    usersWithOtherClaims,
    userDocumentsWithScope: userScopes.size,
    maxMergedClaimBytes,
    verifiedAuthenticated: APPLY ? verifiedAuthenticated : alreadyAuthenticated,
    nonRoleClaimsPreserved: preservedMismatch === 0,
    firebaseUsersDeleted: 0,
  }));
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, code: error?.code ?? 'AUTH_CLAIM_MIGRATION_FAILED', message: error?.message ?? 'Unknown error' })}\n`);
  process.exitCode = 1;
});
