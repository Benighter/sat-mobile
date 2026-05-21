import React from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { hasAdminPrivileges } from '../../utils/permissionUtils';
import { TabKeys } from '../../types';
import { ExclamationTriangleIcon } from '../icons';

const DeletionRequestNotificationBadge: React.FC = () => {
  const { userProfile, memberDeletionRequests, switchTab } = useAppContext();

  // Check if current user is admin
  const isAdmin = hasAdminPrivileges(userProfile);
  const pendingRequests = memberDeletionRequests.filter(request => request.status === 'pending');

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
        className="relative inline-flex items-center justify-center w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 bg-red-50 hover:bg-red-100 rounded-full transition-transform duration-200 hover:scale-110 group shadow-sm hover:shadow-md touch-manipulation"
        title={`${pendingRequests.length} pending deletion request${pendingRequests.length !== 1 ? 's' : ''}`}
        aria-label={`${pendingRequests.length} pending deletion requests`}
      >
        {/* Icon */}
        <ExclamationTriangleIcon className="w-5 h-5 text-red-600 group-hover:text-red-700 transition-colors" />

        {/* Badge Count */}
        <div className="absolute top-0 right-0 translate-x-1/4 -translate-y-1/4 xs:translate-x-1/3 xs:-translate-y-1/3 bg-red-500 text-white font-bold rounded-full min-w-[18px] h-[18px] xs:min-w-[20px] xs:h-[20px] flex items-center justify-center text-[10px] xs:text-xs shadow-lg ring-2 ring-white">
          {pendingRequests.length > 99 ? '99+' : pendingRequests.length}
        </div>

        {/* Pulse Animation Ring */}
        <div className="absolute inset-0 rounded-full bg-red-400/30 animate-ping"></div>
      </button>
    </>
  );
};

export default DeletionRequestNotificationBadge;
