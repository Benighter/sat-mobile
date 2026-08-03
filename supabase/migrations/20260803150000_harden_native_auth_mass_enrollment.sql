-- Make the public enrollment prompt safe for the complete Firebase Auth
-- inventory. Auth-only records without a preserved SAT profile stay on the
-- Firebase fallback instead of being trapped in an enrollment flow that can
-- never complete.

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
  eligible boolean;
begin
  if legacy_uid is null or not sat_private.is_sat_firebase_token() then
    raise exception 'No verified SAT identity';
  end if;

  select exists (
    select 1
    from public.sat_documents d
    where d.document_path = 'users/' || legacy_uid
  ) into eligible;

  select exists (
    select 1
    from sat_private.auth_identity_links l
    where l.firebase_uid = legacy_uid
      and l.verified_at is not null
  ) into linked;

  return jsonb_build_object('linked', linked, 'eligible', eligible);
end;
$$;

revoke all on function public.sat_native_enrollment_status() from public, anon;
grant execute on function public.sat_native_enrollment_status() to authenticated;

comment on function public.sat_native_enrollment_status() is
  'Returns whether the caller has a verified native link and whether a preserved direct SAT profile makes enrollment safe.';
