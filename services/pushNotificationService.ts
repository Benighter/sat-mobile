// Push Notification Service for SAT Mobile
// Handles Firebase Cloud Messaging and device token management

import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase.config';
import { User, AdminNotification } from '../types';

// Device token storage interface
interface DeviceToken {
  id: string; // token itself
  userId: string;
  platform: 'web' | 'android' | 'ios';
  deviceInfo?: {
    userAgent?: string;
    model?: string;
    os?: string;
  };
  createdAt: string;
  lastUsed: string;
  isActive: boolean;
}

// Push notification payload interface
interface PushNotificationPayload {
  title: string;
  body: string;
  data?: {
    notificationId?: string;
    activityType?: string;
    deepLink?: string;
    [key: string]: any;
  };
  icon?: string;
  badge?: string;
  sound?: string;
}

class PushNotificationService {
  private messaging: any = null;
  private currentUser: User | null = null;
  private currentChurchId: string | null = null;
  private isInitialized = false;
  private vapidKey = (() => {
    const env: any = (typeof import.meta !== 'undefined' ? (import.meta as any).env : {}) || {};
    const sat = env.VITE_FIREBASE_VAPID_KEY || process.env.REACT_APP_FIREBASE_VAPID_KEY || '';
    const fallback = sat || 'BKxf8KJjJZv_RrXd7JYF6v8cS_8oLh7hQtYhTzZ1x2lQ3mB0GqJ5vX8mD2nF5sK9';
    return sat || fallback;
  })();

  constructor() {
    this.initialize();
  }

