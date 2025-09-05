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

// Callable: relayUploadChatImage (CORS workaround for Storage uploads)
// data: { threadId, churchId, data (base64 string), mimeType, caption }
exports.relayUploadChatImage = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const { threadId, churchId, data: b64, mimeType, caption } = data || {};
  if (!threadId || !churchId || !b64) {
    throw new functions.https.HttpsError('invalid-argument', 'threadId, churchId and data required');
  }
  try {
    const uid = context.auth.uid;
    const db = admin.firestore();
    // Verify user is participant of thread
    const threadRef = db.doc(`churches/${churchId}/chatThreads/${threadId}`);
    const threadSnap = await threadRef.get();
    if (!threadSnap.exists) throw new functions.https.HttpsError('not-found', 'Thread not found');
    const thread = threadSnap.data() || {};
    const participants = thread.participants || [];
    if (!participants.includes(uid)) throw new functions.https.HttpsError('permission-denied', 'Not a participant');

    const buffer = Buffer.from(b64, 'base64');
    const storagePath = `chat/${churchId}/${threadId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${(mimeType||'image/png').split('/').pop()}`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.save(buffer, { contentType: mimeType || 'image/png', resumable: false, public: false });
    const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 1000*60*60*24*30 }); // 30 days

    // Write message
    const msgRef = db.collection(`churches/${churchId}/chatThreads/${threadId}/messages`).doc();
    await msgRef.set({
      senderId: uid,
      text: caption || '',
      attachments: [{ type: 'image', url: signedUrl, name: file.name }],
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    // Optimistic thread update
    await threadRef.set({
      lastMessage: { text: (caption || '📷 Photo').slice(0,120), senderId: uid, at: admin.firestore.FieldValue.serverTimestamp() },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { url: signedUrl };
  } catch (e) {
    console.error('relayUploadChatImage failed', e);
    if (e instanceof functions.https.HttpsError) throw e;
    throw new functions.https.HttpsError('internal', e?.message || 'Upload failed');
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
  } catch (error) {
    console.error('Failed to cleanup invalid tokens:', error);
  }
}

// Helper: resolve owner mapping and ministry church for a given church
async function getOwnerChurchMapping(churchId) {
  const db = admin.firestore();
  try {
    const churchRef = db.doc(`churches/${churchId}`);
    const churchSnap = await churchRef.get();
    if (!churchSnap.exists) return null;
    const church = churchSnap.data() || {};
    const ownerId = church.ownerId;
    if (!ownerId) return null;
    const userSnap = await db.doc(`users/${ownerId}`).get();
    if (!userSnap.exists) return null;
    const user = userSnap.data() || {};
    const ctx = (user && user.contexts) || {};
    const defaultChurchId = ctx.defaultChurchId || user.churchId;
    const ministryChurchId = ctx.ministryChurchId;
    if (!defaultChurchId || !ministryChurchId) return null;
    return { ownerId, defaultChurchId, ministryChurchId };
  } catch (e) {
    console.error('getOwnerChurchMapping failed for', churchId, e);
    return null;
  }
}

// Helper function to find all ministry churches with a specific ministry
async function findMinistryChurchesWithMinistry(db, ministryName) {
  try {
    const usersSnapshot = await db.collection('users')
      .where('isMinistryAccount', '==', true)
      .where('preferences.ministryName', '==', ministryName)
      .get();

    const ministryChurchIds = [];
    usersSnapshot.docs.forEach(doc => {
      const userData = doc.data();
      const ministryChurchId = userData.contexts?.ministryChurchId || userData.churchId;
      if (ministryChurchId && !ministryChurchIds.includes(ministryChurchId)) {
        ministryChurchIds.push(ministryChurchId);
      }
    });

    return ministryChurchIds;
  } catch (e) {
    console.error('findMinistryChurchesWithMinistry failed', e);
    return [];
  }
}

// Helper function to sync member to all matching ministry churches
async function syncToMatchingMinistryChurches(db, memberId, memberData, sourceChurchId) {
  try {
    const ministryName = memberData.ministry;
    if (!ministryName) return;

    const ministryChurchIds = await findMinistryChurchesWithMinistry(db, ministryName);

    const batch = db.batch();
    let batchCount = 0;

    for (const ministryChurchId of ministryChurchIds) {
      const targetRef = db.doc(`churches/${ministryChurchId}/members/${memberId}`);
      const payload = {
        ...memberData,
        bacentaId: '', // Detach from bacenta structure in ministry context
        syncedFrom: {
          churchId: sourceChurchId,
          at: new Date().toISOString()
        },
        syncOrigin: 'default'
      };

      batch.set(targetRef, payload, { merge: true });
      batchCount++;

      // Commit in chunks to respect Firestore limits
      if (batchCount >= 450) {
        await batch.commit();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }
  } catch (e) {
    console.error('syncToMatchingMinistryChurches failed', e);
  }
}

// Helper function to remove member from all ministry churches
async function removeFromAllMinistryChurches(db, memberId, ministryName) {
  try {
    if (!ministryName) return;

    const ministryChurchIds = await findMinistryChurchesWithMinistry(db, ministryName);

    const batch = db.batch();
    let batchCount = 0;

    for (const ministryChurchId of ministryChurchIds) {
      const targetRef = db.doc(`churches/${ministryChurchId}/members/${memberId}`);
      batch.delete(targetRef);
      batchCount++;

      // Commit in chunks to respect Firestore limits
      if (batchCount >= 450) {
        await batch.commit();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }
  } catch (e) {
    console.error('removeFromAllMinistryChurches failed', e);
  }
}

// Enhanced sync: members from DEFAULT church to ALL MINISTRY churches with matching ministry
exports.syncMemberToMinistry = functions.firestore
  .document('churches/{churchId}/members/{memberId}')
  .onWrite(async (change, context) => {
    const { churchId, memberId } = context.params;
    const db = admin.firestore();
    try {
      const mapping = await getOwnerChurchMapping(churchId);
      if (!mapping) return;
      const { defaultChurchId, ministryChurchId } = mapping;
      // Only act for writes against the DEFAULT church; avoid loops on ministry side
      if (churchId !== defaultChurchId) return;

      const before = change.before.exists ? change.before.data() : null;
      const after = change.after.exists ? change.after.data() : null;

      // If deleted in default, remove from all ministry churches
      if (!after) {
        await removeFromAllMinistryChurches(db, memberId, before?.ministry);
        return;
      }

      const hasMinistry = typeof after.ministry === 'string' && after.ministry.trim() !== '';
      const isActive = after.isActive !== false; // default true

      // If no ministry or inactive, remove from all ministry churches
      if (!hasMinistry || !isActive) {
        await removeFromAllMinistryChurches(db, memberId, before?.ministry || after.ministry);
        return;
      }

      // Sync to all ministry churches with matching ministry
      await syncToMatchingMinistryChurches(db, memberId, after, defaultChurchId);

      // Also handle ministry change - remove from old ministry churches if ministry changed
      if (before && before.ministry && before.ministry !== after.ministry) {
        await removeFromAllMinistryChurches(db, memberId, before.ministry);
      }
    } catch (e) {
      console.error('syncMemberToMinistry failed', churchId, memberId, e);
    }
  });

      // Callable to backfill existing members from default -> ministry for the calling admin
      exports.backfillMinistrySync = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
          throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
        }
        const uid = context.auth.uid;
        const db = admin.firestore();
        try {
          const userSnap = await db.doc(`users/${uid}`).get();
          if (!userSnap.exists) {
            throw new functions.https.HttpsError('failed-precondition', 'User profile not found');
          }
          const user = userSnap.data() || {};
          const ctx = (user && user.contexts) || {};
          const defaultChurchId = ctx.defaultChurchId || user.churchId;
          const ministryChurchId = ctx.ministryChurchId;
          if (!defaultChurchId || !ministryChurchId) {
            throw new functions.https.HttpsError('failed-precondition', 'User does not have both default and ministry churches');
          }

          // Enhanced backfill: sync members to ALL ministry churches with matching ministry
          const membersSnap = await db.collection('churches').doc(defaultChurchId).collection('members').get();
          let synced = 0;

          for (const docSnap of membersSnap.docs) {
            const m = docSnap.data() || {};
            const hasMinistry = typeof m.ministry === 'string' && m.ministry.trim() !== '';
            const isActive = m.isActive !== false;
            if (!hasMinistry || !isActive) continue;

            // Sync to all matching ministry churches
            await syncToMatchingMinistryChurches(db, docSnap.id, m, defaultChurchId);
            synced++;
          }
          return { success: true, synced };
        } catch (e) {
          console.error('backfillMinistrySync failed', e);
          throw new functions.https.HttpsError('internal', e?.message || 'Backfill failed');
        }
      });

      // Bidirectional sync: changes in ministry mode sync back to default church
      exports.syncMinistryToDefault = functions.firestore
        .document('churches/{churchId}/members/{memberId}')
        .onWrite(async (change, context) => {
          const { churchId, memberId } = context.params;
          const db = admin.firestore();
          try {
            // Only act on ministry churches (those with ministry accounts)
            const churchDoc = await db.doc(`churches/${churchId}`).get();
            if (!churchDoc.exists) return;

            const churchData = churchDoc.data() || {};
            const ownerId = churchData.ownerId;
            if (!ownerId) return;

            const userDoc = await db.doc(`users/${ownerId}`).get();
            if (!userDoc.exists) return;

            const userData = userDoc.data() || {};
            if (!userData.isMinistryAccount) return; // Only act on ministry churches

            const after = change.after.exists ? change.after.data() : null;
            const before = change.before.exists ? change.before.data() : null;

            // Skip if this is a sync from default (avoid loops)
            if (after && after.syncOrigin === 'default') return;

            // Find the original default church for this member
            const syncedFrom = after?.syncedFrom || before?.syncedFrom;
            if (!syncedFrom || !syncedFrom.churchId) return;

            const defaultChurchId = syncedFrom.churchId;
            const defaultMemberRef = db.doc(`churches/${defaultChurchId}/members/${memberId}`);

            // If deleted in ministry, don't delete in default (ministry is just a view)
            if (!after) return;

            // Sync back specific fields that can be updated in ministry mode
            const allowedFields = ['ministry', 'firstName', 'lastName', 'phoneNumber', 'profilePicture'];
            const updatePayload = {};
            let hasUpdates = false;

            for (const field of allowedFields) {
              if (after[field] !== undefined) {
                updatePayload[field] = after[field];
                hasUpdates = true;
              }
            }

            if (hasUpdates) {
              updatePayload.lastUpdated = new Date().toISOString();
              updatePayload.syncedFromMinistry = {
                churchId: churchId,
                at: new Date().toISOString()
              };

              await defaultMemberRef.set(updatePayload, { merge: true });
            }
          } catch (e) {
            console.error('syncMinistryToDefault failed', churchId, memberId, e);
          }
        });

      // Cross-ministry aggregation: when a new ministry account is created, sync all relevant members
      exports.onMinistryAccountCreated = functions.firestore
        .document('users/{userId}')
        .onWrite(async (change, context) => {
          const { userId } = context.params;
          const db = admin.firestore();
          try {
            const after = change.after.exists ? change.after.data() : null;
            const before = change.before.exists ? change.before.data() : null;

            // Check if this is a new ministry account or ministry was just added
            const isNewMinistryAccount = after && after.isMinistryAccount &&
              (!before || !before.isMinistryAccount);
            const ministryChanged = after && before &&
              after.preferences?.ministryName !== before.preferences?.ministryName;

            if (!isNewMinistryAccount && !ministryChanged) return;

            const ministryName = after.preferences?.ministryName;
            if (!ministryName) return;

            const ministryChurchId = after.contexts?.ministryChurchId || after.churchId;
            if (!ministryChurchId) return;

            // Find all members across all default churches with this ministry
            const allChurches = await db.collection('churches').get();
            let synced = 0;

            for (const churchDoc of allChurches.docs) {
              const churchData = churchDoc.data() || {};
              const ownerId = churchData.ownerId;
              if (!ownerId) continue;

              // Check if this is a default church (not ministry)
              const ownerDoc = await db.doc(`users/${ownerId}`).get();
              if (!ownerDoc.exists) continue;

              const ownerData = ownerDoc.data() || {};
              if (ownerData.isMinistryAccount) continue; // Skip ministry churches

              // Get members with matching ministry from this church
              const membersQuery = db.collection(`churches/${churchDoc.id}/members`)
                .where('ministry', '==', ministryName)
                .where('isActive', '!=', false);

              const membersSnap = await membersQuery.get();

              for (const memberDoc of membersSnap.docs) {
                const memberData = memberDoc.data();
                const targetRef = db.doc(`churches/${ministryChurchId}/members/${memberDoc.id}`);
                const payload = {
                  ...memberData,
                  bacentaId: '', // Detach from bacenta structure in ministry context
                  syncedFrom: {
                    churchId: churchDoc.id,
                    at: new Date().toISOString()
                  },
                  syncOrigin: 'default'
                };

                await targetRef.set(payload, { merge: true });
                synced++;
              }
            }

            console.log(`Synced ${synced} members to new ministry account for ${ministryName}`);
          } catch (e) {
            console.error('onMinistryAccountCreated failed', userId, e);
          }
        });

      // Cross-ministry sync callable function
      exports.crossMinistrySync = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
          throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
        }
        const uid = context.auth.uid;
        const { ministryName } = data || {};
        const db = admin.firestore();

        try {
          const userSnap = await db.doc(`users/${uid}`).get();
          if (!userSnap.exists) {
            throw new functions.https.HttpsError('failed-precondition', 'User profile not found');
          }
          const user = userSnap.data() || {};
          if (!user.isMinistryAccount) {
            throw new functions.https.HttpsError('failed-precondition', 'User is not a ministry account');
          }

          const targetMinistry = ministryName || user.preferences?.ministryName;
          if (!targetMinistry) {
            throw new functions.https.HttpsError('failed-precondition', 'No ministry specified');
          }

          const ministryChurchId = user.contexts?.ministryChurchId || user.churchId;
          if (!ministryChurchId) {
            throw new functions.https.HttpsError('failed-precondition', 'No ministry church found');
          }

          // Find all churches and sync members with matching ministry
          const allChurches = await db.collection('churches').get();
          let synced = 0;

          for (const churchDoc of allChurches.docs) {
            const churchData = churchDoc.data() || {};
            const ownerId = churchData.ownerId;
            if (!ownerId) continue;

            // Check if this is a default church (not ministry)
            const ownerDoc = await db.doc(`users/${ownerId}`).get();
            if (!ownerDoc.exists) continue;

            const ownerData = ownerDoc.data() || {};
            if (ownerData.isMinistryAccount) continue; // Skip ministry churches

            // Get members with matching ministry from this church
            const membersQuery = db.collection(`churches/${churchDoc.id}/members`)
              .where('ministry', '==', targetMinistry)
              .where('isActive', '!=', false);

            const membersSnap = await membersQuery.get();

            const batch = db.batch();
            let batchCount = 0;

            for (const memberDoc of membersSnap.docs) {
              const memberData = memberDoc.data();
              const targetRef = db.doc(`churches/${ministryChurchId}/members/${memberDoc.id}`);
              const payload = {
                ...memberData,
                bacentaId: '', // Detach from bacenta structure in ministry context
                syncedFrom: {
                  churchId: churchDoc.id,
                  at: new Date().toISOString()
                },
                syncOrigin: 'default'
              };

              batch.set(targetRef, payload, { merge: true });
              batchCount++;
              synced++;

              // Commit in chunks to respect Firestore limits
              if (batchCount >= 450) {
                await batch.commit();
                batchCount = 0;
              }
            }

            if (batchCount > 0) {
              await batch.commit();
            }
          }

          return { success: true, synced };
        } catch (e) {
          console.error('crossMinistrySync failed', e);
          throw new functions.https.HttpsError('internal', e?.message || 'Cross-ministry sync failed');
        }
      });

      // HTTP version of crossMinistrySync for CORS support
      exports.crossMinistrySyncHttp = functions.https.onRequest(async (req, res) => {
        setCors(req, res);
        if (req.method === 'OPTIONS') {
          return res.status(204).send('');
        }
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }

        try {
          // Extract auth token
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
          }

          const token = authHeader.split('Bearer ')[1];
          const decodedToken = await admin.auth().verifyIdToken(token);
          const uid = decodedToken.uid;

          const { ministryName } = req.body || {};
          const db = admin.firestore();

          const userSnap = await db.doc(`users/${uid}`).get();
          if (!userSnap.exists) {
            return res.status(400).json({ success: false, error: 'User profile not found' });
          }
          const user = userSnap.data() || {};
          if (!user.isMinistryAccount) {
            return res.status(400).json({ success: false, error: 'User is not a ministry account' });
          }

          const targetMinistry = ministryName || user.preferences?.ministryName;
          if (!targetMinistry) {
            return res.status(400).json({ success: false, error: 'No ministry specified' });
          }

          const ministryChurchId = user.contexts?.ministryChurchId || user.churchId;
          if (!ministryChurchId) {
            return res.status(400).json({ success: false, error: 'No ministry church found' });
          }

          // Find all churches and sync members with matching ministry
          const allChurches = await db.collection('churches').get();
          let synced = 0;

          for (const churchDoc of allChurches.docs) {
            const churchData = churchDoc.data() || {};
            const ownerId = churchData.ownerId;
            if (!ownerId) continue;

            // Check if this is a default church (not ministry)
            const ownerDoc = await db.doc(`users/${ownerId}`).get();
            if (!ownerDoc.exists) continue;

            const ownerData = ownerDoc.data() || {};
            if (ownerData.isMinistryAccount) continue; // Skip ministry churches

            // Get members with matching ministry from this church
            const membersQuery = db.collection(`churches/${churchDoc.id}/members`)
              .where('ministry', '==', targetMinistry)
              .where('isActive', '!=', false);

            const membersSnap = await membersQuery.get();

            const batch = db.batch();
            let batchCount = 0;

            for (const memberDoc of membersSnap.docs) {
              const memberData = memberDoc.data();
              const targetRef = db.doc(`churches/${ministryChurchId}/members/${memberDoc.id}`);
              const payload = {
                ...memberData,
                bacentaId: '', // Detach from bacenta structure in ministry context
                syncedFrom: {
                  churchId: churchDoc.id,
                  at: new Date().toISOString()
                },
                syncOrigin: 'default'
              };

              batch.set(targetRef, payload, { merge: true });
              batchCount++;
              synced++;

              // Commit in chunks to respect Firestore limits
              if (batchCount >= 450) {
                await batch.commit();
                batchCount = 0;
              }
            }

            if (batchCount > 0) {
              await batch.commit();
            }
          }

          return res.status(200).json({ success: true, synced });
        } catch (e) {
          console.error('crossMinistrySyncHttp failed', e);
          return res.status(500).json({ success: false, error: e?.message || 'Cross-ministry sync failed' });
        }
      });

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

