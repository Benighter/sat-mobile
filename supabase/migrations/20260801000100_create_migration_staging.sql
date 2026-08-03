-- Lossless, private staging area for a future Firebase-to-Supabase test import.
-- This migration creates no public application tables and imports no data.

create schema if not exists migration_staging;

revoke all on schema migration_staging from public;
revoke all on schema migration_staging from anon;
revoke all on schema migration_staging from authenticated;

create table migration_staging.migration_runs (
  id uuid primary key default gen_random_uuid(),
  source_project_id text not null,
  source_snapshot_at timestamptz,
  status text not null default 'planned'
    check (status in ('planned', 'exported', 'imported', 'validated', 'failed')),
  source_counts jsonb not null default '{}'::jsonb,
  target_counts jsonb not null default '{}'::jsonb,
  checksums jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table migration_staging.auth_identity_map (
  migration_run_id uuid not null references migration_staging.migration_runs(id) on delete cascade,
  firebase_uid text not null,
  supabase_user_id uuid,
  email text,
  email_verified boolean not null default false,
  disabled boolean not null default false,
  provider_ids jsonb not null default '[]'::jsonb,
  source_created_at timestamptz,
  source_last_sign_in_at timestamptz,
  import_status text not null default 'pending'
    check (import_status in ('pending', 'imported', 'verified', 'failed', 'not_required')),
  error_code text,
  primary key (migration_run_id, firebase_uid),
  unique (migration_run_id, supabase_user_id)
);

create table migration_staging.firestore_documents (
  migration_run_id uuid not null references migration_staging.migration_runs(id) on delete cascade,
  document_path text not null,
  collection_path text not null,
  document_id text not null,
  church_id text,
  payload jsonb not null,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_checksum text not null,
  imported_at timestamptz not null default now(),
  primary key (migration_run_id, document_path)
);

create index firestore_documents_collection_idx
  on migration_staging.firestore_documents (migration_run_id, collection_path);

create index firestore_documents_church_idx
  on migration_staging.firestore_documents (migration_run_id, church_id, collection_path);

create table migration_staging.storage_objects (
  migration_run_id uuid not null references migration_staging.migration_runs(id) on delete cascade,
  source_bucket text not null,
  source_path text not null,
  target_bucket text,
  target_path text,
  size_bytes bigint,
  content_type text,
  source_checksum text,
  copy_status text not null default 'pending'
    check (copy_status in ('pending', 'copied', 'verified', 'failed', 'skipped')),
  error_code text,
  primary key (migration_run_id, source_bucket, source_path)
);

create table migration_staging.validation_results (
  id bigint generated always as identity primary key,
  migration_run_id uuid not null references migration_staging.migration_runs(id) on delete cascade,
  check_name text not null,
  scope text not null,
  expected jsonb,
  actual jsonb,
  passed boolean not null,
  checked_at timestamptz not null default now(),
  details text
);

alter table migration_staging.migration_runs enable row level security;
alter table migration_staging.migration_runs force row level security;
alter table migration_staging.auth_identity_map enable row level security;
alter table migration_staging.auth_identity_map force row level security;
alter table migration_staging.firestore_documents enable row level security;
alter table migration_staging.firestore_documents force row level security;
alter table migration_staging.storage_objects enable row level security;
alter table migration_staging.storage_objects force row level security;
alter table migration_staging.validation_results enable row level security;
alter table migration_staging.validation_results force row level security;

revoke all on all tables in schema migration_staging from public;
revoke all on all tables in schema migration_staging from anon;
revoke all on all tables in schema migration_staging from authenticated;
revoke all on all sequences in schema migration_staging from public;
revoke all on all sequences in schema migration_staging from anon;
revoke all on all sequences in schema migration_staging from authenticated;

comment on schema migration_staging is
  'Private, temporary Firebase migration evidence. Never expose through the Data API.';
