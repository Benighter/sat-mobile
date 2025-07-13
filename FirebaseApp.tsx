// Firebase-enabled App Component
import React, { useState, memo } from 'react';
import { FirebaseAppProvider, useAppContext } from './contexts/FirebaseAppContext';
import { AuthWrapper } from './components/AuthWrapper';
import { DataMigrationModal } from './components/DataMigrationModal';
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
import ProfileSettingsView from './components/ProfileSettingsView';
import GestureWrapper from './components/GestureWrapper';
import SwipeIndicator from './components/SwipeIndicator';
import { LoadingSpinnerIcon, RefreshIcon, PlusIcon as AddMemberIcon, CogIcon } from './components/icons';
import { ClipboardIcon, Wifi, WifiOff } from 'lucide-react';
import { TabKeys } from './types';
import MemberFormModal from './components/MemberFormModal';
import BulkMemberAddModal from './components/BulkMemberAddModal';
import BacentaFormModal from './components/BacentaFormModal';
import BacentaDrawer from './components/BacentaDrawer';
import NewBelieverFormModal from './components/NewBelieverFormModal';
import DataManagement from './components/DataManagement';
// import { DeleteMemberModal, DeleteBacentaModal, DeleteNewBelieverModal, ClearAllDataModal } from './components/ConfirmationModal';

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
    toasts,
    switchTab,
    user,
    isOnline,
    needsMigration,
    toggleOfflineMode,
    showToast,
    removeToast
  } = useAppContext();

  const [isDataManagementOpen, setIsDataManagementOpen] = useState(false);
  const [isBulkMemberModalOpen, setIsBulkMemberModalOpen] = useState(false);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(needsMigration);

  const handleRefreshData = async () => {
    try {
      await fetchInitialData();
      // Removed success toast - data refresh should be silent
    } catch (error: any) {
      showToast('error', 'Failed to refresh data', error.message);
    }
  };

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
                <p className="text-sm text-gray-600 mt-1">Syncing with Firebase</p>
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

    const isBacentaTab = bacentas.some(b => b.id === currentTab.id);

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
      case TabKeys.PROFILE_SETTINGS:
        return <ProfileSettingsView />;
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
      <header className="glass fixed top-0 left-0 right-0 z-50 border-b border-white/20 shadow-xl">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3 md:py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
            <button
              onClick={() => switchTab({ id: 'dashboard', name: 'Dashboard' })}
              className="flex items-center space-x-2 sm:space-x-3 transition-all duration-300 group min-w-0"
              aria-label="Go to Dashboard"
              title="Go to Dashboard"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-white rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 flex-shrink-0 p-0.5">
                <img src="/logo.png" alt="First Love Church" className="w-full h-full object-contain" />
              </div>
              <div className="min-w-0 hidden sm:block">
                <h1 className="text-base sm:text-lg md:text-xl font-bold gradient-text font-serif group-hover:text-gray-700 transition-colors duration-300 truncate">SAT Mobile</h1>
                <p className="text-xs text-gray-600 font-medium group-hover:text-gray-700 transition-colors duration-300 hidden md:block">First Love Church</p>
              </div>
            </button>
          </div>
          
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            {/* Online/Offline indicator */}
            <button
              onClick={toggleOfflineMode}
              className={`p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl transition-all duration-300 group shadow-lg ${
                isOnline ? 'glass hover:glass-dark' : 'bg-orange-100 hover:bg-orange-200'
              }`}
              aria-label={isOnline ? 'Go Offline' : 'Go Online'}
              title={isOnline ? 'Go Offline' : 'Go Online'}
            >
              {isOnline ? (
                <Wifi className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 group-hover:text-green-700 transition-all duration-300" />
              ) : (
                <WifiOff className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 group-hover:text-orange-700 transition-all duration-300" />
              )}
            </button>

            <button
              onClick={() => openMemberForm()}
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
              onClick={() => setIsDataManagementOpen(true)}
              className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl glass hover:glass-dark transition-all duration-300 group shadow-lg"
              aria-label="Data Management"
              title="Backup & Restore Data"
            >
              <CogIcon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 group-hover:text-white transition-all duration-300" />
            </button>
            
            <button
              onClick={handleRefreshData}
              className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl glass hover:glass-dark transition-all duration-300 group shadow-lg"
              aria-label="Refresh Data"
              title="Refresh Data"
            >
              <RefreshIcon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 group-hover:text-white transition-all duration-300" />
            </button>
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

      {/* Modals */}
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

      <BacentaDrawer
        isOpen={isBacentaDrawerOpen}
        onClose={closeBacentaDrawer}
      />

      <DataManagement
        isOpen={isDataManagementOpen}
        onClose={() => setIsDataManagementOpen(false)}
      />

      {/* Data Migration Modal */}
      <DataMigrationModal
        isOpen={isMigrationModalOpen}
        onClose={() => setIsMigrationModalOpen(false)}
        onMigrationComplete={() => {
          setIsMigrationModalOpen(false);
          showToast('success', 'Migration completed successfully');
        }}
      />

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

const FirebaseApp: React.FC = () => {
  return (
    <FirebaseAppProvider>
      <AuthWrapper>
        <AppContent />
      </AuthWrapper>
    </FirebaseAppProvider>
  );
};

export default FirebaseApp;
