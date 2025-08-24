/**
 * Ministry Data Service
 * 
 * This service fetches data across all churches for ministry mode,
 * similar to how SuperAdmin aggregates data from multiple constituencies.
 */

import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  limit,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../firebase.config';
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
        // Step 3: Query members with ministry (same pattern as membersFirebaseService.getAllByMinistry)
        const membersQuery = query(
          collection(db, `churches/${churchId}/members`),
          where('ministry', '==', ministryName),
          limit(5) // Get a few to check
        );
        const membersSnapshot = await getDocs(membersQuery);

        console.log(`📋 Church ${churchId} has ${membersSnapshot.docs.length} members with ministry "${ministryName}"`);

        if (!membersSnapshot.empty) {
          // Debug: Log found members
          membersSnapshot.docs.forEach(doc => {
            const memberData = doc.data();
            console.log(`👥 Found member:`, {
              id: doc.id,
              name: `${memberData.firstName} ${memberData.lastName || ''}`,
              ministry: memberData.ministry,
              isActive: memberData.isActive
            });
          });

          // Apply isActive filter client-side (same as existing service)
          const hasActiveMembers = membersSnapshot.docs.some(doc => {
            const memberData = doc.data();
            return memberData.isActive !== false;
          });

          if (hasActiveMembers) {
            churchIds.push(churchId);
            console.log(`✅ Church ${churchId} has active ${ministryName} members`);
          } else {
            console.log(`⚠️ Church ${churchId} has ${ministryName} members but none are active`);
          }
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
};

