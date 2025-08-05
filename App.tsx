
import React, { useEffect, useState, memo } from 'react';
import { PerformanceMonitor } from './utils/performance';
import { FirebaseAppProvider, useAppContext } from './contexts/FirebaseAppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthScreen } from './components/AuthScreen';

import DashboardView from './components/DashboardView';
import {
  LazyWrapper,
  LazyMemberListView,
  LazyBacentaLeadersView,

  LazyAttendanceAnalyticsView,
  LazyWeeklyAttendanceView,
  LazySundayConfirmationsView,
  LazyNewBelieversView,
  LazyMyDeletionRequestsView,
  LazyMemberDeletionRequestsView
} from './components/LazyWrapper';
import ProfileSettingsView from './components/ProfileSettingsView';
import GestureWrapper from './components/GestureWrapper';
import SwipeIndicator from './components/SwipeIndicator';
import {
  LoadingSpinnerIcon,
  Bars3Icon,
  ChartBarIcon,
  UsersIcon,
  GroupIcon,
  UserIcon
} from './components/icons';
import { TabKeys } from './types';
import { DEFAULT_CHURCH } from './constants';
import MemberFormModal from './components/MemberFormModal';
import BulkMemberAddModal from './components/BulkMemberAddModal';
import BacentaFormModal from './components/BacentaFormModal'; // Import BacentaFormModal
import BacentaDrawer from './components/BacentaDrawer'; // Import BacentaDrawer
import NewBelieverFormModal from './components/NewBelieverFormModal'; // Import NewBelieverFormModal
import HierarchyModal from './components/HierarchyModal';
import DataManagement from './components/DataManagement';
import EnhancedProfileDropdown from './components/EnhancedProfileDropdown';
import OfflineIndicator from './components/OfflineIndicator';
import PendingInviteNotification from './components/PendingInviteNotification';
import NotificationBadge from './components/NotificationBadge';
import DeletionRequestNotificationBadge from './components/DeletionRequestNotificationBadge';
import { DeleteMemberModal, DeleteBacentaModal, DeleteNewBelieverModal, ClearAllDataModal, ClearSelectedDataModal, CreateDeletionRequestModal } from './components/ConfirmationModal';
import WhatsNewModal from './components/WhatsNewModal';
import { useWhatsNew } from './hooks/useWhatsNew';