// Auto-mark prayer "Missed" at 06:01 local time for each church
// Runs every 5 minutes in UTC and gates by per-church timezone and local time window around 06:01
exports.autoMarkPrayerMissed = functions.pubsub.schedule('*/1 * * * *')
  .timeZone('UTC')
  .onRun(async () => {
    const db = admin.firestore();

    // Fetch all churches
    const churchesSnap = await db.collection('churches').get();
    if (churchesSnap.empty) return null;

    const nowUtc = new Date();

  // Helper to get local HH:mm and YYYY-MM-DD for a given tz
    const getLocalParts = (tz) => {
      const timeFmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const dateFmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const weekdayFmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short'
      });

      const timeParts = timeFmt.formatToParts(nowUtc);
      const hh = parseInt(timeParts.find(p => p.type === 'hour')?.value || '0', 10);
      const mm = parseInt(timeParts.find(p => p.type === 'minute')?.value || '0', 10);
      const hhmm = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

      // en-CA yields YYYY-MM-DD
      const ymd = dateFmt.format(nowUtc);
      const weekday = weekdayFmt.format(nowUtc); // e.g., Mon, Tue

      return { hh, mm, hhmm, ymd, weekday };
    };

    // Check if a given weekday is a prayer day (Tue–Sun). Monday is not.
    const isPrayerDay = (wk) => wk !== 'Mon';

    // Returns session end time (in minutes after midnight) for a weekday short name
    // Tue/Fri: 06:30 (390); Wed/Thu: 06:00 (360); Sat/Sun: 07:00 (420)
    const getSessionEndMinutes = (wk) => {
      if (wk === 'Tue' || wk === 'Fri') return 390;
      if (wk === 'Wed' || wk === 'Thu') return 360;
      if (wk === 'Sat' || wk === 'Sun') return 420;
      return null; // Monday or unknown
    };

    const minutesToHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

    for (const churchDoc of churchesSnap.docs) {
      const church = churchDoc.data() || {};
      // Prefer explicit timezone; default to Africa/Johannesburg if not set, else UTC
      const tz = church.settings?.timezone
        || church.settings?.notificationSettings?.timezone
        || 'Africa/Johannesburg';

      const { hh, mm, hhmm, ymd, weekday } = getLocalParts(tz);

  // Gate by prayer day and session end + 1 minute window (end+1 .. end+5)
  if (!isPrayerDay(weekday)) continue;
  const endMins = getSessionEndMinutes(weekday);
  if (endMins == null) continue;
  const localMins = hh * 60 + mm;
  const sinceEndPlusOne = localMins - (endMins + 1);
  if (sinceEndPlusOne < 0 || sinceEndPlusOne > 4) continue;

      try {
        const churchId = churchDoc.id;

        // Optional kill switch: settings.prayer?.autoMarkMissedEnabled === false
        if (church.settings?.prayer && church.settings.prayer.autoMarkMissedEnabled === false) {
          console.log(`[autoMarkPrayerMissed] Skipping church ${churchId}: disabled in settings`);
          continue;
        }

  // Idempotency lock: skip if already processed for this church and date
  const lockRef = db.doc(`churches/${churchId}/locks/autoPrayerMissed_${ymd}`);
        const lockSnap = await lockRef.get();
        if (lockSnap.exists) {
          console.log(`[autoMarkPrayerMissed] ${churchId} ${ymd} – already processed, skipping`);
          continue;
        }

        // Fetch active, non-frozen members
        const membersQuery = db
          .collection(`churches/${churchId}/members`)
          .where('isActive', '!=', false);
        const membersSnap = await membersQuery.get();
        if (membersSnap.empty) continue;

        const members = membersSnap.docs
          .map(d => ({ id: d.id, ...(d.data() || {}) }))
          .filter(m => m.frozen !== true);

        if (!members.length) continue;

        // Fetch prayer records already set for local date
        const prayersSnap = await db
          .collection(`churches/${churchId}/prayers`)
          .where('date', '==', ymd)
          .get();

        const statusByMember = new Map();
        prayersSnap.forEach(doc => {
          const r = doc.data() || {};
          if (r.memberId && r.status) statusByMember.set(r.memberId, r.status);
        });

        // Prepare writes for members who are NOT marked 'Prayed' yet
        const toMark = members.filter(m => statusByMember.get(m.id) !== 'Prayed');
        if (!toMark.length) {
          console.log(`[autoMarkPrayerMissed] ${churchId} ${ymd} – nothing to mark (time ${hhmm} ${tz})`);
          continue;
        }

        // Batch in chunks of 450
        const chunks = [];
        for (let i = 0; i < toMark.length; i += 450) {
          chunks.push(toMark.slice(i, i + 450));
        }

        let totalSet = 0;
        for (const chunk of chunks) {
          const batch = db.batch();
          chunk.forEach(m => {
            const id = `${m.id}_${ymd}`;
            const ref = db.doc(`churches/${churchId}/prayers/${id}`);
            batch.set(ref, {
              id,
              memberId: m.id,
              date: ymd,
              status: 'Missed',
              recordedAt: admin.firestore.FieldValue.serverTimestamp(),
              recordedBy: 'system:auto-miss@06:01'
            }, { merge: true });
          });
          await batch.commit();
          totalSet += chunk.length;
        }

        console.log(`[autoMarkPrayerMissed] ${churchId} ${ymd} – marked Missed for ${totalSet}/${toMark.length} members (local ${hhmm} ${tz}, session end ${minutesToHHMM(endMins)})`);

        // Write lock
        await lockRef.set({
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          sessionEndLocal: minutesToHHMM(endMins),
          windowStartLocal: minutesToHHMM(endMins + 1),
          windowEndLocal: minutesToHHMM(endMins + 5),
          tz
        }, { merge: true });
      } catch (err) {
        console.error('[autoMarkPrayerMissed] Error processing church', churchDoc.id, err);
      }
    }

    return null;
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

