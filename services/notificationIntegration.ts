// Notification Integration Service - Wraps existing Firebase operations to create notifications
import { createNotificationHelpers } from './notificationService';
import { membersFirebaseService, newBelieversFirebaseService, guestFirebaseService, confirmationFirebaseService } from './firebaseService';
import { Member, NewBeliever, Guest, SundayConfirmation, User } from '../types';

// Set up notification context
let currentUser: User | null = null;

export const setNotificationIntegrationContext = (user: User | null, _churchId: string | null) => {
  currentUser = user;
  // No need to call setNotificationContext here as it's already called in the main context
};

// Helper function to get bacenta name by ID
const getBacentaName = async (bacentaId: string): Promise<string | undefined> => {
  try {
    const { bacentasFirebaseService } = await import('./firebaseService');
    const bacentas = await bacentasFirebaseService.getAll();
    const bacenta = bacentas.find(b => b.id === bacentaId);
    return bacenta?.name;
  } catch (error) {
    console.error('Failed to get bacenta name:', error);
    return undefined;
  }
};

// Member operations with notifications
export const memberOperationsWithNotifications = {
  // Add member with notification
  add: async (member: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>): Promise<string> => {
    try {
      // Call original add function
      const memberId = await membersFirebaseService.add(member);

      // Create notification if user is a leader (not admin)
      if (currentUser && currentUser.role === 'leader') {
        const bacentaName = member.bacentaId ? await getBacentaName(member.bacentaId) : undefined;
        await createNotificationHelpers.memberAdded(
          currentUser.displayName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown Leader',
          `${member.firstName} ${member.lastName || ''}`.trim(),
          member.role,
          bacentaName
        );
      }

      return memberId;
    } catch (error: any) {
      throw error;
    }
  },

  // Update member with notification
  update: async (memberId: string, updates: Partial<Member>, originalMember?: Member): Promise<void> => {
    try {
      // Call original update function
      await membersFirebaseService.update(memberId, updates);

      // Create notification if user is a leader (not admin)
      if (currentUser && currentUser.role === 'leader' && originalMember) {
        const changes: string[] = [];
        
        if (updates.firstName && updates.firstName !== originalMember.firstName) {
          changes.push('first name');
        }
        if (updates.lastName && updates.lastName !== originalMember.lastName) {
          changes.push('last name');
        }
        if (updates.phoneNumber && updates.phoneNumber !== originalMember.phoneNumber) {
          changes.push('phone number');
        }
        if (updates.role && updates.role !== originalMember.role) {
          changes.push('role');
        }
        if (updates.bacentaId && updates.bacentaId !== originalMember.bacentaId) {
          changes.push('bacenta assignment');
        }

        if (changes.length > 0) {
          await createNotificationHelpers.memberUpdated(
            currentUser.displayName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown Leader',
            `${originalMember.firstName} ${originalMember.lastName || ''}`.trim(),
            changes
          );
        }
      }
    } catch (error: any) {
      throw error;
    }
  },

  // Delete member with notification
  delete: async (memberId: string, memberName?: string): Promise<void> => {
    try {
      // Call original delete function
      await membersFirebaseService.delete(memberId);

      // Create notification if user is a leader (not admin)
      if (currentUser && currentUser.role === 'leader') {
        await createNotificationHelpers.memberDeleted(
          currentUser.displayName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown Leader',
          memberName || 'Unknown Member'
        );
      }
    } catch (error: any) {
      console.error('❌ Failed to delete member with notification:', error);
      throw error;
    }
  }
};

// New Believer operations with notifications
export const newBelieverOperationsWithNotifications = {
  // Add new believer with notification
  add: async (newBeliever: Omit<NewBeliever, 'id' | 'createdDate' | 'lastUpdated'>): Promise<string> => {
    try {
      // Call original add function
      const newBelieverId = await newBelieversFirebaseService.add(newBeliever);

      // Create notification if user is a leader (not admin)
      if (currentUser && currentUser.role === 'leader') {
        await createNotificationHelpers.newBelieverAdded(
          currentUser.displayName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown Leader',
          `${newBeliever.name} ${newBeliever.surname}`.trim()
        );
      }

      return newBelieverId;
    } catch (error: any) {
      throw error;
    }
  },

  // Update new believer with notification
  update: async (newBelieverId: string, updates: Partial<NewBeliever>, originalNewBeliever?: NewBeliever): Promise<void> => {
    try {
      // Call original update function
      await newBelieversFirebaseService.update(newBelieverId, updates);

      // Create notification if user is a leader (not admin) and significant changes occurred
      if (currentUser && currentUser.role === 'leader' && originalNewBeliever) {
        const changes: string[] = [];
        
        if (updates.name && updates.name !== originalNewBeliever.name) {
          changes.push('name');
        }
        if (updates.contact && updates.contact !== originalNewBeliever.contact) {
          changes.push('contact');
        }
        if (updates.ministry && updates.ministry !== originalNewBeliever.ministry) {
          changes.push('ministry');
        }

        // Only create notification for significant changes
        if (changes.length > 0) {
          await createNotificationHelpers.memberUpdated(
            currentUser.displayName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown Leader',
            `${originalNewBeliever.name} ${originalNewBeliever.surname}`.trim(),
            changes
          );
        }
      }
    } catch (error: any) {
      throw error;
    }
  }
};

