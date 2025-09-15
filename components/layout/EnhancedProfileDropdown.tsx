import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
import { 
  getViewportSize, 
  calculateMobileDropdownPosition,
  enhanceDropdownScrolling,
  createScrollIndicators,
  updateScrollIndicators,
  debounce
} from '../../utils/viewportUtils';

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
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    maxHeight: number;
    positioning: 'fixed' | 'absolute';
  } | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const scrollIndicatorsRef = useRef<{ top: HTMLElement; bottom: HTMLElement } | null>(null);
  const {
    showToast,
  openMemberForm,
    switchTab,
    members,
    bacentas,
    newBelievers,
  userProfile,
  // cross-tenant
  accessibleChurchLinks,
  isImpersonating,
  currentExternalPermission,
  // Ensure profile dropdown and navigation drawer aren't open at the same time
  isBacentaDrawerOpen,
  closeBacentaDrawer
  } = useAppContext();

  // Use active (non-frozen) members across the app
  const activeMembersCount = useMemo(() => members.filter(m => !m.frozen).length, [members]);

  // Calculate dropdown position based on viewport
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !isOpen) return;

    const viewport = getViewportSize();
    // Profile dropdown is larger - estimate height based on content
    const estimatedHeight = 600; // Approximate height of profile dropdown
    const estimatedWidth = viewport.isMobile ? 
      (viewport.isSmallMobile ? window.innerWidth - 16 : window.innerWidth - 32) : 
      384; // w-96 = 24rem = 384px

    const position = calculateMobileDropdownPosition(
      triggerRef.current,
      estimatedWidth,
      estimatedHeight
    );

    setDropdownPosition(position);
  }, [isOpen]);

  // Enhanced scroll handling for mobile
  const setupMobileScrolling = useCallback(() => {
    if (!menuRef.current) return () => {};

    const viewport = getViewportSize();
    if (!viewport.isMobile) return () => {};

    // Add mobile scroll enhancements
    const cleanup = enhanceDropdownScrolling(menuRef.current);

    // Create scroll indicators
    const indicators = createScrollIndicators();
    scrollIndicatorsRef.current = indicators;

    // Add indicators to menu
    menuRef.current.prepend(indicators.top);
    menuRef.current.append(indicators.bottom);

    // Setup scroll listener
    const handleScroll = debounce(() => {
      if (menuRef.current && scrollIndicatorsRef.current) {
        updateScrollIndicators(
          menuRef.current,
          scrollIndicatorsRef.current.top,
          scrollIndicatorsRef.current.bottom
        );
      }
    }, 16);

    menuRef.current.addEventListener('scroll', handleScroll);

    // Initial indicator update
    setTimeout(() => handleScroll(), 100);

    return () => {
      cleanup();
      if (menuRef.current) {
        menuRef.current.removeEventListener('scroll', handleScroll);
      }
      if (scrollIndicatorsRef.current) {
        scrollIndicatorsRef.current.top.remove();
        scrollIndicatorsRef.current.bottom.remove();
      }
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      calculatePosition();
      
      // Setup mobile scrolling
      const cleanupScrolling = setupMobileScrolling();
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        cleanupScrolling();
      };
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, calculatePosition, setupMobileScrolling]);

  // Handle window resize
  useEffect(() => {
    const handleResize = debounce(() => {
      if (isOpen) {
        calculatePosition();
      }
    }, 100);

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, calculatePosition]);

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

  if (!user) {
    // Render a fallback button for debugging
    return (
      <div className="relative">
        <button className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-red-500 text-white shadow-lg">
          <span>No User</span>
        </button>
      </div>
    );
  }

  // Derive role label once profile is available; fallback while loading
  const roleLabel = useMemo(() => {
    if (!userProfile) return 'Loading…';
    if (hasAdminPrivileges(userProfile)) return 'Admin';
    if (hasLeaderPrivileges(userProfile)) return 'Leader';
    return 'Church Member';
  }, [userProfile]);

  const displayNameSafe = useMemo(() => {
    // Prefer rich profile name; then auth; then placeholder
    const full = (userProfile?.displayName || `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim());
    return full || user.displayName || user.email || 'User';
  }, [userProfile, user]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Button */}
      <button
        ref={triggerRef}
        onClick={() => {
          const next = !isOpen;
          // If we're about to open the profile dropdown, close the navigation drawer
          if (next) {
            try { closeBacentaDrawer?.(); } catch {}
          }
          setIsOpen(next);
        }}
        className="flex items-center space-x-1 xs:space-x-2 px-1.5 xs:px-2 sm:px-3 py-1.5 xs:py-2 rounded-lg xs:rounded-xl bg-white/95 border border-gray-200 hover:bg-white hover:shadow-lg transition-all duration-300 group shadow-md touch-manipulation min-w-[40px]"
        aria-label="Open profile menu"
      >
        <ProfileAvatar size="sm" />
        <div className="hidden sm:block text-left min-w-0">
          <p className="text-gray-700 font-medium text-sm truncate max-w-[80px] md:max-w-[100px] lg:max-w-[120px]">
            {displayNameSafe}
          </p>
          <p className="text-gray-500 text-xs truncate max-w-[80px] md:max-w-[100px] lg:max-w-[120px]">
            {roleLabel}
          </p>
        </div>
        <ChevronDownIcon className={`w-3 h-3 xs:w-4 xs:h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          ref={menuRef}
          className={
            getViewportSize().isMobile
              ? 'fixed mobile-profile-dropdown mobile-dropdown-content bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden overflow-y-auto'
              : 'absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden overflow-y-auto'
          }
          style={getViewportSize().isMobile && dropdownPosition ? {
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            maxHeight: `${dropdownPosition.maxHeight}px`,
            width: getViewportSize().isSmallMobile ? 'calc(100vw - 1rem)' : 'calc(100vw - 2rem)'
          } : {}}
        >
          {/* Profile Header */}
          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-gray-100">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <ProfileAvatar size="lg" />
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-1 truncate">
                  {displayNameSafe}
                </h3>
                <p className="text-xs text-gray-600 mb-2 break-words overflow-wrap-anywhere">{user.email}</p>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                  <p className="text-xs text-green-600 font-medium">{roleLabel}</p>
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
                className="flex items-center space-x-2 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors duration-200 group touch-manipulation mobile-dropdown-item"
              >
                <PlusIcon className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">Add Member</span>
              </button>
              <button
                onClick={() => {
                  onOpenBulkMemberModal?.();
                  setIsOpen(false);
                }}
                className="flex items-center space-x-2 p-3 rounded-lg bg-green-50 hover:bg-green-100 transition-colors duration-200 group touch-manipulation mobile-dropdown-item"
              >
                <ClipboardIcon className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">Bulk Add</span>
              </button>

              <button
                onClick={() => {
                  onOpenDataManagement?.();
                  setIsOpen(false);
                }}
                className="flex items-center space-x-2 p-3 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors duration-200 group touch-manipulation mobile-dropdown-item"
              >
                <CogIcon className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-700">Settings</span>
              </button>
            </div>
          </div>

          {/* Menu Items */}
          <div className="p-2">
            {/* Cross-tenant context switching moved to Profile Settings → Constituencies */}
            {accessibleChurchLinks && accessibleChurchLinks.length > 0 && (
              <div className="mb-2 px-4 py-3 rounded-lg bg-indigo-50 border border-indigo-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-700">Constituencies</span>
                  {isImpersonating && (
                    <span className="text-[11px] text-indigo-700">Viewing external ({currentExternalPermission || 'read-only'})</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    switchTab({ id: TabKeys.PROFILE_SETTINGS, name: 'Profile Settings' });
                    setIsOpen(false);
                    // Attempt to scroll to the section after navigation
                    setTimeout(() => {
                      try { document.getElementById('constituencies-section')?.scrollIntoView({ behavior: 'smooth' }); } catch {}
                    }, 250);
                  }}
                  className="mt-2 w-full text-left text-sm px-2 py-2 rounded bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-100 touch-manipulation mobile-dropdown-item"
                >
                  Manage constituencies in Profile Settings
                </button>
              </div>
            )}
            <button
              onClick={() => {
                switchTab({ id: TabKeys.PROFILE_SETTINGS, name: 'Profile Settings' });
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors duration-200 group touch-manipulation mobile-dropdown-item"
            >
              <UserIcon className="w-5 h-5 text-gray-500 group-hover:text-gray-700" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Profile Settings</span>
            </button>

            <button
              onClick={() => {
                setIsAboutModalOpen(true);
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 transition-all duration-200 group touch-manipulation mobile-dropdown-item"
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
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-orange-50 transition-colors duration-200 group touch-manipulation mobile-dropdown-item"
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
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-red-50 transition-colors duration-200 group touch-manipulation mobile-dropdown-item"
              >
                <ExclamationTriangleIcon className="w-5 h-5 text-red-500 group-hover:text-red-700" />
                <span className="text-sm font-medium text-red-600 group-hover:text-red-800">Admin Deletion Requests</span>
              </button>
            )}

            {/* Contact Support */}
            <button
              onClick={() => {
                switchTab({ id: TabKeys.CONTACT, name: 'Contact', data: { initialEmail: user?.email || (typeof window !== 'undefined' ? localStorage.getItem('last_known_email') || undefined : undefined) } });
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-blue-50 dark:hover:bg-dark-700 transition-colors duration-200 group touch-manipulation mobile-dropdown-item"
            >
              <InformationCircleIcon className="w-5 h-5 text-blue-500 group-hover:text-blue-700" />
              <div className="text-left">
                <div className="text-sm font-medium text-gray-800 dark:text-dark-100">Contact Support</div>
                <div className="text-xs text-gray-500 dark:text-dark-300">Send us a message</div>
              </div>
            </button>


          </div>

          {/* Logout */}
          <div className="p-2 border-t border-gray-100">
            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-red-50 transition-colors duration-200 group disabled:opacity-50 touch-manipulation mobile-dropdown-item"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5 text-red-500 group-hover:text-red-600" />
              <span className="text-sm font-medium text-red-600 group-hover:text-red-700">
                {isLoading ? 'Signing out...' : 'Sign Out'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile backdrop */}
      {isOpen && getViewportSize().isMobile && (
        <div 
          className="fixed inset-0 bg-black/20 mobile-dropdown-backdrop z-40"
          onClick={() => setIsOpen(false)}
        />
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
