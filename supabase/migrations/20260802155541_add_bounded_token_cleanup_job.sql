create or replace function sat_private.try_timestamptz(value text)
returns timestamptz
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
begin
  return value::timestamptz;
exception when others then
  return null;
end;
$$;

create or replace function sat_private.run_cleanup_old_tokens(
  run_at timestamptz default now(),
  dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  eligible_count bigint;
  deleted_count bigint := 0;
begin
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtext('sat_cleanup_old_tokens')) then
    return jsonb_build_object('alreadyRunning', true, 'dryRun', dry_run, 'eligibleRecords', 0, 'deletedRecords', 0, 'overflow', false);
  end if;

  select count(*) into eligible_count
  from public.sat_documents d
  where d.collection_path like 'churches/%/deviceTokens'
    and lower(coalesce(d.payload->>'isActive', 'true')) = 'false'
    and sat_private.try_timestamptz(d.payload->>'lastUsed') < run_at - interval '30 days';

  if not dry_run and eligible_count > 0 and eligible_count <= 5000 then
    with candidates as (
      select d.document_path
      from public.sat_documents d
      where d.collection_path like 'churches/%/deviceTokens'
        and lower(coalesce(d.payload->>'isActive', 'true')) = 'false'
        and sat_private.try_timestamptz(d.payload->>'lastUsed') < run_at - interval '30 days'
      order by d.document_path
      limit 5000
    )
    delete from public.sat_documents d
    using candidates c
    where d.document_path = c.document_path;
    get diagnostics deleted_count = row_count;
  end if;

  return jsonb_build_object(
    'alreadyRunning', false,
    'dryRun', dry_run,
    'eligibleRecords', eligible_count,
    'deletedRecords', deleted_count,
    'overflow', eligible_count > 5000,
    'deleteLimit', 5000
  );
end;
$$;

revoke all on function sat_private.try_timestamptz(text) from public, anon, authenticated;
revoke all on function sat_private.run_cleanup_old_tokens(timestamptz, boolean) from public, anon, authenticated;
grant execute on function sat_private.run_cleanup_old_tokens(timestamptz, boolean) to service_role;

comment on function sat_private.run_cleanup_old_tokens(timestamptz, boolean) is
  'Bounded private replacement for Firebase cleanupOldTokens. Cron enablement is a separate cutover migration.';
