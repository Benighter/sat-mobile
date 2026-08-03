create or replace function sat_private.can_read_media_path(target_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[] := string_to_array(target_name, '/');
begin
  if not sat_private.is_sat_firebase_token() then return false; end if;
  if sat_private.is_super_admin() then return true; end if;
  if parts[1] = 'users' then return true; end if;
  if parts[1] = 'churches' then
    return sat_private.has_church_access(parts[2]) or sat_private.is_approved_ministry();
  end if;
  if parts[1] = 'chat' and parts[2] = 'global' then
    return sat_private.is_thread_participant('chatThreads/' || parts[3]);
  end if;
  if parts[1] = 'chat' then
    return sat_private.has_church_access(parts[2])
      and sat_private.is_thread_participant('churches/' || parts[2] || '/chatThreads/' || parts[3]);
  end if;
  return false;
end;
$$;

create or replace function sat_private.can_write_media_path(target_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[] := string_to_array(target_name, '/');
begin
  if not sat_private.is_sat_firebase_token() then return false; end if;
  if sat_private.is_super_admin() then return true; end if;
  if parts[1] = 'users' then return parts[2] = sat_private.current_uid(); end if;
  if parts[1] = 'churches' then return sat_private.has_church_access(parts[2]); end if;
  if parts[1] = 'chat' and parts[2] = 'global' then
    return sat_private.is_thread_participant('chatThreads/' || parts[3]);
  end if;
  if parts[1] = 'chat' then
    return sat_private.has_church_access(parts[2])
      and sat_private.is_thread_participant('churches/' || parts[2] || '/chatThreads/' || parts[3]);
  end if;
  return false;
end;
$$;

revoke all on function sat_private.can_read_media_path(text) from public, anon;
revoke all on function sat_private.can_write_media_path(text) from public, anon;
grant execute on function sat_private.can_read_media_path(text) to authenticated;
grant execute on function sat_private.can_write_media_path(text) to authenticated;

drop policy if exists sat_mobile_media_read on storage.objects;
drop policy if exists sat_mobile_media_insert on storage.objects;
drop policy if exists sat_mobile_media_update on storage.objects;
drop policy if exists sat_mobile_media_delete on storage.objects;

create policy sat_mobile_media_read on storage.objects for select to authenticated
using (bucket_id = 'sat-mobile-media' and sat_private.can_read_media_path(name));

create policy sat_mobile_media_insert on storage.objects for insert to authenticated
with check (bucket_id = 'sat-mobile-media' and sat_private.can_write_media_path(name));

create policy sat_mobile_media_update on storage.objects for update to authenticated
using (bucket_id = 'sat-mobile-media' and sat_private.can_write_media_path(name))
with check (bucket_id = 'sat-mobile-media' and sat_private.can_write_media_path(name));

create policy sat_mobile_media_delete on storage.objects for delete to authenticated
using (bucket_id = 'sat-mobile-media' and sat_private.can_write_media_path(name));
