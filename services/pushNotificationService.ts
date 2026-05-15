// Push Notification Service for SAT Mobile
// Handles Firebase Cloud Messaging and device token management

import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { LocalNotifications } from '@capacitor/local-notifications';
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

interface SystemNotificationOptions {
  dedupeKey?: string;
  requestPermission?: boolean;
  autoCloseMs?: number;
}

class PushNotificationService {
  private static readonly ANDROID_CHANNEL_ID = 'sat_mobile_notifications';
  private messaging: any = null;
  private currentUser: User | null = null;
  private currentChurchId: string | null = null;
  private isInitialized = false;
  private nativePushConfigured = false;
  private nativeListenersRegistered = false;
  private localNotificationListenersRegistered = false;
  private webForegroundMessageListenerRegistered = false;
  private serviceWorkerMessageListenerRegistered = false;
  private pendingNativeRegistration: Promise<string | null> | null = null;
  private resolvePendingNativeRegistration: ((token: string | null) => void) | null = null;
  private rejectPendingNativeRegistration: ((error: unknown) => void) | null = null;
  private lastRegistrationError: string | null = null;
  private localNotificationId = Date.now() % 1000000;
  private displayedSystemNotifications = new Map<string, number>();
  private vapidKey = (() => {
    const env: any = (typeof import.meta !== 'undefined' ? (import.meta as any).env : {}) || {};
    return (env.VITE_FIREBASE_VAPID_KEY || process.env.REACT_APP_FIREBASE_VAPID_KEY || '').trim();
  })();

  constructor() {
    this.nativePushConfigured = this.detectNativePushConfiguration();
    this.initialize();
  }

  private detectNativePushConfiguration(): boolean {
    const env: any = (typeof import.meta !== 'undefined' ? (import.meta as any).env : {}) || {};
    if (env.VITE_ENABLE_NATIVE_PUSH === 'true') {
      return true;
    }

    return false;
  }

  private isValidVapidKey(key?: string | null): boolean {
    return typeof key === 'string' && /^[A-Za-z0-9_-]{80,200}$/.test(key.trim());
  }

