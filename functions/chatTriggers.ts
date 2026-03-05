// Cloud Functions triggers for chat messages
// - Update thread metadata (lastMessage, updatedAt)
// - Increment unread counts for recipients
// - Send push notifications via device tokens

// Using JS to match existing functions/index.js style would require wiring export. Here we provide TS form for future consolidation.

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const onMessageCreated = functions.firestore
  .document('churches/{churchId}/chatThreads/{threadId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const { churchId, threadId } = context.params as any;
    const data = snap.data() as any;
    const senderId: string = data.senderId;
    const text: string = data.text || '';

    const threadRef = admin.firestore().doc(`churches/${churchId}/chatThreads/${threadId}`);
    const threadSnap = await threadRef.get();
    if (!threadSnap.exists) return;
    const thread = threadSnap.data() || {};
    const participants: string[] = thread.participants || [];

    // Update thread metadata
    const updates: any = {
      lastMessage: { text: text.slice(0, 500), senderId, at: admin.firestore.FieldValue.serverTimestamp() },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Increment unread counts for recipients
    participants.forEach(uid => {
      if (uid !== senderId) {
        updates[`unreadCounts.${uid}`] = admin.firestore.FieldValue.increment(1);
      }
    });

    await threadRef.set(updates, { merge: true });

    // Send push to recipients
    try {
      // Fetch active device tokens for recipients
      const tokensSnap = await admin.firestore()
        .collection(`churches/${churchId}/deviceTokens`)
        .where('userId', 'in', participants.filter(p => p !== senderId).slice(0, 10))
        .where('isActive', '==', true)
        .get();

      const tokens = tokensSnap.docs.map(d => (d.data() as any).id).filter(Boolean);
      if (tokens.length === 0) return;

      const senderName = (thread.participantProfiles?.[senderId]?.name) || 'New message';
      const title = thread.type === 'group' ? (thread.name || 'Group') : senderName;
      const body = thread.type === 'group' ? `${senderName}: ${text}` : text;

      await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title, body: body.slice(0, 180) },
        data: { deepLink: `/chat/${threadId}`, threadId },
        android: { priority: 'high', notification: { channelId: 'sat_mobile_notifications', sound: 'default' } },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      } as any);
    } catch (e) {
      console.error('Chat push send failed', e);
    }
  });

