# Firebase independence inventory — 2026-08-03

## Current conclusion

SAT Mobile is **not Firebase-independent yet**. Supabase is the default document and media backend, but production identity, email verification/reset, push delivery, several privileged workflows, and every older client still depend on Firebase. Firebase must remain live until native Supabase Auth users and UID links exist, the released clients use them, and the remaining external-delivery choices are verified.

This phase made no Firebase, Supabase, billing, rules, login, or release change. The native replacements described below are local-only and disabled by default.

## Read-only evidence

### Authentication and identity

- Firebase Auth contains **141 users**: **139 password identities** and **2 Google identities**.
- All **141 Firebase UIDs are non-UUID, 28-character identifiers**. Native Supabase Auth IDs are UUIDs, so the legacy UID cannot be written directly into `auth.users.id`.
- All 141 still carry the Firebase Third-Party Auth `authenticated` claim. No claim update is pending.
- Firebase last-sign-in aggregates at inventory time: **1 in 24 hours**, **8 in 7 days**, **21 in 30 days**, and **0 never signed in**.
- Hosted `sat-mobile-test` currently has **0 native Supabase Auth users**. Its only deployed Edge Function is the retired, JWT-protected `sat-migration-ingest` handler.
- The current Supabase client obtains a Firebase ID token. Existing RLS resolves `auth.jwt()->>'sub'` as the immutable Firebase UID; all user paths, participants, access-index keys, Storage paths, and tenant checks rely on it.
- Login, registration, ministry aliases, email verification, password reset/change, session observation, and the verification gate import Firebase Auth directly.
- Supabase's published Firebase import utility creates a new UUID and an empty `encrypted_password`; its first-login password middleware is marked work in progress. A direct run of that utility would not preserve current passwords.

### Signup email check and account email

- Normal registration calls the deployed `checkEmailAvailability` Firebase callable before account creation.
- Email verification, resend, verification polling, password reset, and password change are direct Firebase Auth operations.
- Native Supabase Auth can replace these operations, but the current hosted project has no native users and the Auth UI/context is not yet switched to the isolated native adapter.

### Push and notifications

- Web push uses Firebase Messaging, a Firebase messaging service worker, and the Firebase VAPID configuration.
- Android includes `google-services.json`, Capacitor Push Notifications, Firebase notification metadata, and FCM token registration.
- `sendPushNotification`, `sendNotificationHTTP`, `onAdminNotificationCreated`, `onMemberDeletionRequestCreated`, `onMessageCreated`, and `onGlobalMessageCreated` still perform external FCM delivery.
- Supabase already supplies in-app notifications, Realtime changes, chat metadata/unread updates, and deletion-request notification rows. It does not provide an independent Android background-push transport.

### Transactional email

- Birthday and deletion-request email still use `sendBirthdayEmail`, `sendBirthdayEmailHttp`, or Firebase-triggered delivery.
- A browser-local Brevo-key path existed. It has been removed locally; provider secrets now belong only in an authenticated Edge Function environment.
- A local `sat-transactional-email` Edge Function and private rate/audit gate are prepared. They persist no recipient address or body, authorize the caller against the SAT profile, allow only administrators, and cap calls per minute/day.
- The replacement is not deployed and has no provider secret configured.

### Admin, destructive, and recovered-source workflows

- `getMemberCounts`, admin email search, media relays, chat metadata, in-app deletion notifications, prayer maintenance, and stale-token expiry have Supabase-native replacements.
- `setUserActiveStatus` is still hybrid because Firebase Auth owns the disabled flag. A local native Supabase status Edge Function is prepared; it resolves the target UUID through a tenant-scoped private UID link, bans/unbans through server-only Auth administration, updates the legacy SAT profile, and attempts rollback if the second step fails.
- `hardDeleteUserAccount` remains deliberately blocked in Supabase mode. The Firebase implementation deletes Auth and related records; that conflicts with the requirement to preserve identity/history until a separately approved retention/deletion design exists.
- The deployed `reviewAccountDeletionRequest` implementation is absent from the working tree and all inspected Git history. A read-only Cloud Functions metadata/source check exposed no readable source archive to the current account, so it cannot be recreated safely by guessing.
- The current account-deletion request is stored in the member-deletion collection with `target: account`, but the checked-in approval handler only deletes member/outreach targets. For an account target it can mark the request approved without deleting the Auth account. This must be corrected before claiming account-deletion parity.
- `purgeInactiveMembers` is destructive and remains deferred. `backfillMinistrySyncHttp` is an operator backfill, not a permanent runtime service.

### Deployed Firebase Functions

The read-only deployment inventory found **27 ACTIVE functions**: **12 callable, 9 event-triggered, 4 HTTP, and 2 scheduled**.

- Native/superseded in the new data backend: `getMemberCounts`, `searchAdminUserByEmail`, `searchAdminUserByEmailHttp`, `relayPersistImage`, `relayUploadChatImage`, `onMemberCreated`, `onMemberDeleted`, `onMemberUpdated`, `recomputeMemberCounts`, `autoMarkPrayerMissed`, and the in-app/database parts of the two chat and deletion triggers.
- Identity transition: `ensureSupabaseAuthenticatedRole`, `syncSupabaseAuthorizationClaims`, `checkEmailAvailability`, and the Auth portion of `setUserActiveStatus`.
- External delivery: `sendBirthdayEmail`, `sendBirthdayEmailHttp`, `sendPushNotification`, `sendNotificationHTTP`, `onAdminNotificationCreated`, and the email/push portions of the deletion/chat triggers.
- Destructive or unrecovered: `hardDeleteUserAccount`, `purgeInactiveMembers`, and `reviewAccountDeletionRequest`.
- Maintenance/rollback: `cleanupOldTokens` and `backfillMinistrySyncHttp`.

