-- A resumed final delta may observe a Firebase Storage object whose generation
-- changed after an earlier verified copy. Never reuse that old verification.

create or replace function sat_private.reset_storage_checkpoint_on_source_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.source_checksum is distinct from new.source_checksum
     or old.source_generation is distinct from new.source_generation
     or old.size_bytes is distinct from new.size_bytes then
    new.copy_status := 'pending';
    new.target_bucket := null;
    new.target_path := null;
    new.target_sha256 := null;
    new.target_verified_bytes := null;
    new.error_code := null;
  end if;
  return new;
end;
$$;

revoke all on function sat_private.reset_storage_checkpoint_on_source_change()
  from public, anon, authenticated;

drop trigger if exists sat_reset_storage_checkpoint_on_source_change
  on migration_staging.storage_objects;
create trigger sat_reset_storage_checkpoint_on_source_change
before update on migration_staging.storage_objects
for each row
execute function sat_private.reset_storage_checkpoint_on_source_change();

comment on function sat_private.reset_storage_checkpoint_on_source_change() is
  'Invalidates a verified target checkpoint whenever the authoritative Firebase Storage generation changes.';
