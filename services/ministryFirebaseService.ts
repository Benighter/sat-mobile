/**
 * Ministry Firebase Service
 * 
 * Enhanced Firebase service for ministry mode that supports bidirectional sync.
 * Wraps the standard Firebase services with sync capabilities.
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
import {
  syncMemberToSourceChurch,
  syncAttendanceToSourceChurch,
  syncNewBelieverToSourceChurch,
  syncConfirmationToSourceChurch,
  determineSourceChurchForNewRecord
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

  update: async (memberId: string, updates: Partial<Member>, userProfile: any, contextMember?: Member): Promise<void> => {
    try {
      console.log(`🔄 [Ministry Service] Updating member ${memberId} with bidirectional sync`);

      // Get current member to check for source church (from ministry church)
      const currentMember = await membersFirebaseService.getById(memberId);
      const { firebaseUtils } = await import('./firebaseService');
      const currentChurchId = firebaseUtils.getCurrentChurchId();
      const inferredSourceChurchId = (contextMember as any)?.sourceChurchId || (currentMember as any)?.sourceChurchId || userProfile?.churchId || currentChurchId;
      const isSyncedOnly = !currentMember; // member not found in ministry church doc set

      // Build override payload for ministry context (do NOT mutate source church record)
      const overridePayload: { frozen?: boolean; role?: Member['role']; ministryPosition?: string } = {};
      if (updates.frozen !== undefined) overridePayload.frozen = updates.frozen;
      if (updates.role !== undefined) overridePayload.role = updates.role as Member['role'];
      if (updates.ministryPosition !== undefined) overridePayload.ministryPosition = updates.ministryPosition as string;

      if (isSyncedOnly) {
        // Apply overrides in ministry church for synced-only member (e.g., role, ministryPosition, frozen)
        if (!inferredSourceChurchId) throw new Error('Member not found');
        if (Object.keys(overridePayload).length > 0) {
          await ministryMemberOverridesService.set(memberId, inferredSourceChurchId, overridePayload);
          console.log('✅ [Ministry Service] Applied ministry overrides for synced-only member');
        }
        // Also sync allowed non-role fields back to the source church so form edits persist
        const safeEntries = Object.entries(updates).filter(([k]) => !['role','ministryPosition'].includes(k));
        if (safeEntries.length > 0 && contextMember) {
          const safeUpdates = Object.fromEntries(safeEntries) as Partial<Member>;
          await syncMemberToSourceChurch(contextMember as Member, safeUpdates, userProfile?.uid || '');
          console.log('✅ [Ministry Service] Synced allowed fields to source church for synced-only member');
        }
      } else {
        // Update in ministry church document
        await membersFirebaseService.update(memberId, updates);
        // Also write overrides so deduped source record reflects ministry changes in UI
        if (inferredSourceChurchId && Object.keys(overridePayload).length > 0) {
          await ministryMemberOverridesService.set(memberId, inferredSourceChurchId, overridePayload);
        }
      }

      // Sync only non-ministry-specific fields back to source church (exclude role/ministryPosition)
      const shouldSyncToSource = (contextMember as any)?.sourceChurchId && (contextMember as any).sourceChurchId !== currentChurchId;
      if (shouldSyncToSource) {
        const safeUpdatesEntries = Object.entries(updates).filter(([k]) => !['role', 'ministryPosition'].includes(k));
        if (safeUpdatesEntries.length > 0) {
          const safeUpdates = Object.fromEntries(safeUpdatesEntries) as Partial<Member>;
          await syncMemberToSourceChurch((contextMember as Member) || (currentMember as Member), safeUpdates, userProfile?.uid || '');
        }
      }

    } catch (error) {
      console.error('Failed to update member with sync:', error);
      throw error;
    }
  },

  delete: async (memberId: string, userProfile: any): Promise<void> => {
    try {
      console.log(`🔄 [Ministry Service] Deleting member ${memberId} with bidirectional sync`);

      // Get current member to determine source church and native status
      const currentMember = await membersFirebaseService.getById(memberId);
      const { firebaseUtils } = await import('./firebaseService');
      const currentChurchId = firebaseUtils.getCurrentChurchId();

      // Delete from ministry church
      await membersFirebaseService.delete(memberId);

      // Determine source church ID for exclusion key
      const sourceChurchId = (currentMember as any)?.sourceChurchId || userProfile?.churchId || currentChurchId;

      // Record permanent exclusion to prevent future re-sync into this ministry
      if (sourceChurchId) {
        try {
          await ministryExclusionsService.excludeMember(memberId, sourceChurchId);
          console.log(`🛡️ [Ministry Service] Excluded member ${memberId} from ministry view (sourceChurchId=${sourceChurchId})`);
        } catch (ex) {
          console.warn('⚠️ [Ministry Service] Failed to record exclusion for deleted member:', ex);
        }

        // Clear any ministry overrides for this member/source
        try {
          await ministryMemberOverridesService.clear(memberId, sourceChurchId);
          console.log(`🧹 [Ministry Service] Cleared ministry overrides for ${memberId} (sourceChurchId=${sourceChurchId})`);
        } catch (ovEx) {
          console.warn('⚠️ [Ministry Service] Failed to clear overrides for deleted member:', ovEx);
        }
      }

      // Clean up ministry-specific records (attendance, confirmations) only in the ministry church
      try {
        // Attendance
        const attendSnap = await getDocs(query(collection(db, `churches/${currentChurchId}/attendance`), where('memberId', '==', memberId)));
        for (const d of attendSnap.docs) {
          try { await (await import('firebase/firestore')).deleteDoc(doc(db, `churches/${currentChurchId}/attendance/${d.id}`)); } catch {}
        }
        // Sunday Confirmations
        const confSnap = await getDocs(query(collection(db, `churches/${currentChurchId}/sundayConfirmations`), where('memberId', '==', memberId)));
        for (const d of confSnap.docs) {
          try { await (await import('firebase/firestore')).deleteDoc(doc(db, `churches/${currentChurchId}/sundayConfirmations/${d.id}`)); } catch {}
        }
      } catch (cleanupErr) {
        console.warn('⚠️ [Ministry Service] Failed to clean up ministry-specific records for deleted member:', cleanupErr);
      }

      // Note: We don't delete from source church to preserve data integrity
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
  add: async (attendance: AttendanceRecord | Omit<AttendanceRecord, 'createdDate' | 'lastUpdated'>, _userProfile: any): Promise<string> => {
    try {
      console.log('🔄 [Ministry Service] Adding attendance with bidirectional sync');

      // Add to ministry church first
  await attendanceFirebaseService.addOrUpdate(attendance as AttendanceRecord);
  const attendanceId = (attendance as any).id as string;

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
      // Determine current church from context (ministry church when in ministry mode)
      const { firebaseUtils } = await import('./firebaseService');
      const currentChurchId = firebaseUtils.getCurrentChurchId();

      console.log('👤 Member details:', {
        memberId: attendance.memberId,
        memberFound: !!member,
        memberName: member ? `${member.firstName} ${member.lastName}` : 'Unknown',
        sourceChurchId,
        isNativeMember,
        currentChurchId
      });

      if (sourceChurchId && sourceChurchId !== currentChurchId && !isNativeMember) {
        console.log(`🔄 [Ministry Service] Syncing attendance to source church: ${sourceChurchId}`);

        // Sync to source church in parallel with ministry church for faster operation
        await Promise.all([
          attendanceFirebaseService.addOrUpdate(attendance),
          syncAttendanceToSourceChurch(attendance, sourceChurchId, userProfile?.uid || '')
        ]);

        console.log(`✅ [Ministry Service] Attendance synced to both ministry and source church`);
        return attendance.id;
      } else {
        const reason = isNativeMember
          ? 'member is native to ministry'
          : sourceChurchId === currentChurchId
            ? 'member belongs to current church'
            : 'no source church found';
        console.log(`📝 [Ministry Service] No source church sync needed - ${reason}`);

        // Add/update in ministry church only
  await attendanceFirebaseService.addOrUpdate(attendance);
  console.log(`✅ [Ministry Service] Attendance saved to ministry church only`);
  return attendance.id;
      }
    } catch (error) {
      console.error('Failed to add/update attendance with sync:', error);
      throw error;
    }
  },

  update: async (attendanceId: string, updates: Partial<AttendanceRecord>, _userProfile: any): Promise<void> => {
    try {
      console.log(`🔄 [Ministry Service] Updating attendance ${attendanceId} with bidirectional sync`);

  // Update in ministry church by merging changes
  await attendanceFirebaseService.addOrUpdate({ id: attendanceId, ...(updates as any) } as AttendanceRecord);

      // For attendance updates, we typically don't sync back to avoid conflicts
      // Attendance is usually managed per church
      console.log('Attendance updated in ministry church only');

    } catch (error) {
      console.error('Failed to update attendance with sync:', error);
      throw error;
    }
  },

  // Clear attendance from source church for bidirectional sync
  clearFromSourceChurch: async (recordId: string, sourceChurchId: string, _currentUserId: string): Promise<void> => {
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
 * Utility: Ensure newly added members in the current ministry church are marked as native
 * so that ministry data listeners include them immediately.
 */
export const ensureNativeFlagsForMinistryChurch = async (ministryName: string): Promise<void> => {
  try {
    const { firebaseUtils } = await import('./firebaseService');
    const currentChurchId = firebaseUtils.getCurrentChurchId();
    if (!currentChurchId) return;

    // Find members in the ministry church with the selected ministry that are missing the native flag
    const ref = collection(db, `churches/${currentChurchId}/members`);
    const q = query(ref, where('ministry', '==', ministryName));
    const snap = await getDocs(q);

    const updates: Promise<any>[] = [];
    for (const d of snap.docs) {
      const data = d.data() as any;
      if ((data.isActive !== false) && data.ministry === ministryName && data.isNativeMinistryMember !== true) {
        updates.push(updateDoc(doc(db, `churches/${currentChurchId}/members/${d.id}`), { isNativeMinistryMember: true }));
      }
    }
    if (updates.length) {
      await Promise.allSettled(updates);
    }
  } catch (e) {
    // Best-effort; ignore errors
    console.warn('[ensureNativeFlagsForMinistryChurch] failed:', (e as any)?.message || String(e));
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
