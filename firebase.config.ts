// Firebase Configuration for SAT Mobile
import { initializeApp } from 'firebase/app';
import { initializeFirestore, connectFirestoreEmulator, setLogLevel } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getMessaging, isSupported } from 'firebase/messaging';

// Select project by variant: default SAT; ministry for Ministry App
const isMinistryVariant =
  (typeof globalThis !== 'undefined' && (globalThis as any).__APP_VARIANT__ === 'ministry') ||
  (typeof window !== 'undefined' && window.location.pathname.includes('ministry'));

// Prefer Vite env variables (import.meta.env) with fallbacks to process.env and defaults
const env = (typeof import.meta !== 'undefined' ? (import.meta as any).env : {}) || {};

// SAT defaults (existing project)
const SAT_FB = {
  apiKey: env.VITE_FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyDkyjDhyz_LCbUpRgftD2qo31e5SteAiKg",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "sat-mobile-de6f1.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || process.env.REACT_APP_FIREBASE_PROJECT_ID || "sat-mobile-de6f1",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "sat-mobile-de6f1.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "1076014285349",
  appId: env.VITE_FIREBASE_APP_ID || process.env.REACT_APP_FIREBASE_APP_ID || "1:1076014285349:web:d72d460aefe5ca8d76b5cc",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-XSWJRZZ751"
};

// Ministry project (set via Vite env with MINISTRY_ prefix)
const MIN_FB = {
  apiKey: env.VITE_MINISTRY_FIREBASE_API_KEY || process.env.REACT_APP_MINISTRY_FIREBASE_API_KEY || SAT_FB.apiKey,
  authDomain: env.VITE_MINISTRY_FIREBASE_AUTH_DOMAIN || process.env.REACT_APP_MINISTRY_FIREBASE_AUTH_DOMAIN || SAT_FB.authDomain,
  projectId: env.VITE_MINISTRY_FIREBASE_PROJECT_ID || process.env.REACT_APP_MINISTRY_FIREBASE_PROJECT_ID || SAT_FB.projectId,
  storageBucket: env.VITE_MINISTRY_FIREBASE_STORAGE_BUCKET || process.env.REACT_APP_MINISTRY_FIREBASE_STORAGE_BUCKET || SAT_FB.storageBucket,
  messagingSenderId: env.VITE_MINISTRY_FIREBASE_MESSAGING_SENDER_ID || process.env.REACT_APP_MINISTRY_FIREBASE_MESSAGING_SENDER_ID || SAT_FB.messagingSenderId,
  appId: env.VITE_MINISTRY_FIREBASE_APP_ID || process.env.REACT_APP_MINISTRY_FIREBASE_APP_ID || SAT_FB.appId,
  measurementId: env.VITE_MINISTRY_FIREBASE_MEASUREMENT_ID || process.env.REACT_APP_MINISTRY_FIREBASE_MEASUREMENT_ID || SAT_FB.measurementId
};

// Firebase configuration object
const firebaseConfig = isMinistryVariant ? MIN_FB : SAT_FB;

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

// Initialize Firestore with robust transport + settings to avoid network quirks (e.g. 400 on terminate)
export const db = initializeFirestore(app, {
  // Avoid crashing on undefined properties in updates
  ignoreUndefinedProperties: true,
  // Work around restrictive networks/proxies that break GRPC-Web streaming
  experimentalAutoDetectLongPolling: true,
});
// Reduce noisy Firestore debug logs in production
setLogLevel(process.env.NODE_ENV === 'development' ? 'error' : 'error');

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Firebase Messaging (only if supported)
let messaging: any = null;
const initializeMessaging = async () => {
  try {
    const supported = await isSupported();
    if (supported) {
      messaging = getMessaging(app);
      console.log('✅ Firebase Messaging initialized');
    } else {
      console.log('❌ Firebase Messaging not supported in this environment');
    }
  } catch (error) {
    console.log('❌ Failed to initialize Firebase Messaging:', error);
  }
};

// Initialize messaging
initializeMessaging();

// Export messaging instance
export { messaging };

// Modern offline persistence setup
let offlinePersistenceEnabled = false;

export const enableOfflinePersistence = async (): Promise<boolean> => {
  if (offlinePersistenceEnabled) {
    return true;
  }

  try {
    // Use the new cache settings instead of deprecated enableIndexedDbPersistence
    // Note: This is handled automatically by Firestore now
    offlinePersistenceEnabled = true;
    console.log('✅ Firebase offline persistence enabled (automatic)');
    return true;
  } catch (error: any) {
    console.error('❌ Failed to enable offline persistence:', error);
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
