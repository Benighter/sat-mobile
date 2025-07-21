import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { inviteService } from '../services/inviteService';
import { AdminInvite, User } from '../types';
import Button from './ui/Button';
import Input from './ui/Input';
import Modal from './ui/Modal';
import { canManageAdminInvites } from '../utils/permissionUtils';
import {
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  UserGroupIcon,
  TrashIcon,
  UserIcon,
  EnvelopeIcon
} from './icons';

interface AdminInviteManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminInviteManager: React.FC<AdminInviteManagerProps> = ({ isOpen, onClose }) => {
  const { userProfile, showToast } = useAppContext();
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchedUser, setSearchedUser] = useState<User | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // Load invites when modal opens
  useEffect(() => {
    if (isOpen && canManageAdminInvites(userProfile)) {
      loadInvites();
    }
  }, [isOpen, userProfile]);

  const loadInvites = async () => {
    if (!userProfile) return;

    setIsLoading(true);
    try {
      const adminInvites = await inviteService.getAdminInvites(userProfile.uid);
      setInvites(adminInvites);
    } catch (error: any) {
      showToast('error', 'Failed to Load', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchUser = async () => {
    if (!userProfile || !searchEmail.trim()) return;

    setIsSearching(true);
    setSearchedUser(null);

    try {
      const user = await inviteService.searchUserByEmail(searchEmail.trim(), userProfile.churchId);

      if (!user) {
        showToast('error', 'User Not Found', 'No user found with this email address.');
        return;
      }

      if (user.role !== 'admin') {
        showToast('error', 'Invalid User', 'This user is not an admin. Only admins can be invited to become leaders.');
        return;
      }

      if (user.uid === userProfile.uid) {
        showToast('error', 'Invalid User', 'You cannot invite yourself.');
        return;
      }

      // Check if user is from a different church
      if (user.churchId !== userProfile.churchId) {
        showToast('error', 'Different Church', `This user belongs to a different church (${user.churchName || user.churchId}). You can only invite users from your own church.`);
        return;
      }

      setSearchedUser(user);
    } catch (error: any) {
      showToast('error', 'Search Failed', error.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendInvite = async () => {
    if (!userProfile || !searchedUser) return;

    setIsSendingInvite(true);
    try {
      const newInvite = await inviteService.sendInviteToUser(
        userProfile.uid,
        userProfile.displayName || `${userProfile.firstName} ${userProfile.lastName}`,
        userProfile.churchId,
        searchedUser,
        168 // 7 days
      );

      setInvites(prev => [newInvite, ...prev]);
      setSearchedUser(null);
      setSearchEmail('');
      showToast('success', 'Invite Sent!', `Invite sent to ${searchedUser.displayName}. They will see it when they log in.`);
    } catch (error: any) {
      showToast('error', 'Invite Failed', error.message);
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await inviteService.cancelInvite(inviteId);
      setInvites(prev => prev.map(invite =>
        invite.id === inviteId ? { ...invite, status: 'rejected' } : invite
      ));
      showToast('success', 'Invite Cancelled', 'The invite has been cancelled');
    } catch (error: any) {
      showToast('error', 'Cancellation Failed', error.message);
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

  const isExpired = (expiresAt: string) => {
    return new Date() > new Date(expiresAt);
  };

  const getStatusColor = (status: string, expiresAt: string) => {
    if (status === 'accepted') return 'green';
    if (status === 'rejected') return 'gray';
    if (isExpired(expiresAt)) return 'red';
    return 'blue';
  };

  const getStatusText = (status: string, expiresAt: string) => {
    if (status === 'accepted') return 'Accepted';
    if (status === 'rejected') return 'Cancelled';
    if (isExpired(expiresAt)) return 'Expired';
    return 'Pending';
  };

  if (!canManageAdminInvites(userProfile)) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Admin Invites">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <UserGroupIcon className="w-12 h-12 text-blue-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Invite Admins to Become Leaders
          </h3>
          <p className="text-sm text-gray-600">
            Search for admin users by email and invite them to become leaders under your authority.
          </p>
        </div>

        {/* Search User */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">Search Admin by Email</h4>
          <div className="flex space-x-3">
            <div className="flex-1">
              <Input
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="Enter admin email address"
                onKeyPress={(e) => e.key === 'Enter' && handleSearchUser()}
              />
            </div>
            <Button
              variant="primary"
              onClick={handleSearchUser}
              disabled={isSearching || !searchEmail.trim()}
              className="flex items-center space-x-2"
            >
              <EnvelopeIcon className="w-4 h-4" />
              <span>{isSearching ? 'Searching...' : 'Search'}</span>
            </Button>
          </div>

          {/* Search Result */}
          {searchedUser && (
            <div className="mt-4 p-3 bg-white rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-900">{searchedUser.displayName}</h5>
                    <p className="text-sm text-gray-600">{searchedUser.email}</p>
                    <p className="text-xs text-blue-600 capitalize">{searchedUser.role}</p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  onClick={handleSendInvite}
                  disabled={isSendingInvite}
                  className="flex items-center space-x-2"
                >
                  <UserGroupIcon className="w-4 h-4" />
                  <span>{isSendingInvite ? 'Sending...' : 'Send Invite'}</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sent Invites List */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Your Sent Invites</h4>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Loading invites...</div>
            </div>
          ) : invites.length === 0 ? (
            <div className="text-center py-8">
              <UserGroupIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No invites sent yet</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className={`p-4 border rounded-lg ${
                    invite.status === 'pending' && !isExpired(invite.expiresAt)
                      ? 'bg-white border-gray-300'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {invite.invitedUserName}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          getStatusColor(invite.status, invite.expiresAt) === 'green' ? 'bg-green-100 text-green-800' :
                          getStatusColor(invite.status, invite.expiresAt) === 'red' ? 'bg-red-100 text-red-800' :
                          getStatusColor(invite.status, invite.expiresAt) === 'gray' ? 'bg-gray-100 text-gray-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {getStatusText(invite.status, invite.expiresAt)}
                        </span>
                      </div>

                      <div className="text-xs text-gray-500 space-y-1">
                        <div className="flex items-center">
                          <EnvelopeIcon className="w-3 h-3 mr-1" />
                          {invite.invitedUserEmail}
                        </div>
                        <div className="flex items-center">
                          <ClockIcon className="w-3 h-3 mr-1" />
                          Sent: {formatDate(invite.createdAt)}
                        </div>
                        <div className="flex items-center">
                          <ClockIcon className="w-3 h-3 mr-1" />
                          Expires: {formatDate(invite.expiresAt)}
                        </div>
                        {invite.respondedAt && (
                          <div className="flex items-center">
                            <CheckIcon className="w-3 h-3 mr-1" />
                            Responded: {formatDate(invite.respondedAt)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {invite.status === 'pending' && !isExpired(invite.expiresAt) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelInvite(invite.id)}
                          className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                        >
                          <TrashIcon className="w-4 h-4" />
                          <span className="text-xs">Cancel</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AdminInviteManager;
