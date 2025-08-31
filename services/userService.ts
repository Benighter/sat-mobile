import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase.config';
import { User, Church } from '../types';

// User Service for managing user profiles and church data
export const userService = {
  // Get user profile by UID
  getUserProfile: async (uid: string): Promise<User | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) {
        return null;
      }
      return { ...userDoc.data(), id: userDoc.id } as User;
    } catch (error: any) {
      throw new Error(`Failed to get user profile: ${error.message}`);
    }
  },

  // Update user profile
  updateUserProfile: async (uid: string, updates: Partial<User>): Promise<void> => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        ...updates,
        lastUpdated: new Date().toISOString()
      });
    } catch (error: any) {
      throw new Error(`Failed to update user profile: ${error.message}`);
    }
  },

  // Get church information
  getChurch: async (churchId: string): Promise<Church | null> => {
    try {
      const churchDoc = await getDoc(doc(db, 'churches', churchId));
      if (!churchDoc.exists()) {
        return null;
      }
      return { ...churchDoc.data(), id: churchDoc.id } as Church;
    } catch (error: any) {
      throw new Error(`Failed to get church: ${error.message}`);
    }
  },

  // Update church settings
  updateChurchSettings: async (churchId: string, settings: Partial<Church['settings']>): Promise<void> => {
    try {
      await updateDoc(doc(db, 'churches', churchId), {
        settings,
        lastUpdated: new Date().toISOString()
      });
    } catch (error: any) {
      throw new Error(`Failed to update church settings: ${error.message}`);
    }
  },

  // Get all users in a church
  getChurchUsers: async (churchId: string): Promise<User[]> => {
    try {
      // Avoid composite index by skipping orderBy in Firestore; sort client-side
      const usersQuery = query(
        collection(db, 'users'),
        where('churchId', '==', churchId),
        where('isActive', '==', true)
      );

      const querySnapshot = await getDocs(usersQuery);
      const users = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as User[];

      // Sort by firstName then lastName locally
      users.sort((a: any, b: any) => {
        const af = (a.firstName || '').toLowerCase();
        const bf = (b.firstName || '').toLowerCase();
        if (af !== bf) return af.localeCompare(bf);
        const al = (a.lastName || '').toLowerCase();
        const bl = (b.lastName || '').toLowerCase();
        return al.localeCompare(bl);
      });
      return users;
    } catch (primaryError: any) {
      // Fallback: query only by churchId and filter active in-memory (for older indexes)
      try {
        const fallbackQuery = query(
          collection(db, 'users'),
          where('churchId', '==', churchId)
        );
        const snapshot = await getDocs(fallbackQuery);
        const users = snapshot.docs
          .map(doc => ({ ...doc.data(), id: doc.id }) as User)
          .filter(u => (u as any).isActive !== false);
        users.sort((a: any, b: any) => {
          const af = (a.firstName || '').toLowerCase();
          const bf = (b.firstName || '').toLowerCase();
          if (af !== bf) return af.localeCompare(bf);
          const al = (a.lastName || '').toLowerCase();
          const bl = (b.lastName || '').toLowerCase();
          return al.localeCompare(bl);
        });
        return users;
      } catch (fallbackError: any) {
        throw new Error(`Failed to get church users: ${primaryError.message || fallbackError.message}`);
      }
    }
  },

  // Update user role (admin only)
  updateUserRole: async (uid: string, role: User['role']): Promise<void> => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        role,
        lastUpdated: new Date().toISOString()
      });
    } catch (error: any) {
      throw new Error(`Failed to update user role: ${error.message}`);
    }
  },

  // Set user active status via Cloud Function (preferred). If that fails (e.g., CORS/network),
  // gracefully fall back to a direct Firestore update so the UI keeps working without CORS.
  setUserActiveStatus: async (uid: string, active: boolean): Promise<void> => {
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions(undefined as any, 'us-central1');
      const fn = httpsCallable(functions, 'setUserActiveStatus');
      const res: any = await fn({ uid, active });
      if (!res?.data?.success) throw new Error('Callable failed');
      return;
    } catch (error: any) {
      // Fallback path: update Firestore directly (no CORS for Firestore client SDK)
      console.warn('[userService.setUserActiveStatus] Callable failed; applying Firestore fallback:', error?.message || error);
      try {
        const updates: any = {
          isActive: !!active,
          lastUpdated: Timestamp.now(),
          isDeleted: false,
          ...(active ? { reactivatedAt: Timestamp.now() } : { deactivatedAt: Timestamp.now() })
        };
        await updateDoc(doc(db, 'users', uid), updates);
        return; // success via fallback
      } catch (fallbackError: any) {
        // If even fallback fails, surface a clear error
        throw new Error(`Failed to ${active ? 'activate' : 'deactivate'} user (fallback failed): ${fallbackError.message || fallbackError}`);
      }
    }
  },

  // Convenience wrappers
  activateUser: async (uid: string): Promise<void> => userService.setUserActiveStatus(uid, true),
  deactivateUser: async (uid: string): Promise<void> => userService.setUserActiveStatus(uid, false),

  // Hard delete user account and related data (admin only)
  hardDeleteUser: async (uid: string): Promise<void> => {
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions(undefined as any, 'us-central1');
      const fn = httpsCallable(functions, 'hardDeleteUserAccount');
      const res: any = await fn({ uid });
      if (!res?.data?.success) throw new Error('Callable failed');
    } catch (error: any) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  },

  // Update user preferences
  updateUserPreferences: async (uid: string, preferences: Partial<User['preferences']>): Promise<void> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }
      
      const currentPreferences = userDoc.data().preferences || {};
      const updatedPreferences = { ...currentPreferences, ...preferences };
      
      await updateDoc(doc(db, 'users', uid), {
        preferences: updatedPreferences,
        lastUpdated: new Date().toISOString()
      });
    } catch (error: any) {
      throw new Error(`Failed to update user preferences: ${error.message}`);
    }
  },

  // Create church and update user profile (for church setup)
  createChurchAndUpdateUser: async (_churchData: {
    name: string;
    address: string;
    contactInfo: {
      phone: string;
      email: string;
      website: string;
    };
    settings: {
      timezone: string;
      defaultMinistries: string[];
    };
  }): Promise<void> => {
    try {
      // This method is for existing users who need to set up their church
      // For new registrations, the church is created in the register method
      throw new Error('Church setup should be handled during registration. This method is deprecated.');
    } catch (error: any) {
      throw new Error(`Failed to create church: ${error.message}`);
    }
  },

  // Get user statistics for dashboard
  getUserStats: async (churchId: string): Promise<{
    totalUsers: number;
    activeUsers: number;
    adminUsers: number;
    recentLogins: number;
  }> => {
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('churchId', '==', churchId)
      );
      
      const querySnapshot = await getDocs(usersQuery);
      const users = querySnapshot.docs.map(doc => doc.data()) as User[];
      
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      return {
        totalUsers: users.length,
        activeUsers: users.filter(user => user.isActive).length,
        adminUsers: users.filter(user => user.role === 'admin').length,
        recentLogins: users.filter(user => {
          const last = (user as any).lastLoginAt;
          return !!last && new Date(last) >= sevenDaysAgo;
        }).length
      };
    } catch (error: any) {
      throw new Error(`Failed to get user statistics: ${error.message}`);
    }
  }
};

export default userService;
