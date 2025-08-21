import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { Bacenta, TabKeys } from '../../types';
import { getUpcomingBirthdays } from '../../utils/birthdayUtils';
import {
  XMarkIcon,
  SearchIcon,
  EditIcon,
  TrashIcon,
  PlusCircleIcon,
  UsersIcon,
  ClockIcon,
  ChartBarIcon,
  CakeIcon,
  BuildingOfficeIcon,
  CogIcon,
  CalendarIcon
} from '../icons';

interface BacentaDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const BacentaDrawer: React.FC<BacentaDrawerProps> = ({ isOpen, onClose }) => {
  const {
    bacentas,
    members,
    currentTab,
    switchTab,
    openBacentaForm,
    deleteBacentaHandler,
    isBacentaFormOpen,
    confirmationModal,
  // userProfile,
  // user,
  // showToast,
    showConfirmation,
  // refreshUserProfile,
    isMinistryContext,
    activeMinistryName,
  } = useAppContext();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [recentBacentas, setRecentBacentas] = useState<string[]>([]);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);



  // Load recent bacentas from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('church_connect_recent_bacentas');
    if (saved) {
      try {
        setRecentBacentas(JSON.parse(saved));
      } catch (e) {
        setRecentBacentas([]);
      }
    }
  }, []);

  // Save recent bacentas when currentTab changes
  useEffect(() => {
    if (currentTab && bacentas.some(b => b.id === currentTab.id)) {
      setRecentBacentas(prevRecent => {
        const newRecent = [currentTab.id, ...prevRecent.filter(id => id !== currentTab.id)].slice(0, 5);
        localStorage.setItem('church_connect_recent_bacentas', JSON.stringify(newRecent));
        return newRecent;
      });
    }
  }, [currentTab, bacentas]);

  // Get member count for each bacenta (only active members)
  const getMemberCount = (bacentaId: string) => {
    return members.filter(m => m.bacentaId === bacentaId && !m.frozen).length;
  };

  // Get upcoming birthdays count
  const upcomingBirthdaysCount = useMemo(() => {
    return getUpcomingBirthdays(members).length;
  }, [members]);

  // Filter bacentas based on search query
  const filteredBacentas = useMemo(() => {
    if (!searchQuery.trim()) return bacentas;
    return bacentas.filter(bacenta => 
      bacenta.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [bacentas, searchQuery]);

  // Get recent bacentas that still exist
  const validRecentBacentas = useMemo(() => {
    return recentBacentas
      .map(id => bacentas.find(b => b.id === id))
      .filter((b): b is Bacenta => b !== undefined)
      .slice(0, 3);
  }, [recentBacentas, bacentas]);

  // Close any open context menus when modals open
  useEffect(() => {
    if (isBacentaFormOpen || confirmationModal.isOpen) {
      // Trigger a custom event to close context menus
      window.dispatchEvent(new CustomEvent('closeContextMenus'));
    }
  }, [isBacentaFormOpen, confirmationModal.isOpen]);

  const handleBacentaClick = (bacenta: Bacenta) => {
    switchTab({ id: bacenta.id, name: bacenta.name });
    onClose();
  };

  const handleEditBacenta = (e: React.MouseEvent, bacenta: Bacenta) => {
    e.stopPropagation();
    console.log('🔧 Edit bacenta clicked:', bacenta.name);
    openBacentaForm(bacenta);
  };

  const handleDeleteBacenta = (e: React.MouseEvent, bacentaId: string) => {
    e.stopPropagation();
    console.log('🗑️ Delete bacenta clicked:', bacentaId);
    const bacenta = bacentas.find(b => b.id === bacentaId);
    if (!bacenta) return;

    const memberCount = getMemberCount(bacentaId);
    showConfirmation(
      'deleteBacenta',
      { bacenta, memberCount },
      () => deleteBacentaHandler(bacentaId)
    );
  };

  const handleAddBacenta = () => {
    openBacentaForm();
    onClose();
  };



  // Handle scroll to update scroll indicators
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setCanScrollUp(scrollTop > 10);
    setCanScrollDown(scrollTop < scrollHeight - clientHeight - 10);
  };

  // Update scroll indicators when bacentas change
  useEffect(() => {
    const scrollContainer = document.querySelector('.bacentas-scroll-container');
    if (scrollContainer) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      setCanScrollUp(scrollTop > 10);
      setCanScrollDown(scrollTop < scrollHeight - clientHeight - 10);
    }
  }, [filteredBacentas]);

  // Clear search when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
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
              <span className="truncate">{isMinistryContext ? (activeMinistryName || 'Ministry Navigation') : 'Navigation'}</span>
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors duration-200 flex-shrink-0"
              aria-label="Close drawer"
            >
              <XMarkIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 dark:text-dark-400" />
            </button>
          </div>

          {/* Search Input (hidden in Ministry mode) */}
          {!isMinistryContext && (
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search bacentas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-2.5 border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 rounded-lg focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 focus:border-transparent transition-all duration-200 placeholder-gray-500 dark:placeholder-dark-400 text-base sm:text-sm search-input"
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto sidebar-scroll p-3 sm:p-4 space-y-4 sm:space-y-6 min-h-0">

          {/* Main Navigation */}
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-dark-400 mb-2 sm:mb-3 flex items-center">
              <ChartBarIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-slate-500 dark:text-slate-400 flex-shrink-0" />
              <span className="truncate">Navigation</span>
            </h3>
            <div className="space-y-1.5 sm:space-y-2">
              {/* Ministry-aware items */}
              {isMinistryContext ? (
                <>
                  <NavigationItem
                    icon={<UsersIcon className="w-4 h-4" />}
                    label="Sons of God"
                    isActive={currentTab.id === TabKeys.NEW_BELIEVERS}
                    onClick={() => {
                      switchTab({ id: TabKeys.NEW_BELIEVERS, name: 'New Believers' });
                      onClose();
                    }}
                  />
                  <NavigationItem
                    icon={<CalendarIcon className="w-4 h-4" />}
                    label="Bacenta Meetings"
                    isActive={currentTab.id === TabKeys.BACENTA_MEETINGS}
                    onClick={() => {
                      switchTab({ id: TabKeys.BACENTA_MEETINGS, name: 'Bacenta Meetings' });
                      onClose();
                    }}
                  />
                  <NavigationItem
                    icon={<CakeIcon className="w-4 h-4" />}
                    label="Birthdays"
                    isActive={currentTab.id === TabKeys.BIRTHDAYS}
                    badge={upcomingBirthdaysCount > 0 ? upcomingBirthdaysCount : undefined}
                    onClick={() => {
                      switchTab({ id: TabKeys.BIRTHDAYS, name: 'Birthdays' });
                      onClose();
                    }}
                  />
                  <NavigationItem
                    icon={<CogIcon className="w-4 h-4" />}
                    label="Ministry Sync Test"
                    isActive={currentTab.id === TabKeys.MINISTRY_SYNC_TEST}
                    onClick={() => {
                      switchTab({ id: TabKeys.MINISTRY_SYNC_TEST, name: 'Ministry Sync Test' });
                      onClose();
                    }}
                  />
                </>
              ) : (
                <>
                  <NavigationItem
                    icon={<BuildingOfficeIcon className="w-4 h-4" />}
                    label="All Bacenta Leaders"
                    isActive={currentTab.id === TabKeys.ALL_BACENTAS}
                    onClick={() => {
                      switchTab({ id: TabKeys.ALL_BACENTAS, name: 'All Bacenta Leaders' });
                      onClose();
                    }}
                  />

                  <NavigationItem
                    icon={<UsersIcon className="w-4 h-4" />}
                    label="Sons of God"
                    isActive={currentTab.id === TabKeys.NEW_BELIEVERS}
                    onClick={() => {
                      switchTab({ id: TabKeys.NEW_BELIEVERS, name: 'New Believers' });
                      onClose();
                    }}
                  />

                  <NavigationItem
                    icon={<CalendarIcon className="w-4 h-4" />}
                    label="Bacenta Meetings"
                    isActive={currentTab.id === TabKeys.BACENTA_MEETINGS}
                    onClick={() => {
                      switchTab({ id: TabKeys.BACENTA_MEETINGS, name: 'Bacenta Meetings' });
                      onClose();
                    }}
                  />

                  <NavigationItem
                    icon={<CakeIcon className="w-4 h-4" />}
                    label="Birthdays"
                    isActive={currentTab.id === TabKeys.BIRTHDAYS}
                    badge={upcomingBirthdaysCount > 0 ? upcomingBirthdaysCount : undefined}
                    onClick={() => {
                      switchTab({ id: TabKeys.BIRTHDAYS, name: 'Birthdays' });
                      onClose();
                    }}
                  />
                </>
              )}
            </div>
          </div>

          {/* Divider */}
          {!isMinistryContext && <div className="border-t border-gray-200 dark:border-dark-600"></div>}

          {/* Add New Bacenta Button (hidden in Ministry mode) */}
          {!isMinistryContext && (
            <button
              onClick={handleAddBacenta}
              className="w-full flex items-center justify-center space-x-1.5 sm:space-x-2 p-3 sm:p-4 bg-slate-600 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md border border-slate-500 dark:border-slate-600"
            >
              <PlusCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base truncate">Create New Bacenta</span>
            </button>
          )}

          {/* Recent Bacentas (hidden in Ministry mode) */}
          {!isMinistryContext && !searchQuery && validRecentBacentas.length > 0 && (
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-dark-400 mb-2 sm:mb-3 flex items-center">
                <ClockIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                <span className="truncate">Recent</span>
              </h3>
              <div className="space-y-1.5 sm:space-y-2">
                {validRecentBacentas.map((bacenta) => (
                  <BacentaItem
                    key={`recent-${bacenta.id}`}
                    bacenta={bacenta}
                    memberCount={getMemberCount(bacenta.id)}
                    isActive={currentTab.id === bacenta.id}
                    onClick={() => handleBacentaClick(bacenta)}
                    onEdit={(e) => handleEditBacenta(e, bacenta)}
                    onDelete={(e) => handleDeleteBacenta(e, bacenta.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Bacentas (hidden in Ministry mode) */}
          {!isMinistryContext && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2 sm:mb-3 flex-shrink-0 min-w-0">
                <h3 className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-dark-400 flex items-center min-w-0">
                  <BuildingOfficeIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5 flex-shrink-0" />
                  <span className="truncate">
                    {searchQuery ? `Search Results (${filteredBacentas.length})` : `All Bacentas (${bacentas.length})`}
                  </span>
                </h3>
                {filteredBacentas.length > 5 && (
                  <div className="text-xs text-gray-400 dark:text-dark-500 flex items-center flex-shrink-0 ml-2">
                    <span className="hidden sm:inline">Scroll for more</span>
                    <span className="sm:hidden">More</span>
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                )}
              </div>

              {filteredBacentas.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-dark-400 flex-1 flex flex-col justify-center">
                  {searchQuery ? (
                    <>
                      <SearchIcon className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-dark-500" />
                      <p className="font-medium">No bacentas found matching "{searchQuery}"</p>
                    </>
                  ) : (
                    <>
                      <BuildingOfficeIcon className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-dark-500" />
                      <p className="font-medium">No bacentas created yet</p>
                      <p className="text-sm mt-1">Create your first bacenta to get started!</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto sidebar-scroll min-h-0 relative bacentas-scroll-container" onScroll={handleScroll}>
                  {/* Scroll fade indicator - top */}
                  {canScrollUp && (
                    <div className="scroll-fade-top absolute top-0 left-0 right-0 z-10" />
                  )}

                  <div className="space-y-1.5 sm:space-y-2 pb-3 sm:pb-4">
                    {filteredBacentas.map((bacenta) => (
                      <BacentaItem
                        key={bacenta.id}
                        bacenta={bacenta}
                        memberCount={getMemberCount(bacenta.id)}
                        isActive={currentTab.id === bacenta.id}
                        onClick={() => handleBacentaClick(bacenta)}
                        onEdit={(e) => handleEditBacenta(e, bacenta)}
                        onDelete={(e) => handleDeleteBacenta(e, bacenta.id)}
                      />
                    ))}
                  </div>

                  {/* Scroll fade indicator - bottom */}
                  {canScrollDown && (
                    <div className="scroll-fade-bottom absolute bottom-0 left-0 right-0 z-10" />
                  )}
                </div>
              )}
            </div>
          )}


        </div>
      </div>
    </>
  );
};


// Bacenta Item Component
interface BacentaItemProps {
  bacenta: Bacenta;
  memberCount: number;
  isActive: boolean;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

const BacentaItem: React.FC<BacentaItemProps> = ({
  bacenta,
  memberCount,
  isActive,
  onClick,
  onEdit,
  onDelete
}) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setContextMenuPosition({ x: touch.clientX, y: touch.clientY });

    const timer = setTimeout(() => {
      setShowContextMenu(true);
      // Haptic feedback if available
      if ('vibrate' in navigator && navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500); // 500ms long press

    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setContextMenuPosition({ x: e.clientX, y: e.clientY });

    const timer = setTimeout(() => {
      setShowContextMenu(true);
    }, 500); // 500ms long press

    setLongPressTimer(timer);
  };

  const handleMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleClick = () => {
    if (!showContextMenu) {
      onClick();
    }
  };

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [longPressTimer]);

  // Close context menu when clicking outside or when modals open
  React.useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (showContextMenu) {
        // Don't close if clicking on the context menu itself
        const target = event.target as Element;
        const contextMenu = document.querySelector('.context-menu-container');
        if (contextMenu && contextMenu.contains(target)) {
          return;
        }
        setShowContextMenu(false);
      }
    };

    const handleCloseContextMenus = () => {
      setShowContextMenu(false);
    };

    if (showContextMenu) {
      // Use a small delay to avoid immediate closing
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
      }, 10);

      // Cleanup timeout if component unmounts
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
        window.removeEventListener('closeContextMenus', handleCloseContextMenus);
      };
    }

    // Listen for custom event to close context menus
    window.addEventListener('closeContextMenus', handleCloseContextMenus);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('closeContextMenus', handleCloseContextMenus);
    };
  }, [showContextMenu]);

  return (
    <>
      <div
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`group relative p-2.5 sm:p-3 rounded-lg cursor-pointer transition-all duration-200 select-none ${
          isActive
            ? 'bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-600 border-l-4 border-l-amber-600 dark:border-l-amber-400 shadow-sm'
            : 'bg-gray-50 dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600 border border-gray-200 dark:border-dark-600 border-l-4 border-l-transparent hover:border-l-amber-500 dark:hover:border-l-amber-500 shadow-sm'
        } ${showContextMenu ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-400 dark:border-amber-500' : ''}`}
      >
      <div className="flex items-center justify-between min-w-0">
        <div className="flex-1 min-w-0 pr-2">
          <h4 className={`font-medium truncate text-sm sm:text-base ${isActive ? 'text-amber-900 dark:text-amber-100' : 'text-gray-800 dark:text-dark-100'} transition-colors duration-200`}>
            {bacenta.name}
          </h4>
          <div className={`flex items-center mt-0.5 sm:mt-1 text-xs sm:text-sm ${isActive ? 'text-amber-700 dark:text-amber-200' : 'text-gray-600 dark:text-dark-300'} transition-colors duration-200`}>
            <UsersIcon className="w-3 h-3 mr-1 flex-shrink-0" />
            <span className="truncate">{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
          </div>
          {/* Meeting Schedule Indicator */}
          {(bacenta.meetingDay || bacenta.meetingTime) && (
            <div className={`flex items-center mt-0.5 text-xs ${isActive ? 'text-amber-600 dark:text-amber-300' : 'text-gray-500 dark:text-dark-400'} transition-colors duration-200`}>
              <CalendarIcon className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">
                {bacenta.meetingDay && bacenta.meetingTime
                  ? `${bacenta.meetingDay} ${bacenta.meetingTime}`
                  : bacenta.meetingDay
                    ? bacenta.meetingDay
                    : bacenta.meetingTime
                }
              </span>
            </div>
          )}
        </div>

        {/* Long Press Indicator */}
        {showContextMenu && (
          <div className="w-2 h-2 bg-amber-600 dark:bg-amber-400 rounded-full animate-pulse flex-shrink-0" />
        )}
      </div>
    </div>

    {/* Context Menu */}
    {showContextMenu && (
      <div
        className="context-menu-container fixed z-50 bg-white dark:bg-dark-800 rounded-lg shadow-xl border border-gray-200 dark:border-dark-600 py-2 min-w-[160px]"
        style={{
          left: Math.min(contextMenuPosition.x, (window.innerWidth || 1024) - 180),
          top: Math.min(contextMenuPosition.y, (window.innerHeight || 768) - 120),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            console.log('📝 Context menu Edit button clicked');
            onEdit(e);
          }}
          className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors duration-200 flex items-center space-x-3"
        >
          <EditIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-dark-200">Edit Bacenta</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            console.log('🗑️ Context menu Delete button clicked');
            onDelete(e);
          }}
          className="w-full px-4 py-3 text-left hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors duration-200 flex items-center space-x-3"
        >
          <TrashIcon className="w-4 h-4 text-rose-500 dark:text-rose-400" />
          <span className="text-sm font-medium text-rose-600 dark:text-rose-300">Delete Bacenta</span>
        </button>
      </div>
    )}
  </>
  );
};

