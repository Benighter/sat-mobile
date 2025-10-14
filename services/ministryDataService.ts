/**
 * Ministry Data Service
 *
 * This service fetches data across all churches for ministry mode,
 * similar to how SuperAdmin aggregates data from multiple constituencies.
 */

import {
  collection,
  collectionGroup,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  onSnapshot,
  limit,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../firebase.config';
// Fetch ministry members across ALL churches using collection group (requires rules)
const fetchMinistryMembersViaCollectionGroup = async (ministryName: string): Promise<Member[]> => {
  try {
    const q = query(collectionGroup(db, 'members'), where('ministry', '==', ministryName));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(snap => {
      const churchId = (snap.ref.parent.parent && (snap.ref.parent.parent as any).id) || 'unknown';
      return {
        id: snap.id,
        ...snap.data(),
        sourceChurchId: churchId
      } as any as Member;
    });
    const filtered = items.filter(m => m.isActive !== false);
    filtered.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
    return filtered;
  } catch (e) {
    console.warn('⚠️ Collection group fetch failed (members):', e);
    return [];
  }
};

import { Member, Bacenta, AttendanceRecord, NewBeliever, SundayConfirmation, Guest } from '../types';
import { ministryExclusionsService, ministryMemberOverridesService } from './firebaseService';

export interface MinistryAggregatedData {
  members: Member[];
  bacentas: Bacenta[];
  attendanceRecords: AttendanceRecord[];
  newBelievers: NewBeliever[];
  sundayConfirmations: SundayConfirmation[];
  guests: Guest[];
  sourceChurches: string[]; // List of church IDs that contributed data
}

// Helper: Dedupe members across multiple churches with safe rules:
// - Always keep unique pairs by (sourceChurchId, id)
// - If the same id appears both in the ministry church and a non-ministry church,
//   prefer the non-ministry-church copy (so the canonical source record wins)
const dedupeMembers = (items: Member[], currentChurchId?: string): Member[] => {
  const seenComposite = new Set<string>();
  const nonMinistryById = new Map<string, Member>();



  // First pass: index non-ministry copies by id
  for (const m of items) {
    const src = (m as any).sourceChurchId;
    const isMinistry = currentChurchId && src === currentChurchId;
    if (!isMinistry) {
      // Only set the first encountered non-ministry copy; order upstream is acceptable
      if (!nonMinistryById.has(m.id)) nonMinistryById.set(m.id, m);
    }
  }

  // Second pass: build output honoring preference rules
  const result: Member[] = [];
  for (const m of items) {
    const src = (m as any).sourceChurchId || 'unknown';
    const compositeKey = `${src}_${m.id}`;
    if (seenComposite.has(compositeKey)) continue; // exact duplicate

    const isMinistry = currentChurchId && src === currentChurchId;
    const hasNonMinistry = nonMinistryById.has(m.id);

    // If this is a ministry-church copy and we already have a non-ministry copy for same id, skip it
    if (isMinistry && hasNonMinistry) continue;

    seenComposite.add(compositeKey);
    result.push(m);
  }

  return result;
};

// Get all churches that have members with a specific ministry (SuperAdmin style)
export const getChurchesWithMinistry = async (ministryName: string): Promise<string[]> => {
  try {
    console.log(`🔍 [SuperAdmin Style] Finding all churches with ministry: "${ministryName}"`);

    // Step 1: Get all admin users (like SuperAdmin does)
    const usersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'admin'),
      limit(500)
    );

    const usersSnapshot = await getDocs(usersQuery);
    const churchIds: string[] = [];

    console.log(`📊 Found ${usersSnapshot.docs.length} admin users to check`);

    // Debug: Log all admin users
    usersSnapshot.docs.forEach(doc => {
// Fetch ministry members across ALL churches using collection group (requires rules)
const fetchMinistryMembersViaCollectionGroup = async (ministryName: string): Promise<Member[]> => {
  try {
    const q = query(collectionGroup(db, 'members'), where('ministry', '==', ministryName));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(snap => {
      const churchId = (snap.ref.parent.parent && (snap.ref.parent.parent as any).id) || 'unknown';
      return {
        id: snap.id,
        ...snap.data(),
        sourceChurchId: churchId
      } as any as Member;
    });
    const filtered = items.filter(m => m.isActive !== false);
    filtered.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
    return filtered;
  } catch (e) {
    console.warn('⚠️ Collection group fetch failed (members):', e);
    return [];
  }
};

      const userData = doc.data();
      console.log(`👤 Admin user:`, {
        id: doc.id,
        email: userData.email,
        isMinistryAccount: userData.isMinistryAccount,
        churchId: userData.churchId,
        defaultChurchId: userData.contexts?.defaultChurchId,
        ministryChurchId: userData.contexts?.ministryChurchId
      });
    });

    // Step 2: Check each church for members with the target ministry
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();

      // Skip ministry accounts - we want default churches only
      if (userData.isMinistryAccount === true) {
        console.log(`⏭️ Skipping ministry account: ${userData.email}`);
        continue;
      }

      const churchId = userData.contexts?.defaultChurchId || userData.churchId;
      if (!churchId) {
        console.log(`⚠️ No church ID for user: ${userData.email}`);
        continue;
      }

      if (churchIds.includes(churchId)) {
        console.log(`⏭️ Already checked church: ${churchId}`);
        continue;
      }

      console.log(`🔍 Checking church ${churchId} for "${ministryName}" members...`);

      try {
        // Step 3: Query for existence of any member with this ministry.
        // Do NOT pre-filter by isActive here, because some datasets don't set isActive=true explicitly.
        // We'll filter by isActive on the full fetch later.
        const membersQuery = query(
          collection(db, `churches/${churchId}/members`),
          where('ministry', '==', ministryName),
          limit(1) // Only need to know if at least one exists
        );
        const membersSnapshot = await getDocs(membersQuery);

        if (!membersSnapshot.empty) {
          churchIds.push(churchId);
          console.log(`✅ Church ${churchId} has ${ministryName} members (will filter active later)`);
        } else {
          console.log(`❌ Church ${churchId} has no members with ministry "${ministryName}"`);
        }
      } catch (e) {
        console.warn(`⚠️ Failed to check ministry members in church ${churchId}:`, e);
      }
    }

    console.log(`🎯 Found ${churchIds.length} churches with "${ministryName}" ministry:`, churchIds);
    return churchIds;
  } catch (e) {
    console.error('❌ Failed to get churches with ministry:', e);
    return [];
  }
};

