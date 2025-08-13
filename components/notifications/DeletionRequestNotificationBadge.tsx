import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { MemberDeletionRequest } from '../../types';
import { memberDeletionRequestService } from '../../services/firebaseService';
import { hasAdminPrivileges } from '../../utils/permissionUtils';
import { TabKeys } from '../../types';
import { ExclamationTriangleIcon } from '../icons';

const DeletionRequestNotificationBadge: React.FC = () => {
  const { userProfile, switchTab } = useAppContext();
  const [pendingRequests, setPendingRequests] = useState<MemberDeletionRequest[]>([]);

  // Check if current user is admin
  const isAdmin = hasAdminPrivileges(userProfile);

  // Load pending deletion requests
  useEffect(() => {
    if (!isAdmin) return;

    const loadPendingRequests = async () => {
      try {
        const requests = await memberDeletionRequestService.getAll();
        const pending = requests.filter(r => r.status === 'pending');
        setPendingRequests(pending);
      } catch (error: any) {
        console.error('Error loading pending deletion requests:', error);
        // Don't show toast for this error as it's background loading
      } finally {
        // no-op
      }
    };

    loadPendingRequests();

    // Set up real-time listener for pending requests
    const unsubscribe = memberDeletionRequestService.onSnapshot((requests) => {
      const pending = requests.filter(r => r.status === 'pending');
      setPendingRequests(pending);
  // no-op
    });

    return () => unsubscribe();
  }, [isAdmin]);

  // Don't render if not admin or no pending requests
  if (!isAdmin || pendingRequests.length === 0) {
    return null;
  }

  const handleClick = () => {
    switchTab({ id: TabKeys.ADMIN_DELETION_REQUESTS, name: 'Admin Deletion Requests' });
  };

  return (
    <>
      {/* Notification Badge Button */}
      <button
        onClick={handleClick}
        className="relative flex items-center justify-center w-8 h-8 xs:w-9 xs:h-9 sm:w-10 sm:h-10 bg-red-100 hover:bg-red-200 rounded-full transition-all duration-300 group shadow-lg hover:shadow-xl touch-manipulation"
        title={`${pendingRequests.length} pending deletion request${pendingRequests.length !== 1 ? 's' : ''}`}
        aria-label={`${pendingRequests.length} pending deletion requests`}
      >
        {/* Icon */}
        <ExclamationTriangleIcon className="w-4 h-4 xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-red-600 group-hover:text-red-700 transition-colors" />

        {/* Badge Count */}
        <div className="absolute -top-0.5 -right-0.5 xs:-top-1 xs:-right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[16px] h-4 xs:min-w-[18px] xs:h-4 sm:min-w-[20px] sm:h-5 flex items-center justify-center px-0.5 xs:px-1 shadow-lg animate-pulse">
          <span className="text-[10px] xs:text-xs">
            {pendingRequests.length > 99 ? '99+' : pendingRequests.length}
          </span>
        </div>

        {/* Pulse Animation Ring */}
        <div className="absolute inset-0 rounded-full bg-red-400 opacity-20 animate-ping"></div>
      </button>
    </>
  );
};

export default DeletionRequestNotificationBadge;
