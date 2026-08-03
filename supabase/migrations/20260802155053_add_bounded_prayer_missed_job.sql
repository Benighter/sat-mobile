create or replace function sat_private.run_auto_mark_prayer_missed(
  run_at timestamptz default now(),
  dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  church_record record;
  local_value timestamp;
  local_date text;
  weekday_number integer;
  local_minutes integer;
  session_end_minutes integer;
  lock_path text;
  eligible_count bigint;
  inserted_count bigint;
  due_churches integer := 0;
  eligible_records bigint := 0;
  inserted_records bigint := 0;
  locked_churches integer := 0;
  overflow_churches integer := 0;
  timezone_name text;
begin
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtext('sat_auto_mark_prayer_missed')) then
    return jsonb_build_object(
      'alreadyRunning', true,
      'dryRun', dry_run,
      'dueChurches', 0,
      'eligibleRecords', 0,
      'insertedRecords', 0,
      'lockedChurches', 0,
      'overflowChurches', 0
    );
  end if;

  for church_record in
    select d.document_id as church_id, d.payload
    from public.sat_documents d
    where d.collection_path = 'churches'
    order by d.document_id
    limit 1000
  loop
    if lower(coalesce(church_record.payload #>> '{settings,prayer,autoMarkMissedEnabled}', 'true')) = 'false' then
      continue;
    end if;

    timezone_name := coalesce(
      nullif(church_record.payload #>> '{settings,timezone}', ''),
      nullif(church_record.payload #>> '{settings,notificationSettings,timezone}', ''),
      'Africa/Johannesburg'
    );
    if not exists (select 1 from pg_catalog.pg_timezone_names where name = timezone_name) then
      timezone_name := 'Africa/Johannesburg';
    end if;

    local_value := pg_catalog.timezone(timezone_name, run_at);
    local_date := pg_catalog.to_char(local_value, 'YYYY-MM-DD');
    weekday_number := extract(isodow from local_value)::integer;
    local_minutes := extract(hour from local_value)::integer * 60
      + extract(minute from local_value)::integer;
    session_end_minutes := case
      when weekday_number in (2, 5) then 390
      when weekday_number in (3, 4) then 360
      when weekday_number in (6, 7) then 420
      else null
    end;

    if session_end_minutes is null
       or local_minutes < session_end_minutes + 1
       or local_minutes > session_end_minutes + 5 then
      continue;
    end if;

    lock_path := 'churches/' || church_record.church_id || '/locks/autoPrayerMissed_' || local_date;
    if exists (select 1 from public.sat_documents d where d.document_path = lock_path) then
      continue;
    end if;

    due_churches := due_churches + 1;
    select count(*) into eligible_count
    from public.sat_documents member_doc
    where member_doc.collection_path = 'churches/' || church_record.church_id || '/members'
      and lower(coalesce(member_doc.payload->>'isActive', 'true')) <> 'false'
      and lower(coalesce(member_doc.payload->>'frozen', 'false')) <> 'true'
      and not exists (
        select 1
        from public.sat_documents prayer_doc
        where prayer_doc.document_path =
          'churches/' || church_record.church_id || '/prayers/' || member_doc.document_id || '_' || local_date
      );

    eligible_records := eligible_records + eligible_count;
    if eligible_count = 0 then
      continue;
    end if;
    if eligible_count > 5000 then
      overflow_churches := overflow_churches + 1;
      continue;
    end if;
    if dry_run then
      continue;
    end if;

    insert into public.sat_documents (
      document_path,
      collection_path,
      document_id,
      church_id,
      payload,
      source_created_at,
      source_updated_at,
      source_checksum,
      migrated_at,
      created_at,
      updated_at
    )
    select
      'churches/' || church_record.church_id || '/prayers/' || member_doc.document_id || '_' || local_date,
      'churches/' || church_record.church_id || '/prayers',
      member_doc.document_id || '_' || local_date,
      church_record.church_id,
      jsonb_build_object(
        'id', member_doc.document_id || '_' || local_date,
        'memberId', member_doc.document_id,
        'date', local_date,
        'status', 'Missed',
        'recordedAt', pg_catalog.to_char(run_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'recordedBy', 'system:supabase-auto-miss'
      ),
      run_at,
      run_at,
      null,
      run_at,
      run_at,
      run_at
    from public.sat_documents member_doc
    where member_doc.collection_path = 'churches/' || church_record.church_id || '/members'
      and lower(coalesce(member_doc.payload->>'isActive', 'true')) <> 'false'
      and lower(coalesce(member_doc.payload->>'frozen', 'false')) <> 'true'
      and not exists (
        select 1
        from public.sat_documents prayer_doc
        where prayer_doc.document_path =
          'churches/' || church_record.church_id || '/prayers/' || member_doc.document_id || '_' || local_date
      )
    order by member_doc.document_id
    limit 5000
    on conflict (document_path) do nothing;

    get diagnostics inserted_count = row_count;
    inserted_records := inserted_records + inserted_count;

    insert into public.sat_documents (
      document_path,
      collection_path,
      document_id,
      church_id,
      payload,
      source_created_at,
      source_updated_at,
      source_checksum,
      migrated_at,
      created_at,
      updated_at
    )
    values (
      lock_path,
      'churches/' || church_record.church_id || '/locks',
      'autoPrayerMissed_' || local_date,
      church_record.church_id,
      jsonb_build_object(
        'processedAt', pg_catalog.to_char(run_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'sessionEndLocal', pg_catalog.to_char(pg_catalog.make_time(session_end_minutes / 60, session_end_minutes % 60, 0), 'HH24:MI'),
        'windowStartLocal', pg_catalog.to_char(pg_catalog.make_time((session_end_minutes + 1) / 60, (session_end_minutes + 1) % 60, 0), 'HH24:MI'),
        'windowEndLocal', pg_catalog.to_char(pg_catalog.make_time((session_end_minutes + 5) / 60, (session_end_minutes + 5) % 60, 0), 'HH24:MI'),
        'tz', timezone_name,
        'backend', 'supabase'
      ),
      run_at,
      run_at,
      null,
      run_at,
      run_at,
      run_at
    )
    on conflict (document_path) do nothing;

    if found then
      locked_churches := locked_churches + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'alreadyRunning', false,
    'dryRun', dry_run,
    'dueChurches', due_churches,
    'eligibleRecords', eligible_records,
    'insertedRecords', inserted_records,
    'lockedChurches', locked_churches,
    'overflowChurches', overflow_churches,
    'churchScanLimit', 1000,
    'memberWriteLimitPerChurch', 5000
  );
end;
$$;

revoke all on function sat_private.run_auto_mark_prayer_missed(timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function sat_private.run_auto_mark_prayer_missed(timestamptz, boolean)
  to service_role;

comment on function sat_private.run_auto_mark_prayer_missed(timestamptz, boolean) is
  'Bounded, idempotent Supabase replacement for Firebase autoMarkPrayerMissed. Cron enablement is a separate cutover migration.';
