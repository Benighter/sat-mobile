-- Let an already authenticated Firebase user establish a native Supabase
-- password without changing their immutable Firebase UID, profile path, church
-- scope, or historical records. Firebase remains the active sign-in provider
-- until a separately released client has completed this enrollment.

create or replace function public.sat_native_enrollment_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  legacy_uid text := sat_private.current_uid();
  linked boolean;
begin
  if legacy_uid is null or not sat_private.is_sat_firebase_token() then
    raise exception 'No verified SAT identity';
  end if;

  select exists (
    select 1
    from sat_private.auth_identity_links l
    where l.firebase_uid = legacy_uid
      and l.verified_at is not null
  ) into linked;

  return jsonb_build_object('linked', linked);
end;
$$;

create or replace function public.sat_begin_native_auth_enrollment()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb := auth.jwt();
  legacy_uid text := sat_private.current_uid();
  token_email text := lower(nullif(trim(claims->>'email'), ''));
  provider_ids jsonb;
begin
  if claims->>'iss' <> 'https://securetoken.google.com/sat-mobile-de6f1'
     or claims->>'aud' <> 'sat-mobile-de6f1'
     or legacy_uid is null then
    raise exception 'Enrollment requires the current Firebase session';
  end if;
  if token_email is null then raise exception 'The Firebase account has no email address'; end if;
  if not exists (
    select 1 from public.sat_documents d
    where d.document_path = 'users/' || legacy_uid
  ) then
    raise exception 'SAT profile not found';
  end if;

  select coalesce(jsonb_agg(provider order by provider), '[]'::jsonb)
  into provider_ids
  from jsonb_object_keys(coalesce(claims #> '{firebase,identities}', '{}'::jsonb)) provider;

  return jsonb_build_object(
    'firebaseUid', legacy_uid,
    'email', token_email,
    'emailVerified', coalesce((claims->>'email_verified')::boolean, false),
    'sourceProviderIds', provider_ids
  );
end;
$$;

create or replace function public.sat_get_native_auth_link(target_firebase_uid text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.supabase_user_id
  from sat_private.auth_identity_links l
  where l.firebase_uid = target_firebase_uid
    and l.verified_at is not null
  limit 1;
$$;

create or replace function public.sat_complete_native_auth_link(
  target_firebase_uid text,
  target_supabase_user_id uuid,
  target_source_provider_ids jsonb default '[]'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_firebase_uid is null or target_firebase_uid = ''
     or target_firebase_uid ~ '[\x00-\x1f/]'
     or target_supabase_user_id is null
     or jsonb_typeof(target_source_provider_ids) <> 'array' then
    raise exception 'Invalid native identity link';
  end if;
  if not exists (
    select 1 from public.sat_documents d
    where d.document_path = 'users/' || target_firebase_uid
  ) then
    raise exception 'SAT profile not found';
  end if;
  if not exists (select 1 from auth.users u where u.id = target_supabase_user_id) then
    raise exception 'Supabase Auth user not found';
  end if;

  insert into sat_private.auth_identity_links (
    supabase_user_id,
    firebase_uid,
    source_provider_ids,
    verified_at
  ) values (
    target_supabase_user_id,
    target_firebase_uid,
    target_source_provider_ids,
    clock_timestamp()
  )
  on conflict (supabase_user_id) do update
  set source_provider_ids = excluded.source_provider_ids,
      verified_at = coalesce(sat_private.auth_identity_links.verified_at, excluded.verified_at)
  where sat_private.auth_identity_links.firebase_uid = excluded.firebase_uid;

  if not found then raise exception 'Conflicting native identity link'; end if;
  return true;
end;
$$;

revoke all on function public.sat_native_enrollment_status() from public, anon;
revoke all on function public.sat_begin_native_auth_enrollment() from public, anon;
revoke all on function public.sat_get_native_auth_link(text) from public, anon, authenticated;
revoke all on function public.sat_complete_native_auth_link(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.sat_native_enrollment_status() to authenticated;
grant execute on function public.sat_begin_native_auth_enrollment() to authenticated;
grant execute on function public.sat_get_native_auth_link(text) to service_role;
grant execute on function public.sat_complete_native_auth_link(text, uuid, jsonb) to service_role;

comment on function public.sat_native_enrollment_status() is
  'Returns only whether the caller immutable SAT identity already has a verified native Auth link.';
comment on function public.sat_begin_native_auth_enrollment() is
  'Returns the current Firebase caller own verified enrollment coordinates to the secure migration Edge Function.';