  // Initialize push notification service
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize Firebase Messaging for web
  if (!Capacitor.isNativePlatform()) {
        // Ensure service worker is registered early (idempotent)
        try {
  if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            const hasExisting = registrations.some(r => r.active && r.active.scriptURL.includes('firebase-messaging-sw'));
            if (!hasExisting) {
    await navigator.serviceWorker.register('/firebase-messaging-sw.js');
              console.log('✅ Firebase messaging service worker registered');
            }
          } else {
            console.warn('Service workers not available – web push may be limited');
          }
        } catch (swErr) {
          console.warn('Failed to register messaging service worker (will continue):', swErr);
        }
  // dynamic import kept previously for side-effects (ensure Firebase app initialized upstream)
  // Just obtain messaging instance; assume firebase.config.ts already initialized the app.
  this.messaging = getMessaging();
      }

      // Initialize Capacitor Push Notifications for mobile
      if (Capacitor.isNativePlatform()) {
        await this.initializeCapacitorPushNotifications();
      }

      this.isInitialized = true;
      console.log('✅ Push notification service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize push notification service:', error);
    }
  }

  // Initialize Capacitor push notifications for mobile platforms
  private async initializeCapacitorPushNotifications(): Promise<void> {
    // Request permission for push notifications
    const permResult = await PushNotifications.requestPermissions();
    
    if (permResult.receive === 'granted') {
      // Register with Apple / Google to receive push via APNS/FCM
      await PushNotifications.register();

      // Handle registration
      PushNotifications.addListener('registration', async (token) => {
        console.log('Push registration success, token: ' + token.value);
        if (this.currentUser && this.currentChurchId) {
          await this.saveDeviceToken(token.value, this.getPlatform());
        }
      });

      // Handle registration errors
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Error during registration: ', JSON.stringify(error));
      });

      // Handle incoming push notifications when app is open
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push notification received: ', notification);
        this.handleForegroundNotification(notification);
      });

      // Handle notification click/tap when app is in background
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push notification action performed: ', notification);
        this.handleNotificationClick(notification);
      });
    }
  }

  // Set user context for push notifications
  setUserContext(user: User | null, churchId: string | null): void {
    this.currentUser = user;
    this.currentChurchId = churchId;

    // Initialize token registration if user is available
    if (user && churchId) {
      this.registerDeviceToken();
    } else {
      this.unregisterDeviceToken();
    }
  }

  // Register device token for current user
  async registerDeviceToken(): Promise<string | null> {
    if (!this.currentUser || !this.currentChurchId) {
      console.warn('Cannot register device token: user or church context missing');
      return null;
    }

    try {
      let token: string | null = null;

      if (Capacitor.isNativePlatform()) {
        // Mobile platform - token will be received via listener
        await PushNotifications.register();
      } else {
        // Web platform - use Firebase Messaging
        if (this.messaging) {
          if (!window.isSecureContext) {
            console.warn('⚠️ Page is not a secure context (HTTPS) – browser may auto-deny notifications');
          }

          let permission: NotificationPermission = Notification.permission;
          // Only actively request if still default (to ensure it happens on a user gesture upstream)
          if (permission === 'default') {
            try {
              permission = await Notification.requestPermission();
            } catch (e) {
              console.warn('Failed to invoke Notification.requestPermission():', e);
            }
          }

            if (permission === 'granted') {
              try {
                token = await getToken(this.messaging, { vapidKey: this.vapidKey });
                if (token) {
                  await this.saveDeviceToken(token, 'web');
                  console.log('✅ Web FCM token registered:', token.substring(0, 20) + '...');
                } else {
                  console.warn('⚠️ getToken returned null/empty');
                }
              } catch (gtErr) {
                console.error('Failed to obtain FCM token:', gtErr);
              }
            } else if (permission === 'denied') {
              console.warn('❌ Notifications are blocked by the user/browser settings');
              console.warn('ℹ️ In most browsers you must manually re-enable them in site settings.');
            } else {
              console.log('Notification permission unresolved (default) – user has not decided yet.');
            }
        }
      }

      // Set up foreground message listener for web
      if (this.messaging && !Capacitor.isNativePlatform()) {
        onMessage(this.messaging, (payload) => {
          console.log('Message received while app is in foreground:', payload);
          this.handleForegroundNotification(payload);
        });
      }

      return token;
    } catch (error) {
      console.error('Failed to register device token:', error);
      return null;
    }
  }

  // Save device token to Firestore
  private async saveDeviceToken(token: string, platform: 'web' | 'android' | 'ios'): Promise<void> {
    if (!this.currentUser || !this.currentChurchId) return;

    try {
      const deviceToken: DeviceToken = {
        id: token,
        userId: this.currentUser.uid,
        platform,
        deviceInfo: {
          userAgent: navigator.userAgent,
          model: this.getDeviceModel(),
          os: this.getOS()
        },
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        isActive: true
      };

      const tokenPath = `churches/${this.currentChurchId}/deviceTokens/${token}`;
      await setDoc(doc(db, tokenPath), deviceToken);
      
      console.log('✅ Device token saved successfully');
    } catch (error) {
      console.error('Failed to save device token:', error);
    }
  }

  // Unregister device token when user logs out
  async unregisterDeviceToken(): Promise<void> {
    if (!this.currentUser || !this.currentChurchId) return;

    try {
      // Get all tokens for this user and mark as inactive
      const tokensQuery = query(
        collection(db, `churches/${this.currentChurchId}/deviceTokens`),
        where('userId', '==', this.currentUser.uid),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(tokensQuery);
  const batch: Promise<any>[] = [];

      snapshot.forEach((doc) => {
        batch.push(setDoc(doc.ref, { isActive: false, lastUsed: new Date().toISOString() }, { merge: true }));
      });

      await Promise.all(batch);
      console.log('✅ Device tokens unregistered');
    } catch (error) {
      console.error('Failed to unregister device tokens:', error);
    }
  }

  // Send push notification to specific user
  async sendToUser(userId: string, payload: PushNotificationPayload): Promise<boolean> {
    if (!this.currentChurchId) {
      console.error('Cannot send push notification: church context missing');
      return false;
    }

    try {
      // Get all active tokens for the user
      const tokensQuery = query(
        collection(db, `churches/${this.currentChurchId}/deviceTokens`),
        where('userId', '==', userId),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(tokensQuery);
      const tokens: string[] = [];

      snapshot.forEach((doc) => {
        const tokenData = doc.data() as DeviceToken;
        tokens.push(tokenData.id);
      });

      if (tokens.length === 0) {
        console.log('No active device tokens found for user:', userId);
        return false;
      }

      // Use callable Cloud Function
      try {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions();
        const fn = httpsCallable(functions, 'sendPushNotification');
        const result: any = await fn({ tokens, payload, churchId: this.currentChurchId });
        if (result?.data?.success) {
          console.log(`✅ Push notification sent: success=${result.data.successCount}, failed=${result.data.failureCount}`);
          if (result.data.failureCount > 0) {
            console.warn('Some tokens failed:', result.data.failed);
          }
          return true;
        } else {
          console.error('Failed to send push notification (callable returned error):', result?.data?.error);
          return false;
        }
      } catch (fnErr) {
        console.error('Callable sendPushNotification failed:', fnErr);
        return false;
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }

  // Convert AdminNotification to push notification payload
  createNotificationPayload(notification: AdminNotification): PushNotificationPayload {
    const basePayload: PushNotificationPayload = {
      title: 'SAT Mobile',
      body: notification.details.description,
      data: {
        notificationId: notification.id,
        activityType: notification.activityType,
        deepLink: '/notifications'
      },
      icon: '/icon-192.png',
      badge: '1'
    };

    // Customize based on activity type
    switch (notification.activityType) {
      case 'member_added':
        basePayload.title = '👥 New Member Added';
        basePayload.body = `${notification.leaderName} added ${notification.details.memberName}`;
        break;
      case 'member_updated':
        basePayload.title = '✏️ Member Updated';
        basePayload.body = `${notification.leaderName} updated ${notification.details.memberName}`;
        break;
      case 'attendance_confirmed':
        basePayload.title = '✅ Attendance Confirmed';
        basePayload.body = `${notification.leaderName} confirmed attendance for ${notification.details.attendanceDate}`;
        break;
      case 'new_believer_added':
        basePayload.title = '🙏 New Believer Added';
        basePayload.body = `${notification.leaderName} added ${notification.details.newBelieverName}`;
        break;
      case 'guest_added':
        basePayload.title = '👋 New Guest Added';
        basePayload.body = `${notification.leaderName} added ${notification.details.guestName}`;
        break;
      default:
        basePayload.body = notification.details.description;
    }

    return basePayload;
  }

  // Handle foreground notification display
  private handleForegroundNotification(notification: any): void {
    try {
      // Attempt to play a short notification sound on web
      if (typeof window !== 'undefined') {
        // Lazy import to avoid bundling issues in non-web platforms
        import('./notificationSound').then(m => {
          m.startNotificationSound(3000);
        }).catch(() => {/* ignore */});
      }
    } catch { /* ignore */ }
    // Show in-app notification or update UI
    if ('Notification' in window && Notification.permission === 'granted') {
      const title = notification.title || notification.notification?.title || 'SAT Mobile';
      const body = notification.body || notification.notification?.body || 'New notification received';
      
      const browserNotification = new Notification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'sat-mobile-notification'
      });

      // Auto close after 5 seconds
      setTimeout(() => {
        browserNotification.close();
      }, 5000);

      // Handle click
      browserNotification.onclick = () => {
        window.focus();
        this.handleNotificationClick(notification);
        browserNotification.close();
        try {
          import('./notificationSound').then(m => m.stopNotificationSound()).catch(() => {/* ignore */});
        } catch { /* ignore */ }
      };
    }
  }

  // Handle notification click/tap
  private handleNotificationClick(notification: any): void {
    const data = notification.data || notification.notification?.data || {};
    
    if (data.deepLink) {
      // Navigate to specific screen
      window.location.hash = data.deepLink;
    } else {
      // Default to notifications screen
      window.location.hash = '/notifications';
    }

    // Focus the app window
    if (window.focus) {
      window.focus();
    }
  }

  // Utility methods
  private getPlatform(): 'web' | 'android' | 'ios' {
    if (Capacitor.isNativePlatform()) {
      return Capacitor.getPlatform() as 'android' | 'ios';
    }
    return 'web';
  }

  private getDeviceModel(): string {
    // This is a simplified version - you might want to use a library for better detection
    const userAgent = navigator.userAgent;
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('iPad')) return 'iPad';
    if (userAgent.includes('Android')) return 'Android';
    return 'Desktop';
  }

  private getOS(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    if (userAgent.includes('Android')) return 'Android';
    return 'Unknown';
  }

  // Check if push notifications are supported
  isSupported(): boolean {
    // Native (Capacitor) – rely on plugin availability
    if (Capacitor.isNativePlatform()) {
      return true; // If the app is running natively we assume push can work; plugin guards runtime calls
    }

    // Web environment feature detection
    const hasNotification = typeof window !== 'undefined' && 'Notification' in window;
  // (Optional diagnostics) We purposefully do not require service worker or PushManager to return true here
  // because some embedded browsers grant Notification but lack full push – we still allow UI path.

    // We consider minimal support if Notification exists; enhanced support if all are present
    if (hasNotification) return true;

    // Fallback: some very old browsers / iOS webviews may expose webkitNotifications
    // (We don't attempt to fully polyfill – just return false explicitly here.)
    // Heuristic: allow mobile browsers (Android/iOS) to try anyway even if Notification not detected yet
    const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
    const isMobileHeuristic = /android|iphone|ipad|ipod/.test(ua);
    if (isMobileHeuristic) return true;

    // Developer override for testing
    if (typeof localStorage !== 'undefined' && localStorage.getItem('forcePushSupport') === 'true') return true;

    return false;
  }

  // Expose diagnostics for UI / debugging
  getSupportDiagnostics() {
    const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '');
    return {
      native: Capacitor.isNativePlatform(),
      pluginAvailable: Capacitor.isNativePlatform() ? Capacitor.isPluginAvailable('PushNotifications') : false,
      hasNotification: typeof window !== 'undefined' && 'Notification' in window,
      hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
      hasPushManager: typeof window !== 'undefined' && 'PushManager' in window,
      userAgent: ua,
      forceFlag: typeof localStorage !== 'undefined' ? localStorage.getItem('forcePushSupport') === 'true' : false
    };
  }

  // Get current notification permission status
  async getPermissionStatus(): Promise<'granted' | 'denied' | 'default'> {
    if (Capacitor.isNativePlatform()) {
  const status = await PushNotifications.checkPermissions();
  // Some environments may return 'prompt' – treat as default
  const mapped = (status.receive === 'prompt' ? 'default' : status.receive) as 'granted' | 'denied' | 'default';
  return mapped;
    } else {
      return Notification.permission;
    }
  }

  // Request notification permissions
  async requestPermissions(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await PushNotifications.requestPermissions();
        return result.receive === 'granted';
      } else {
        if (!('Notification' in window)) {
          console.warn('Notification API not present in this browser');
          return false;
        }
        const permission = await Notification.requestPermission();
        // Attempt late service worker registration if it failed earlier
        if (permission === 'granted' && 'serviceWorker' in navigator) {
          try {
            const regs = await navigator.serviceWorker.getRegistrations();
            const hasMessaging = regs.some(r => r.active && r.active.scriptURL.includes('firebase-messaging-sw'));
            if (!hasMessaging) {
              await navigator.serviceWorker.register('/firebase-messaging-sw.js');
              console.log('✅ (Late) service worker registered after permission grant');
            }
          } catch (e) {
            console.warn('Service worker registration (late) failed:', e);
          }
        }
        return permission === 'granted';
      }
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      return false;
    }
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();

// Export types for use in other modules
export type { PushNotificationPayload, DeviceToken };
