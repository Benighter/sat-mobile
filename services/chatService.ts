// Chat service for real-time messaging using Firestore (no CORS required)
// Provides helpers to create threads, list threads, subscribe to messages, and send messages

import { addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, Timestamp, Unsubscribe, updateDoc, where, writeBatch, deleteDoc, limit, startAfter } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, storage } from '../firebase.config';
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
  archived?: boolean; // soft-archive flag
  deletedBy?: Record<string, boolean>; // per-user soft-delete (hide for that user)
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  attachments?: Array<{ type: 'image' | 'file'; url: string; name?: string; size?: number }>;
  createdAt: any;
  // Client-only flags (not stored) to help the UI display message state
  _pending?: boolean; // true if write hasn't been committed to server yet (offline/optimistic)
  _fromCache?: boolean; // snapshot came from local cache
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
      // Filter out per-user deleted threads and optionally archived; keep both and let UI choose view
      const visible = items.filter(t => !(t.deletedBy && t.deletedBy[uid]));
      // Client-side sort to avoid composite index requirement
      visible.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
      callback(visible);
    });
  },

  onMessages(threadId: string, callback: (messages: ChatMessage[]) => void): Unsubscribe {
    const churchId = firebaseUtils.getCurrentChurchId();
    if (!churchId) throw new Error('No church context');
    const q = query(
      collection(db, `${threadsPath(churchId)}/${threadId}/messages`),
      orderBy('createdAt', 'asc')
    );
    // Include metadata so we can expose pending writes to the UI (to show a single tick for "sent/offline")
    return onSnapshot(q, { includeMetadataChanges: true } as any, (snap: any) => {
      const items = snap.docs.map((d: any) => ({
        id: d.id,
        ...(d.data() as any),
        _pending: d.metadata.hasPendingWrites,
        _fromCache: d.metadata.fromCache,
      })) as ChatMessage[];
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

  /**
   * Upload an image (File/Blob) to Firebase Storage and send as a chat message with attachment metadata.
   * Returns the download URL.
   */
  async sendImageMessage(threadId: string, file: File | Blob, senderId: string, options?: { caption?: string }): Promise<string> {
    const churchId = firebaseUtils.getCurrentChurchId();
    if (!churchId) throw new Error('No church context');
    if (!file) throw new Error('No file provided');

    const ext = (file instanceof File && file.name.split('.').pop()) || 'jpg';
    const path = `chat/${churchId}/${threadId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const storageRef = ref(storage, path);
    let url: string | null = null;
    try {
      await uploadBytes(storageRef, file);
      url = await getDownloadURL(storageRef);
    } catch (directErr) {
      // Fallback: use callable relay if direct upload fails (e.g., corporate proxy/CORS)
      try {
        const arrayBuf = await file.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
        const functions = getFunctions(undefined as any, 'us-central1');
        const relay = httpsCallable<any, { url: string }>(functions as any, 'relayUploadChatImage');
        const res = await relay({ threadId, churchId, data: b64, mimeType: (file as any).type || 'image/jpeg', caption: options?.caption || '' });
        url = res.data?.url;
      } catch (relayErr) {
        console.error('Direct + relay upload both failed', relayErr);
        throw directErr; // surface original error for context
      }
    }
    if (!url) throw new Error('Upload failed');

    const msgRef = collection(db, `${threadsPath(churchId)}/${threadId}/messages`);
    const caption = options?.caption || '';
    await addDoc(msgRef, {
      senderId,
      text: caption, // keep caption in text for backwards compatibility
      attachments: [
        { type: 'image', url, name: (file as any).name || undefined, size: (file as any).size || undefined }
      ],
      createdAt: serverTimestamp()
    });

    // Optimistic thread metadata update (Cloud Function will also handle)
    try {
      const threadRef = doc(db, `${threadsPath(churchId)}/${threadId}`);
      const short = caption || '📷 Photo';
      await updateDoc(threadRef, {
        lastMessage: { text: short.slice(0, 120), senderId, at: serverTimestamp() },
        updatedAt: serverTimestamp(),
      });
    } catch {}
  return url;
  },

  async markThreadRead(threadId: string, uid: string): Promise<void> {
    const churchId = firebaseUtils.getCurrentChurchId();
    if (!churchId) throw new Error('No church context');
    const ref = doc(db, `${threadsPath(churchId)}/${threadId}`);
    await updateDoc(ref, {
      [`unreadCounts.${uid}`]: 0,
      [`lastReadAt.${uid}`]: serverTimestamp()
    });
  },

  async archiveThread(threadId: string): Promise<void> {
    const churchId = firebaseUtils.getCurrentChurchId();
    if (!churchId) throw new Error('No church context');
    const ref = doc(db, `${threadsPath(churchId)}/${threadId}`);
    await updateDoc(ref, { archived: true, updatedAt: serverTimestamp() });
  },

  async unarchiveThread(threadId: string): Promise<void> {
    const churchId = firebaseUtils.getCurrentChurchId();
    if (!churchId) throw new Error('No church context');
    const ref = doc(db, `${threadsPath(churchId)}/${threadId}`);
    await updateDoc(ref, { archived: false, updatedAt: serverTimestamp() });
  },

  // Soft delete per-user: hide the thread for this user, but keep data for others
  async softDeleteForUser(threadId: string, uid: string): Promise<void> {
    const churchId = firebaseUtils.getCurrentChurchId();
    if (!churchId) throw new Error('No church context');
    const ref = doc(db, `${threadsPath(churchId)}/${threadId}`);
    await updateDoc(ref, { [`deletedBy.${uid}`]: true, updatedAt: serverTimestamp() });
  },

  // Hard delete: remove thread and all its messages. Use with caution.
  async hardDeleteThread(threadId: string): Promise<void> {
    const churchId = firebaseUtils.getCurrentChurchId();
    if (!churchId) throw new Error('No church context');
    const basePath = `${threadsPath(churchId)}/${threadId}`;

    // Delete messages in batches
    let lastDoc: any = null;
    while (true) {
      const q = lastDoc
        ? query(collection(db, `${basePath}/messages`), orderBy('createdAt'), startAfter(lastDoc), limit(200))
        : query(collection(db, `${basePath}/messages`), orderBy('createdAt'), limit(200));
      const snap = await getDocs(q);
      if (snap.empty) break;
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      lastDoc = snap.docs[snap.docs.length - 1];
    }

    // Delete the thread
    await deleteDoc(doc(db, basePath));
  }
};

