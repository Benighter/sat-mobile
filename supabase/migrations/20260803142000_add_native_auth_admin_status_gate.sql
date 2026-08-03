-- Resolve a legacy SAT UID to its native Supabase Auth UUID only after the
-- current administrator and tenant boundary have been verified.

create or replace function public.sat_resolve_admin_target_identity(target_uid text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_uid text := sat_private.current_uid();
  caller_profile jsonb := sat_private.current_user_payload();
  target_profile jsonb;
  target_user_id uuid;
begin
  if not sat_private.is_sat_firebase_token() or caller_uid is null then
    raise exception 'Invalid identity token';
  end if;
  if target_uid is null or target_uid = '' then raise exception 'Target UID is required'; end if;
  if target_uid = caller_uid then raise exception 'Administrators cannot change their own active status'; end if;

  select d.payload into target_profile
  from public.sat_documents d
  where d.document_path = 'users/' || target_uid
  limit 1;
  if target_profile is null then raise exception 'Target user was not found'; end if;

  if not sat_private.is_super_admin() and not (
    caller_profile->>'role' = 'admin'
    and nullif(caller_profile->>'churchId', '') is not null
    and caller_profile->>'churchId' = target_profile->>'churchId'
  ) then
    raise exception 'Only an authorized church administrator can change account status';
  end if;

  select l.supabase_user_id into target_user_id
  from sat_private.auth_identity_links l
  where l.firebase_uid = target_uid and l.verified_at is not null;
  if target_user_id is null then raise exception 'Target native identity is not linked'; end if;
  return target_user_id;
end;
$$;

revoke all on function public.sat_resolve_admin_target_identity(text) from public, anon;
grant execute on function public.sat_resolve_admin_target_identity(text) to authenticated;

comment on function public.sat_resolve_admin_target_identity(text) is
  'Tenant-scoped native Auth target resolver used only by the privileged account-status Edge Function.';
