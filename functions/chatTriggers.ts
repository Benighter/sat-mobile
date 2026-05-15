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

const getSenderName = (message: any, thread: any, senderId: string): string => {
  return message.senderName || thread.participantProfiles?.[senderId]?.name || 'New message';
};

const getMessagePreview = (message: any): string => {
  const text = (message.text || '').toString().trim();
  if (text) return text;
  if (Array.isArray(message.attachments) && message.attachments.length > 0) return 'Photo';
  return 'New message';
};

const getCandidateChurchIds = (user: any, fallbackChurchId?: string): string[] => {
  return Array.from(new Set([
    user?.churchId,
    user?.contexts?.defaultChurchId,
    user?.contexts?.ministryChurchId,
    fallbackChurchId,
  ].filter(Boolean)));
};

const getActiveDeviceTokensForRecipients = async (
  db: FirebaseFirestore.Firestore,
  recipientIds: string[],
  fallbackChurchId?: string
): Promise<string[]> => {
  const tokens = new Set<string>();

  await Promise.all(recipientIds.map(async (recipientId) => {
    const userSnap = await db.doc(`users/${recipientId}`).get();
    const user = userSnap.exists ? userSnap.data() : null;
    const candidateChurchIds = getCandidateChurchIds(user, fallbackChurchId);

    await Promise.all(candidateChurchIds.map(async (churchId) => {
      const tokenSnap = await db
        .collection(`churches/${churchId}/deviceTokens`)
        .where('userId', '==', recipientId)
        .where('isActive', '==', true)
        .get();

      tokenSnap.docs.forEach(tokenDoc => {
        const token = (tokenDoc.data() as any).id || tokenDoc.id;
        if (token) tokens.add(token);
      });
    }));
  }));

  return Array.from(tokens);
};

const handleChatMessageCreated = async (
  snap: FirebaseFirestore.QueryDocumentSnapshot,
  threadRef: FirebaseFirestore.DocumentReference,
  threadId: string,
  fallbackChurchId?: string
) => {
  const data = snap.data() as any;
  const senderId: string = data.senderId;
  const preview = getMessagePreview(data);

  const threadSnap = await threadRef.get();
  if (!threadSnap.exists) return;
  const thread = threadSnap.data() || {};
  const participants: string[] = thread.participants || [];
  const recipients = participants.filter(uid => uid !== senderId);

  const senderName = getSenderName(data, thread, senderId);

  const updates: any = {
    lastMessage: {
      text: preview.slice(0, 500),
      senderId,
      senderName,
      at: admin.firestore.FieldValue.serverTimestamp()
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  recipients.forEach(uid => {
    updates[`unreadCounts.${uid}`] = admin.firestore.FieldValue.increment(1);
  });

  await threadRef.set(updates, { merge: true });

  try {
    if (recipients.length === 0) return;

    const db = admin.firestore();
    const tokens = await getActiveDeviceTokensForRecipients(db, recipients, fallbackChurchId);
    if (tokens.length === 0) return;

    const title = thread.type === 'group' ? (thread.name || 'Group chat') : senderName;
    const body = thread.type === 'group' ? `${senderName}: ${preview}` : preview;

    await admin.messaging().sendEachForMulticast({
      tokens: tokens.slice(0, 500),
      notification: { title, body: body.slice(0, 180) },
      data: { deepLink: `/chat/${threadId}`, threadId, activityType: 'chat_message' },
      android: { priority: 'high', notification: { channelId: 'sat_mobile_notifications', sound: 'default' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    } as any);
  } catch (error) {
    console.error('Chat push send failed', error);
  }
};

export const onMessageCreated = functions.firestore
  .document('churches/{churchId}/chatThreads/{threadId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const { churchId, threadId } = context.params as any;
    const threadRef = admin.firestore().doc(`churches/${churchId}/chatThreads/${threadId}`);
    await handleChatMessageCreated(snap, threadRef, threadId, churchId);
  });

export const onGlobalMessageCreated = functions.firestore
  .document('chatThreads/{threadId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const { threadId } = context.params as any;
    const threadRef = admin.firestore().doc(`chatThreads/${threadId}`);
    await handleChatMessageCreated(snap, threadRef, threadId);
  });