// CORS-enabled HTTPS endpoint alternative for backfill (useful for localhost dev)
exports.backfillMinistrySyncHttp = functions.https.onRequest(async (req, res) => {
  // Standardized CORS handling
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/Bearer\s+(.*)$/i);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Missing Authorization Bearer token' });
    }
    const idToken = match[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const db = admin.firestore();
    const userSnap = await db.doc(`users/${uid}`).get();
    if (!userSnap.exists) {
      return res.status(412).json({ success: false, error: 'User profile not found' });
    }
    const user = userSnap.data() || {};
    const ctx = (user && user.contexts) || {};
    const defaultChurchId = ctx.defaultChurchId || user.churchId;
    const ministryChurchId = ctx.ministryChurchId;
    if (!defaultChurchId || !ministryChurchId) {
      return res.status(412).json({ success: false, error: 'User does not have both default and ministry churches' });
    }

    const membersSnap = await db.collection('churches').doc(defaultChurchId).collection('members').get();
    let batch = db.batch();
    let writes = 0;
    let synced = 0;
    for (const docSnap of membersSnap.docs) {
      const m = docSnap.data() || {};
      const hasMinistry = typeof m.ministry === 'string' && m.ministry.trim() !== '';
      const isActive = m.isActive !== false;
      if (!hasMinistry || !isActive) continue;
      const targetRef = db.doc(`churches/${ministryChurchId}/members/${docSnap.id}`);
      const payload = { ...m, bacentaId: '', syncedFrom: { churchId: defaultChurchId, at: new Date().toISOString() }, syncOrigin: 'default' };
      batch.set(targetRef, payload, { merge: true });
      writes++; synced++;
      if (writes >= 450) {
        await batch.commit();
        batch = db.batch();
        writes = 0;
      }
    }
    if (writes > 0) {
      await batch.commit();
    }
    return res.status(200).json({ success: true, synced });
  } catch (e) {
    console.error('backfillMinistrySyncHttp failed', e);
    return res.status(500).json({ success: false, error: e?.message || 'Backfill failed' });
  }
});

