import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { inviteService } from '../../services/inviteService';
import { AdminInvite } from '../../types';
import Button from '../ui/Button';
import { hasAdminPrivileges } from '../../utils/permissionUtils';
import {
  UserGroupIcon,
  CheckIcon,
  XMarkIcon,
  ClockIcon
} from '../icons';

const PendingInviteNotification: React.FC = () => {
  const { user, userProfile, showToast, refreshUserProfile } = useAppContext();
  const [pendingInvites, setPendingInvites] = useState<AdminInvite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);

  // Check for pending invites when user logs in
  useEffect(() => {
    if (user && hasAdminPrivileges(userProfile)) {
      checkPendingInvites();
    }
  }, [user, userProfile]);

  const checkPendingInvites = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const invites = await inviteService.getPendingInvitesForUser(user.uid);
      // Filter out expired invites
      const validInvites = invites.filter(invite => {
        const now = new Date();
        const expiresAt = new Date(invite.expiresAt);
        return now <= expiresAt;
      });
      setPendingInvites(validInvites);
    } catch (error: any) {
      console.error('Failed to check pending invites:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptInvite = async (invite: AdminInvite) => {
    if (!user) return;

    setProcessingInviteId(invite.id);
    try {
      // CRITICAL FIX: Use invite.invitedUserId instead of user.uid
      // This ensures we update the correct account (normal vs ministry)
      // The invite was sent to a specific account (invitedUserId), so we must update that account
      const result = await inviteService.acceptAdminInvite(invite.id, invite.invitedUserId);

      if (result.success) {
        showToast('success', 'Invite Accepted!', result.message);
        setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
        await refreshUserProfile(); // Refresh to get updated role
      } else {
        showToast('error', 'Accept Failed', result.message);
      }
    } catch (error: any) {
      showToast('error', 'Accept Failed', error.message);
    } finally {
      setProcessingInviteId(null);
    }
  };

  const handleRejectInvite = async (invite: AdminInvite) => {
    setProcessingInviteId(invite.id);
    try {
      const result = await inviteService.rejectAdminInvite(invite.id);
      
      if (result.success) {
        showToast('success', 'Invite Rejected', result.message);
        setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
      } else {
        showToast('error', 'Reject Failed', result.message);
      }
    } catch (error: any) {
      showToast('error', 'Reject Failed', error.message);
    } finally {
      setProcessingInviteId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Don't show if user is not admin or has no pending invites
  if (!user || !hasAdminPrivileges(userProfile) || pendingInvites.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
      {pendingInvites.map((invite) => (
        <div
          key={invite.id}
          className="mb-3 bg-white border-2 border-blue-200 rounded-xl shadow-lg p-4 animate-pulse"
          style={{ animationDuration: '2s' }}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <UserGroupIcon className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h4 className="font-semibold text-gray-900 text-sm">
                  Admin Role Change Invitation
                </h4>
              </div>
              
              <p className="text-sm text-gray-600 mb-2">
                <strong>{invite.createdByName}</strong> has invited you to change your role from Admin to Leader.
              </p>
              
              <div className="text-xs text-gray-500 mb-3">
                <div className="flex items-center">
                  <ClockIcon className="w-3 h-3 mr-1" />
                  Expires: {formatDate(invite.expiresAt)}
                </div>
              </div>

              <div className="flex space-x-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleAcceptInvite(invite)}
                  disabled={processingInviteId === invite.id}
                  className="flex items-center space-x-1"
                >
                  <CheckIcon className="w-3 h-3" />
                  <span className="text-xs">
                    {processingInviteId === invite.id ? 'Accepting...' : 'Accept'}
                  </span>
                </Button>
                
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRejectInvite(invite)}
                  disabled={processingInviteId === invite.id}
                  className="flex items-center space-x-1"
                >
                  <XMarkIcon className="w-3 h-3" />
                  <span className="text-xs">
                    {processingInviteId === invite.id ? 'Rejecting...' : 'Reject'}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PendingInviteNotification;
