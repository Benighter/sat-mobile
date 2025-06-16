
import React, { useEffect, useState } from 'react';
import { useAppData } from './hooks/useAppData';
import Navbar from './components/Navbar';
import DashboardView from './components/DashboardView';
import MemberListView from './components/MemberListView';
import CriticalMembersView from './components/CriticalMembersView';
import AttendanceAnalyticsView from './components/AttendanceAnalyticsView';
import { LoadingSpinnerIcon, RefreshIcon, PlusIcon as AddMemberIcon, CogIcon } from './components/icons'; // Renamed PlusIcon for clarity
import { TabKeys } from './types';
import MemberFormModal from './components/MemberFormModal';
import BacentaFormModal from './components/BacentaFormModal'; // Import BacentaFormModal
import BacentaDrawer from './components/BacentaDrawer'; // Import BacentaDrawer
import DataManagement from './components/DataManagement';
import { DeleteMemberModal, DeleteBacentaModal, ClearAllDataModal } from './components/ConfirmationModal';
import { ToastContainer } from './components/Toast';

const App: React.FC = () => {
  const {
    currentTab,
    isLoading,
    error,
    fetchInitialData,
    isMemberFormOpen,
    editingMember,
    openMemberForm,
    closeMemberForm,
    refreshData,
    displayedSundays,
    isBacentaFormOpen,
    editingBacenta,
    closeBacentaForm,
    isBacentaDrawerOpen,
    closeBacentaDrawer,
    bacentas,
    members, // Added members to destructuring
    confirmationModal,
    hideConfirmation,
    attendanceRecords,
    toasts,
    changeTab,
  } = useAppData();

  const [isDataManagementOpen, setIsDataManagementOpen] = useState(false);

  useEffect(() => {
    fetchInitialData();
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

    const isBacentaTab = bacentas.some(b => b.id === currentTab.id);

    if (isBacentaTab) {
      return <MemberListView bacentaFilter={currentTab.id} />;
    }

    switch (currentTab.id) {
      case TabKeys.DASHBOARD:
        return <DashboardView />;
      case TabKeys.CRITICAL_MEMBERS:
        return <CriticalMembersView />;
      case TabKeys.ALL_CONGREGATIONS:
        return <MemberListView bacentaFilter={null} />;
      case TabKeys.ATTENDANCE_ANALYTICS:
        return <AttendanceAnalyticsView />;
      default:
        return <MemberListView bacentaFilter={null} />;
    }
  };

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">
      {/* Animated background overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-white/50 via-gray-50/30 to-gray-100/20 pointer-events-none"></div>

      {/* Fixed Header */}
      <header className="glass fixed top-0 left-0 right-0 z-50 border-b border-white/20 shadow-xl">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <button
            onClick={() => changeTab('dashboard')}
            className="flex items-center space-x-3 transition-all duration-300 group"
            aria-label="Go to Dashboard"
            title="Go to Dashboard"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:from-gray-700 group-hover:to-gray-800 transition-all duration-300">
              <span className="text-white font-bold text-lg">⛪</span>
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text font-serif group-hover:text-gray-700 transition-colors duration-300">Church Connect</h1>
              <p className="text-xs text-gray-600 font-medium group-hover:text-gray-700 transition-colors duration-300">Faith • Community • Growth</p>
            </div>
          </button>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => openMemberForm(null)}
              className="p-3 rounded-xl glass hover:glass-dark transition-all duration-300 group shadow-lg relative overflow-hidden"
              aria-label="Add New Member"
              title="Add New Member"
            >
              {/* Subtle primary action indicator */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/8 via-transparent to-blue-600/8 opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-xl"></div>
              <AddMemberIcon className="w-6 h-6 text-gray-600 group-hover:text-blue-100 transition-all duration-300 relative z-10" />
            </button>
            <button
              onClick={() => setIsDataManagementOpen(true)}
              className="p-3 rounded-xl glass hover:glass-dark transition-all duration-300 group shadow-lg"
              aria-label="Data Management"
              title="Backup & Restore Data"
            >
              <CogIcon className="w-6 h-6 text-gray-600 group-hover:text-white transition-all duration-300" />
            </button>
            <button
              onClick={refreshData}
              className="p-3 rounded-xl glass hover:glass-dark transition-all duration-300 group shadow-lg"
              aria-label="Refresh Data"
              title="Refresh Data"
            >
              <RefreshIcon className="w-6 h-6 text-gray-600 group-hover:text-white transition-all duration-300" />
            </button>
          </div>
        </div>
        <Navbar />
      </header>

      {/* Scrollable Main Content */}
      <main className="flex-1 overflow-y-auto pt-32 pb-6 relative z-10">
        <div className="container mx-auto px-2 sm:px-4 py-6">
          <div className="animate-fade-in">
            {renderView()}
          </div>
        </div>
      </main>


      
      {isMemberFormOpen && (
        <MemberFormModal
          isOpen={isMemberFormOpen}
          onClose={closeMemberForm}
          member={editingMember}
        />
      )}

      {isBacentaFormOpen && (
        <BacentaFormModal
          isOpen={isBacentaFormOpen}
          onClose={closeBacentaForm}
          bacenta={editingBacenta}
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
          onClose={hideConfirmation}
          onConfirm={confirmationModal.onConfirm}
          memberName={confirmationModal.data?.member?.name || 'Unknown Member'}
        />
      )}

      {confirmationModal.type === 'deleteBacenta' && (
        <DeleteBacentaModal
          isOpen={confirmationModal.isOpen}
          onClose={hideConfirmation}
          onConfirm={confirmationModal.onConfirm}
          bacentaName={confirmationModal.data?.bacenta?.name || 'Unknown Bacenta'}
          memberCount={confirmationModal.data?.memberCount || 0}
        />
      )}

      {confirmationModal.type === 'clearData' && (
        <ClearAllDataModal
          isOpen={confirmationModal.isOpen}
          onClose={hideConfirmation}
          onConfirm={confirmationModal.onConfirm}
          totalMembers={confirmationModal.data?.totalMembers || 0}
          totalBacentas={confirmationModal.data?.totalBacentas || 0}
          totalAttendance={confirmationModal.data?.totalAttendance || 0}
        />
      )}

      {/* Toast Notifications */}
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="fixed top-4 right-4 z-50 max-w-sm w-full transform transition-all duration-300 ease-out translate-x-0 opacity-100 scale-100"
        >
          <div className={`
            ${toast.type === 'success' ? 'bg-green-50 border-green-200' :
              toast.type === 'error' ? 'bg-red-50 border-red-200' :
              toast.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
              'bg-blue-50 border-blue-200'
            } border rounded-xl shadow-lg backdrop-blur-sm p-4 relative overflow-hidden
          `}>
            <div className="flex items-start space-x-3">
              <div className={`flex-shrink-0 w-8 h-8 ${
                toast.type === 'success' ? 'bg-green-100' :
                toast.type === 'error' ? 'bg-red-100' :
                toast.type === 'warning' ? 'bg-yellow-100' :
                'bg-blue-100'
              } rounded-full flex items-center justify-center`}>
                <span className={`text-sm ${
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
                <h4 className={`font-semibold text-sm ${
                  toast.type === 'success' ? 'text-green-800' :
                  toast.type === 'error' ? 'text-red-800' :
                  toast.type === 'warning' ? 'text-yellow-800' :
                  'text-blue-800'
                }`}>
                  {toast.title}
                </h4>
                {toast.message && (
                  <p className={`mt-1 text-sm ${
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
};

export default App;
