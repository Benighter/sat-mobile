import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { inviteService } from '../services/inviteService';
import { AdminInvite, User } from '../types';
import Button from './ui/Button';
import Input from './ui/Input';
import { canManageAdminInvites } from '../utils/permissionUtils';
import {
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  UserGroupIcon,
  TrashIcon,
  UserIcon,
  EnvelopeIcon,
  ArrowLeftIcon,
  SearchIcon,
  PlusIcon
} from './icons';

interface AdminInviteScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminInviteScreen: React.FC<AdminInviteScreenProps> = ({ isOpen, onClose }) => {
  const { userProfile, showToast } = useAppContext();
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchedUser, setSearchedUser] = useState<User | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'invites'>('search');

  // Load invites when screen opens
  useEffect(() => {
    if (isOpen && canManageAdminInvites(userProfile)) {
      loadInvites();
    }
  }, [isOpen, userProfile]);

  const loadInvites = async () => {
    if (!userProfile) return;
    
    setIsLoading(true);
    try {
      const userInvites = await inviteService.getAdminInvites(userProfile.uid);
      setInvites(userInvites);
    } catch (error: any) {
      console.error('Error loading invites:', error);
      showToast('error', 'Failed to load invites', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchUser = async () => {
    if (!searchEmail.trim() || !userProfile) return;

    setIsSearching(true);
    setSearchedUser(null);
    
    try {
      const user = await inviteService.searchUserByEmail(searchEmail.trim(), userProfile.churchId);
      if (user) {
        setSearchedUser(user);
      } else {
        showToast('error', 'No admin user found with this email address');
      }
    } catch (error: any) {
      console.error('Error searching user:', error);
      showToast('error', 'Failed to search user', error.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendInvite = async () => {
    if (!searchedUser || !userProfile) return;

    setIsSendingInvite(true);
    try {
      await inviteService.sendInviteToUser(
        userProfile.uid,
        userProfile.displayName,
        userProfile.churchId,
        searchedUser
      );
      
      showToast('success', `Invite sent to ${searchedUser.displayName}`);
      setSearchedUser(null);
      setSearchEmail('');
      loadInvites();
      setActiveTab('invites'); // Switch to invites tab after sending
    } catch (error: any) {
      console.error('Error sending invite:', error);
      showToast('error', 'Failed to send invite', error.message);
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await inviteService.cancelInvite(inviteId);
      showToast('success', 'Invite cancelled successfully');
      loadInvites();
    } catch (error: any) {
      console.error('Error cancelling invite:', error);
      showToast('error', 'Failed to cancel invite', error.message);
    }
  };

  const handleRemoveLeader = async (invite: AdminInvite) => {
    try {
      await inviteService.removeLeaderAccess(invite.invitedUserId, invite.id);
      showToast('success', `Removed leader access for ${invite.invitedUserName}`);
      loadInvites();
    } catch (error: any) {
      console.error('Error removing leader:', error);
      showToast('error', 'Failed to remove leader access', error.message);
    }
  };

  const handleDeleteInvite = async (invite: AdminInvite) => {
    try {
      await inviteService.deleteInvite(invite.id);
      showToast('success', `Deleted invite for ${invite.invitedUserName}`);
      loadInvites();
    } catch (error: any) {
      console.error('Error deleting invite:', error);
      showToast('error', 'Failed to delete invite', error.message);
    }
  };

  const getStatusText = (status: string, expiresAt: string) => {
    if (status === 'accepted') return 'Accepted';
    if (status === 'rejected') return 'Rejected';
    if (status === 'revoked') return 'Removed';
    if (isExpired(expiresAt)) return 'Expired';
    return 'Pending';
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

  if (!isOpen || !canManageAdminInvites(userProfile)) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 z-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors duration-200"
          >
            <ArrowLeftIcon className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Leadership Management</h1>
            <p className="text-sm text-gray-600">Invite admins to become leaders</p>
          </div>
        </div>
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
          <UserGroupIcon className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white/60 backdrop-blur-sm px-4 py-2 border-b border-gray-200/30">
        <div className="flex space-x-1 bg-gray-100/80 rounded-2xl p-1">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
              activeTab === 'search'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <SearchIcon className="w-5 h-5" />
            <span>Search Admin</span>
          </button>
          <button
            onClick={() => setActiveTab('invites')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
              activeTab === 'invites'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <ClockIcon className="w-5 h-5" />
            <span>Sent Invites</span>
            {invites.length > 0 && (
              <span className="bg-blue-100 text-blue-600 text-xs font-semibold px-2 py-1 rounded-full">
                {invites.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-20 scroll-smooth scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent" style={{ height: 'calc(100vh - 140px)' }}>
        {activeTab === 'search' ? (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Search Section */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white/50">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <EnvelopeIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Find Administrator</h2>
                  <p className="text-gray-600">Search by email address</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <Input
                    type="email"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    placeholder="Enter admin email address..."
                    onKeyPress={(e) => e.key === 'Enter' && handleSearchUser()}
                    className="w-full h-14 pl-12 pr-4 text-base border-2 border-gray-200 focus:border-blue-400 rounded-2xl bg-white shadow-sm focus:shadow-lg transition-all duration-300"
                  />
                  <EnvelopeIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>

                <Button
                  variant="primary"
                  onClick={handleSearchUser}
                  disabled={isSearching || !searchEmail.trim()}
                  className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-2xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  {isSearching ? (
                    <div className="flex items-center justify-center space-x-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Searching...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-3">
                      <SearchIcon className="w-5 h-5" />
                      <span>Search Admin</span>
                    </div>
                  )}
                </Button>
              </div>
            </div>

            {/* Search Results */}
            {searchedUser && (
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white/50 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <CheckIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Admin Found</h3>
                    <p className="text-gray-600">Ready to send leadership invite</p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200/50">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <UserIcon className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-gray-900">{searchedUser.displayName}</h4>
                      <p className="text-gray-600 flex items-center space-x-2">
                        <EnvelopeIcon className="w-4 h-4" />
                        <span>{searchedUser.email}</span>
                      </p>
                      <p className="text-sm text-green-600 font-medium mt-1">Administrator Role</p>
                    </div>
                  </div>

                  <div className="mt-6 flex space-x-3">
                    <Button
                      variant="primary"
                      onClick={handleSendInvite}
                      disabled={isSendingInvite}
                      className="flex-1 h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      {isSendingInvite ? (
                        <div className="flex items-center justify-center space-x-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Sending...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center space-x-2">
                          <PlusIcon className="w-5 h-5" />
                          <span>Send Leadership Invite</span>
                        </div>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSearchedUser(null);
                        setSearchEmail('');
                      }}
                      className="px-6 h-12 border-2 border-gray-200 hover:border-gray-300 rounded-2xl font-semibold transition-all duration-300"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Invites Tab */
          <div className="max-w-4xl mx-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                  <p className="text-gray-600 font-medium">Loading invites...</p>
                </div>
              </div>
            ) : invites.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <UserGroupIcon className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">No Invites Sent</h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  You haven't sent any leadership invites yet. Use the search tab to find administrators and invite them to become leaders.
                </p>
                <Button
                  variant="primary"
                  onClick={() => setActiveTab('search')}
                  className="h-12 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-center space-x-2">
                    <SearchIcon className="w-5 h-5" />
                    <span>Search Admins</span>
                  </div>
                </Button>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-full scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                <div className="space-y-3">
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 mb-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Sent Leadership Invites</h2>
                  <p className="text-gray-600">Track and manage your invitation history</p>
                </div>

                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-white/60 hover:shadow-md transition-all duration-200 w-full"
                  >
                    <div className="flex items-start space-x-3">
                      {/* Avatar */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 ${
                        getStatusColor(invite.status, invite.expiresAt) === 'green'
                          ? 'bg-gradient-to-br from-green-400 to-emerald-500'
                          : getStatusColor(invite.status, invite.expiresAt) === 'red'
                          ? 'bg-gradient-to-br from-red-400 to-rose-500'
                          : getStatusColor(invite.status, invite.expiresAt) === 'gray'
                          ? 'bg-gradient-to-br from-gray-400 to-slate-500'
                          : 'bg-gradient-to-br from-blue-400 to-indigo-500'
                      }`}>
                        <UserIcon className="w-6 h-6 text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header with name and status - Fixed alignment */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0 pr-3">
                            <h3 className="text-base font-semibold text-gray-900 truncate leading-tight">
                              {invite.invitedUserName}
                            </h3>
                            <div className="flex items-center mt-1">
                              <EnvelopeIcon className="w-3 h-3 mr-1 text-gray-400 flex-shrink-0" />
                              <span className="text-xs text-gray-600 truncate">{invite.invitedUserEmail}</span>
                            </div>
                          </div>
                          {/* Status Badge - Fixed width and alignment */}
                          <div className="flex-shrink-0">
                            <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded-full min-w-[70px] text-center ${
                              getStatusColor(invite.status, invite.expiresAt) === 'green'
                                ? 'bg-green-100 text-green-700'
                                : getStatusColor(invite.status, invite.expiresAt) === 'red'
                                ? 'bg-red-100 text-red-700'
                                : getStatusColor(invite.status, invite.expiresAt) === 'gray'
                                ? 'bg-gray-100 text-gray-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {getStatusText(invite.status, invite.expiresAt)}
                            </span>
                          </div>
                        </div>

                        {/* Dates - Consistent layout */}
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                          <div className="flex items-center">
                            <ClockIcon className="w-3 h-3 mr-1 flex-shrink-0" />
                            <span>Sent: {formatDate(invite.createdAt)}</span>
                          </div>
                          {invite.respondedAt && (
                            <div className="flex items-center">
                              <CheckIcon className="w-3 h-3 mr-1 flex-shrink-0" />
                              <span>Responded: {formatDate(invite.respondedAt)}</span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons - Consistent positioning */}
                        <div className="flex justify-end">
                          {invite.status === 'pending' && !isExpired(invite.expiresAt) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelInvite(invite.id)}
                              className="h-7 px-3 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 rounded-lg text-xs font-medium transition-all duration-200 flex items-center"
                            >
                              <XMarkIcon className="w-3 h-3 mr-1" />
                              Cancel Invite
                            </Button>
                          )}
                          {invite.status === 'accepted' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveLeader(invite)}
                              className="h-7 px-3 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 rounded-lg text-xs font-medium transition-all duration-200 flex items-center"
                            >
                              <XMarkIcon className="w-3 h-3 mr-1" />
                              Remove Leader
                            </Button>
                          )}
                          {invite.status === 'revoked' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteInvite(invite)}
                              className="h-7 px-3 bg-gray-50 hover:bg-red-100 text-gray-600 hover:text-red-700 border border-gray-200 hover:border-red-200 rounded-lg text-xs font-medium transition-all duration-200 flex items-center"
                            >
                              <TrashIcon className="w-3 h-3 mr-1" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminInviteScreen;
