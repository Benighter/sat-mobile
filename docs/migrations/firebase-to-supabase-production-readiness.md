# Firebase to Supabase production readiness

## Cutover state

- The application build now defaults to Supabase unless `VITE_DATA_BACKEND=firebase` is set explicitly.
- `VITE_FIREBASE_ROLLBACK_WRITES` defaults on unless it is explicitly set to `false`, preserving Firebase as rollback for writes made by the new build.
- Firebase documents, Auth users, Storage objects, functions, rules, billing settings, and projects remain enabled and unchanged.
- Hard account deletion remains blocked in Supabase mode until cross-backend deletion can be made atomic.

## Final bounded reconciliation

Validated private run: `b7f51a36-9a1d-4c72-8e65-0e3f2b6c90d1`.

- Firestore: 101,930 staged and 101,930 published documents; zero source-only paths, target-only paths, or checksum mismatches.
- Storage: 238 current source objects and 238 verified target objects; 166,528,978 source and verified bytes; zero source-only or target-only paths.
- Auth: 141 Firebase identities inventoried and all 141 carry the Supabase `authenticated` claim. Existing Firebase UIDs remain the identity key.
- The resumable Storage pass reused 237 verified checkpoints, transferred the one newly discovered object, and removed all temporary local copies.

## Verified hosted state

- Supabase project: `sat-mobile-test` (`ftbsocbwxbfqejapdthj`), EU West, Free plan.
- Firebase Third-Party Auth is configured for `sat-mobile-de6f1`.
- `public.sat_documents` uses forced RLS and is published to Supabase Realtime.
- Migration and archive tables remain forced-RLS private with no client policies; their Security Advisor INFO notices are intentional.
- The private media bucket is `sat-mobile-media` and the signed-in application resolves migrated media through Supabase.
- The temporary migration Edge Function is retired and rejects unauthenticated requests before its inert handler.
- Bounded Supabase Cron jobs are active for missed-prayer maintenance every five minutes and token cleanup daily.

## Application validation

- `pnpm exec tsc --noEmit` passed.
- The Supabase-default optimized web build passed.
- The explicit Firebase rollback build passed.
- The Windows installer build passed locally.
- The Android debug build and Capacitor sync passed locally.
- A real existing signed-in user session rendered the correct tenant dashboard with non-zero data, no visible error banner, zero console errors, and no broken images; the migrated profile image was served by Supabase.
- Tenant-isolation simulation passed: the caller's tenant was visible, a different tenant was hidden, and anonymous table select was denied.

## Deliberately retained Firebase dependencies

- Firebase Auth remains authoritative for login continuity. `ensureSupabaseAuthenticatedRole` and `syncSupabaseAuthorizationClaims` remain required by Supabase Third-Party Auth.
- Firebase Cloud Messaging and secret-backed email delivery remain behind the authenticated Firebase function fallback.
- `checkEmailAvailability` still queries Firebase Auth during signup.
- `setUserActiveStatus` remains hybrid because Firebase Auth disabled-state administration is not a database-only operation.
- `hardDeleteUserAccount`, `purgeInactiveMembers`, and the unrecovered `reviewAccountDeletionRequest` are intentionally not recreated as unsafe approximations.
- `backfillMinistrySyncHttp` remains an operator-only Firebase fallback rather than a permanent Supabase public endpoint.
- Older installed clients can still write directly to Firebase. They require monitored delta synchronization until updated-client adoption is confirmed; the new build's rollback mirror does not reverse-mirror old-client Firebase writes into Supabase.

## Distribution boundary

The cutover release is version `2.0.9` with Android `versionCode` 20009. The prior immutable desktop tag remains `desktop-v2.0.8`; no existing release is overwritten. Desktop and Android publication remain tag-driven through their existing workflows.