// ----- Account administration: activate/deactivate/hard-delete users -----
// Caller must be authenticated and have role 'admin' in users/{callerUid}
exports.setUserActiveStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  const { uid, active } = data || {};
  if (!uid || typeof active !== 'boolean') {
    throw new functions.https.HttpsError('invalid-argument', 'uid and active(boolean) are required');
  }
  const db = admin.firestore();
  // Permission check
  const callerSnap = await db.doc(`users/${context.auth.uid}`).get();
  const callerRole = callerSnap.exists ? (callerSnap.data().role || '') : '';
  if (callerRole !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can change account status');
  }
  // Update Firestore user profile
  const updates = {
    isActive: !!active,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    ...(active ? { reactivatedAt: admin.firestore.FieldValue.serverTimestamp() } : { deactivatedAt: admin.firestore.FieldValue.serverTimestamp(), isDeleted: false })
  };
  await db.doc(`users/${uid}`).set(updates, { merge: true });
  // Update Auth disabled flag and revoke tokens if deactivating
  await admin.auth().updateUser(uid, { disabled: !active });
  if (!active) {
    try { await admin.auth().revokeRefreshTokens(uid); } catch {}
  }
  return { success: true };
});

exports.hardDeleteUserAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  const { uid } = data || {};
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'uid is required');
  }
  const db = admin.firestore();
  // Permission check
  const callerSnap = await db.doc(`users/${context.auth.uid}`).get();
  const callerRole = callerSnap.exists ? (callerSnap.data().role || '') : '';
  if (callerRole !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can delete accounts');
  }

  // Fetch basic user doc for cleanup context
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? (userSnap.data() || {}) : {};

  // Best-effort cleanup in parallel
  const batchDeletes = [];
  try {
    // Cross-tenant links/invites
    const linksSnap = await db.collection('crossTenantAccessLinks').where('viewerUid', '==', uid).get();
    linksSnap.forEach(d => batchDeletes.push(d.ref.delete()));
    const linksSnap2 = await db.collection('crossTenantAccessLinks').where('ownerUid', '==', uid).get();
    linksSnap2.forEach(d => batchDeletes.push(d.ref.delete()));
    const invitesFrom = await db.collection('crossTenantInvites').where('fromAdminUid', '==', uid).get();
    invitesFrom.forEach(d => batchDeletes.push(d.ref.delete()));
    const invitesTo = await db.collection('crossTenantInvites').where('toAdminUid', '==', uid).get();
    invitesTo.forEach(d => batchDeletes.push(d.ref.delete()));

    // Ministry access requests
    const reqs = await db.collection('ministryAccessRequests').where('requesterUid', '==', uid).get();
    reqs.forEach(d => batchDeletes.push(d.ref.delete()));

    // Super admin notifications referencing this requester
    try {
      const san = await db.collection('superAdminNotifications').where('requesterUid', '==', uid).get();
      san.forEach(d => batchDeletes.push(d.ref.delete()));
    } catch {}

    // Device tokens across all churches
    const tokenGroup = await db.collectionGroup('deviceTokens').where('userId', '==', uid).get();
    tokenGroup.forEach(d => batchDeletes.push(d.ref.delete()));

    // Admin notifications targeted to this user across churches
    try {
      const notifGroup = await db.collectionGroup('notifications').where('adminId', '==', uid).get();
      notifGroup.forEach(d => batchDeletes.push(d.ref.delete()));
    } catch {}

  } catch (cleanupErr) {
    console.warn('Partial cleanup errors during hard delete', cleanupErr);
  }

  // Delete Firestore user profile
  if (userSnap.exists) {
    batchDeletes.push(userRef.delete());
  }

  await Promise.all(batchDeletes).catch(err => console.warn('Cleanup promises error', err));

  // Finally remove Auth account and revoke tokens
  try {
    await admin.auth().deleteUser(uid);
  } catch (e) {
    console.error('Failed deleting auth user', uid, e);
    throw new functions.https.HttpsError('internal', 'Failed to delete authentication user');
  }

  return { success: true, deletedUid: uid };
});



