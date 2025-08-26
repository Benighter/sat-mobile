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
  Timestamp,
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
  fetchSignInMethodsForEmail
} from 'firebase/auth';
import { db, auth } from '../firebase.config';
import { Member, Bacenta, AttendanceRecord, NewBeliever, SundayConfirmation, Guest, MemberDeletionRequest, DeletionRequestStatus, OutreachBacenta, OutreachMember, PrayerRecord, MeetingRecord, TitheRecord } from '../types';

// Types for Firebase operations
export interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  churchId?: string;
  // Indicates this user registered when Ministry Mode was enabled
  isMinistryAccount?: boolean;
  // Multi-context support: map of context church IDs
  contexts?: {
    defaultChurchId?: string;
    ministryChurchId?: string;
  };
}

export interface FirebaseError {
  code: string;
  message: string;
}

// Current user and church context
let currentUser: FirebaseUser | null = null;
let currentChurchId: string | null = null;

// Helper: map a real email to a ministry-only Auth email alias (same inbox for providers that support plus-addressing)
const toMinistryAuthEmail = (email: string): string => {
  const trimmed = (email || '').trim();
  const [local, domain] = trimmed.split('@');
  if (!local || !domain) return trimmed;
  if (local.includes('+ministry')) return trimmed.toLowerCase();
  // If local already has a plus tag, prepend ministry.
  if (local.includes('+')) {
    const [name, tag] = local.split('+', 2);
    return `${name}+ministry.${tag}@${domain}`.toLowerCase();
  }
  return `${local}+ministry@${domain}`.toLowerCase();
};