All remain enabled and unchanged.

### Older clients and release adoption

- Release 2.0.9 is the latest hybrid release. At inventory time its Android APK had 3 downloads and its update manifest 2 downloads; the desktop installer and desktop update metadata had 0 downloads.
- Android updates are optional. Desktop updates auto-download but users can postpone installation until close.
- No reliable installed-version/adoption telemetry exists. Older clients can still authenticate and write to Firebase, so Firebase delta capture and the old endpoints cannot be retired based on release publication alone.

## Safe local implementation completed

1. `VITE_AUTH_BACKEND` is introduced and defaults to `firebase`.
2. A native Supabase Auth adapter supports password sign-in/signup, reset/change, sign-out, session observation, and retrieval of the immutable legacy SAT identity. It is isolated and not wired into production UI.
3. A forced-RLS, no-client-grant `sat_private.auth_identity_links` design maps native UUIDs one-to-one to legacy Firebase UIDs. Existing Firebase JWT behavior is preserved, while verified native users can resolve the same document paths and tenant history.
4. Native authorization falls back to the existing SAT profile for role, super-admin, ministry, church, and cross-tenant checks rather than trusting client-editable metadata.
5. Local server-only transactional-email and native account-status Edge Functions are prepared with authenticated database gates, tenant checks, bounded rate accounting, and no secret logging.
6. Client-side direct Brevo-secret use was removed. Supabase mode tries the Edge Function first and retains the authenticated Firebase function only as rollback.
7. A committed client-side super-admin credential and local-storage bypass were removed. Super-admin UI access now requires the authenticated profile's `superAdmin` flag.
8. “Remember me” no longer stores plaintext passwords. Existing remembered records are sanitized to email and mode only; Auth session persistence remains responsible for login continuity.
9. Super-admin setup scripts now require environment-supplied credentials and no longer print them.
10. The Firebase inventory script now reports only aggregate UID shape, provider, claim, and activity counts.

## Validation

- `pnpm exec tsc --noEmit`: passed.
- Supabase-default Vite build: passed.
- Explicit Firebase rollback Vite build: passed.
- In-memory Postgres execution of all three new migrations: passed; five expected identity/email/status objects verified.
- TypeScript syntax check for both new Edge Functions: passed.
- Read-only hosted checks: project is healthy, native Auth users = 0, and none of the new migrations/functions are deployed.
- Hosted CLI migration history differs from the filenames in the working tree. A normal `supabase db push` is therefore intentionally not used; future hosted DDL should be applied as named migrations after exact review, without repairing or rewriting existing history opportunistically.

## Completion path and approval gates

1. **Urgent credential hygiene:** rotate the previously committed live super-admin password and invalidate its sessions. This is a live Firebase Auth change and requires an explicit approval immediately before execution.
2. **Hosted test schema gate:** apply the three reviewed native-auth/email/status migrations and deploy the two JWT-protected Edge Functions to `sat-mobile-test`. Configure the email provider key and verified sender as Edge secrets. This changes hosted state and secret custody and requires explicit approval.
3. **Password-continuity test gate:** implement and deploy a bounded first-login bridge. Try native Supabase Auth first; for an unmigrated password user, verify once with Firebase, create/update the native Supabase user, record the private UID link, set the same password in Supabase, and immediately continue with a native session. Store no plaintext password and log aggregates only. This temporarily uses Firebase until each user transitions.
4. **OAuth gate:** configure Supabase Google OAuth and explicitly map/test the 2 Google identities. Do not auto-link solely by an unverified email.
5. **Native-auth application test:** wire the Auth UI and app context to the feature flag; test normal/ministry login, email confirmation, reset/change, disabled users, super-admin, invites, tenant isolation, Storage, Realtime, and rollback with designated test identities.
6. **Push product decision:** choose either (a) retain FCM as a standalone residual dependency, or (b) accept Supabase Realtime while open plus Android background polling/local notifications, which is Firebase-independent but not instant. A complete Firebase-independent result requires option (b) or another independently hosted Android transport.
7. **Release/adoption gate:** publish a higher desktop/Android version only after signed-in E2E and security checks. Add a minimum-supported-version policy and adoption reporting that records no PII. Keep Firebase delta sync and functions during an observation window because update installation is not guaranteed.
8. **Final cutover gate:** run bounded Firestore/Auth/Storage reconciliation, verify native login for every provider class and tenant role, switch `VITE_AUTH_BACKEND` only in a new release, and retain Firebase rollback. Retirement, billing change, disablement, or deletion remains a separate later approval.

## Primary references

- [Supabase Firebase Auth migration guide](https://supabase.com/docs/guides/platform/migrating-to-supabase/firebase-auth)
- [Supabase community migration importer source](https://github.com/supabase-community/firebase-to-supabase/blob/main/auth/import_users.js)
- [Supabase Firebase Third-Party Auth](https://supabase.com/docs/guides/auth/third-party/firebase-auth)
- [Supabase native Auth](https://supabase.com/docs/guides/auth)
- [Supabase server-side user administration](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid)
- [Firebase Auth export/import](https://firebase.google.com/docs/cli/auth)
