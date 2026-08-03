create or replace function public.sat_migration_firestore_checkpoint_page(
  target_run_id uuid,
  after_document_path text default null,
  page_size integer default 1000
)
returns table(document_path text, source_checksum text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.document_path, d.source_checksum
  from migration_staging.firestore_documents d
  join migration_staging.migration_runs r on r.id = d.migration_run_id
  where d.migration_run_id = target_run_id
    and r.source_project_id = 'sat-mobile-de6f1'
    and (after_document_path is null or d.document_path > after_document_path)
  order by d.document_path
  limit case when page_size < 1 then 1 when page_size > 2000 then 2000 else page_size end;
$$;

revoke all on function public.sat_migration_firestore_checkpoint_page(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.sat_migration_firestore_checkpoint_page(uuid, text, integer)
  to service_role;

create or replace function public.sat_migration_prune_firestore_checkpoint(
  target_run_id uuid,
  document_paths jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_rows integer := 0;
begin
  if pg_catalog.jsonb_typeof(document_paths) <> 'array'
     or pg_catalog.jsonb_array_length(document_paths) < 1
     or pg_catalog.jsonb_array_length(document_paths) > 250 then
    raise exception 'Prune batch must contain between 1 and 250 document paths';
  end if;
  if not exists (
    select 1 from migration_staging.migration_runs r
    where r.id = target_run_id
      and r.source_project_id = 'sat-mobile-de6f1'
      and r.status in ('exported', 'failed')
  ) then
    raise exception 'Migration run is not writable';
  end if;

  delete from migration_staging.firestore_documents d
  where d.migration_run_id = target_run_id
    and d.document_path in (select pg_catalog.jsonb_array_elements_text(document_paths));
  get diagnostics deleted_rows = row_count;
  return deleted_rows;
end;
$$;

revoke all on function public.sat_migration_prune_firestore_checkpoint(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.sat_migration_prune_firestore_checkpoint(uuid, jsonb)
  to service_role;

comment on function public.sat_migration_firestore_checkpoint_page(uuid, text, integer) is
  'Service-role-only bounded checkpoint reader for resumable Firebase migration staging.';
comment on function public.sat_migration_prune_firestore_checkpoint(uuid, jsonb) is
  'Removes only stale rows from the current resumable staging snapshot; the validated archival run remains unchanged.';

notify pgrst, 'reload schema';