// Guest operations with notifications
export const guestOperationsWithNotifications = {
  // Add guest with notification
  add: async (guest: Omit<Guest, 'id'>): Promise<string> => {
    try {
      // Call original add function - note that the original function will add createdBy automatically
      const guestId = await guestFirebaseService.add(guest);

      // Create notification if user is a leader (not admin)
      if (currentUser && currentUser.role === 'leader') {
        const bacentaName = guest.bacentaId ? await getBacentaName(guest.bacentaId) : undefined;
        await createNotificationHelpers.guestAdded(
          currentUser.displayName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown Leader',
          `${guest.firstName} ${guest.lastName || ''}`.trim(),
          bacentaName
        );
      }

      return guestId;
    } catch (error: any) {
      throw error;
    }
  }
};

// Attendance operations with notifications
export const attendanceOperationsWithNotifications = {
  // Mark individual attendance with notification (for batch processing)
  markAttendance: async (attendanceRecord: any): Promise<void> => {
    try {
      const { attendanceFirebaseService } = await import('./firebaseService');
      await attendanceFirebaseService.addOrUpdate(attendanceRecord);

      // Individual attendance marks don't create notifications to avoid spam
      // Only batch operations or confirmations create notifications
    } catch (error: any) {
      throw error;
    }
  }
};

// Confirmation operations with notifications
export const confirmationOperationsWithNotifications = {
  // Batch confirm attendance with notification
  batchConfirm: async (confirmations: SundayConfirmation[], attendanceDate: string): Promise<void> => {
    try {
      // Process confirmations one by one (since there's no batch function in the original service)
      for (const confirmation of confirmations) {
        await confirmationFirebaseService.addOrUpdate(confirmation);
      }

      // Create notification if user is a leader (not admin)
      if (currentUser && currentUser.role === 'leader' && confirmations.length > 0) {
        await createNotificationHelpers.attendanceConfirmed(
          currentUser.displayName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown Leader',
          attendanceDate,
          confirmations.length
        );
      }
    } catch (error: any) {
      throw error;
    }
  },

  // Add or update single confirmation with notification
  addOrUpdate: async (confirmation: SundayConfirmation): Promise<void> => {
    try {
      // Call original function
      await confirmationFirebaseService.addOrUpdate(confirmation);

      // Create notification if user is a leader (not admin)
      if (currentUser && currentUser.role === 'leader') {
        const leaderName = currentUser.displayName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown Leader';

        if (confirmation.status === 'Confirmed') {
          await createNotificationHelpers.attendanceConfirmed(
            leaderName,
            confirmation.date,
            1 // Single confirmation
          );
        } else if (confirmation.status === 'Not Confirmed') {
          // Create notification for confirmation removal
          await createNotificationHelpers.attendanceRemoved(
            leaderName,
            confirmation.date,
            1 // Single removal
          );
        }
      }
    } catch (error: any) {
      console.error('❌ Failed to add/update confirmation with notification:', error);
      throw error;
    }
  },

  // Remove confirmation with notification
  remove: async (memberId: string, date: string): Promise<void> => {
    try {
      // Call original remove function if it exists, otherwise use addOrUpdate with 'Not Confirmed'
      const confirmation: SundayConfirmation = {
        id: `${memberId}_${date}`,
        memberId,
        date,
        status: 'Not Confirmed',
        confirmationTimestamp: new Date().toISOString()
      };

      await confirmationFirebaseService.addOrUpdate(confirmation);

      // Create notification if user is a leader (not admin)
      if (currentUser && currentUser.role === 'leader') {
        const leaderName = currentUser.displayName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown Leader';
        await createNotificationHelpers.attendanceRemoved(
          leaderName,
          date,
          1 // Single removal
        );
      }
    } catch (error: any) {
      console.error('❌ Failed to remove confirmation with notification:', error);
      throw error;
    }
  }
};

// Convenience function to replace standard operations with notification-enabled versions
export const enableNotifications = () => {
  // This function can be called to ensure notifications are enabled
  // The actual replacement of operations should be done at the component level
  // by importing these notification-enabled functions instead of the original ones
  
  console.log('Admin notification system enabled');
};