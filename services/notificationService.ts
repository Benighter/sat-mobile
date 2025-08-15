// Admin Notification Service for SAT Mobile
// 
// ⚠️ IMPORTANT: This service currently uses in-memory sorting to avoid Firebase index requirements.
// For optimal performance, create the required composite index in Firebase Console.
// See docs/FIREBASE_INDEXES_SETUP.md for detailed instructions.
//
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Unsubscribe,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase.config';
import { AdminNotification, NotificationActivityType, User } from '../types';

// Get church collection path for notifications
const getNotificationCollectionPath = (churchId: string) => `churches/${churchId}/notifications`;

// Current user context (will be set from auth context)
let currentUser: User | null = null;
let currentChurchId: string | null = null;

export const setNotificationContext = (user: User | null, churchId: string | null) => {
  currentUser = user;
  currentChurchId = churchId;
};

// Admin Notification Service
export const notificationService = {
  // Create a new notification for admin(s) linked to a leader
  create: async (
    leaderId: string,
    leaderName: string,
    activityType: NotificationActivityType,
    details: AdminNotification['details'],
    metadata?: AdminNotification['metadata']
  ): Promise<void> => {
    try {
      console.log(`🔔 Creating notification: ${activityType} by leader ${leaderId} (${leaderName})`);

      if (!currentChurchId) {
        console.error('❌ Church context not set for notification creation');
        throw new Error('Church context not set');
      }

      if (!currentUser) {
        console.error('❌ User context not set for notification creation');
        throw new Error('User context not set');
      }

  // Find all admins who are linked to this leader
  const linkedAdminIds = await getAdminsLinkedToLeader(leaderId);

      if (linkedAdminIds.length === 0) {
        console.log(`⚠️ No linked admins found for leader ${leaderId}, skipping notification creation`);
        return;
      }

      console.log(`📤 Creating notifications for ${linkedAdminIds.length} admin(s):`, linkedAdminIds);

      const notificationsRef = collection(db, getNotificationCollectionPath(currentChurchId));
      const batch = writeBatch(db);

      // Create a notification for each linked admin
      for (const adminId of linkedAdminIds) {
        const notificationData: Omit<AdminNotification, 'id'> = {
          leaderId,
          leaderName,
          adminId,
          activityType,
          timestamp: new Date().toISOString(),
          isRead: false,
          churchId: currentChurchId,
          details
        };

        // Only include metadata if it has actual data
        if (metadata && Object.keys(metadata).length > 0) {
          notificationData.metadata = metadata;
        }

        const newNotificationRef = doc(notificationsRef);
        batch.set(newNotificationRef, notificationData);
        console.log(`📝 Prepared notification for admin ${adminId}:`, {
          activityType,
          description: details.description,
          hasMetadata: !!metadata && Object.keys(metadata).length > 0
        });
      }

      await batch.commit();
      console.log(`✅ Successfully created ${linkedAdminIds.length} notification(s) for activity: ${activityType}`);
    } catch (error: any) {
      console.error('❌ Failed to create notification:', error);
      console.error('Context:', { leaderId, leaderName, activityType, currentChurchId, currentUser: currentUser?.uid });
      throw new Error(`Failed to create notification: ${error.message}`);
    }
  },

  // Create direct notifications to specific recipients (used by birthday reminders)
  createForRecipients: async (
    recipients: string[],
    activityType: NotificationActivityType,
    description: string,
    details: Partial<AdminNotification['details']>,
    metadata?: AdminNotification['metadata']
  ): Promise<void> => {
    try {
      if (!currentChurchId || !currentUser) {
        throw new Error('Church or user context not set');
      }

      const notificationsRef = collection(db, getNotificationCollectionPath(currentChurchId));
      const batch = writeBatch(db);

      for (const adminId of recipients) {
        const notificationData: Omit<AdminNotification, 'id'> = {
          leaderId: currentUser.uid,
          leaderName: currentUser.displayName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'System',
          adminId,
          activityType,
          timestamp: new Date().toISOString(),
          isRead: false,
          churchId: currentChurchId,
          details: {
            description,
            ...details
          },
          metadata
        };
        const newNotificationRef = doc(notificationsRef);
        batch.set(newNotificationRef, notificationData);
      }

      await batch.commit();
    } catch (error: any) {
      console.error('Failed to create recipient notifications:', error);
    }
  },

  // Get notifications for the current admin
  getForAdmin: async (adminId: string, limitCount: number = 50): Promise<AdminNotification[]> => {
    try {
      if (!currentChurchId) {
        console.warn('Church context not set for notifications');
        return []; // Return empty array instead of throwing error
      }

      const notificationsRef = collection(db, getNotificationCollectionPath(currentChurchId));
      // Temporarily remove orderBy to avoid index requirement - sort in memory instead
      const q = query(
        notificationsRef,
        where('adminId', '==', adminId)
      );

      const querySnapshot = await getDocs(q);
      const notifications = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as AdminNotification[];

      // Sort in memory by timestamp (newest first) and apply limit
      notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return notifications.slice(0, limitCount);
    } catch (error: any) {
      console.error('Failed to fetch notifications:', error);
      return []; // Return empty array on error
    }
  },

  // Generic get for any user (admin or leader)
  getForUser: async (userId: string, limitCount: number = 50): Promise<AdminNotification[]> => {
    return notificationService.getForAdmin(userId, limitCount);
  },

  // Get unread notification count for admin
  getUnreadCount: async (adminId: string): Promise<number> => {
    try {
      if (!currentChurchId) {
        console.warn('Church context not set for unread count');
        return 0; // Return 0 instead of throwing error
      }

      const notificationsRef = collection(db, getNotificationCollectionPath(currentChurchId));
      const q = query(
        notificationsRef,
        where('adminId', '==', adminId),
        where('isRead', '==', false)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error: any) {
      console.error('Failed to fetch unread count:', error);
      return 0; // Return 0 on error
    }
  },

  // Get unread count for any user
  getUnreadCountForUser: async (userId: string): Promise<number> => {
    return notificationService.getUnreadCount(userId);
  },

  // Mark notification as read
  markAsRead: async (notificationId: string): Promise<void> => {
    try {
      if (!currentChurchId) {
        throw new Error('Church context not set');
      }

      const notificationRef = doc(db, getNotificationCollectionPath(currentChurchId), notificationId);
      await updateDoc(notificationRef, {
        isRead: true
      });
    } catch (error: any) {
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
  },

  // Mark all notifications as read for an admin
  markAllAsRead: async (adminId: string): Promise<void> => {
    try {
      if (!currentChurchId) {
        throw new Error('Church context not set');
      }

      const notificationsRef = collection(db, getNotificationCollectionPath(currentChurchId));
      const q = query(
        notificationsRef,
        where('adminId', '==', adminId),
        where('isRead', '==', false)
      );

      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);

      querySnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { isRead: true });
      });

      await batch.commit();
    } catch (error: any) {
      throw new Error(`Failed to mark all notifications as read: ${error.message}`);
    }
  },

  // Delete notification
  delete: async (notificationId: string): Promise<void> => {
    try {
      if (!currentChurchId) {
        throw new Error('Church context not set');
      }

      const notificationRef = doc(db, getNotificationCollectionPath(currentChurchId), notificationId);
      await deleteDoc(notificationRef);
    } catch (error: any) {
      throw new Error(`Failed to delete notification: ${error.message}`);
    }
  },

  // Listen to notifications for an admin (real-time updates)
  onSnapshot: (adminId: string, callback: (notifications: AdminNotification[]) => void): Unsubscribe => {
    if (!currentChurchId) {
      console.warn('Church context not set for notification listener');
      // Return a dummy unsubscribe function
      return () => {};
    }

    try {
      const notificationsRef = collection(db, getNotificationCollectionPath(currentChurchId));
      // Temporarily remove orderBy to avoid index requirement - sort in memory instead
      const q = query(
        notificationsRef,
        where('adminId', '==', adminId)
      );

      return onSnapshot(q, (querySnapshot) => {
        const notifications = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as AdminNotification[];

        // Sort in memory by timestamp (newest first) and apply limit
        notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const limitedNotifications = notifications.slice(0, 100);

        callback(limitedNotifications);
      }, (error) => {
        console.error('Notification listener error:', error);
        // Call callback with empty array on error
        callback([]);
      });
    } catch (error) {
      console.error('Failed to set up notification listener:', error);
      // Return a dummy unsubscribe function
      return () => {};
    }
  },

  // Clean up old notifications (older than 30 days)
  cleanupOldNotifications: async (): Promise<void> => {
    try {
      if (!currentChurchId) {
        throw new Error('Church context not set');
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const notificationsRef = collection(db, getNotificationCollectionPath(currentChurchId));
      const q = query(
        notificationsRef,
        where('timestamp', '<', thirtyDaysAgo.toISOString())
      );

      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);

      querySnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
    } catch (error: any) {
      throw new Error(`Failed to cleanup old notifications: ${error.message}`);
    }
  }
};

