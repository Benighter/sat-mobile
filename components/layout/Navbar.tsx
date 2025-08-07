
import React, { memo } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { ChartBarIcon, UsersIcon, GroupIcon, Bars3Icon, UserIcon, CheckIcon } from '../icons';

const Navbar: React.FC = memo(() => {
  const { currentTab, openBacentaDrawer } = useAppContext();

  const getIconForTab = (tabId: string) => {
    switch (tabId) {
      case 'dashboard': return <ChartBarIcon className="w-full h-full mr-1 sm:mr-2" />;
      case 'all_members': return <UsersIcon className="w-full h-full mr-1 sm:mr-2" />;
      case 'all_bacentas': return <GroupIcon className="w-full h-full mr-1 sm:mr-2" />;

      case 'attendance_analytics': return <ChartBarIcon className="w-full h-full mr-1 sm:mr-2" />;
      case 'weekly_attendance': return <UsersIcon className="w-full h-full mr-1 sm:mr-2" />;
      case 'sunday_confirmations': return <CheckIcon className="w-full h-full mr-1 sm:mr-2" />;
      case 'new_believers': return <UsersIcon className="w-full h-full mr-1 sm:mr-2" />;
      case 'profile_settings': return <UserIcon className="w-full h-full mr-1 sm:mr-2" />;
      default: return <GroupIcon className="w-full h-full mr-1 sm:mr-2" />;
    }
  };



  return (
    <nav className="glass-dark border-t border-white/10">
      <div className="container mx-auto px-2 sm:px-4 flex items-center justify-between">

        {/* Left side - Hamburger menu */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          <button
            onClick={openBacentaDrawer}
            className="group flex items-center space-x-2 px-2 sm:px-3 py-2 sm:py-3 md:py-4 text-white/70 hover:text-white transition-all duration-300 rounded-lg sm:rounded-xl hover:bg-white/10"
            title="Open Navigation Menu"
            aria-label="Open Navigation Menu"
          >
            <div className="relative">
              <Bars3Icon className="w-4 h-4 sm:w-5 sm:h-5 transition-colors duration-200" />
            </div>
            <span className="hidden sm:inline font-semibold text-sm">Menu</span>
          </button>

          {/* Current Tab Indicator */}
          <div className="hidden sm:flex items-center space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-white/10 rounded-lg sm:rounded-xl border border-white/20">
            <div className="w-4 h-4 sm:w-5 sm:h-5">
              {getIconForTab(currentTab.id)}
            </div>
            <span className="text-white font-medium text-xs sm:text-sm truncate max-w-[100px] sm:max-w-[120px]">
              {currentTab.name}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
});

Navbar.displayName = 'Navbar';

export default Navbar;
