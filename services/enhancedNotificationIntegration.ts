// Enhanced Notification Integration Service with Push Notifications
// Wraps existing Firebase operations to create both in-app and push notifications

import { createNotificationHelpers, setNotificationContext } from './notificationService';
import { pushNotificationService } from './pushNotificationService';
import { membersFirebaseService, newBelieversFirebaseService, guestFirebaseService, confirmationFirebaseService } from './firebaseService';
import { Member, NewBeliever, Guest, SundayConfirmation, User, AdminNotification } from '../types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase.config';

// Set up notification context
let currentUser: User | null = null;
let currentChurchId: string | null = null;

export const setNotificationIntegrationContext = (user: User | null, churchId: string | null) => {
  currentUser = user;
  currentChurchId = churchId;
  
  // Set context for push notification service
  pushNotificationService.setUserContext(user, churchId);
  
  // Set context for regular notification service
  setNotificationContext(user, churchId);
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

// Helper function to get admin user IDs who should receive notifications
const getAdminUserIds = async (): Promise<string[]> => {
  if (!currentChurchId || !currentUser) return [];

  try {
    // Get all admin invites where this user is the invited leader
    const invitesQuery = query(
      collection(db, `churches/${currentChurchId}/adminInvites`),
      where('invitedUserId', '==', currentUser.uid),
      where('status', '==', 'accepted')
    );

    const invitesSnapshot = await getDocs(invitesQuery);
    const adminIds: string[] = [];

    invitesSnapshot.forEach((doc) => {
      const invite = doc.data();
      if (invite.adminId) {
        adminIds.push(invite.adminId);
      }
    });

    return [...new Set(adminIds)]; // Remove duplicates
  } catch (error) {
    console.error('Failed to get admin user IDs:', error);
    return [];
  }
};

// Enhanced notification helper that creates both in-app and push notifications
const createEnhancedNotification = async (
  createNotificationFn: () => Promise<AdminNotification | null>,
  actionDescription: string
): Promise<void> => {
  try {
    // Create the in-app notification
    const notification = await createNotificationFn();
    
    if (!notification) {
      console.log('No notification created (likely no linked admins)');
      return;
    }

    console.log(`✅ In-app notification created for: ${actionDescription}`);

    // Send push notification to the admin
    const pushPayload = pushNotificationService.createNotificationPayload(notification);
    
    const success = await pushNotificationService.sendToUser(notification.adminId, pushPayload);
    
    if (success) {
      console.log(`✅ Push notification sent for: ${actionDescription}`);
    } else {
      console.log(`⚠️ Push notification failed for: ${actionDescription} (user may not have push enabled)`);
    }

  } catch (error) {
    console.error(`Failed to create enhanced notification for ${actionDescription}:`, error);
  }
};

// Member operations with enhanced notifications
export const memberOperationsWithNotifications = {
  // Add member with notification
  add: async (member: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>): Promise<string> => {
    try {
      // Call original add function
      const memberId = await membersFirebaseService.add(member);

      // Create enhanced notification if user is a leader (not admin)
      if (currentUser && currentUser.role === 'leader') {
        const bacentaName = member.bacentaId ? await getBacentaName(member.bacentaId) : undefined;
        
        await createEnhancedNotification(
          () => createNotificationHelpers.memberAdded(
            currentUser.displayName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown Leader',
            `${member.firstName} ${member.lastName || ''}`.trim(),
            member.role,
            bacentaName
          ),
          `Member added: ${member.firstName} ${member.lastName || ''}`
        );
      }

      return memberId;
    } catch (error: any) {
      throw error;
    }
  },

  // Update member with notification
  update: async (memberId: string, updates: Partial<Member>): Promise<void> => {
    try {
      // Get original member data for comparison
      const originalMember = await membersFirebaseService.get(memberId);
      if (!originalMember) {
        throw new Error('Member not found');
      }

      // Call original update function
      await membersFirebaseService.update(memberId, updates);

      // Create enhanced notification if user is a leader
      if (currentUser && currentUser.role === 'leader') {
        const memberName = `${originalMember.firstName} ${originalMember.lastName || ''}`.trim();
        
        // Check for bacenta assignment change
        if (updates.bacentaId && updates.bacentaId !== originalMember.bacentaId) {
          const newBacentaName = await getBacentaName(updates.bacentaId);
          const oldBacentaName = originalMember.bacentaId ? await getBacentaName(originalMember.bacentaId) : undefined;

          await createEnhancedNotification(
            () => createNotificationHelpers.bacentaAssignmentChanged(
              currentUser.displayName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown Leader',
              memberName,
              oldBacentaName || 'Unassigned',
              newBacentaName || 'Unknown'
            ),
            `Bacenta assignment changed for: ${memberName}`
          );
        } else {
          // Regular member update
          await createEnhancedNotification(
            () => createNotificationHelpers.memberUpdated(
              currentUser.displayName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown Leader',
              memberName
            ),
            `Member updated: ${memberName}`
          );
        }
      }
    } catch (error: any) {
      throw error;
    }
  },

  // Delete member with notification
  delete: async (memberId: string): Promise<void> => {
    try {
      // Get member data before deletion
      const member = await membersFirebaseService.get(memberId);
      if (!member) {
        throw new Error('Member not found');
      }

      // Call original delete function
      await membersFirebaseService.delete(memberId);

      // Create enhanced notification if user is a leader
      if (currentUser && currentUser.role === 'leader') {
        const memberName = `${member.firstName} ${member.lastName || ''}`.trim();

        await createEnhancedNotification(
          () => createNotificationHelpers.memberDeleted(
            currentUser.displayName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown Leader',
            memberName
          ),
          `Member deleted: ${memberName}`
        );
      }
    } catch (error: any) {
      throw error;
    }
  },

  // All other existing methods from original service...
  get: membersFirebaseService.get,
  getAll: membersFirebaseService.getAll,
  onSnapshot: membersFirebaseService.onSnapshot
};

// New Believer operations with enhanced notifications
export const newBelieverOperationsWithNotifications = {
  add: async (newBeliever: Omit<NewBeliever, 'id' | 'createdDate' | 'lastUpdated'>): Promise<string> => {
    try {
      const newBelieverId = await newBelieversFirebaseService.add(newBeliever);

      if (currentUser && currentUser.role === 'leader') {
        await createEnhancedNotification(
          () => createNotificationHelpers.newBelieverAdded(
            currentUser.displayName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown Leader',
            `${newBeliever.name} ${newBeliever.surname}`.trim()
          ),
          `New believer added: ${newBeliever.name} ${newBeliever.surname}`
        );
      }

      return newBelieverId;
    } catch (error: any) {
      throw error;
    }
  },

  update: async (newBelieverId: string, updates: Partial<NewBeliever>): Promise<void> => {
    try {
      const originalNewBeliever = await newBelieversFirebaseService.get(newBelieverId);
      if (!originalNewBeliever) {
        throw new Error('New believer not found');
      }

      await newBelieversFirebaseService.update(newBelieverId, updates);

      if (currentUser && currentUser.role === 'leader') {
        const newBelieverName = `${originalNewBeliever.name} ${originalNewBeliever.surname}`.trim();

        await createEnhancedNotification(
          () => createNotificationHelpers.newBelieverUpdated(
            currentUser.displayName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown Leader',
            newBelieverName
          ),
          `New believer updated: ${newBelieverName}`
        );
      }
    } catch (error: any) {
      throw error;
    }
  },

  // All other existing methods...
  get: newBelieversFirebaseService.get,
  getAll: newBelieversFirebaseService.getAll,
  delete: newBelieversFirebaseService.delete,
  onSnapshot: newBelieversFirebaseService.onSnapshot
};

// Guest operations with enhanced notifications
export const guestOperationsWithNotifications = {
  add: async (guest: Omit<Guest, 'id' | 'createdDate' | 'lastUpdated'>): Promise<string> => {
    try {
      const guestId = await guestFirebaseService.add(guest);

      if (currentUser && currentUser.role === 'leader') {
        await createEnhancedNotification(
          () => createNotificationHelpers.guestAdded(
            currentUser.displayName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown Leader',
            `${guest.firstName} ${guest.lastName || ''}`.trim()
          ),
          `Guest added: ${guest.firstName} ${guest.lastName || ''}`
        );
      }

      return guestId;
    } catch (error: any) {
      throw error;
    }
  },

  // All other existing methods...
  get: guestFirebaseService.get,
  getAll: guestFirebaseService.getAll,
  update: guestFirebaseService.update,
  delete: guestFirebaseService.delete,
  onSnapshot: guestFirebaseService.onSnapshot
};

// Confirmation operations with enhanced notifications
export const confirmationOperationsWithNotifications = {
  add: async (confirmation: Omit<SundayConfirmation, 'id'>): Promise<string> => {
    try {
      const confirmationId = await confirmationFirebaseService.add(confirmation);

      if (currentUser && currentUser.role === 'leader') {
        await createEnhancedNotification(
          () => createNotificationHelpers.attendanceConfirmed(
            currentUser.displayName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown Leader',
            confirmation.date
          ),
          `Attendance confirmed for: ${confirmation.date}`
        );
      }

      return confirmationId;
    } catch (error: any) {
      throw error;
    }
  },

  update: async (confirmationId: string, updates: Partial<SundayConfirmation>): Promise<void> => {
    try {
      await confirmationFirebaseService.update(confirmationId, updates);

      if (currentUser && currentUser.role === 'leader' && updates.date) {
        await createEnhancedNotification(
          () => createNotificationHelpers.attendanceUpdated(
            currentUser.displayName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown Leader',
            updates.date
          ),
          `Attendance updated for: ${updates.date}`
        );
      }
    } catch (error: any) {
      throw error;
    }
  },

  // All other existing methods...
  get: confirmationFirebaseService.get,
  getAll: confirmationFirebaseService.getAll,
  delete: confirmationFirebaseService.delete,
  onSnapshot: confirmationFirebaseService.onSnapshot
};

// Push notification management functions
export const pushNotificationHelpers = {
  // Initialize push notifications for current user
  async initialize(): Promise<boolean> {
    if (!currentUser || !currentChurchId) {
      console.warn('Cannot initialize push notifications: user or church context missing');
      return false;
    }

    try {
      const token = await pushNotificationService.registerDeviceToken();
      return token !== null;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return false;
    }
  },

  // Check if push notifications are supported and enabled
  async isSupported(): Promise<boolean> {
    return pushNotificationService.isSupported();
  },

  // Get current permission status
  async getPermissionStatus(): Promise<'granted' | 'denied' | 'default'> {
    return await pushNotificationService.getPermissionStatus();
  },

  // Request push notification permissions
  async requestPermissions(): Promise<boolean> {
    return await pushNotificationService.requestPermissions();
  },

  // Send a test push notification
  async sendTestNotification(): Promise<boolean> {
    if (!currentUser) return false;

    const testPayload = {
      title: 'SAT Mobile Test',
      body: 'Push notifications are working! 🎉',
      data: {
        test: 'true',
        deepLink: '/notifications'
      }
    };

    return await pushNotificationService.sendToUser(currentUser.uid, testPayload);
  }
};

// Export the enhanced notification integration context setter
export { setNotificationIntegrationContext as setEnhancedNotificationContext };