  private getConfigurationIssue(): string | null {
    if (Capacitor.isNativePlatform() && !this.nativePushConfigured) {
      return 'Native push requires android/app/google-services.json plus VITE_ENABLE_NATIVE_PUSH=true.';
    }

    if (!Capacitor.isNativePlatform() && !this.isValidVapidKey(this.vapidKey)) {
      return 'Web push requires a valid VITE_FIREBASE_VAPID_KEY (Firebase Cloud Messaging Web Push certificate key).';
    }

    return null;
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string') return error;
    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown push notification error';
    }
  }

  private isRetryableNativeRegistrationError(message: string): boolean {
    return /SERVICE_NOT_AVAILABLE|INTERNAL_SERVER_ERROR|FIS_AUTH_ERROR|TOO_MANY_REGISTRATIONS/i.test(message);
  }

  private clearPendingNativeRegistration(): void {
    this.pendingNativeRegistration = null;
    this.resolvePendingNativeRegistration = null;
    this.rejectPendingNativeRegistration = null;
  }

  private nextLocalNotificationId(): number {
    this.localNotificationId = (this.localNotificationId + 1) % 2147483647;
    return this.localNotificationId || 1;
  }

  private getSystemNotificationDedupeKey(payload: PushNotificationPayload, fallback?: string): string {
    return (
      payload.data?.notificationId ||
      fallback ||
      `${payload.title}:${payload.body}:${payload.data?.activityType || 'general'}`
    );
  }

  private shouldDisplaySystemNotification(dedupeKey: string): boolean {
    const now = Date.now();
    const dedupeWindowMs = 30000;

    for (const [key, timestamp] of this.displayedSystemNotifications.entries()) {
      if (now - timestamp > dedupeWindowMs) {
        this.displayedSystemNotifications.delete(key);
      }
    }

    const lastDisplayedAt = this.displayedSystemNotifications.get(dedupeKey);
    if (lastDisplayedAt && now - lastDisplayedAt <= dedupeWindowMs) {
      return false;
    }

    this.displayedSystemNotifications.set(dedupeKey, now);
    return true;
  }

  private getBrowserBadgeUrl(payloadBadge?: string): string {
    return payloadBadge && payloadBadge.startsWith('/') ? payloadBadge : '/icon-192.png';
  }

  private normalizeDeepLink(deepLink?: string | null): string {
    const fallback = '/notifications';
    const rawLink = typeof deepLink === 'string' && deepLink.trim() ? deepLink.trim() : fallback;

    if (rawLink.startsWith('/#')) {
      return rawLink.slice(2) || fallback;
    }

    if (rawLink.startsWith('#')) {
      return rawLink.slice(1) || fallback;
    }

    try {
      const parsed = new URL(rawLink);
      if (parsed.hash) {
        return parsed.hash.replace(/^#/, '') || fallback;
      }
      return `${parsed.pathname}${parsed.search}` || fallback;
    } catch {
      return rawLink.startsWith('/') ? rawLink : `/${rawLink}`;
    }
  }

  private getNotificationIdFromDeepLink(deepLink: string, data: PushNotificationPayload['data'] = {}): string | undefined {
    if (data?.notificationId) return String(data.notificationId);
    const match = deepLink.match(/^\/notifications\/([^/?#]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : undefined;
  }

  private dispatchNotificationOpenEvent(notificationId?: string): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('sat-open-notifications', {
      detail: { notificationId: notificationId || null }
    }));
  }

  private ensureServiceWorkerMessageListener(): void {
    if (this.serviceWorkerMessageListenerRegistered || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker.addEventListener('message', (event) => {
      const message = event.data || {};
      if (message.type !== 'NOTIFICATION_CLICK') return;

      const data = message.data || {};
      this.handleNotificationClick({
        data: {
          ...data,
          deepLink: data.deepLink || data.url || message.url
        }
      });
    });

    this.serviceWorkerMessageListenerRegistered = true;
  }

  private async ensureLocalNotificationListeners(): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.localNotificationListenersRegistered || !Capacitor.isPluginAvailable('LocalNotifications')) {
      return;
    }

    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      this.handleNotificationClick(action.notification);
    });

    this.localNotificationListenersRegistered = true;
  }

  private async ensureLocalNotificationPermission(shouldRequest = true): Promise<boolean> {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('LocalNotifications')) {
      return false;
    }

    const currentStatus = await LocalNotifications.checkPermissions();
    if (currentStatus.display === 'granted') {
      return true;
    }

    if (currentStatus.display === 'denied' || !shouldRequest) {
      return false;
    }

    const requestedStatus = await LocalNotifications.requestPermissions();
    return requestedStatus.display === 'granted';
  }

  private async ensureNativePushListeners(): Promise<void> {
    if (this.nativeListenersRegistered) {
      return;
    }

    PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success, token: ' + token.value);
      this.lastRegistrationError = null;

      if (this.currentUser && this.currentChurchId) {
        await this.saveDeviceToken(token.value, this.getPlatform());
      }

      this.resolvePendingNativeRegistration?.(token.value);
      this.clearPendingNativeRegistration();
    });

    PushNotifications.addListener('registrationError', (error) => {
      const message = this.toErrorMessage(error);
      this.lastRegistrationError = message;
      console.error('Error during registration: ', JSON.stringify(error));
      this.rejectPendingNativeRegistration?.(new Error(message));
      this.clearPendingNativeRegistration();
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received: ', notification);
      this.handleForegroundNotification(notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push notification action performed: ', notification);
      this.handleNotificationClick(notification);
    });

    this.nativeListenersRegistered = true;
  }

  private async waitForNativeRegistration(timeoutMs = 15000): Promise<string | null> {
    if (this.pendingNativeRegistration) {
      return this.pendingNativeRegistration;
    }

    this.pendingNativeRegistration = new Promise<string | null>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for native push registration.'));
        this.clearPendingNativeRegistration();
      }, timeoutMs);

      this.resolvePendingNativeRegistration = (token) => {
        clearTimeout(timeout);
        resolve(token);
      };

      this.rejectPendingNativeRegistration = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    try {
      await PushNotifications.register();
      return await this.pendingNativeRegistration;
    } catch (error) {
      this.clearPendingNativeRegistration();
      throw error;
    }
  }

  private async registerNativeTokenWithRetry(maxAttempts = 3): Promise<string | null> {
    await this.ensureNativePushListeners();

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.waitForNativeRegistration();
      } catch (error) {
        lastError = error;
        const message = this.toErrorMessage(error);
        this.lastRegistrationError = message;

        if (attempt === maxAttempts || !this.isRetryableNativeRegistrationError(message)) {
          throw error;
        }

        const delayMs = 1500 * attempt;
        console.warn(`Native push registration failed (attempt ${attempt}/${maxAttempts}): ${message}. Retrying in ${delayMs}ms.`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    throw lastError ?? new Error('Native push registration failed.');
  }

  private async requestNativePermissionIfNeeded(): Promise<boolean> {
    if (!this.nativePushConfigured) {
      this.lastRegistrationError = 'Native push requires android/app/google-services.json plus VITE_ENABLE_NATIVE_PUSH=true.';
      return false;
    }

    const currentStatus = await PushNotifications.checkPermissions();
    if (currentStatus.receive === 'granted') {
      return true;
    }

    if (currentStatus.receive === 'denied') {
      this.lastRegistrationError = 'Notification permission is blocked in the device settings.';
      return false;
    }

    const requestedStatus = await PushNotifications.requestPermissions();
    if (requestedStatus.receive !== 'granted') {
      this.lastRegistrationError = 'Notification permission was not granted on the device.';
      return false;
    }

    return true;
  }

  // Initialize push notification service
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      if (this.currentUser && this.currentChurchId) {
        await this.registerDeviceToken();
      }
      return true;
    }

    try {
      this.lastRegistrationError = null;

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
            this.ensureServiceWorkerMessageListener();
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
      if (Capacitor.isNativePlatform() && this.nativePushConfigured) {
        await this.initializeCapacitorPushNotifications();
      } else if (Capacitor.isNativePlatform()) {
        console.warn('Native push notifications are disabled because Firebase Android native config is not enabled.');
      }

      this.isInitialized = true;

      if (this.currentUser && this.currentChurchId) {
        await this.registerDeviceToken();
      }

      console.log('✅ Push notification service initialized');
      return true;
    } catch (error) {
      this.lastRegistrationError = this.toErrorMessage(error);
      console.error('❌ Failed to initialize push notification service:', error);
      return false;
    }
  }

  // Initialize Capacitor push notifications for mobile platforms
  private async initializeCapacitorPushNotifications(): Promise<void> {
    await this.ensureAndroidNotificationChannel();
    await this.ensureNativePushListeners();

    const permResult = await PushNotifications.checkPermissions();

    if (permResult.receive === 'granted') {
      await this.registerNativeTokenWithRetry();
    } else {
      this.lastRegistrationError = 'Notification permission has not been granted yet.';
    }
  }

  private async ensureAndroidNotificationChannel(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }

    try {
      if (Capacitor.isPluginAvailable('PushNotifications')) {
        await PushNotifications.createChannel({
          id: PushNotificationService.ANDROID_CHANNEL_ID,
          name: 'SAT Mobile Notifications',
          description: 'General alerts and activity updates',
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
        });
      }

      if (Capacitor.isPluginAvailable('LocalNotifications')) {
        await LocalNotifications.createChannel({
          id: PushNotificationService.ANDROID_CHANNEL_ID,
          name: 'SAT Mobile Notifications',
          description: 'General alerts and activity updates',
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
          sound: 'default'
        } as any);
      }
    } catch (error) {
      console.warn('Failed to ensure Android notification channel:', error);
    }
  }

  // Set user context for push notifications
  setUserContext(user: User | null, churchId: string | null): void {
    const previousUser = this.currentUser;
    const previousChurchId = this.currentChurchId;

    this.currentUser = user;
    this.currentChurchId = churchId;

    // Initialize token registration if user is available
    if (user && churchId && (!Capacitor.isNativePlatform() || this.nativePushConfigured)) {
      this.registerDeviceToken();
    } else if (previousUser && previousChurchId) {
      this.unregisterDeviceTokensFor(previousUser, previousChurchId);
    }
  }

  // Register device token for current user
  async registerDeviceToken(): Promise<string | null> {
    if (!this.currentUser || !this.currentChurchId) {
      console.warn('Cannot register device token: user or church context missing');
      return null;
    }

    const configurationIssue = this.getConfigurationIssue();
    if (configurationIssue) {
      this.lastRegistrationError = configurationIssue;
      console.warn(configurationIssue);
      return null;
    }

    try {
      let token: string | null = null;

      if (Capacitor.isNativePlatform()) {
        if (!this.nativePushConfigured) {
          console.warn('Skipping native device token registration because native push is disabled.');
          return null;
        }

        const permissionGranted = await this.requestNativePermissionIfNeeded();
        if (!permissionGranted) {
          return null;
        }

        token = await this.registerNativeTokenWithRetry();
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
                const serviceWorkerRegistration = 'serviceWorker' in navigator
                  ? await navigator.serviceWorker.ready.catch(() => undefined)
                  : undefined;
                token = await getToken(this.messaging, {
                  vapidKey: this.vapidKey,
                  ...(serviceWorkerRegistration ? { serviceWorkerRegistration } : {})
                });
                if (token) {
                  await this.saveDeviceToken(token, 'web');
                  this.lastRegistrationError = null;
                  console.log('✅ Web FCM token registered:', token.substring(0, 20) + '...');
                } else {
                  console.warn('⚠️ getToken returned null/empty');
                }
              } catch (gtErr) {
                this.lastRegistrationError = this.toErrorMessage(gtErr);
                console.error('Failed to obtain FCM token:', gtErr);
              }
            } else if (permission === 'denied') {
              this.lastRegistrationError = 'Notification permission is blocked in the browser/device settings.';
              console.warn('❌ Notifications are blocked by the user/browser settings');
              console.warn('ℹ️ In most browsers you must manually re-enable them in site settings.');
            } else {
              this.lastRegistrationError = 'Notification permission has not been granted yet.';
              console.log('Notification permission unresolved (default) – user has not decided yet.');
            }
        }
      }

      // Set up foreground message listener for web
      if (this.messaging && !Capacitor.isNativePlatform() && !this.webForegroundMessageListenerRegistered) {
        onMessage(this.messaging, (payload) => {
          console.log('Message received while app is in foreground:', payload);
          this.handleForegroundNotification(payload);
        });
        this.webForegroundMessageListenerRegistered = true;
      }

      return token;
    } catch (error) {
      this.lastRegistrationError = this.toErrorMessage(error);
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
    await this.unregisterDeviceTokensFor(this.currentUser, this.currentChurchId);
  }

  private async unregisterDeviceTokensFor(user: User, churchId: string): Promise<void> {
    try {
      // Get all tokens for this user and mark as inactive
      const tokensQuery = query(
        collection(db, `churches/${churchId}/deviceTokens`),
        where('userId', '==', user.uid),
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
        deepLink: notification.id ? `/notifications/${notification.id}` : '/notifications'
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
      case 'member_deleted':
        basePayload.title = '🗑️ Member Deleted';
        basePayload.body = `${notification.leaderName} deleted ${notification.details.memberName}`;
        break;
      case 'member_deletion_requested':
        basePayload.title = '🗑️ Deletion Request';
        basePayload.body = notification.details.description;
        break;
      case 'member_deletion_approved':
        basePayload.title = '✅ Deletion Approved';
        basePayload.body = notification.details.description;
        break;
      case 'member_deletion_rejected':
        basePayload.title = '⛔ Deletion Rejected';
        basePayload.body = notification.details.description;
        break;
      case 'attendance_updated':
        basePayload.title = '📅 Attendance Updated';
        basePayload.body = notification.details.description;
        break;
      case 'new_believer_updated':
        basePayload.title = '🙏 New Believer Updated';
        basePayload.body = notification.details.description;
        break;
      case 'bacenta_assignment_changed':
        basePayload.title = '🏠 Bacenta Assignment Changed';
        basePayload.body = notification.details.description;
        break;
      case 'bacenta_updated':
        basePayload.title = '🏠 Bacenta Updated';
        basePayload.body = notification.details.description;
        break;
      case 'bacenta_freeze_toggled':
        basePayload.title = '❄️ Bacenta Status Changed';
        basePayload.body = notification.details.description;
        break;
      case 'member_freeze_toggled':
        basePayload.title = '❄️ Member Status Changed';
        basePayload.body = notification.details.description;
        break;
      case 'member_converted':
        basePayload.title = '🔁 Outreach Member Converted';
        basePayload.body = notification.details.description;
        break;
      case 'birthday_reminder':
        basePayload.title = '🎂 Birthday Reminder';
        basePayload.body = notification.details.description;
        break;
      case 'meeting_record_added':
        basePayload.title = '📝 Meeting Record Added';
        basePayload.body = notification.details.description;
        break;
      case 'meeting_record_updated':
        basePayload.title = '✏️ Meeting Record Updated';
        basePayload.body = notification.details.description;
        break;
      case 'meeting_record_deleted':
        basePayload.title = '🗑️ Meeting Record Deleted';
        basePayload.body = notification.details.description;
        break;
      default:
        basePayload.body = notification.details.description;
    }

    return basePayload;
  }

  async displayAdminNotification(notification: AdminNotification, options: SystemNotificationOptions = {}): Promise<boolean> {
    return this.displaySystemNotification(
      this.createNotificationPayload(notification),
      {
        ...options,
        dedupeKey: options.dedupeKey || notification.id
      }
    );
  }

  async displaySystemNotification(
    payload: PushNotificationPayload,
    options: SystemNotificationOptions = {}
  ): Promise<boolean> {
    const title = payload.title?.trim() || 'SAT Mobile';
    const body = payload.body?.trim() || 'New notification received';
    const data = payload.data || {};
    const dedupeKey = this.getSystemNotificationDedupeKey({ ...payload, title, body, data }, options.dedupeKey);

    if (!this.shouldDisplaySystemNotification(dedupeKey)) {
      return false;
    }

    try {
      if (Capacitor.isNativePlatform()) {
        if (!Capacitor.isPluginAvailable('LocalNotifications')) {
          console.warn('LocalNotifications plugin is not available on this native platform.');
          return false;
        }

        const permissionGranted = await this.ensureLocalNotificationPermission(options.requestPermission !== false);
        if (!permissionGranted) {
          return false;
        }

        await this.ensureAndroidNotificationChannel();
        await this.ensureLocalNotificationListeners();

        await LocalNotifications.schedule({
          notifications: [{
            id: this.nextLocalNotificationId(),
            title,
            body,
            channelId: PushNotificationService.ANDROID_CHANNEL_ID,
            smallIcon: 'ic_notification',
            iconColor: '#334155',
            sound: payload.sound || 'default',
            extra: {
              ...data,
              dedupeKey
            }
          }]
        } as any);

        return true;
      }

      if (typeof window === 'undefined' || !('Notification' in window)) {
        return false;
      }

      let permission = Notification.permission;
      if (permission === 'default' && options.requestPermission !== false) {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        return false;
      }

      const browserNotification = new Notification(title, {
        body,
        icon: payload.icon || '/icon-192.png',
        badge: this.getBrowserBadgeUrl(payload.badge),
        tag: dedupeKey,
        renotify: true,
        data
      });

      window.setTimeout(() => {
        browserNotification.close();
      }, options.autoCloseMs ?? 7000);

      browserNotification.onclick = () => {
        window.focus();
        this.handleNotificationClick({ data });
        browserNotification.close();
      };

      return true;
    } catch (error) {
      console.warn('Failed to display system notification:', error);
      return false;
    }
  }

  private normalizeIncomingNotification(notification: any): PushNotificationPayload {
    const notificationBlock = notification.notification || {};
    const data = notification.data || notificationBlock.data || notification.extra || {};

    return {
      title: notification.title || notificationBlock.title || 'SAT Mobile',
      body: notification.body || notificationBlock.body || 'New notification received',
      data,
      icon: notification.icon || notificationBlock.icon || '/icon-192.png',
      badge: notification.badge || notificationBlock.badge || '/icon-192.png',
      sound: notification.sound || notificationBlock.sound || 'default'
    };
  }

  // Handle foreground notification display
  private handleForegroundNotification(notification: any): void {
    void this.displaySystemNotification(
      this.normalizeIncomingNotification(notification),
      { requestPermission: false }
    );
  }

  // Handle notification click/tap
  private handleNotificationClick(notification: any): void {
    const data = notification.data || notification.extra || notification.notification?.data || notification.notification?.extra || {};

    const deepLink = this.normalizeDeepLink(data.deepLink || data.url || '/notifications');
    const notificationId = this.getNotificationIdFromDeepLink(deepLink, data);

    window.location.hash = deepLink;

    if (deepLink.startsWith('/notifications')) {
      this.dispatchNotificationOpenEvent(notificationId);
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
      return Capacitor.isPluginAvailable('LocalNotifications') || (this.nativePushConfigured && Capacitor.isPluginAvailable('PushNotifications'));
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
      nativePushConfigured: this.nativePushConfigured,
      nativeListenersRegistered: this.nativeListenersRegistered,
      vapidConfigured: this.vapidKey.length > 0,
      vapidValid: this.isValidVapidKey(this.vapidKey),
      configurationIssue: this.getConfigurationIssue(),
      lastRegistrationError: this.lastRegistrationError,
      pluginAvailable: Capacitor.isNativePlatform() ? Capacitor.isPluginAvailable('PushNotifications') : false,
      localNotificationsAvailable: Capacitor.isNativePlatform() ? Capacitor.isPluginAvailable('LocalNotifications') : false,
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
      if (Capacitor.isPluginAvailable('LocalNotifications')) {
        const localStatus = await LocalNotifications.checkPermissions();
        if (localStatus.display === 'granted' || localStatus.display === 'denied') {
          return localStatus.display;
        }
      }

      if (this.nativePushConfigured && Capacitor.isPluginAvailable('PushNotifications')) {
        const status = await PushNotifications.checkPermissions();
        return status.receive === 'granted' || status.receive === 'denied' ? status.receive : 'default';
      }

      return 'default';
    } else {
      return Notification.permission;
    }
  }

  // Request notification permissions
  async requestPermissions(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        let localPermissionGranted = false;

        if (Capacitor.isPluginAvailable('LocalNotifications')) {
          localPermissionGranted = await this.ensureLocalNotificationPermission(true);
          if (localPermissionGranted) {
            await this.ensureAndroidNotificationChannel();
            await this.ensureLocalNotificationListeners();
          }
        }

        if (!this.nativePushConfigured) {
          if (!localPermissionGranted) {
            this.lastRegistrationError = 'Notification permission was not granted on the device.';
          } else {
            this.lastRegistrationError = 'Native push token registration requires android/app/google-services.json plus VITE_ENABLE_NATIVE_PUSH=true.';
          }
          return localPermissionGranted;
        }

        const result = await PushNotifications.requestPermissions();
        if (result.receive !== 'granted') {
          if (!localPermissionGranted) {
            this.lastRegistrationError = 'Notification permission was not granted on the device.';
          }
          return localPermissionGranted;
        }

        await this.ensureAndroidNotificationChannel();
        await this.ensureNativePushListeners();
        try {
          await this.registerNativeTokenWithRetry();
        } catch (error) {
          this.lastRegistrationError = this.toErrorMessage(error);
          console.error('Native push permission was granted, but token registration failed:', error);
        }
        return true;
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
