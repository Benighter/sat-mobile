-- Private object-byte destination for the verified Firebase migration snapshot.
-- No client policy is created; only authenticated migration tooling can populate it.

insert into storage.buckets (id, name, public)
values ('firebase-migration-staging', 'firebase-migration-staging', false)
on conflict (id) do update
set public = false;