const AppContent: React.FC = memo(() => {
  const {
    currentTab,
    isLoading,
    error,
    fetchInitialData,
    isMemberFormOpen,
    editingMember,
    openMemberForm,
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
    newBelievers,
    confirmationModal,
    closeConfirmation,
    attendanceRecords,
    toasts,
    user,
    switchTab,
    showToast,
    removeToast,

  } = useAppContext();

  // const { canNavigateBack } = useNavigation();
  const [isDataManagementOpen, setIsDataManagementOpen] = useState(false);
  const [isBulkMemberModalOpen, setIsBulkMemberModalOpen] = useState(false);

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
      default:
        return (
          <LazyWrapper>
            <LazyMemberListView bacentaFilter={null} />
          </LazyWrapper>
        );
    }
  };

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">
      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Animated background overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-white/50 via-gray-50/30 to-gray-100/20 dark:from-dark-900/50 dark:via-dark-800/30 dark:to-dark-700/20 pointer-events-none"></div>

      {/* Fixed Header - Clean Single Line Design */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-50/95 via-white/95 to-indigo-50/95 dark:from-dark-800/95 dark:via-dark-900/95 dark:to-dark-800/95 backdrop-blur-md border-b border-gray-200/50 dark:border-dark-600/50 shadow-xl">
        <div className="container mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="relative flex items-center justify-between">

            {/* Left Section - Hamburger Menu and Logo */}
            <div className="flex items-center space-x-3 sm:space-x-4">
              {/* Hamburger Menu */}
              <button
                onClick={openBacentaDrawer}
                className="group flex items-center space-x-2 px-2 sm:px-3 py-2 text-gray-600 dark:text-dark-300 hover:text-gray-900 dark:hover:text-dark-100 transition-all duration-300 rounded-lg hover:bg-white/50 dark:hover:bg-dark-700/50"
                title="Open Navigation Menu"
                aria-label="Open Navigation Menu"
              >
                <div className="relative">
                  <Bars3Icon className="w-5 h-5 sm:w-6 sm:h-6 transition-colors duration-200" />
                </div>
                <span className="hidden sm:inline font-medium text-sm">Menu</span>
              </button>

              {/* Logo - Always visible */}
              <button
                onClick={() => switchTab({ id: 'dashboard', name: 'Dashboard' })}
                className="flex items-center space-x-2 sm:space-x-3 transition-all duration-300 group"
                aria-label="Go to Dashboard"
                title="Go to Dashboard"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-white dark:bg-dark-700 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 ring-2 ring-blue-100 dark:ring-dark-600 p-0.5">
                  <img src="/logo.png" alt={DEFAULT_CHURCH.NAME} className="w-full h-full object-contain" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-lg sm:text-xl font-bold gradient-text font-serif group-hover:text-gray-700 dark:group-hover:text-dark-200 transition-colors duration-300">
                    {isBacentaTab ? currentTab.name : 'SAT Mobile'}
                  </h1>
                  <p className="text-xs text-gray-600 dark:text-dark-300 font-medium group-hover:text-gray-700 dark:group-hover:text-dark-200 transition-colors duration-300">
                    {isBacentaTab ? 'Bacenta Management' : DEFAULT_CHURCH.NAME}
                  </p>
                </div>
              </button>
            </div>

            {/* Center Section - Current Tab Indicator (All Screens) */}
            <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center px-3 py-2 bg-white/20 dark:bg-dark-700/20 rounded-lg border border-white/30 dark:border-dark-600/30">
              <span className="text-gray-700 dark:text-dark-200 font-medium text-sm truncate max-w-[100px] sm:max-w-[150px]">
                {currentTab.name}
              </span>
            </div>

            {/* Right Section - Notifications and Profile */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Admin Notification Badge */}
              <NotificationBadge />
              
              {/* Deletion Request Notification Badge */}
              <DeletionRequestNotificationBadge />

              {/* Enhanced Profile Dropdown */}
              <EnhancedProfileDropdown
                user={user}
                onOpenBulkMemberModal={() => setIsBulkMemberModalOpen(true)}
                onOpenDataManagement={() => setIsDataManagementOpen(true)}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable Main Content */}
      <main className="flex-1 overflow-y-auto pt-16 sm:pt-18 pb-4 sm:pb-6 relative z-10">
        <GestureWrapper className="h-full">
          <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3 md:py-4 compact-layout">
            <div className="animate-fade-in">
              {renderView()}
            </div>
          </div>
        </GestureWrapper>
      </main>

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

      {isBacentaFormOpen && (
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
      <HierarchyModal
        isOpen={isHierarchyModalOpen}
        bacentaLeader={hierarchyBacentaLeader}
        onClose={closeHierarchyModal}
      />

      {/* Bacenta Drawer */}
      <BacentaDrawer
        isOpen={isBacentaDrawerOpen}
        onClose={closeBacentaDrawer}
      />

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

      {/* Pending Invite Notification */}
      <PendingInviteNotification />

      {/* What's New Modal */}
      <WhatsNewModal
        isOpen={isWhatsNewOpen}
        onClose={closeWhatsNew}
      />

      {/* Toast Notifications */}
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="fixed top-2 sm:top-4 right-2 sm:right-4 z-50 max-w-xs sm:max-w-sm w-full transform transition-all duration-300 ease-out translate-x-0 opacity-100 scale-100"
          onClick={() => removeToast(toast.id)}
        >
          <div className={`
            ${toast.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' :
              toast.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' :
              toast.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700' :
              'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
            } border rounded-lg sm:rounded-xl shadow-lg backdrop-blur-sm p-3 sm:p-4 relative overflow-hidden cursor-pointer
          `}>
            <div className="flex items-start space-x-2 sm:space-x-3">
              <div className={`flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 ${
                toast.type === 'success' ? 'bg-green-100 dark:bg-green-800' :
                toast.type === 'error' ? 'bg-red-100 dark:bg-red-800' :
                toast.type === 'warning' ? 'bg-yellow-100 dark:bg-yellow-800' :
                'bg-blue-100 dark:bg-blue-800'
              } rounded-full flex items-center justify-center`}>
                <span className={`text-xs sm:text-sm ${
                  toast.type === 'success' ? 'text-green-600 dark:text-green-200' :
                  toast.type === 'error' ? 'text-red-600 dark:text-red-200' :
                  toast.type === 'warning' ? 'text-yellow-600 dark:text-yellow-200' :
                  'text-blue-600 dark:text-blue-200'
                }`}>
                  {toast.type === 'success' ? '✓' :
                   toast.type === 'error' ? '✗' :
                   toast.type === 'warning' ? '⚠' : 'ℹ'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`font-semibold text-xs sm:text-sm ${
                  toast.type === 'success' ? 'text-green-800 dark:text-green-100' :
                  toast.type === 'error' ? 'text-red-800 dark:text-red-100' :
                  toast.type === 'warning' ? 'text-yellow-800 dark:text-yellow-100' :
                  'text-blue-800 dark:text-blue-100'
                }`}>
                  {toast.title}
                </h4>
                {toast.message && (
                  <p className={`mt-1 text-xs sm:text-sm ${
                    toast.type === 'success' ? 'text-green-700 dark:text-green-200' :
                    toast.type === 'error' ? 'text-red-700 dark:text-red-200' :
                    toast.type === 'warning' ? 'text-yellow-700 dark:text-yellow-200' :
                    'text-blue-700 dark:text-blue-200'
                  }`}>
                    {toast.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

// Wrapper component to access context for AuthScreen
const AuthenticatedApp: React.FC = () => {
  const { showToast } = useAppContext();

  return (
    <AuthScreen showToast={showToast}>
      <AppContent />
    </AuthScreen>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <FirebaseAppProvider>
        <AuthenticatedApp />
      </FirebaseAppProvider>
    </ThemeProvider>
  );
};

export default App;
