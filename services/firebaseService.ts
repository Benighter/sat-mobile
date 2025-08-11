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
import { Member, Bacenta, AttendanceRecord, NewBeliever, SundayConfirmation, Guest, MemberDeletionRequest, DeletionRequestStatus, OutreachBacenta, OutreachMember } from '../types';

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
      return await firebaseUtils.retryOperation(async () => {
  console.log('[membersFirebaseService.getAll] churchId=', currentChurchId);
        const membersRef = collection(db, getChurchCollectionPath('members'));
        const querySnapshot = await getDocs(query(membersRef, where('isActive', '==', true)));

        return querySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as Member[];
      });
    } catch (error: any) {
      throw firebaseUtils.handleOfflineError('Fetch members', error);
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

  // Delete member (hard delete). If hard delete fails, fall back to soft delete.
  delete: async (memberId: string): Promise<void> => {
    try {
      const memberRef = doc(db, getChurchCollectionPath('members'), memberId);
      await deleteDoc(memberRef);
    } catch (hardErr: any) {
      console.warn('Hard delete failed, attempting soft delete fallback', hardErr?.message);
      try {
        const memberRef = doc(db, getChurchCollectionPath('members'), memberId);
        await updateDoc(memberRef, { isActive: false, lastUpdated: new Date().toISOString() });
      } catch (softErr: any) {
        throw new Error(`Failed to delete member (hard+soft): ${softErr.message}`);
      }
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

// Outreach Bacentas Service (separate collection to avoid mixing datasets)
export const outreachBacentasFirebaseService = {
  getAll: async (): Promise<OutreachBacenta[]> => {
    try {
      const ref = collection(db, getChurchCollectionPath('outreachBacentas'));
      const snapshot = await getDocs(query(ref, orderBy('name')));
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as OutreachBacenta[];
    } catch (error: any) {
      throw new Error(`Failed to fetch outreach bacentas: ${error.message}`);
    }
  },
  add: async (bacenta: Omit<OutreachBacenta, 'id'>): Promise<string> => {
    try {
      const ref = collection(db, getChurchCollectionPath('outreachBacentas'));
      const docRef = await addDoc(ref, { ...bacenta, createdAt: Timestamp.now(), lastUpdated: Timestamp.now() });
      return docRef.id;
    } catch (error: any) {
      throw new Error(`Failed to add outreach bacenta: ${error.message}`);
    }
  },
  update: async (id: string, updates: Partial<OutreachBacenta>): Promise<void> => {
    try {
      const docRef = doc(db, getChurchCollectionPath('outreachBacentas'), id);
      await updateDoc(docRef, { ...updates, lastUpdated: Timestamp.now() });
    } catch (error: any) {
      throw new Error(`Failed to update outreach bacenta: ${error.message}`);
    }
  },
  delete: async (id: string): Promise<void> => {
    try {
      const docRef = doc(db, getChurchCollectionPath('outreachBacentas'), id);
      await deleteDoc(docRef);
    } catch (error: any) {
      throw new Error(`Failed to delete outreach bacenta: ${error.message}`);
    }
  },
  onSnapshot: (callback: (bacentas: OutreachBacenta[]) => void): Unsubscribe => {
    const ref = collection(db, getChurchCollectionPath('outreachBacentas'));
    const q = query(ref, orderBy('name'));
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map(doc => ({ ...doc.data(), id: doc.id })) as OutreachBacenta[];
      callback(items);
    });
  }
};

// Outreach Members Service (separate collection)
// Helper: remove undefined fields so Firestore doesn't reject payloads
const stripUndefined = <T extends Record<string, any>>(obj: T): T => {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
};
export const outreachMembersFirebaseService = {
  getAllByMonth: async (yyyymm: string): Promise<OutreachMember[]> => {
    try {
      const ref = collection(db, getChurchCollectionPath('outreachMembers'));
      const snapshot = await getDocs(query(ref, where('outreachDatePrefix', '==', yyyymm)));
      const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as OutreachMember[];
      // Sort client-side by outreachDate desc to avoid composite index requirement
      items.sort((a, b) => (b.outreachDate || '').localeCompare(a.outreachDate || ''));
      return items;
    } catch (error: any) {
      throw new Error(`Failed to fetch outreach members: ${error.message}`);
    }
  },
  add: async (member: Omit<OutreachMember, 'id' | 'createdDate' | 'lastUpdated'>): Promise<string> => {
    try {
      const ref = collection(db, getChurchCollectionPath('outreachMembers'));
      const datePrefix = (member.outreachDate || '').slice(0, 7); // YYYY-MM
      const payload = stripUndefined({ ...member, outreachDatePrefix: datePrefix, createdDate: new Date().toISOString(), lastUpdated: new Date().toISOString() });
      const docRef = await addDoc(ref, payload);
      return docRef.id;
    } catch (error: any) {
      throw new Error(`Failed to add outreach member: ${error.message}`);
    }
  },
  update: async (id: string, updates: Partial<OutreachMember>): Promise<void> => {
    try {
      const docRef = doc(db, getChurchCollectionPath('outreachMembers'), id);
      const datePrefix = updates.outreachDate ? updates.outreachDate.slice(0, 7) : undefined;
      const payload = stripUndefined({ ...updates, ...(datePrefix ? { outreachDatePrefix: datePrefix } : {}), lastUpdated: new Date().toISOString() });
      await updateDoc(docRef, payload);
    } catch (error: any) {
      throw new Error(`Failed to update outreach member: ${error.message}`);
    }
  },
  delete: async (id: string): Promise<void> => {
    try {
      const docRef = doc(db, getChurchCollectionPath('outreachMembers'), id);
      await deleteDoc(docRef);
    } catch (error: any) {
      throw new Error(`Failed to delete outreach member: ${error.message}`);
    }
  },
  onSnapshotByMonth: (yyyymm: string, callback: (members: OutreachMember[]) => void): Unsubscribe => {
    const ref = collection(db, getChurchCollectionPath('outreachMembers'));
    const q = query(ref, where('outreachDatePrefix', '==', yyyymm));
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map(doc => ({ ...doc.data(), id: doc.id })) as OutreachMember[];
      items.sort((a, b) => (b.outreachDate || '').localeCompare(a.outreachDate || ''));
      callback(items);
    });
  },
  onSnapshot: (callback: (members: OutreachMember[]) => void): Unsubscribe => {
    const ref = collection(db, getChurchCollectionPath('outreachMembers'));
    return onSnapshot(ref, (snap) => {
      const items = snap.docs.map(doc => ({ ...doc.data(), id: doc.id })) as OutreachMember[];
      items.sort((a, b) => (b.outreachDate || '').localeCompare(a.outreachDate || ''));
      callback(items);
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

// Sunday Confirmation Service
export const confirmationFirebaseService = {
  // Get all confirmations
  getAll: async (): Promise<SundayConfirmation[]> => {
    try {
      const confirmationsRef = collection(db, getChurchCollectionPath('confirmations'));
      const querySnapshot = await getDocs(confirmationsRef);
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as SundayConfirmation[];
    } catch (error: any) {
      throw new Error(`Failed to fetch confirmations: ${error.message}`);
    }
  },

  // Get confirmations for a specific date
  getByDate: async (date: string): Promise<SundayConfirmation[]> => {
    try {
      const confirmationsRef = collection(db, getChurchCollectionPath('confirmations'));
      const q = query(confirmationsRef, where('date', '==', date));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as SundayConfirmation[];
    } catch (error: any) {
      throw new Error(`Failed to fetch confirmations for date ${date}: ${error.message}`);
    }
  },

  // Add or update confirmation record
  addOrUpdate: async (record: SundayConfirmation): Promise<void> => {
    try {
      const confirmationsRef = collection(db, getChurchCollectionPath('confirmations'));
      const recordId = record.id;
      const docRef = doc(confirmationsRef, recordId);

      // Use setDoc to create/update with specific document ID
      await setDoc(docRef, {
        ...record,
        recordedAt: Timestamp.now(),
        recordedBy: currentUser?.uid || 'unknown'
      }, { merge: true });
    } catch (error: any) {
      throw new Error(`Failed to save confirmation record: ${error.message}`);
    }
  },

  // Delete confirmation record
  delete: async (recordId: string): Promise<void> => {
    try {
      const recordRef = doc(db, getChurchCollectionPath('confirmations'), recordId);
      console.log('🗑️ Deleting confirmation document:', recordId);

      // Check if document exists before deleting
      const docSnap = await getDoc(recordRef);
      if (docSnap.exists()) {
        console.log('✅ Document exists, deleting...');
        await deleteDoc(recordRef);
        console.log('✅ Document deleted successfully');
      } else {
        console.log('⚠️ Document does not exist:', recordId);
        throw new Error(`Confirmation record not found: ${recordId}`);
      }
    } catch (error: any) {
      console.error('❌ Delete error:', error);
      throw new Error(`Failed to delete confirmation record: ${error.message}`);
    }
  },

  // Remove confirmation (soft delete with tracking)
  remove: async (id: string, removedBy: string): Promise<void> => {
    try {
      const confirmationRef = doc(db, getChurchCollectionPath('confirmations'), id);
      await updateDoc(confirmationRef, {
        status: 'Not Confirmed',
        removedBy,
        removedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
    } catch (error: any) {
      throw new Error(`Failed to remove confirmation: ${error.message}`);
    }
  },

  // Listen to confirmation changes
  onSnapshot: (callback: (records: SundayConfirmation[]) => void): Unsubscribe => {
    const confirmationsRef = collection(db, getChurchCollectionPath('confirmations'));
    const q = query(confirmationsRef, orderBy('date', 'desc'));

    return onSnapshot(q, (querySnapshot) => {
      const records = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as SundayConfirmation[];
      callback(records);
    });
  }
};

// Guest Service
export const guestFirebaseService = {
  // Get all guests
  getAll: async (): Promise<Guest[]> => {
    try {
      const guestsRef = collection(db, getChurchCollectionPath('guests'));
      const querySnapshot = await getDocs(guestsRef);
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Guest[];
    } catch (error: any) {
      throw new Error(`Failed to fetch guests: ${error.message}`);
    }
  },

  // Add new guest
  add: async (guest: Omit<Guest, 'id'>): Promise<string> => {
    try {
      const guestsRef = collection(db, getChurchCollectionPath('guests'));
      const payload = stripUndefined({
        ...guest,
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        createdBy: currentUser?.uid || 'unknown'
      });
      const docRef = await addDoc(guestsRef, payload);
      return docRef.id;
    } catch (error: any) {
      throw new Error(`Failed to add guest: ${error.message}`);
    }
  },

  // Update guest
  update: async (id: string, updates: Partial<Guest>): Promise<void> => {
    try {
      const guestRef = doc(db, getChurchCollectionPath('guests'), id);
      const payload = stripUndefined({
        ...updates,
        lastUpdated: new Date().toISOString()
      });
      await updateDoc(guestRef, payload);
    } catch (error: any) {
      throw new Error(`Failed to update guest: ${error.message}`);
    }
  },

  // Delete guest
  delete: async (id: string): Promise<void> => {
    try {
      const guestRef = doc(db, getChurchCollectionPath('guests'), id);
      await deleteDoc(guestRef);
    } catch (error: any) {
      throw new Error(`Failed to delete guest: ${error.message}`);
    }
  },

  // Listen to guest changes
  onSnapshot: (callback: (guests: Guest[]) => void): Unsubscribe => {
    const guestsRef = collection(db, getChurchCollectionPath('guests'));
    const q = query(guestsRef, orderBy('createdDate', 'desc'));

    return onSnapshot(q, (querySnapshot) => {
      const guests = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Guest[];
      callback(guests);
    });
  }
};

// Member Deletion Request Service
export const memberDeletionRequestService = {
  // Get all deletion requests for the current church
  getAll: async (): Promise<MemberDeletionRequest[]> => {
    try {
      const requestsRef = collection(db, getChurchCollectionPath('memberDeletionRequests'));
      const q = query(requestsRef, orderBy('requestedAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as MemberDeletionRequest[];
    } catch (error: any) {
      throw new Error(`Failed to fetch deletion requests: ${error.message}`);
    }
  },

  // Get pending deletion requests for a specific admin
  getPendingForAdmin: async (adminId: string): Promise<MemberDeletionRequest[]> => {
    try {
      const requestsRef = collection(db, getChurchCollectionPath('memberDeletionRequests'));
      const q = query(
        requestsRef,
        where('status', '==', 'pending'),
        orderBy('requestedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const allPending = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as MemberDeletionRequest[];

      // Filter for requests from leaders supervised by this admin
      // For now, return all pending requests - can be refined based on hierarchy
      return allPending;
    } catch (error: any) {
      throw new Error(`Failed to fetch pending deletion requests: ${error.message}`);
    }
  },

  // Create a new deletion request
  create: async (request: Omit<MemberDeletionRequest, 'id'>): Promise<string> => {
    try {
      const requestsRef = collection(db, getChurchCollectionPath('memberDeletionRequests'));

      // Set expiration date (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const docRef = await addDoc(requestsRef, {
        ...request,
        requestedAt: new Date().toISOString(),
        status: 'pending' as DeletionRequestStatus,
        churchId: firebaseUtils.getCurrentChurchId(),
        expiresAt: expiresAt.toISOString()
      });
      return docRef.id;
    } catch (error: any) {
      throw new Error(`Failed to create deletion request: ${error.message}`);
    }
  },

  // Update deletion request (approve/reject)
  update: async (requestId: string, updates: Partial<MemberDeletionRequest>): Promise<void> => {
    try {
      const requestRef = doc(db, getChurchCollectionPath('memberDeletionRequests'), requestId);
      await updateDoc(requestRef, {
        ...updates,
        reviewedAt: new Date().toISOString()
      });
    } catch (error: any) {
      throw new Error(`Failed to update deletion request: ${error.message}`);
    }
  },

  // Delete a deletion request (cleanup)
  delete: async (requestId: string): Promise<void> => {
    try {
      const requestRef = doc(db, getChurchCollectionPath('memberDeletionRequests'), requestId);
      await deleteDoc(requestRef);
    } catch (error: any) {
      throw new Error(`Failed to delete deletion request: ${error.message}`);
    }
  },

  // Check if a member has pending deletion requests
  hasPendingRequest: async (memberId: string): Promise<boolean> => {
    try {
      const requestsRef = collection(db, getChurchCollectionPath('memberDeletionRequests'));
      const q = query(
        requestsRef,
        where('memberId', '==', memberId),
        where('status', '==', 'pending')
      );
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error: any) {
      console.error('Error checking pending requests:', error);
      return false;
    }
  },

  // Listen to deletion requests changes
  onSnapshot: (callback: (requests: MemberDeletionRequest[]) => void): Unsubscribe => {
    const requestsRef = collection(db, getChurchCollectionPath('memberDeletionRequests'));
    const q = query(requestsRef, orderBy('requestedAt', 'desc'));

    return onSnapshot(q, (querySnapshot) => {
      const requests = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as MemberDeletionRequest[];
      callback(requests);
    });
  },

  // Clear all completed requests (approved/rejected) regardless of age
  clearCompletedRequests: async (): Promise<number> => {
    try {
      const requestsRef = collection(db, getChurchCollectionPath('memberDeletionRequests'));

      // Get all approved/rejected requests
      const completedRequestsQuery = query(
        requestsRef,
        where('status', 'in', ['approved', 'rejected'])
      );

      const completedRequestsSnapshot = await getDocs(completedRequestsQuery);
      const batch = writeBatch(db);

      completedRequestsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      const totalCleared = completedRequestsSnapshot.docs.length;
      console.log(`Cleared ${totalCleared} completed deletion requests`);
      return totalCleared;
    } catch (error: any) {
      console.error('Failed to clear completed deletion requests:', error);
      throw new Error(`Failed to clear completed deletion requests: ${error.message}`);
    }
  },

  // Clean up old requests (approved/rejected older than 30 days)
  cleanupOldRequests: async (): Promise<void> => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const requestsRef = collection(db, getChurchCollectionPath('memberDeletionRequests'));

      // Clean up old approved/rejected requests
      const oldRequestsQuery = query(
        requestsRef,
        where('status', 'in', ['approved', 'rejected']),
        where('reviewedAt', '<', thirtyDaysAgo.toISOString())
      );

      const oldRequestsSnapshot = await getDocs(oldRequestsQuery);
      const batch = writeBatch(db);

      oldRequestsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Also handle expired pending requests
      const now = new Date().toISOString();
      const expiredRequestsQuery = query(
        requestsRef,
        where('status', '==', 'pending'),
        where('expiresAt', '<', now)
      );

      const expiredRequestsSnapshot = await getDocs(expiredRequestsQuery);

      expiredRequestsSnapshot.docs.forEach(doc => {
        // Update expired requests to rejected status instead of deleting
        const docRef = doc.ref;
        batch.update(docRef, {
          status: 'rejected',
          reviewedAt: now,
          adminNotes: 'Request automatically rejected due to expiration (7 days)',
          reviewedBy: 'system',
          reviewedByName: 'System Auto-Rejection'
        });
      });

      await batch.commit();

      const totalCleaned = oldRequestsSnapshot.docs.length;
      const totalExpired = expiredRequestsSnapshot.docs.length;

      console.log(`Cleaned up ${totalCleaned} old deletion requests and expired ${totalExpired} pending requests`);
    } catch (error: any) {
      console.error('Failed to cleanup old deletion requests:', error);
    }
  },

  // Check and handle expired requests
  handleExpiredRequests: async (): Promise<number> => {
    try {
      const now = new Date().toISOString();
      const requestsRef = collection(db, getChurchCollectionPath('memberDeletionRequests'));

      const expiredQuery = query(
        requestsRef,
        where('status', '==', 'pending'),
        where('expiresAt', '<', now)
      );

      const querySnapshot = await getDocs(expiredQuery);
      const batch = writeBatch(db);

      querySnapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          status: 'rejected',
          reviewedAt: now,
          adminNotes: 'Request automatically rejected due to expiration (7 days)',
          reviewedBy: 'system',
          reviewedByName: 'System Auto-Rejection'
        });
      });

      await batch.commit();
      return querySnapshot.docs.length;
    } catch (error: any) {
      console.error('Failed to handle expired requests:', error);
      return 0;
    }
  }
};

// Utility Functions
export const firebaseUtils = {
  // Check if error is due to offline status
  isOfflineError: (error: any): boolean => {
    return error?.code === 'unavailable' ||
           error?.message?.includes('offline') ||
           error?.message?.includes('network') ||
           error?.message?.includes('backend');
  },

  // Handle offline errors gracefully
  handleOfflineError: (operation: string, error: any): Error => {
    if (firebaseUtils.isOfflineError(error)) {
      return new Error(`${operation} failed: You appear to be offline. Please check your internet connection and try again.`);
    }
    return new Error(`${operation} failed: ${error.message}`);
  },

  // Retry operation with exponential backoff
  retryOperation: async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        if (attempt === maxRetries || !firebaseUtils.isOfflineError(error)) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  },

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
  // Explicitly set church context (used for impersonation)
  setChurchContext: (churchId: string | null) => {
    currentChurchId = churchId;
  },
  // Debug helper: fetch raw counts from a church's subcollections (no filters)
  debugFetchChurchCollections: async (churchId: string) => {
    const result: any = { churchId };
    const collNames = ['members', 'bacentas', 'attendance', 'newBelievers', 'sundayConfirmations'];
    for (const name of collNames) {
      try {
        const snap = await getDocs(collection(db, `churches/${churchId}/${name}`));
        result[name] = {
          count: snap.size,
          sample: snap.docs.slice(0, 5).map(d => ({ id: d.id, ...d.data() }))
        };
      } catch (e: any) {
        result[name] = { error: e?.message || String(e) };
      }
    }
    return result;
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
