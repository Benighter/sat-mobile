-- Production application document backend. Firebase remains untouched as the
-- rollback source; this table starts as a verified copy of the staged snapshot.

create schema if not exists sat_private;
revoke all on schema sat_private from public, anon, authenticated;

create table public.sat_documents (
  document_path text primary key,
  collection_path text not null,
  document_id text not null,
  church_id text,
  payload jsonb not null default '{}'::jsonb,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_checksum text,
  migrated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sat_documents_path_shape check (
    document_path <> '' and collection_path <> '' and document_id <> ''
  )
);

create index sat_documents_collection_idx
  on public.sat_documents (collection_path, document_id);
create index sat_documents_church_idx
  on public.sat_documents (church_id, collection_path);
create index sat_documents_payload_gin_idx
  on public.sat_documents using gin (payload jsonb_path_ops);

insert into public.sat_documents (
  document_path,
  collection_path,
  document_id,
  church_id,
  payload,
  source_created_at,
  source_updated_at,
  source_checksum
)
select
  document_path,
  collection_path,
  document_id,
  church_id,
  payload,
  source_created_at,
  source_updated_at,
  source_checksum
from migration_staging.firestore_documents
where migration_run_id = '895c54f0-d4ae-4b48-8ba9-5962c0413ec9'::uuid
on conflict (document_path) do update set
  collection_path = excluded.collection_path,
  document_id = excluded.document_id,
  church_id = excluded.church_id,
  payload = excluded.payload,
  source_created_at = excluded.source_created_at,
  source_updated_at = excluded.source_updated_at,
  source_checksum = excluded.source_checksum,
  migrated_at = now(),
  updated_at = now();

create or replace function sat_private.current_uid()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select nullif(auth.jwt()->>'sub', '');
$$;

create or replace function sat_private.is_sat_firebase_token()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    auth.jwt()->>'iss' = 'https://securetoken.google.com/sat-mobile-de6f1'
    and auth.jwt()->>'aud' = 'sat-mobile-de6f1'
    and auth.jwt()->>'role' = 'authenticated'
    and nullif(auth.jwt()->>'sub', '') is not null,
    false
  );
$$;

create or replace function sat_private.current_user_payload()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select d.payload
  from public.sat_documents d
  where d.document_path = 'users/' || sat_private.current_uid()
  limit 1;
$$;

create or replace function sat_private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((sat_private.current_user_payload()->>'superAdmin')::boolean, false);
$$;

create or replace function sat_private.is_approved_ministry()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (sat_private.current_user_payload()->>'isMinistryAccount')::boolean
    and sat_private.current_user_payload() #>> '{ministryAccess,status}' = 'approved'
    and nullif(sat_private.current_user_payload() #>> '{preferences,ministryName}', '') is not null,
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
      or sat_private.current_user_payload()->>'churchId' = target_church_id
      or sat_private.current_user_payload() #>> '{contexts,ministryChurchId}' = target_church_id
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

create or replace function sat_private.is_thread_participant(thread_path text, candidate_payload jsonb default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      case
        when candidate_payload is not null then candidate_payload
        else (select d.payload from public.sat_documents d where d.document_path = thread_path limit 1)
      end
    )->'participants' ? sat_private.current_uid(),
    false
  );
$$;

