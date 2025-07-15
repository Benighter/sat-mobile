import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { authService, FirebaseUser } from '../services/firebaseService';
import { TabKeys } from '../types';
import {
  UserIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  PlusIcon,
  ClipboardIcon,
  RefreshIcon,
  ChartBarIcon,
  BellIcon
} from './icons';

interface EnhancedProfileDropdownProps {
  user: FirebaseUser | null;
  onOpenBulkMemberModal?: () => void;
  onOpenDataManagement?: () => void;
}

const EnhancedProfileDropdown: React.FC<EnhancedProfileDropdownProps> = ({
  user,
  onOpenBulkMemberModal,
  onOpenDataManagement
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    showToast,
    openMemberForm,
    fetchInitialData,
    switchTab,
    members,
    bacentas,
    newBelievers,
    userProfile
  } = useAppContext();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await authService.signOut();
      showToast('success', 'Signed Out', 'You have been signed out successfully');
    } catch (error: any) {
      showToast('error', 'Sign Out Failed', error.message);
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  const getInitials = (user: FirebaseUser | null): string => {
    if (!user) return 'U';

    // Try to get initials from userProfile first
    if (userProfile?.firstName && userProfile?.lastName) {
      return `${userProfile.firstName.charAt(0)}${userProfile.lastName.charAt(0)}`.toUpperCase();
    }

    // Fall back to userProfile displayName
    if (userProfile?.displayName) {
      return userProfile.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    }

    // Fall back to auth user displayName
    if (user.displayName) {
      return user.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    }

    return user.email?.charAt(0).toUpperCase() || 'U';
  };

  const ProfileAvatar = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
    const sizeClasses = {
      sm: 'w-8 h-8 text-sm',
      md: 'w-10 h-10 text-base',
      lg: 'w-16 h-16 text-xl'
    };

    // Check if user has a profile picture from userProfile context
    const profilePicture = userProfile?.profilePicture;

    if (profilePicture) {
      return (
        <img
          src={profilePicture}
          alt="Profile"
          className={`${sizeClasses[size]} rounded-full object-cover shadow-lg ring-2 ring-white/20`}
        />
      );
    }

    return (
      <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-lg ring-2 ring-white/20`}>
        <span>{getInitials(user)}</span>
      </div>
    );
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-xl glass hover:glass-dark transition-all duration-300 group shadow-lg"
        aria-label="Open profile menu"
      >
        <ProfileAvatar size="sm" />
        <div className="hidden sm:block text-left min-w-0">
          <p className="text-gray-700 font-medium text-sm truncate max-w-[100px] lg:max-w-[120px]">
            {userProfile?.displayName || `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || user.displayName || 'User'}
          </p>
          <p className="text-gray-500 text-xs truncate max-w-[100px] lg:max-w-[120px]">
            Church Member
          </p>
        </div>
        <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          {/* Profile Header */}
          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-gray-100">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <ProfileAvatar size="lg" />
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-1 truncate">
                  {userProfile?.displayName || `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || user.displayName || 'User'}
                </h3>
                <p className="text-xs text-gray-600 mb-2 break-words overflow-wrap-anywhere">{user.email}</p>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                  <p className="text-xs text-green-600 font-medium">Online</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="p-4 bg-gray-50 border-b border-gray-100">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">{members.length}</p>
                <p className="text-xs text-gray-600">Members</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{bacentas.length}</p>
                <p className="text-xs text-gray-600">Bacentas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{newBelievers.length}</p>
                <p className="text-xs text-gray-600">New Believers</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-4 border-b border-gray-100">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  openMemberForm(undefined);
                  setIsOpen(false);
                }}
                className="flex items-center space-x-2 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors duration-200 group"
              >
                <PlusIcon className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">Add Member</span>
              </button>
              <button
                onClick={() => {
                  onOpenBulkMemberModal?.();
                  setIsOpen(false);
                }}
                className="flex items-center space-x-2 p-3 rounded-lg bg-green-50 hover:bg-green-100 transition-colors duration-200 group"
              >
                <ClipboardIcon className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">Bulk Add</span>
              </button>
              <button
                onClick={() => {
                  fetchInitialData();
                  setIsOpen(false);
                }}
                className="flex items-center space-x-2 p-3 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors duration-200 group"
              >
                <RefreshIcon className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-700">Refresh</span>
              </button>
              <button
                onClick={() => {
                  onOpenDataManagement?.();
                  setIsOpen(false);
                }}
                className="flex items-center space-x-2 p-3 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors duration-200 group"
              >
                <CogIcon className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-700">Settings</span>
              </button>
            </div>
          </div>

          {/* Menu Items */}
          <div className="p-2">
            <button
              onClick={() => {
                switchTab({ id: TabKeys.PROFILE_SETTINGS, name: 'Profile Settings' });
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors duration-200 group"
            >
              <UserIcon className="w-5 h-5 text-gray-500 group-hover:text-gray-700" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Profile Settings</span>
            </button>
            
            <button
              onClick={() => {
                // TODO: Implement notifications
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors duration-200 group"
            >
              <BellIcon className="w-5 h-5 text-gray-500 group-hover:text-gray-700" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Notifications</span>
            </button>

            <button
              onClick={() => {
                switchTab({ id: TabKeys.ATTENDANCE_ANALYTICS, name: 'Attendance Analytics' });
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors duration-200 group"
            >
              <ChartBarIcon className="w-5 h-5 text-gray-500 group-hover:text-gray-700" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Analytics</span>
            </button>
          </div>

          {/* Logout */}
          <div className="p-2 border-t border-gray-100">
            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-red-50 transition-colors duration-200 group disabled:opacity-50"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5 text-red-500 group-hover:text-red-600" />
              <span className="text-sm font-medium text-red-600 group-hover:text-red-700">
                {isLoading ? 'Signing out...' : 'Sign Out'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedProfileDropdown;
