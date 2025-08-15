// Firebase Cloud Function for sending push notifications
// This file should be deployed to Firebase Functions

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');
const { defineSecret } = require('firebase-functions/params');
const { Resend } = require('resend');

// Secret for SendGrid API Key (configure via: firebase functions:secrets:set SENDGRID_API_KEY)
const SENDGRID_API_KEY = defineSecret('SENDGRID_API_KEY');
const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

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

// Shared provider-based email sender
async function sendEmailWithProviders({ to, subject, html, text, from }) {
  const fromAddress = from || 'no-reply@sat-mobile.app';
  const resendKey = RESEND_API_KEY.value();
  if (resendKey) {
    const resend = new Resend(resendKey);
    const result = await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      html: html || undefined,
      text: text || undefined
    });
    if (result?.error) {
      throw new Error(result.error?.message || 'Resend error');
    }
    return { success: true, messageId: result?.data?.id || null };
  }
  // Fallback to SendGrid
  sgMail.setApiKey(SENDGRID_API_KEY.value());
  const [response] = await sgMail.send({
    to,
    from: fromAddress,
    subject,
    html: html || undefined,
    text: text || undefined
  });
  const messageId = response?.headers?.['x-message-id'] || response?.headers?.['x-message-id'.toLowerCase()];
  return { success: true, messageId: messageId || null, statusCode: response?.statusCode || response?.status };
}

// Callable: send birthday email using provider(s) — admin only
exports.sendBirthdayEmail = functions
  .runWith({ secrets: [SENDGRID_API_KEY, RESEND_API_KEY] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Enforce admin-only triggering
    try {
      const uid = context.auth.uid;
      const userSnap = await admin.firestore().doc(`users/${uid}`).get();
      const role = userSnap.exists ? (userSnap.data().role || '').toString() : '';
      if (role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can send birthday emails');
      }
    } catch (e) {
      if (e instanceof functions.https.HttpsError) throw e;
      console.error('Role verification failed:', e);
      throw new functions.https.HttpsError('permission-denied', 'Role verification failed');
    }

    const { to, subject, html, text, from } = data || {};
    if (!to || typeof to !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Recipient email `to` is required');
    }
    if (!subject || typeof subject !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Email `subject` is required');
    }
    if ((!html || typeof html !== 'string') && (!text || typeof text !== 'string')) {
      throw new functions.https.HttpsError('invalid-argument', 'Either `html` or `text` content is required');
    }
    try {
      return await sendEmailWithProviders({ to, subject, html, text, from });
    } catch (err) {
      console.error('sendBirthdayEmail failed', err);
      const code = err?.code === 403 ? 'permission-denied' : 'internal';
      throw new functions.https.HttpsError(code, err?.message || 'Failed to send email');
    }
  });

// Small helper to set robust CORS headers
function setCors(req, res) {
  const origin = req.headers.origin || '*';
  const reqHeaders = req.headers['access-control-request-headers'];
  res.set('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
  res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', reqHeaders || 'Content-Type, Authorization');
  // Optional: cache preflight for 1 hour
  res.set('Access-Control-Max-Age', '3600');
}

// HTTP (CORS-enabled) fallback for sending birthday email (for local dev or non-callable clients)
exports.sendBirthdayEmailHttp = functions
  .runWith({ secrets: [SENDGRID_API_KEY, RESEND_API_KEY] })
  .https.onRequest(async (req, res) => {
    setCors(req, res);
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }
    // Verify Firebase ID token and role (admin only)
    try {
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.toString().startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Missing Authorization Bearer token' });
      }
      const idToken = authHeader.toString().replace('Bearer ', '');
      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;
      const userSnap = await admin.firestore().doc(`users/${uid}`).get();
      const role = userSnap.exists ? (userSnap.data().role || '').toString() : '';
      if (role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Only admins can send birthday emails' });
      }
    } catch (authErr) {
      console.error('Auth/role verification failed on HTTP endpoint:', authErr);
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    try {
      const { to, subject, html, text, from } = req.body || {};
      if (!to || !subject || (!html && !text)) {
        return res.status(400).json({ success: false, error: 'Invalid payload' });
      }
      const result = await sendEmailWithProviders({ to, subject, html, text, from });
      return res.status(200).json(result);
    } catch (err) {
      console.error('sendBirthdayEmailHttp failed', err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to send email' });
    }
  });

// Callable function: get member counts per church (constituency) – counts ONLY active members (isActive != false)
exports.getMemberCounts = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      console.warn('getMemberCounts invoked without auth – prototype allowance.');
    }
    const churchIds = Array.isArray(data?.churchIds) ? data.churchIds.slice(0, 300) : null; // limit safeguard
    if (!churchIds || churchIds.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'churchIds array required');
    }
    const db = admin.firestore();
    const counts = {};
    let total = 0;

    for (const cid of churchIds) {
      if (typeof cid !== 'string' || !cid.trim()) continue;
      try {
        const membersRef = db.collection('churches').doc(cid).collection('members').where('isActive', '==', true);
        const snap = await membersRef.select().get();
        const count = snap.size;
        counts[cid] = count;
        total += count;
      } catch (innerErr) {
        console.error('Member count failed for church', cid, innerErr);
        counts[cid] = -1; // error marker
      }
    }
    return { counts, total };
  } catch (err) {
    console.error('getMemberCounts failed', err);
    throw new functions.https.HttpsError('internal', 'Failed to compute member counts');
  }
});

