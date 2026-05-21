import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { inviteService } from '../../services/inviteService';
import { AdminInvite, User } from '../../types';
import Button from '../ui/Button';
import { canManageAdminInvites, isCampusShepherd, isPromotedCampusAdmin } from '../../utils/permissionUtils';
import {
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  UserGroupIcon,
  UserIcon,
  EnvelopeIcon,
  ArrowLeftIcon,
  SearchIcon,
  PlusIcon,
  ChevronDownIcon
} from '../icons';

interface AdminInviteScreenProps {
  isOpen: boolean;
  onClose: () => void;
  displayMode?: 'overlay' | 'page';
}

const AdminInviteScreen: React.FC<AdminInviteScreenProps> = ({ isOpen, onClose, displayMode = 'overlay' }) => {
  const { userProfile, showToast, refreshAccessibleChurchLinks, isImpersonating, impersonatedAdminId, switchBackToOwnChurch, bacentas } = useAppContext();
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchedUser, setSearchedUser] = useState<User | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [updatingInviteIds, setUpdatingInviteIds] = useState<Set<string>>(new Set());
  const [scopeDrafts, setScopeDrafts] = useState<Record<string, string[]>>({});
  const [expandedScopeInviteIds, setExpandedScopeInviteIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'search' | 'invites'>('search');
  const isPageMode = displayMode === 'page';
  const isCampusShepherdMode = isCampusShepherd(userProfile);
  const isPromotedMode = isPromotedCampusAdmin(userProfile);
  const canPromoteInvitedAdmins = canManageAdminInvites(userProfile);

  const modeLabel = isPromotedMode
    ? 'Promoted Campus Admin Mode'
    : isCampusShepherdMode
      ? 'Campus Shepherd Mode'
      : 'Admin Mode';

  const modeDescription = isPromotedMode
    ? 'You can manage the bacentas assigned to your migration promotion.'
    : isCampusShepherdMode
      ? 'You can invite leaders and promote accepted invitees with a Bacenta migration scope.'
      : 'You can invite leaders and use migration promotion to give them scoped admin control.';

  const modeBadgeColor = isPromotedMode
    ? {
        border: 'border-purple-500/15',
        bg: 'bg-purple-500/5',
        text: 'text-purple-800',
        desc: 'text-purple-900/80',
        dot: 'bg-purple-500',
        dotPing: 'bg-purple-400'
      }
    : isCampusShepherdMode
      ? {
          border: 'border-emerald-500/25',
          bg: 'bg-emerald-500/10',
          text: 'text-emerald-800',
          desc: 'text-emerald-900/90',
          dot: 'bg-emerald-500',
          dotPing: 'bg-emerald-400'
        }
      : {
          border: 'border-slate-500/15',
          bg: 'bg-slate-500/5',
          text: 'text-slate-800',
          desc: 'text-slate-900/80',
          dot: 'bg-slate-500',
          dotPing: 'bg-slate-400'
        };

  // Detect navbar height for proper positioning
  useEffect(() => {
    if (!isOpen || isPageMode) return;

    const detectNavbarHeight = (): number => {
      const selectors = [
        'nav',
        '.navbar',
        '[role="navigation"]',
        '.nav-header',
        '.app-header',
        '.top-nav',
        'header nav',
        'header'
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector) as HTMLElement;
        if (element && element.offsetHeight > 0) {
          return element.offsetHeight;
        }
      }

      const fixedElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el as Element);
        return style.position === 'fixed' &&
               (style.top === '0px' || style.top === '0') &&
               (el as HTMLElement).offsetHeight > 0 &&
               (el as HTMLElement).offsetHeight < 200;
      });

      return fixedElements.length > 0 ? (fixedElements[0] as HTMLElement).offsetHeight : 0;
    };

    const updateNavbarHeight = () => {
      const navbarHeight = detectNavbarHeight();
      document.documentElement.style.setProperty('--navbar-height', `${navbarHeight}px`);
    };

    updateNavbarHeight();
    setTimeout(updateNavbarHeight, 100);

    const handleResize = () => {
      setTimeout(updateNavbarHeight, 150);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [isOpen, isPageMode]);

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
      const userInvites = await inviteService.getAdminInvites(userProfile.uid, userProfile.churchId);
      setInvites(userInvites);
      setScopeDrafts(prev => {
        const next = { ...prev };
        userInvites.forEach(invite => {
          if (!next[invite.id]) {
            next[invite.id] = Array.isArray(invite.assignedBacentaIds) ? invite.assignedBacentaIds : [];
          }
        });
        return next;
      });
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
      const user = await inviteService.searchUserByEmail(searchEmail.trim(), { inviterIsMinistry: !!userProfile?.isMinistryAccount });
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
        searchedUser,
        168, // Default 7 days expiration
        !!userProfile.isMinistryAccount // Pass ministry context
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
      if (!userProfile) return;
      await inviteService.removeLeaderAccess(userProfile.uid, invite.invitedUserId);
      showToast('success', `Removed leader access for ${invite.invitedUserName}`);
      try {
        if (isImpersonating && impersonatedAdminId === invite.invitedUserId) {
          await switchBackToOwnChurch();
        }
      } catch {}
      try { await refreshAccessibleChurchLinks?.(); } catch {}
      loadInvites();
    } catch (error: any) {
      console.error('Error removing leader:', error);
      showToast('error', 'Failed to remove leader access', error.message);
    }
  };

  const runInviteUpdate = async (inviteId: string, action: () => Promise<void>) => {
    setUpdatingInviteIds(prev => new Set(prev).add(inviteId));
    try {
      await action();
      await loadInvites();
    } finally {
      setUpdatingInviteIds(prev => { const next = new Set(prev); next.delete(inviteId); return next; });
    }
  };

  const getScopeDraft = (invite: AdminInvite): string[] => (
    scopeDrafts[invite.id] || invite.assignedBacentaIds || []
  );

  const toggleScopePanel = (inviteId: string) => {
    setExpandedScopeInviteIds(prev => {
      const next = new Set(prev);
      if (next.has(inviteId)) {
        next.delete(inviteId);
      } else {
        next.add(inviteId);
      }
      return next;
    });
  };

  const toggleScopeBacenta = (inviteId: string, bacentaId: string) => {
    setScopeDrafts(prev => {
      const current = prev[inviteId] || [];
      const next = current.includes(bacentaId)
        ? current.filter(id => id !== bacentaId)
        : [...current, bacentaId];
      return { ...prev, [inviteId]: next };
    });
  };

  const setAllScopeBacentas = (inviteId: string, selected: boolean) => {
    setScopeDrafts(prev => ({
      ...prev,
      [inviteId]: selected ? bacentas.map(bacenta => bacenta.id) : []
    }));
  };

  const handlePromoteToCampusAdmin = async (invite: AdminInvite) => {
    if (!userProfile) return;
    const assignedBacentaIds = getScopeDraft(invite);
    if (assignedBacentaIds.length === 0) {
      showToast('warning', 'Choose bacentas', 'Select at least one Bacenta for this migration promotion.');
      return;
    }

    try {
      await runInviteUpdate(invite.id, async () => {
        await inviteService.promoteInvitedLeaderToCampusAdmin(invite.id, userProfile, assignedBacentaIds);
      });
      showToast('success', `${invite.invitedUserName} migration promoted`);
    } catch (error: any) {
      console.error('Error promoting campus admin:', error);
      showToast('error', 'Failed to promote admin', error.message);
    }
  };

  const handleUpdateMigrationScope = async (invite: AdminInvite) => {
    if (!userProfile) return;
    const assignedBacentaIds = getScopeDraft(invite);
    if (assignedBacentaIds.length === 0) {
      showToast('warning', 'Choose bacentas', 'Select at least one Bacenta for this migration promotion.');
      return;
    }

    try {
      await runInviteUpdate(invite.id, async () => {
        await inviteService.updateMigrationPromotionBacentaAssignments(invite.id, userProfile, assignedBacentaIds);
      });
      showToast('success', `${invite.invitedUserName}'s Bacenta scope updated`);
    } catch (error: any) {
      console.error('Error updating migration scope:', error);
      showToast('error', 'Failed to update scope', error.message);
    }
  };

  const handleUnpromoteCampusAdmin = async (invite: AdminInvite) => {
    if (!userProfile) return;

    try {
      await runInviteUpdate(invite.id, async () => {
        await inviteService.unpromoteCampusAdminToLeader(invite.id, userProfile);
      });
      showToast('success', `${invite.invitedUserName} reverted to leader access`);
    } catch (error: any) {
      console.error('Error unpromoting campus admin:', error);
      showToast('error', 'Failed to unpromote admin', error.message);
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
    <div 
      className={`${isPageMode ? 'relative rounded-[28px] border border-white/70 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.55)]' : 'fixed z-50'} bg-gradient-to-br from-slate-50 via-indigo-50/70 to-slate-100/90 admin-invite-screen overflow-hidden`}
      style={isPageMode ? {
        height: 'calc(100dvh - var(--navbar-height, 64px) - 3rem)',
        minHeight: '620px'
      } : {
        top: 'calc(var(--navbar-height, 0px) + env(safe-area-inset-top, 0px))',
        left: 'env(safe-area-inset-left, 0px)',
        right: 'env(safe-area-inset-right, 0px)',
        bottom: 'env(safe-area-inset-bottom, 0px)',
        height: 'calc(100vh - var(--navbar-height, 0px) - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
        minHeight: 'calc(100dvh - var(--navbar-height, 0px) - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))'
      }}
    >
      {/* Premium glowing background blobs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300/25 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '2s' }} />

      {/* Redesigned Premium Glassmorphic Header */}
      <div className="bg-white/60 backdrop-blur-xl border-b border-slate-200/40 px-4 py-6 sticky top-0 z-30 shadow-[0_8px_32px_0_rgba(31,38,135,0.04)] relative">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Back button and title */}
          <div className="flex items-center gap-4 relative pr-12 md:pr-0">
            <button
              onClick={onClose}
              className="p-2.5 bg-white/95 hover:bg-slate-50 border border-slate-200/60 rounded-2xl shadow-xs text-slate-700 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer shrink-0"
              aria-label="Go back"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-800">
                Leadership Management
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium tracking-wide mt-0.5">
                Invite leaders and manage migration promotion
              </p>
            </div>
          </div>

          {/* Mode Badge Container */}
          <div className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border ${modeBadgeColor.border} ${modeBadgeColor.bg} backdrop-blur-md px-4 py-3 shadow-xs w-full md:max-w-xl transition-all duration-300`}>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${modeBadgeColor.dotPing} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${modeBadgeColor.dot}`}></span>
              </span>
              <span className={`text-xs font-black tracking-wider uppercase ${modeBadgeColor.text} whitespace-nowrap`}>
                {modeLabel}
              </span>
            </div>
            <div className={`hidden sm:block w-px h-4 ${isCampusShepherdMode ? 'bg-emerald-500/20' : isPromotedMode ? 'bg-purple-500/20' : 'bg-slate-500/20'}`} />
            <span className={`text-left text-xs font-semibold ${modeBadgeColor.desc} leading-relaxed`}>
              {modeDescription}
            </span>
          </div>

          {/* Floating Icon Decorator (Right column) */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/15 border border-white/20 hidden lg:flex">
            <UserGroupIcon className="w-5 h-5 text-white" />
          </div>

        </div>
      </div>

      {/* Tab Navigation Redesigned as dynamic slider pill */}
      <div className="bg-white/40 backdrop-blur-md border-b border-slate-200/20 py-4 flex justify-center sticky top-[89px] z-20">
        <div className="bg-slate-200/50 p-1.5 rounded-3xl inline-flex gap-1.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] border border-slate-200/40">
          <button
            onClick={() => setActiveTab('search')}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all duration-300 cursor-pointer ${
              activeTab === 'search'
                ? 'bg-slate-900 text-white shadow-[0_8px_20px_-6px_rgba(15,23,42,0.5)] hover:scale-[1.01]'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white/50'
            }`}
          >
            <SearchIcon className="w-4.5 h-4.5" />
            <span>Search Admin</span>
          </button>

          <button
            onClick={() => setActiveTab('invites')}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all duration-300 cursor-pointer ${
              activeTab === 'invites'
                ? 'bg-slate-900 text-white shadow-[0_8px_20px_-6px_rgba(15,23,42,0.5)] hover:scale-[1.01]'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white/50'
            }`}
          >
            <ClockIcon className="w-4.5 h-4.5" />
            <span>Sent Invites</span>
            {invites.length > 0 && (
              <span className={`ml-1 text-[11px] font-black px-2 py-0.5 rounded-full transition-all duration-300 ${
                activeTab === 'invites' ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'
              }`}>
                {invites.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="admin-invite-content">
        <div className="admin-invite-content-inner max-w-5xl mx-auto px-4 py-8 space-y-8">
          {activeTab === 'search' ? (
            <div className="max-w-2xl mx-auto space-y-6">
              
              {/* Sleek Glass Search Form Card */}
              <div className="bg-white/70 backdrop-blur-xl rounded-[32px] p-6 sm:p-8 shadow-[0_24px_55px_-30px_rgba(31,38,135,0.08)] border border-white/60 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-violet-500/10 rounded-full blur-xl pointer-events-none" />
                
                <div className="flex items-center space-x-4 mb-8">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <UserIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Find Administrator</h2>
                    <p className="text-slate-500 text-sm font-medium">Search by email address</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="relative group">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <EnvelopeIcon className="h-5.5 w-5.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-200" />
                    </span>
                    <input
                      type="email"
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      placeholder="Enter admin email address..."
                      onKeyPress={(e) => e.key === 'Enter' && handleSearchUser()}
                      className="w-full h-14 pl-12 pr-4 text-base border border-slate-200/80 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl bg-white/95 shadow-sm focus:shadow-md transition-all duration-300 focus:outline-none text-slate-900 placeholder-slate-400 font-semibold"
                    />
                  </div>

                  <Button
                    variant="primary"
                    onClick={handleSearchUser}
                    disabled={isSearching || !searchEmail.trim()}
                    className="w-full h-14 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 hover:from-indigo-950 hover:to-indigo-900 rounded-2xl font-bold text-base shadow-[0_12px_24px_-10px_rgba(15,23,42,0.3)] hover:shadow-[0_16px_32px_-8px_rgba(15,23,42,0.4)] transition-all duration-300 flex items-center justify-center border-none cursor-pointer"
                  >
                    {isSearching ? (
                      <div className="flex items-center justify-center space-x-3">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Searching...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2">
                        <SearchIcon className="w-5 h-5" />
                        <span>Search Admin</span>
                      </div>
                    )}
                  </Button>
                </div>
              </div>

              {/* Redesigned Search Results Pane */}
              {searchedUser && (
                <div className="bg-white/70 backdrop-blur-xl rounded-[32px] p-6 sm:p-8 shadow-[0_24px_55px_-30px_rgba(31,38,135,0.08)] border border-white/60 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center space-x-4 mb-8">
                    <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <CheckIcon className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Admin Found</h3>
                      <p className="text-slate-500 text-sm font-medium">Ready to send leadership invite</p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-emerald-50/50 to-teal-50/50 rounded-[28px] p-6 border border-emerald-500/10 relative overflow-hidden shadow-xs">
                    <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-md">
                        <UserIcon className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-extrabold text-slate-900 truncate leading-tight">{searchedUser.displayName}</h4>
                        <p className="text-slate-600 font-semibold mt-1 truncate flex items-center gap-1.5 text-sm">
                          <EnvelopeIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span>{searchedUser.email}</span>
                        </p>
                        <span className="inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-800 border border-emerald-500/20">
                          Administrator
                        </span>
                      </div>
                    </div>

                    <div className="mt-8 flex flex-col sm:flex-row gap-3">
                      <Button
                        variant="primary"
                        onClick={handleSendInvite}
                        disabled={isSendingInvite}
                        className="flex-1 h-13 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-2xl font-bold text-base shadow-lg shadow-emerald-500/20 hover:shadow-xl transition-all duration-300 flex items-center justify-center border-none cursor-pointer"
                      >
                        {isSendingInvite ? (
                          <div className="flex items-center justify-center space-x-2">
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span>Sending...</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center space-x-2">
                            <PlusIcon className="w-5 h-5 text-emerald-100" />
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
                        className="px-6 h-13 border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 rounded-2xl font-bold text-slate-700 transition-all duration-300 cursor-pointer"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Invites Tab Redesigned */
            <div className="max-w-4xl mx-auto space-y-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-24">
                  <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-650 rounded-full animate-spin mx-auto"></div>
                    <p className="text-slate-500 font-semibold tracking-wide">Loading invites...</p>
                  </div>
                </div>
              ) : invites.length === 0 ? (
                <div className="text-center py-20 bg-white/50 backdrop-blur-md rounded-[32px] border border-white/60 p-8">
                  <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200/80 rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-md shadow-slate-200/50">
                    <UserGroupIcon className="w-11 h-11 text-slate-400" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2">No Invites Sent</h3>
                  <p className="text-slate-500 mb-8 max-w-md mx-auto text-sm font-medium leading-relaxed">
                    You haven't sent any leadership invites yet. Use the search tab to find administrators and invite them to become leaders.
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => setActiveTab('search')}
                    className="h-12 px-8 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-750 rounded-2xl font-bold shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center border-none cursor-pointer mx-auto"
                  >
                    <div className="flex items-center space-x-2">
                      <SearchIcon className="w-4.5 h-4.5 text-white" />
                      <span>Search Admins</span>
                    </div>
                  </Button>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="bg-white/70 backdrop-blur-xl rounded-[30px] p-6 border border-white/60 shadow-xs">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Sent Leadership Invites</h2>
                    <p className="text-slate-500 text-sm font-medium mt-0.5">Track invites and assign migration promotion bacentas</p>
                  </div>

                  <div className="space-y-5">
                    {invites.map((invite) => {
                      const selectedScopeIds = getScopeDraft(invite);
                      const selectedScopeCount = selectedScopeIds.length;
                      const isScopeExpanded = expandedScopeInviteIds.has(invite.id);

                      return (
                        <div
                          key={invite.id}
                          className="bg-white/80 hover:bg-white backdrop-blur-lg rounded-[28px] p-5 sm:p-6 shadow-[0_12px_24px_-10px_rgba(15,23,42,0.06)] hover:shadow-[0_22px_45px_-20px_rgba(15,23,42,0.12)] border border-white/60 hover:border-slate-200/80 hover:-translate-y-0.5 transition-all duration-300 w-full relative group"
                        >
                          {/* Clean X button for rejected or revoked (removed) invites only - shows on hover */}
                          {(invite.status === 'rejected' || invite.status === 'revoked') && (
                            <button
                              onClick={() => handleDeleteInvite(invite)}
                              className="absolute top-4 right-4 w-7 h-7 bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-full flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
                              title="Delete entry"
                            >
                              <XMarkIcon className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                            </button>
                          )}

                          <div className="flex flex-col md:flex-row gap-5 items-start">
                            {/* Avatar with beautiful dynamic gradient based on status */}
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md shadow-slate-200/50 flex-shrink-0 ${
                              getStatusColor(invite.status, invite.expiresAt) === 'green'
                                ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
                                : getStatusColor(invite.status, invite.expiresAt) === 'red'
                                ? 'bg-gradient-to-br from-red-400 to-rose-500'
                                : getStatusColor(invite.status, invite.expiresAt) === 'gray'
                                ? 'bg-gradient-to-br from-slate-400 to-slate-500'
                                : 'bg-gradient-to-br from-blue-400 to-indigo-500'
                            }`}>
                              <UserIcon className="w-7 h-7 text-white" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 w-full">
                              {/* Header with name and status */}
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                                <div className="min-w-0">
                                  <h3 className="text-lg font-bold text-slate-900 truncate leading-tight">
                                    {invite.invitedUserName}
                                  </h3>
                                  <div className="flex items-center mt-1 text-slate-500 font-semibold">
                                    <EnvelopeIcon className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                                    <span className="text-xs truncate">{invite.invitedUserEmail}</span>
                                  </div>
                                </div>
                                
                                {/* Status Badge */}
                                <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                                  <span className={`inline-flex items-center justify-center px-3 py-1 text-xs font-bold rounded-full border ${
                                    getStatusColor(invite.status, invite.expiresAt) === 'green'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-500/10'
                                      : getStatusColor(invite.status, invite.expiresAt) === 'red'
                                      ? 'bg-red-50 text-red-700 border-red-500/10'
                                      : getStatusColor(invite.status, invite.expiresAt) === 'gray'
                                      ? 'bg-slate-50 text-slate-700 border-slate-500/10'
                                      : 'bg-blue-50 text-blue-700 border-blue-500/10'
                                  }`}>
                                    {getStatusText(invite.status, invite.expiresAt)}
                                  </span>
                                  {invite.promotedToCampusAdmin === true && (
                                    <span className="inline-flex items-center justify-center rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700 border border-purple-500/10">
                                      Migration Admin
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Dates */}
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-slate-400 mb-4 border-b border-slate-100/60 pb-3">
                                <div className="flex items-center">
                                  <ClockIcon className="w-3.5 h-3.5 mr-1 flex-shrink-0 text-slate-400" />
                                  <span>Sent: {formatDate(invite.createdAt)}</span>
                                </div>
                                {invite.respondedAt && (
                                  <div className="flex items-center text-emerald-600 font-bold">
                                    <CheckIcon className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                                    <span>Responded: {formatDate(invite.respondedAt)}</span>
                                  </div>
                                )}
                              </div>

                              {invite.status === 'accepted' && canPromoteInvitedAdmins && invite.handledAs !== 'cross-tenant-link' && (
                                <div className={`mb-4 overflow-hidden rounded-[24px] border transition-all duration-300 ${
                                  isScopeExpanded 
                                    ? 'border-purple-200 bg-gradient-to-b from-purple-500/5 to-indigo-500/5' 
                                    : 'border-purple-100 bg-white/50 hover:border-purple-200'
                                }`}>
                                  <button
                                    type="button"
                                    onClick={() => toggleScopePanel(invite.id)}
                                    aria-expanded={isScopeExpanded}
                                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors cursor-pointer"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-xs font-black uppercase tracking-wider text-purple-700">Migration Promotion</p>
                                      <p className="mt-0.5 text-xs text-purple-900/70 font-bold">
                                        {selectedScopeCount > 0
                                          ? `${selectedScopeCount} of ${bacentas.length} bacentas assigned`
                                          : 'No bacentas assigned yet'}
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                                        selectedScopeCount > 0 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                                      }`}>
                                        {selectedScopeCount}/{bacentas.length}
                                      </span>
                                      <span className="hidden text-xs font-bold text-purple-700 sm:inline">
                                        {isScopeExpanded ? 'Collapse' : 'Expand'}
                                      </span>
                                      <ChevronDownIcon className={`h-4.5 w-4.5 text-purple-700 transition-transform duration-300 ${isScopeExpanded ? 'rotate-180' : ''}`} />
                                    </div>
                                  </button>

                                  {isScopeExpanded && (
                                    <div className="border-t border-purple-100/50 px-4 pb-4 pt-4 bg-white/40">
                                      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                                        <p className="text-xs text-purple-900/70 font-semibold leading-relaxed">
                                          Assign bacentas this administrator will have scoped access to manage during the migration.
                                        </p>
                                        {bacentas.length > 0 && (
                                          <div className="flex gap-2 text-xs flex-shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => setAllScopeBacentas(invite.id, true)}
                                              className="rounded-xl border border-purple-200 bg-white hover:bg-purple-50 px-3 py-1.5 font-bold text-purple-700 transition-all duration-200 cursor-pointer"
                                            >
                                              Select All
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setAllScopeBacentas(invite.id, false)}
                                              className="rounded-xl border border-purple-200 bg-white hover:bg-purple-50 px-3 py-1.5 font-bold text-purple-700 transition-all duration-200 cursor-pointer"
                                            >
                                              Clear All
                                            </button>
                                          </div>
                                        )}
                                      </div>

                                      {bacentas.length === 0 ? (
                                        <p className="rounded-2xl border border-purple-100 bg-white px-4 py-3.5 text-xs font-semibold text-purple-900/75 shadow-xs">
                                          Create at least one Bacenta in the system before promoting this admin.
                                        </p>
                                      ) : (
                                        <div className="max-h-64 overflow-y-auto pr-1 smooth-scroll">
                                          <div className="grid gap-2.5 sm:grid-cols-2">
                                            {bacentas.map(bacenta => {
                                              const selected = selectedScopeIds.includes(bacenta.id);
                                              return (
                                                <label
                                                  key={bacenta.id}
                                                  className={`cursor-pointer relative overflow-hidden flex items-center gap-3 rounded-2xl border px-4 py-3 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 ${
                                                    selected
                                                      ? 'border-purple-200 bg-purple-500/10 text-purple-900 shadow-sm'
                                                      : 'border-slate-100 bg-white/80 hover:bg-white text-slate-700 hover:border-slate-200 hover:shadow-xs'
                                                  }`}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    checked={selected}
                                                    onChange={() => toggleScopeBacenta(invite.id, bacenta.id)}
                                                    className="h-4 w-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
                                                  />
                                                  <span className="min-w-0 flex-1 truncate leading-tight">{bacenta.name}</span>
                                                </label>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Action Buttons */}
                              <div className="flex flex-wrap justify-end gap-2.5">
                                {invite.status === 'pending' && !isExpired(invite.expiresAt) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCancelInvite(invite.id)}
                                    className="h-9 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-700 hover:text-red-800 border border-red-500/20 rounded-xl text-xs font-bold transition-all duration-200 flex items-center cursor-pointer"
                                  >
                                    <XMarkIcon className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                                    <span>Cancel Invite</span>
                                  </Button>
                                )}
                                
                                {invite.status === 'accepted' && canPromoteInvitedAdmins && invite.handledAs !== 'cross-tenant-link' && (
                                  invite.promotedToCampusAdmin === true ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleUnpromoteCampusAdmin(invite)}
                                      disabled={updatingInviteIds.has(invite.id)}
                                      className="h-9 px-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 hover:text-amber-800 border border-amber-500/20 rounded-xl text-xs font-bold transition-all duration-200 flex items-center disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                                    >
                                      <XMarkIcon className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                                      <span>{updatingInviteIds.has(invite.id) ? 'Updating...' : 'Unpromote'}</span>
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handlePromoteToCampusAdmin(invite)}
                                      disabled={updatingInviteIds.has(invite.id)}
                                      className="h-9 px-4 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 hover:text-purple-800 border border-purple-500/20 rounded-xl text-xs font-bold transition-all duration-200 flex items-center disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                                    >
                                      <CheckIcon className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                                      <span>{updatingInviteIds.has(invite.id) ? 'Updating...' : 'Promote with Scope'}</span>
                                    </Button>
                                  )
                                )}
                                
                                {invite.status === 'accepted' && canPromoteInvitedAdmins && invite.handledAs !== 'cross-tenant-link' && invite.promotedToCampusAdmin === true && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleUpdateMigrationScope(invite)}
                                    disabled={updatingInviteIds.has(invite.id)}
                                    className="h-9 px-4 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 hover:text-indigo-800 border border-indigo-500/20 rounded-xl text-xs font-bold transition-all duration-200 flex items-center disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                                  >
                                    <CheckIcon className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                                    <span>{updatingInviteIds.has(invite.id) ? 'Updating...' : 'Update Scope'}</span>
                                  </Button>
                                )}
                                
                                {invite.status === 'accepted' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveLeader(invite)}
                                    className="h-9 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-700 hover:text-red-800 border border-red-500/20 rounded-xl text-xs font-bold transition-all duration-200 flex items-center cursor-pointer"
                                  >
                                    <XMarkIcon className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                                    <span>Remove Leader</span>
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminInviteScreen;
