import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase.config';
import { AdminInvite, User } from '../types';

export const inviteService = {
  // Search for users by email in the users collection (across all churches)
  searchUserByEmail: async (email: string, churchId: string): Promise<User | null> => {
    try {
      // Search for users with the exact email (across all churches)
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', email),
        where('isActive', '==', true)
      );

      let usersSnapshot = await getDocs(usersQuery);

      // If no results, try with lowercase email
      if (usersSnapshot.empty) {
        const lowercaseQuery = query(
          collection(db, 'users'),
          where('email', '==', email.toLowerCase()),
          where('isActive', '==', true)
        );

        usersSnapshot = await getDocs(lowercaseQuery);
      }

      // If still no results, get all users and filter manually
      if (usersSnapshot.empty) {
        const allUsersQuery = query(
          collection(db, 'users'),
          where('isActive', '==', true)
        );

        usersSnapshot = await getDocs(allUsersQuery);
      }

      // Find user with matching email (case-insensitive)
      const matchingUser = usersSnapshot.docs.find(doc => {
        const userData = doc.data();
        return userData.email && userData.email.toLowerCase() === email.toLowerCase();
      });

      if (matchingUser) {
        const userData = matchingUser.data();

        return {
          id: matchingUser.id,
          uid: userData.uid,
          email: userData.email,
          displayName: userData.displayName,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phoneNumber: userData.phoneNumber,
          profilePicture: userData.profilePicture,
          churchId: userData.churchId,
          churchName: userData.churchName,
          role: userData.role,
          preferences: userData.preferences,
          createdAt: userData.createdAt?.toDate?.() ? userData.createdAt.toDate().toISOString() : userData.createdAt,
          lastLoginAt: userData.lastLoginAt?.toDate?.() ? userData.lastLoginAt.toDate().toISOString() : userData.lastLoginAt,
          lastUpdated: userData.lastUpdated,
          isActive: userData.isActive
        } as User;
      }

      return null;
    } catch (error: any) {
      throw new Error(`Failed to search user: ${error.message}`);
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

      // Update user role to leader and grant access to the admin's church
      // Mark them as an invited admin leader to restrict their permissions
      const userDocRef = doc(db, 'users', userUid);
      await updateDoc(userDocRef, {
        role: 'leader',
        churchId: invite.churchId, // Give access to the admin's church
        isInvitedAdminLeader: true, // Mark as invited admin leader
        invitedByAdminId: invite.createdBy, // Track who invited them
        lastUpdated: new Date().toISOString()
      });

      // Mark invite as accepted
      const inviteDocRef = doc(db, 'adminInvites', inviteId);
      await updateDoc(inviteDocRef, {
        status: 'accepted',
        respondedAt: new Date().toISOString()
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

      // Update user's churchId to match the admin's church
      const userDocRef = doc(db, 'users', userUid);
      await updateDoc(userDocRef, {
        churchId: latestInvite.churchId,
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

      // Get the leader's user document
      const userDocRef = doc(db, 'users', leaderUserId);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        throw new Error('Leader user not found');
      }

      const userData = userDoc.data() as User;

      // Revert user back to admin role and remove church access
      await updateDoc(userDocRef, {
        role: 'admin',
        churchId: leaderUserId, // Reset to their own church ID (their user ID)
        isInvitedAdminLeader: false, // Clear invited admin leader status
        invitedByAdminId: null, // Clear the inviting admin reference
        lastUpdated: new Date().toISOString()
      });

      // Mark the invite as revoked
      const inviteDoc = inviteSnapshot.docs[0];
      await updateDoc(doc(db, 'adminInvites', inviteDoc.id), {
        status: 'revoked',
        revokedAt: new Date().toISOString()
      });

      return {
        success: true,
        message: `${userData.displayName || userData.firstName} has been removed as a leader and reverted to admin role.`
      };
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
  }
};