// Real-time maintenance of membersCount on church & owning admin user
exports.onMemberCreated = functions.firestore
  .document('churches/{churchId}/members/{memberId}')
  .onCreate(async (snap, context) => {
    const data = snap.data() || {};
    if (data.isActive === false) return; // Only count active members
    const { churchId } = context.params;
    const db = admin.firestore();
    const churchRef = db.doc(`churches/${churchId}`);
    try {
      await churchRef.set({ membersCount: admin.firestore.FieldValue.increment(1) }, { merge: true });
    } catch (e) {
      console.error('Failed incrementing church membersCount', churchId, e);
    }
    try {
      const adminsSnap = await db.collection('users').where('churchId', '==', churchId).where('role', '==', 'admin').get();
      const batch = db.batch();
      adminsSnap.forEach(docSnap => batch.set(docSnap.ref, { membersCount: admin.firestore.FieldValue.increment(1) }, { merge: true }));
      if (!adminsSnap.empty) await batch.commit();
    } catch (e) {
      console.error('Failed incrementing admin membersCount', churchId, e);
    }
  });

exports.onMemberDeleted = functions.firestore
  .document('churches/{churchId}/members/{memberId}')
  .onDelete(async (snap, context) => {
    const data = snap.data() || {};
    if (data.isActive === false) return; // Only decrement if previously active
    const { churchId } = context.params;
    const db = admin.firestore();
    const churchRef = db.doc(`churches/${churchId}`);
    try {
      await churchRef.set({ membersCount: admin.firestore.FieldValue.increment(-1) }, { merge: true });
    } catch (e) {
      console.error('Failed decrementing church membersCount', churchId, e);
    }
    try {
      const adminsSnap = await db.collection('users').where('churchId', '==', churchId).where('role', '==', 'admin').get();
      const batch = db.batch();
      adminsSnap.forEach(docSnap => batch.set(docSnap.ref, { membersCount: admin.firestore.FieldValue.increment(-1) }, { merge: true }));
      if (!adminsSnap.empty) await batch.commit();
    } catch (e) {
      console.error('Failed decrementing admin membersCount', churchId, e);
    }
  });

// One-off update trigger to adjust counts when a member switches active status (soft delete legacy)
exports.onMemberUpdated = functions.firestore
  .document('churches/{churchId}/members/{memberId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};
    if (before.isActive === after.isActive) return; // Nothing changed regarding activity
    const { churchId } = context.params;
    const db = admin.firestore();
    const delta = (before.isActive !== false && after.isActive === false) ? -1 : (before.isActive === false && after.isActive !== false) ? 1 : 0;
    if (delta === 0) return;
    const churchRef = db.doc(`churches/${churchId}`);
    try {
      await churchRef.set({ membersCount: admin.firestore.FieldValue.increment(delta) }, { merge: true });
    } catch (e) {
      console.error('Failed adjusting church membersCount (update)', churchId, e);
    }
    try {
      const adminsSnap = await db.collection('users').where('churchId', '==', churchId).where('role', '==', 'admin').get();
      const batch = db.batch();
      adminsSnap.forEach(docSnap => batch.set(docSnap.ref, { membersCount: admin.firestore.FieldValue.increment(delta) }, { merge: true }));
      if (!adminsSnap.empty) await batch.commit();
    } catch (e) {
      console.error('Failed adjusting admin membersCount (update)', churchId, e);
    }
  });

// Callable backfill to recompute membersCount (one-off / admin only)
exports.recomputeMemberCounts = functions.https.onCall(async (_, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  }
  const db = admin.firestore();
  const churchesSnap = await db.collection('churches').get();
  let total = 0;
  for (const churchDoc of churchesSnap.docs) {
    const churchId = churchDoc.id;
    try {
      const membersSnap = await db.collection('churches').doc(churchId).collection('members').where('isActive', '==', true).select().get();
      const size = membersSnap.size; // only active members
      total += size;
      const batch = db.batch();
      batch.set(churchDoc.ref, { membersCount: size }, { merge: true });
      const adminsSnap = await db.collection('users').where('churchId', '==', churchId).where('role', '==', 'admin').get();
      adminsSnap.forEach(a => batch.set(a.ref, { membersCount: size }, { merge: true }));
      await batch.commit();
    } catch (e) {
      console.error('Failed recomputing for church', churchId, e);
    }
  }
  return { success: true, total };
});

// Callable: purge inactive member documents (legacy soft-deleted) and recompute counts.
exports.purgeInactiveMembers = functions.https.onCall(async (_, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const db = admin.firestore();
  const churchesSnap = await db.collection('churches').get();
  let removed = 0;
  for (const churchDoc of churchesSnap.docs) {
    const churchId = churchDoc.id;
    try {
      const inactiveSnap = await db.collection('churches').doc(churchId).collection('members').where('isActive', '==', false).select().get();
      if (inactiveSnap.empty) continue;
      const batch = db.batch();
      inactiveSnap.docs.forEach(d => { batch.delete(d.ref); removed++; });
      await batch.commit();
      console.log(`Purged ${inactiveSnap.size} inactive members from church ${churchId}`);
    } catch (e) {
      console.error('Failed purging inactive members for church', churchId, e);
    }
  }
  // After purge, recompute
  await exports.recomputeMemberCounts.run?.(); // best effort if available
  return { success: true, removed };
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
  setCors(req, res);

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
