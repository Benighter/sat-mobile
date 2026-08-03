# Native Auth enrollment test checkpoint — 2026-08-03

## Safety state

- Firebase remains the active authentication and push-notification provider.
- No Firebase user, Firestore document, Storage object, function, rule, billing setting, or project was deleted or disabled.
- The public SAT Mobile app was not deployed or cut over.
- The isolated hosted target remains `sat-mobile-test` in EU West.

## Credential incident response

- The one live administrator credential that had previously been committed in setup scripts was replaced with a random in-memory value.
- Existing refresh tokens were revoked, the exposed password was verified rejected, and Firebase accepted a password-reset email request.
- The setup scripts now require environment input and no replacement credential was printed or written to the repository.

## Hosted test deployment

Applied and verified:

1. `prepare_native_auth_identity_links`
2. `add_private_transactional_email_gate`
3. `add_native_auth_admin_status_gate`
4. `add_native_auth_enrollment_gate`
5. `harden_native_auth_mass_enrollment`

Active JWT-protected Edge Functions:

- `sat-transactional-email`
- `sat-admin-user-status`
- `sat-native-auth-enroll` (platform JWT pre-check disabled only because the
  caller uses a registered Firebase Third-Party Auth token; the handler's
  first database RPC verifies the exact Firebase issuer, audience, role, UID,
  and SAT profile before any privileged operation)

The transactional-email provider credential and sender configuration were transferred directly between server-side secret stores. No secret value was written to a file or printed. Both private tables use forced RLS, have no client table grants or policies, and the UID-link completion RPC is executable only by `service_role`.

## Enrollment behavior

- A current Firebase session is the proof of identity.
- The user must create a new 12+ character password on first open of the migration build.
- The Edge Function creates or reconciles a native Supabase Auth user and writes a private one-to-one link to the immutable Firebase UID.
- Existing `users/{firebaseUid}` paths, church scope, roles, tenant boundaries, and history remain unchanged.
- The current session continues through Firebase after enrollment; switching the default to native Supabase Auth is a separate release gate.
- The public enrollment release enables `VITE_REQUIRE_NATIVE_AUTH_ENROLLMENT=true`
  while keeping `VITE_AUTH_BACKEND=firebase`. Native Supabase sign-in remains a
  separate later cutover.
- Auth-only records without a preserved direct SAT profile are explicitly
  ineligible and bypass the enrollment screen so the release cannot trap them.

## Verification evidence

- TypeScript: passed.
- Five migrations: applied successfully in PGlite validation.
- Eight schema objects: verified.
- Three Edge Function entrypoints: syntax checked.
- Firebase rollback build: passed.
- Supabase-data/Firebase-auth migration build: passed.
- Local signed-in UI: displayed exactly one forced enrollment heading, two password fields, and one submit button.
- Hosted test state before user enrollment: zero native Auth users and zero verified UID links.
- First real enrollment: Edge Function v2 returned HTTP 200 and produced exactly one native Auth user and one verified one-to-one UID link. The link joins to exactly one existing SAT profile with preserved authorization scope; there are no duplicate, unverified, or orphan links.
- Post-enrollment visible UI: the same signed-in user reached the existing SAT Mobile settings/dashboard shell with the expected administrative access and constituency context.
- Unauthenticated requests to the email and admin-status functions: HTTP 401
  at the platform gateway. Unauthenticated or unrelated-project requests to
  native enrollment: rejected by the handler's Firebase-specific RPC before
  any service-role operation.
- Mass-rollout inventory: 141 active Firebase Auth records, 131 with a direct
  preserved SAT profile and no duplicate normalized emails, and 10 Auth-only
  records retained on Firebase fallback. The hardened status RPC is unavailable
  to `anon`, the private link table keeps forced RLS, and the enrollment handler
  rejects an unauthenticated request with HTTP 401.
- Final data checkpoint before release: 101,930 Firestore documents with zero
  source-only, published-only, or checksum-mismatched rows; 238 Storage objects
  with all 166,528,978 bytes verified.

## Google users and remaining release gate

- Two Firebase Auth accounts use Google.
- Both have verified, unique emails, but only one has a matching SAT profile; the other has no direct, UID-field, or unique-email profile record to map safely.
- The profiled Google account can use the same proven-Firebase-session password enrollment flow.
- Do not fabricate a tenant or profile for the unmatched Auth-only account. Its owner must identify the intended church/profile, or explicitly confirm it is an unused Auth record.

Before switching the default authentication provider to native Supabase Auth:

1. Build the isolated native-Auth login path and verify one native password sign-in against the same UID/profile and dashboard data.
2. Verify role and tenant isolation, realtime, Storage, and account disable/reactivate behavior.
3. Resolve or classify the unmatched Google Auth-only account.
4. Keep FCM for the client-update transition; replace it only after a native/in-app notification path has its own tested release.