// Get aggregated data for a specific ministry across all churches (SuperAdmin style)
export const getMinistryAggregatedData = async (ministryName: string, currentChurchId?: string): Promise<MinistryAggregatedData> => {
  try {
    console.log(`🔍 [SuperAdmin Style] Fetching cross-church data for ministry: ${ministryName}`);

    // Step 1: Get all churches that have members with this ministry (like SuperAdmin gets all admin churches)
    const churchIds = await getChurchesWithMinistry(ministryName);
    console.log(`📍 [SuperAdmin Style] Found ${churchIds.length} churches with ${ministryName} ministry`);

    if (churchIds.length === 0) {
      console.log(`⚠️ No churches found with ${ministryName} ministry`);
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

    // Step 2: Fetch data from all churches in parallel (like SuperAdmin does)
    console.log(`🔄 [SuperAdmin Style] Fetching data from ${churchIds.length} churches in parallel...`);
    const allPromises = churchIds.map(async (churchId) => {
      console.log(`📥 Fetching data from church: ${churchId}`);
      const [members, bacentas, attendance, newBelievers, confirmations, guests] = await Promise.all([
        fetchMinistryMembersFromChurch(churchId, ministryName),
        fetchChurchCollection(churchId, 'bacentas'),
        fetchChurchCollection(churchId, 'attendance'),
        fetchChurchCollection(churchId, 'newBelievers'),
        fetchChurchCollection(churchId, 'sundayConfirmations'),
        fetchChurchCollection(churchId, 'guests')
      ]);

      console.log(`✅ Church ${churchId} data:`, {
        members: members.length,
        bacentas: bacentas.length,
        attendance: attendance.length,
        newBelievers: newBelievers.length,
        confirmations: confirmations.length,
        guests: guests.length
      });

      return {
        churchId,
        members,
        bacentas,
        attendance,
        newBelievers,
        confirmations,
        guests
      };
    });

    const churchDataArray = await Promise.all(allPromises);

    // Step 3: Aggregate all data (like SuperAdmin aggregates admin data)
    const aggregatedData: MinistryAggregatedData = {
      members: [],
      bacentas: [],
      attendanceRecords: [],
      newBelievers: [],
      sundayConfirmations: [],
      guests: [],
      sourceChurches: churchIds
    };

    churchDataArray.forEach(churchData => {
      aggregatedData.members.push(...churchData.members);
      aggregatedData.bacentas.push(...churchData.bacentas);
      aggregatedData.attendanceRecords.push(...churchData.attendance);
      aggregatedData.newBelievers.push(...churchData.newBelievers);
      aggregatedData.sundayConfirmations.push(...churchData.confirmations);
      aggregatedData.guests.push(...churchData.guests);
    });

    // Step 4: Add native ministry members from the current ministry church
    if (currentChurchId) {
      console.log('📥 Fetching native ministry members from current ministry church...');
      try {
        // Fetch native ministry members (those with isNativeMinistryMember: true)
        const nativeMembersQuery = query(
          collection(db, `churches/${currentChurchId}/members`),
          where('ministry', '==', ministryName),
          where('isNativeMinistryMember', '==', true)
        );
        const nativeSnapshot = await getDocs(nativeMembersQuery);
        const nativeMembers = nativeSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          sourceChurchId: currentChurchId // Mark as coming from ministry church
        } as any as Member)).filter(m => m.isActive !== false);

        console.log(`✅ Found ${nativeMembers.length} native ministry members`);
        aggregatedData.members.push(...nativeMembers);
      } catch (e) {
        console.warn('Failed to fetch native ministry members:', e);
      }
    } else {
      console.log('📥 No current church ID provided - skipping native members fetch');
    }

    console.log(`🎉 [SuperAdmin Style] Successfully aggregated data for ${ministryName}:`, {
      members: aggregatedData.members.length,
      nativeMembers: aggregatedData.members.filter(m => m.isNativeMinistryMember).length,
      syncedMembers: aggregatedData.members.filter(m => !m.isNativeMinistryMember).length,
      bacentas: aggregatedData.bacentas.length,
      attendance: aggregatedData.attendanceRecords.length,
      newBelievers: aggregatedData.newBelievers.length,
      confirmations: aggregatedData.sundayConfirmations.length,
      guests: aggregatedData.guests.length,
      churches: churchIds.length,
      sourceChurches: aggregatedData.sourceChurches,
      currentChurchId: currentChurchId || 'not provided'
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

// Set up real-time listeners for ministry data across multiple churches
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
  let overridesMap = new Map<string, { frozen?: boolean }>(); // key: `${sourceChurchId}_${memberId}`

  const updateAggregatedData = () => {
    onDataUpdate({ ...currentData });
  };

  // Initialize with current data
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
      });
      unsubscribers.push(unsubExclusions);

      const unsubOverrides = ministryMemberOverridesService.onSnapshot((items) => {
        overridesMap = new Map(items.map(i => [`${i.sourceChurchId}_${i.memberId}`, { frozen: i.frozen }]));
        // Apply overrides to current members
        currentData.members = currentData.members.map(m => {
          const key = `${(m as any).sourceChurchId || currentChurchId}_${m.id}`;
          const ov = overridesMap.get(key);
          return ov ? { ...m, ...ov } : m;
        });
        updateAggregatedData();
      });
      unsubscribers.push(unsubOverrides);
    }

    // Set up listeners for each church
    data.sourceChurches.forEach(churchId => {
      try {
        // Listen to members with this ministry (same pattern as onSnapshotByMinistry)
        const membersQuery = query(
          collection(db, `churches/${churchId}/members`),
          where('ministry', '==', ministryName)
        );

        const unsubMembers = onSnapshot(membersQuery, (snapshot) => {
          // Apply isActive filter client-side (same as existing service)
          const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            sourceChurchId: churchId
          } as any as Member));

          const filtered = items.filter(m => m.isActive !== false);
          // Sort same as existing service
          filtered.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));

          // Update members for this church, but preserve native ministry members
          currentData.members = currentData.members.filter(m => {
            const isFromThisChurch = (m as any).sourceChurchId === churchId;
            const isNative = m.isNativeMinistryMember;
            // Keep members that are NOT from this church OR are native ministry members
            return !isFromThisChurch || isNative;
          });
          // Filter by exclusions (if any) then add
          const allowed = filtered.filter(m => !excludedKeys.has(`${churchId}_${m.id}`));
          const withOverrides = allowed.map(m => {
            const ov = overridesMap.get(`${churchId}_${m.id}`);
            return ov ? { ...m, ...ov } : m;
          });
          currentData.members.push(...withOverrides);
          updateAggregatedData();
        });

        unsubscribers.push(unsubMembers);

        // Listen to attendance records from this church with debouncing to reduce conflicts
        const attendanceQuery = query(collection(db, `churches/${churchId}/attendance`));
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
              sourceChurchId: churchId
            } as any as AttendanceRecord));

            // Filter out items that are currently being optimistically updated
            const filteredItems = optimisticUpdatesRef
              ? items.filter(item => !optimisticUpdatesRef.current.has(item.id))
              : items;

            console.log(`📊 [Ministry Data] Attendance update for church ${churchId}:`, {
              totalItems: items.length,
              filteredItems: filteredItems.length,
              optimisticUpdates: Array.from(optimisticUpdatesRef?.current || []),
              beforeUpdate: currentData.attendanceRecords.length,
              beforeFromThisChurch: currentData.attendanceRecords.filter(a => (a as any).sourceChurchId === churchId).length
            });

            // Update attendance for this church, preserving optimistic updates
            const beforeFilter = currentData.attendanceRecords.length;
            const removedRecords: AttendanceRecord[] = [];

            currentData.attendanceRecords = currentData.attendanceRecords.filter(a => {
              const isFromThisChurch = (a as any).sourceChurchId === churchId;
              const isOptimistic = optimisticUpdatesRef?.current.has(a.id);
              const shouldKeep = !isFromThisChurch || isOptimistic;

              if (!shouldKeep) {
                removedRecords.push(a);
              }

              // Keep records that are NOT from this church OR are optimistically updated
              return shouldKeep;
            });
            const afterFilter = currentData.attendanceRecords.length;

            console.log(`📊 [Ministry Data] Filtering details:`, {
              removedRecords: removedRecords.map(r => ({
                id: r.id,
                memberId: r.memberId,
                date: r.date,
                status: r.status,
                sourceChurchId: (r as any).sourceChurchId
              }))
            });

            // Add new records that aren't optimistically updated
            currentData.attendanceRecords.push(...filteredItems);

            console.log(`📊 [Ministry Data] After attendance update:`, {
              beforeFilter,
              afterFilter,
              addedItems: filteredItems.length,
              finalTotal: currentData.attendanceRecords.length,
              attendanceByChurch: currentData.attendanceRecords.reduce((acc, a) => {
                const church = (a as any).sourceChurchId || 'unknown';
                acc[church] = (acc[church] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            });

            updateAggregatedData();
          }, 100); // 100ms debounce to allow optimistic updates to settle
        });

        unsubscribers.push(unsubAttendance);
      } catch (e) {
        console.warn(`Failed to set up listeners for church ${churchId}:`, e);
      }
    });

    // Set up listener for native ministry members in the current ministry church
    if (currentChurchId && !data.sourceChurches.includes(currentChurchId)) {
      try {
        console.log(`🔄 Setting up native members listener for ministry church: ${currentChurchId}`);

        // Listen to native ministry members
        const nativeMembersQuery = query(
          collection(db, `churches/${currentChurchId}/members`),
          where('ministry', '==', ministryName),
          where('isNativeMinistryMember', '==', true)
        );

        const unsubNativeMembers = onSnapshot(nativeMembersQuery, (snapshot) => {
          const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            sourceChurchId: currentChurchId
          } as any as Member));

          const filtered = items.filter(m => m.isActive !== false);
          filtered.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));

          // Update native members for ministry church
          currentData.members = currentData.members.filter(m => {
            const isFromMinistryChurch = (m as any).sourceChurchId === currentChurchId;
            const isNative = m.isNativeMinistryMember;
            // Keep members that are NOT native from ministry church
            return !(isFromMinistryChurch && isNative);
          });
          const allowed = filtered.filter(m => !excludedKeys.has(`${currentChurchId}_${m.id}`));
          const withOverrides = allowed.map(m => {
            const ov = overridesMap.get(`${currentChurchId}_${m.id}`);
            return ov ? { ...m, ...ov } : m;
          });
          currentData.members.push(...withOverrides);
          updateAggregatedData();
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
