import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { authService } from '../services/firebaseService';
import {
  CogIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon
} from './icons';
import Button from './ui/Button';
import SettingsModal from './SettingsModal';

interface ProfileDropdownProps {
  currentUser: any;
  onProfileUpdate?: () => void;
}

const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ currentUser, onProfileUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { showToast } = useAppContext();

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
      showToast('success', 'Signed out successfully', 'You have been logged out of your account');
    } catch (error: any) {
      showToast('error', 'Logout failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (user: any): string => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    }
    if (user?.displayName) {
      const names = user.displayName.split(' ');
      return names.length > 1 
        ? `${names[0].charAt(0)}${names[names.length - 1].charAt(0)}`.toUpperCase()
        : names[0].charAt(0).toUpperCase();
    }
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  const ProfileAvatar = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
    const sizeClasses = {
      sm: 'w-8 h-8 text-sm',
      md: 'w-10 h-10 text-base',
      lg: 'w-16 h-16 text-xl'
    };

    return (
      <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-lg`}>
        {currentUser?.profilePicture ? (
          <img 
            src={currentUser.profilePicture} 
            alt="Profile" 
            className={`${sizeClasses[size]} rounded-full object-cover`}
          />
        ) : (
          <span>{getInitials(currentUser)}</span>
        )}
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-300 border border-white/20 group"
        aria-label="Open profile menu"
      >
        <ProfileAvatar size="sm" />
        <div className="hidden sm:block text-left">
          <p className="text-white font-medium text-sm truncate max-w-[120px]">
            {currentUser?.firstName || currentUser?.displayName || 'User'}
          </p>
          <p className="text-white/70 text-xs truncate max-w-[120px]">
            {currentUser?.churchName || 'Church Member'}
          </p>
        </div>
        <ChevronDownIcon className={`w-4 h-4 text-white/70 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          {/* Profile Header */}
          <div className="p-5 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 border-b border-gray-100">
            <div className="flex items-center space-x-4">
              <ProfileAvatar size="lg" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate text-base">
                  {currentUser?.displayName || `${currentUser?.firstName} ${currentUser?.lastName}` || 'User'}
                </h3>
                <p className="text-sm text-gray-600 truncate">{currentUser?.email}</p>
                <p className="text-xs text-blue-600 font-medium truncate mt-1">
                  {currentUser?.churchName} • {currentUser?.role || 'Member'}
                </p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <button
              onClick={() => {
                setIsSettingsModalOpen(true);
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors duration-200"
            >
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <CogIcon className="w-4 h-4 text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-medium">Settings</p>
                <p className="text-xs text-gray-500">Preferences and configuration</p>
              </div>
            </button>

            <div className="border-t border-gray-50 my-3"></div>

            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="w-full flex items-center space-x-3 px-4 py-3.5 text-red-600 hover:bg-red-50/70 rounded-xl mx-2 mb-2 transition-all duration-200 disabled:opacity-50 group"
            >
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 transition-colors">
                <ArrowRightOnRectangleIcon className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-left">
                <p className="font-medium">{isLoading ? 'Signing out...' : 'Sign Out'}</p>
                <p className="text-xs text-red-500/80">Log out of your account</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          currentUser={currentUser}
          onUpdate={onProfileUpdate}
        />
      )}
    </div>
  );
};



export default ProfileDropdown;
