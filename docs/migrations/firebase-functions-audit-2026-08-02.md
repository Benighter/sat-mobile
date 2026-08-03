# Firebase Functions migration audit — 2026-08-02

## Scope and evidence

The read-only deployment inventory returned **27 ACTIVE Firebase Functions**, rather than the previously reported 25: 12 callable, 9 event-triggered, 4 HTTP, and 2 scheduled functions. Every deployed function remains enabled and unchanged. The inventory command was:

```powershell
pnpm exec firebase functions:list --project sat-mobile-de6f1 --json
```

The mapping below is based on deployed trigger metadata, the checked-in `functions/index.js`, TypeScript exports, and current client call sites. `reviewAccountDeletionRequest` is active in Firebase but has no implementation in the current working tree or Git history, so its deployed source must be recovered or its behavior observed before replacement.

Priority meanings:

- **P0:** frequent invocation, material cost, security exposure, or critical user flow.
- **P1:** user-visible backend dependency that should move before cutover.
- **P2:** maintenance/duplicate endpoint that can remain as rollback until its replacement is proven.

## Complete replacement map

| Firebase function | Trigger | Current responsibility | Supabase replacement | Priority | State |
|---|---|---|---|---|---|
| `autoMarkPrayerMissed` | schedule, every minute | Scans churches and writes missed prayer records | Private bounded/idempotent SQL procedure plus five-minute Supabase Cron | P0 cost | Supabase job and cron active; Firebase retained as rollback |
| `cleanupOldTokens` | schedule, daily | Removes stale/invalid FCM device tokens | Private bounded SQL expiry cleanup; invalid-token reconciliation remains in Firebase FCM delivery | P1 | Supabase job and cron active; Firebase retained for FCM reconciliation |
| `ensureSupabaseAuthenticatedRole` | Firebase Auth create | Adds the Postgres `authenticated` claim while Firebase supplies identity | Keep during Third-Party Auth; replace only after native Supabase Auth cutover | P0 identity | Retain |
| `syncSupabaseAuthorizationClaims` | Firestore user write | Mirrors church/role authorization facts into Firebase custom claims | Keep during Third-Party Auth; later use Supabase Auth metadata/admin hook with a database-owned authorization table | P0 identity | Retain |
| `onMemberCreated` | Firestore create | Increments cached active-member counts | Superseded by live `sat_get_member_counts`; no cached counter trigger is needed | P1 | Superseded in Supabase mode |
| `onMemberDeleted` | Firestore delete | Decrements cached active-member counts | Superseded by the same live aggregate | P1 | Superseded in Supabase mode |
| `onMemberUpdated` | Firestore update | Adjusts count after active-state changes | Superseded by the same live aggregate | P1 | Superseded in Supabase mode |
| `onAdminNotificationCreated` | Firestore create | Sends FCM for an in-app admin notification | Database webhook to authenticated push Edge Function; write delivery result transactionally | P1 | Planned |
| `onMemberDeletionRequestCreated` | Firestore create | Creates admin notifications and sends email/push | Database trigger for in-app records plus Firebase fallback for external delivery | P1 | Database trigger active; email/push retained in Firebase |
| `onMessageCreated` | Firestore create | Updates church-thread metadata/unread state and sends FCM | Database trigger for metadata plus Firebase fallback for FCM | P0 chat | Database trigger active; FCM retained in Firebase |
| `onGlobalMessageCreated` | Firestore create | Updates global-thread metadata/unread state and sends FCM | Same database trigger design with participant checks plus Firebase fallback for FCM | P0 chat | Database trigger active; FCM retained in Firebase |
| `checkEmailAvailability` | callable | Queries Firebase Auth before registration | Auth-gateway Edge Function while Firebase Auth remains authoritative; later native Supabase Auth signup handling | P1 signup | Firebase retained |
| `getMemberCounts` | callable | Counts active members across requested churches | RLS-scoped `sat_get_member_counts` aggregate RPC; rejects unauthorized church IDs | P1 | Active and verified in Supabase mode |
| `recomputeMemberCounts` | callable | Globally rewrites cached counts | Retired in Supabase mode because counts are live aggregates rather than cached values | P1 security | Superseded by aggregate RPC |
| `purgeInactiveMembers` | callable | Permanently deletes inactive member documents | Audited admin-only archival/purge job with preview and explicit confirmation | P1 destructive | Deferred |
| `relayPersistImage` | callable | Relays profile/content images into Firebase Storage | Direct private Supabase Storage upload with path RLS | P0 storage | Active and verified in Supabase mode |
| `relayUploadChatImage` | callable | Verifies participant and relays chat image upload | Direct private Supabase Storage upload with participant/path RLS | P0 chat/storage | Active and verified in Supabase mode |
| `setUserActiveStatus` | callable | Updates profile, Firebase Auth disabled state, and tokens | Existing tenant-scoped database RPC plus a privileged native Supabase Auth status Edge Function | P0 admin | Native replacement prepared locally; Firebase remains active until Auth migration |
| `hardDeleteUserAccount` | callable | Deletes Firebase Auth and related records | Audited Edge Function orchestrator with soft-delete/tombstone first and reversible reconciliation | P0 destructive | Deliberately blocked in Supabase mode |
| `reviewAccountDeletionRequest` | callable | Deployed behavior not present in current source | Recover behavior, then use audited Edge workflow/database transaction | P0 unknown | Blocked on source recovery |
| `searchAdminUserByEmail` | callable | Finds a minimal active-admin profile for invites | `sat_search_admin_by_email` security-definer RPC with caller and result-field restrictions | P1 invite | Active and verified in Supabase mode |
| `searchAdminUserByEmailHttp` | HTTP | Duplicate CORS-enabled admin lookup | Same RPC; retain Firebase endpoint only for old-client rollback | P2 duplicate | Superseded in the new build |
| `sendBirthdayEmail` | callable | Admin-triggered birthday email via secret providers | Authenticated Edge Function with admin authorization, private rate audit, and project secrets | P1 email | Replacement prepared locally; not deployed and no secrets copied |
| `sendBirthdayEmailHttp` | HTTP | Duplicate HTTP birthday email endpoint | Same Edge Function; remove duplicate route after verification | P2 duplicate | Replacement prepared locally; Firebase endpoint retained |
| `sendPushNotification` | callable | Sends FCM and reconciles invalid tokens | Authenticated, rate-limited Edge Function using FCM credentials | P0 notifications | Planned |
| `sendNotificationHTTP` | HTTP | Duplicate HTTP push delivery | Same push Edge Function; remove permissive duplicate | P1 security | Planned |
| `backfillMinistrySyncHttp` | HTTP | One-off cross-church member backfill | Idempotent operator-run migration command or restricted database batch; not a permanent public endpoint | P1 security | Planned |

