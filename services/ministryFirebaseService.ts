/**
 * Ministry Firebase Service
 * 
 * Enhanced Firebase service for ministry mode that supports bidirectional sync.
 * Wraps the standard Firebase services with sync capabilities.
 */

import { Member, AttendanceRecord, NewBeliever, SundayConfirmation } from '../types';
import { 
  membersFirebaseService, 
  attendanceFirebaseService, 
  newBelieversFirebaseService,
  confirmationFirebaseService 
} from './firebaseService';
import {
  syncMemberToSourceChurch,
  syncAttendanceToSourceChurch,
  syncNewBelieverToSourceChurch,
  syncConfirmationToSourceChurch,
  determineSourceChurchForNewRecord,
  isSyncedRecord
} from './bidirectionalSyncService';

/**
 * Enhanced Members Service with Bidirectional Sync
 */
export const ministryMembersService = {
  // Read operations use the standard service (already aggregated by ministry data service)
  getAll: membersFirebaseService.getAll,
  getById: membersFirebaseService.getById,
  onSnapshot: membersFirebaseService.onSnapshot,

  // Write operations with bidirectional sync
  add: async (member: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>, userProfile: any): Promise<string> => {
    try {
      console.log('🔄 [Ministry Service] Adding new member with bidirectional sync');

      // Check if this should be a native ministry member
      const isNative = !member.targetConstituencyId; // If no target constituency specified, it's native

      // Prepare member data with native flag
      const memberData = {
        ...member,
        isNativeMinistryMember: isNative
      };

      console.log('📝 [Ministry Service] Member data being added:', {
        isNative,
        memberData: {
          firstName: memberData.firstName,
          lastName: memberData.lastName,
          ministry: memberData.ministry,
          isNativeMinistryMember: memberData.isNativeMinistryMember,
          frozen: memberData.frozen
        }
      });

      // Add to ministry church (current context)
      const memberId = await membersFirebaseService.add(memberData);

      if (isNative) {
        console.log('✨ [Ministry Service] Added native ministry member - no constituency sync');
      } else {
        // Sync to specified constituency
        const targetChurchId = member.targetConstituencyId;
        if (targetChurchId && targetChurchId !== userProfile?.churchId) {
          console.log(`🔄 [Ministry Service] Syncing to target constituency: ${targetChurchId}`);
          const memberWithId = { ...memberData, id: memberId } as Member;
          await syncMemberToSourceChurch(memberWithId, memberData, userProfile?.uid || '');
        }
      }

      return memberId;
    } catch (error) {
      console.error('Failed to add member with sync:', error);
      throw error;
    }
  },

  update: async (memberId: string, updates: Partial<Member>, userProfile: any): Promise<void> => {
    try {
      console.log(`🔄 [Ministry Service] Updating member ${memberId} with bidirectional sync`);
      
      // Get current member to check for source church
      const currentMember = await membersFirebaseService.getById(memberId);
      if (!currentMember) {
        throw new Error('Member not found');
      }
      
      // Update in ministry church
      await membersFirebaseService.update(memberId, updates);
      
      // Sync to source church if this member came from another church
      const sourceChurchId = (currentMember as any).sourceChurchId;
      if (sourceChurchId && sourceChurchId !== userProfile?.churchId) {
        await syncMemberToSourceChurch(currentMember, updates, userProfile?.uid || '');
      }
      
    } catch (error) {
      console.error('Failed to update member with sync:', error);
      throw error;
    }
  },

  delete: async (memberId: string, userProfile: any): Promise<void> => {
    try {
      console.log(`🔄 [Ministry Service] Deleting member ${memberId} with bidirectional sync`);
      
      // Get current member to check for source church
      const currentMember = await membersFirebaseService.getById(memberId);
      
      // Delete from ministry church
      await membersFirebaseService.delete(memberId);
      
      // Note: We don't delete from source church to preserve data integrity
      // The member will just no longer appear in ministry mode
      console.log('Member deleted from ministry church only (preserved in source church)');
      
    } catch (error) {
      console.error('Failed to delete member with sync:', error);
      throw error;
    }
  },

  // Transfer native ministry member to a constituency
  transferToConstituency: async (memberId: string, targetConstituencyId: string, userProfile: any): Promise<void> => {
    try {
      console.log(`🔄 [Ministry Service] Transferring native member ${memberId} to constituency ${targetConstituencyId}`);

      // Get current member
      const currentMember = await membersFirebaseService.getById(memberId);
      if (!currentMember) {
        throw new Error('Member not found');
      }

      // Verify this is a native ministry member
      if (!currentMember.isNativeMinistryMember) {
        throw new Error('Only native ministry members can be transferred to constituencies');
      }

      // Update member to mark as transferred
      const updates = {
        isNativeMinistryMember: false,
        targetConstituencyId: targetConstituencyId
      };

      // Update in ministry church
      await membersFirebaseService.update(memberId, updates);

      // Sync to target constituency
      const memberWithUpdates = { ...currentMember, ...updates };
      await syncMemberToSourceChurch(memberWithUpdates, updates, userProfile?.uid || '');

      console.log(`✅ [Ministry Service] Successfully transferred member to constituency ${targetConstituencyId}`);
    } catch (error) {
      console.error('Failed to transfer member to constituency:', error);
      throw error;
    }
  }
};