create or replace function sat_private.can_read_document(
  target_path text,
  target_church_id text,
  target_payload jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[] := string_to_array(target_path, '/');
  root_collection text := parts[1];
  uid text := sat_private.current_uid();
begin
  if not sat_private.is_sat_firebase_token() then return false; end if;
  if sat_private.is_super_admin() then return true; end if;

  if root_collection = 'users' then
    return parts[2] = uid
      or sat_private.has_church_access(target_payload->>'churchId');
  end if;

  if root_collection = 'churches' then
    if array_length(parts, 1) >= 4 and parts[3] = 'chatThreads' then
      return sat_private.has_church_access(parts[2])
        and sat_private.is_thread_participant(
          'churches/' || parts[2] || '/chatThreads/' || parts[4],
          case when array_length(parts, 1) = 4 then target_payload else null end
        );
    end if;
    return sat_private.has_church_access(parts[2]) or sat_private.is_approved_ministry();
  end if;

  if root_collection = 'chatThreads' then
    return sat_private.is_thread_participant(
      'chatThreads/' || parts[2],
      case when array_length(parts, 1) = 2 then target_payload else null end
    );
  end if;

  if root_collection = 'ministryAccessRequests' then
    return target_payload->>'requesterUid' = uid;
  end if;

  if root_collection = 'adminInvites' then
    return target_payload->>'invitedUserId' = uid or target_payload->>'createdBy' = uid;
  end if;
  if root_collection = 'crossTenantAccessLinks' then
    return target_payload->>'viewerUid' = uid or target_payload->>'ownerUid' = uid;
  end if;
  if root_collection = 'crossTenantInvites' then
    return target_payload->>'fromAdminUid' = uid or target_payload->>'toAdminUid' = uid;
  end if;
  if root_collection = 'crossTenantAccessIndex' then
    return target_payload->>'viewerUid' = uid or target_payload->>'ownerUid' = uid;
  end if;

  return false;
end;
$$;

create or replace function sat_private.can_write_document(
  target_path text,
  target_church_id text,
  target_payload jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[] := string_to_array(target_path, '/');
  root_collection text := parts[1];
  uid text := sat_private.current_uid();
begin
  if not sat_private.is_sat_firebase_token() then return false; end if;
  if sat_private.is_super_admin() then return true; end if;

  if root_collection = 'users' then return parts[2] = uid; end if;
  if root_collection = 'churches' then
    if array_length(parts, 1) >= 4 and parts[3] = 'chatThreads' then
      return sat_private.has_church_access(parts[2])
        and sat_private.is_thread_participant(
          'churches/' || parts[2] || '/chatThreads/' || parts[4],
          case when array_length(parts, 1) = 4 then target_payload else null end
        );
    end if;
    return sat_private.has_church_access(parts[2]);
  end if;
  if root_collection = 'chatThreads' then
    return sat_private.is_thread_participant(
      'chatThreads/' || parts[2],
      case when array_length(parts, 1) = 2 then target_payload else null end
    );
  end if;
  if root_collection = 'ministryAccessRequests' then
    return target_payload->>'requesterUid' = uid;
  end if;
  if root_collection = 'adminInvites' then
    return target_payload->>'createdBy' = uid
      or target_payload->>'invitedUserId' = uid;
  end if;
  if root_collection = 'crossTenantAccessLinks' then
    return target_payload->>'viewerUid' = uid or target_payload->>'ownerUid' = uid;
  end if;
  if root_collection = 'crossTenantInvites' then
    return target_payload->>'fromAdminUid' = uid or target_payload->>'toAdminUid' = uid;
  end if;
  if root_collection = 'crossTenantAccessIndex' then
    return target_payload->>'viewerUid' = uid or target_payload->>'ownerUid' = uid;
  end if;
  return false;
end;
$$;

alter table public.sat_documents enable row level security;
alter table public.sat_documents force row level security;

revoke all on public.sat_documents from public, anon;
grant select, insert, update, delete on public.sat_documents to authenticated;

grant usage on schema sat_private to authenticated;
grant execute on function sat_private.current_uid() to authenticated;
grant execute on function sat_private.is_sat_firebase_token() to authenticated;
grant execute on function sat_private.can_read_document(text, text, jsonb) to authenticated;
grant execute on function sat_private.can_write_document(text, text, jsonb) to authenticated;

create policy sat_documents_read
on public.sat_documents
for select
to authenticated
using (sat_private.can_read_document(document_path, church_id, payload));

create policy sat_documents_insert
on public.sat_documents
for insert
to authenticated
with check (sat_private.can_write_document(document_path, church_id, payload));

create policy sat_documents_update
on public.sat_documents
for update
to authenticated
using (sat_private.can_write_document(document_path, church_id, payload))
with check (sat_private.can_write_document(document_path, church_id, payload));

create policy sat_documents_delete
on public.sat_documents
for delete
to authenticated
using (sat_private.can_write_document(document_path, church_id, payload));

alter publication supabase_realtime add table public.sat_documents;

comment on table public.sat_documents is
  'Supabase-backed SAT Mobile document store. Firebase document paths and IDs are preserved for reversible cutover.';
