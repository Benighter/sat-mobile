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
export const getMinistryAggregatedData = async (ministryName: string): Promise<MinistryAggregatedData> => {
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

    console.log(`🎉 [SuperAdmin Style] Successfully aggregated data for ${ministryName}:`, {
      members: aggregatedData.members.length,
      bacentas: aggregatedData.bacentas.length,
      attendance: aggregatedData.attendanceRecords.length,
      newBelievers: aggregatedData.newBelievers.length,
      confirmations: aggregatedData.sundayConfirmations.length,
      guests: aggregatedData.guests.length,
      churches: churchIds.length,
      sourceChurches: aggregatedData.sourceChurches
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
  onDataUpdate: (data: MinistryAggregatedData) => void
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

  const updateAggregatedData = () => {
    onDataUpdate({ ...currentData });
  };

  // Initialize with current data
  getMinistryAggregatedData(ministryName).then(data => {
    currentData = data;
    updateAggregatedData();

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

          // Update members for this church
          currentData.members = currentData.members.filter(m => (m as any).sourceChurchId !== churchId);
          currentData.members.push(...filtered);
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

            // Update attendance for this church
            currentData.attendanceRecords = currentData.attendanceRecords.filter(a => (a as any).sourceChurchId !== churchId);
            currentData.attendanceRecords.push(...items);
            updateAggregatedData();
          }, 100); // 100ms debounce to allow optimistic updates to settle
        });

        unsubscribers.push(unsubAttendance);
      } catch (e) {
        console.warn(`Failed to set up listeners for church ${churchId}:`, e);
      }
    });
  });

  // Return cleanup function
  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
};
