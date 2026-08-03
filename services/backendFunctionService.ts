import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase.config';
import { getSupabaseClient } from './supabase/client';

type CompatibilityFunctionName =
  | 'checkEmailAvailability'
  | 'getMemberCounts'
  | 'sendBirthdayEmail'
  | 'setUserActiveStatus'
  | 'hardDeleteUserAccount'
  | 'sendPushNotification'
  | 'relayPersistImage'
  | 'relayUploadChatImage';

const SUPABASE_NATIVE_FUNCTIONS = new Set<CompatibilityFunctionName>([
  'relayPersistImage',
  'relayUploadChatImage',
]);

export const invokeBackendFunction = async <TRequest, TResponse>(
  name: CompatibilityFunctionName,
  payload: TRequest
): Promise<TResponse> => {
  if (import.meta.env.VITE_DATA_BACKEND !== 'firebase' && SUPABASE_NATIVE_FUNCTIONS.has(name)) {
    throw new Error(`${name} is replaced by direct private Supabase Storage access`);
  }
  if (import.meta.env.VITE_DATA_BACKEND !== 'firebase' && name === 'hardDeleteUserAccount') {
    throw new Error('Hard deletion is paused until the Firebase and Supabase records can be removed atomically.');
  }
  if (import.meta.env.VITE_DATA_BACKEND !== 'firebase' && name === 'getMemberCounts') {
    const request = payload as { churchIds?: string[] };
    const { data, error } = await getSupabaseClient().rpc('sat_get_member_counts', {
      target_church_ids: request.churchIds ?? [],
    });
    if (error) throw error;
    return data as TResponse;
  }

  // Firebase remains the identity and FCM provider during Third-Party Auth.
  // Auth administration, email-secret custody, and push delivery therefore
  // stay behind the existing authenticated callable boundary for rollback.
  const callable = httpsCallable<TRequest, TResponse>(functions, name);
  const result = await callable(payload);
  if (import.meta.env.VITE_DATA_BACKEND !== 'firebase' && name === 'setUserActiveStatus') {
    const status = payload as { uid?: string; active?: boolean };
    const { data, error } = await getSupabaseClient().rpc('sat_apply_admin_user_status', {
      target_uid: status.uid,
      target_active: status.active,
    });
    if (error || data !== true) throw new Error(error?.message || 'Supabase account status reconciliation failed');
  }
  return result.data;
};
