// Firebase Service Layer for SAT Mobile
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  enableNetwork,
  disableNetwork,
  connectFirestoreEmulator,
  Timestamp,
  DocumentReference,
  QuerySnapshot,
  DocumentSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User
} from 'firebase/auth';
import { db, auth } from '../firebase.config';
import { Member, Bacenta, AttendanceRecord, NewBeliever } from '../types';

// Types for Firebase operations
export interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  churchId?: string;
}

export interface FirebaseError {
  code: string;
  message: string;
}

// Current user and church context
let currentUser: FirebaseUser | null = null;
let currentChurchId: string | null = null;

// Authentication Service
export const authService = {
  // Sign in with email and password
  signIn: async (email: string, password: string): Promise<FirebaseUser> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Get user data from Firestore - first try direct lookup by UID
      let userDoc = await getDoc(doc(db, 'users', user.uid));
      let userData = userDoc.data();

      // If not found, try fallback search for legacy users (created with auto-generated IDs)
      if (!userData) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('uid', '==', user.uid));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const legacyUserDoc = querySnapshot.docs[0];
          userData = legacyUserDoc.data();

          // Migrate legacy user document to use UID as document ID
          await setDoc(doc(db, 'users', user.uid), userData);
          // Delete the old document with auto-generated ID
          await deleteDoc(legacyUserDoc.ref);
        }
      }

      currentUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        churchId: userData?.churchId
      };

      currentChurchId = userData?.churchId || null;
      return currentUser;
    } catch (error: any) {
      // Pass through the original Firebase error code for better error handling
      throw error;
    }
  },



  // Sign up new user
  signUp: async (email: string, password: string, displayName: string, churchId: string): Promise<FirebaseUser> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user document in Firestore with user UID as document ID
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName,
        churchId,
        role: 'member',
        createdAt: Timestamp.now(),
        lastLoginAt: Timestamp.now(),
        isActive: true
      });

      currentUser = {
        uid: user.uid,
        email: user.email,
        displayName,
        churchId
      };

      currentChurchId = churchId;
      return currentUser;
    } catch (error: any) {
      // Pass through the original Firebase error for better error handling
      throw error;
    }
  },

  // Register new user with extended profile
  register: async (email: string, password: string, profile: {
    firstName: string;
    lastName: string;
    churchName: string;
    phoneNumber: string;
    role: string;
  }): Promise<FirebaseUser> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const displayName = `${profile.firstName} ${profile.lastName}`;

      // SECURITY FIX: Generate unique church ID using user UID to prevent data leakage
      // Each user gets their own isolated church context
      const churchId = `church-${user.uid}`;

      // Create user document in Firestore with user UID as document ID
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName,
        firstName: profile.firstName,
        lastName: profile.lastName,
        churchId,
        churchName: profile.churchName,
        phoneNumber: profile.phoneNumber,
        role: profile.role,
        createdAt: Timestamp.now(),
        lastLoginAt: Timestamp.now(),
        isActive: true
      });

      // Create the church document for this user
      await setDoc(doc(db, 'churches', churchId), {
        name: profile.churchName,
        address: '',
        contactInfo: {
          phone: profile.phoneNumber,
          email: user.email,
          website: ''
        },
        settings: {
          timezone: 'America/New_York',
          defaultMinistries: ['Choir', 'Dancing Stars', 'Ushers', 'Arrival Stars', 'Airport Stars', 'Media']
        },
        createdAt: Timestamp.now(),
        lastUpdated: Timestamp.now(),
        ownerId: user.uid // Track who owns this church
      });

      currentUser = {
        uid: user.uid,
        email: user.email,
        displayName,
        churchId
      };

      currentChurchId = churchId;
      return currentUser;
    } catch (error: any) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  },

  // Sign out
  signOut: async (): Promise<void> => {
    try {
      await signOut(auth);
      currentUser = null;
      currentChurchId = null;
    } catch (error: any) {
      throw new Error(`Sign out failed: ${error.message}`);
    }
  },

  // Reset password
  resetPassword: async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      // Pass through the original Firebase error for better error handling
      throw error;
    }
  },

  // Change password (requires current password for reauthentication)
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error('No authenticated user found');
      }

      // Create credential for reauthentication
      const credential = EmailAuthProvider.credential(user.email, currentPassword);

      // Reauthenticate user
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);
    } catch (error: any) {
      // Pass through the original Firebase error for better error handling
      throw error;
    }
  },

  // Get current user
  getCurrentUser: (): FirebaseUser | null => currentUser,

  // Listen to auth state changes
  onAuthStateChanged: (callback: (user: FirebaseUser | null) => void): Unsubscribe => {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Get user data from Firestore - first try direct lookup by UID
        let userDoc = await getDoc(doc(db, 'users', user.uid));
        let userData = userDoc.data();

        // If not found, try fallback search for legacy users (created with auto-generated IDs)
        if (!userData) {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('uid', '==', user.uid));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const legacyUserDoc = querySnapshot.docs[0];
            userData = legacyUserDoc.data();

            // Migrate legacy user document to use UID as document ID
            await setDoc(doc(db, 'users', user.uid), userData);
            // Delete the old document with auto-generated ID
            await deleteDoc(legacyUserDoc.ref);
          }
        }

        currentUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          churchId: userData?.churchId
        };

        currentChurchId = userData?.churchId || null;
        callback(currentUser);
      } else {
        currentUser = null;
        currentChurchId = null;
        callback(null);
      }
    });
  },

  // Force refresh current user context (useful after profile updates)
  refreshCurrentUser: async (): Promise<FirebaseUser | null> => {
    const user = auth.currentUser;
    if (user) {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      currentUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        churchId: userData?.churchId
      };

      currentChurchId = userData?.churchId || null;
      return currentUser;
    }
    return null;
  },

  // Check if email already exists in the system
  checkEmailExists: async (email: string): Promise<boolean> => {
    try {
      const trimmedEmail = email.trim().toLowerCase();

      if (!trimmedEmail) {
        return false;
      }

      // Search for users with the exact email (across all users)
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', trimmedEmail),
        where('isActive', '==', true)
      );

      const usersSnapshot = await getDocs(usersQuery);
      return !usersSnapshot.empty;
    } catch (error: any) {
      console.error('Error checking email existence:', error);
      // Return false on error to avoid blocking registration
      return false;
    }
  }
};

