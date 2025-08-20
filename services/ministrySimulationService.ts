/**
 * Ministry Synchronization Simulation Service
 * 
 * This service simulates the Cloud Functions behavior locally for testing
 * without requiring deployment. It provides the same functionality as the
 * server-side functions but runs entirely in the browser.
 */

import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc,
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase.config';
import { Member } from '../types';

// Simulate finding all ministry churches with a specific ministry
async function findMinistryChurchesWithMinistry(ministryName: string): Promise<string[]> {
  try {
    const usersQuery = query(
      collection(db, 'users'),
      where('isMinistryAccount', '==', true),
      where('preferences.ministryName', '==', ministryName)
    );
    
    const usersSnapshot = await getDocs(usersQuery);
    const ministryChurchIds: string[] = [];
    
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

// Simulate syncing member to all matching ministry churches
async function syncToMatchingMinistryChurches(
  memberId: string, 
  memberData: Member, 
  sourceChurchId: string
): Promise<number> {
  try {
    const ministryName = memberData.ministry;
    if (!ministryName) return 0;

    const ministryChurchIds = await findMinistryChurchesWithMinistry(ministryName);
    
    const batch = writeBatch(db);
    let batchCount = 0;
    let synced = 0;

    for (const ministryChurchId of ministryChurchIds) {
      const targetRef = doc(db, `churches/${ministryChurchId}/members/${memberId}`);
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

    return synced;
  } catch (e) {
    console.error('syncToMatchingMinistryChurches failed', e);
    return 0;
  }
}

// Simulate removing member from all ministry churches
async function removeFromAllMinistryChurches(memberId: string, ministryName: string): Promise<number> {
  try {
    if (!ministryName) return 0;

    const ministryChurchIds = await findMinistryChurchesWithMinistry(ministryName);
    
    const batch = writeBatch(db);
    let batchCount = 0;
    let removed = 0;

    for (const ministryChurchId of ministryChurchIds) {
      const targetRef = doc(db, `churches/${ministryChurchId}/members/${memberId}`);
      batch.delete(targetRef);
      batchCount++;
      removed++;

      // Commit in chunks to respect Firestore limits
      if (batchCount >= 450) {
        await batch.commit();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    return removed;
  } catch (e) {
    console.error('removeFromAllMinistryChurches failed', e);
    return 0;
  }
}

// Simulate backfill ministry sync
export const simulateBackfillMinistrySync = async (
  defaultChurchId: string,
  ministryChurchId: string
): Promise<{ success: boolean; synced: number }> => {
  try {
    const membersQuery = query(
      collection(db, `churches/${defaultChurchId}/members`),
      where('isActive', '!=', false)
    );
    
    const membersSnapshot = await getDocs(membersQuery);
    let synced = 0;

    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data() as Member;
      const hasMinistry = typeof memberData.ministry === 'string' && memberData.ministry.trim() !== '';
      
      if (hasMinistry) {
        const syncedCount = await syncToMatchingMinistryChurches(memberDoc.id, memberData, defaultChurchId);
        synced += syncedCount;
      }
    }

    return { success: true, synced };
  } catch (e) {
    console.error('simulateBackfillMinistrySync failed', e);
    return { success: false, synced: 0 };
  }
};

// Simulate cross-ministry sync
export const simulateCrossMinistrySync = async (
  ministryName: string,
  ministryChurchId: string
): Promise<{ success: boolean; synced: number }> => {
  try {
    // Find all churches
    const churchesSnapshot = await getDocs(collection(db, 'churches'));
    let synced = 0;

    for (const churchDoc of churchesSnapshot.docs) {
      const churchData = churchDoc.data();
      const ownerId = churchData.ownerId;
      if (!ownerId) continue;

      // Check if this is a default church (not ministry)
      const ownerDoc = await getDoc(doc(db, `users/${ownerId}`));
      if (!ownerDoc.exists()) continue;

      const ownerData = ownerDoc.data();
      if (ownerData.isMinistryAccount) continue; // Skip ministry churches

      // Get members with matching ministry from this church
      const membersQuery = query(
        collection(db, `churches/${churchDoc.id}/members`),
        where('ministry', '==', ministryName),
        where('isActive', '!=', false)
      );

      const membersSnapshot = await getDocs(membersQuery);

      const batch = writeBatch(db);
      let batchCount = 0;

      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data();
        const targetRef = doc(db, `churches/${ministryChurchId}/members/${memberDoc.id}`);
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
    console.error('simulateCrossMinistrySync failed', e);
    return { success: false, synced: 0 };
  }
};

// Simulate member sync trigger (called when member is added/updated)
export const simulateMemberSyncTrigger = async (
  memberId: string,
  memberData: Member | null,
  previousData: Member | null,
  churchId: string
): Promise<void> => {
  try {
    // Only act on default churches (simulate the server-side logic)
    const churchDoc = await getDoc(doc(db, `churches/${churchId}`));
    if (!churchDoc.exists()) return;

    const churchData = churchDoc.data();
    const ownerId = churchData.ownerId;
    if (!ownerId) return;

    const ownerDoc = await getDoc(doc(db, `users/${ownerId}`));
    if (!ownerDoc.exists()) return;

    const ownerData = ownerDoc.data();
    if (ownerData.isMinistryAccount) return; // Only act on default churches

    // If deleted, remove from all ministry churches
    if (!memberData) {
      if (previousData?.ministry) {
        await removeFromAllMinistryChurches(memberId, previousData.ministry);
      }
      return;
    }

    const hasMinistry = typeof memberData.ministry === 'string' && memberData.ministry.trim() !== '';
    const isActive = memberData.isActive !== false;

    // If no ministry or inactive, remove from all ministry churches
    if (!hasMinistry || !isActive) {
      const ministryToRemove = previousData?.ministry || memberData.ministry;
      if (ministryToRemove) {
        await removeFromAllMinistryChurches(memberId, ministryToRemove);
      }
      return;
    }

    // Sync to all ministry churches with matching ministry
    await syncToMatchingMinistryChurches(memberId, memberData, churchId);

    // Handle ministry change - remove from old ministry churches if ministry changed
    if (previousData && previousData.ministry && previousData.ministry !== memberData.ministry) {
      await removeFromAllMinistryChurches(memberId, previousData.ministry);
    }
  } catch (e) {
    console.error('simulateMemberSyncTrigger failed', e);
  }
};

// Export simulation status
export const isSimulationMode = true;
