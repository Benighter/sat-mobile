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
    // Send a local test notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('Test Notification', {
          body: 'This is a test push notification from SAT Mobile',
          icon: '/icon-192.png',
          badge: '/icon-192.png'
        });
        return true;
      } catch (e) {
        console.error('Failed to send test notification:', e);
        return false;
      }
    }
    return false;
  }
};