// Helper function to find admins linked to a specific leader
const getAdminsLinkedToLeader = async (leaderId: string): Promise<string[]> => {
  try {
    if (!currentChurchId) {
      console.warn('No church context set for notification system');
      return [];
    }

    // Query admin invites to find which admins invited this leader
    // NOTE: adminInvites are stored in the root collection, not per-church
    const invitesRef = collection(db, 'adminInvites');
    const q = query(
      invitesRef,
      where('invitedUserId', '==', leaderId),
      where('status', '==', 'accepted'),
      where('churchId', '==', currentChurchId) // Filter by church context
    );

    console.log(`🔍 Looking for linked admins for leader ${leaderId} in church ${currentChurchId}`);
    const querySnapshot = await getDocs(q);
    const linkedAdminIds: string[] = [];

    querySnapshot.docs.forEach((doc) => {
      const inviteData = doc.data();
      console.log(`📋 Found invite: ${doc.id}`, {
        createdBy: inviteData.createdBy,
        invitedUserId: inviteData.invitedUserId,
        status: inviteData.status,
        churchId: inviteData.churchId
      });
      if (inviteData.createdBy) {
        linkedAdminIds.push(inviteData.createdBy);
      }
    });

    // Remove duplicates
    const uniqueAdminIds = [...new Set(linkedAdminIds)];
    console.log(`✅ Found ${uniqueAdminIds.length} linked admin(s) for leader ${leaderId}:`, uniqueAdminIds);
    return uniqueAdminIds;
  } catch (error: any) {
    console.error('❌ Failed to get linked admins:', error);
    return [];
  }
};

