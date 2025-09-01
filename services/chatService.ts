// Chat service for real-time messaging using Firestore (no CORS required)
// Provides helpers to create threads, list threads, subscribe to messages, and send messages

import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, Timestamp, Unsubscribe, updateDoc, where, writeBatch, increment } from 'firebase/firestore';
import { db } from '../firebase.config';
import { firebaseUtils } from './firebaseService';
import type { User } from '../types';

export type ChatThreadType = 'dm' | 'group';

export interface ChatThread {
  id: string;
  type: ChatThreadType;
  participants: string[]; // user UIDs
  participantProfiles?: Record<string, { name: string; photoUrl?: string }>;
  name?: string | null; // for group chats
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  lastMessage?: { text: string; senderId: string; at: any } | null;
  unreadCounts?: Record<string, number>;
  lastReadAt?: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  attachments?: Array<{ type: 'image' | 'file'; url: string; name?: string; size?: number }>;
  createdAt: any;
}

const threadsPath = (churchId: string) => `churches/${churchId}/chatThreads`;

export const chatService = {
  async createDirectThread(partnerId: string, currentUser: User): Promise<string> {
    const churchId = firebaseUtils.getCurrentChurchId();
    if (!churchId) throw new Error('No church context');

    // Idempotent: try to find existing DM with the same two participants
    const q = query(
      collection(db, threadsPath(churchId)),
      where('type', '==', 'dm'),
      where('participants', 'array-contains', currentUser.uid)
    );
    const snap = await getDocs(q);
    const found = snap.docs.find(d => {
      const parts = (d.data().participants || []) as string[];
      return parts.length === 2 && parts.includes(partnerId);
    });
    if (found) return found.id;

    const docRef = await addDoc(collection(db, threadsPath(churchId)), {
      type: 'dm',
      participants: [currentUser.uid, partnerId],
      participantProfiles: {
        [currentUser.uid]: { name: currentUser.displayName },
      },
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: null,
      unreadCounts: { [currentUser.uid]: 0, [partnerId]: 0 },
      lastReadAt: { [currentUser.uid]: Timestamp.now() }
    });
    return docRef.id;
  },

  async createGroupThread(name: string, participantIds: string[], currentUser: User): Promise<string> {
    const churchId = firebaseUtils.getCurrentChurchId();
    if (!churchId) throw new Error('No church context');
    const unique = Array.from(new Set([currentUser.uid, ...participantIds]));
    const docRef = await addDoc(collection(db, threadsPath(churchId)), {
      type: 'group',
      name,
      participants: unique,
      participantProfiles: { [currentUser.uid]: { name: currentUser.displayName } },
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: null,
      unreadCounts: unique.reduce((acc, id) => ({ ...acc, [id]: 0 }), {}),
      lastReadAt: { [currentUser.uid]: Timestamp.now() }
    });
    return docRef.id;
  },

  onThreadsForUser(uid: string, callback: (threads: ChatThread[]) => void): Unsubscribe {
    const churchId = firebaseUtils.getCurrentChurchId();
    if (!churchId) throw new Error('No church context');
    const q = query(
      collection(db, threadsPath(churchId)),
      where('participants', 'array-contains', uid)
    );
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as ChatThread[];
      // Client-side sort to avoid composite index requirement
      items.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
      callback(items);
    });
  },

  onMessages(threadId: string, callback: (messages: ChatMessage[]) => void): Unsubscribe {
    const churchId = firebaseUtils.getCurrentChurchId();
    if (!churchId) throw new Error('No church context');
    const q = query(
      collection(db, `${threadsPath(churchId)}/${threadId}/messages`),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as ChatMessage[];
      callback(items);
    });
  },

  async sendMessage(threadId: string, text: string, senderId: string): Promise<void> {
    const churchId = firebaseUtils.getCurrentChurchId();
    if (!churchId) throw new Error('No church context');
    const msgRef = collection(db, `${threadsPath(churchId)}/${threadId}/messages`);
    await addDoc(msgRef, {
      senderId,
      text,
      createdAt: serverTimestamp()
    });
    // Last message + updatedAt will be updated by Cloud Function trigger for consistency
    // Fallback: update thread metadata client-side so list and badges stay fresh even if CF not deployed
    try {
      const threadRef = doc(db, `${threadsPath(churchId)}/${threadId}`);
      await updateDoc(threadRef, {
        lastMessage: { text, senderId, at: serverTimestamp() },
        updatedAt: serverTimestamp(),
      });
    } catch {}
  },

  async markThreadRead(threadId: string, uid: string): Promise<void> {
    const churchId = firebaseUtils.getCurrentChurchId();
    if (!churchId) throw new Error('No church context');
    const ref = doc(db, `${threadsPath(churchId)}/${threadId}`);
    await updateDoc(ref, {
      [`unreadCounts.${uid}`]: 0,
      [`lastReadAt.${uid}`]: serverTimestamp()
    });
  }
};

