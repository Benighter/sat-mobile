// @ts-nocheck
/**
 * Firebase Callable Cloud Function to send push notifications.
 */
// Using v2 callable. If typings not available, ensure firebase-functions updated.
import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

if (!getApps().length) {
  initializeApp();
}

interface SendPushData {
  tokens: string[];
  payload: {
    title: string;
    body: string;
    data?: Record<string, any>;
    icon?: string;
    badge?: string;
    sound?: string;
  };
  churchId?: string;
}

export const sendPushNotification = onCall<SendPushData>(async (request: any) => {
  const auth = request.auth; // auth contains uid if authenticated
  const data = request.data as SendPushData;

  if (!auth) {
    logger.warn('Unauthenticated attempt to send push notification');
    throw new Error('UNAUTHENTICATED');
  }

  if (!data || !Array.isArray(data.tokens) || data.tokens.length === 0) {
    throw new Error('Invalid tokens array');
  }

  const { tokens, payload } = data;
  const messaging = getMessaging();

  try {
    const message = {
      notification: {
        title: payload.title || 'Notification',
        body: payload.body || '',
      },
      data: {
        ...(payload.data || {}),
      },
      android: {
        priority: 'high',
        notification: {
          sound: payload.sound || 'default',
          channelId: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: payload.sound || 'default',
            badge: 1,
            contentAvailable: true,
          },
        },
      },
      tokens,
    } as any;

    const response = await messaging.sendEachForMulticast(message);
    logger.info('Push notification send result', { successCount: response.successCount, failureCount: response.failureCount });

    const failed: any[] = [];
    response.responses.forEach((r, idx) => {
      if (!r.success) {
        failed.push({ token: tokens[idx], error: r.error?.message });
      }
    });

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      failed,
    };
  } catch (error: any) {
    logger.error('Failed to send push notification', error);
    return { success: false, error: error.message };
  }
});
