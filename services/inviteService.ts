import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase.config';
import { AdminInvite, User } from '../types';

export const inviteService = {
  // Search directly in Firestore to avoid any Cloud Functions/CORS dependency
  searchUserByEmail: async (email: string): Promise<User | null> => {
    try {
      const trimmed = (email || '').trim();
      if (!trimmed) return null;
      const normalized = trimmed.toLowerCase();

      // Try exact match on email
      let snap = await getDocs(query(collection(db, 'users'), where('email', '==', trimmed), limit(1)));

      // Fallback: try lowercased value (supports schemas that store lowercased email)
      if (snap.empty) {
        try {
          snap = await getDocs(query(collection(db, 'users'), where('email', '==', normalized), limit(1)));
        } catch {}
      }

      // Fallback: if schema has emailLower, try that
      if (snap.empty) {
        try {
          snap = await getDocs(query(collection(db, 'users'), where('emailLower', '==', normalized), limit(1)));
        } catch {}
      }

      if (snap.empty) return null;
      const docSnap = snap.docs[0];
      const u: any = docSnap.data() || {};

      // Only allow inviting Admins; treat inactive as not found
      if ((u.role || '') !== 'admin' || u.isActive === false) return null;

      const result: User = {
        uid: u.uid || docSnap.id,
        id: docSnap.id,
        email: u.email,
        displayName: u.displayName || [u.firstName, u.lastName].filter(Boolean).join(' ').trim(),
        firstName: u.firstName || undefined as any,
        lastName: u.lastName || undefined as any,
        phoneNumber: u.phoneNumber || undefined as any,
        profilePicture: u.profilePicture || undefined as any,
        churchId: u.churchId || '',
        churchName: u.churchName || undefined as any,
        role: u.role,
      } as any;
      return result;
    } catch (error: any) {
      throw new Error(`Failed to search user: ${error?.message || 'search failed'}`);
    }
  },

  // Send invite to user by email (Admin only)
  sendInviteToUser: async (
    adminUid: string,
    adminName: string,
    churchId: string,
    targetUser: User,
    expirationHours: number = 168 // Default 7 days
  ): Promise<AdminInvite> => {
    try {
      // Check if there's already a pending invite for this user
      const existingInviteQuery = query(
        collection(db, 'adminInvites'),
        where('invitedUserId', '==', targetUser.uid),
        where('createdBy', '==', adminUid),
        where('status', '==', 'pending')
      );

      const existingInvites = await getDocs(existingInviteQuery);
      if (!existingInvites.empty) {
        throw new Error('There is already a pending invite for this user');
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + expirationHours * 60 * 60 * 1000);

      const inviteData = {
        invitedUserEmail: targetUser.email,
        invitedUserId: targetUser.uid,
        invitedUserName: targetUser.displayName || `${targetUser.firstName} ${targetUser.lastName}`,
        invitedUserChurchId: targetUser.churchId,
        invitedUserChurchName: targetUser.churchName,
        createdBy: adminUid,
        createdByName: adminName,
        churchId,
        // Keep targetRole for tracking, but accept flow will branch when target already owns data
        targetRole: 'leader' as const,
        status: 'pending' as const,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        accessChurchId: churchId // The church the leader will have access to
      };

      const docRef = await addDoc(collection(db, 'adminInvites'), inviteData);

      return {
        id: docRef.id,
        ...inviteData
      };
    } catch (error: any) {
      throw new Error(`Failed to send invite: ${error.message}`);
    }
  },

  // Get pending invites for a user
  getPendingInvitesForUser: async (userId: string): Promise<AdminInvite[]> => {
    try {
      // Use a simpler query without orderBy to avoid index requirement
      const q = query(
        collection(db, 'adminInvites'),
        where('invitedUserId', '==', userId),
        where('status', '==', 'pending')
      );

      const querySnapshot = await getDocs(q);

      const invites = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AdminInvite[];

      // Sort in memory instead of using orderBy
      return invites.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error: any) {
      throw new Error(`Failed to get pending invites: ${error.message}`);
    }
  },

  // Accept an admin invite (changes user role to leader)
  acceptAdminInvite: async (
    inviteId: string,
    userUid: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      // Get the invite
      const inviteDoc = await getDoc(doc(db, 'adminInvites', inviteId));

      if (!inviteDoc.exists()) {
        return { success: false, message: 'Invite not found' };
      }

      const invite = { id: inviteDoc.id, ...inviteDoc.data() } as AdminInvite;

      // Check if invite has expired
      const now = new Date();
      const expiresAt = new Date(invite.expiresAt);
      if (now > expiresAt) {
        return { success: false, message: 'This invite has expired' };
      }

      // Check if invite is still pending
      if (invite.status !== 'pending') {
        return { success: false, message: 'This invite has already been responded to' };
      }

      // Resolve the invited user's current church and data ownership
      const userDocRef = doc(db, 'users', userUid);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) {
        return { success: false, message: 'User profile not found' };
      }
      const userData = userSnap.data() as User;
      const userChurchId = userData.churchId;

      // Check if invited user already has members (or bacentas) under their church
      let hasOwnData = false;
      try {
        if (userChurchId) {
          const membersSnap = await getDocs(
            query(collection(db, 'churches', userChurchId, 'members'), limit(1))
          );
          const bacentasSnap = await getDocs(
            query(collection(db, 'churches', userChurchId, 'bacentas'), limit(1))
          );
          hasOwnData = !membersSnap.empty || !bacentasSnap.empty;
        }
      } catch {}

  if (hasOwnData) {
        // Do NOT demote or change church. Instead, create a cross-tenant access link
        // so the inviting admin can switch into this admin's church (super-admin style)
        const linkPayload = {
          viewerUid: invite.createdBy,
          ownerUid: userUid,
          ownerName: userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || undefined,
          ownerChurchId: userChurchId,
          ownerChurchName: userData.churchName,
          permission: 'read-only',
          createdAt: new Date().toISOString()
        } as any;
        await addDoc(collection(db, 'crossTenantAccessLinks'), linkPayload);
        // Also write deterministic index doc enabling security rules for cross-tenant reads
        try {
          const indexId = `${(linkPayload as any).viewerUid}_${(linkPayload as any).ownerChurchId}`;
          await setDoc(doc(db, 'crossTenantAccessIndex', indexId), {
            viewerUid: (linkPayload as any).viewerUid,
            ownerUid: (linkPayload as any).ownerUid,
            ownerChurchId: (linkPayload as any).ownerChurchId,
            permission: (linkPayload as any).permission,
            createdAt: (linkPayload as any).createdAt,
            revoked: false
          });
        } catch {}

        // Mark invite as accepted without role change
        const inviteDocRef = doc(db, 'adminInvites', inviteId);
        await updateDoc(inviteDocRef, {
          status: 'accepted',
          respondedAt: new Date().toISOString(),
          handledAs: 'cross-tenant-link'
        });

        return {
          success: true,
          message: `${invite.createdByName} now has access to view your church as Super Admin (read-only).`
        };
      }

      // Fallback: user has no data yet — proceed with the original leader invite flow
      let resolvedChurchName: string | undefined;
      try {
        const churchSnap = await getDoc(doc(db, 'churches', invite.churchId));
        const cData: any = churchSnap.exists() ? churchSnap.data() : null;
        resolvedChurchName = cData?.name;
      } catch {}

  // Keep track of the user's previous context so we can restore it if removed later
  const previousChurchId = userChurchId || userUid;
  const previousChurchName = (userData as any)?.churchName || undefined;
  const previousRole = (userData as any)?.role || 'admin';
      await updateDoc(userDocRef, {
        role: 'leader',
        churchId: invite.churchId,
        ...(resolvedChurchName ? { churchName: resolvedChurchName } : {}),
        isInvitedAdminLeader: true,
        invitedByAdminId: invite.createdBy,
        lastUpdated: new Date().toISOString()
      });

      const inviteDocRef = doc(db, 'adminInvites', inviteId);
      await updateDoc(inviteDocRef, {
        status: 'accepted',
        respondedAt: new Date().toISOString(),
        handledAs: 'leader-role-change',
        previousChurchId,
        previousChurchName,
        previousRole
      });

      return {
        success: true,
        message: `Your role has been changed to Leader. You are now under ${invite.createdByName}.`
      };
    } catch (error: any) {
      throw new Error(`Failed to accept invite: ${error.message}`);
    }
  },

  // Reject an admin invite
  rejectAdminInvite: async (inviteId: string): Promise<{ success: boolean; message: string }> => {
    try {
      // Get the invite
      const inviteDoc = await getDoc(doc(db, 'adminInvites', inviteId));

      if (!inviteDoc.exists()) {
        return { success: false, message: 'Invite not found' };
      }

      const invite = { id: inviteDoc.id, ...inviteDoc.data() } as AdminInvite;

      // Check if invite is still pending
      if (invite.status !== 'pending') {
        return { success: false, message: 'This invite has already been responded to' };
      }

      // Mark invite as rejected
      const inviteDocRef = doc(db, 'adminInvites', inviteId);
      await updateDoc(inviteDocRef, {
        status: 'rejected',
        respondedAt: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Invite rejected successfully.'
      };
    } catch (error: any) {
      throw new Error(`Failed to reject invite: ${error.message}`);
    }
  },

  // Fix leader access - update churchId for leaders who accepted invites
  fixLeaderAccess: async (userUid: string): Promise<{ success: boolean; message: string }> => {
    try {
      // Find accepted invites for this user
      const invitesQuery = query(
        collection(db, 'adminInvites'),
        where('invitedUserId', '==', userUid),
        where('status', '==', 'accepted')
      );

      const invitesSnapshot = await getDocs(invitesQuery);

      if (invitesSnapshot.empty) {
        return { success: false, message: 'No accepted invites found for this user' };
      }

      // Get the most recent accepted invite
      const invites = invitesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AdminInvite[];
      const latestInvite = invites.sort((a, b) => new Date(b.respondedAt || b.createdAt).getTime() - new Date(a.respondedAt || a.createdAt).getTime())[0];

      // Update user's churchId to match the admin's church and sync churchName for UI
      const userDocRef = doc(db, 'users', userUid);
      let resolvedChurchName: string | undefined;
      try {
        const churchSnap = await getDoc(doc(db, 'churches', latestInvite.churchId));
        const cData: any = churchSnap.exists() ? churchSnap.data() : null;
        resolvedChurchName = cData?.name;
      } catch {}
      await updateDoc(userDocRef, {
        churchId: latestInvite.churchId,
        ...(resolvedChurchName ? { churchName: resolvedChurchName } : {}),
        lastUpdated: new Date().toISOString()
      });

      return {
        success: true,
        message: `Access updated. You now have access to ${latestInvite.createdByName}'s church data.`
      };
    } catch (error: any) {
      throw new Error(`Failed to fix leader access: ${error.message}`);
    }
  },

  // Remove leader access - reverts user back to admin role and removes church access
  removeLeaderAccess: async (adminUid: string, leaderUserId: string): Promise<{ success: boolean; message: string }> => {
    try {
      // Find the accepted invite for this leader created by this admin
      const inviteQuery = query(
        collection(db, 'adminInvites'),
        where('invitedUserId', '==', leaderUserId),
        where('createdBy', '==', adminUid),
        where('status', '==', 'accepted')
      );

      const inviteSnapshot = await getDocs(inviteQuery);

      if (inviteSnapshot.empty) {
        throw new Error('No accepted invite found for this leader');
      }

      const inviteDoc = inviteSnapshot.docs[0];
      const inviteData = inviteDoc.data() as any;

      // If the invite was handled as a cross-tenant access link, revoke the link(s) instead of changing roles
      if (inviteData?.handledAs === 'cross-tenant-link') {
        // Revoke any active cross-tenant links between this admin (viewer) and the target owner (leaderUserId)
        const linksQuery = query(
          collection(db, 'crossTenantAccessLinks'),
          where('viewerUid', '==', adminUid),
          where('ownerUid', '==', leaderUserId)
        );
        const linksSnap = await getDocs(linksQuery);
        const nowIso = new Date().toISOString();
        await Promise.all(
          linksSnap.docs
            .filter(d => !(d.data() as any)?.revoked)
            .map(d => updateDoc(doc(db, 'crossTenantAccessLinks', d.id), { revoked: true, revokedAt: nowIso }))
        );

        // Mark the invite as revoked
        await updateDoc(doc(db, 'adminInvites', inviteDoc.id), {
          status: 'revoked',
          revokedAt: nowIso
        });

        return { success: true, message: 'Access to external constituency has been revoked.' };
      }

  // Default flow: user was converted to leader under admin's church — restore previous context
  // Get the leader's user document
      const userDocRef = doc(db, 'users', leaderUserId);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        throw new Error('Leader user not found');
      }

      const userData = userDoc.data() as User;

      // Try to restore from invite's stored previous context
      const previousChurchId = (inviteData as any)?.previousChurchId || leaderUserId;
      const previousChurchName = (inviteData as any)?.previousChurchName;
      const previousRole = (inviteData as any)?.previousRole || 'admin';

      await updateDoc(userDocRef, {
        role: previousRole,
        churchId: previousChurchId,
        ...(previousChurchName ? { churchName: previousChurchName } : {}),
        isInvitedAdminLeader: false,
        invitedByAdminId: null,
        lastUpdated: new Date().toISOString()
      });

      await updateDoc(doc(db, 'adminInvites', inviteDoc.id), {
        status: 'revoked',
        revokedAt: new Date().toISOString()
      });

      return { success: true, message: `${userData.displayName || userData.firstName} has been removed as a leader and restored to their previous state.` };
    } catch (error: any) {
      throw new Error(`Failed to remove leader access: ${error.message}`);
    }
  },

  // Get all invites created by an admin
  getAdminInvites: async (adminUid: string): Promise<AdminInvite[]> => {
    try {
      // Use simpler query without orderBy to avoid index requirement
      const q = query(
        collection(db, 'adminInvites'),
        where('createdBy', '==', adminUid)
      );

      const querySnapshot = await getDocs(q);

      const invites = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AdminInvite[];

      // Sort in memory instead of using orderBy
      return invites.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error: any) {
      throw new Error(`Failed to get admin invites: ${error.message}`);
    }
  },

  // Cancel an invite
  cancelInvite: async (inviteId: string): Promise<void> => {
    try {
      const inviteDocRef = doc(db, 'adminInvites', inviteId);
      await updateDoc(inviteDocRef, {
        status: 'rejected', // We'll use rejected status for cancelled invites
        respondedAt: new Date().toISOString()
      });
    } catch (error: any) {
      throw new Error(`Failed to cancel invite: ${error.message}`);
    }
  },

  // Delete an invite permanently
  deleteInvite: async (inviteId: string): Promise<void> => {
    try {
      const inviteDocRef = doc(db, 'adminInvites', inviteId);
      await deleteDoc(inviteDocRef);
    } catch (error: any) {
      throw new Error(`Failed to delete invite: ${error.message}`);
    }
  }
};
