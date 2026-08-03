create or replace function public.sat_search_admin_by_email(
  target_email text,
  inviter_is_ministry boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(trim(coalesce(target_email, '')));
  caller_payload jsonb := sat_private.current_user_payload();
  matched_user jsonb;
begin
  if not sat_private.is_sat_firebase_token() then
    raise exception 'Invalid identity token';
  end if;
  if normalized_email = '' or length(normalized_email) > 254
     or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email address is required';
  end if;
  if caller_payload is null
     or caller_payload->>'role' <> 'admin'
     or lower(coalesce(caller_payload->>'isActive', 'true')) = 'false'
     or lower(coalesce(caller_payload->>'isPromotedCampusAdmin', 'false')) = 'true' then
    raise exception 'Only an active church administrator can search for invitees';
  end if;

  select jsonb_build_object(
    'id', d.document_id,
    'uid', coalesce(nullif(d.payload->>'uid', ''), d.document_id),
    'email', d.payload->>'email',
    'displayName', coalesce(
      nullif(d.payload->>'displayName', ''),
      nullif(trim(concat_ws(' ', d.payload->>'firstName', d.payload->>'lastName')), ''),
      'Unnamed Admin'
    ),
    'firstName', d.payload->'firstName',
    'lastName', d.payload->'lastName',
    'phoneNumber', d.payload->'phoneNumber',
    'profilePicture', d.payload->'profilePicture',
    'churchId', coalesce(d.payload->>'churchId', ''),
    'churchName', d.payload->'churchName',
    'role', d.payload->>'role',
    'isMinistryAccount', lower(coalesce(d.payload->>'isMinistryAccount', 'false')) = 'true'
  )
  into matched_user
  from public.sat_documents d
  where d.collection_path = 'users'
    and d.payload->>'role' = 'admin'
    and lower(coalesce(d.payload->>'isActive', 'true')) <> 'false'
    and lower(coalesce(nullif(d.payload->>'emailLower', ''), d.payload->>'email', '')) = normalized_email
  order by
    (lower(coalesce(d.payload->>'isMinistryAccount', 'false')) = 'true') = inviter_is_ministry desc,
    d.document_id
  limit 1;

  return matched_user;
end;
$$;

revoke all on function public.sat_search_admin_by_email(text, boolean) from public, anon;
grant execute on function public.sat_search_admin_by_email(text, boolean) to authenticated;

comment on function public.sat_search_admin_by_email(text, boolean) is
  'Returns the minimal active-admin profile needed by SAT Mobile invite flows; callable only by active main admins.';