// Fetch data from a specific church collection
const fetchChurchCollection = async (churchId: string, collectionName: string): Promise<any[]> => {
  try {
    // Directly query subcollection; Firestore rules gate access per ministry scope
    const snapshot = await getDocs(collection(db, `churches/${churchId}/${collectionName}`));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      sourceChurchId: churchId // Add source church ID for tracking
    }));
  } catch (e) {
    console.warn(`Failed to fetch ${collectionName} from church ${churchId}:`, e);
    return [];
  }
};

// Fetch members with specific ministry from a church (same pattern as membersFirebaseService.getAllByMinistry)
const fetchMinistryMembersFromChurch = async (churchId: string, ministryName: string): Promise<Member[]> => {
  try {
    // Use exact same query pattern as membersFirebaseService.getAllByMinistry
    const membersQuery = query(
      collection(db, `churches/${churchId}/members`),
      where('ministry', '==', ministryName)
    );


    const snapshot = await getDocs(membersQuery);

    // Apply isActive filter client-side (same as existing service)
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      sourceChurchId: churchId // Add source church ID for tracking
    } as any as Member));

    const filtered = items.filter(m => m.isActive !== false);
    // Sort same as existing service
    filtered.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));

    return filtered;
  } catch (e) {
    console.warn(`⚠️ Failed to fetch ministry members from church ${churchId}:`, e);
    return [];
  }
  // Safety net: if ministry church has zero members but default church exists,
  // try to backfill from default church into ministry church using client-side simulation.
  // This helps when Cloud Functions aren’t deployed.
  try {
    const ministryHasMembers = async () => {
      if (!currentChurchId) return false;
      try {
        const snap = await getDocs(query(collection(db, `churches/${currentChurchId}/members`), limit(1)));
        return !snap.empty;
      } catch { return false; }
    };

    // REMOVED: Backfill sync disabled for ministry independence
    // if (currentChurchId && !(await ministryHasMembers()) && defaultChurchId) {
    //   console.log('🧪 [Ministry Aggregation] Ministry church appears empty; attempting local backfill...');
    //   try {
    //     const { simulateBackfillMinistrySync } = await import('./ministrySimulationService');
    //     await simulateBackfillMinistrySync(defaultChurchId, currentChurchId);
    //   } catch (e) {
    //     console.warn('Backfill simulation failed (non-fatal):', e);
    //   }
    // }
  } catch {}

};

