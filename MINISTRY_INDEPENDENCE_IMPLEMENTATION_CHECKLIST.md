# Ministry Independence Implementation Checklist

## Overview
This checklist provides step-by-step instructions for implementing the Ministry app independence redesign.

---

## Pre-Implementation

- [ ] **Backup Database**: Create full Firestore backup
- [ ] **Document Current State**: Screenshot current ministry app functionality
- [ ] **Notify Users**: Inform ministry leaders of upcoming changes
- [ ] **Create Feature Branch**: `git checkout -b feature/ministry-independence`

---

## Phase 1: Disable Automatic Sync

### Cloud Functions (functions/index.js)

- [ ] **Comment out `syncMemberToMinistry` function** (lines 616-656)
  ```javascript
  // DISABLED: Automatic sync removed for ministry independence
  // exports.syncMemberToMinistry = functions.firestore...
  ```

- [ ] **Comment out `backfillMinistrySync` function** (lines 659-915)
  ```javascript
  // DISABLED: Manual backfill removed for ministry independence
  // exports.backfillMinistrySync = functions.https.onCall...
  ```

- [ ] **Comment out helper functions**:
  - `syncToMatchingMinistryChurches()` (lines 544-582)
  - `removeFromAllMinistryChurches()`
  - `findMinistryChurchesWithMinistry()` (lines 521-542)
  - `getOwnerChurchMapping()` (lines 497-518)

- [ ] **Deploy Cloud Functions**:
  ```bash
  cd functions
  npm run deploy
  ```

- [ ] **Verify deployment**: Check Firebase Console for successful deployment

### Test Sync Disabled

- [ ] Create new member in main church system
- [ ] Verify member does NOT appear in ministry app
- [ ] Confirm no sync errors in Cloud Functions logs

---

## Phase 2: Remove Sync Services

### Delete Files

- [ ] **Delete `services/bidirectionalSyncService.ts`**
  ```bash
  git rm services/bidirectionalSyncService.ts
  ```

- [ ] **Delete `services/ministrySimulationService.ts`**
  ```bash
  git rm services/ministrySimulationService.ts
  ```

- [ ] **Delete `hooks/useMinistrySync.ts`**
  ```bash
  git rm hooks/useMinistrySync.ts
  ```

- [ ] **Delete `docs/ministry-sync-implementation.md`**
  ```bash
  git rm docs/ministry-sync-implementation.md
  ```

### Update ministryFirebaseService.ts

- [ ] **Remove imports**:
  ```typescript
  // REMOVE:
  import {
    syncMemberToSourceChurch,
    syncAttendanceToSourceChurch,
    syncNewBelieverToSourceChurch,
    syncConfirmationToSourceChurch,
    determineSourceChurchForNewRecord
  } from './bidirectionalSyncService';
  ```

- [ ] **Simplify `ministryMemberService.add`** (lines 37-80):
  ```typescript
  add: async (member: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>, userProfile: any): Promise<string> => {
    // Simply add to current ministry church - no sync
    const memberData = {
      ...member,
      isNativeMinistryMember: true // All ministry members are native
    };
    return await membersFirebaseService.add(memberData);
  },
  ```

- [ ] **Simplify `ministryMemberService.update`** (lines 82-136):
  ```typescript
  update: async (memberId: string, updates: Partial<Member>, userProfile: any): Promise<void> => {
    // Simply update in current ministry church - no sync
    await membersFirebaseService.update(memberId, updates);
  },
  ```

- [ ] **Delete `transferMemberToConstituency` function** (lines 180-231)

- [ ] **Simplify attendance/newBeliever/confirmation services**:
  - Remove all `syncToSourceChurch` calls
  - Use base services directly

### Update firebaseService.ts

- [ ] **Remove sync-related exports**:
  ```typescript
  // REMOVE:
  export { runBackfillMinistrySync, runCrossMinistrySync } from './ministrySimulationService';
  ```

- [ ] **Remove sync trigger logic** in member operations

### Fix Import Errors

