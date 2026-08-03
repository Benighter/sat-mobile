-- Keep the current private Storage manifest aligned with a bounded authoritative
-- Firebase object listing. This only prunes checkpoint metadata for this run;
-- it never deletes Firebase or Supabase Storage bytes.

create or replace function public.sat_migration_prune_storage_manifest(
  target_run_id uuid,
  source_paths jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_rows bigint := 0;
begin
  if pg_catalog.jsonb_typeof(source_paths) <> 'array'
     or pg_catalog.jsonb_array_length(source_paths) > 5000 then
    raise exception 'Invalid Storage source path manifest';
  end if;

  if not exists (
    select 1 from migration_staging.migration_runs r
    where r.id = target_run_id
      and r.source_project_id = 'sat-mobile-de6f1'
  ) then
    raise exception 'Invalid migration run';
  end if;

  delete from migration_staging.storage_objects s
  where s.migration_run_id = target_run_id
    and not exists (
      select 1
      from pg_catalog.jsonb_array_elements_text(source_paths) p(source_path)
      where p.source_path = s.source_path
    );

  get diagnostics deleted_rows = row_count;
  return deleted_rows;
end;
$$;

revoke all on function public.sat_migration_prune_storage_manifest(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.sat_migration_prune_storage_manifest(uuid, jsonb)
  to service_role;

comment on function public.sat_migration_prune_storage_manifest(uuid, jsonb) is
  'Service-role-only pruning of current-run checkpoint metadata absent from the latest Firebase Storage listing; object bytes are never deleted.';

notify pgrst, 'reload schema';
