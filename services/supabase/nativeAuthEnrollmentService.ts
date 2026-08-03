import { getSupabaseClient, isSupabaseBackendConfigured } from './client';

export interface NativeAuthEnrollmentStatus {
  linked: boolean;
  eligible: boolean;
}

export const isNativeAuthEnrollmentRequired = (): boolean =>
  import.meta.env.VITE_REQUIRE_NATIVE_AUTH_ENROLLMENT === 'true'
  && import.meta.env.VITE_AUTH_BACKEND === 'firebase'
  && import.meta.env.VITE_DATA_BACKEND === 'supabase'
  && isSupabaseBackendConfigured();

export const nativeAuthEnrollmentService = {
  getStatus: async (): Promise<NativeAuthEnrollmentStatus> => {
    const { data, error } = await getSupabaseClient().rpc('sat_native_enrollment_status');
    if (error) throw error;
    return {
      linked: data?.linked === true,
      eligible: data?.eligible === true,
    };
  },

  enroll: async (password: string): Promise<void> => {
    const { data, error } = await getSupabaseClient().functions.invoke('sat-native-auth-enroll', {
      body: { password },
    });
    if (error || data?.ok !== true || data?.linked !== true) {
      throw new Error(error?.message || data?.code || 'Could not prepare your new SAT Mobile sign-in');
    }
  },
};
