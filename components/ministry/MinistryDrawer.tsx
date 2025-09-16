import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { TabKeys } from '../../types';

import {
  XMarkIcon,
  UsersIcon,
  ChartBarIcon,
  CakeIcon,
  CalendarIcon,

} from '../icons';
import { PrayerIcon, CheckIcon, PeopleIcon, ChevronDownIcon } from '../icons';

interface MinistryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const MinistryDrawer: React.FC<MinistryDrawerProps> = ({ isOpen, onClose }) => {
  const {
    members,
    currentTab,
    switchTab,
    activeMinistryName,
  } = useAppContext();

  const [isFlockOpen, setIsFlockOpen] = useState(false);

  // Clear any state when drawer closes
  useEffect(() => {
    if (!isOpen) {
      // Reset any local state if needed
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`fixed top-0 left-0 h-full w-80 max-w-[90vw] sm:max-w-[85vw] md:max-w-[75vw] lg:w-80 bg-white dark:bg-dark-800 shadow-xl z-50 transform transition-all duration-300 ease-out ${
        isOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full shadow-none'
      } border-r border-gray-200 dark:border-dark-600 flex flex-col`}>

        {/* Header */}
        <div className="bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-600 p-3 sm:p-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-dark-100 flex items-center min-w-0">
              <ChartBarIcon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-slate-500 dark:text-slate-400 flex-shrink-0" />
              <span className="whitespace-normal break-words">{activeMinistryName || 'Ministry Navigation'}</span>
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors duration-200 flex-shrink-0"
              aria-label="Close drawer"
            >
              <XMarkIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 dark:text-dark-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto sidebar-scroll p-3 sm:p-4 space-y-4 sm:space-y-6 min-h-0">

          {/* Main Navigation */}
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-dark-400 mb-2 sm:mb-3 flex items-center">
              <ChartBarIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-slate-500 dark:text-slate-400 flex-shrink-0" />
              <span className="whitespace-normal break-words">Navigation</span>
            </h3>
            <div className="space-y-1.5 sm:space-y-2">
              {/* Ministry Navigation Items */}
              <NavigationItem
                icon={<UsersIcon className="w-4 h-4" />}
                label="Born Again"
                isActive={currentTab.id === TabKeys.NEW_BELIEVERS}
                onClick={() => {
                  switchTab({ id: TabKeys.NEW_BELIEVERS, name: 'Born Again' });
                  onClose();
                }}
              />
              <NavigationItem
                icon={<UsersIcon className="w-4 h-4" />}
                label="Sons of God"
                isActive={currentTab.id === TabKeys.SONS_OF_GOD}
                onClick={() => {
                  switchTab({ id: TabKeys.SONS_OF_GOD, name: 'Sons of God' });
                  onClose();
                }}
              />

              <NavigationItem
                icon={<CakeIcon className="w-4 h-4" />}
                label="Birthdays"
                isActive={currentTab.id === TabKeys.BIRTHDAYS}

                onClick={() => {
                  switchTab({ id: TabKeys.BIRTHDAYS, name: 'Birthdays' });
                  onClose();
                }}
              />
              <button onClick={() => setIsFlockOpen(v => !v)} className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-gray-50 dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600 border border-gray-200 dark:border-dark-600">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="text-gray-600 dark:text-dark-300"><PeopleIcon className="w-4 h-4" /></div>
                  <span className="font-semibold text-sm sm:text-base text-gray-800 dark:text-dark-100">State of the Flock</span>
                </div>
                <ChevronDownIcon className={`w-4 h-4 transform transition-transform ${isFlockOpen ? '' : '-rotate-90'}`} />
              </button>
              {isFlockOpen && (<>





              <NavigationItem
                icon={<PrayerIcon className="w-4 h-4" />}
                label="Prays in Tongues"
                isActive={
                  currentTab.id === TabKeys.ALL_CONGREGATIONS &&
                  (currentTab.data as any)?.speaksInTonguesOnly === true
                }

                onClick={() => {
                  switchTab({ id: TabKeys.ALL_CONGREGATIONS, name: 'Praying in Tongues', data: { speaksInTonguesOnly: true } });
                  onClose();
                }}
              />

              <NavigationItem
                icon={<CheckIcon className="w-4 h-4" />}
                label="Water Baptized"
                isActive={
                  currentTab.id === TabKeys.ALL_CONGREGATIONS &&
                  (currentTab.data as any)?.baptizedOnly === true
                }

                onClick={() => {
                  switchTab({ id: TabKeys.ALL_CONGREGATIONS, name: 'Water Baptized', data: { baptizedOnly: true } });
                  onClose();
                }}
              />

              <NavigationItem
                icon={<PeopleIcon className="w-4 h-4" />}
                label="Ministries"
                isActive={currentTab.id === TabKeys.MINISTRIES}
                onClick={() => {
                  switchTab({ id: TabKeys.MINISTRIES, name: 'Ministries' });
                  onClose();
                }}
              />

              </>) }
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

// Navigation Item Component
interface NavigationItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;

}

const NavigationItem: React.FC<NavigationItemProps> = ({
  icon,
  label,
  isActive,
  onClick
}) => {
  // Get accent color based on label with improved contrast
  const getAccentColor = (label: string) => {
    switch (label) {
      case 'Sons of God':
        return {
          active: 'bg-emerald-100 dark:bg-emerald-900/40 border-l-4 border-l-emerald-600 dark:border-l-emerald-400 shadow-sm',
          icon: 'text-emerald-700 dark:text-emerald-300',
          text: 'text-emerald-900 dark:text-emerald-100',
          hover: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-l-emerald-500 dark:hover:border-l-emerald-500'
        };
      case 'Birthdays':
        return {
          active: 'bg-pink-100 dark:bg-pink-900/40 border-l-4 border-l-pink-600 dark:border-l-pink-400 shadow-sm',
          icon: 'text-pink-700 dark:text-pink-300',
          text: 'text-pink-900 dark:text-pink-100',
          hover: 'hover:bg-pink-50 dark:hover:bg-pink-900/20 hover:border-l-pink-500 dark:hover:border-l-pink-500'
        };
      case 'Prays in Tongues':
        return {
          active: 'bg-purple-100 dark:bg-purple-900/40 border-l-4 border-l-purple-600 dark:border-l-purple-400 shadow-sm',
          icon: 'text-purple-700 dark:text-purple-300',
          text: 'text-purple-900 dark:text-purple-100',
          hover: 'hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-l-purple-500 dark:hover:border-l-purple-500'
        };
      case 'Water Baptized':
        return {
          active: 'bg-blue-100 dark:bg-blue-900/40 border-l-4 border-l-blue-600 dark:border-l-blue-400 shadow-sm',
          icon: 'text-blue-700 dark:text-blue-300',
          text: 'text-blue-900 dark:text-blue-100',
          hover: 'hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-l-blue-500 dark:hover:border-l-blue-500'
        };
      case 'Ministries':
        return {
          active: 'bg-indigo-100 dark:bg-indigo-900/40 border-l-4 border-l-indigo-600 dark:border-l-indigo-400 shadow-sm',
          icon: 'text-indigo-700 dark:text-indigo-300',
          text: 'text-indigo-900 dark:text-indigo-100',
          hover: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-l-indigo-500 dark:hover:border-l-indigo-500'
        };
      default:
        return {
          active: 'bg-slate-100 dark:bg-slate-900/40 border-l-4 border-l-slate-600 dark:border-l-slate-400 shadow-sm',
          icon: 'text-slate-700 dark:text-slate-300',
          text: 'text-slate-900 dark:text-slate-100',
          hover: 'hover:bg-slate-50 dark:hover:bg-slate-900/20 hover:border-l-slate-500 dark:hover:border-l-slate-500'
        };
    }
  };

  const colors = getAccentColor(label);

  return (
    <button
      onClick={onClick}
      className={`relative w-full flex items-center justify-between p-2.5 sm:p-3 rounded-lg cursor-pointer transition-all duration-200 ${
        isActive
          ? `${colors.active}`
          : `bg-gray-50 dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600 border border-gray-200 dark:border-dark-600 border-l-4 border-l-transparent ${colors.hover} shadow-sm`
      }`}
    >
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
        <div className={`${isActive ? colors.icon : 'text-gray-600 dark:text-dark-300'} transition-colors duration-200 flex-shrink-0`}>
          {icon}
        </div>
        <span className={`font-medium text-sm sm:text-base truncate ${isActive ? colors.text : 'text-gray-800 dark:text-dark-100'} transition-colors duration-200`}>
          {label}
        </span>
      </div>


    </button>
  );
};

export default MinistryDrawer;
