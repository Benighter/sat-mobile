import { collection, addDoc, Timestamp, doc, getDoc, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.config';
import { MinistryAccessRequest, User } from '../types';

const REQUESTS_COLLECTION = 'ministryAccessRequests';

export const ministryAccessService = {
  // Ensure ministry access status exists; create pending request by default
  ensureRequestForUser: async (user: User): Promise<MinistryAccessRequest | null> => {
    if (!user?.isMinistryAccount) return null;
    const ministryName = user?.preferences?.ministryName?.trim();
    if (!ministryName) return null;

    // If already approved or pending, fetch and return latest
    try {
      const qReq = query(
        collection(db, REQUESTS_COLLECTION),
        where('requesterUid', '==', user.uid),
        where('ministryName', '==', ministryName),
        where('status', 'in', ['pending', 'approved'])
      );
      const snap = await getDocs(qReq);
      if (!snap.empty) {
        const d = snap.docs[0];
        return { id: d.id, ...(d.data() as any) } as MinistryAccessRequest;
      }
    } catch {}

    // Create a new pending request
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
    return { id: ref.id, ...(payload as any) } as MinistryAccessRequest;
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
  }
};
