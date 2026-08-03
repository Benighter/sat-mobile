import { createClient, type AuthChangeEvent, type Session, type User } from '@supabase/supabase-js';

export interface SatNativeIdentity {
  uid: string;
  churchId?: string;
  role?: string;
  superAdmin: boolean;
  isMinistryAccount: boolean;
  contexts: Record<string, unknown>;
}

let nativeClient: ReturnType<typeof createClient> | null = null;

const requiredEnvironment = (name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY'): string => {
  const value = String(import.meta.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required for native Supabase Auth`);
  return value;
};

const getNativeClient = () => {
  if (nativeClient) return nativeClient;
  nativeClient = createClient(
    requiredEnvironment('VITE_SUPABASE_URL'),
    requiredEnvironment('VITE_SUPABASE_PUBLISHABLE_KEY'),
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );
  return nativeClient;
};

const requireEnabled = (): void => {
  if (import.meta.env.VITE_AUTH_BACKEND !== 'supabase') {
    throw new Error('Native Supabase Auth is isolated. Set VITE_AUTH_BACKEND=supabase only in the approved migration test build.');
  }
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const isNativeSupabaseAuthEnabled = (): boolean =>
  import.meta.env.VITE_AUTH_BACKEND === 'supabase';

export const getNativeSupabaseAccessToken = async (): Promise<string | null> => {
  if (!isNativeSupabaseAuthEnabled()) return null;
  const { data, error } = await getNativeClient().auth.getSession();
  if (error) throw error;
  return data.session?.access_token ?? null;
};

export const nativeAuthService = {
  signIn: async (email: string, password: string): Promise<{ user: User; identity: SatNativeIdentity }> => {
    requireEnabled();
    const client = getNativeClient();
    const { data, error } = await client.auth.signInWithPassword({ email: normalizeEmail(email), password });
    if (error) throw error;
    if (!data.user) throw new Error('Supabase Auth did not return a user');

    const { data: identity, error: identityError } = await client.rpc('sat_current_identity');
    if (identityError || !identity) {
      await client.auth.signOut({ scope: 'local' });
      throw new Error(identityError?.message || 'This Supabase account is not linked to an existing SAT Mobile identity');
    }
    return { user: data.user, identity: identity as unknown as SatNativeIdentity };
  },

  signUp: async (email: string, password: string): Promise<User> => {
    requireEnabled();
    const { data, error } = await getNativeClient().auth.signUp({
      email: normalizeEmail(email),
      password,
    });
    if (error) throw error;
    if (!data.user) throw new Error('Supabase Auth did not return a user');
    return data.user;
  },

  resetPassword: async (email: string, redirectTo?: string): Promise<void> => {
    requireEnabled();
    const { error } = await getNativeClient().auth.resetPasswordForEmail(
      normalizeEmail(email),
      redirectTo ? { redirectTo } : undefined,
    );
    if (error) throw error;
  },

  changePassword: async (newPassword: string): Promise<void> => {
    requireEnabled();
    const { error } = await getNativeClient().auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  signOut: async (): Promise<void> => {
    requireEnabled();
    const { error } = await getNativeClient().auth.signOut();
    if (error) throw error;
  },

  onAuthStateChanged: (
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ): (() => void) => {
    requireEnabled();
    const { data } = getNativeClient().auth.onAuthStateChange(callback);
    return () => data.subscription.unsubscribe();
  },
};