// Chat message trigger: update thread metadata, unread counts, and push to recipients
exports.onMessageCreated = functions.firestore
  .document('churches/{churchId}/chatThreads/{threadId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const { churchId, threadId } = context.params;
    const data = snap.data() || {};
    const senderId = data.senderId;
    const text = (data.text || '').toString();

    const db = admin.firestore();
    const threadRef = db.doc(`churches/${churchId}/chatThreads/${threadId}`);
    const threadSnap = await threadRef.get();
    if (!threadSnap.exists) return;
    const thread = threadSnap.data() || {};
    const participants = Array.isArray(thread.participants) ? thread.participants : [];

    // Update thread metadata and unread counts
    const updates = {
      lastMessage: { text: text.slice(0, 500), senderId, at: admin.firestore.FieldValue.serverTimestamp() },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    participants.forEach((uid) => {
      if (uid !== senderId) {
        updates[`unreadCounts.${uid}`] = admin.firestore.FieldValue.increment(1);
      }
    });
    await threadRef.set(updates, { merge: true });

    // Send FCM push to recipients (for up to 10 users per query limitation)
    try {
      const recipients = participants.filter((p) => p !== senderId).slice(0, 10);
      if (recipients.length === 0) return;

      const tokensSnap = await db
        .collection(`churches/${churchId}/deviceTokens`)
        .where('userId', 'in', recipients)
        .where('isActive', '==', true)
        .get();

      const tokens = tokensSnap.docs.map((d) => (d.data() || {}).id).filter(Boolean);
      if (tokens.length === 0) return;

      const senderName = (thread.participantProfiles && thread.participantProfiles[senderId]?.name) || 'New message';
      const title = thread.type === 'group' ? (thread.name || 'Group') : senderName;
      const body = thread.type === 'group' ? `${senderName}: ${text}` : text;

      await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title, body: body.slice(0, 180) },
        data: { deepLink: `/chat/${threadId}`, threadId },
        android: { priority: 'high', notification: { channelId: 'sat_mobile_notifications', sound: 'default' } },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      });
    } catch (e) {
      console.error('Chat push send failed', e);
    }
  });
