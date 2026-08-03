import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getAuth } from 'firebase/auth';
import { getNativeSupabaseAccessToken, isNativeSupabaseAuthEnabled } from './nativeAuthService';

let client: SupabaseClient | null = null;
let lastForcedClaimsRefreshAt = 0;
const CLAIM_REFRESH_INTERVAL_MS = 5 * 60 * 1_000;

const firebaseAccessToken = async (): Promise<string | null> => {
  const user = getAuth().currentUser;
  if (!user) return null;
  let result = await user.getIdTokenResult(false);
  if (
    result.claims.role === 'authenticated'
    && Date.now() - lastForcedClaimsRefreshAt < CLAIM_REFRESH_INTERVAL_MS
  ) return result.token;

  // Existing browser sessions can hold a pre-migration token for up to an
  // hour. New accounts can also race the Auth onCreate claim synchronizer.
  // Refresh in a short bounded loop before handing the token to Supabase.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
    result = await user.getIdTokenResult(true);
    lastForcedClaimsRefreshAt = Date.now();
    if (result.claims.role === 'authenticated') return result.token;
  }
  throw new Error('Your account authorization is still being prepared. Please sign in again in a moment.');
};

const backendAccessToken = async (): Promise<string | null> => {
  if (isNativeSupabaseAuthEnabled()) return getNativeSupabaseAccessToken();
  return firebaseAccessToken();
};

const requiredEnvironment = (name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY'): string => {
  const value = String(import.meta.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required for the Supabase backend`);
  return value;
};

export const getSupabaseClient = (): SupabaseClient => {
  if (client) return client;
  client = createClient(
    requiredEnvironment('VITE_SUPABASE_URL'),
    requiredEnvironment('VITE_SUPABASE_PUBLISHABLE_KEY'),
    {
      accessToken: backendAccessToken,
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }
  );
  return client;
};

export const isSupabaseBackendConfigured = (): boolean =>
  Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