- [ ] Search for all imports of deleted files:
  ```bash
  grep -r "bidirectionalSyncService" .
  grep -r "ministrySimulationService" .
  grep -r "useMinistrySync" .
  ```

- [ ] Remove or update all found imports

- [ ] **Run TypeScript check**:
  ```bash
  npm run type-check
  ```

---

## Phase 3: Remove Approval System

### Delete Ministry Access Service

- [ ] **Delete `services/ministryAccessService.ts`**
  ```bash
  git rm services/ministryAccessService.ts
  ```

### Update types.ts

- [ ] **Remove `MinistryAccessRequest` interface**
  - Search for the interface definition
  - Delete entire interface
  - Remove from exports

### Update SuperAdminDashboard.tsx

- [ ] **Remove ministry approval state**:
  ```typescript
  // REMOVE:
  const [ministryAccountsNeedingApproval, setMinistryAccountsNeedingApproval] = useState<any[]>([]);
  const [reapproveWorkingUid, setReapproveWorkingUid] = useState<string | null>(null);
  ```

- [ ] **Remove `reapproveMinistryUser` function** (lines 439-455)

- [ ] **Remove ministry approval UI section** from render

- [ ] **Remove ministry access service imports**

### Update User Creation Flow

- [ ] **Find user creation in `firebaseService.ts`**

- [ ] **Remove ministry access request creation**:
  ```typescript
  // REMOVE any calls to:
  // ministryAccessService.ensureRequestForUser()
  // ministryAccessService.createRequest()
  ```

- [ ] **Remove approval status checks**:
  ```typescript
  // REMOVE checks for:
  // user.ministryAccess?.status === 'approved'
  ```

### Update FirebaseAppContext.tsx

- [ ] **Remove ministry access service imports**

- [ ] **Remove approval-related state and effects**

- [ ] **Remove approval notification logic**

---

## Phase 4: Clean Up Data Models

### Update Member Interface (types.ts)

- [ ] **Remove sync-related fields**:
  ```typescript
  export interface Member {
    // ... existing fields ...
    
    // REMOVE these fields:
    // syncedFrom?: { churchId: string; at: string }
    // syncOrigin?: string
    // sourceChurchId?: string
    // targetConstituencyId?: string
    
    // KEEP and document:
    /** TRUE for all members created in ministry app */
    isNativeMinistryMember?: boolean;
  }
  ```

- [ ] **Search for usage of removed fields**:
  ```bash
  grep -r "syncedFrom" .
  grep -r "syncOrigin" .
  grep -r "sourceChurchId" .
  grep -r "targetConstituencyId" .
  ```

- [ ] **Remove or update all usages**

### Update Member Creation

- [ ] **Update `MemberFormModal.tsx`**:
  ```typescript
  const initialFormData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'> = {
    // ... other fields ...
    isNativeMinistryMember: isMinistryContext, // TRUE in ministry mode
    // REMOVE: targetConstituencyId
  };
  ```

- [ ] **Remove constituency transfer UI**:
  - Remove "Transfer to Constituency" button/form
  - Remove `targetConstituencyId` field from form

### Update All Member Operations

- [ ] **Search for member creation calls**:
  ```bash
  grep -r "membersFirebaseService.add" .
  grep -r "ministryMemberService.add" .
  ```

- [ ] **Ensure all set `isNativeMinistryMember: true` in ministry context**

---

## Phase 5: Simplify Data Fetching

### Update ministryDataService.ts

- [ ] **Remove collection group queries**:
  ```typescript
  // DELETE:
  const fetchMinistryMembersViaCollectionGroup = async (ministryName: string): Promise<Member[]> => {
    // ... collection group logic ...
  };
  ```

- [ ] **Simplify to single-church queries**:
  ```typescript
  export const getMinistryMembers = async (
    churchId: string,
    ministryName: string
  ): Promise<Member[]> => {
    const q = query(
      collection(db, `churches/${churchId}/members`),
      where('ministry', '==', ministryName),
      where('isActive', '!=', false)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Member));
  };
  ```

