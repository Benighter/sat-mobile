// Simplified Enhanced Notification Integration (push + extra admin notifications disabled)
// This stripped version avoids compile errors while the feature is temporarily disabled.

import { setNotificationContext } from './notificationService';
import {
  membersFirebaseService,
  newBelieversFirebaseService,
  guestFirebaseService,
  confirmationFirebaseService
} from './firebaseService';
import { User } from '../types';

export const setEnhancedNotificationContext = (user: User | null, churchId: string | null) => {
  // Context still forwarded so in‑app notifications continue to work
  setNotificationContext(user, churchId);
};

// Direct pass‑through exports (no extra notification side effects)
export const memberOperationsWithNotifications = membersFirebaseService;
export const newBelieverOperationsWithNotifications = newBelieversFirebaseService;
export const guestOperationsWithNotifications = guestFirebaseService;
export const confirmationOperationsWithNotifications = confirmationFirebaseService;

// Stubbed push helpers – always disabled
export const pushNotificationHelpers = {
  async initialize() { return false; },
  async isSupported() { return false; },
  async getPermissionStatus(): Promise<'granted' | 'denied' | 'default'> { return 'default'; },
  async requestPermissions() { return false; },
  async sendTestNotification() { return false; }
};

// NOTE: To restore full functionality, replace this file with the previous implementation
// and resolve any missing helper functions (e.g., bacentaAssignmentChanged) in notificationService.