// Utility functions for creating specific notification types
export const createNotificationHelpers = {
  // Resolve leader display name once
  _leaderDisplayName(): string | null {
    if (!currentUser) return null;
    const display = currentUser.displayName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim();
    return display && display.length > 0 ? display : 'Unknown Leader';
  },

  // Member added notification
  memberAdded: async (leaderName: string, memberName: string, memberRole: string, bacentaName?: string) => {
    if (!currentUser) return;

    await notificationService.create(
      currentUser.uid,
      leaderName,
      'member_added',
      {
        memberName,
        memberRole,
        bacentaName,
        description: `${leaderName} added new member: ${memberName}${memberRole !== 'Member' ? ` (${memberRole})` : ''}${bacentaName ? ` to ${bacentaName}` : ''}`
      },
      {
        memberRole,
        bacentaName: bacentaName || null
      }
    );
  },

  // Member updated notification
  memberUpdated: async (leaderName: string, memberName: string, changes: string[]) => {
    if (!currentUser) return;

    await notificationService.create(
      currentUser.uid,
      leaderName,
      'member_updated',
      {
        memberName,
        description: `${leaderName} updated member: ${memberName} (${changes.join(', ')})`
      },
      {
        changes
      }
    );
  },

  // Member deleted notification
  memberDeleted: async (leaderName: string, memberName: string) => {
    if (!currentUser) return;

    await notificationService.create(
      currentUser.uid,
      leaderName,
      'member_deleted',
      {
        memberName,
        description: `${leaderName} deleted member: ${memberName}`
      },
      {
        action: 'deleted'
      }
    );
  },

  // Attendance confirmed notification
  attendanceConfirmed: async (leaderName: string, attendanceDate: string, attendanceCount: number) => {
    if (!currentUser) return;
    
    await notificationService.create(
      currentUser.uid,
      leaderName,
      'attendance_confirmed',
      {
        attendanceDate,
        description: `${leaderName} confirmed attendance for ${attendanceDate}`
      },
      {
        attendanceCount
      }
    );
  },

  // New believer added notification
  newBelieverAdded: async (leaderName: string, newBelieverName: string) => {
    if (!currentUser) return;

    await notificationService.create(
      currentUser.uid,
      leaderName,
      'new_believer_added',
      {
        newBelieverName,
        description: `${leaderName} added new believer: ${newBelieverName}`
      },
      {
        action: 'added'
      }
    );
  },

  // Guest added notification
  guestAdded: async (leaderName: string, guestName: string, bacentaName?: string) => {
    if (!currentUser) return;

    await notificationService.create(
      currentUser.uid,
      leaderName,
      'guest_added',
      {
        guestName,
        bacentaName,
        description: `${leaderName} added guest: ${guestName}${bacentaName ? ` to ${bacentaName}` : ''}`
      },
      {
        bacentaName: bacentaName || null,
        action: 'added'
      }
    );
  },

  // Attendance removed notification
  attendanceRemoved: async (leaderName: string, attendanceDate: string, count: number) => {
    if (!currentUser) return;

    await notificationService.create(
      currentUser.uid,
      leaderName,
      'attendance_updated',
      {
        attendanceDate,
        description: `${leaderName} removed ${count} attendance confirmation${count !== 1 ? 's' : ''} for ${attendanceDate}`
      },
      {
        attendanceCount: -count, // Negative to indicate removal
        action: 'removed'
      }
    );
  },

  // Bacenta assignment changed
  bacentaAssignmentChanged: async (leaderName: string, memberName: string, previousBacenta?: string, newBacenta?: string) => {
    if (!currentUser) return;

    await notificationService.create(
      currentUser.uid,
      leaderName,
      'bacenta_assignment_changed',
      {
        memberName,
        bacentaName: newBacenta,
        description: `${leaderName} moved ${memberName} ${previousBacenta ? `from ${previousBacenta} ` : ''}to ${newBacenta || 'another bacenta'}`
      },
      {
        previousValue: previousBacenta || undefined,
        newValue: newBacenta || undefined
      }
    );
  },

  // Member freeze/unfreeze toggled
  memberFreezeToggled: async (leaderName: string, memberName: string, frozen: boolean) => {
    if (!currentUser) return;

    await notificationService.create(
      currentUser.uid,
      leaderName,
      'member_freeze_toggled',
      {
        memberName,
        description: `${leaderName} ${frozen ? 'froze' : 'unfroze'} member: ${memberName}`
      },
      {
        newValue: frozen ? 'frozen' : 'active'
      }
    );
  },

  // Outreach/Guest converted to permanent member
  memberConverted: async (leaderName: string, personName: string, source: 'guest' | 'outreach') => {
    if (!currentUser) return;

    await notificationService.create(
      currentUser.uid,
      leaderName,
      'member_converted',
      {
        memberName: personName,
        description: `${leaderName} converted ${personName} from ${source === 'guest' ? 'guest' : 'outreach'} to permanent member`
      },
      {
        source
      }
    );
  }
};