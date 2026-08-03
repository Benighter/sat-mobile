create or replace function public.sat_apply_admin_user_status(target_uid text, target_active boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_path text := 'users/' || target_uid;
  target_church text;
  target_exists boolean := false;
  caller_church text := auth.jwt()->>'sat_church_id';
  now_value text := to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if not sat_private.is_sat_firebase_token() then raise exception 'Invalid identity token'; end if;
  select true, d.church_id into target_exists, target_church from public.sat_documents d where d.document_path = target_path;
  if not target_exists then raise exception 'Target user was not found'; end if;
  if not sat_private.is_super_admin() and not (
    auth.jwt()->>'sat_app_role' = 'admin' and caller_church = target_church
  ) then
    raise exception 'Only an authorized church administrator can change account status';
  end if;

  update public.sat_documents
  set payload = payload
      || jsonb_build_object('isActive', target_active, 'isDeleted', false, 'lastUpdated', now_value)
      || case when target_active
        then jsonb_build_object('reactivatedAt', now_value)
        else jsonb_build_object('deactivatedAt', now_value)
      end,
      updated_at = clock_timestamp()
  where document_path = target_path;
  return found;
end;
$$;

revoke all on function public.sat_apply_admin_user_status(text, boolean) from public, anon;
grant execute on function public.sat_apply_admin_user_status(text, boolean) to authenticated;
