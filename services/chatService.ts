// Chat service for real-time messaging using Firestore (no CORS required)
// Provides helpers to create threads, list threads, subscribe to messages, and send messages

import { addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, Timestamp, Unsubscribe, updateDoc, where, writeBatch, deleteDoc, limit, startAfter } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase.config';
import { firebaseUtils } from './firebaseService';
import type { User } from '../types';
import { ensureFileExtension, uploadMediaToStorage } from './mediaStorageService';

export type ChatThreadType = 'dm' | 'group';
export type ChatThreadScope = 'global' | 'church';

export interface ChatThread {
  id: string;
  type: ChatThreadType;
  scope?: ChatThreadScope;
  churchId?: string | null;
  participants: string[]; // user UIDs
  participantProfiles?: Record<string, { name: string; photoUrl?: string; churchName?: string }>;
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

const GLOBAL_THREADS_PATH = 'chatThreads';
const threadPathCache = new Map<string, string>();
const threadsPath = (churchId: string) => `churches/${churchId}/chatThreads`;
const messagesPath = (threadId: string) => `${threadPathCache.get(threadId) || GLOBAL_THREADS_PATH}/${threadId}/messages`;
const threadDocPath = (threadId: string) => `${threadPathCache.get(threadId) || GLOBAL_THREADS_PATH}/${threadId}`;

const cacheThreadPath = (threadId: string, collectionPath: string) => {
  threadPathCache.set(threadId, collectionPath);
};

const profileForUser = (user: User) => ({
  name: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Member',
  ...(user.profilePicture ? { photoUrl: user.profilePicture } : {}),
  ...(user.churchName ? { churchName: user.churchName } : {})
});

const mapThreadDoc = (docSnapshot: any, collectionPath: string, scope: ChatThreadScope, churchId?: string | null): ChatThread => {
  cacheThreadPath(docSnapshot.id, collectionPath);
  return {
    id: docSnapshot.id,
    ...(docSnapshot.data() as any),
    scope,
    churchId: churchId || null
  } as ChatThread;
};

export const chatService = {
  async createDirectThread(partner: string | User, currentUser: User): Promise<string> {
    const partnerId = typeof partner === 'string' ? partner : partner.uid;
    if (!partnerId) throw new Error('No recipient selected');

    // Idempotent: try to find existing DM with the same two participants
    const q = query(
      collection(db, GLOBAL_THREADS_PATH),
      where('type', '==', 'dm'),
      where('participants', 'array-contains', currentUser.uid)
    );
    const snap = await getDocs(q);
    const found = snap.docs.find(d => {
      const parts = (d.data().participants || []) as string[];
      return parts.length === 2 && parts.includes(partnerId);
    });
    if (found) return found.id;

    const participantProfiles: ChatThread['participantProfiles'] = {
      [currentUser.uid]: profileForUser(currentUser),
    };
    if (typeof partner !== 'string') {
      participantProfiles[partnerId] = profileForUser(partner);
    }

    const docRef = await addDoc(collection(db, GLOBAL_THREADS_PATH), {
      scope: 'global',
      type: 'dm',
      participants: [currentUser.uid, partnerId],
      participantProfiles,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: null,
      unreadCounts: { [currentUser.uid]: 0, [partnerId]: 0 },
      lastReadAt: { [currentUser.uid]: Timestamp.now() }
    });
    cacheThreadPath(docRef.id, GLOBAL_THREADS_PATH);
    return docRef.id;
  },

  async createGroupThread(name: string, participantIds: string[], currentUser: User, participantUsers: User[] = []): Promise<string> {
    const unique = Array.from(new Set([currentUser.uid, ...participantIds]));
    const participantProfiles: ChatThread['participantProfiles'] = {
      [currentUser.uid]: profileForUser(currentUser),
    };
    participantUsers.forEach(user => {
      if (unique.includes(user.uid)) {
        participantProfiles[user.uid] = profileForUser(user);
      }
    });

    const docRef = await addDoc(collection(db, GLOBAL_THREADS_PATH), {
      scope: 'global',
      type: 'group',
      name,
      participants: unique,
      participantProfiles,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: null,
      unreadCounts: unique.reduce((acc, id) => ({ ...acc, [id]: 0 }), {}),
      lastReadAt: { [currentUser.uid]: Timestamp.now() }
    });
    cacheThreadPath(docRef.id, GLOBAL_THREADS_PATH);
    return docRef.id;
  },

  onThreadsForUser(uid: string, callback: (threads: ChatThread[]) => void): Unsubscribe {
    const churchId = firebaseUtils.getCurrentChurchId();
    let globalThreads: ChatThread[] = [];
    let legacyThreads: ChatThread[] = [];
    let globalReady = false;
    let legacyReady = !churchId;

    const emit = () => {
      if (!globalReady || !legacyReady) return;
      const byId = new Map<string, ChatThread>();
      [...legacyThreads, ...globalThreads].forEach(thread => {
        if (!(thread.deletedBy && thread.deletedBy[uid])) {
          byId.set(thread.id, thread);
        }
      });
      const visible = Array.from(byId.values());
      visible.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
      callback(visible);
    };

    const globalQuery = query(
      collection(db, GLOBAL_THREADS_PATH),
      where('participants', 'array-contains', uid)
    );
    const globalUnsub = onSnapshot(globalQuery, (snap) => {
      globalThreads = snap.docs.map(d => mapThreadDoc(d, GLOBAL_THREADS_PATH, 'global'));
      globalReady = true;
      emit();
    }, (error) => {
      console.warn('Failed to subscribe to global chat threads:', error);
      globalReady = true;
      emit();
    });

    let legacyUnsub: Unsubscribe | null = null;
    if (churchId) {
      const legacyCollectionPath = threadsPath(churchId);
      const legacyQuery = query(
        collection(db, legacyCollectionPath),
        where('participants', 'array-contains', uid)
      );
      legacyUnsub = onSnapshot(legacyQuery, (snap) => {
        legacyThreads = snap.docs.map(d => mapThreadDoc(d, legacyCollectionPath, 'church', churchId));
        legacyReady = true;
        emit();
      }, (error) => {
        console.warn('Failed to subscribe to legacy chat threads:', error);
        legacyReady = true;
        emit();
      });
    }

    return () => {
      globalUnsub();
      legacyUnsub?.();
    };
  },

  onMessages(threadId: string, callback: (messages: ChatMessage[]) => void): Unsubscribe {
    const q = query(
      collection(db, messagesPath(threadId)),
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

  async sendMessage(threadId: string, text: string, senderId: string, senderName?: string): Promise<void> {
    const msgRef = collection(db, messagesPath(threadId));
    await addDoc(msgRef, {
      senderId,
      text,
      ...(senderName ? { senderName } : {}),
      createdAt: serverTimestamp()
    });
    // Last message + updatedAt will be updated by Cloud Function trigger for consistency
    // Fallback: update thread metadata client-side so list and badges stay fresh even if CF not deployed
    try {
      const threadRef = doc(db, threadDocPath(threadId));
      await updateDoc(threadRef, {
        lastMessage: { text, senderId, ...(senderName ? { senderName } : {}), at: serverTimestamp() },
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
    if (!file) throw new Error('No file provided');

    const contentType = (file as any).type || 'image/jpeg';
    const fileName = file instanceof File ? file.name : `image-${Date.now()}.jpg`;
    const isGlobalThread = (threadPathCache.get(threadId) || GLOBAL_THREADS_PATH) === GLOBAL_THREADS_PATH;
    const storageScope = isGlobalThread ? 'global' : (churchId || 'legacy');
    const path = `chat/${storageScope}/${threadId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${ensureFileExtension(fileName, contentType)}`;
    let url: string | null = null;
    try {
      const uploaded = await uploadMediaToStorage({
        file,
        storagePath: path,
        contentType,
        cacheControl: 'private,max-age=604800'
      });
      url = uploaded.url;
    } catch (directErr) {
      // Fallback: use callable relay if direct upload fails (e.g., corporate proxy/CORS)
      try {
        const arrayBuf = await file.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
        const functions = getFunctions(undefined as any, 'us-central1');
        const relay = httpsCallable<any, { url: string }>(functions as any, 'relayUploadChatImage');
        const res = await relay({ threadId, churchId: churchId || 'global', scope: isGlobalThread ? 'global' : 'church', data: b64, mimeType: (file as any).type || 'image/jpeg', caption: options?.caption || '' });
        url = res.data?.url;
      } catch (relayErr) {
        console.error('Direct + relay upload both failed', relayErr);
        throw directErr; // surface original error for context
      }
    }
    if (!url) throw new Error('Upload failed');

    const msgRef = collection(db, messagesPath(threadId));
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
      const threadRef = doc(db, threadDocPath(threadId));
      const short = caption || '📷 Photo';
      await updateDoc(threadRef, {
        lastMessage: { text: short.slice(0, 120), senderId, at: serverTimestamp() },
        updatedAt: serverTimestamp(),
      });
    } catch {}
  return url;
  },

  async markThreadRead(threadId: string, uid: string): Promise<void> {
    const ref = doc(db, threadDocPath(threadId));
    await updateDoc(ref, {
      [`unreadCounts.${uid}`]: 0,
      [`lastReadAt.${uid}`]: serverTimestamp()
    });
  },

  async archiveThread(threadId: string): Promise<void> {
    const ref = doc(db, threadDocPath(threadId));
    await updateDoc(ref, { archived: true, updatedAt: serverTimestamp() });
  },

  async unarchiveThread(threadId: string): Promise<void> {
    const ref = doc(db, threadDocPath(threadId));
    await updateDoc(ref, { archived: false, updatedAt: serverTimestamp() });
  },

  // Soft delete per-user: hide the thread for this user, but keep data for others
  async softDeleteForUser(threadId: string, uid: string): Promise<void> {
    const ref = doc(db, threadDocPath(threadId));
    await updateDoc(ref, { [`deletedBy.${uid}`]: true, updatedAt: serverTimestamp() });
  },

  // Hard delete: remove thread and all its messages. Use with caution.
  async hardDeleteThread(threadId: string): Promise<void> {
    const basePath = threadDocPath(threadId);

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

