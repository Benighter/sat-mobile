alter table migration_staging.storage_objects
  add column if not exists target_sha256 text,
  add column if not exists target_verified_bytes bigint;

create or replace function public.sat_migration_storage_checkpoint_page(
  target_run_id uuid,
  after_source_path text default null,
  page_size integer default 1000
)
returns table(source_path text, source_checksum text, target_sha256 text, target_verified_bytes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select s.source_path, s.source_checksum, s.target_sha256, s.target_verified_bytes
  from migration_staging.storage_objects s
  join migration_staging.migration_runs r on r.id = s.migration_run_id
  where s.migration_run_id = target_run_id
    and r.source_project_id = 'sat-mobile-de6f1'
    and s.copy_status = 'verified'
    and s.target_sha256 is not null
    and (after_source_path is null or s.source_path > after_source_path)
  order by s.source_path
  limit case when page_size < 1 then 1 when page_size > 2000 then 2000 else page_size end;
$$;

create or replace function public.sat_migration_mark_storage_verified(
  target_run_id uuid,
  target_source_path text,
  target_source_checksum text,
  verified_sha256 text,
  verified_bytes bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if verified_sha256 !~ '^[0-9a-f]{64}$' or verified_bytes < 0 then
    raise exception 'Invalid storage verification';
  end if;

  update migration_staging.storage_objects s
  set target_bucket = 'sat-mobile-media',
      target_path = s.source_path,
      copy_status = 'verified',
      error_code = null,
      target_sha256 = verified_sha256,
      target_verified_bytes = verified_bytes
  where s.migration_run_id = target_run_id
    and s.source_bucket = 'sat-mobile-de6f1.firebasestorage.app'
    and s.source_path = target_source_path
    and s.source_checksum = target_source_checksum
    and s.size_bytes = verified_bytes;

  return found;
end;
$$;

revoke all on function public.sat_migration_storage_checkpoint_page(uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.sat_migration_mark_storage_verified(uuid, text, text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.sat_migration_storage_checkpoint_page(uuid, text, integer)
  to service_role;
grant execute on function public.sat_migration_mark_storage_verified(uuid, text, text, text, bigint)
  to service_role;

comment on column migration_staging.storage_objects.target_sha256 is
  'SHA-256 verified after downloading the copied Supabase object; used only for resumable aggregate reconciliation.';

notify pgrst, 'reload schema';