// Authentication Service
export const authService = {
  // Sign in with email and password
  signIn: async (email: string, password: string): Promise<FirebaseUser> => {
    try {
  const trimmedEmail = (email || '').trim().toLowerCase();
  const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
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

      // Prefer Firestore profile values for display name and email (Auth may not have a name; email may be aliased)
      currentUser = {
        uid: user.uid,
        email: (userData?.email as string | null) || user.email,
        displayName: (userData?.displayName as string | null) || user.displayName,
        churchId: userData?.churchId,
        isMinistryAccount: userData?.isMinistryAccount === true,
        contexts: userData?.contexts
      };

      currentChurchId = userData?.churchId || null;
      return currentUser;
    } catch (error: any) {
      // Pass through the original Firebase error code for better error handling
      throw error;
    }
  },

  // Sign in to ministry account (uses aliased email under the hood)
  signInMinistry: async (email: string, password: string): Promise<FirebaseUser> => {
    try {
      const ministryEmail = toMinistryAuthEmail(email);
      const userCredential = await signInWithEmailAndPassword(auth, ministryEmail, password);
      const user = userCredential.user;

      // Load Firestore profile using this UID
      let userDoc = await getDoc(doc(db, 'users', user.uid));
      let userData = userDoc.data();
      if (!userData) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('uid', '==', user.uid));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const legacyUserDoc = querySnapshot.docs[0];
          userData = legacyUserDoc.data();
          await setDoc(doc(db, 'users', user.uid), userData);
          await deleteDoc(legacyUserDoc.ref);
        }
      }

      currentUser = {
        uid: user.uid,
        email: (userData?.email as string | null) || email.trim().toLowerCase(),
        displayName: (userData?.displayName as string | null) || user.displayName,
        churchId: userData?.churchId,
        isMinistryAccount: true,
        contexts: userData?.contexts
      };
      currentChurchId = userData?.churchId || null;
      return currentUser;
    } catch (error: any) {
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
    ministry?: string; // optional selected ministry during signup
  // when true, this account is restricted to "Ministry mode" logins
  isMinistryAccount?: boolean;
  }): Promise<FirebaseUser> => {
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const displayName = `${profile.firstName} ${profile.lastName}`;
      let userAuth = null as any;
      let userUid = '';

      // Pre-check if email exists in Firebase Auth to avoid sign-up 400s
      const methods = await fetchSignInMethodsForEmail(auth, trimmedEmail);
      if (methods && methods.length > 0) {
        // Email already in Auth; verify password by signing in
        try {
          const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
          userAuth = cred.user;
        } catch (err: any) {
          if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
            throw new Error('auth/wrong-password');
          }
          throw err;
        }
      } else {
        // Not in Auth; create new (guard for late email-in-use)
        try {
          const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
          userAuth = cred.user;
        } catch (createErr: any) {
          if (createErr?.code === 'auth/email-already-in-use') {
            // Fallback to sign-in verification
            try {
              const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
              userAuth = cred.user;
            } catch (err: any) {
              if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
                throw new Error('auth/wrong-password');
              }
              throw err;
            }
          } else {
            throw createErr;
          }
        }
      }

      userUid = userAuth.uid;
      const usersDocRef = doc(db, 'users', userUid);
      const usersDocSnap = await getDoc(usersDocRef);

      // Resolve contexts
      let defaultChurchId: string | undefined;
      let ministryChurchId: string | undefined;
      const isMinistryFlow = profile.isMinistryAccount === true;

      if (usersDocSnap.exists()) {
        const data: any = usersDocSnap.data() || {};
        defaultChurchId = data?.contexts?.defaultChurchId || data?.churchId;
        ministryChurchId = data?.contexts?.ministryChurchId;
      }

      if (isMinistryFlow) {
        if (!ministryChurchId) {
          ministryChurchId = `church-ministry-${userUid}`;
          await setDoc(doc(db, 'churches', ministryChurchId), {
            name: profile.churchName,
            address: '',
            contactInfo: { phone: profile.phoneNumber, email: userAuth.email, website: '' },
            settings: {
              timezone: 'America/New_York',
              defaultMinistries: ['Choir', 'Dancing Stars', 'Ushers', 'Arrival Stars', 'Airport Stars', 'Media']
            },
            createdAt: Timestamp.now(),
            lastUpdated: Timestamp.now(),
            ownerId: userUid
          });
        }
      } else {
        if (!defaultChurchId) {
          defaultChurchId = `church-${userUid}`;
          await setDoc(doc(db, 'churches', defaultChurchId), {
            name: profile.churchName,
            address: '',
            contactInfo: { phone: profile.phoneNumber, email: userAuth.email, website: '' },
            settings: {
              timezone: 'America/New_York',
              defaultMinistries: ['Choir', 'Dancing Stars', 'Ushers', 'Arrival Stars', 'Airport Stars', 'Media']
            },
            createdAt: Timestamp.now(),
            lastUpdated: Timestamp.now(),
            ownerId: userUid
          });
        }
      }

      const mergedUser: any = {
        uid: userUid,
        email: userAuth.email,
        displayName,
        firstName: profile.firstName,
        lastName: profile.lastName,
        churchId: (defaultChurchId || ministryChurchId),
        churchName: profile.churchName,
        phoneNumber: profile.phoneNumber,
        role: profile.role,
        preferences: profile.ministry ? { ministryName: profile.ministry } : {},
        isMinistryAccount: isMinistryFlow || false,
        contexts: {
          ...(defaultChurchId ? { defaultChurchId } : {}),
          ...(ministryChurchId ? { ministryChurchId } : {})
        },
        lastLoginAt: Timestamp.now(),
        isActive: true
      };

      if (usersDocSnap.exists()) {
        await setDoc(usersDocRef, mergedUser, { merge: true });
      } else {
        mergedUser.createdAt = Timestamp.now();
        await setDoc(usersDocRef, mergedUser);
      }

      currentUser = {
        uid: userUid,
        email: userAuth.email,
        displayName,
        churchId: isMinistryFlow ? (ministryChurchId as string) : (defaultChurchId as string),
        isMinistryAccount: isMinistryFlow,
        contexts: mergedUser.contexts
      };

      currentChurchId = currentUser.churchId || null;
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
  resetPassword: async (email: string, opts?: { ministry?: boolean }): Promise<void> => {
    try {
      const target = opts?.ministry ? toMinistryAuthEmail(email) : email;
      await sendPasswordResetEmail(auth, target);
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
          email: (userData?.email as string | null) || user.email,
          displayName: (userData?.displayName as string | null) || user.displayName,
          churchId: userData?.churchId,
          isMinistryAccount: userData?.isMinistryAccount === true,
          contexts: userData?.contexts
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
        email: (userData?.email as string | null) || user.email,
        displayName: (userData?.displayName as string | null) || user.displayName,
        churchId: userData?.churchId,
        isMinistryAccount: userData?.isMinistryAccount === true,
        contexts: userData?.contexts
      };

      currentChurchId = userData?.churchId || null;
      return currentUser;
    }
    return null;
  },

  // Check if email already exists in the system
  checkEmailExists: async (email: string, opts?: { ministry?: boolean }): Promise<boolean> => {
    try {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) return false;

      // 1) Check via Firebase Auth (handles case-insensitivity and aliasing)
      if (opts?.ministry) {
        const alias = toMinistryAuthEmail(trimmedEmail);
        const methods = await fetchSignInMethodsForEmail(auth, alias);
        if (methods && methods.length > 0) return true;
      } else {
        const methods = await fetchSignInMethodsForEmail(auth, trimmedEmail);
        if (methods && methods.length > 0) return true;
      }

      // 2) Fallback to Firestore by exact email (case-sensitive). No isActive filter here.
      const usersQuery = query(collection(db, 'users'), where('email', '==', trimmedEmail));
      const snap = await getDocs(usersQuery);
      if (snap.empty) return false;

      if (typeof opts?.ministry !== 'boolean') return true;

      const wantsMinistry = opts.ministry === true;
      const anyMatch = snap.docs.some((d) => {
        const data: any = d.data() || {};
        const isMinistry = data?.isMinistryAccount === true;
        return wantsMinistry ? isMinistry : !isMinistry; // undefined => normal
      });
      return anyMatch;
    } catch (error: any) {
      console.error('Error checking email existence:', error);
      return false;
    }
  }
};

