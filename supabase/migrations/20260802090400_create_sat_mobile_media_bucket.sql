insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sat-mobile-media',
  'sat-mobile-media',
  false,
  104857600,
  array['image/jpeg','image/png','image/webp','image/gif','application/pdf','application/octet-stream']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

grant execute on function sat_private.has_church_access(text) to authenticated;
grant execute on function sat_private.is_approved_ministry() to authenticated;

create policy sat_mobile_media_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'sat-mobile-media'
  and sat_private.is_sat_firebase_token()
  and (
    (storage.foldername(name))[1] = 'users'
    or (
      (storage.foldername(name))[1] in ('churches','chat')
      and (
        sat_private.has_church_access((storage.foldername(name))[2])
        or sat_private.is_approved_ministry()
      )
    )
  )
);

create policy sat_mobile_media_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'sat-mobile-media'
  and sat_private.is_sat_firebase_token()
  and (
    ((storage.foldername(name))[1] = 'users' and (storage.foldername(name))[2] = sat_private.current_uid())
    or (
      (storage.foldername(name))[1] in ('churches','chat')
      and sat_private.has_church_access((storage.foldername(name))[2])
    )
  )
);

create policy sat_mobile_media_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'sat-mobile-media'
  and sat_private.is_sat_firebase_token()
  and (
    ((storage.foldername(name))[1] = 'users' and (storage.foldername(name))[2] = sat_private.current_uid())
    or ((storage.foldername(name))[1] in ('churches','chat') and sat_private.has_church_access((storage.foldername(name))[2]))
  )
)
with check (
  bucket_id = 'sat-mobile-media'
  and sat_private.is_sat_firebase_token()
  and (
    ((storage.foldername(name))[1] = 'users' and (storage.foldername(name))[2] = sat_private.current_uid())
    or ((storage.foldername(name))[1] in ('churches','chat') and sat_private.has_church_access((storage.foldername(name))[2]))
  )
);

create policy sat_mobile_media_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'sat-mobile-media'
  and sat_private.is_sat_firebase_token()
  and (
    ((storage.foldername(name))[1] = 'users' and (storage.foldername(name))[2] = sat_private.current_uid())
    or ((storage.foldername(name))[1] in ('churches','chat') and sat_private.has_church_access((storage.foldername(name))[2]))
  )
);
