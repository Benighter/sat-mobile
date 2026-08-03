-- Preserve rows that no longer exist in the authoritative Firebase snapshot
-- without allowing them to remain visible in the live compatibility table.
-- The archive is private, forced-RLS, and the move is atomic and resumable.

create table if not exists sat_private.archived_sat_documents (
  migration_run_id uuid not null references migration_staging.migration_runs(id),
  document_path text not null,
  collection_path text not null,
  document_id text not null,
  church_id text,
  payload jsonb not null,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_checksum text,
  migrated_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  archived_at timestamptz not null default now(),
  archive_reason text not null,
  primary key (migration_run_id, document_path)
);

alter table sat_private.archived_sat_documents enable row level security;
alter table sat_private.archived_sat_documents force row level security;
revoke all on table sat_private.archived_sat_documents from public, anon, authenticated;

create or replace function sat_private.archive_documents_absent_from_snapshot(
  target_migration_run_id uuid
)
returns table (archived_count bigint, removed_live_count bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_rows bigint := 0;
  removed_rows bigint := 0;
begin
  if not exists (
    select 1
    from migration_staging.migration_runs r
    where r.id = target_migration_run_id
      and r.source_project_id = 'sat-mobile-de6f1'
      and r.status in ('exported', 'imported', 'validated')
  ) then
    raise exception 'Migration snapshot is not eligible for archival reconciliation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('sat-mobile-archive-absent-documents', 0)
  );

  insert into sat_private.archived_sat_documents (
    migration_run_id, document_path, collection_path, document_id, church_id,
    payload, source_created_at, source_updated_at, source_checksum, migrated_at,
    created_at, updated_at, archived_at, archive_reason
  )
  select
    target_migration_run_id, p.document_path, p.collection_path, p.document_id,
    p.church_id, p.payload, p.source_created_at, p.source_updated_at,
    p.source_checksum, p.migrated_at, p.created_at, p.updated_at, now(),
    'Absent from final authoritative Firebase snapshot; preserved for rollback audit.'
  from public.sat_documents p
  left join migration_staging.firestore_documents s
    on s.migration_run_id = target_migration_run_id
   and s.document_path = p.document_path
  where s.document_path is null
  on conflict (migration_run_id, document_path) do nothing;

  get diagnostics inserted_rows = row_count;

  delete from public.sat_documents p
  where not exists (
    select 1
    from migration_staging.firestore_documents s
    where s.migration_run_id = target_migration_run_id
      and s.document_path = p.document_path
  )
  and exists (
    select 1
    from sat_private.archived_sat_documents a
    where a.migration_run_id = target_migration_run_id
      and a.document_path = p.document_path
  );

  get diagnostics removed_rows = row_count;
  return query select inserted_rows, removed_rows;
end;
$$;

revoke all on function sat_private.archive_documents_absent_from_snapshot(uuid)
  from public, anon, authenticated;
grant execute on function sat_private.archive_documents_absent_from_snapshot(uuid)
  to service_role;

comment on table sat_private.archived_sat_documents is
  'Private reversible archive for Supabase rows absent from an authoritative Firebase snapshot.';
comment on function sat_private.archive_documents_absent_from_snapshot(uuid) is
  'Atomically archives and removes live rows absent from a validated migration snapshot; service role only.';