// Switch the active data context (default vs ministry) after sign-in
// (moved to bottom) setActiveContext

// REMOVED: ensureDefaultChurchExists function - no longer needed since each user gets their own church

// Helper function to get church collection path
const getChurchCollectionPath = (collectionName: string): string => {
  if (!currentChurchId) {
    throw new Error('No church context available. User must be signed in.');
  }
  return `churches/${currentChurchId}/${collectionName}`;
};

// Expose helpers for ministry context and active context switching
export const contextService = {
  registerOrAttachMinistryAccount: async (
    email: string,
    password: string,
    profile: { firstName: string; lastName: string; churchName: string; phoneNumber: string; role: string; ministry?: string; }
  ): Promise<FirebaseUser> => {
    const trimmed = email.trim().toLowerCase();
    const ministryEmail = toMinistryAuthEmail(trimmed);
    let authUser: any;
    // Always use the aliased ministry email for Auth so it can have a distinct password
    try {
      const created = await createUserWithEmailAndPassword(auth, ministryEmail, password);
      authUser = created.user;
    } catch (createErr: any) {
      if (createErr?.code === 'auth/email-already-in-use') {
        // Ministry account already exists for this email alias; sign in to proceed
        const cred = await signInWithEmailAndPassword(auth, ministryEmail, password);
        authUser = cred.user;
      } else {
        throw createErr;
      }
    }

    const uid = authUser.uid;
    const usersDocRef = doc(db, 'users', uid);
    const snap = await getDoc(usersDocRef);
    const now = Timestamp.now();

    let defaultChurchId: string | undefined = undefined;
    let ministryChurchId: string | undefined = undefined;
    if (snap.exists()) {
      const data: any = snap.data() || {};
      defaultChurchId = data?.contexts?.defaultChurchId || data?.churchId;
      ministryChurchId = data?.contexts?.ministryChurchId;
    }

    if (!ministryChurchId) {
      ministryChurchId = `church-ministry-${uid}`;
      await setDoc(doc(db, 'churches', ministryChurchId), {
        name: profile.churchName,
        address: '',
        contactInfo: { phone: profile.phoneNumber, email: authUser.email, website: '' },
        settings: { timezone: 'America/New_York', defaultMinistries: ['Choir', 'Dancing Stars', 'Ushers', 'Arrival Stars', 'Airport Stars', 'Media'] },
        createdAt: now,
        lastUpdated: now,
        ownerId: uid
      });
    }

    const merged: any = {
      uid,
  email: trimmed, // keep original email for contact/UX
  authEmail: ministryEmail, // internal reference to ministry auth email
      displayName: `${profile.firstName} ${profile.lastName}`.trim() || authUser.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      churchId: ministryChurchId,
      churchName: profile.churchName,
      phoneNumber: profile.phoneNumber,
      role: 'admin',
      preferences: profile.ministry ? { ministryName: profile.ministry } : {},
      isMinistryAccount: true,
      contexts: { ...(defaultChurchId ? { defaultChurchId } : {}), ministryChurchId },
      lastLoginAt: now,
      isActive: true
    };
    if (snap.exists()) {
      await setDoc(usersDocRef, merged, { merge: true });
    } else {
      merged.createdAt = now;
      await setDoc(usersDocRef, merged);
    }

    currentUser = {
      uid,
      email: (merged.email as string) || authUser.email,
      displayName: merged.displayName,
      churchId: ministryChurchId,
      isMinistryAccount: true,
      contexts: merged.contexts
    };
    currentChurchId = ministryChurchId;
    return currentUser;
  }
};

