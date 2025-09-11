import React, { useEffect, useState, memo } from 'react';
import { PerformanceMonitor } from './utils/performance';
import { FirebaseAppProvider, useAppContext } from './contexts/FirebaseAppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthScreen } from './components/auth/AuthScreen';

import DashboardView from './components/views/DashboardView';
import LazyWrapper, { LazyMemberListView, LazyAttendanceAnalyticsView, LazyWeeklyAttendanceView, LazySundayConfirmationsView, LazyNewBelieversView, LazySonsOfGodView, LazyOutreachView, LazyBacentaOutreachView, LazyPrayerView, LazyPrayerMemberDetailsView, LazyMinistriesView, LazyBacentaLeadersView, LazyMyDeletionRequestsView, LazyMemberDeletionRequestsView, LazyBacentaMeetingsView, LazySundayHeadCountsView, LazySundayHeadCountSectionView, LazyContactView, LazyChatView } from './components/common/LazyWrapper';
import ProfileSettingsView from './components/views/ProfileSettingsView';
import CopyMembersView from './components/views/CopyMembersView';
import CopyAbsenteesView from './components/views/CopyAbsenteesView';
import BirthdaysView from './components/views/BirthdaysView';
import BidirectionalSyncTest from './components/debug/BidirectionalSyncTest';
import GestureWrapper from './components/layout/GestureWrapper';
import SwipeIndicator from './components/layout/SwipeIndicator';
import BackButton from './components/layout/BackButton';
import {
  LoadingSpinnerIcon,
  Bars3Icon
} from './components/icons';
import { TabKeys } from './types';
import { DEFAULT_CHURCH, getAppDisplayName } from './constants';
import { firebaseUtils } from './services/firebaseService';
import { hasAdminPrivileges } from './utils/permissionUtils';
import MemberFormModal from './components/modals/forms/MemberFormModal';
import BulkMemberAddModal from './components/members/BulkMemberAddModal';
import BacentaFormModal from './components/modals/forms/BacentaFormModal'; // Import BacentaFormModal
import BacentaDrawer from './components/bacentas/BacentaDrawer'; // Import BacentaDrawer
import MinistryDrawer from './components/ministry/MinistryDrawer'; // Import MinistryDrawer
import NewBelieverFormModal from './components/modals/forms/NewBelieverFormModal'; // Import NewBelieverFormModal
import HierarchyModal from './components/modals/general/HierarchyModal';
import DataManagement from './components/admin/DataManagement';
import EnhancedProfileDropdown from './components/layout/EnhancedProfileDropdown';
import OfflineIndicator from './components/common/OfflineIndicator';
import PendingInviteNotification from './components/notifications/PendingInviteNotification';
import NotificationBadge from './components/notifications/NotificationBadge';
import DeletionRequestNotificationBadge from './components/notifications/DeletionRequestNotificationBadge';
import ChatBadge from './components/notifications/ChatBadge';
import { DeleteMemberModal, DeleteBacentaModal, DeleteNewBelieverModal, ClearAllDataModal, ClearSelectedDataModal, CreateDeletionRequestModal, ClearAllNewBelieversModal } from './components/modals/confirmations/ConfirmationModal';
import WhatsNewModal from './components/modals/general/WhatsNewModal';
import { useWhatsNew } from './hooks/useWhatsNew';
import ErrorBoundary from './components/common/ErrorBoundary';