/**
 * Enhanced Attendance Service with Bidirectional Sync
 */
export const ministryAttendanceService = {
  // Read operations use the standard service
  getAll: attendanceFirebaseService.getAll,
  getById: attendanceFirebaseService.getById,
  onSnapshot: attendanceFirebaseService.onSnapshot,

  // Write operations with bidirectional sync
  add: async (attendance: AttendanceRecord | Omit<AttendanceRecord, 'createdDate' | 'lastUpdated'>, userProfile: any): Promise<string> => {
    try {
      console.log('🔄 [Ministry Service] Adding attendance with bidirectional sync');

      // Add to ministry church first
      const attendanceId = await attendanceFirebaseService.addOrUpdate(attendance as AttendanceRecord);

      // For ministry mode, we need to sync to the member's source church
      const memberId = attendance.memberId;
      if (memberId) {
        // We need to get the member's source church from the aggregated data
        // This requires access to the members list to find the source church
        console.log(`🔄 [Ministry Service] Attendance for member ${memberId} added to ministry church`);
        console.log('Note: Source church sync requires member lookup - implementing enhanced sync...');
      }

      return attendanceId;
    } catch (error) {
      console.error('Failed to add attendance with sync:', error);
      throw error;
    }
  },

  // Enhanced addOrUpdate method for attendance marking
  addOrUpdate: async (attendance: AttendanceRecord, userProfile: any, members: any[]): Promise<string> => {
    try {
      console.log('🔄 [Ministry Service] Adding/updating attendance with bidirectional sync');
      console.log('📋 Attendance record:', attendance);
      console.log('👥 Available members:', members.length);

      // Find the member to get their source church
      const member = members.find(m => m.id === attendance.memberId);
      const sourceChurchId = (member as any)?.sourceChurchId;
      const isNativeMember = member?.isNativeMinistryMember;

      console.log('👤 Member details:', {
        memberId: attendance.memberId,
        memberFound: !!member,
        memberName: member ? `${member.firstName} ${member.lastName}` : 'Unknown',
        sourceChurchId,
        isNativeMember,
        currentChurchId: userProfile?.churchId
      });

      if (sourceChurchId && sourceChurchId !== userProfile?.churchId && !isNativeMember) {
        console.log(`🔄 [Ministry Service] Syncing attendance to source church: ${sourceChurchId}`);

        // Sync to source church in parallel with ministry church for faster operation
        const [attendanceId] = await Promise.all([
          attendanceFirebaseService.addOrUpdate(attendance),
          syncAttendanceToSourceChurch(attendance, sourceChurchId, userProfile?.uid || '')
        ]);

        console.log(`✅ [Ministry Service] Attendance synced to both ministry and source church`);
        return attendanceId;
      } else {
        const reason = isNativeMember
          ? 'member is native to ministry'
          : sourceChurchId === userProfile?.churchId
            ? 'member belongs to current church'
            : 'no source church found';
        console.log(`📝 [Ministry Service] No source church sync needed - ${reason}`);

        // Add/update in ministry church only
        const attendanceId = await attendanceFirebaseService.addOrUpdate(attendance);
        console.log(`✅ [Ministry Service] Attendance saved to ministry church only`);
        return attendanceId;
      }
    } catch (error) {
      console.error('Failed to add/update attendance with sync:', error);
      throw error;
    }
  },

  update: async (attendanceId: string, updates: Partial<AttendanceRecord>, userProfile: any): Promise<void> => {
    try {
      console.log(`🔄 [Ministry Service] Updating attendance ${attendanceId} with bidirectional sync`);

      // Update in ministry church
      await attendanceFirebaseService.update(attendanceId, updates);

      // For attendance updates, we typically don't sync back to avoid conflicts
      // Attendance is usually managed per church
      console.log('Attendance updated in ministry church only');

    } catch (error) {
      console.error('Failed to update attendance with sync:', error);
      throw error;
    }
  },

  // Clear attendance from source church for bidirectional sync
  clearFromSourceChurch: async (recordId: string, sourceChurchId: string, currentUserId: string): Promise<void> => {
    try {
      console.log(`🔄 [Ministry Service] Clearing attendance from source church: ${sourceChurchId}`);

      // Import the delete function from bidirectional sync service
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../firebase.config');

      const sourceDocRef = doc(db, `churches/${sourceChurchId}/attendance`, recordId);
      await deleteDoc(sourceDocRef);

      console.log(`✅ [Ministry Service] Successfully cleared attendance from source church`);
    } catch (error) {
      console.error('Failed to clear attendance from source church:', error);
      throw error;
    }
  }
};