// Ministry Exclusions Service: store members hidden from ministry UI (by source church + memberId)
export const ministryExclusionsService = {
  // Add or update an exclusion entry
  excludeMember: async (memberId: string, sourceChurchId: string): Promise<void> => {
    try {
      const ref = collection(db, getChurchCollectionPath('ministryExclusions'));
      const id = `${sourceChurchId}_${memberId}`;
      const docRef = doc(ref, id);
      await setDoc(docRef, {
        memberId,
        sourceChurchId,
        createdAt: Timestamp.now(),
      }, { merge: true });
    } catch (error: any) {
      throw new Error(`Failed to exclude member from ministry view: ${error.message}`);
    }
  },

  // Remove an exclusion entry (unhide)
  includeMember: async (memberId: string, sourceChurchId: string): Promise<void> => {
    try {
      const ref = collection(db, getChurchCollectionPath('ministryExclusions'));
      const id = `${sourceChurchId}_${memberId}`;
      const docRef = doc(ref, id);
      await deleteDoc(docRef);
    } catch (error: any) {
      throw new Error(`Failed to include member back to ministry view: ${error.message}`);
    }
  },

  // Get all exclusions
  getAll: async (): Promise<Array<{ id: string; memberId: string; sourceChurchId: string }>> => {
    try {
      const ref = collection(db, getChurchCollectionPath('ministryExclusions'));
      const snap = await getDocs(ref);
      return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    } catch (error: any) {
      throw new Error(`Failed to fetch ministry exclusions: ${error.message}`);
    }
  },

  // Listen to exclusions
  onSnapshot: (callback: (items: Array<{ id: string; memberId: string; sourceChurchId: string }>) => void): Unsubscribe => {
    const ref = collection(db, getChurchCollectionPath('ministryExclusions'));
    return onSnapshot(ref, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      callback(items);
    });
  }
};

// Ministry Member Overrides Service: store per-member overrides (e.g., frozen) for ministry UI
export const ministryMemberOverridesService = {
  // Set or update overrides
  set: async (
    memberId: string,
    sourceChurchId: string,
    overrides: { frozen?: boolean }
  ): Promise<void> => {
    try {
      const ref = collection(db, getChurchCollectionPath('ministryMemberOverrides'));
      const id = `${sourceChurchId}_${memberId}`;
      const docRef = doc(ref, id);
      await setDoc(
        docRef,
        {
          memberId,
          sourceChurchId,
          ...overrides,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );
    } catch (error: any) {
      throw new Error(`Failed to set ministry member overrides: ${error.message}`);
    }
  },

  // Clear overrides (remove document)
  clear: async (memberId: string, sourceChurchId: string): Promise<void> => {
    try {
      const ref = collection(db, getChurchCollectionPath('ministryMemberOverrides'));
      const id = `${sourceChurchId}_${memberId}`;
      const docRef = doc(ref, id);
      await deleteDoc(docRef);
    } catch (error: any) {
      throw new Error(`Failed to clear ministry member overrides: ${error.message}`);
    }
  },

  // Get all overrides
  getAll: async (): Promise<Array<{ id: string; memberId: string; sourceChurchId: string; frozen?: boolean }>> => {
    try {
      const ref = collection(db, getChurchCollectionPath('ministryMemberOverrides'));
      const snap = await getDocs(ref);
      return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    } catch (error: any) {
      throw new Error(`Failed to fetch ministry member overrides: ${error.message}`);
    }
  },

  // Listen to overrides
  onSnapshot: (
    callback: (items: Array<{ id: string; memberId: string; sourceChurchId: string; frozen?: boolean }>) => void
  ): Unsubscribe => {
    const ref = collection(db, getChurchCollectionPath('ministryMemberOverrides'));
    return onSnapshot(ref, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      callback(items);
    });
  }
};

export const setActiveContext = async (mode: 'default' | 'ministry'): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');
  const userDocRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userDocRef);
  const data: any = snap.data() || {};
  const ctx = data?.contexts || {};
  if (mode === 'ministry') {
    if (!ctx.ministryChurchId) throw new Error('No ministry account found for this email.');
    currentChurchId = ctx.ministryChurchId;
  } else {
    const cid = ctx.defaultChurchId || data.churchId;
    if (!cid) throw new Error('No default account context found for this email.');
    currentChurchId = cid;
  }
};

