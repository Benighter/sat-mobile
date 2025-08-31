import { collection, addDoc, Timestamp, doc, getDoc, getDocs, query, where, updateDoc, limit, writeBatch } from 'firebase/firestore';
import { db } from '../firebase.config';
import { MinistryAccessRequest, User } from '../types';

const REQUESTS_COLLECTION = 'ministryAccessRequests';
const SUPERADMIN_NOTIFICATIONS_COLLECTION = 'superAdminNotifications';

// Client-side cache to prevent duplicate requests during concurrent calls
const pendingRequests = new Map<string, Promise<MinistryAccessRequest | null>>();
const requestCache = new Map<string, MinistryAccessRequest>();

// Helper function to create SuperAdmin notification (client-side)
const createSuperAdminNotification = async (request: MinistryAccessRequest): Promise<void> => {
  try {
    // Check if a notification already exists for this request to prevent duplicates
    const existingNotificationQuery = query(
      collection(db, SUPERADMIN_NOTIFICATIONS_COLLECTION),
      where('requestId', '==', request.id),
      where('type', '==', 'ministry_access_request'),
      limit(1)
    );

    const existingNotifications = await getDocs(existingNotificationQuery);
    if (!existingNotifications.empty) {
      console.log(`Notification already exists for request ${request.id}, skipping duplicate creation`);
      return;
    }

    // Create notification data
    const notificationData = {
      type: 'ministry_access_request',
      requestId: request.id,
      requesterUid: request.requesterUid,
      requesterName: request.requesterName || 'Unknown User',
      requesterEmail: request.requesterEmail || '',
      ministryName: request.ministryName,
      status: 'pending',
      createdAt: new Date().toISOString(),
      isRead: false,
      title: 'New Ministry Access Request',
      description: `${request.requesterName || 'A user'} has requested access to ${request.ministryName} ministry`,
      metadata: {
        requestId: request.id,
        ministryChurchId: request.ministryChurchId
      }
    };

    // Create notification in superAdmin notifications collection
    await addDoc(collection(db, SUPERADMIN_NOTIFICATIONS_COLLECTION), notificationData);
    console.log(`✅ SuperAdmin notification created for ministry access request: ${request.id}`);

  } catch (error) {
    console.error('Failed to create SuperAdmin notification:', error);
    throw error;
  }
};

