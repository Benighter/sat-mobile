/**
 * Ministry data access.
 *
 * Ministry mode is intentionally scoped to the active ministry church. It
 * does not aggregate or mutate records in the user's default church.
 */

import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  query,
  Unsubscribe,
  where
} from 'firebase/firestore';
import { db } from '../firebase.config';
import {
  AttendanceRecord,
  Bacenta,
  Guest,
  Member,
  NewBeliever,
  SundayConfirmation
} from '../types';
import { ministryExclusionsService, ministryMemberOverridesService } from './firebaseService';

export interface MinistryAggregatedData {
  members: Member[];
  bacentas: Bacenta[];
  attendanceRecords: AttendanceRecord[];
  newBelievers: NewBeliever[];
  sundayConfirmations: SundayConfirmation[];
  guests: Guest[];
  sourceChurches: string[];
}

type MinistryOverride = {
  frozen?: boolean;
  role?: Member['role'];
  ministryPosition?: string;
};

const emptyMinistryData = (): MinistryAggregatedData => ({
  members: [],
  bacentas: [],
  attendanceRecords: [],
  newBelievers: [],
  sundayConfirmations: [],
  guests: [],
  sourceChurches: []
});

const fetchChurchCollection = async <T>(churchId: string, collectionName: string): Promise<T[]> => {
  try {
    const snapshot = await getDocs(collection(db, `churches/${churchId}/${collectionName}`));
    return snapshot.docs.map(snapshotDoc => ({
      id: snapshotDoc.id,
      ...snapshotDoc.data(),
      sourceChurchId: churchId
    } as unknown as T));
  } catch (error) {
    console.warn(`Failed to fetch ${collectionName} from church ${churchId}:`, error);
    return [];
  }
};

const fetchMinistryMembers = async (churchId: string, ministryName: string): Promise<Member[]> => {
  try {
    const snapshot = await getDocs(query(
      collection(db, `churches/${churchId}/members`),
      where('ministry', '==', ministryName)
    ));
    const members = snapshot.docs
      .map(snapshotDoc => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data(),
        sourceChurchId: churchId
      } as unknown as Member))
      .filter(member => member.isActive !== false);
    members.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
    return members;
  } catch (error) {
    console.warn(`Failed to fetch ${ministryName} members from church ${churchId}:`, error);
    return [];
  }
};

/** Retained for administrative diagnostics; ministry mode itself no longer uses cross-church discovery. */
export const getChurchesWithMinistry = async (ministryName: string): Promise<string[]> => {
  try {
    const usersSnapshot = await getDocs(query(
      collection(db, 'users'),
      where('role', '==', 'admin'),
      limit(500)
    ));
    const churchIds = new Set<string>();

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      if (userData.isMinistryAccount === true) continue;
      const churchId = userData.contexts?.defaultChurchId || userData.churchId;
      if (!churchId || churchIds.has(churchId)) continue;

      try {
        const membersSnapshot = await getDocs(query(
          collection(db, `churches/${churchId}/members`),
          where('ministry', '==', ministryName),
          limit(1)
        ));
        if (!membersSnapshot.empty) churchIds.add(churchId);
      } catch (error) {
        console.warn(`Failed to inspect ministry members in church ${churchId}:`, error);
      }
    }

    return Array.from(churchIds);
  } catch (error) {
    console.error('Failed to discover churches for ministry:', error);
    return [];
  }
};

export const getMinistryAggregatedData = async (
  ministryName: string,
  currentChurchId?: string
): Promise<MinistryAggregatedData> => {
  if (!currentChurchId) return emptyMinistryData();

  try {
    const [members, bacentas, attendance, newBelievers, confirmations, legacyConfirmations, guests] = await Promise.all([
      fetchMinistryMembers(currentChurchId, ministryName),
      fetchChurchCollection<Bacenta>(currentChurchId, 'bacentas'),
      fetchChurchCollection<AttendanceRecord>(currentChurchId, 'attendance'),
      fetchChurchCollection<NewBeliever>(currentChurchId, 'newBelievers'),
      fetchChurchCollection<SundayConfirmation>(currentChurchId, 'confirmations'),
      fetchChurchCollection<SundayConfirmation>(currentChurchId, 'sundayConfirmations'),
      fetchChurchCollection<Guest>(currentChurchId, 'guests')
    ]);

    return {
      members,
      bacentas,
      attendanceRecords: attendance,
      newBelievers,
      sundayConfirmations: confirmations.length > 0 ? confirmations : legacyConfirmations,
      guests,
      sourceChurches: [currentChurchId]
    };
  } catch (error) {
    console.error('Failed to load ministry data:', error);
    return emptyMinistryData();
  }
};

