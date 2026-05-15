// Enhanced Notification Integration (push + in-app)
import { setNotificationContext } from './notificationService';
import {
  membersFirebaseService,
  newBelieversFirebaseService,
  guestFirebaseService,
  confirmationFirebaseService
} from './firebaseService';
import { User } from '../types';
import { pushNotificationService } from './pushNotificationService';

export const setEnhancedNotificationContext = (user: User | null, churchId: string | null) => {
  // Forward context to both in-app and push services
  setNotificationContext(user, churchId);
  pushNotificationService.setUserContext(user, churchId);
};

// Export operations with notifications (currently just pass-throughs, but could be enhanced)
export const memberOperationsWithNotifications = membersFirebaseService;
export const newBelieverOperationsWithNotifications = newBelieversFirebaseService;
export const guestOperationsWithNotifications = guestFirebaseService;
export const confirmationOperationsWithNotifications = confirmationFirebaseService;

// Export push notification helpers
export const pushNotificationHelpers = {
  initialize: () => pushNotificationService.initialize(),
  isSupported: () => Promise.resolve(pushNotificationService.isSupported()),
  getPermissionStatus: () => pushNotificationService.getPermissionStatus(),
  requestPermissions: () => pushNotificationService.requestPermissions(),
  sendTestNotification: async () => {
    return pushNotificationService.displaySystemNotification({
      title: 'SAT Mobile',
      body: 'This is a test notification from SAT Mobile',
      data: { activityType: 'system_message', deepLink: '/notifications' },
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      sound: 'default'
    }, {
      dedupeKey: `test-${Date.now()}`,
      requestPermission: true
    });
  }
};

