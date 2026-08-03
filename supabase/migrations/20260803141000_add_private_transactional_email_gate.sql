-- Server-side authorization and rate accounting for transactional email.
-- No recipient address or message content is persisted in this audit table.

create table sat_private.email_dispatch_audit (
  request_id uuid primary key,
  dispatcher_uid text not null,
  church_id text,
  message_kind text not null,
  recipient_digest text not null,
  status text not null default 'started',
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  constraint email_dispatch_kind_shape check (message_kind ~ '^[a-z][a-z0-9_-]{0,39}$'),
  constraint email_dispatch_recipient_digest_shape check (recipient_digest ~ '^[0-9a-f]{64}$'),
  constraint email_dispatch_status_values check (status in ('started', 'sent', 'failed'))
);

create index email_dispatch_audit_dispatcher_created_idx
  on sat_private.email_dispatch_audit (dispatcher_uid, created_at desc);

alter table sat_private.email_dispatch_audit enable row level security;
alter table sat_private.email_dispatch_audit force row level security;
revoke all on sat_private.email_dispatch_audit from public, anon, authenticated;

create or replace function public.sat_begin_email_dispatch(
  target_request_id uuid,
  target_recipient_digest text,
  target_message_kind text default 'transactional'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_uid text := sat_private.current_uid();
  caller_profile jsonb := sat_private.current_user_payload();
  caller_role text := caller_profile->>'role';
begin
  if not sat_private.is_sat_firebase_token() or caller_uid is null then
    raise exception 'Invalid identity token';
  end if;
  if caller_role <> 'admin' and not sat_private.is_super_admin() then
    raise exception 'Only an authorized administrator can send transactional email';
  end if;
  if target_recipient_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid recipient digest';
  end if;
  if target_message_kind !~ '^[a-z][a-z0-9_-]{0,39}$' then
    raise exception 'Invalid message kind';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller_uid, 0));
  if (
    select count(*) from sat_private.email_dispatch_audit a
    where a.dispatcher_uid = caller_uid
      and a.created_at >= clock_timestamp() - interval '1 minute'
  ) >= 10 then
    raise exception 'Transactional email rate limit exceeded';
  end if;
  if (
    select count(*) from sat_private.email_dispatch_audit a
    where a.dispatcher_uid = caller_uid
      and a.created_at >= clock_timestamp() - interval '1 day'
  ) >= 100 then
    raise exception 'Daily transactional email rate limit exceeded';
  end if;

  insert into sat_private.email_dispatch_audit (
    request_id, dispatcher_uid, church_id, message_kind, recipient_digest
  ) values (
    target_request_id,
    caller_uid,
    caller_profile->>'churchId',
    target_message_kind,
    target_recipient_digest
  );
  return true;
end;
$$;

create or replace function public.sat_finish_email_dispatch(
  target_request_id uuid,
  target_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_uid text := sat_private.current_uid();
begin
  if not sat_private.is_sat_firebase_token() or caller_uid is null then
    raise exception 'Invalid identity token';
  end if;
  if target_status not in ('sent', 'failed') then
    raise exception 'Invalid dispatch status';
  end if;

  update sat_private.email_dispatch_audit
  set status = target_status, completed_at = clock_timestamp()
  where request_id = target_request_id
    and dispatcher_uid = caller_uid
    and status = 'started';
  return found;
end;
$$;

revoke all on function public.sat_begin_email_dispatch(uuid, text, text) from public, anon;
revoke all on function public.sat_finish_email_dispatch(uuid, text) from public, anon;
grant execute on function public.sat_begin_email_dispatch(uuid, text, text) to authenticated;
grant execute on function public.sat_finish_email_dispatch(uuid, text) to authenticated;

comment on table sat_private.email_dispatch_audit is
  'Private rate-limit and outcome audit for transactional email; contains only caller UID and a one-way recipient digest, never recipient addresses or message bodies.';
