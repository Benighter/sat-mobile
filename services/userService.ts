import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy 
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
      const usersQuery = query(
        collection(db, 'users'),
        where('churchId', '==', churchId),
        where('isActive', '==', true),
        orderBy('firstName') // Removed orderBy lastName since it's now optional
      );
      
      const querySnapshot = await getDocs(usersQuery);
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as User[];
    } catch (error: any) {
      throw new Error(`Failed to get church users: ${error.message}`);
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

  // Deactivate user (admin only)
  deactivateUser: async (uid: string): Promise<void> => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        isActive: false,
        lastUpdated: new Date().toISOString()
      });
    } catch (error: any) {
      throw new Error(`Failed to deactivate user: ${error.message}`);
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
