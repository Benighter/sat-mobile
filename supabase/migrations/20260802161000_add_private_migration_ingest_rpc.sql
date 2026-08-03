create or replace function public.sat_migration_reference_collection_paths(reference_run_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct d.collection_path order by d.collection_path), array[]::text[])
  from migration_staging.firestore_documents d
  join migration_staging.migration_runs r on r.id = d.migration_run_id
  where d.migration_run_id = reference_run_id
    and r.source_project_id = 'sat-mobile-de6f1';
$$;

revoke all on function public.sat_migration_reference_collection_paths(uuid) from public, anon, authenticated;
grant execute on function public.sat_migration_reference_collection_paths(uuid) to service_role;

create or replace function public.sat_migration_ingest(
  migration_run_id uuid,
  batch_kind text,
  batch_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  affected_rows integer := 0;
begin
  if not exists (
    select 1
    from migration_staging.migration_runs r
    where r.id = migration_run_id
      and r.source_project_id = 'sat-mobile-de6f1'
      and r.status in ('exported', 'failed')
  ) then
    raise exception 'Migration run is not writable';
  end if;
  if pg_catalog.jsonb_typeof(batch_rows) <> 'array'
     or pg_catalog.jsonb_array_length(batch_rows) < 1
     or pg_catalog.jsonb_array_length(batch_rows) > 250 then
    raise exception 'Migration batch must contain between 1 and 250 rows';
  end if;

  if batch_kind = 'firestore' then
    insert into migration_staging.firestore_documents (
      migration_run_id, document_path, collection_path, document_id, church_id, payload,
      source_created_at, source_updated_at, source_checksum
    )
    select
      migration_run_id, x.document_path, x.collection_path, x.document_id,
      x.church_id, x.payload, x.source_created_at::timestamptz,
      x.source_updated_at::timestamptz, x.source_checksum
    from pg_catalog.jsonb_to_recordset(batch_rows) as x(
      document_path text, collection_path text, document_id text, church_id text,
      payload jsonb, source_created_at text, source_updated_at text, source_checksum text
    )
    on conflict on constraint firestore_documents_pkey do update set
      collection_path = excluded.collection_path,
      document_id = excluded.document_id,
      church_id = excluded.church_id,
      payload = excluded.payload,
      source_created_at = excluded.source_created_at,
      source_updated_at = excluded.source_updated_at,
      source_checksum = excluded.source_checksum,
      imported_at = now()
    where migration_staging.firestore_documents.source_checksum is distinct from excluded.source_checksum;
  elsif batch_kind = 'auth' then
    insert into migration_staging.auth_identity_map (
      migration_run_id, firebase_uid, email, email_verified, disabled, provider_ids,
      source_created_at, source_last_sign_in_at, source_checksum, source_tenant_id,
      source_last_refresh_at, source_profile, source_custom_claims, role_claim_state
    )
    select
      migration_run_id, x.firebase_uid, x.email, x.email_verified, x.disabled,
      x.provider_ids, x.source_created_at::timestamptz, x.source_last_sign_in_at::timestamptz,
      x.source_checksum, x.source_tenant_id, x.source_last_refresh_at::timestamptz,
      x.source_profile, x.source_custom_claims, x.role_claim_state
    from pg_catalog.jsonb_to_recordset(batch_rows) as x(
      firebase_uid text, email text, email_verified boolean, disabled boolean,
      provider_ids jsonb, source_created_at text, source_last_sign_in_at text,
      source_checksum text, source_tenant_id text, source_last_refresh_at text,
      source_profile jsonb, source_custom_claims jsonb, role_claim_state text
    )
    on conflict on constraint auth_identity_map_pkey do update set
      email = excluded.email,
      email_verified = excluded.email_verified,
      disabled = excluded.disabled,
      provider_ids = excluded.provider_ids,
      source_created_at = excluded.source_created_at,
      source_last_sign_in_at = excluded.source_last_sign_in_at,
      source_checksum = excluded.source_checksum,
      source_tenant_id = excluded.source_tenant_id,
      source_last_refresh_at = excluded.source_last_refresh_at,
      source_profile = excluded.source_profile,
      source_custom_claims = excluded.source_custom_claims,
      role_claim_state = excluded.role_claim_state
    where migration_staging.auth_identity_map.source_checksum is distinct from excluded.source_checksum
       or migration_staging.auth_identity_map.source_profile is distinct from excluded.source_profile
       or migration_staging.auth_identity_map.source_custom_claims is distinct from excluded.source_custom_claims;
  elsif batch_kind = 'storage' then
    insert into migration_staging.storage_objects (
      migration_run_id, source_bucket, source_path, size_bytes, content_type,
      source_checksum, source_generation, source_updated_at, source_md5,
      source_crc32c, source_metadata
    )
    select
      migration_run_id, x.source_bucket, x.source_path, x.size_bytes::bigint,
      x.content_type, x.source_checksum, x.source_generation,
      x.source_updated_at::timestamptz, x.source_md5, x.source_crc32c, x.source_metadata
    from pg_catalog.jsonb_to_recordset(batch_rows) as x(
      source_bucket text, source_path text, size_bytes text, content_type text,
      source_checksum text, source_generation text, source_updated_at text,
      source_md5 text, source_crc32c text, source_metadata jsonb
    )
    on conflict on constraint storage_objects_pkey do update set
      size_bytes = excluded.size_bytes,
      content_type = excluded.content_type,
      source_checksum = excluded.source_checksum,
      source_generation = excluded.source_generation,
      source_updated_at = excluded.source_updated_at,
      source_md5 = excluded.source_md5,
      source_crc32c = excluded.source_crc32c,
      source_metadata = excluded.source_metadata
    where migration_staging.storage_objects.source_checksum is distinct from excluded.source_checksum
       or migration_staging.storage_objects.source_metadata is distinct from excluded.source_metadata;
  else
    raise exception 'Unsupported migration batch kind';
  end if;

  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

revoke all on function public.sat_migration_ingest(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.sat_migration_ingest(uuid, text, jsonb) to service_role;

comment on function public.sat_migration_ingest(uuid, text, jsonb) is
  'Temporary service-role-only batch ingress used when the local Supabase CLI management query path is unavailable.';

notify pgrst, 'reload schema';
