# SAT Mobile Firebase-to-Supabase migration: Phase 1 assessment

Status: Phase 1 assessment and Phase 2 local-only staging validation complete. Firebase remains the live backend. No cloud resource, billing setting, production record, credential, or deployed application was changed.

## Recommended migration shape

Use a staged, reversible backend migration with Firebase Auth retained temporarily as Supabase Third-Party Auth. This lets database, Storage, Realtime, and server behavior move to Supabase without forcing existing users to reset passwords during the first cutover.

The initial application switch must be controlled by a backend-provider feature flag that defaults to `firebase`. Firebase remains authoritative until Supabase has passed count, checksum, permission, login, realtime, offline, and end-to-end tests and the user explicitly approves cutover.

Do not attempt a direct one-step replacement. SAT Mobile depends on Firebase-specific offline behavior, nested document paths, realtime listeners, callable functions, scheduled functions, push messaging, and UID-based tenant rules.

## Evidence from the current repository

- Firebase project: `sat-mobile-de6f1`; configured Storage bucket: `sat-mobile-de6f1.firebasestorage.app`.
- Client platform: React/Vite plus Android Capacitor and Windows Electron.
- Direct Firebase footprint: 30 project-controlled files import Firebase modules.
- Observed operation counts in source: 62 `onSnapshot` listeners, 115 `getDocs`, 60 `getDoc`, 35 `setDoc`, 19 `addDoc`, 77 `updateDoc`, and 25 `deleteDoc` calls.
- Authentication uses email/password, email verification, password reset/change, account disabling, and a second ministry identity based on a `+ministry` email alias.
- The app uses root user profiles whose document ID is normally the Firebase UID, but login contains a legacy repair path for profiles created under auto-generated document IDs.
- Firestore is multi-tenant. Core tenant data is nested under `churches/{churchId}`; root collections also coordinate users, campuses, invitations, cross-tenant access, ministry access, notifications, and global chat.
- The service layer names at least 22 church subcollections: attendance, bacentas, bussing, confirmations, customPrayerRecords, customPrayers, guests, headCounts, meetings, memberDeletionRequests, members, ministryExclusions, ministryMemberOverrides, newBelievers, outreachBacentas, outreachMembers, prayers, prayerSchedules, sonsOfGod, sundayOfferings, tithes, and transport. Chat, notifications, device tokens, locks, and audit/stat collections add further paths.
- Storage paths include `users/{uid}`, `chat/{scope}/{threadId}`, and `churches/{churchId}/sundayOfferings/...`. Stored Firestore records can contain both object paths and Firebase download URLs.
- The deployed backend was observed with 25 active first-generation Cloud Functions. The repository includes callable/HTTP functions, Firestore triggers, push/email work, Storage relays, account administration, two active schedules, and additional TypeScript scheduled-function sources.
- `autoMarkPrayerMissed` is scheduled every minute and reads the root churches collection on every invocation. Reimplement it as a targeted SQL/cron job, not a literal minute-by-minute port.
- The existing in-app `exportChurchData` is not a full backup: it exports only members, bacentas, new believers, and attendance. It omits most collections, root data, Auth, Storage, chat subcollections, and function/config state.
- No `firestore.indexes.json` is present, so live Firestore indexes must be inventoried separately before translating query behavior.

## Security findings that must affect the Supabase design

The repository's configured `firestore.rules` begins with a recursive `allow read, write: if true`. That blanket rule overrides the more detailed tenant and role checks below it. Whether or not that exact file is currently deployed, Supabase must not reproduce this posture.

The repository's Storage rules are also broader than the intended tenant model:

- Any signed-in user can read/write church and chat media paths.
- Any visitor can read user-profile media.
- Uploads allow up to 100 MiB for images, PDF, or generic binary content.

Every exposed Supabase table and Storage bucket needs least-privilege RLS. Authorization data must come from server-controlled profile/access tables or immutable app metadata, not user-editable metadata. Firebase UID compatibility should use `auth.jwt()->>'sub'` as text during the bridge because Firebase UIDs are not guaranteed to be PostgreSQL UUIDs.

## Identity and login continuity

### Phase A: bridge, recommended for the first backend cutover

