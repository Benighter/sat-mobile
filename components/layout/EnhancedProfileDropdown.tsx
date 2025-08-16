import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { authService, FirebaseUser } from '../../services/firebaseService';
import { TabKeys } from '../../types';
import {
  UserIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  PlusIcon,
  ClipboardIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '../icons';
import { hasLeaderPrivileges, hasAdminPrivileges } from '../../utils/permissionUtils';
import AboutModal from '../modals/general/AboutModal';

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
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    showToast,
  openMemberForm,
    switchTab,
    members,
    bacentas,
    newBelievers,
  userProfile,
  // Ensure profile dropdown and navigation drawer aren't open at the same time
  isBacentaDrawerOpen,
  closeBacentaDrawer
  } = useAppContext();

  // Use active (non-frozen) members across the app
  const activeMembersCount = useMemo(() => members.filter(m => !m.frozen).length, [members]);

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

  // Auto-close profile dropdown if navigation drawer opens
  useEffect(() => {
    if (isBacentaDrawerOpen && isOpen) {
      setIsOpen(false);
    }
  }, [isBacentaDrawerOpen, isOpen]);

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
      sm: 'w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 text-xs xs:text-sm',
      md: 'w-8 h-8 xs:w-9 xs:h-9 sm:w-10 sm:h-10 text-sm xs:text-base',
      lg: 'w-14 h-14 xs:w-15 xs:h-15 sm:w-16 sm:h-16 text-lg xs:text-xl'
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
        onClick={() => {
          const next = !isOpen;
          // If we're about to open the profile dropdown, close the navigation drawer
          if (next) {
            try { closeBacentaDrawer?.(); } catch {}
          }
          setIsOpen(next);
        }}
        className="flex items-center space-x-1 xs:space-x-2 px-1.5 xs:px-2 sm:px-3 py-1.5 xs:py-2 rounded-lg xs:rounded-xl glass hover:glass-dark transition-all duration-300 group shadow-lg touch-manipulation"
        aria-label="Open profile menu"
      >
        <ProfileAvatar size="sm" />
        <div className="hidden sm:block text-left min-w-0">
          <p className="text-gray-700 font-medium text-sm truncate max-w-[80px] md:max-w-[100px] lg:max-w-[120px]">
            {userProfile?.displayName || `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || user.displayName || 'User'}
          </p>
          <p className="text-gray-500 text-xs truncate max-w-[80px] md:max-w-[100px] lg:max-w-[120px]">
            Church Member
          </p>
        </div>
        <ChevronDownIcon className={`w-3 h-3 xs:w-4 xs:h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
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
                <p className="text-2xl font-bold text-blue-600">{activeMembersCount}</p>
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
                setIsAboutModalOpen(true);
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 transition-all duration-200 group"
            >
              <InformationCircleIcon className="w-5 h-5 text-indigo-500 group-hover:text-blue-600" />
              <span className="text-sm font-medium text-indigo-600 group-hover:text-blue-700">About</span>
            </button>

            {/* My Deletion Requests - Leaders only (but not admins) */}
            {hasLeaderPrivileges(userProfile) && !hasAdminPrivileges(userProfile) && (
              <button
                onClick={() => {
                  switchTab({ id: TabKeys.MY_DELETION_REQUESTS, name: 'My Deletion Requests' });
                  setIsOpen(false);
                }}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-orange-50 transition-colors duration-200 group"
              >
                <ClipboardIcon className="w-5 h-5 text-orange-500 group-hover:text-orange-700" />
                <span className="text-sm font-medium text-orange-600 group-hover:text-orange-800">My Deletion Requests</span>
              </button>
            )}

            {/* Admin Deletion Requests - Admins only */}
            {hasAdminPrivileges(userProfile) && (
              <button
                onClick={() => {
                  switchTab({ id: TabKeys.ADMIN_DELETION_REQUESTS, name: 'Admin Deletion Requests' });
                  setIsOpen(false);
                }}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-red-50 transition-colors duration-200 group"
              >
                <ExclamationTriangleIcon className="w-5 h-5 text-red-500 group-hover:text-red-700" />
                <span className="text-sm font-medium text-red-600 group-hover:text-red-800">Admin Deletion Requests</span>
              </button>
            )}

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

      {/* About Modal */}
      <AboutModal 
        isOpen={isAboutModalOpen} 
        onClose={() => setIsAboutModalOpen(false)} 
      />
    </div>
  );
};

export default EnhancedProfileDropdown;
