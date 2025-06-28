
import React, { useEffect, useState, memo } from 'react';
import { PerformanceMonitor } from './utils/performance';
import { FirebaseAppProvider, useAppContext } from './contexts/FirebaseAppContext';
import { AuthScreen } from './components/AuthScreen';
import Navbar from './components/Navbar';
import DashboardView from './components/DashboardView';
import {
  LazyWrapper,
  LazyMemberListView,
  LazyBacentasTableView,
  LazyCriticalMembersView,
  LazyAttendanceAnalyticsView,
  LazyNewBelieversView
} from './components/LazyWrapper';
import GestureWrapper from './components/GestureWrapper';
import BackButton from './components/BackButton';
import SwipeIndicator from './components/SwipeIndicator';
import { LoadingSpinnerIcon, RefreshIcon, PlusIcon as AddMemberIcon, CogIcon } from './components/icons'; // Renamed PlusIcon for clarity
import { ClipboardIcon } from 'lucide-react';
import { TabKeys } from './types';
import MemberFormModal from './components/MemberFormModal';
import BulkMemberAddModal from './components/BulkMemberAddModal';
import BacentaFormModal from './components/BacentaFormModal'; // Import BacentaFormModal
import BacentaDrawer from './components/BacentaDrawer'; // Import BacentaDrawer
import NewBelieverFormModal from './components/NewBelieverFormModal'; // Import NewBelieverFormModal
import DataManagement from './components/DataManagement';
import EnhancedProfileDropdown from './components/EnhancedProfileDropdown';
import { DeleteMemberModal, DeleteBacentaModal, DeleteNewBelieverModal, ClearAllDataModal, ClearSelectedDataModal } from './components/ConfirmationModal';

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
    closeBacentaDrawer,
    isNewBelieverFormOpen,
    editingNewBeliever,
    closeNewBelieverForm,
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
    removeToast
  } = useAppContext();

  // const { canNavigateBack } = useNavigation();
  const [isDataManagementOpen, setIsDataManagementOpen] = useState(false);
  const [isBulkMemberModalOpen, setIsBulkMemberModalOpen] = useState(false);

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
  }, []); // fetchInitialData itself will load current month's data

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
      case TabKeys.CRITICAL_MEMBERS:
        return (
          <LazyWrapper>
            <LazyCriticalMembersView />
          </LazyWrapper>
        );
      case TabKeys.ALL_CONGREGATIONS:
        return (
          <LazyWrapper>
            <LazyMemberListView bacentaFilter={null} />
          </LazyWrapper>
        );
      case TabKeys.ALL_BACENTAS:
        return (
          <LazyWrapper>
            <LazyBacentasTableView />
          </LazyWrapper>
        );
      case TabKeys.ATTENDANCE_ANALYTICS:
        return (
          <LazyWrapper>
            <LazyAttendanceAnalyticsView />
          </LazyWrapper>
        );
      case TabKeys.NEW_BELIEVERS:
        return (
          <LazyWrapper>
            <LazyNewBelieversView />
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
      {/* Animated background overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-white/50 via-gray-50/30 to-gray-100/20 pointer-events-none"></div>

      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-50/95 via-white/95 to-indigo-50/95 backdrop-blur-md border-b border-gray-200/50 shadow-xl">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3 md:py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
            {/* {canNavigateBack() && <BackButton />} */}
            <button
              onClick={() => switchTab({ id: 'dashboard', name: 'Dashboard' })}
              className="flex items-center space-x-2 sm:space-x-3 transition-all duration-300 group min-w-0"
              aria-label="Go to Dashboard"
              title="Go to Dashboard"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:from-blue-700 group-hover:to-indigo-800 transition-all duration-300 flex-shrink-0 ring-2 ring-blue-100">
                <span className="text-white font-bold text-sm sm:text-base md:text-lg">⛪</span>
              </div>
              <div className="min-w-0 hidden sm:block">
                <h1 className="text-base sm:text-lg md:text-xl font-bold gradient-text font-serif group-hover:text-gray-700 transition-colors duration-300 truncate">
                  {isBacentaTab ? currentTab.name : 'SAT Mobile'}
                </h1>
                <p className="text-xs text-gray-600 font-medium group-hover:text-gray-700 transition-colors duration-300 hidden md:block">
                  {isBacentaTab ? 'Bacenta Management' : 'Faith • Community • Growth'}
                </p>
              </div>
            </button>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            {/* Quick Actions - Hidden on mobile, shown on larger screens */}
            <div className="hidden lg:flex items-center space-x-1 mr-2">
              <button
                onClick={() => openMemberForm(null)}
                className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl glass hover:glass-dark transition-all duration-300 group shadow-lg relative overflow-hidden"
                aria-label="Add New Member"
                title="Add New Member"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/8 via-transparent to-blue-600/8 opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-lg sm:rounded-xl"></div>
                <AddMemberIcon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 group-hover:text-blue-100 transition-all duration-300 relative z-10" />
              </button>
              <button
                onClick={() => setIsBulkMemberModalOpen(true)}
                className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl glass hover:glass-dark transition-all duration-300 group shadow-lg relative overflow-hidden"
                aria-label="Paste Multiple Members"
                title="Paste Multiple Members"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/8 via-transparent to-green-600/8 opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-lg sm:rounded-xl"></div>
                <ClipboardIcon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 group-hover:text-green-100 transition-all duration-300 relative z-10" />
              </button>
              <button
                onClick={() => {
                  fetchInitialData();
                }}
                className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl glass hover:glass-dark transition-all duration-300 group shadow-lg"
                aria-label="Refresh Data"
                title="Refresh Data"
              >
                <RefreshIcon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 group-hover:text-white transition-all duration-300" />
              </button>
            </div>

            {/* Enhanced Profile Dropdown - Contains all actions and user info */}
            <EnhancedProfileDropdown
              user={user}
              onOpenBulkMemberModal={() => setIsBulkMemberModalOpen(true)}
              onOpenDataManagement={() => setIsDataManagementOpen(true)}
            />
          </div>
        </div>
        <Navbar />
      </header>

      {/* Scrollable Main Content */}
      <main className="flex-1 overflow-y-auto pt-24 sm:pt-28 md:pt-32 pb-4 sm:pb-6 relative z-10">
        <GestureWrapper className="h-full">
          <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-4 md:py-6">
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
          bacentaId={currentTab.id !== 'dashboard' && currentTab.id !== 'all_members' && currentTab.id !== 'all_bacentas' && currentTab.id !== 'critical_members' && currentTab.id !== 'attendance_analytics' && currentTab.id !== 'new_believers' ? currentTab.id : undefined}
          bacentaName={currentTab.id !== 'dashboard' && currentTab.id !== 'all_members' && currentTab.id !== 'all_bacentas' && currentTab.id !== 'critical_members' && currentTab.id !== 'attendance_analytics' && currentTab.id !== 'new_believers' ? currentTab.name : undefined}
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

      {/* Toast Notifications */}
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="fixed top-2 sm:top-4 right-2 sm:right-4 z-50 max-w-xs sm:max-w-sm w-full transform transition-all duration-300 ease-out translate-x-0 opacity-100 scale-100"
          onClick={() => removeToast(toast.id)}
        >
          <div className={`
            ${toast.type === 'success' ? 'bg-green-50 border-green-200' :
              toast.type === 'error' ? 'bg-red-50 border-red-200' :
              toast.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
              'bg-blue-50 border-blue-200'
            } border rounded-lg sm:rounded-xl shadow-lg backdrop-blur-sm p-3 sm:p-4 relative overflow-hidden cursor-pointer
          `}>
            <div className="flex items-start space-x-2 sm:space-x-3">
              <div className={`flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 ${
                toast.type === 'success' ? 'bg-green-100' :
                toast.type === 'error' ? 'bg-red-100' :
                toast.type === 'warning' ? 'bg-yellow-100' :
                'bg-blue-100'
              } rounded-full flex items-center justify-center`}>
                <span className={`text-xs sm:text-sm ${
                  toast.type === 'success' ? 'text-green-600' :
                  toast.type === 'error' ? 'text-red-600' :
                  toast.type === 'warning' ? 'text-yellow-600' :
                  'text-blue-600'
                }`}>
                  {toast.type === 'success' ? '✓' :
                   toast.type === 'error' ? '✗' :
                   toast.type === 'warning' ? '⚠' : 'ℹ'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`font-semibold text-xs sm:text-sm ${
                  toast.type === 'success' ? 'text-green-800' :
                  toast.type === 'error' ? 'text-red-800' :
                  toast.type === 'warning' ? 'text-yellow-800' :
                  'text-blue-800'
                }`}>
                  {toast.title}
                </h4>
                {toast.message && (
                  <p className={`mt-1 text-xs sm:text-sm ${
                    toast.type === 'success' ? 'text-green-700' :
                    toast.type === 'error' ? 'text-red-700' :
                    toast.type === 'warning' ? 'text-yellow-700' :
                    'text-blue-700'
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
    <FirebaseAppProvider>
      <AuthenticatedApp />
    </FirebaseAppProvider>
  );
};

export default App;
