/**
 * Bidirectional Sync Service
 * 
 * Handles synchronization between ministry mode and normal mode:
 * - Ministry mode reads: Aggregate data from multiple churches (already implemented)
 * - Ministry mode writes: Sync changes back to source churches (this service)
 */

import {
  doc,
  updateDoc,
  addDoc,
  collection,
  getDoc,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase.config';
import { Member, AttendanceRecord, NewBeliever, SundayConfirmation } from '../types';

export interface SyncMetadata {
  sourceChurchId: string;
  syncedAt: string;
  syncedBy: string;
  syncDirection: 'ministry-to-normal' | 'normal-to-ministry';
  originalId?: string;
}

// Fields that are allowed to be synced back to normal mode
const ALLOWED_SYNC_FIELDS = [
  'firstName',
  'lastName', 
  'phoneNumber',
  'buildingAddress',
  'roomNumber',
  'profilePicture',
  'ministry',
  'birthday',
  'bornAgainStatus'
];

/**
 * Sync member updates from ministry mode back to the source church
 */
export const syncMemberToSourceChurch = async (
  member: Member,
  updates: Partial<Member>,
  currentUserId: string
): Promise<void> => {
  try {
    const sourceChurchId = (member as any).sourceChurchId;
    if (!sourceChurchId) {
      console.warn('No source church ID found for member:', member.id);
      return;
    }

    console.log(`🔄 [Bidirectional Sync] Syncing member ${member.id} updates to source church ${sourceChurchId}`);

    // Filter updates to only allowed fields
    const allowedUpdates: any = {};
    Object.keys(updates).forEach(key => {
      if (ALLOWED_SYNC_FIELDS.includes(key) && updates[key as keyof Member] !== undefined) {
        allowedUpdates[key] = updates[key as keyof Member];
      }
    });

    if (Object.keys(allowedUpdates).length === 0) {
      console.log('No allowed fields to sync');
      return;
    }

    // Add sync metadata
    const syncMetadata: SyncMetadata = {
      sourceChurchId,
      syncedAt: new Date().toISOString(),
      syncedBy: currentUserId,
      syncDirection: 'ministry-to-normal'
    };

    // Update member in source church
    const sourceDocRef = doc(db, `churches/${sourceChurchId}/members`, member.id);
    await updateDoc(sourceDocRef, {
      ...allowedUpdates,
      lastUpdated: new Date().toISOString(),
      syncMetadata
    });

    console.log(`✅ [Bidirectional Sync] Successfully synced member ${member.id} to source church`);
  } catch (error) {
    console.error(`❌ [Bidirectional Sync] Failed to sync member to source church:`, error);
    throw error;
  }
};

/**
 * Sync attendance record from ministry mode to source church
 */
export const syncAttendanceToSourceChurch = async (
  attendanceRecord: AttendanceRecord,
  sourceChurchId: string,
  currentUserId: string
): Promise<void> => {
  try {
    console.log(`🔄 [Bidirectional Sync] Syncing attendance to source church ${sourceChurchId}`);
    console.log(`📋 Attendance record:`, attendanceRecord);

    const syncMetadata: SyncMetadata = {
      sourceChurchId,
      syncedAt: new Date().toISOString(),
      syncedBy: currentUserId,
      syncDirection: 'ministry-to-normal'
    };

    // Use the same ID pattern as the original record to maintain consistency
    const sourceDocRef = doc(db, `churches/${sourceChurchId}/attendance`, attendanceRecord.id);

    // Check if record already exists to avoid duplicates
    const existingDoc = await getDoc(sourceDocRef);

    if (existingDoc.exists()) {
      console.log(`📝 [Bidirectional Sync] Updating existing attendance record in source church`);
      await updateDoc(sourceDocRef, {
        ...attendanceRecord,
        syncMetadata,
        lastUpdated: new Date().toISOString()
      });
    } else {
      console.log(`📝 [Bidirectional Sync] Creating new attendance record in source church`);
      await setDoc(sourceDocRef, {
        ...attendanceRecord,
        syncMetadata,
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
    }

    console.log(`✅ [Bidirectional Sync] Successfully synced attendance to source church`);
  } catch (error) {
    console.error(`❌ [Bidirectional Sync] Failed to sync attendance to source church:`, error);
    throw error;
  }
};

/**
 * Sync new believer from ministry mode to source church
 */
export const syncNewBelieverToSourceChurch = async (
  newBeliever: NewBeliever,
  sourceChurchId: string,
  currentUserId: string
): Promise<void> => {
  try {
    console.log(`🔄 [Bidirectional Sync] Syncing new believer to source church ${sourceChurchId}`);

    const syncMetadata: SyncMetadata = {
      sourceChurchId,
      syncedAt: new Date().toISOString(),
      syncedBy: currentUserId,
      syncDirection: 'ministry-to-normal'
    };

    // Add new believer to source church
    const sourceCollectionRef = collection(db, `churches/${sourceChurchId}/newBelievers`);
    await addDoc(sourceCollectionRef, {
      ...newBeliever,
      syncMetadata,
      createdDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    });

    console.log(`✅ [Bidirectional Sync] Successfully synced new believer to source church`);
  } catch (error) {
    console.error(`❌ [Bidirectional Sync] Failed to sync new believer to source church:`, error);
    throw error;
  }
};

/**
 * Sync Sunday confirmation from ministry mode to source church
 */
export const syncConfirmationToSourceChurch = async (
  confirmation: SundayConfirmation,
  sourceChurchId: string,
  currentUserId: string
): Promise<void> => {
  try {
    console.log(`🔄 [Bidirectional Sync] Syncing confirmation to source church ${sourceChurchId}`);

    const syncMetadata: SyncMetadata = {
      sourceChurchId,
      syncedAt: new Date().toISOString(),
      syncedBy: currentUserId,
      syncDirection: 'ministry-to-normal'
    };

    // Add confirmation to source church
    const sourceCollectionRef = collection(db, `churches/${sourceChurchId}/sundayConfirmations`);
    await addDoc(sourceCollectionRef, {
      ...confirmation,
      syncMetadata,
      createdDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    });

    console.log(`✅ [Bidirectional Sync] Successfully synced confirmation to source church`);
  } catch (error) {
    console.error(`❌ [Bidirectional Sync] Failed to sync confirmation to source church:`, error);
    throw error;
  }
};

/**
 * Check if a record was synced from another church to prevent sync loops
 */
export const isSyncedRecord = (record: any): boolean => {
  return !!(record.syncMetadata?.syncDirection);
};

/**
 * Get the original church ID for a synced record
 */
export const getOriginalChurchId = (record: any): string | null => {
  return record.syncMetadata?.sourceChurchId || (record as any).sourceChurchId || null;
};

/**
 * Determine the appropriate source church for new records in ministry mode
 * This helps decide which church to sync new records to
 */
export const determineSourceChurchForNewRecord = async (
  ministryName: string,
  userProfile: any
): Promise<string | null> => {
  try {
    // Use the user's default church as the source for new records
    const defaultChurchId = userProfile?.contexts?.defaultChurchId || userProfile?.churchId;
    
    if (defaultChurchId) {
      console.log(`📍 [Bidirectional Sync] Using default church ${defaultChurchId} as source for new ${ministryName} record`);
      return defaultChurchId;
    }

    console.warn('No default church found for user, cannot determine source church for new record');
    return null;
  } catch (error) {
    console.error('Failed to determine source church for new record:', error);
    return null;
  }
};
