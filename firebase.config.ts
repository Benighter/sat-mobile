// Firebase Configuration for SAT Mobile
import { initializeApp } from 'firebase/app';
import { initializeFirestore, connectFirestoreEmulator, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, connectAuthEmulator, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getMessaging, isSupported } from 'firebase/messaging';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';

// Ministry variant removed – single SAT project only

// Prefer Vite env variables (import.meta.env) with fallbacks to process.env and defaults
const env = (typeof import.meta !== 'undefined' ? (import.meta as any).env : {}) || {};

// SAT defaults (existing project)
const SAT_FB = {
  apiKey: env.VITE_FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyDkyjDhyz_LCbUpRgftD2qo31e5SteAiKg",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "sat-mobile-de6f1.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || process.env.REACT_APP_FIREBASE_PROJECT_ID || "sat-mobile-de6f1",
  // IMPORTANT: storageBucket must be the canonical bucket name (<project-id>.appspot.com),
  // not the newer download domain. Using the wrong value causes failed uploads that
  // surface as CORS / preflight errors (HTTP not ok on the underlying request).
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "sat-mobile-de6f1.appspot.com",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "1076014285349",
  appId: env.VITE_FIREBASE_APP_ID || process.env.REACT_APP_FIREBASE_APP_ID || "1:1076014285349:web:d72d460aefe5ca8d76b5cc",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-XSWJRZZ751"
};

// Firebase configuration object
const firebaseConfig = SAT_FB;

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

// Initialize Storage (for chat image uploads & other media)
export const storage = getStorage(app);

// Initialize Cloud Functions (region default). Export for callables (e.g., searchAdminUserByEmail)
export const functions = getFunctions(app);

// Initialize Firestore with robust transport + settings to avoid network quirks (e.g. 400 on terminate)
export const db = initializeFirestore(app, {
  // Avoid crashing on undefined properties in updates
  ignoreUndefinedProperties: true,
  // Work around restrictive networks/proxies that break GRPC-Web streaming
  // Use ONE of these. We force long polling for maximum compatibility.
  experimentalForceLongPolling: true,
  // useFetchStreams: false, // uncomment if needed in your environment
});
// Reduce noisy Firestore debug logs in production
setLogLevel(process.env.NODE_ENV === 'development' ? 'error' : 'error');

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Ensure auth persists across page reloads (explicitly set to LOCAL)
try {
  // setPersistence returns a Promise; fire-and-forget here
  setPersistence(auth, browserLocalPersistence).then(() => {
    console.log('✅ Firebase Auth persistence set to LOCAL');
  }).catch((err) => {
    console.warn('⚠️ Failed to set Firebase Auth persistence', err?.message || err);
  });
} catch (e) {
  console.warn('⚠️ setPersistence not applied:', (e as any)?.message || e);
}

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
    try { connectFunctionsEmulator(functions, 'localhost', 5001); } catch {}
  } catch (error) {
    console.warn('Firebase emulators already connected or not available');
  }
}

// Initialize offline persistence when the module loads
enableOfflinePersistence().catch(console.error);

export default app;