export const setupMinistryDataListeners = (
  ministryName: string,
  onDataUpdate: (data: MinistryAggregatedData) => void,
  optimisticUpdatesRef?: { current: Set<string> },
  currentChurchId?: string
): (() => void) => {
  const unsubscribers: Unsubscribe[] = [];
  let cancelled = false;
  let attendanceUpdateTimeout: ReturnType<typeof setTimeout> | undefined;
  let currentData = emptyMinistryData();
  let rawMembers: Member[] = [];
  let excludedKeys = new Set<string>();
  let overridesMap = new Map<string, MinistryOverride>();

  const emit = () => {
    if (cancelled) return;
    const churchId = currentChurchId || '';
    currentData.members = rawMembers
      .filter(member => !excludedKeys.has(`${churchId}_${member.id}`))
      .map(member => ({ ...member, ...overridesMap.get(`${churchId}_${member.id}`) }));
    onDataUpdate({ ...currentData });
  };

  void getMinistryAggregatedData(ministryName, currentChurchId).then(data => {
    if (cancelled) return;
    currentData = data;
    rawMembers = data.members;
    emit();

    if (!currentChurchId) return;

    unsubscribers.push(ministryExclusionsService.onSnapshot(items => {
      excludedKeys = new Set(items.map(item => `${item.sourceChurchId}_${item.memberId}`));
      emit();
    }, currentChurchId));

    unsubscribers.push(ministryMemberOverridesService.onSnapshot(items => {
      overridesMap = new Map(items.map(item => [
        `${item.sourceChurchId}_${item.memberId}`,
        { frozen: item.frozen, role: item.role, ministryPosition: item.ministryPosition }
      ]));
      emit();
    }, currentChurchId));

    const membersQuery = query(
      collection(db, `churches/${currentChurchId}/members`),
      where('ministry', '==', ministryName)
    );
    unsubscribers.push(onSnapshot(membersQuery, snapshot => {
      rawMembers = snapshot.docs
        .map(snapshotDoc => ({
          id: snapshotDoc.id,
          ...snapshotDoc.data(),
          sourceChurchId: currentChurchId
        } as unknown as Member))
        .filter(member => member.isActive !== false)
        .sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
      emit();
    }, error => console.warn('Ministry members listener failed:', error)));

    const attendanceQuery = query(collection(db, `churches/${currentChurchId}/attendance`));
    unsubscribers.push(onSnapshot(attendanceQuery, snapshot => {
      if (attendanceUpdateTimeout) clearTimeout(attendanceUpdateTimeout);
      attendanceUpdateTimeout = setTimeout(() => {
        const snapshotRecords = snapshot.docs.map(snapshotDoc => ({
          id: snapshotDoc.id,
          ...snapshotDoc.data(),
          sourceChurchId: currentChurchId
        } as unknown as AttendanceRecord));
        const recordsNotBeingUpdated = optimisticUpdatesRef
          ? snapshotRecords.filter(record => !optimisticUpdatesRef.current.has(record.id))
          : snapshotRecords;
        const optimisticRecords = optimisticUpdatesRef
          ? currentData.attendanceRecords.filter(record => optimisticUpdatesRef.current.has(record.id))
          : [];
        currentData.attendanceRecords = [...optimisticRecords, ...recordsNotBeingUpdated];
        emit();
      }, 100);
    }, error => console.warn('Ministry attendance listener failed:', error)));
  });

  return () => {
    cancelled = true;
    if (attendanceUpdateTimeout) clearTimeout(attendanceUpdateTimeout);
    unsubscribers.forEach(unsubscribe => unsubscribe());
  };
};
