import React, { useMemo } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { getUpcomingSunday, formatFullDate } from '../../utils/dateUtils';
import Button from '../ui/Button';
import { hasAdminPrivileges } from '../../utils/permissionUtils';

/**
 * Debug panel for Sunday Service Confirmation data consistency
 * Shows detailed breakdown of confirmation counts and provides cleanup utilities
 * Only visible to admin users
 */
const ConfirmationDebugPanel: React.FC = () => {
  const { 
    sundayConfirmations, 
    members, 
    guests, 
    userProfile, 
    cleanupOrphanedConfirmations,
    showToast 
  } = useAppContext();

  // Only show to admin users
  const isAdmin = hasAdminPrivileges(userProfile);
  if (!isAdmin) return null;

  const upcomingSunday = getUpcomingSunday();

  // Calculate detailed confirmation statistics
  const confirmationStats = useMemo(() => {
    // Get all confirmation records for upcoming Sunday
    const allConfirmations = sundayConfirmations.filter(
      record => record.date === upcomingSunday && record.status === 'Confirmed'
    );

    // Separate member and guest confirmations
    const memberConfirmations = allConfirmations.filter(conf => conf.memberId);
    const guestConfirmations = allConfirmations.filter(conf => conf.guestId);

    // Check which confirmations have valid references
    const validMemberConfirmations = memberConfirmations.filter(conf => 
      members.some(member => member.id === conf.memberId)
    );
    const validGuestConfirmations = guestConfirmations.filter(conf => 
      guests.some(guest => guest.id === conf.guestId)
    );

    // Find orphaned confirmations
    const orphanedMemberConfirmations = memberConfirmations.filter(conf => 
      !members.some(member => member.id === conf.memberId)
    );
    const orphanedGuestConfirmations = guestConfirmations.filter(conf => 
      !guests.some(guest => guest.id === conf.guestId)
    );

    return {
      total: allConfirmations.length,
      memberConfirmations: memberConfirmations.length,
      guestConfirmations: guestConfirmations.length,
      validMemberConfirmations: validMemberConfirmations.length,
      validGuestConfirmations: validGuestConfirmations.length,
      validTotal: validMemberConfirmations.length + validGuestConfirmations.length,
      orphanedMemberConfirmations: orphanedMemberConfirmations.length,
      orphanedGuestConfirmations: orphanedGuestConfirmations.length,
      orphanedTotal: orphanedMemberConfirmations.length + orphanedGuestConfirmations.length,
      orphanedMemberIds: orphanedMemberConfirmations.map(conf => conf.memberId),
      orphanedGuestIds: orphanedGuestConfirmations.map(conf => conf.guestId)
    };
  }, [sundayConfirmations, members, guests, upcomingSunday]);

  const handleCleanup = async () => {
    try {
      const cleanedCount = await cleanupOrphanedConfirmations(true); // Force run
      if (cleanedCount === 0) {
        showToast('info', 'No orphaned records found', 'All confirmation records are valid');
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  };

  const handleDebugState = () => {
    // Call the global debug function if available
    if ((window as any).debugGuestConfirmationState) {
      (window as any).debugGuestConfirmationState();
      showToast('info', 'Debug info logged', 'Check browser console for detailed guest-confirmation state');
    } else {
      showToast('warning', 'Debug function not available', 'Debug function not loaded yet');
    }
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-yellow-800">
          🔧 Confirmation Debug Panel
        </h3>
        <span className="text-sm text-yellow-600">
          Admin Only - {formatFullDate(upcomingSunday)}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Raw Counts */}
        <div className="bg-white rounded-lg p-3 border">
          <h4 className="font-medium text-gray-800 mb-2">Raw Confirmation Records</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Total Records:</span>
              <span className="font-mono">{confirmationStats.total}</span>
            </div>
            <div className="flex justify-between">
              <span>Member Records:</span>
              <span className="font-mono">{confirmationStats.memberConfirmations}</span>
            </div>
            <div className="flex justify-between">
              <span>Guest Records:</span>
              <span className="font-mono">{confirmationStats.guestConfirmations}</span>
            </div>
          </div>
        </div>

        {/* Valid Counts */}
        <div className="bg-white rounded-lg p-3 border">
          <h4 className="font-medium text-gray-800 mb-2">Valid Confirmations</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Valid Total:</span>
              <span className="font-mono font-bold text-green-600">
                {confirmationStats.validTotal}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Valid Members:</span>
              <span className="font-mono">{confirmationStats.validMemberConfirmations}</span>
            </div>
            <div className="flex justify-between">
              <span>Valid Guests:</span>
              <span className="font-mono">{confirmationStats.validGuestConfirmations}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Orphaned Records */}
      {confirmationStats.orphanedTotal > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <h4 className="font-medium text-red-800 mb-2">
            ⚠️ Orphaned Records Found ({confirmationStats.orphanedTotal})
          </h4>
          <div className="space-y-2 text-sm">
            {confirmationStats.orphanedMemberConfirmations > 0 && (
              <div>
                <span className="text-red-700">
                  Orphaned Member Confirmations: {confirmationStats.orphanedMemberConfirmations}
                </span>
                <div className="text-xs text-red-600 mt-1">
                  Member IDs: {confirmationStats.orphanedMemberIds.join(', ')}
                </div>
              </div>
            )}
            {confirmationStats.orphanedGuestConfirmations > 0 && (
              <div>
                <span className="text-red-700">
                  Orphaned Guest Confirmations: {confirmationStats.orphanedGuestConfirmations}
                </span>
                <div className="text-xs text-red-600 mt-1">
                  Guest IDs: {confirmationStats.orphanedGuestIds.join(', ')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Dashboard should show: <span className="font-mono font-bold">{confirmationStats.validTotal}</span>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleDebugState}
            variant="secondary"
            size="sm"
          >
            🔍 Debug State
          </Button>
          <Button
            onClick={handleCleanup}
            variant="secondary"
            size="sm"
            disabled={confirmationStats.orphanedTotal === 0}
        >
          Clean Up Orphaned Records
        </Button>
      </div>
    </div>
  );
};

export default ConfirmationDebugPanel;