// Get aggregated data for a specific ministry across the user’s accessible scope (no superadmin discovery)
export const getMinistryAggregatedData = async (
  ministryName: string,
  currentChurchId?: string
): Promise<MinistryAggregatedData> => {
  try {
    console.log(`🔍 [Ministry Independent Mode] Fetching data for ministry: ${ministryName} from ministry church only`);

    // MINISTRY INDEPENDENCE: Only fetch from the ministry church, NOT from default church
    if (!currentChurchId) {
      console.log(`⚠️ No ministry church ID provided for ${ministryName}`);
      return {
        members: [],
        bacentas: [],
        attendanceRecords: [],
        newBelievers: [],
        sundayConfirmations: [],
        guests: [],
        sourceChurches: []
      };
    }

    // Fetch data ONLY from the ministry church (no cross-church aggregation)
    console.log(`🔄 [Ministry Independent Mode] Fetching data from ministry church only: ${currentChurchId}`);
    const [members, bacentas, attendance, newBelievers, confirmations, guests] = await Promise.all([
      fetchMinistryMembersFromChurch(currentChurchId, ministryName),
      fetchChurchCollection(currentChurchId, 'bacentas'),
      fetchChurchCollection(currentChurchId, 'attendance'),
      fetchChurchCollection(currentChurchId, 'newBelievers'),
      fetchChurchCollection(currentChurchId, 'sundayConfirmations'),
      fetchChurchCollection(currentChurchId, 'guests')
    ]);

    console.log(`✅ Ministry church ${currentChurchId} data:`, {
      members: members.length,
      bacentas: bacentas.length,
      attendance: attendance.length,
      newBelievers: newBelievers.length,
      confirmations: confirmations.length,
      guests: guests.length
    });

    // Return data from ministry church only
    const aggregatedData: MinistryAggregatedData = {
      members: members,
      bacentas: bacentas,
      attendanceRecords: attendance,
      newBelievers: newBelievers,
      sundayConfirmations: confirmations,
      guests: guests,
      sourceChurches: [currentChurchId]
    };

  console.log(`🎉 [Ministry Independent Mode] Successfully fetched data for ${ministryName}:`, {
      members: aggregatedData.members.length,
      bacentas: aggregatedData.bacentas.length,
      attendance: aggregatedData.attendanceRecords.length,
      newBelievers: aggregatedData.newBelievers.length,
      confirmations: aggregatedData.sundayConfirmations.length,
      guests: aggregatedData.guests.length,
      sourceChurch: currentChurchId
    });

    return aggregatedData;
  } catch (e) {
    console.error('❌ [SuperAdmin Style] Failed to get ministry aggregated data:', e);
    return {
      members: [],
      bacentas: [],
      attendanceRecords: [],
      newBelievers: [],
      sundayConfirmations: [],
      guests: [],
      sourceChurches: []
    };
  }
};