// One-off backfill to sync default members-with-ministry into ministry church
export const runBackfillMinistrySync = async (): Promise<{ success: boolean; synced?: number }> => {
  try {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  // Use explicit region to avoid CORS/404 preflight issues in dev
  const appFunctions = getFunctions(undefined as any, 'us-central1');
    const fn = httpsCallable(appFunctions, 'backfillMinistrySync');
    const res: any = await fn({});
    return (res && res.data) ? res.data : { success: true };
  } catch (e: any) {
    console.warn('[runBackfillMinistrySync] callable failed, attempting HTTP fallback', e?.message || String(e));
    try {
      const user = auth.currentUser;
      if (!user) return { success: false };
      const idToken = await user.getIdToken();
      const endpoint = 'https://us-central1-sat-mobile-de6f1.cloudfunctions.net/backfillMinistrySyncHttp';
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({})
      });
      if (!resp.ok) {
        const text = await resp.text();
        console.warn('[runBackfillMinistrySync] http failed', resp.status, text);
        return { success: false };
      }
      const data = await resp.json();
      return data && typeof data === 'object' ? data : { success: true };
    } catch (httpErr: any) {
      console.warn('[runBackfillMinistrySync] http fallback failed, attempting simulation', httpErr?.message || String(httpErr));
      // Fallback to client-side simulation
      try {
        const { simulateBackfillMinistrySync } = await import('./ministrySimulationService');
        const user = auth.currentUser;
        if (!user) return { success: false };

        // Get user profile to find church contexts
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return { success: false };

        const userData = userDoc.data();
        const contexts = userData.contexts || {};
        const defaultChurchId = contexts.defaultChurchId || userData.churchId;
        const ministryChurchId = contexts.ministryChurchId;

        if (!defaultChurchId || !ministryChurchId) {
          return { success: false };
        }

        return await simulateBackfillMinistrySync(defaultChurchId, ministryChurchId);
      } catch (simErr: any) {
        console.error('[runBackfillMinistrySync] simulation failed', simErr?.message || String(simErr));
        return { success: false };
      }
    }
  }
};

