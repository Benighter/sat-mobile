/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_DATA_BACKEND?: 'firebase' | 'supabase';
  readonly VITE_AUTH_BACKEND?: 'firebase' | 'supabase';
  readonly VITE_REQUIRE_NATIVE_AUTH_ENROLLMENT?: 'true' | 'false';
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_ROLLBACK_WRITES?: 'true' | 'false';
}

declare module 'sat-firebase-firestore-original' {
  export * from 'firebase/firestore';
}

declare module 'sat-firebase-storage-original' {
  export * from 'firebase/storage';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css' {
  const content: string;
  export default content;
}