// Set up real-time listeners for ministry data - INDEPENDENT MODE (only ministry church)
export const setupMinistryDataListeners = (
  ministryName: string,
  onDataUpdate: (data: MinistryAggregatedData) => void,
  optimisticUpdatesRef?: React.MutableRefObject<Set<string>>,
  currentChurchId?: string
): (() => void) => {
  const unsubscribers: Unsubscribe[] = [];
  let currentData: MinistryAggregatedData = {
    members: [],
    bacentas: [],
    attendanceRecords: [],
    newBelievers: [],
    sundayConfirmations: [],
    guests: [],
    sourceChurches: []
  };
  let excludedKeys = new Set<string>(); // key: `${sourceChurchId}_${memberId}`
  let overridesMap = new Map<string, { frozen?: boolean; role?: Member['role']; ministryPosition?: string }>(); // key: `${sourceChurchId}_${memberId}`

  const updateAggregatedData = () => {
  // No deduplication needed since we're only listening to one church
  onDataUpdate({ ...currentData });
  };

  // Initialize with current data (ministry church only)
  getMinistryAggregatedData(ministryName, currentChurchId).then(data => {
    currentData = data;
    updateAggregatedData();

    // Subscribe to exclusions in the ministry church (if available)
    if (currentChurchId) {
  const unsubExclusions = ministryExclusionsService.onSnapshot((items) => {
        excludedKeys = new Set(items.map(i => `${i.sourceChurchId}_${i.memberId}`));
        // Re-filter current members with new exclusions and push update
        currentData.members = currentData.members.filter(m => !excludedKeys.has(`${(m as any).sourceChurchId || currentChurchId}_${m.id}`));
        updateAggregatedData();
  }, currentChurchId);
      unsubscribers.push(unsubExclusions);

  const unsubOverrides = ministryMemberOverridesService.onSnapshot((items) => {
        overridesMap = new Map(items.map(i => [`${i.sourceChurchId}_${i.memberId}`, { frozen: i.frozen, role: (i as any).role, ministryPosition: (i as any).ministryPosition }]));
        // Apply overrides to current members
        currentData.members = currentData.members.map(m => {
          const key = `${(m as any).sourceChurchId || currentChurchId}_${m.id}`;
          const ov = overridesMap.get(key);
          return ov ? { ...m, ...ov } : m;
        });
        updateAggregatedData();
  }, currentChurchId);
      unsubscribers.push(unsubOverrides);
    }

  // MINISTRY INDEPENDENCE: Set up listener ONLY for the ministry church
  if (currentChurchId) {
      try {
        console.log(`🔄 [Ministry Independent Mode] Setting up listener for ministry church: ${currentChurchId}`);

        // Listen to members with this ministry in the ministry church only
        const membersQuery = query(
          collection(db, `churches/${currentChurchId}/members`),
          where('ministry', '==', ministryName)
        );

        const unsubMembers = onSnapshot(membersQuery, (snapshot) => {
          // Apply isActive filter client-side
          const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            sourceChurchId: currentChurchId
          } as any as Member));

          const filtered = items.filter(m => m.isActive !== false);
          filtered.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));

          // Replace all members with the fresh snapshot from ministry church
          const allowed = filtered.filter(m => !excludedKeys.has(`${currentChurchId}_${m.id}`));
          const withOverrides = allowed.map(m => {
            const ov = overridesMap.get(`${currentChurchId}_${m.id}`);
            return ov ? { ...m, ...ov } : m;
          });
          currentData.members = withOverrides;
          updateAggregatedData();
        }, (err) => {
          console.warn(`[Ministry Data] Members listener error for ${currentChurchId} — skipping`, err?.message || err);
        });

        unsubscribers.push(unsubMembers);

        // Listen to attendance records from ministry church with debouncing to reduce conflicts
        const attendanceQuery = query(collection(db, `churches/${currentChurchId}/attendance`));
        let attendanceUpdateTimeout: NodeJS.Timeout;

        const unsubAttendance = onSnapshot(attendanceQuery, (snapshot) => {
          // Clear previous timeout to debounce rapid updates
          if (attendanceUpdateTimeout) {
            clearTimeout(attendanceUpdateTimeout);
          }

          // Debounce attendance updates to prevent conflicts with optimistic updates
          attendanceUpdateTimeout = setTimeout(() => {
            const items = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              sourceChurchId: currentChurchId
            } as any as AttendanceRecord));

            // Filter out items that are currently being optimistically updated
            const filteredItems = optimisticUpdatesRef
              ? items.filter(item => !optimisticUpdatesRef.current.has(item.id))
              : items;

            console.log(`📊 [Ministry Independent Mode] Attendance update:`, {
              totalItems: items.length,
              filteredItems: filteredItems.length,
              optimisticUpdates: Array.from(optimisticUpdatesRef?.current || [])
            });

            // Replace all attendance records with fresh snapshot (preserving optimistic updates)
            const optimisticRecords = currentData.attendanceRecords.filter(a =>
              optimisticUpdatesRef?.current.has(a.id)
            );
            currentData.attendanceRecords = [...optimisticRecords, ...filteredItems];

            updateAggregatedData();
          }, 100); // 100ms debounce to allow optimistic updates to settle
        }, (err) => {
          console.warn(`[Ministry Data] Attendance listener error for ${currentChurchId} — skipping`, err?.message || err);
        });

        unsubscribers.push(unsubAttendance);
      } catch (e) {
        console.warn(`Failed to set up listeners for ministry church ${currentChurchId}:`, e);
      }
    }

    // MINISTRY INDEPENDENCE: No default church listener - ministry mode is completely independent
    if (false) {
      try {
        console.log(`🔒 Ensuring default church listener is attached: ${defaultChurchId}`);
        const membersQuery = query(
          collection(db, `churches/${defaultChurchId}/members`),
          where('ministry', '==', ministryName)
        );

        const unsubMembers = onSnapshot(membersQuery, (snapshot) => {
          const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            sourceChurchId: defaultChurchId
          } as any as Member));

          const filtered = items.filter(m => m.isActive !== false);
          filtered.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));

          currentData.members = currentData.members.filter(m => {
            const isFromThisChurch = (m as any).sourceChurchId === defaultChurchId;
            const isNative = m.isNativeMinistryMember;
            return !isFromThisChurch || isNative;
          });
          const allowed = filtered.filter(m => !excludedKeys.has(`${defaultChurchId}_${m.id}`));
          const withOverrides = allowed.map(m => {
            const ov = overridesMap.get(`${defaultChurchId}_${m.id}`);
            return ov ? { ...m, ...ov } : m;
          });
          currentData.members.push(...withOverrides);
          updateAggregatedData();
        }, (err) => {
          console.warn(`[Ministry Data] Default church members listener error for ${defaultChurchId} — skipping`, err?.message || err);
        });

        unsubscribers.push(unsubMembers);
      } catch (e) {
        console.warn('Failed to attach default church listener for ministry mode:', e);
      }
    }

    // MINISTRY INDEPENDENCE: Listener already set up above - no need for duplicate
    if (false) {
      try {
        console.log(`🔄 Setting up native members listener for ministry church: ${currentChurchId}`);

        // Listen to all ministry members (don’t restrict to isNativeMinistryMember)
        const nativeMembersQuery = query(
          collection(db, `churches/${currentChurchId}/members`),
          where('ministry', '==', ministryName)
        );

        const unsubNativeMembers = onSnapshot(nativeMembersQuery, (snapshot) => {
          const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            sourceChurchId: currentChurchId
          } as any as Member));

          const filtered = items.filter(m => m.isActive !== false);
          filtered.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));

          // Replace the entire ministry-church subset so added members never disappear
          currentData.members = currentData.members.filter(m => {
            const isFromMinistryChurch = (m as any).sourceChurchId === currentChurchId;
            // Keep only those NOT from the ministry church; we’ll re-add fresh snapshot
            return !isFromMinistryChurch;
          });
          const allowed = filtered.filter(m => !excludedKeys.has(`${currentChurchId}_${m.id}`));
          const withOverrides = allowed.map(m => {
            const ov = overridesMap.get(`${currentChurchId}_${m.id}`);
            return ov ? { ...m, ...ov } : m;
          });
          currentData.members.push(...withOverrides);
          updateAggregatedData();
        }, (err) => {
          console.warn(`[Ministry Data] Native members listener error for ${currentChurchId} — skipping`, err?.message || err);
        });

        unsubscribers.push(unsubNativeMembers);
      } catch (e) {
        console.warn('Failed to set up native members listener:', e);
      }
    } else {
      console.log('🔄 Native members listener not needed - no current church ID or already included in source churches');
    }
  });

  // Return cleanup function
  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
};
