-- Authorization scope is synchronized into Firebase custom claims by the
-- production users/{uid} trigger. Reading it from the JWT avoids a user-table
-- lookup for every candidate row while retaining the indexed cross-tenant check.

create or replace function sat_private.is_super_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt()->>'sat_super_admin')::boolean, false);
$$;

create or replace function sat_private.is_approved_ministry()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt()->>'sat_ministry_approved')::boolean, false)
    and nullif(auth.jwt()->>'sat_ministry_name', '') is not null;
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
      or auth.jwt()->>'sat_church_id' = target_church_id
      or auth.jwt()->>'sat_ministry_church_id' = target_church_id
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