1. Keep Firebase Auth live.
2. Configure the isolated Supabase test project to accept JWTs only from Firebase project `sat-mobile-de6f1`.
3. Add the required server-controlled `role: authenticated` custom claim to test users first, then to production Firebase users only after explicit approval.
4. Configure the Supabase client with an `accessToken` callback that supplies the current Firebase ID token.
5. Key application profiles and access mappings by a text `firebase_uid`/JWT subject during the bridge.

This preserves existing passwords and login behavior. It also lets the database and Storage migration be tested before changing the identity provider.

### Phase B: native Supabase Auth, later and separately approved

After the Supabase backend is stable, choose one of these tested approaches:

- Import Firebase Auth users and Firebase SCRYPT password-hash parameters using Supabase's supported Firebase migration tooling, preserving email-verification and disabled state; or
- Run a rolling first-login migration that verifies the existing Firebase password and sets a Supabase password, then backfill inactive accounts safely.

Maintain an explicit `firebase_uid -> supabase_user_id` mapping. Do not rewrite domain foreign keys in place without a complete mapping, uniqueness validation, and rollback checkpoint. Existing Firebase access tokens cannot become native Supabase sessions; the bridge avoids making that a first-cutover problem.

## Data and Storage model

Use two layers:

1. A private, lossless `migration_staging` schema stores every source document path, original JSON payload, timestamps, checksum, identity mapping, Storage manifest row, and validation result. It is not exposed to `anon` or `authenticated` roles.
2. Normalized application tables provide relational keys, constraints, indexes, and RLS. Normalize high-value/query-heavy entities first: churches, profiles, church access, members, bacentas, attendance, prayers, schedules, meetings, confirmations, offerings, chats, messages, invitations, and cross-tenant grants. Less mature collections can retain a validated JSONB payload initially if their query requirements are indexed.

Preserve every Firestore document ID in a `firebase_document_id` column. Preserve all source timestamps separately from migration timestamps. Never infer tenant ownership from a URL or client-supplied church ID.

Create separate private buckets/policies for church media, chat media, and public profile media. Keep source paths in a migration manifest and rewrite Firebase URLs only after the copied object's size/checksum and authorized retrieval have been verified.

## Full backup and export plan

Before transferring any production record:

1. Record the Firebase project number/ID, database location, Auth provider configuration, password-hash parameters, Storage bucket/location, deployed functions, schedules, rules, indexes, extensions/APIs, and current application release.
2. Create an immutable Firestore managed export or equivalent complete recursive export. The export target, retention, encryption, access, and estimated Storage cost require approval.
3. Export Firebase Auth users, provider data, verification/disabled state, and password-hash metadata into an encrypted, access-restricted working directory outside the repository.
4. Produce a complete Storage manifest with object path, size, generation, content type, metadata, and checksum; then copy objects without deleting or moving sources.
5. Capture per-collection/per-church counts, deterministic document checksums, orphan references, duplicate emails, legacy user-profile IDs, and every media reference.
6. Hash and archive the exact Firebase rules and function sources used for the snapshot.
7. Run a second delta export immediately before any future cutover.

The repository ignore rules now exclude migration artifacts and common credential/export filenames, but real credentials and raw production exports must also live outside the repository with restricted filesystem permissions.

## Implementation order

