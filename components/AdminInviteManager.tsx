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
      loadInvites(); // Refresh the invites list
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
      loadInvites(); // Refresh the invites list
    } catch (error: any) {
      console.error('Error cancelling invite:', error);
      showToast('error', 'Failed to cancel invite', error.message);
    }
  };

  const handleRemoveLeader = async (invite: AdminInvite) => {
    try {
      await inviteService.removeLeaderAccess(invite.invitedUserId, invite.id);
      showToast('success', `Removed leader access for ${invite.invitedUserName}`);
      loadInvites(); // Refresh the invites list
    } catch (error: any) {
      console.error('Error removing leader:', error);
      showToast('error', 'Failed to remove leader access', error.message);
    }
  };

  const handleDeleteInvite = async (invite: AdminInvite) => {
    try {
      await inviteService.deleteInvite(invite.id);
      showToast('success', `Deleted invite for ${invite.invitedUserName}`);
      loadInvites(); // Refresh the invites list
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

  if (!canManageAdminInvites(userProfile)) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="max-w-3xl mx-auto">
        {/* Enhanced Header with Animation */}
        <div className="text-center mb-10 relative">
          {/* Background decoration */}
          <div className="absolute inset-0 -z-10">
            <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full opacity-30 mx-auto blur-3xl"></div>
          </div>
          
          {/* Main icon with enhanced styling */}
          <div className="relative mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/25 floating">
              <UserGroupIcon className="w-10 h-10 text-white" />
            </div>
            {/* Decorative rings */}
            <div className="absolute inset-0 w-20 h-20 mx-auto rounded-3xl border-2 border-blue-200 animate-pulse"></div>
            <div className="absolute inset-0 w-24 h-24 mx-auto -m-2 rounded-3xl border border-purple-100 opacity-50"></div>
          </div>
          
          <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent mb-3">
            Invite Admins to Become Leaders
          </h2>
          <p className="text-gray-600 max-w-lg mx-auto text-lg leading-relaxed">
            Search for admin users by email from any church and invite them to become leaders under your authority.
          </p>
          
          {/* Subtle divider */}
          <div className="w-24 h-1 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full mx-auto mt-6 opacity-60"></div>
        </div>

        {/* Enhanced Search Section */}
        <div className="relative mb-8">
          {/* Background with enhanced gradient and glass effect */}
          <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8 rounded-3xl border border-blue-100/50 shadow-xl shadow-blue-100/20 backdrop-blur-sm relative overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-200/20 to-purple-200/20 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-200/20 to-blue-200/20 rounded-full translate-y-12 -translate-x-12"></div>
            
            {/* Section header with icon */}
            <div className="flex items-center mb-6 relative z-10">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
                <EnvelopeIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Search Admin by Email</h3>
                <p className="text-sm text-gray-600 mt-1">Find and invite administrators from any church</p>
              </div>
            </div>
            
            {/* Enhanced search form */}
            <div className="flex flex-col sm:flex-row gap-4 relative z-10">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <EnvelopeIcon className="w-5 h-5 text-gray-400" />
                </div>
                <Input
                  type="email"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  placeholder="Enter admin email address..."
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchUser()}
                  className="w-full h-14 pl-12 pr-4 text-base border-2 border-white/50 focus:border-blue-400 rounded-2xl bg-white/70 backdrop-blur-sm shadow-lg focus:shadow-xl transition-all duration-300 placeholder:text-gray-400"
                />
              </div>
              <Button
                variant="primary"
                onClick={handleSearchUser}
                disabled={isSearching || !searchEmail.trim()}
                className="h-14 px-8 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 rounded-2xl font-semibold transition-all duration-300 flex items-center justify-center space-x-3 min-w-[140px] shadow-lg hover:shadow-xl hover:scale-105 disabled:hover:scale-100"
              >
                {isSearching ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <EnvelopeIcon className="w-5 h-5" />
                    <span>Search</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Enhanced Search Result */}
        {searchedUser && (
          <div className="mt-8 relative">
            {/* Success animation background */}
            <div className="absolute inset-0 bg-gradient-to-r from-green-100/50 to-emerald-100/50 rounded-3xl blur-xl"></div>

            <div className="relative bg-white/90 backdrop-blur-sm p-6 rounded-3xl border-2 border-green-200/50 shadow-2xl shadow-green-100/20">
              {/* Success indicator */}
              <div className="absolute -top-3 left-6">
                <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-1 rounded-full text-sm font-medium shadow-lg">
                  ✨ User Found
                </div>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pt-2">
                <div className="flex items-center space-x-5">
                  {/* Enhanced user avatar */}
                  <div className="relative">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-400 via-emerald-500 to-teal-500 rounded-3xl flex items-center justify-center flex-shrink-0 shadow-xl">
                      <UserIcon className="w-8 h-8 text-white" />
                    </div>
                    {/* Online indicator */}
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 border-2 border-white rounded-full"></div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-xl font-bold text-gray-900 truncate mb-1">{searchedUser.displayName}</h4>
                    <p className="text-gray-600 truncate mb-2 flex items-center">
                      <EnvelopeIcon className="w-4 h-4 mr-2 text-gray-400" />
                      {searchedUser.email}
                    </p>
                    <div className="flex items-center space-x-3 mt-2">
                      {/* Church badge */}
                      <span className="inline-flex items-center px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                        {searchedUser.churchName || 'Church Member'}
                      </span>

                      {/* Role badge */}
                      <span className="inline-flex items-center px-3 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                        {searchedUser.role === 'admin' ? '👑 Admin' : '👤 User'}
                      </span>

                      {/* Different church indicator */}
                      {searchedUser.churchId !== userProfile?.churchId && (
                        <span className="inline-flex items-center px-3 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                          Different Church
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Enhanced send invite button */}
                <Button
                  variant="primary"
                  onClick={handleSendInvite}
                  disabled={isSendingInvite}
                  className="h-14 px-8 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 rounded-2xl font-semibold transition-all duration-300 flex items-center justify-center space-x-3 min-w-[160px] shadow-lg hover:shadow-xl hover:scale-105 disabled:hover:scale-100"
                >
                  {isSendingInvite ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <UserGroupIcon className="w-5 h-5" />
                      <span>Send Invite</span>
                      <div className="w-2 h-2 bg-white/50 rounded-full animate-pulse"></div>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Sent Invites Section */}
        <div className="mt-12">
          {/* Section header with enhanced styling */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-slate-700 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
                <ClockIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Your Sent Invites</h3>
                <p className="text-sm text-gray-600 mt-1">Track and manage your invitation history</p>
              </div>
            </div>
            {invites.length > 0 && (
              <div className="bg-gradient-to-r from-blue-100 to-purple-100 px-4 py-2 rounded-full">
                <span className="text-sm font-semibold text-gray-700">{invites.length} Total</span>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-slate-50 rounded-3xl border border-gray-100">
              <div className="relative mb-6">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
                <div className="absolute inset-0 rounded-full border-4 border-blue-100 opacity-25"></div>
              </div>
              <div className="text-gray-600 text-lg font-medium">Loading invites...</div>
              <div className="text-gray-400 text-sm mt-2">Please wait while we fetch your data</div>
            </div>
          ) : invites.length === 0 ? (
            <div className="text-center py-16 bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 rounded-3xl border border-gray-100 relative overflow-hidden">
              {/* Decorative background */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute top-10 left-10 w-20 h-20 bg-blue-400 rounded-full"></div>
                <div className="absolute bottom-10 right-10 w-16 h-16 bg-purple-400 rounded-full"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-indigo-400 rounded-full"></div>
              </div>

              <div className="relative z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <UserGroupIcon className="w-10 h-10 text-gray-400" />
                </div>
                <p className="text-gray-600 text-xl font-semibold mb-2">No invites sent yet</p>
                <p className="text-gray-500 text-base max-w-md mx-auto leading-relaxed">Start by searching for an admin to invite and build your leadership team</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-h-96 overflow-y-auto pr-2 custom-scroll modal-scrollable">
              {invites.map((invite, index) => (
                <div
                  key={invite.id}
                  className={`group relative p-6 rounded-3xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                    invite.status === 'pending' && !isExpired(invite.expiresAt)
                      ? 'bg-white border-blue-200/50 shadow-lg hover:shadow-xl hover:border-blue-300 bg-gradient-to-br from-white to-blue-50/30'
                      : invite.status === 'accepted'
                      ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200/50 shadow-lg'
                      : invite.status === 'revoked'
                      ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200/50 shadow-lg'
                      : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200/50 shadow-lg'
                  }`}
                  style={{
                    animationDelay: `${index * 100}ms`
                  }}
                >
                  {/* Status indicator line */}
                  <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-3xl ${
                    invite.status === 'pending' && !isExpired(invite.expiresAt)
                      ? 'bg-gradient-to-r from-blue-400 to-indigo-500'
                      : invite.status === 'accepted'
                      ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                      : invite.status === 'revoked'
                      ? 'bg-gradient-to-r from-red-400 to-rose-500'
                      : 'bg-gradient-to-r from-gray-400 to-slate-500'
                  }`}></div>

                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      {/* Enhanced header with avatar */}
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                          invite.status === 'accepted'
                            ? 'bg-gradient-to-br from-green-400 to-emerald-500'
                            : invite.status === 'pending' && !isExpired(invite.expiresAt)
                            ? 'bg-gradient-to-br from-blue-400 to-indigo-500'
                            : 'bg-gradient-to-br from-gray-400 to-slate-500'
                        }`}>
                          <UserIcon className="w-6 h-6 text-white" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-3 mb-2">
                            <h4 className="text-xl font-bold text-gray-900 truncate">
                              {invite.invitedUserName}
                            </h4>
                            <span className={`inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full shadow-sm ${
                              getStatusColor(invite.status, invite.expiresAt) === 'green' ? 'bg-green-100 text-green-800 border border-green-200' :
                              getStatusColor(invite.status, invite.expiresAt) === 'red' ? 'bg-red-100 text-red-800 border border-red-200' :
                              getStatusColor(invite.status, invite.expiresAt) === 'gray' ? 'bg-gray-100 text-gray-800 border border-gray-200' :
                              'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}>
                              {getStatusText(invite.status, invite.expiresAt)}
                            </span>
                          </div>

                          {/* Church badge */}
                          {invite.invitedUserChurchId !== userProfile?.churchId && (
                            <span className="inline-flex items-center px-3 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full border border-orange-200">
                              <div className="w-2 h-2 bg-orange-400 rounded-full mr-2"></div>
                              Different Church
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Enhanced details section */}
                      <div className="space-y-4">
                        {/* Email with enhanced styling */}
                        <div className="flex items-center text-base text-gray-700 bg-gray-50/50 rounded-2xl px-4 py-3">
                          <EnvelopeIcon className="w-5 h-5 mr-3 text-gray-500" />
                          <span className="truncate font-medium">{invite.invitedUserEmail}</span>
                        </div>

                        {/* Enhanced timeline grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex items-center text-sm text-gray-600 bg-blue-50/50 rounded-xl px-3 py-2">
                            <ClockIcon className="w-4 h-4 mr-2 text-blue-500" />
                            <div>
                              <div className="font-medium">Sent</div>
                              <div className="text-xs text-gray-500">{formatDate(invite.createdAt)}</div>
                            </div>
                          </div>

                          <div className="flex items-center text-sm text-gray-600 bg-orange-50/50 rounded-xl px-3 py-2">
                            <ClockIcon className="w-4 h-4 mr-2 text-orange-500" />
                            <div>
                              <div className="font-medium">Expires</div>
                              <div className="text-xs text-gray-500">{formatDate(invite.expiresAt)}</div>
                            </div>
                          </div>

                          {invite.respondedAt && (
                            <div className="flex items-center text-sm text-gray-600 bg-green-50/50 rounded-xl px-3 py-2">
                              <CheckIcon className="w-4 h-4 mr-2 text-green-500" />
                              <div>
                                <div className="font-medium">Responded</div>
                                <div className="text-xs text-gray-500">{formatDate(invite.respondedAt)}</div>
                              </div>
                            </div>
                          )}

                          {invite.revokedAt && (
                            <div className="flex items-center text-sm text-gray-600 bg-red-50/50 rounded-xl px-3 py-2">
                              <XMarkIcon className="w-4 h-4 mr-2 text-red-500" />
                              <div>
                                <div className="font-medium">Removed</div>
                                <div className="text-xs text-gray-500">{formatDate(invite.revokedAt)}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Enhanced action buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 lg:ml-6">
                      {invite.status === 'pending' && !isExpired(invite.expiresAt) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelInvite(invite.id)}
                          className="h-12 px-6 bg-red-50/80 hover:bg-red-100 text-red-600 hover:text-red-700 border-2 border-red-200/50 hover:border-red-300 rounded-2xl transition-all duration-300 flex items-center justify-center space-x-3 font-medium shadow-sm hover:shadow-md group"
                        >
                          <TrashIcon className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
                          <span>Cancel Invite</span>
                        </Button>
                      )}
                      {invite.status === 'accepted' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLeader(invite)}
                          className="h-12 px-6 bg-red-50/80 hover:bg-red-100 text-red-600 hover:text-red-700 border-2 border-red-200/50 hover:border-red-300 rounded-2xl transition-all duration-300 flex items-center justify-center space-x-3 font-medium shadow-sm hover:shadow-md group"
                          title="Remove leader access and revert to admin role"
                        >
                          <XMarkIcon className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
                          <span>Remove Leader</span>
                        </Button>
                      )}
                      {invite.status === 'revoked' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteInvite(invite)}
                          className="h-12 px-6 bg-gray-50/80 hover:bg-red-100 text-gray-600 hover:text-red-700 border-2 border-gray-200/50 hover:border-red-300 rounded-2xl transition-all duration-300 flex items-center justify-center space-x-3 font-medium shadow-sm hover:shadow-md group"
                          title="Permanently delete this invite record"
                        >
                          <TrashIcon className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
                          <span>Delete</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Enhanced close button */}
        <div className="mt-12 text-center">
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-12 px-8 bg-gray-100/80 hover:bg-gray-200 text-gray-700 hover:text-gray-800 border-2 border-gray-200/50 hover:border-gray-300 rounded-2xl transition-all duration-300 flex items-center justify-center space-x-3 font-medium shadow-sm hover:shadow-md mx-auto"
          >
            <XMarkIcon className="w-5 h-5" />
            <span>Close</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AdminInviteManager;