- [ ] **Remove `aggregateMinistryData` function**

- [ ] **Remove cross-church data aggregation logic**

### Update FirebaseAppContext.tsx

- [ ] **Remove collection group listeners**

- [ ] **Use simple single-church queries**:
  ```typescript
  // In ministry mode:
  const membersQuery = query(
    collection(db, `churches/${currentChurchId}/members`),
    where('ministry', '==', activeMinistryName),
    where('isActive', '!=', false)
  );
  ```

- [ ] **Remove source church tracking**

- [ ] **Remove cross-church member deduplication**

---

## Phase 6: Update UI Components

### MemberFormModal.tsx

- [ ] **Remove sync-related UI elements**

- [ ] **Remove "Target Constituency" field**

- [ ] **Simplify to basic member creation**

- [ ] **Remove sync status indicators**

### Member List Views

- [ ] **Remove "Source Church" column/indicator**

- [ ] **Remove "Synced From" badges**

- [ ] **Remove cross-church member indicators**

### Ministry Dashboard

- [ ] **Remove sync status displays**

- [ ] **Remove "Sync Now" buttons**

- [ ] **Remove cross-ministry aggregation displays**

### Navigation/Menus

- [ ] **Remove "Sync Settings" menu items**

- [ ] **Remove "Ministry Sync" admin pages**

---

## Phase 7: Testing

### Unit Tests

- [ ] Test member creation in ministry app
- [ ] Test member updates in ministry app
- [ ] Test member deletion in ministry app
- [ ] Verify no sync calls are made

### Integration Tests

- [ ] Create member in main church
- [ ] Verify member does NOT appear in ministry app
- [ ] Create member in ministry app
- [ ] Verify member does NOT appear in main church
- [ ] Update member in ministry app
- [ ] Verify no sync to main church

### User Acceptance Testing

- [ ] Ministry leader can add members manually
- [ ] Ministry leader can view only their ministry members
- [ ] Ministry leader can update member information
- [ ] Ministry leader can delete members
- [ ] Leader invitations work without approval
- [ ] No sync-related errors in console

### Performance Testing

- [ ] Measure query performance (should be faster)
- [ ] Check for any slow queries
- [ ] Verify no unnecessary cross-church queries

---

## Phase 8: Deployment

### Pre-Deployment

- [ ] **Code review**: Get team approval
- [ ] **Final testing**: Run full test suite
- [ ] **Documentation**: Update user guides
- [ ] **Backup**: Final database backup

### Deployment Steps

- [ ] **Merge to main**:
  ```bash
  git checkout main
  git merge feature/ministry-independence
  ```

- [ ] **Deploy Cloud Functions**:
  ```bash
  cd functions
  npm run deploy
  ```

- [ ] **Deploy Frontend**:
  ```bash
  npm run build
  npm run deploy
  ```

- [ ] **Monitor logs**: Watch for errors

### Post-Deployment

- [ ] **Verify in production**: Test all ministry features
- [ ] **Monitor error logs**: Check for unexpected issues
- [ ] **User communication**: Notify users of changes
- [ ] **Support**: Be ready to assist users

---

## Rollback Plan

If issues arise:

- [ ] **Revert Cloud Functions**:
  ```bash
  firebase functions:delete syncMemberToMinistry
  # Re-deploy previous version
  ```

- [ ] **Revert Frontend**:
  ```bash
  git revert <commit-hash>
  npm run deploy
  ```

- [ ] **Restore Database** (if needed):
  - Use Firestore backup
  - Follow Firebase restore procedures

---

## Success Criteria

- ✅ No automatic sync between main church and ministry app
- ✅ Ministry leaders can manually add members
- ✅ No super admin approval required for ministry access
- ✅ Leader invitations work independently
- ✅ All ministry features work without main church dependency
- ✅ No sync-related errors in logs
- ✅ Performance improved (faster queries)
- ✅ Code is simpler and easier to maintain

---

## Notes

- Keep this checklist updated as you progress
- Mark items complete with timestamps
- Document any issues or deviations
- Update user documentation as features change