// Navigation Item Component
interface NavigationItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}

const NavigationItem: React.FC<NavigationItemProps> = ({
  icon,
  label,
  isActive,
  onClick,
  badge
}) => {
  // Get accent color based on label with improved contrast
  const getAccentColor = (label: string) => {
    switch (label) {
      case 'All Bacenta Leaders':
        return {
          active: 'bg-blue-100 dark:bg-blue-900/40 border-l-4 border-l-blue-600 dark:border-l-blue-400 shadow-sm',
          icon: 'text-blue-700 dark:text-blue-300',
          text: 'text-blue-900 dark:text-blue-100',
          hover: 'hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-l-blue-500 dark:hover:border-l-blue-500'
        };
      case 'New Believers':
        return {
          active: 'bg-emerald-100 dark:bg-emerald-900/40 border-l-4 border-l-emerald-600 dark:border-l-emerald-400 shadow-sm',
          icon: 'text-emerald-700 dark:text-emerald-300',
          text: 'text-emerald-900 dark:text-emerald-100',
          hover: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-l-emerald-500 dark:hover:border-l-emerald-500'
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

      {badge && (
        <span className="bg-rose-500 dark:bg-rose-600 text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-bold shadow-sm flex-shrink-0 ml-2">
          {badge}
        </span>
      )}
    </button>
  );
};

export default BacentaDrawer;