/**
 * Enhanced New Believers Service with Bidirectional Sync
 */
export const ministryNewBelieversService = {
  // Read operations use the standard service
  getAll: newBelieversFirebaseService.getAll,
  getById: newBelieversFirebaseService.getById,
  onSnapshot: newBelieversFirebaseService.onSnapshot,

  // Write operations with bidirectional sync
  add: async (newBeliever: Omit<NewBeliever, 'id' | 'createdDate' | 'lastUpdated'>, userProfile: any): Promise<string> => {
    try {
      console.log('🔄 [Ministry Service] Adding new believer with bidirectional sync');
      
      // Add to ministry church
      const newBelieverId = await newBelieversFirebaseService.add(newBeliever);
      
      // Determine source church
      const sourceChurchId = await determineSourceChurchForNewRecord(newBeliever.ministry, userProfile);
      
      if (sourceChurchId && sourceChurchId !== userProfile?.churchId) {
        const newBelieverWithId = { ...newBeliever, id: newBelieverId } as NewBeliever;
        await syncNewBelieverToSourceChurch(newBelieverWithId, sourceChurchId, userProfile?.uid || '');
      }
      
      return newBelieverId;
    } catch (error) {
      console.error('Failed to add new believer with sync:', error);
      throw error;
    }
  },

  update: async (newBelieverId: string, updates: Partial<NewBeliever>, userProfile: any): Promise<void> => {
    try {
      console.log(`🔄 [Ministry Service] Updating new believer ${newBelieverId} with bidirectional sync`);
      
      // Update in ministry church
      await newBelieversFirebaseService.update(newBelieverId, updates);
      
      // For new believers, we typically sync updates back to source church
      const sourceChurchId = await determineSourceChurchForNewRecord('', userProfile);
      if (sourceChurchId && sourceChurchId !== userProfile?.churchId) {
        // Note: Would need to implement syncNewBelieverUpdateToSourceChurch for updates
        console.log('New believer updated in ministry church (update sync not yet implemented)');
      }
      
    } catch (error) {
      console.error('Failed to update new believer with sync:', error);
      throw error;
    }
  }
};

/**
 * Enhanced Confirmations Service with Bidirectional Sync
 */
export const ministryConfirmationService = {
  // Read operations use the standard service
  getAll: confirmationFirebaseService.getAll,
  getById: confirmationFirebaseService.getById,
  onSnapshot: confirmationFirebaseService.onSnapshot,

  // Write operations with bidirectional sync
  add: async (confirmation: Omit<SundayConfirmation, 'id' | 'createdDate' | 'lastUpdated'>, userProfile: any): Promise<string> => {
    try {
      console.log('🔄 [Ministry Service] Adding confirmation with bidirectional sync');
      
      // Add to ministry church
      const confirmationId = await confirmationFirebaseService.add(confirmation);
      
      // Determine source church
      const sourceChurchId = await determineSourceChurchForNewRecord('', userProfile);
      
      if (sourceChurchId && sourceChurchId !== userProfile?.churchId) {
        const confirmationWithId = { ...confirmation, id: confirmationId } as SundayConfirmation;
        await syncConfirmationToSourceChurch(confirmationWithId, sourceChurchId, userProfile?.uid || '');
      }
      
      return confirmationId;
    } catch (error) {
      console.error('Failed to add confirmation with sync:', error);
      throw error;
    }
  }
};