1. **Inventory:** obtain read-only live counts and configuration metadata; resolve missing indexes and deployed-rule uncertainty.
2. **Create isolated Supabase test project:** user selects organization, region, and plan. Apply migrations from source control, run Security Advisor, and keep public access closed.
3. **Auth bridge test:** configure Firebase Third-Party Auth for test users and validate tenant RLS using positive and negative tests.
4. **Lossless test import:** import an approved, minimized test copy into `migration_staging`; validate counts/checksums; transform into normalized tables; copy and verify approved Storage objects.
5. **Backend adaptation:** add a provider interface so Firebase and Supabase implementations can run side-by-side. Port database triggers, Edge Functions, Cron, email, Storage relays, and notification behavior. Keep FCM/Capacitor push independently until an equivalent is verified.
6. **Client adaptation:** replace Firebase queries/listeners incrementally with Supabase queries and Realtime subscriptions. Add an explicit IndexedDB cache/outbox and conflict policy because Supabase does not provide Firestore's automatic offline persistence semantics.
7. **End-to-end verification:** exercise web, Android, and Electron flows for login, verification/reset, ministry aliases, tenant switching, cross-tenant access, CRUD, attachments, chat/realtime, notifications, exports, offline/reconnect, and destructive permission checks.
8. **Shadow and delta:** keep Firebase authoritative; compare shadow reads and checksums. If dual-write is introduced, make operations idempotent and log reconciliation failures without deleting either source.
9. **Approval for cutover:** present evidence, remaining differences, rollback point, cost impact, and maintenance window. Switch the feature flag only after explicit approval.
10. **Retirement later:** after an agreed observation window and separate approval, stop writes, archive final exports, and only then consider disabling functions, changing billing, or retiring Firebase. No deletion is part of the migration cutover itself.

## Validation gates

- Counts match by root collection, church, subcollection, and status category.
- Document checksum mismatch count is zero or every exception is explained.
- Storage object path, byte size, checksum, content type, and retrieval authorization match.
- All active test users can authenticate without password reset; verified and disabled states behave correctly.
- Same-church, ministry-context, cross-tenant, chat-participant, and super-admin access work; forbidden cross-tenant reads/writes fail.
- Realtime updates do not duplicate events and reconnect cleanly.
- Offline-created changes replay once, in order, with documented conflict behavior.
- Functions and cron jobs are idempotent and bounded; email/push calls are suppressed or redirected in test.
- Web, Android, and Electron builds pass targeted regression tests.
- Firebase remains usable throughout rollback testing.

## Approval gates still required

Explicit user confirmation is required immediately before each of these actions:

1. Creating a hosted Supabase project, including the exact organization, region, and plan.
2. Linking/configuring Firebase Third-Party Auth or changing Firebase custom claims for any production user.
3. Exporting, decrypting, or transmitting any production user record, password-hash material, Firestore document, or Storage object to Supabase or another location.
4. Creating a billable backup/export bucket or making any billing/plan change.
5. Deploying schema, Edge Functions, secrets, Storage policies, or app code to a hosted environment.
6. Enabling production dual-write or changing the authoritative backend.
7. Performing the live cutover.
8. Disabling, downgrading, deleting, or retiring any Firebase resource or data.

## Phase 2 local verification (2026-08-01)

- Docker Desktop 4.84.0 and Docker Engine 29.6.2 are installed and running on WSL 2.7.11 (kernel 6.18.3.33.2-2).
- Supabase CLI 2.111.0 started the isolated `sat-mobile-supabase-test-local` stack successfully using PostgreSQL 17.6.1.156.
- Local analytics/log collection is explicitly disabled. It is unnecessary for migration validation and avoiding it keeps Docker's unauthenticated TCP API disabled.
- `supabase db reset` applied migration `20260801000100` successfully from a clean local database.
- The private `migration_staging` schema contains exactly five expected tables: `migration_runs`, `auth_identity_map`, `firestore_documents`, `storage_objects`, and `validation_results`.
- Row-level security is enabled and forced on all five tables. The schema has zero policies, no `anon` or `authenticated` schema usage, and zero client-role table grants.
- Direct negative probes confirmed that both `anon` and `authenticated` are denied reads from the staging schema.
- A synthetic migration-run/document transaction inserted successfully under the local database administrator and rolled back to zero rows.
- `supabase db lint --local` reported no schema errors.
- Required local services are running: database, Auth, REST, Storage, Realtime, Studio, gateway, mail capture, metadata, and edge runtime. No hosted Supabase project is linked.

## Current blockers

- A hosted Supabase test project has not been selected or approved for creation.
- No approved production/test data sample has been transferred.
- Live Firebase rules, indexes, collection counts, Auth counts, and Storage inventory have not yet been exported.
- Supabase CLI 2.111.0 is installed as a pinned project development dependency and its command entry point is verified.
- The local Docker/Supabase prerequisite is no longer a blocker; the staging migration has passed local reset, lint, privilege, RLS, and transaction checks.
