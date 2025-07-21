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

      // Show info if user is from a different church (but allow the invitation)
      if (user.churchId !== userProfile.churchId) {
        showToast('info', 'Different Church', `This user belongs to a different church (${user.churchName || user.churchId}). They will gain access to your church data when they accept.`);
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

  const handleRemoveLeader = async (invite: AdminInvite) => {
    if (!userProfile) return;

    try {
      const result = await inviteService.removeLeaderAccess(userProfile.uid, invite.invitedUserId);

      if (result.success) {
        // Update the invite status to show it's been revoked
        setInvites(prev => prev.map(inv =>
          inv.id === invite.id ? { ...inv, status: 'revoked', revokedAt: new Date().toISOString() } : inv
        ));
        showToast('success', 'Leader Removed', result.message);
      } else {
        showToast('error', 'Removal Failed', result.message);
      }
    } catch (error: any) {
      showToast('error', 'Removal Failed', error.message);
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
    if (status === 'revoked') return 'red';
    if (isExpired(expiresAt)) return 'red';
    return 'blue';
  };

  const getStatusText = (status: string, expiresAt: string) => {
    if (status === 'accepted') return 'Accepted';
    if (status === 'rejected') return 'Cancelled';
    if (status === 'revoked') return 'Removed';
    if (isExpired(expiresAt)) return 'Expired';
    return 'Pending';
  };

  if (!canManageAdminInvites(userProfile)) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserGroupIcon className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Invite Admins to Become Leaders
          </h2>
          <p className="text-gray-600 max-w-md mx-auto">
            Search for admin users by email from any church and invite them to become leaders under your authority.
          </p>
        </div>

        {/* Search User */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-2xl border border-blue-100">
          <div className="flex items-center mb-4">
            <EnvelopeIcon className="w-5 h-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Search Admin by Email</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="Enter admin email address"
                onKeyPress={(e) => e.key === 'Enter' && handleSearchUser()}
                className="w-full h-12 text-base border-2 border-gray-200 focus:border-blue-500 rounded-xl"
              />
            </div>
            <Button
              variant="primary"
              onClick={handleSearchUser}
              disabled={isSearching || !searchEmail.trim()}
              className="h-12 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-2 min-w-[120px]"
            >
              <EnvelopeIcon className="w-5 h-5" />
              <span>{isSearching ? 'Searching...' : 'Search'}</span>
            </Button>
          </div>

          {/* Search Result */}
          {searchedUser && (
            <div className="mt-6 p-4 bg-white rounded-2xl border-2 border-green-200 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-blue-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-lg font-semibold text-gray-900 truncate">{searchedUser.displayName}</h4>
                    <p className="text-sm text-gray-600 truncate">{searchedUser.email}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                        {searchedUser.role}
                      </span>
                      {searchedUser.churchId !== userProfile?.churchId && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                          Different Church
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="primary"
                  onClick={handleSendInvite}
                  disabled={isSendingInvite}
                  className="h-12 px-6 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-2 min-w-[140px]"
                >
                  <UserGroupIcon className="w-5 h-5" />
                  <span>{isSendingInvite ? 'Sending...' : 'Send Invite'}</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sent Invites List */}
        <div className="mt-8">
          <div className="flex items-center mb-6">
            <ClockIcon className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Your Sent Invites</h3>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <div className="text-gray-500">Loading invites...</div>
            </div>
          ) : invites.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl">
              <UserGroupIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No invites sent yet</p>
              <p className="text-gray-400 text-sm mt-1">Start by searching for an admin to invite</p>
            </div>
          ) : (
            <div
              className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scroll modal-scrollable"
            >
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className={`p-5 rounded-2xl border-2 transition-all duration-200 ${
                    invite.status === 'pending' && !isExpired(invite.expiresAt)
                      ? 'bg-white border-blue-200 shadow-sm hover:shadow-md'
                      : invite.status === 'accepted'
                      ? 'bg-green-50 border-green-200'
                      : invite.status === 'revoked'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <h4 className="text-lg font-semibold text-gray-900 truncate">
                          {invite.invitedUserName}
                        </h4>
                        <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${
                          getStatusColor(invite.status, invite.expiresAt) === 'green' ? 'bg-green-100 text-green-800' :
                          getStatusColor(invite.status, invite.expiresAt) === 'red' ? 'bg-red-100 text-red-800' :
                          getStatusColor(invite.status, invite.expiresAt) === 'gray' ? 'bg-gray-100 text-gray-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {getStatusText(invite.status, invite.expiresAt)}
                        </span>
                        {invite.invitedUserChurchId !== userProfile?.churchId && (
                          <span className="inline-flex items-center px-3 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                            Different Church
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-gray-600">
                          <EnvelopeIcon className="w-4 h-4 mr-2 text-gray-400" />
                          <span className="truncate">{invite.invitedUserEmail}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-500">
                          <div className="flex items-center">
                            <ClockIcon className="w-3 h-3 mr-1.5 text-blue-400" />
                            <span>Sent: {formatDate(invite.createdAt)}</span>
                          </div>
                          <div className="flex items-center">
                            <ClockIcon className="w-3 h-3 mr-1.5 text-orange-400" />
                            <span>Expires: {formatDate(invite.expiresAt)}</span>
                          </div>
                          {invite.respondedAt && (
                            <div className="flex items-center">
                              <CheckIcon className="w-3 h-3 mr-1.5 text-green-400" />
                              <span>Responded: {formatDate(invite.respondedAt)}</span>
                            </div>
                          )}
                          {invite.revokedAt && (
                            <div className="flex items-center">
                              <XMarkIcon className="w-3 h-3 mr-1.5 text-red-400" />
                              <span>Removed: {formatDate(invite.revokedAt)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      {invite.status === 'pending' && !isExpired(invite.expiresAt) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelInvite(invite.id)}
                          className="h-10 px-4 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2"
                        >
                          <TrashIcon className="w-4 h-4" />
                          <span className="text-sm font-medium">Cancel</span>
                        </Button>
                      )}
                      {invite.status === 'accepted' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLeader(invite)}
                          className="h-10 px-4 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2"
                          title="Remove leader access and revert to admin role"
                        >
                          <XMarkIcon className="w-4 h-4" />
                          <span className="text-sm font-medium">Remove Leader</span>
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
        <div className="flex justify-center pt-8 mt-8 border-t border-gray-200">
          <Button
            variant="secondary"
            onClick={onClose}
            className="h-12 px-8 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all duration-200"
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AdminInviteManager;
