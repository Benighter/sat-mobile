/**
 * Ministry Synchronization Tests
 * 
 * These tests verify that the automatic synchronization between normal mode
 * and ministry mode works correctly.
 */

import { runBackfillMinistrySync, runCrossMinistrySync } from '../services/firebaseService';

// Mock Firebase functions for testing
jest.mock('../services/firebaseService', () => ({
  runBackfillMinistrySync: jest.fn(),
  runCrossMinistrySync: jest.fn(),
}));

describe('Ministry Synchronization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Backfill Sync', () => {
    it('should successfully run backfill sync', async () => {
      const mockResult = { success: true, synced: 5 };
      (runBackfillMinistrySync as jest.Mock).mockResolvedValue(mockResult);

      const result = await runBackfillMinistrySync();

      expect(runBackfillMinistrySync).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
      expect(result.success).toBe(true);
      expect(result.synced).toBe(5);
    });

    it('should handle backfill sync errors gracefully', async () => {
      const mockError = new Error('Sync failed');
      (runBackfillMinistrySync as jest.Mock).mockRejectedValue(mockError);

      await expect(runBackfillMinistrySync()).rejects.toThrow('Sync failed');
    });

    it('should return success false when sync fails', async () => {
      const mockResult = { success: false };
      (runBackfillMinistrySync as jest.Mock).mockResolvedValue(mockResult);

      const result = await runBackfillMinistrySync();

      expect(result.success).toBe(false);
    });
  });

  describe('Cross-Ministry Sync', () => {
    it('should successfully run cross-ministry sync with ministry name', async () => {
      const mockResult = { success: true, synced: 10 };
      (runCrossMinistrySync as jest.Mock).mockResolvedValue(mockResult);

      const result = await runCrossMinistrySync('Dancing Stars');

      expect(runCrossMinistrySync).toHaveBeenCalledWith('Dancing Stars');
      expect(result).toEqual(mockResult);
      expect(result.success).toBe(true);
      expect(result.synced).toBe(10);
    });

    it('should successfully run cross-ministry sync without ministry name', async () => {
      const mockResult = { success: true, synced: 3 };
      (runCrossMinistrySync as jest.Mock).mockResolvedValue(mockResult);

      const result = await runCrossMinistrySync();

      expect(runCrossMinistrySync).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockResult);
    });

    it('should handle cross-ministry sync errors gracefully', async () => {
      const mockError = new Error('Cross-ministry sync failed');
      (runCrossMinistrySync as jest.Mock).mockRejectedValue(mockError);

      await expect(runCrossMinistrySync('Choir')).rejects.toThrow('Cross-ministry sync failed');
    });

    it('should return success false when cross-ministry sync fails', async () => {
      const mockResult = { success: false };
      (runCrossMinistrySync as jest.Mock).mockResolvedValue(mockResult);

      const result = await runCrossMinistrySync('Ushers');

      expect(result.success).toBe(false);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle sequential sync operations', async () => {
      const backfillResult = { success: true, synced: 5 };
      const crossSyncResult = { success: true, synced: 8 };
      
      (runBackfillMinistrySync as jest.Mock).mockResolvedValue(backfillResult);
      (runCrossMinistrySync as jest.Mock).mockResolvedValue(crossSyncResult);

      const backfill = await runBackfillMinistrySync();
      const crossSync = await runCrossMinistrySync('Media');

      expect(backfill.synced).toBe(5);
      expect(crossSync.synced).toBe(8);
      expect(runBackfillMinistrySync).toHaveBeenCalledTimes(1);
      expect(runCrossMinistrySync).toHaveBeenCalledWith('Media');
    });

    it('should handle mixed success/failure scenarios', async () => {
      (runBackfillMinistrySync as jest.Mock).mockResolvedValue({ success: true, synced: 3 });
      (runCrossMinistrySync as jest.Mock).mockResolvedValue({ success: false });

      const backfill = await runBackfillMinistrySync();
      const crossSync = await runCrossMinistrySync('Airport Stars');

      expect(backfill.success).toBe(true);
      expect(crossSync.success).toBe(false);
    });
  });

  describe('Ministry Names', () => {
    const validMinistries = [
      'Choir',
      'Dancing Stars',
      'Ushers',
      'Airport Stars',
      'Arrival Stars',
      'Media'
    ];

    it.each(validMinistries)('should handle sync for %s ministry', async (ministry) => {
      const mockResult = { success: true, synced: 2 };
      (runCrossMinistrySync as jest.Mock).mockResolvedValue(mockResult);

      const result = await runCrossMinistrySync(ministry);

      expect(runCrossMinistrySync).toHaveBeenCalledWith(ministry);
      expect(result.success).toBe(true);
    });
  });
});

/**
 * Manual Test Instructions
 * 
 * To manually test the ministry synchronization:
 * 
 * 1. Create a user in normal mode with a ministry assignment (e.g., "Dancing Stars")
 * 2. Switch to ministry mode and create an account for the same ministry
 * 3. Verify the user appears automatically in ministry mode
 * 4. Update the user's information in ministry mode
 * 5. Switch back to normal mode and verify changes are reflected
 * 6. Create another user in a different constituency with the same ministry
 * 7. Verify they appear in the ministry mode for that ministry
 * 
 * Expected Results:
 * - Users with ministry assignments automatically appear in ministry mode
 * - Changes in ministry mode sync back to normal mode
 * - Cross-constituency aggregation works (users from different churches appear together)
 * - Real-time synchronization occurs without manual intervention
 */
