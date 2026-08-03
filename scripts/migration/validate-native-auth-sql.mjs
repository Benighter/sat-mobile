import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const packageFolder = (await readdir(resolve('node_modules/.pnpm')))
  .filter((name) => name.startsWith('@electric-sql+pglite@'))
  .sort()
  .at(-1);
if (!packageFolder) throw new Error('The bundled PGlite validator is unavailable');

const modulePath = resolve(
  'node_modules/.pnpm',
  packageFolder,
  'node_modules/@electric-sql/pglite/dist/index.js',
);
const { PGlite } = await import(pathToFileURL(modulePath).href);
const database = new PGlite();

await database.exec(`
  create role anon;
  create role authenticated;
  create role service_role;
  create schema auth;
  create schema sat_private;
  create table auth.users (id uuid primary key, email text);
  create table public.sat_documents (
    document_path text primary key,
    collection_path text not null,
    document_id text not null,
    church_id text,
    payload jsonb not null default '{}'::jsonb
  );
  create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
  create function sat_private.current_user_payload() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
`);

const migrations = [
  '20260803140000_prepare_native_auth_identity_links.sql',
  '20260803141000_add_private_transactional_email_gate.sql',
  '20260803142000_add_native_auth_admin_status_gate.sql',
  '20260803143000_add_native_auth_enrollment_gate.sql',
  '20260803150000_harden_native_auth_mass_enrollment.sql',
];

for (const migration of migrations) {
  const sql = await readFile(join('supabase', 'migrations', migration), 'utf8');
  await database.exec(sql);
}

const { rows } = await database.query(`
  select
    to_regclass('sat_private.auth_identity_links') is not null as identity_links,
    to_regclass('sat_private.email_dispatch_audit') is not null as email_audit,
    to_regprocedure('public.sat_current_identity()') is not null as identity_rpc,
    to_regprocedure('public.sat_begin_email_dispatch(uuid,text,text)') is not null as email_gate,
    to_regprocedure('public.sat_resolve_admin_target_identity(text)') is not null as status_gate,
    to_regprocedure('public.sat_native_enrollment_status()') is not null as enrollment_status,
    position('eligible' in pg_get_functiondef('public.sat_native_enrollment_status()'::regprocedure)) > 0 as enrollment_eligibility_gate,
    to_regprocedure('public.sat_complete_native_auth_link(text,uuid,jsonb)') is not null as enrollment_link
`);

if (!Object.values(rows[0] ?? {}).every(Boolean)) throw new Error('Native Auth migration objects are incomplete');

const edgeFunctions = [
  'supabase/functions/sat-transactional-email/index.ts',
  'supabase/functions/sat-admin-user-status/index.ts',
  'supabase/functions/sat-native-auth-enroll/index.ts',
];
for (const sourcePath of edgeFunctions) {
  const source = await readFile(sourcePath, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
    fileName: sourcePath,
  });
  const errors = (result.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  if (errors.length > 0) throw new Error(`Edge Function syntax check failed: ${sourcePath}`);
}

process.stdout.write(JSON.stringify({
  ok: true,
  migrations: migrations.length,
  objectsVerified: 8,
  edgeFunctionsSyntaxChecked: edgeFunctions.length,
}));
await database.close();