const AppContent: React.FC = memo(() => {
  const {
    currentTab,
    isLoading,
    error,
    fetchInitialData,
  showToast,
  isMinistryContext,
  activeMinistryName,
  isImpersonating,
  stopImpersonation,
  cleanupDuplicateMembers,
    isMemberFormOpen,
    editingMember,
    closeMemberForm,
    displayedSundays,
    isBacentaFormOpen,
    editingBacenta,
    closeBacentaForm,
    isBacentaDrawerOpen,
    openBacentaDrawer,
    closeBacentaDrawer,
    isNewBelieverFormOpen,
    editingNewBeliever,
    closeNewBelieverForm,
    isHierarchyModalOpen,
    hierarchyBacentaLeader,
    closeHierarchyModal,
    bacentas,
    members,
    confirmationModal,
    closeConfirmation,
    toasts,
    user,
  userProfile,
  currentChurchId,
    switchTab,
    removeToast,

  } = useAppContext();

  const [isDataManagementOpen, setIsDataManagementOpen] = useState(false);
  const [isBulkMemberModalOpen, setIsBulkMemberModalOpen] = useState(false);
  const [loadingStuckHint, setLoadingStuckHint] = useState<string | null>(null);

  // What's New modal state
  const { isOpen: isWhatsNewOpen, closeModal: closeWhatsNew } = useWhatsNew();

  // Check if current tab is a bacenta tab
  const isBacentaTab = bacentas.some(b => b.id === currentTab.id);

  // Simple confirmation modal close handler
  const closeConfirmationModal = () => {
    closeConfirmation();
  };

  useEffect(() => {
    PerformanceMonitor.start('app-initialization');
    fetchInitialData().finally(() => {
      PerformanceMonitor.end('app-initialization');

      // Log performance in development
      if (process.env.NODE_ENV === 'development') {
        setTimeout(() => {
          console.log('⚡ Performance Report:', PerformanceMonitor.getReport());
        }, 1000);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle deep links like #/chat/{threadId}
  useEffect(() => {
    const handleHash = () => {
      try {
        const hash = window.location.hash || '';
        const m = hash.match(/#\/?chat\/(.+)$/);
        if (m && m[1]) {
          switchTab({ id: TabKeys.CHAT, name: 'Chat', data: { threadId: m[1] } });
        }
      } catch { /* ignore */ }
    };
    window.addEventListener('hashchange', handleHash);
    handleHash();
    return () => window.removeEventListener('hashchange', handleHash);
  }, [switchTab]);


  // Ensure main content clears the fixed header (and impersonation banner) height
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const getHeader = () => document.querySelector('header.desktop-nav') as HTMLElement | null;

    const updateNavbarHeight = () => {
      const headerEl = getHeader();
      if (!headerEl) return;
      const h = Math.ceil(headerEl.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--navbar-height', `${h}px`);
    };

    // Initial and delayed measurements to catch layout shifts
    updateNavbarHeight();
    const t = setTimeout(updateNavbarHeight, 100);

    // React to header size changes
    const headerEl = getHeader();
    const ro = (window as any).ResizeObserver ? new ResizeObserver(updateNavbarHeight) : null;
    if (headerEl && ro) ro.observe(headerEl);
    window.addEventListener('resize', updateNavbarHeight);
    window.addEventListener('orientationchange', updateNavbarHeight);

    return () => {
      clearTimeout(t);
      if (headerEl && ro) ro.unobserve(headerEl);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateNavbarHeight);
      window.removeEventListener('orientationchange', updateNavbarHeight);
    };
  }, [isImpersonating]);

  // Watchdog: if loading persists beyond 5 seconds, show restart hint once
  useEffect(() => {
    let timer: any;
    if (isLoading) {
      timer = setTimeout(() => {
        setLoadingStuckHint('Sync is taking longer than expected. If this message persists, please restart the app.');
  try { showToast('warning', 'Slow sync detected', 'If this persists, please restart the app.'); } catch {}
      }, 5000);
    } else {
      setLoadingStuckHint(null);
    }
    return () => timer && clearTimeout(timer);
  }, [isLoading]);

  // Gate admin UI briefly to avoid initial flicker; proceed once profile is ready (or timed bypass)
  const [gateBypass, setGateBypass] = useState(false);
  const gateReady = user ? (Boolean(userProfile) || gateBypass) : true;

  // IMPORTANT: Don't flip the bypass back off once it's enabled, or the UI will flicker/loop.
  // Only set the bypass after a short delay when we have a user but no profile yet.
  useEffect(() => {
    if (!user) {
      // Reset bypass on sign-out only
      setGateBypass(false);
      return;
    }
    if (user && !userProfile && !gateBypass) {
      const timeout = setTimeout(() => setGateBypass(true), 2200);
      return () => clearTimeout(timeout);
    }
  }, [user, userProfile, gateBypass]);

  // Optional: warn in console if gating takes unusually long
  React.useEffect(() => {
    if (user && !gateReady) {
      const t = setTimeout(() => {
        if (!gateReady) {
          console.warn('[Gate] Still waiting for profile/context', {
            hasUser: !!user,
            hasProfile: !!userProfile,
            utilsCtx: firebaseUtils.getCurrentChurchId()
          });
        }
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [user, userProfile, gateReady]);

  // If gating persists, show an inline hint with actions
  const [gateSlow, setGateSlow] = useState(false);
  useEffect(() => {
    let timer: any;
    if (user && !gateReady) {
      timer = setTimeout(() => setGateSlow(true), 6000);
    } else {
      setGateSlow(false);
    }
    return () => timer && clearTimeout(timer);
  }, [user, gateReady]);
  if (!gateReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="glass rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col items-center space-y-3">
            <LoadingSpinnerIcon className="w-6 h-6 animate-spin text-indigo-600" />
            <div className="text-center">
              <p className="text-sm font-semibold gradient-text">Syncing permissions…</p>
              <p className="text-xs text-gray-600 mt-1">Preparing your admin dashboard</p>
              {gateSlow && (
                <div className="mt-3 text-xs text-gray-600 space-y-2">
                  <p>This is taking longer than expected. You can try these options:</p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => {
                        try { showToast('info', 'Reloading', 'Refreshing the app…'); } catch {}
                        // Force a full reload to re-init Firebase and listeners
                        window.location.reload();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700"
                    >
                      Reload app
                    </button>
                    <button
                      onClick={() => {
                        try { showToast('warning', 'Continuing without full profile'); } catch {}
                        setGateBypass(true); // Allow UI to proceed
                      }}
                      className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-800 text-xs hover:bg-gray-200"
                    >
                      Continue anyway
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500">If issues persist after reload, please restart the app.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

 // fetchInitialData itself will load current month's data

  const renderView = () => {
    // Initial loading state check
    if (isLoading && !displayedSundays.length && !bacentas.length && !members.length) {
      return (
        <div className="flex flex-col items-center justify-center h-screen animate-fade-in">
          <div className="glass rounded-3xl p-8 shadow-2xl">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <LoadingSpinnerIcon className="w-16 h-16 text-gray-500" />
                <div className="absolute inset-0 w-16 h-16 border-4 border-gray-200 rounded-full"></div>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold gradient-text">Loading Church Data...</p>
                <p className="text-sm text-gray-600 mt-1">Preparing your spiritual dashboard</p>
              </div>
            </div>
          </div>
        </div>
      );
    }
    if (error) {
      return (
        <div className="glass border-l-4 border-red-500 p-6 rounded-xl shadow-lg animate-scale-in">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-500 text-xl">⚠️</span>
            </div>
            <div>
              <h3 className="font-semibold text-red-800">Something went wrong</h3>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        </div>
      );
    }

  if (isBacentaTab) {
      return (
        <LazyWrapper>
          <LazyMemberListView bacentaFilter={currentTab.id} />
        </LazyWrapper>
      );
    }

    switch (currentTab.id) {
      case TabKeys.DASHBOARD:
        return <DashboardView />;

      case TabKeys.ALL_CONGREGATIONS:
        return (
          <LazyWrapper>
            <LazyMemberListView bacentaFilter={null} />
          </LazyWrapper>
        );
      case TabKeys.ALL_BACENTAS:
        return (
          <LazyWrapper>
            {/* Changed to BacentaLeadersView: 'All Bacenta Leaders' tab should list leaders (with hierarchy linking) not buildings */}
            <LazyBacentaLeadersView />
          </LazyWrapper>
        );
      case TabKeys.ATTENDANCE_ANALYTICS:
        return (
          <LazyWrapper>
            <LazyAttendanceAnalyticsView />
          </LazyWrapper>
        );
      case TabKeys.WEEKLY_ATTENDANCE:
        return (
          <LazyWrapper>
            <LazyWeeklyAttendanceView />
          </LazyWrapper>
        );
      case TabKeys.SUNDAY_HEAD_COUNTS:
        return (
          <LazyWrapper>
            <LazySundayHeadCountsView />
          </LazyWrapper>
        );
      case TabKeys.SUNDAY_HEAD_COUNT_SECTION:
        return (
          <LazyWrapper>
            <LazySundayHeadCountSectionView />
          </LazyWrapper>
        );
      case TabKeys.SUNDAY_CONFIRMATIONS:
        return (
          <LazyWrapper>
            <LazySundayConfirmationsView />
          </LazyWrapper>
        );
      case TabKeys.NEW_BELIEVERS:
        return (
          <LazyWrapper>
            <LazyNewBelieversView />
          </LazyWrapper>
        );
      case TabKeys.SONS_OF_GOD:
        return (
          <LazyWrapper>
            <LazySonsOfGodView />
          </LazyWrapper>
        );
      case TabKeys.OUTREACH:
        return (
          <LazyWrapper>
            <LazyOutreachView />
          </LazyWrapper>
        );
      case TabKeys.PRAYER:
        return (
          <LazyWrapper>
            <LazyPrayerView />
          </LazyWrapper>
        );
      case TabKeys.PRAYER_MEMBER_DETAILS:
        return (
          <LazyWrapper>
            <LazyPrayerMemberDetailsView />
          </LazyWrapper>
        );

      case TabKeys.BACENTA_MEETINGS:
        return (
          <LazyWrapper>
            <LazyBacentaMeetingsView />
          </LazyWrapper>
        );

      case TabKeys.BACENTA_OUTREACH:
        return (
          <LazyWrapper>
            <LazyBacentaOutreachView bacentaId={(currentTab as any)?.data?.bacentaId || ''} />
          </LazyWrapper>
        );
      case TabKeys.BIRTHDAYS:
        return <BirthdaysView />;
      case TabKeys.PROFILE_SETTINGS:
        return <ProfileSettingsView />;
      case TabKeys.MY_DELETION_REQUESTS:
        return (
          <LazyWrapper>
            <LazyMyDeletionRequestsView />
          </LazyWrapper>
        );
      case TabKeys.ADMIN_DELETION_REQUESTS:
        return (
          <LazyWrapper>
            <LazyMemberDeletionRequestsView />
          </LazyWrapper>
        );
      case TabKeys.COPY_MEMBERS:
        return <CopyMembersView />;
      case TabKeys.COPY_ABSENTEES:
        return <CopyAbsenteesView />;
      case TabKeys.MINISTRIES:
        return (
          <LazyWrapper>
            <LazyMinistriesView />
          </LazyWrapper>
        );
      case TabKeys.BIDIRECTIONAL_SYNC_TEST:
        return (
          <LazyWrapper>
            <BidirectionalSyncTest />
          </LazyWrapper>
        );
      case TabKeys.CONTACT:
        return (
          <LazyWrapper>
            <LazyContactView
              initialEmail={(currentTab as any)?.data?.initialEmail}
              initialMessage={(currentTab as any)?.data?.initialMessage}
              supportPrompted={(currentTab as any)?.data?.supportPrompted}
              contextMeta={(currentTab as any)?.data?.contextMeta}
              onClose={() => {
                // Navigate back to dashboard when closing contact form
                switchTab({ id: TabKeys.DASHBOARD, name: 'Dashboard' });
              }}
            />
          </LazyWrapper>
        );
      case TabKeys.CHAT:
        return (
          <LazyWrapper>
            <LazyChatView />
          </LazyWrapper>
        );

      default:
        return (
          <LazyWrapper>
            <LazyMemberListView bacentaFilter={null} />
          </LazyWrapper>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Animated background overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-white/50 via-gray-50/30 to-gray-100/20 dark:from-dark-900/50 dark:via-dark-800/30 dark:to-dark-700/20 pointer-events-none"></div>

      {/* Fixed Header - Clean Single Line Design with Desktop Enhancements */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-50/95 via-white/95 to-indigo-50/95 dark:from-dark-800/95 dark:via-dark-900/95 dark:to-dark-800/95 backdrop-blur-md desktop:backdrop-blur-lg border-b border-gray-200/50 dark:border-dark-600/50 shadow-xl desktop:shadow-lg desktop-nav">
        {isImpersonating && (
          <div className="w-full text-center text-[11px] sm:text-xs font-semibold tracking-wide py-1 bg-amber-500/90 text-white flex items-center justify-center gap-3">
            <span>IMPERSONATION MODE</span>
            <button
              onClick={stopImpersonation}
              className="px-2 py-0.5 rounded-md bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold"
            >Exit</button>
            <button
              onClick={async () => { try { await cleanupDuplicateMembers(); } catch {} }}
              className="px-2 py-0.5 rounded-md bg-red-500/80 hover:bg-red-600 text-white text-[10px] font-bold"
              title="Delete duplicated members (keeps oldest)"
            >Delete Duplicates</button>
          </div>
        )}
        <div className="container mx-auto px-2 xs:px-3 sm:px-6 desktop:px-8 desktop-lg:px-12 py-2 xs:py-3 sm:py-4 desktop:py-4 desktop-lg:py-5">
          <div className="relative flex items-center justify-between">

            {/* Left Section - Hamburger Menu and Logo */}
            <div className="flex items-center space-x-1 xs:space-x-2 sm:space-x-4 desktop:space-x-6 flex-shrink-0">
              {/* Hamburger Menu (shown in all contexts; drawer adapts to context) */}
              <button
                onClick={openBacentaDrawer}
                className="group flex items-center space-x-1 xs:space-x-2 px-1 xs:px-2 sm:px-3 desktop:px-4 py-1.5 xs:py-2 desktop:py-3 text-gray-600 dark:text-dark-300 hover:text-gray-900 dark:hover:text-dark-100 transition-all duration-300 rounded-lg desktop:rounded-xl hover:bg-white/50 dark:hover:bg-dark-700/50 desktop:hover:bg-white/70"
                title="Open Navigation Menu"
                aria-label="Open Navigation Menu"
              >
                <div className="relative">
                  <Bars3Icon className="w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6 desktop:w-6 desktop:h-6 transition-colors duration-200" />
                </div>
                <span className="hidden sm:inline desktop:inline font-medium text-sm desktop:text-base">Menu</span>
              </button>

              {/* Contextual Back Button */}
              <BackButton className="ml-1 xs:ml-2" />

              {/* Logo - Always visible */}
              <button
                onClick={() => switchTab({ id: 'dashboard', name: 'Dashboard' })}
                className="flex items-center space-x-1 xs:space-x-2 sm:space-x-3 desktop:space-x-4 transition-all duration-300 group"
                aria-label="Go to Dashboard"
                title="Go to Dashboard"
              >
                <div className="w-6 h-6 xs:w-8 xs:h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 desktop:w-12 desktop:h-12 desktop-lg:w-14 desktop-lg:h-14 bg-white dark:bg-dark-700 rounded-lg sm:rounded-xl desktop:rounded-xl desktop-lg:rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl desktop:group-hover:shadow-2xl transition-all duration-300 ring-2 ring-blue-100 dark:ring-dark-600 p-0.5">
                  <img src="/logo.png" alt={DEFAULT_CHURCH.NAME} className="w-full h-full object-contain" />
                </div>
                <div className="hidden sm:block desktop:block">
                  <h1 className="text-lg sm:text-xl desktop:text-xl desktop-lg:text-2xl font-bold gradient-text font-serif group-hover:text-gray-700 dark:group-hover:text-dark-200 transition-colors duration-300">
                    {isMinistryContext
                      ? (activeMinistryName || 'Ministry Mode')
                      : (isBacentaTab ? currentTab.name : (userProfile?.churchName || getAppDisplayName('SAT Mobile')))}
                  </h1>
                  <p className="text-xs desktop:text-sm text-gray-600 dark:text-dark-300 font-medium group-hover:text-gray-700 dark:group-hover:text-dark-200 transition-colors duration-300">
                    {isMinistryContext
                      ? 'Ministry Dashboard'
                      : (isBacentaTab ? 'Bacenta Management' : DEFAULT_CHURCH.NAME)}
                  </p>
                </div>
              </button>
            </div>

            {/* Center Section - Current Tab Indicator (Hidden on very small screens) */}
      <div className="hidden xs:flex absolute left-1/2 transform -translate-x-1/2 items-center px-2 xs:px-3 py-1.5 xs:py-2 desktop:px-4 desktop:py-3 bg-white/40 dark:bg-dark-700/60 desktop:bg-white/60 desktop:dark:bg-dark-700/80 rounded-lg desktop:rounded-xl border border-gray-300/50 dark:border-dark-500/50 desktop:border-gray-300/70 shadow-sm desktop:shadow-md">
              <span className="text-gray-800 dark:text-dark-100 font-medium text-xs xs:text-sm desktop:text-base truncate max-w-[60px] xs:max-w-[80px] sm:max-w-[120px] md:max-w-[150px] desktop:max-w-[200px] desktop-lg:max-w-[250px]">
        {isMinistryContext ? 'Ministry Mode' : currentTab.name}
              </span>
            </div>

            {/* Right Section - Notifications and Profile */}
            <div className="flex items-center space-x-1 xs:space-x-2 sm:space-x-3 desktop:space-x-4 flex-shrink-0">
              {/* Debug chip (enable with ?debug=1) */}
              {typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug') && (
                <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-md bg-yellow-100 text-yellow-800 border border-yellow-300 text-[10px] font-semibold">
                  <span>
                    AdminGate: role={(userProfile?.role || 'unknown') as any} | isAdmin={String(hasAdminPrivileges(userProfile))} | ctx={currentChurchId || 'null'} | utilsCtx={firebaseUtils.getCurrentChurchId() || 'null'} | ministry={String(isMinistryContext)}
                  </span>
                  <button
                    className="px-1.5 py-0.5 rounded bg-yellow-200 hover:bg-yellow-300"
                    onClick={() => {
                      try {
                        console.log('[DebugGate] State', {
                          user,
                          userProfile,
                          role: userProfile?.role,
                          contexts: userProfile?.contexts,
                          currentChurchId,
                          utilsChurchId: firebaseUtils.getCurrentChurchId(),
                          isMinistryContext
                        });
                        showToast('info', 'Debug', 'Logged gate state to console');
                      } catch {}
                    }}
                  >Log</button>
                  <button
                    className="px-1.5 py-0.5 rounded bg-yellow-200 hover:bg-yellow-300"
                    onClick={() => {
                      try {
                        if (userProfile?.churchId) {
                          firebaseUtils.setChurchContext(userProfile.churchId);
                          console.log('[DebugGate] Forced context to', userProfile.churchId);
                          showToast('info', 'Context', "Forced context. If UI doesn't update, refresh.");
                        }
                      } catch {}
                    }}
                  >Fix Ctx</button>
                </div>
              )}
              {isImpersonating && (
                <button
                  onClick={async () => {
                    const churchId = firebaseUtils.getCurrentChurchId();
                    if (!churchId) return;
                    const data = await firebaseUtils.debugFetchChurchCollections(churchId);
                    console.log('[Impersonation Debug]', data);
                    showToast('info', 'Debug', 'Fetched debug data. Check console for details.');
                  }}
                  className="hidden sm:inline px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow"
                >Force Debug Fetch</button>
              )}
              {/* Admin Notification Badge */}
              <div className="flex-shrink-0">
                <NotificationBadge />
              </div>

              {/* Deletion Request Notification Badge */}
              <div className="flex-shrink-0">
                <DeletionRequestNotificationBadge />
              </div>


              {/* Chat Unread Badge */}
              <div className="flex-shrink-0">
                <ChatBadge />
              </div>

              {/* Enhanced Profile Dropdown */}
              <div className="flex-shrink-0">
                <EnhancedProfileDropdown
                  user={user}
                  onOpenBulkMemberModal={() => setIsBulkMemberModalOpen(true)}
                  onOpenDataManagement={() => setIsDataManagementOpen(true)}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable Main Content */}
      <main
        className="flex-1 pb-4 sm:pb-6 desktop:pb-8 relative z-10"
        style={{
          // Pad top by the actual measured header height (includes impersonation banner)
          paddingTop: 'calc(var(--navbar-height, 64px) + 8px)',
          minHeight: 'calc(100vh - 3rem)',
        }}
      >
        <GestureWrapper>
          <div className="container mx-auto px-2 sm:px-4 desktop:px-8 desktop-lg:px-12 py-2 sm:py-3 md:py-4 desktop:py-6 desktop-lg:py-8 compact-layout desktop:desktop-dense-layout">
            <div className="animate-fade-in">
              {renderView()}
            </div>
          </div>
        </GestureWrapper>
      </main>

      {/* Restart Hint Banner */}
      {loadingStuckHint && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[90%]">
          <div className="bg-amber-600 text-white px-4 py-3 rounded-xl shadow-xl border border-amber-500">
            <div className="flex items-start gap-3">
              <span className="text-lg">⚠️</span>
              <div className="flex-1">
                <div className="font-semibold">Sync taking longer than expected</div>
                <div className="text-sm opacity-90">{loadingStuckHint}</div>
              </div>
              <button
                className="ml-2 bg-white/20 hover:bg-white/30 rounded-full w-7 h-7 flex items-center justify-center"
                onClick={() => setLoadingStuckHint(null)}
                aria-label="Dismiss"
                title="Dismiss"
              >×</button>
            </div>
          </div>
        </div>
      )}

      {/* Swipe Indicator */}
      <SwipeIndicator />

  {isMemberFormOpen && (
        <MemberFormModal
          isOpen={isMemberFormOpen}
          onClose={closeMemberForm}
          member={editingMember}
        />
      )}

      {isBulkMemberModalOpen && (
        <BulkMemberAddModal
          isOpen={isBulkMemberModalOpen}
          onClose={() => setIsBulkMemberModalOpen(false)}
          bacentaId={currentTab.id !== 'dashboard' && currentTab.id !== 'all_members' && currentTab.id !== 'all_bacentas' && currentTab.id !== 'attendance_analytics' && currentTab.id !== 'new_believers' ? currentTab.id : undefined}
          bacentaName={currentTab.id !== 'dashboard' && currentTab.id !== 'all_members' && currentTab.id !== 'all_bacentas' && currentTab.id !== 'attendance_analytics' && currentTab.id !== 'new_believers' ? currentTab.name : undefined}
        />
      )}

  {!isMinistryContext && isBacentaFormOpen && (
        <BacentaFormModal
          isOpen={isBacentaFormOpen}
          onClose={closeBacentaForm}
          bacenta={editingBacenta}
        />
      )}

      {isNewBelieverFormOpen && (
        <NewBelieverFormModal
          isOpen={isNewBelieverFormOpen}
          onClose={closeNewBelieverForm}
          newBeliever={editingNewBeliever}
        />
      )}

      {/* Hierarchy Modal */}
  {!isMinistryContext && (
  <HierarchyModal
        isOpen={isHierarchyModalOpen}
        bacentaLeader={hierarchyBacentaLeader}
        onClose={closeHierarchyModal}
  />)}

      {/* Navigation Drawer (context-aware) */}
      {isMinistryContext ? (
        <MinistryDrawer
          isOpen={isBacentaDrawerOpen}
          onClose={closeBacentaDrawer}
        />
      ) : (
        <BacentaDrawer
          isOpen={isBacentaDrawerOpen}
          onClose={closeBacentaDrawer}
        />
      )}

      {/* Data Management Modal */}
      <DataManagement
        isOpen={isDataManagementOpen}
        onClose={() => setIsDataManagementOpen(false)}
      />

      {/* Confirmation Modals */}
      {confirmationModal.type === 'deleteMember' && (
        <DeleteMemberModal
          isOpen={confirmationModal.isOpen}
          onClose={closeConfirmationModal}
          onConfirm={confirmationModal.onConfirm}
          memberName={confirmationModal.data?.member?.name || 'Unknown Member'}
        />
      )}

      {confirmationModal.type === 'deleteBacenta' && (
        <DeleteBacentaModal
          isOpen={confirmationModal.isOpen}
          onClose={closeConfirmationModal}
          onConfirm={confirmationModal.onConfirm}
          bacentaName={confirmationModal.data?.bacenta?.name || 'Unknown Bacenta'}
          memberCount={confirmationModal.data?.memberCount || 0}
        />
      )}

      {confirmationModal.type === 'deleteNewBeliever' && (
        <DeleteNewBelieverModal
          isOpen={confirmationModal.isOpen}
          onClose={closeConfirmationModal}
          onConfirm={confirmationModal.onConfirm}
          newBelieverName={confirmationModal.data?.name || 'Unknown New Believer'}
        />
      )}

      {confirmationModal.type === 'clearData' && (
        <ClearAllDataModal
          isOpen={confirmationModal.isOpen}
          onClose={closeConfirmationModal}
          onConfirm={confirmationModal.onConfirm}
          totalMembers={confirmationModal.data?.totalMembers || 0}
          totalBacentas={confirmationModal.data?.totalBacentas || 0}
          totalAttendance={confirmationModal.data?.totalAttendance || 0}
        />
      )}

      {confirmationModal.type === 'clearSelectedData' && (
        <ClearSelectedDataModal
          isOpen={confirmationModal.isOpen}
          onClose={closeConfirmationModal}
          onConfirm={confirmationModal.onConfirm}
          selectedBacentaNames={confirmationModal.data?.selectedBacentaNames || []}
          totalMembers={confirmationModal.data?.totalMembers || 0}
          totalAttendance={confirmationModal.data?.totalAttendance || 0}
          totalNewBelievers={confirmationModal.data?.totalNewBelievers || 0}
          includeUnassigned={confirmationModal.data?.includeUnassigned || false}
        />
      )}

      {confirmationModal.type === 'createDeletionRequest' && (
        <CreateDeletionRequestModal
          isOpen={confirmationModal.isOpen}
          onClose={closeConfirmationModal}
          onConfirm={confirmationModal.onConfirm}
          memberName={`${confirmationModal.data?.member?.firstName || ''} ${confirmationModal.data?.member?.lastName || ''}`.trim() || 'Unknown Member'}
        />
      )}

      {confirmationModal.type === 'clearAllNewBelievers' && (
        <ClearAllNewBelieversModal
          isOpen={confirmationModal.isOpen}
          onClose={closeConfirmationModal}
          onConfirm={confirmationModal.onConfirm}
          totalNewBelievers={confirmationModal.data?.totalNewBelievers || 0}
        />
      )}

      {/* Pending Invite Notification */}
      <PendingInviteNotification />

      {/* What's New Modal */}
      <WhatsNewModal
        isOpen={isWhatsNewOpen}
        onClose={closeWhatsNew}
      />

      {/* Toast Notifications - Centered at Top */}
    {toasts.map((toast) => (
        <div
          key={toast.id}
      className="toast-container fixed left-1/2 transform -translate-x-1/2 z-50 max-w-xs sm:max-w-sm w-full px-4"
          onClick={() => removeToast(toast.id)}
      style={{ top: 'calc(var(--navbar-height, 64px) + 0.5rem)' }}
        >
          <div className={`
            ${toast.type === 'success' ? 'bg-green-600 border-green-500' :
              toast.type === 'error' ? 'bg-red-600 border-red-500' :
              toast.type === 'warning' ? 'bg-yellow-600 border-yellow-500' :
              'bg-blue-600 border-blue-500'
            } border rounded-xl shadow-xl backdrop-blur-sm p-4 relative overflow-hidden cursor-pointer text-white
          `}>
            {/* Subtle gradient overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none"></div>

            <div className="relative flex items-start space-x-3">
              <div className={`flex-shrink-0 w-8 h-8 ${
                toast.type === 'success' ? 'bg-green-500' :
                toast.type === 'error' ? 'bg-red-500' :
                toast.type === 'warning' ? 'bg-yellow-500' :
                'bg-blue-500'
              } rounded-full flex items-center justify-center shadow-sm`}>
                <span className="text-white text-sm font-medium">
                  {toast.type === 'success' ? '✓' :
                   toast.type === 'error' ? '✗' :
                   toast.type === 'warning' ? '⚠' : 'ℹ'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-white leading-tight">
                  {toast.title}
                </h4>
                {toast.message && (
                  <p className="mt-1 text-sm text-white/90 leading-tight">
                    {toast.message}
                  </p>
                )}
              </div>

              {/* Close button */}
              <button
                className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  removeToast(toast.id);
                }}
              >
                <span className="text-white text-xs">×</span>
              </button>
            </div>

            {/* Progress bar for auto-dismiss */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
              <div
                className="h-full bg-white/40 animate-toast-progress"
                style={{ animationDuration: '5s' }}
              ></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

// Wrapper component to access context for AuthScreen
const AuthenticatedApp: React.FC = () => {
  const { showToast, currentTab, userProfile } = useAppContext();

  return (
    <AuthScreen showToast={showToast}>
      {/* Local ErrorBoundary allows recovering from transient view errors without reloading the whole shell */}
      <ErrorBoundary resetKey={`${currentTab.id}-${userProfile?.uid || 'nouser'}`}>
        <AppContent />
      </ErrorBoundary>
    </AuthScreen>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <FirebaseAppProvider>
        <ErrorBoundary>
          <AuthenticatedApp />
        </ErrorBoundary>
      </FirebaseAppProvider>
    </ThemeProvider>
  );
};

export default App;