export const ministryAccessService = {
  // Ensure ministry access status exists; create pending request by default
  ensureRequestForUser: async (user: User): Promise<MinistryAccessRequest | null> => {
    if (!user?.isMinistryAccount) return null;
    const ministryName = user?.preferences?.ministryName?.trim();
    if (!ministryName) return null;

    const cacheKey = `${user.uid}:${ministryName}`;

    // Check client-side cache first
    if (requestCache.has(cacheKey)) {
      console.log(`📋 Returning cached request for ${cacheKey}`);
      return requestCache.get(cacheKey)!;
    }

    // Check if there's already a pending request for this user/ministry
    if (pendingRequests.has(cacheKey)) {
      console.log(`⏳ Waiting for pending request for ${cacheKey}`);
      return await pendingRequests.get(cacheKey)!;
    }

    // Create a promise for this request to prevent concurrent calls
    const requestPromise = (async (): Promise<MinistryAccessRequest | null> => {
      try {
        // If already approved or pending, fetch and return latest
        const qReq = query(
          collection(db, REQUESTS_COLLECTION),
          where('requesterUid', '==', user.uid),
          where('ministryName', '==', ministryName),
          where('status', 'in', ['pending', 'approved'])
        );
        const snap = await getDocs(qReq);
        if (!snap.empty) {
          const d = snap.docs[0];
          const existingRequest = { id: d.id, ...(d.data() as any) } as MinistryAccessRequest;
          // Cache the existing request
          requestCache.set(cacheKey, existingRequest);
          console.log(`📋 Found existing request for ${cacheKey}`);
          return existingRequest;
        }

        // Create a new pending request
        console.log(`🆕 Creating new request for ${cacheKey}`);
        const payload: Omit<MinistryAccessRequest, 'id'> = {
          requesterUid: user.uid,
          requesterName: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          requesterEmail: (user as any).email,
          ministryName,
          ministryChurchId: user.contexts?.ministryChurchId,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const ref = await addDoc(collection(db, REQUESTS_COLLECTION), payload as any);
        const newRequest = { id: ref.id, ...(payload as any) } as MinistryAccessRequest;

        // Cache the new request
        requestCache.set(cacheKey, newRequest);

        // Create SuperAdmin notification for the new request (client-side)
        try {
          await createSuperAdminNotification(newRequest);
        } catch (notificationError) {
          console.warn('Failed to create SuperAdmin notification:', notificationError);
          // Don't fail the request creation if notification fails
        }

        return newRequest;
      } catch (error) {
        console.error('Failed to ensure request for user:', error);
        throw error;
      } finally {
        // Clean up the pending request
        pendingRequests.delete(cacheKey);
      }
    })();

    // Store the promise to prevent concurrent calls
    pendingRequests.set(cacheKey, requestPromise);

    return await requestPromise;
  },

  isAccessApproved: (user: User | null | undefined): boolean => {
    if (!user?.isMinistryAccount) return true; // Non-ministry accounts unaffected
    const status = user.ministryAccess?.status || 'none';
    return status === 'approved';
  },

  // Approve a request (SuperAdmin action)
  approveRequest: async (requestId: string, approver: { uid: string; name?: string }): Promise<void> => {
    const reqRef = doc(db, REQUESTS_COLLECTION, requestId);
    const snap = await getDoc(reqRef);
    if (!snap.exists()) throw new Error('Request not found');
    const data = snap.data() as MinistryAccessRequest;

    await updateDoc(reqRef, {
      status: 'approved',
      approvedBy: approver.uid,
      approvedByName: approver.name || 'SuperAdmin',
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any);

    // Update requester profile flag
    if (data.requesterUid) {
      const userRef = doc(db, 'users', data.requesterUid);
      await updateDoc(userRef, {
        ministryAccess: {
          status: 'approved',
          approvedBy: approver.uid,
          approvedByName: approver.name || 'SuperAdmin',
          approvedAt: new Date().toISOString()
        },
        lastUpdated: Timestamp.now()
      } as any);
    }

    // Mark related SuperAdmin notifications as read
    try {
      await markRelatedNotificationsAsRead(requestId, `Request approved by ${approver.name || 'SuperAdmin'}`);
    } catch (notificationError) {
      console.warn('Failed to mark related notifications as read:', notificationError);
    }

    // Clear cache for this user/ministry combination
    clearRequestCache(data.requesterUid, data.ministryName);
  },

  rejectRequest: async (requestId: string, reviewer: { uid: string; name?: string }, reason?: string): Promise<void> => {
    const reqRef = doc(db, REQUESTS_COLLECTION, requestId);
    const snap = await getDoc(reqRef);
    if (!snap.exists()) throw new Error('Request not found');
    const data = snap.data() as MinistryAccessRequest;

    await updateDoc(reqRef, {
      status: 'rejected',
      approvedBy: reviewer.uid,
      approvedByName: reviewer.name || 'SuperAdmin',
      rejectionReason: reason || '',
      updatedAt: new Date().toISOString()
    } as any);

    // Update requester profile flag
    if (data.requesterUid) {
      const userRef = doc(db, 'users', data.requesterUid);
      await updateDoc(userRef, {
        ministryAccess: {
          status: 'revoked'
        },
        lastUpdated: Timestamp.now()
      } as any);
    }

    // Mark related SuperAdmin notifications as read
    try {
      await markRelatedNotificationsAsRead(requestId, `Request rejected by ${reviewer.name || 'SuperAdmin'}`);
    } catch (notificationError) {
      console.warn('Failed to mark related notifications as read:', notificationError);
    }

    // Clear cache for this user/ministry combination
    clearRequestCache(data.requesterUid, data.ministryName);
  }
};

// Helper function to mark related notifications as read
const markRelatedNotificationsAsRead = async (requestId: string, reason: string): Promise<void> => {
  try {
    const relatedNotificationsQuery = query(
      collection(db, SUPERADMIN_NOTIFICATIONS_COLLECTION),
      where('requestId', '==', requestId),
      where('type', '==', 'ministry_access_request'),
      where('isRead', '==', false)
    );

    const relatedNotifications = await getDocs(relatedNotificationsQuery);

    if (!relatedNotifications.empty) {
      const batch = writeBatch(db);
      relatedNotifications.docs.forEach(docSnap => {
        batch.update(docSnap.ref, {
          isRead: true,
          readAt: new Date().toISOString(),
          autoMarkedRead: true,
          autoMarkReason: reason
        });
      });

      await batch.commit();
      console.log(`✅ Marked ${relatedNotifications.size} notifications as read for request ${requestId}`);
    }
  } catch (error) {
    console.error('Failed to mark related notifications as read:', error);
    throw error;
  }
};

// Helper function to clear request cache
const clearRequestCache = (requesterUid: string, ministryName: string): void => {
  const cacheKey = `${requesterUid}:${ministryName}`;
  requestCache.delete(cacheKey);
  pendingRequests.delete(cacheKey);
  console.log(`🗑️ Cleared cache for ${cacheKey}`);
};
