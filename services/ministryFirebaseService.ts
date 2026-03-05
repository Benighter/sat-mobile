/**
 * Ministry Firebase Service
 *
 * Simplified Firebase service for ministry mode - operates independently.
 * Ministry app now manages its own data without syncing to main church system.
 */

import { Member, AttendanceRecord, NewBeliever, SundayConfirmation } from '../types';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase.config';
import {
  membersFirebaseService,
  attendanceFirebaseService,
  newBelieversFirebaseService,
  confirmationFirebaseService,
  ministryExclusionsService,
  ministryMemberOverridesService
} from './firebaseService';

// REMOVED: Bidirectional sync imports - ministry app now operates independently
// import {
//   syncMemberToSourceChurch,
//   syncAttendanceToSourceChurch,
//   syncNewBelieverToSourceChurch,
//   syncConfirmationToSourceChurch,
//   determineSourceChurchForNewRecord
// } from './bidirectionalSyncService';

/**
 * Simplified Members Service - Independent Operation
 * All members are created and managed within the ministry church only
 */
export const ministryMembersService = {
  // Read operations use the standard service
  getAll: membersFirebaseService.getAll,
  getById: membersFirebaseService.getById,
  onSnapshot: membersFirebaseService.onSnapshot,

  // Write operations - simplified, no sync
  add: async (member: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>, userProfile: any): Promise<string> => {
    try {
      console.log('✨ [Ministry Service] Adding new member (independent mode)');

      // All members in ministry mode are native ministry members
      const memberData = {
        ...member,
        isNativeMinistryMember: true // All ministry members are native
      };

      console.log('📝 [Ministry Service] Member data being added:', {
        firstName: memberData.firstName,
        lastName: memberData.lastName,
        ministry: memberData.ministry,
        isNativeMinistryMember: memberData.isNativeMinistryMember
      });

      // Add to ministry church (current context) - no sync
      const memberId = await membersFirebaseService.add(memberData);
      console.log('✅ [Ministry Service] Member added successfully (no sync)');

      return memberId;
    } catch (error) {
      console.error('Failed to add member:', error);
      throw error;
    }
  },

  update: async (memberId: string, updates: Partial<Member>, userProfile: any, contextMember?: Member): Promise<void> => {
    try {
      console.log(`✨ [Ministry Service] Updating member ${memberId} (independent mode)`);

      // Simply update in ministry church - no sync
      await membersFirebaseService.update(memberId, updates);
      console.log('✅ [Ministry Service] Member updated successfully (no sync)');

    } catch (error) {
      console.error('Failed to update member:', error);
      throw error;
    }
  },

  delete: async (memberId: string, userProfile: any): Promise<void> => {
    try {
      console.log(`✨ [Ministry Service] Deleting member ${memberId} (independent mode)`);

      // Simply delete from ministry church - no sync
      await membersFirebaseService.delete(memberId);
      console.log('✅ [Ministry Service] Member deleted successfully (no sync)');

    } catch (error) {
      console.error('Failed to delete member:', error);
      throw error;
    }
  }

  // REMOVED: transferToConstituency - ministry app operates independently
  // Members cannot be transferred to constituencies from ministry app
};

/**
 * Simplified Attendance Service - Independent Operation
 */
export const ministryAttendanceService = {
  // All operations use the standard service - no sync
  getAll: attendanceFirebaseService.getAll,
  getById: attendanceFirebaseService.getById,
  onSnapshot: attendanceFirebaseService.onSnapshot,
  add: attendanceFirebaseService.add,
  addOrUpdate: attendanceFirebaseService.addOrUpdate,
  update: attendanceFirebaseService.update,
  delete: attendanceFirebaseService.delete
};

/**
 * Simplified New Believers Service - Independent Operation
 */
export const ministryNewBelieversService = {
  // All operations use the standard service - no sync
  getAll: newBelieversFirebaseService.getAll,
  getById: newBelieversFirebaseService.getById,
  onSnapshot: newBelieversFirebaseService.onSnapshot,
  add: newBelieversFirebaseService.add,
  update: newBelieversFirebaseService.update,
  delete: newBelieversFirebaseService.delete
};

/**
 * Simplified Confirmations Service - Independent Operation
 */
export const ministryConfirmationService = {
  // All operations use the standard service - no sync
  getAll: confirmationFirebaseService.getAll,
  getById: confirmationFirebaseService.getById,
  onSnapshot: confirmationFirebaseService.onSnapshot,
  add: confirmationFirebaseService.add,
  update: confirmationFirebaseService.update,
  delete: confirmationFirebaseService.delete
};