## First isolated test batch

The first batch consolidates four low-risk dependencies without touching Firebase:

1. `searchAdminUserByEmail` and `searchAdminUserByEmailHttp` become one read-only `sat_search_admin_by_email` RPC.
2. `relayPersistImage` and `relayUploadChatImage` are already replaced in Supabase mode by direct private Storage access governed by path/participant RLS.

The new lookup RPC:

- accepts Firebase Third-Party Auth tokens only;
- requires the caller's mirrored profile to be an active main admin;
- returns only the minimal active-admin fields used by the invite screen;
- deterministically prefers the normal/ministry account matching the inviter mode;
- grants execution to `authenticated` only and exposes no table access to `anon`.

## Verification evidence

- Hosted test migrations `20260802152437_add_admin_email_search_rpc` and `20260802152918_harden_admin_email_search_result` are applied to `sat-mobile-test` only.
- Aggregate-only database contract checks passed for an active main admin, an invalid identity token, and a valid non-admin identity.
- The function is `STABLE`, has an empty `search_path`, and is executable by `authenticated`; `anon` and `public` have no execute grant.
- Its result was reduced to the eight fields required by the invite flow; phone and profile-image fields are not returned.
- `pnpm exec tsc --noEmit` passed.
- Firebase rollback and Supabase-with-rollback Vite builds both passed. Existing bundle-size and dynamic-import warnings remain non-blocking.
- Supabase Security Advisor reports the expected warning that an authenticated role can execute this intentional `SECURITY DEFINER` RPC. Its internal token/profile/role checks and aggregate denial tests passed. The remaining advisor findings predate this batch and concern isolated private staging tables or the existing admin-status RPC.

The final signed-in localhost session passed on the Supabase default: the tenant dashboard rendered non-zero migrated data, the private Supabase profile image loaded, no visible error banner appeared, and runtime console errors were zero. The explicit Firebase build also passed and remains the rollback override.

Firebase is preserved for identity continuity, FCM/email delivery, destructive/admin workflows, old clients, and rollback. The new build defaults to Supabase for documents and media; this is a supported hybrid cutover, not a claim of complete Firebase independence.