// REMOVED: ensureDefaultChurchExists function - no longer needed since each user gets their own church

// Helper function to get church collection path
const getChurchCollectionPath = (collectionName: string): string => {
  if (!currentChurchId) {
    throw new Error('No church context available. User must be signed in.');
  }
  return `churches/${currentChurchId}/${collectionName}`;
};

// Members Service
export const membersFirebaseService = {
  // Get all members
  getAll: async (): Promise<Member[]> => {
    try {
      const membersRef = collection(db, getChurchCollectionPath('members'));
      const querySnapshot = await getDocs(query(membersRef, where('isActive', '==', true)));
      
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Member[];
    } catch (error: any) {
      throw new Error(`Failed to fetch members: ${error.message}`);
    }
  },

  // Add new member
  add: async (member: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>): Promise<string> => {
    try {
      const membersRef = collection(db, getChurchCollectionPath('members'));
      const docRef = await addDoc(membersRef, {
        ...member,
        isActive: true,
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
      
      return docRef.id;
    } catch (error: any) {
      throw new Error(`Failed to add member: ${error.message}`);
    }
  },

  // Update member
  update: async (memberId: string, updates: Partial<Member>): Promise<void> => {
    try {
      const memberRef = doc(db, getChurchCollectionPath('members'), memberId);
      await updateDoc(memberRef, {
        ...updates,
        lastUpdated: new Date().toISOString()
      });
    } catch (error: any) {
      throw new Error(`Failed to update member: ${error.message}`);
    }
  },

  // Delete member (soft delete)
  delete: async (memberId: string): Promise<void> => {
    try {
      const memberRef = doc(db, getChurchCollectionPath('members'), memberId);
      await updateDoc(memberRef, {
        isActive: false,
        lastUpdated: new Date().toISOString()
      });
    } catch (error: any) {
      throw new Error(`Failed to delete member: ${error.message}`);
    }
  },

  // Listen to members changes
  onSnapshot: (callback: (members: Member[]) => void): Unsubscribe => {
    const membersRef = collection(db, getChurchCollectionPath('members'));
    // Temporarily using simple query to avoid index requirement
    // TODO: Create composite index for isActive + lastName in Firebase Console
    const q = query(membersRef, where('isActive', '==', true));

    return onSnapshot(q, (querySnapshot) => {
      const members = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Member[];

      // Sort in memory for now
      members.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
      callback(members);
    });
  }
};

// Bacentas Service
export const bacentasFirebaseService = {
  // Get all bacentas
  getAll: async (): Promise<Bacenta[]> => {
    try {
      const bacentasRef = collection(db, getChurchCollectionPath('bacentas'));
      const querySnapshot = await getDocs(query(bacentasRef, orderBy('name')));

      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Bacenta[];
    } catch (error: any) {
      throw new Error(`Failed to fetch bacentas: ${error.message}`);
    }
  },

  // Add new bacenta
  add: async (bacenta: Omit<Bacenta, 'id'>): Promise<string> => {
    try {
      const bacentasRef = collection(db, getChurchCollectionPath('bacentas'));
      const docRef = await addDoc(bacentasRef, {
        ...bacenta,
        createdAt: Timestamp.now(),
        lastUpdated: Timestamp.now()
      });

      return docRef.id;
    } catch (error: any) {
      throw new Error(`Failed to add bacenta: ${error.message}`);
    }
  },

  // Update bacenta
  update: async (bacentaId: string, updates: Partial<Bacenta>): Promise<void> => {
    try {
      const bacentaRef = doc(db, getChurchCollectionPath('bacentas'), bacentaId);
      await updateDoc(bacentaRef, {
        ...updates,
        lastUpdated: Timestamp.now()
      });
    } catch (error: any) {
      throw new Error(`Failed to update bacenta: ${error.message}`);
    }
  },

  // Delete bacenta
  delete: async (bacentaId: string): Promise<void> => {
    try {
      const bacentaRef = doc(db, getChurchCollectionPath('bacentas'), bacentaId);
      await deleteDoc(bacentaRef);
    } catch (error: any) {
      throw new Error(`Failed to delete bacenta: ${error.message}`);
    }
  },

  // Listen to bacentas changes
  onSnapshot: (callback: (bacentas: Bacenta[]) => void): Unsubscribe => {
    const bacentasRef = collection(db, getChurchCollectionPath('bacentas'));
    const q = query(bacentasRef, orderBy('name'));

    return onSnapshot(q, (querySnapshot) => {
      const bacentas = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Bacenta[];
      callback(bacentas);
    });
  }
};

// New Believers Service
export const newBelieversFirebaseService = {
  // Get all new believers
  getAll: async (): Promise<NewBeliever[]> => {
    try {
      const newBelieversRef = collection(db, getChurchCollectionPath('newBelievers'));
      // Temporarily using simple query to avoid index requirement
      // TODO: Create composite index for isActive + joinedDate in Firebase Console
      const querySnapshot = await getDocs(query(newBelieversRef, where('isActive', '==', true)));

      const newBelievers = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as NewBeliever[];

      // Sort in memory for now
      newBelievers.sort((a, b) => new Date(b.joinedDate || 0).getTime() - new Date(a.joinedDate || 0).getTime());
      return newBelievers;
    } catch (error: any) {
      throw new Error(`Failed to fetch new believers: ${error.message}`);
    }
  },

  // Add new believer
  add: async (newBeliever: Omit<NewBeliever, 'id' | 'createdDate' | 'lastUpdated'>): Promise<string> => {
    try {
      const newBelieversRef = collection(db, getChurchCollectionPath('newBelievers'));
      const docRef = await addDoc(newBelieversRef, {
        ...newBeliever,
        isActive: true,
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });

      return docRef.id;
    } catch (error: any) {
      throw new Error(`Failed to add new believer: ${error.message}`);
    }
  },

  // Update new believer
  update: async (newBelieverId: string, updates: Partial<NewBeliever>): Promise<void> => {
    try {
      const newBelieverRef = doc(db, getChurchCollectionPath('newBelievers'), newBelieverId);
      await updateDoc(newBelieverRef, {
        ...updates,
        lastUpdated: new Date().toISOString()
      });
    } catch (error: any) {
      throw new Error(`Failed to update new believer: ${error.message}`);
    }
  },

  // Delete new believer (soft delete)
  delete: async (newBelieverId: string): Promise<void> => {
    try {
      const newBelieverRef = doc(db, getChurchCollectionPath('newBelievers'), newBelieverId);
      await updateDoc(newBelieverRef, {
        isActive: false,
        lastUpdated: new Date().toISOString()
      });
    } catch (error: any) {
      throw new Error(`Failed to delete new believer: ${error.message}`);
    }
  },

  // Listen to new believers changes
  onSnapshot: (callback: (newBelievers: NewBeliever[]) => void): Unsubscribe => {
    const newBelieversRef = collection(db, getChurchCollectionPath('newBelievers'));
    // Temporarily using simple query to avoid index requirement
    // TODO: Create composite index for isActive + joinedDate in Firebase Console
    const q = query(newBelieversRef, where('isActive', '==', true));

    return onSnapshot(q, (querySnapshot) => {
      const newBelievers = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as NewBeliever[];

      // Sort in memory for now
      newBelievers.sort((a, b) => new Date(b.joinedDate || 0).getTime() - new Date(a.joinedDate || 0).getTime());
      callback(newBelievers);
    });
  }
};

// Attendance Service
export const attendanceFirebaseService = {
  // Get all attendance records
  getAll: async (): Promise<AttendanceRecord[]> => {
    try {
      const attendanceRef = collection(db, getChurchCollectionPath('attendance'));
      const querySnapshot = await getDocs(query(attendanceRef, orderBy('date', 'desc')));

      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as AttendanceRecord[];
    } catch (error: any) {
      throw new Error(`Failed to fetch attendance records: ${error.message}`);
    }
  },

  // Get attendance for specific date
  getByDate: async (date: string): Promise<AttendanceRecord[]> => {
    try {
      const attendanceRef = collection(db, getChurchCollectionPath('attendance'));
      const querySnapshot = await getDocs(query(attendanceRef, where('date', '==', date)));

      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as AttendanceRecord[];
    } catch (error: any) {
      throw new Error(`Failed to fetch attendance for date ${date}: ${error.message}`);
    }
  },

  // Add or update attendance record
  addOrUpdate: async (record: AttendanceRecord): Promise<void> => {
    try {
      const attendanceRef = collection(db, getChurchCollectionPath('attendance'));
      const recordId = record.id;
      const docRef = doc(attendanceRef, recordId);

      // Use setDoc to create/update with specific document ID
      await setDoc(docRef, {
        ...record,
        recordedAt: Timestamp.now(),
        recordedBy: currentUser?.uid || 'unknown'
      }, { merge: true });
    } catch (error: any) {
      throw new Error(`Failed to save attendance record: ${error.message}`);
    }
  },

  // Delete attendance record
  delete: async (recordId: string): Promise<void> => {
    try {
      const recordRef = doc(db, getChurchCollectionPath('attendance'), recordId);
      console.log('🗑️ Deleting attendance document:', recordId);

      // Check if document exists before deleting
      const docSnap = await getDoc(recordRef);
      if (docSnap.exists()) {
        console.log('✅ Document exists, deleting...');
        await deleteDoc(recordRef);
        console.log('✅ Document deleted successfully');
      } else {
        console.log('⚠️ Document does not exist:', recordId);
        throw new Error(`Attendance record not found: ${recordId}`);
      }
    } catch (error: any) {
      console.error('❌ Delete error:', error);
      throw new Error(`Failed to delete attendance record: ${error.message}`);
    }
  },

  // Listen to attendance changes
  onSnapshot: (callback: (records: AttendanceRecord[]) => void): Unsubscribe => {
    const attendanceRef = collection(db, getChurchCollectionPath('attendance'));
    const q = query(attendanceRef, orderBy('date', 'desc'));

    return onSnapshot(q, (querySnapshot) => {
      const records = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as AttendanceRecord[];
      callback(records);
    });
  },

  // Batch operations for bulk attendance updates
  batchUpdate: async (records: AttendanceRecord[]): Promise<void> => {
    try {
      const batch = writeBatch(db);
      const attendanceRef = collection(db, getChurchCollectionPath('attendance'));

      records.forEach(record => {
        const docRef = doc(attendanceRef, record.id);
        batch.set(docRef, {
          ...record,
          recordedAt: Timestamp.now(),
          recordedBy: currentUser?.uid || 'unknown'
        });
      });

      await batch.commit();
    } catch (error: any) {
      throw new Error(`Failed to batch update attendance: ${error.message}`);
    }
  }
};

// Utility Functions
export const firebaseUtils = {
  // Enable offline persistence
  enableOffline: async (): Promise<void> => {
    try {
      await disableNetwork(db);
      console.log('Firebase offline mode enabled');
    } catch (error: any) {
      console.error('Failed to enable offline mode:', error.message);
    }
  },

  // Enable online mode
  enableOnline: async (): Promise<void> => {
    try {
      await enableNetwork(db);
      console.log('Firebase online mode enabled');
    } catch (error: any) {
      console.error('Failed to enable online mode:', error.message);
    }
  },

  // Check if user is authenticated and has church context
  isReady: (): boolean => {
    return currentUser !== null && currentChurchId !== null;
  },

  // Get current church ID
  getCurrentChurchId: (): string | null => {
    return currentChurchId;
  },

  // Batch delete multiple documents
  batchDelete: async (collectionName: string, documentIds: string[]): Promise<void> => {
    try {
      const batch = writeBatch(db);
      const collectionRef = collection(db, getChurchCollectionPath(collectionName));

      documentIds.forEach(id => {
        const docRef = doc(collectionRef, id);
        batch.delete(docRef);
      });

      await batch.commit();
    } catch (error: any) {
      throw new Error(`Failed to batch delete documents: ${error.message}`);
    }
  },

  // Export all church data
  exportChurchData: async (): Promise<any> => {
    try {
      if (!currentChurchId) {
        throw new Error('No church context available');
      }

      const [members, bacentas, newBelievers, attendance] = await Promise.all([
        membersFirebaseService.getAll(),
        bacentasFirebaseService.getAll(),
        newBelieversFirebaseService.getAll(),
        attendanceFirebaseService.getAll()
      ]);

      return {
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        churchId: currentChurchId,
        members,
        bacentas,
        newBelievers,
        attendance
      };
    } catch (error: any) {
      throw new Error(`Failed to export church data: ${error.message}`);
    }
  },

  // Import church data (for migration)
  importChurchData: async (data: any): Promise<void> => {
    try {
      if (!currentChurchId) {
        throw new Error('No church context available');
      }

      const batch = writeBatch(db);

      // Import members
      if (data.members) {
        const membersRef = collection(db, getChurchCollectionPath('members'));
        data.members.forEach((member: Member) => {
          const docRef = doc(membersRef, member.id);
          batch.set(docRef, member);
        });
      }

      // Import bacentas
      if (data.bacentas) {
        const bacentasRef = collection(db, getChurchCollectionPath('bacentas'));
        data.bacentas.forEach((bacenta: Bacenta) => {
          const docRef = doc(bacentasRef, bacenta.id);
          batch.set(docRef, bacenta);
        });
      }

      // Import new believers
      if (data.newBelievers) {
        const newBelieversRef = collection(db, getChurchCollectionPath('newBelievers'));
        data.newBelievers.forEach((newBeliever: NewBeliever) => {
          const docRef = doc(newBelieversRef, newBeliever.id);
          batch.set(docRef, newBeliever);
        });
      }

      // Import attendance
      if (data.attendance) {
        const attendanceRef = collection(db, getChurchCollectionPath('attendance'));
        data.attendance.forEach((record: AttendanceRecord) => {
          const docRef = doc(attendanceRef, record.id);
          batch.set(docRef, record);
        });
      }

      await batch.commit();
      console.log('Church data imported successfully');
    } catch (error: any) {
      throw new Error(`Failed to import church data: ${error.message}`);
    }
  }
};

// Initialize Firebase services
export const initializeFirebaseServices = async (): Promise<void> => {
  try {
    // Enable offline persistence
    // Note: This should be called before any other Firestore operations
    console.log('Firebase services initialized');
  } catch (error: any) {
    console.error('Failed to initialize Firebase services:', error.message);
  }
};
