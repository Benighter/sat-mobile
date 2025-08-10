// Firebase Cloud Function for sending push notifications
// This file should be deployed to Firebase Functions

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

// Send push notification function
exports.sendPushNotification = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { tokens, payload, churchId } = data;

  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid tokens array is required');
  }

  if (!payload || !payload.title || !payload.body) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid payload with title and body is required');
  }

  try {
    // Prepare the message
    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icon-192.png'
      },
      data: {
        ...payload.data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK', // For mobile apps
      },
      webpush: {
        headers: {
          'TTL': '86400' // 24 hours
        },
        notification: {
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/icon-192.png',
          badge: payload.badge || '/icon-192.png',
          requireInteraction: true,
          actions: [
            {
              action: 'open',
              title: 'Open App'
            }
          ]
        },
        fcm_options: {
          link: payload.data?.deepLink || '/'
        }
      },
      android: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: 'ic_notification',
          color: '#334155',
          sound: 'default',
          channel_id: 'sat_mobile_notifications'
        },
        priority: 'high'
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body
            },
            badge: parseInt(payload.badge) || 1,
            sound: 'default'
          }
        }
      }
    };

    // Send to multiple tokens
    const responses = await Promise.allSettled(
      tokens.map(token => admin.messaging().send({
        ...message,
        token: token
      }))
    );

    // Count successful and failed sends
    let successCount = 0;
    let failureCount = 0;
    const failedTokens = [];

    responses.forEach((response, index) => {
      if (response.status === 'fulfilled') {
        successCount++;
        console.log(`Successfully sent to token ${index + 1}`);
      } else {
        failureCount++;
        failedTokens.push({
          token: tokens[index],
          error: response.reason.message
        });
        console.error(`Failed to send to token ${index + 1}:`, response.reason.message);
      }
    });

    // Clean up invalid tokens from database if any failed
    if (failedTokens.length > 0 && churchId) {
      await cleanupInvalidTokens(failedTokens, churchId);
    }

    console.log(`Push notification sent: ${successCount} successful, ${failureCount} failed`);

    return {
      success: true,
      successCount,
      failureCount,
      failedTokens: failedTokens.map(f => f.token)
    };

  } catch (error) {
    console.error('Error sending push notification:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send push notification');
  }
});

// Helper function to clean up invalid tokens
async function cleanupInvalidTokens(failedTokens, churchId) {
  try {
    const db = admin.firestore();
    const batch = db.batch();

    for (const failed of failedTokens) {
      // Check if it's a token registration error (invalid token)
      if (failed.error.includes('registration-token-not-registered') || 
          failed.error.includes('invalid-registration-token')) {
        
        const tokenRef = db.doc(`churches/${churchId}/deviceTokens/${failed.token}`);
        batch.update(tokenRef, { 
          isActive: false, 
          lastError: failed.error,
          lastErrorAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    await batch.commit();
    console.log('Cleaned up invalid tokens');
  } catch (error) {
    console.error('Failed to cleanup invalid tokens:', error);
  }
}

// Scheduled function to clean up old device tokens (runs daily)
exports.cleanupOldTokens = functions.pubsub.schedule('0 2 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    const db = admin.firestore();
    
    // Remove tokens older than 30 days and inactive
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const query = db.collectionGroup('deviceTokens')
      .where('isActive', '==', false)
      .where('lastUsed', '<', thirtyDaysAgo.toISOString());
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log('No old tokens to clean up');
      return;
    }
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`Cleaned up ${snapshot.size} old device tokens`);
  });

// HTTP endpoint for sending notifications (for development/testing)
exports.sendNotificationHTTP = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { tokens, payload, churchId } = req.body;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      res.status(400).json({ error: 'Valid tokens array is required' });
      return;
    }

    if (!payload || !payload.title || !payload.body) {
      res.status(400).json({ error: 'Valid payload with title and body is required' });
      return;
    }

    // Use the same logic as the callable function
    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icon-192.png'
      },
      data: payload.data || {},
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/icon-192.png',
          requireInteraction: true
        }
      }
    };

    const responses = await Promise.allSettled(
      tokens.map(token => admin.messaging().send({
        ...message,
        token: token
      }))
    );

    let successCount = 0;
    let failureCount = 0;

    responses.forEach((response) => {
      if (response.status === 'fulfilled') {
        successCount++;
      } else {
        failureCount++;
      }
    });

    res.json({
      success: true,
      successCount,
      failureCount
    });

  } catch (error) {
    console.error('Error in HTTP notification endpoint:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});
