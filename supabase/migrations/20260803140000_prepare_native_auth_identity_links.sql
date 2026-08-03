-- Prepare a reversible bridge from Firebase's 28-character UIDs to native
-- Supabase Auth UUIDs. This migration does not create users or change the
-- active authentication provider. Firebase JWTs continue to work unchanged.

create table sat_private.auth_identity_links (
  supabase_user_id uuid primary key references auth.users(id) on delete restrict,
  firebase_uid text not null unique,
  source_provider_ids jsonb not null default '[]'::jsonb,
  linked_at timestamptz not null default clock_timestamp(),
  verified_at timestamptz,
  constraint auth_identity_links_firebase_uid_shape check (
    firebase_uid <> '' and firebase_uid !~ '[\x00-\x1f/]'
  ),
  constraint auth_identity_links_provider_ids_array check (
    jsonb_typeof(source_provider_ids) = 'array'
  )
);

alter table sat_private.auth_identity_links enable row level security;
alter table sat_private.auth_identity_links force row level security;
revoke all on sat_private.auth_identity_links from public, anon, authenticated;

comment on table sat_private.auth_identity_links is
  'Private one-to-one mapping between native Supabase Auth UUIDs and immutable legacy Firebase UIDs. Populated only by a separately validated server-side Auth migration.';

create or replace function sat_private.current_uid()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb := auth.jwt();
  token_subject text := nullif(claims->>'sub', '');
  token_issuer text := coalesce(claims->>'iss', '');
  linked_uid text;
begin
  if token_subject is null then return null; end if;

  -- Preserve the already verified Firebase Third-Party Auth path exactly.
  if token_issuer = 'https://securetoken.google.com/sat-mobile-de6f1'
     and claims->>'aud' = 'sat-mobile-de6f1' then
    return token_subject;
  end if;

  -- A native Supabase subject is a UUID. PostgREST has already verified the
  -- token signature; an explicit private link is additionally required.
  if token_issuer like '%/auth/v1'
     and claims->>'role' = 'authenticated'
     and token_subject ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    select l.firebase_uid
      into linked_uid
      from sat_private.auth_identity_links l
      where l.supabase_user_id = token_subject::uuid
        and l.verified_at is not null;
    return linked_uid;
  end if;

  return null;
end;
$$;

-- Keep the existing function name so every current RLS policy remains valid.
-- It now means "a verified SAT identity", accepting either the current
-- Firebase issuer or a verified native-auth identity link.
create or replace function sat_private.is_sat_firebase_token()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    auth.jwt()->>'role' = 'authenticated'
    and sat_private.current_uid() is not null,
    false
  );
$$;

create or replace function sat_private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (auth.jwt()->>'sat_super_admin')::boolean,
    (sat_private.current_user_payload()->>'superAdmin')::boolean,
    false
  );
$$;

create or replace function sat_private.is_approved_ministry()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      (auth.jwt()->>'sat_ministry_approved')::boolean
      and nullif(auth.jwt()->>'sat_ministry_name', '') is not null
    ),
    (
      (sat_private.current_user_payload()->>'isMinistryAccount')::boolean
      and sat_private.current_user_payload() #>> '{ministryAccess,status}' = 'approved'
      and nullif(sat_private.current_user_payload() #>> '{preferences,ministryName}', '') is not null
    ),
    false
  );
$$;

create or replace function sat_private.has_church_access(target_church_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    target_church_id is not null
    and (
      sat_private.is_super_admin()
      or coalesce(
        nullif(auth.jwt()->>'sat_church_id', ''),
        nullif(sat_private.current_user_payload()->>'churchId', '')
      ) = target_church_id
      or coalesce(
        nullif(auth.jwt()->>'sat_ministry_church_id', ''),
        nullif(sat_private.current_user_payload() #>> '{contexts,ministryChurchId}', '')
      ) = target_church_id
      or exists (
        select 1
        from public.sat_documents access_doc
        where access_doc.document_path =
          'crossTenantAccessIndex/' || sat_private.current_uid() || '_' || target_church_id
          and coalesce((access_doc.payload->>'revoked')::boolean, false) = false
      )
    ),
    false
  );
$$;

create or replace function public.sat_current_identity()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  legacy_uid text := sat_private.current_uid();
  profile jsonb;
begin
  if legacy_uid is null or not sat_private.is_sat_firebase_token() then
    raise exception 'No verified SAT identity link';
  end if;

  select d.payload into profile
  from public.sat_documents d
  where d.document_path = 'users/' || legacy_uid
  limit 1;

  if profile is null then raise exception 'SAT profile not found'; end if;

  return jsonb_build_object(
    'uid', legacy_uid,
    'churchId', profile->>'churchId',
    'role', profile->>'role',
    'superAdmin', coalesce((profile->>'superAdmin')::boolean, false),
    'isMinistryAccount', coalesce((profile->>'isMinistryAccount')::boolean, false),
    'contexts', coalesce(profile->'contexts', '{}'::jsonb)
  );
end;
$$;

revoke all on function sat_private.current_uid() from public, anon;
revoke all on function sat_private.is_sat_firebase_token() from public, anon;
revoke all on function public.sat_current_identity() from public, anon;
grant execute on function sat_private.current_uid() to authenticated;
grant execute on function sat_private.is_sat_firebase_token() to authenticated;
grant execute on function public.sat_current_identity() to authenticated;

comment on function public.sat_current_identity() is
  'Returns only the caller own immutable legacy UID and authorization scope so native Auth sessions can retain existing document paths and tenant history.';
