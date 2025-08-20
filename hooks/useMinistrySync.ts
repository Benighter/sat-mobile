/**
 * Ministry Sync Hook
 *
 * This hook provides manual ministry synchronization functionality
 * that works both with deployed Cloud Functions and client-side simulation.
 *
 * Note: Automatic sync is handled in FirebaseAppContext to avoid circular dependencies.
 */

import { useCallback } from 'react';
import { Member } from '../types';

export const useMinistrySync = () => {
  // Manual sync functions
  const runBackfillSync = useCallback(async () => {
    try {
      const { runBackfillMinistrySync } = await import('../services/firebaseService');
      return await runBackfillMinistrySync();
    } catch (error) {
      console.error('Failed to run backfill sync:', error);
      return { success: false, synced: 0 };
    }
  }, []);

  const runCrossMinistrySync = useCallback(async (ministryName?: string) => {
    try {
      const { runCrossMinistrySync } = await import('../services/firebaseService');
      return await runCrossMinistrySync(ministryName);
    } catch (error) {
      console.error('Failed to run cross-ministry sync:', error);
      return { success: false, synced: 0 };
    }
  }, []);

  return {
    runBackfillSync,
    runCrossMinistrySync
  };
};

// Export a function to manually trigger sync for specific member changes
export const triggerManualMemberSync = async (
  memberId: string,
  memberData: Member | null,
  previousData: Member | null,
  churchId: string
) => {
  try {
    const { simulateMemberSyncTrigger } = await import('../services/ministrySimulationService');
    await simulateMemberSyncTrigger(memberId, memberData, previousData, churchId);
  } catch (error) {
    console.warn('Failed to trigger manual member sync:', error);
  }
};
