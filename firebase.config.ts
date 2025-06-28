// Firebase Configuration for Church Connect Mobile
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

// Firebase configuration object
// Using your actual Firebase project configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyDkyjDhyz_LCbUpRgftD2qo31e5SteAiKg",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "sat-mobile-de6f1.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "sat-mobile-de6f1",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "sat-mobile-de6f1.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "1076014285349",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:1076014285349:web:d72d460aefe5ca8d76b5cc"
};

// Debug: Log the configuration being used (remove in production)
console.log('🔥 Firebase Config:', {
  apiKey: firebaseConfig.apiKey.substring(0, 10) + '...',
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId.substring(0, 20) + '...'
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with offline persistence
export const db = getFirestore(app);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Enable offline persistence for Firestore
let offlinePersistenceEnabled = false;

export const enableOfflinePersistence = async (): Promise<boolean> => {
  if (offlinePersistenceEnabled) {
    return true;
  }

  try {
    await enableIndexedDbPersistence(db, {
      forceOwnership: false // Allow multiple tabs
    });
    offlinePersistenceEnabled = true;
    console.log('✅ Firebase offline persistence enabled');
    return true;
  } catch (error: any) {
    if (error.code === 'failed-precondition') {
      console.warn('⚠️ Multiple tabs open, offline persistence can only be enabled in one tab at a time');
    } else if (error.code === 'unimplemented') {
      console.warn('⚠️ The current browser does not support offline persistence');
    } else {
      console.error('❌ Failed to enable offline persistence:', error);
    }
    return false;
  }
};

// Development mode emulator setup (optional)
if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_FIREBASE_EMULATOR === 'true') {
  try {
    // Connect to Firestore emulator
    connectFirestoreEmulator(db, 'localhost', 8080);

    // Connect to Auth emulator
    connectAuthEmulator(auth, 'http://localhost:9099');
  } catch (error) {
    console.warn('Firebase emulators already connected or not available');
  }
}

// Initialize offline persistence when the module loads
enableOfflinePersistence().catch(console.error);

export default app;
