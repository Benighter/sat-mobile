
import React from 'react';
import { useAppData } from '../hooks/useAppData';
import { ChartBarIcon, UsersIcon, WarningIcon, GroupIcon, Bars3Icon } from './icons';

const Navbar: React.FC = () => {
  const { bacentas, currentTab, criticalMemberIds, openBacentaDrawer } = useAppData();

  const getIconForTab = (tabId: string) => {
    switch (tabId) {
      case 'dashboard': return <ChartBarIcon className="w-5 h-5 mr-1 sm:mr-2" />;
      case 'all_members': return <UsersIcon className="w-5 h-5 mr-1 sm:mr-2" />;
      case 'all_bacentas': return <GroupIcon className="w-5 h-5 mr-1 sm:mr-2" />;
      case 'critical_members': return <WarningIcon className="w-5 h-5 mr-1 sm:mr-2" />;
      case 'attendance_analytics': return <ChartBarIcon className="w-5 h-5 mr-1 sm:mr-2" />;
      default: return <GroupIcon className="w-5 h-5 mr-1 sm:mr-2" />;
    }
  };



  return (
    <nav className="glass-dark border-t border-white/10">
      <div className="container mx-auto px-2 sm:px-4 flex items-center justify-between">

        {/* Left side - Hamburger menu */}
        <div className="flex items-center space-x-4">
          <button
            onClick={openBacentaDrawer}
            className="group flex items-center space-x-2 px-3 py-4 text-white/70 hover:text-white transition-all duration-300 rounded-xl hover:bg-white/10"
            title="Open Navigation Menu"
            aria-label="Open Navigation Menu"
          >
            <div className="relative">
              <Bars3Icon className="w-5 h-5 transition-colors duration-200" />
            </div>
            <span className="hidden sm:inline font-semibold">Menu</span>
            {criticalMemberIds.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                {criticalMemberIds.length}
              </span>
            )}
          </button>

          {/* Current Tab Indicator */}
          <div className="hidden sm:flex items-center space-x-2 px-3 py-2 bg-white/10 rounded-xl border border-white/20">
            {getIconForTab(currentTab.id)}
            <span className="text-white font-medium text-sm truncate max-w-[120px]">
              {currentTab.name}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
