-- Add the source-only metadata needed to prove a lossless, repeatable copy.
-- These columns do not expose the private staging schema to application roles.

alter table migration_staging.auth_identity_map
  add column source_checksum text,
  add column source_tenant_id text,
  add column source_last_refresh_at timestamptz,
  add column source_profile jsonb not null default '{}'::jsonb,
  add column source_custom_claims jsonb not null default '{}'::jsonb,
  add column role_claim_state text not null default 'unknown'
    check (role_claim_state in ('unknown', 'missing', 'authenticated', 'other', 'invalid_json'));

alter table migration_staging.storage_objects
  add column source_generation text,
  add column source_updated_at timestamptz,
  add column source_md5 text,
  add column source_crc32c text,
  add column source_metadata jsonb not null default '{}'::jsonb;

comment on column migration_staging.auth_identity_map.source_checksum is
  'SHA-256 of the canonical, non-secret source identity record used for reconciliation.';

comment on column migration_staging.auth_identity_map.role_claim_state is
  'Inventory-only state of the Firebase role claim; no claim is changed by this migration.';

comment on column migration_staging.auth_identity_map.source_profile is
  'Selected Firebase identity profile fields; password hashes and salts are deliberately excluded.';

comment on column migration_staging.auth_identity_map.source_custom_claims is
  'Parsed Firebase custom claims retained privately for later continuity review.';

comment on column migration_staging.storage_objects.source_metadata is
  'Firebase Storage object metadata manifest; object bytes are copied in a later gated step.';