// Force sync all members with ministry assignments across all churches
export const runCrossMinistrySync = async (ministryName?: string): Promise<{ success: boolean; synced?: number }> => {
  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const appFunctions = getFunctions(undefined as any, 'us-central1');
    const fn = httpsCallable(appFunctions, 'crossMinistrySync');
    const res: any = await fn({ ministryName });
    return (res && res.data) ? res.data : { success: true };
  } catch (e: any) {
    console.warn('[runCrossMinistrySync] callable failed, attempting HTTP fallback', e?.message || String(e));
    try {
      const user = auth.currentUser;
      if (!user) return { success: false };
      const idToken = await user.getIdToken();
      const endpoint = 'https://us-central1-sat-mobile-de6f1.cloudfunctions.net/crossMinistrySyncHttp';
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ ministryName })
      });
      if (!resp.ok) {
        const text = await resp.text();
        console.warn('[runCrossMinistrySync] http failed', resp.status, text);
        return { success: false };
      }
      const data = await resp.json();
      return data && typeof data === 'object' ? data : { success: true };
    } catch (httpErr: any) {
      console.warn('[runCrossMinistrySync] http fallback failed, attempting simulation', httpErr?.message || String(httpErr));
      // Fallback to client-side simulation
      try {
        const { simulateCrossMinistrySync } = await import('./ministrySimulationService');
        const user = auth.currentUser;
        if (!user) return { success: false };

        // Get user profile to find ministry church
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return { success: false };

        const userData = userDoc.data();
        const targetMinistry = ministryName || userData.preferences?.ministryName;
        const ministryChurchId = userData.contexts?.ministryChurchId || userData.churchId;

        if (!targetMinistry || !ministryChurchId) {
          return { success: false };
        }

        return await simulateCrossMinistrySync(targetMinistry, ministryChurchId);
      } catch (simErr: any) {
        console.error('[runCrossMinistrySync] simulation failed', simErr?.message || String(simErr));
        return { success: false };
      }
    }
  }
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
  // Get single member by ID
  getById: async (memberId: string): Promise<Member | null> => {
    try {
      return await firebaseUtils.retryOperation(async () => {
        const memberRef = doc(db, getChurchCollectionPath('members'), memberId);
        const snap = await getDoc(memberRef);
        if (!snap.exists()) return null;
        const data = { id: snap.id, ...snap.data() } as Member;
        // Only return if active or isActive not set; preserve soft-deleted semantics
        if ((data as any).isActive === false) return null;
        return data;
      });
    } catch (error: any) {
      throw firebaseUtils.handleOfflineError('Fetch member by id', error);
    }
  },
  // Get members by ministry (server-side filter by ministry; isActive filtered client-side to avoid composite index)
  getAllByMinistry: async (ministryName: string): Promise<Member[]> => {
    try {
      return await firebaseUtils.retryOperation(async () => {
        const membersRef = collection(db, getChurchCollectionPath('members'));
        const qMembers = query(membersRef, where('ministry', '==', ministryName));
        const querySnapshot = await getDocs(qMembers);
        const items = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Member[];
        // Apply isActive filter client-side
        const filtered = items.filter(m => m.isActive !== false);
        filtered.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
        return filtered;
      });
    } catch (error: any) {
      throw firebaseUtils.handleOfflineError('Fetch members by ministry', error);
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
      // Remove undefined values to avoid Firestore updateDoc errors
      const sanitized: any = { ...updates };
      Object.keys(sanitized).forEach((k) => {
        if (sanitized[k] === undefined) delete sanitized[k];
      });
      await updateDoc(memberRef, {
        ...sanitized,
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
  },
  // Listen to members by ministry (server-side filter by ministry; isActive filtered client-side)
  onSnapshotByMinistry: (ministryName: string, callback: (members: Member[]) => void): Unsubscribe => {
    const membersRef = collection(db, getChurchCollectionPath('members'));
    const qMembers = query(membersRef, where('ministry', '==', ministryName));
    return onSnapshot(qMembers, (querySnapshot) => {
      const items = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Member[];
      const filtered = items.filter(m => m.isActive !== false);
      filtered.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
      callback(filtered);
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
  // Get new believer by ID
  getById: async (newBelieverId: string): Promise<NewBeliever | null> => {
    try {
      const ref = doc(db, getChurchCollectionPath('newBelievers'), newBelieverId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      return ({ id: snap.id, ...snap.data() } as NewBeliever);
    } catch (error: any) {
      throw new Error(`Failed to fetch new believer: ${error.message}`);
    }
  },
  // Get all new believers by ministry (filter by ministry on server, isActive client-side)
  getAllByMinistry: async (ministryName: string): Promise<NewBeliever[]> => {
    try {
      const ref = collection(db, getChurchCollectionPath('newBelievers'));
      const qNb = query(ref, where('ministry', '==', ministryName));
      const snap = await getDocs(qNb);
      const items = snap.docs.map(doc => ({ ...doc.data(), id: doc.id })) as NewBeliever[];
      const filtered = items.filter(n => n.isActive !== false);
      filtered.sort((a, b) => new Date(b.joinedDate || 0).getTime() - new Date(a.joinedDate || 0).getTime());
      return filtered;
    } catch (error: any) {
      throw new Error(`Failed to fetch new believers by ministry: ${error.message}`);
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
  },
  // Listen to new believers by ministry
  onSnapshotByMinistry: (ministryName: string, callback: (newBelievers: NewBeliever[]) => void): Unsubscribe => {
    const ref = collection(db, getChurchCollectionPath('newBelievers'));
    const qNb = query(ref, where('ministry', '==', ministryName));
    return onSnapshot(qNb, (snap) => {
      const items = snap.docs.map(doc => ({ ...doc.data(), id: doc.id })) as NewBeliever[];
      const filtered = items.filter(n => n.isActive !== false);
      filtered.sort((a, b) => new Date(b.joinedDate || 0).getTime() - new Date(a.joinedDate || 0).getTime());
      callback(filtered);
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

  // Get attendance record by ID
  getById: async (recordId: string): Promise<AttendanceRecord | null> => {
    try {
      const recordRef = doc(db, getChurchCollectionPath('attendance'), recordId);
      const snap = await getDoc(recordRef);
      if (!snap.exists()) return null;
      return ({ id: snap.id, ...snap.data() } as AttendanceRecord);
    } catch (error: any) {
      throw new Error(`Failed to fetch attendance record: ${error.message}`);
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

// Prayer Service
export const prayerFirebaseService = {
  // Get all prayer records
  getAll: async (): Promise<PrayerRecord[]> => {
    try {
      const prayersRef = collection(db, getChurchCollectionPath('prayers'));
      const querySnapshot = await getDocs(query(prayersRef, orderBy('date', 'desc')));

      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as PrayerRecord[];
    } catch (error: any) {
      throw new Error(`Failed to fetch prayer records: ${error.message}`);
    }
  },

  // Get prayers for specific date
  getByDate: async (date: string): Promise<PrayerRecord[]> => {
    try {
      const prayersRef = collection(db, getChurchCollectionPath('prayers'));
      const querySnapshot = await getDocs(query(prayersRef, where('date', '==', date)));

      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as PrayerRecord[];
    } catch (error: any) {
      throw new Error(`Failed to fetch prayer records for date ${date}: ${error.message}`);
    }
  },

  // Add or update prayer record
  addOrUpdate: async (record: PrayerRecord): Promise<void> => {
    try {
      const prayersRef = collection(db, getChurchCollectionPath('prayers'));
      const docRef = doc(prayersRef, record.id);
      await setDoc(docRef, {
        ...record,
        recordedAt: Timestamp.now(),
        recordedBy: currentUser?.uid || 'unknown'
      }, { merge: true });
    } catch (error: any) {
      throw new Error(`Failed to save prayer record: ${error.message}`);
    }
  },

  // Delete prayer record
  delete: async (recordId: string): Promise<void> => {
    try {
      const recordRef = doc(db, getChurchCollectionPath('prayers'), recordId);
      const docSnap = await getDoc(recordRef);
      if (docSnap.exists()) {
        await deleteDoc(recordRef);
      } else {
        throw new Error(`Prayer record not found: ${recordId}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to delete prayer record: ${error.message}`);
    }
  },

  // Listen to prayer changes
  onSnapshot: (callback: (records: PrayerRecord[]) => void): Unsubscribe => {
    const prayersRef = collection(db, getChurchCollectionPath('prayers'));
    const q = query(prayersRef, orderBy('date', 'desc'));
    return onSnapshot(q, (querySnapshot) => {
      const records = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as PrayerRecord[];
      callback(records);
    });
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
  // Get confirmation by ID
  getById: async (recordId: string): Promise<SundayConfirmation | null> => {
    try {
      const ref = doc(db, getChurchCollectionPath('confirmations'), recordId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      return ({ id: snap.id, ...snap.data() } as SundayConfirmation);
    } catch (error: any) {
      throw new Error(`Failed to fetch confirmation: ${error.message}`);
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

  // Add confirmation record
  add: async (record: Omit<SundayConfirmation, 'id' | 'createdDate' | 'lastUpdated'>): Promise<string> => {
    try {
      const confirmationsRef = collection(db, getChurchCollectionPath('confirmations'));
      const docRef = await addDoc(confirmationsRef, {
        ...record,
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
      return docRef.id;
    } catch (error: any) {
      throw new Error(`Failed to add confirmation record: ${error.message}`);
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

  // Get a single deletion request by ID
  getById: async (requestId: string): Promise<MemberDeletionRequest | null> => {
    try {
      const requestRef = doc(db, getChurchCollectionPath('memberDeletionRequests'), requestId);
      const snap = await getDoc(requestRef);
      if (!snap.exists()) return null;
      return ({ id: snap.id, ...snap.data() } as MemberDeletionRequest);
    } catch (error: any) {
      throw new Error(`Failed to fetch deletion request: ${error.message}`);
    }
  },

  // Get pending deletion requests for a specific admin
  getPendingForAdmin: async (_adminId: string): Promise<MemberDeletionRequest[]> => {
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
    const collNames = [
      'members',
      'bacentas',
      'attendance',
      'newBelievers',
      // confirmations (primary) and legacy
      'confirmations',
      'sundayConfirmations',
      'guests',
      'prayers',
      'meetings',
      'tithes'
    ];
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
  },

  // Permanently purge all data for the current church (irreversible)
  // Returns a map of collection => deletedCount (or -1 if that collection failed)
  purgeChurchData: async (): Promise<Record<string, number>> => {
    try {
      if (!currentChurchId) {
        throw new Error('No church context available');
      }

      const deleteAllInCollection = async (collectionPath: string): Promise<number> => {
        const colRef = collection(db, collectionPath);
        const snap = await getDocs(colRef);
        let deleted = 0;
        const CHUNK = 450; // keep under 500 writes/commit
        for (let i = 0; i < snap.docs.length; i += CHUNK) {
          const batch = writeBatch(db);
          const chunk = snap.docs.slice(i, i + CHUNK);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          deleted += chunk.length;
        }
        return deleted;
      };

      // Known subcollections used by this app under churches/{currentChurchId}
      const collectionsToPurge = [
        'members',
        'bacentas',
        'attendance',
        'newBelievers',
        'confirmations',
        'sundayConfirmations', // legacy name, if present
        'guests',
        'memberDeletionRequests',
        'outreachBacentas',
        'outreachMembers',
        'prayers',
        'meetings',
        'tithes',
        'ministryExclusions',
        'ministryMemberOverrides',
        'notifications',
        'notificationStats'
      ];

      const results: Record<string, number> = {};
      for (const name of collectionsToPurge) {
        const path = `churches/${currentChurchId}/${name}`;
        try {
          results[name] = await deleteAllInCollection(path);
        } catch (err: any) {
          console.warn(`Failed to purge collection ${name}:`, err?.message || err);
          results[name] = -1;
        }
      }

      return results;
    } catch (error: any) {
      throw new Error(`Failed to purge church data: ${error.message}`);
    }
  }
};

// Meeting Records Service
export const meetingRecordsFirebaseService = {
  // Get all meeting records
  getAll: async (): Promise<MeetingRecord[]> => {
    try {
      const meetingsRef = collection(db, getChurchCollectionPath('meetings'));
      const querySnapshot = await getDocs(query(meetingsRef, orderBy('date', 'desc')));

      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as MeetingRecord[];
    } catch (error: any) {
      throw new Error(`Failed to fetch meeting records: ${error.message}`);
    }
  },

  // Get meeting record by ID
  getById: async (id: string): Promise<MeetingRecord | null> => {
    try {
      const meetingRef = doc(db, getChurchCollectionPath('meetings'), id);
      const docSnap = await getDoc(meetingRef);

      if (docSnap.exists()) {
        return { ...docSnap.data(), id: docSnap.id } as MeetingRecord;
      }
      return null;
    } catch (error: any) {
      throw new Error(`Failed to fetch meeting record: ${error.message}`);
    }
  },

  // Add or update meeting record
  addOrUpdate: async (record: MeetingRecord): Promise<void> => {
    try {
      const meetingsRef = collection(db, getChurchCollectionPath('meetings'));
      const docRef = doc(meetingsRef, record.id);

      await setDoc(docRef, {
        ...record,
        updatedAt: new Date().toISOString(),
        recordedBy: currentUser?.uid || 'unknown'
      }, { merge: true });
    } catch (error: any) {
      throw new Error(`Failed to save meeting record: ${error.message}`);
    }
  },

  // Delete meeting record
  delete: async (id: string): Promise<void> => {
    try {
      const meetingRef = doc(db, getChurchCollectionPath('meetings'), id);
      await deleteDoc(meetingRef);
    } catch (error: any) {
      throw new Error(`Failed to delete meeting record: ${error.message}`);
    }
  },

  // Get meeting record for specific bacenta and date
  getByBacentaAndDate: async (bacentaId: string, date: string): Promise<MeetingRecord | null> => {
    try {
      const meetingId = `${bacentaId}_${date}`;
      return await meetingRecordsFirebaseService.getById(meetingId);
    } catch (error: any) {
      throw new Error(`Failed to fetch meeting record for bacenta and date: ${error.message}`);
    }
  },

  // Listen to meeting records changes
  onSnapshot: (callback: (records: MeetingRecord[]) => void): Unsubscribe => {
    const meetingsRef = collection(db, getChurchCollectionPath('meetings'));
    const q = query(meetingsRef, orderBy('date', 'desc'));

    return onSnapshot(q, (querySnapshot) => {
      const records = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as MeetingRecord[];
      callback(records);
    });
  }
};

// Tithe Service
export const titheFirebaseService = {
  // Get all tithes for a month
  getAllByMonth: async (yyyymm: string): Promise<TitheRecord[]> => {
    try {
      const ref = collection(db, getChurchCollectionPath('tithes'));
      const qT = query(ref, where('month', '==', yyyymm));
      const snap = await getDocs(qT);
      return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as TitheRecord[];
    } catch (error: any) {
      throw new Error(`Failed to fetch tithes for ${yyyymm}: ${error.message}`);
    }
  },
  // Add or update tithe record (by member + month)
  addOrUpdate: async (record: Omit<TitheRecord, 'id' | 'recordedAt' | 'recordedBy' | 'lastUpdated'>): Promise<void> => {
    try {
      const ref = collection(db, getChurchCollectionPath('tithes'));
      const id = `${record.memberId}_${record.month}`;
      const docRef = doc(ref, id);
      await setDoc(docRef, {
        ...record,
        id,
        recordedAt: Timestamp.now().toDate().toISOString(),
        recordedBy: currentUser?.uid || 'unknown',
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    } catch (error: any) {
      throw new Error(`Failed to save tithe: ${error.message}`);
    }
  },
  // Listen for a month
  onSnapshotByMonth: (yyyymm: string, callback: (records: TitheRecord[]) => void): Unsubscribe => {
    const ref = collection(db, getChurchCollectionPath('tithes'));
    const qT = query(ref, where('month', '==', yyyymm));
    return onSnapshot(qT, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as TitheRecord[];
      callback(items);
    });
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
