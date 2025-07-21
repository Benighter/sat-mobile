import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { Bacenta, TabKeys } from '../types';
import {
  XMarkIcon,
  SearchIcon,
  GroupIcon,
  EditIcon,
  TrashIcon,
  PlusCircleIcon,
  UsersIcon,
  ClockIcon,
  ChartBarIcon,
  WarningIcon,
  UserIcon
} from './icons';

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
    userProfile,
    user,
    showToast,
    showConfirmation,
    refreshUserProfile
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

  // Get member count for each bacenta
  const getMemberCount = (bacentaId: string) => {
    return members.filter(m => m.bacentaId === bacentaId).length;
  };

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
      <div className={`fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl z-50 transform transition-all duration-300 ease-out ${
        isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full shadow-none'
      } border-r border-gray-200/50 flex flex-col`}>
        
        {/* Header */}
        <div className="glass-card border-b border-gray-200/50 p-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
              <ChartBarIcon className="w-6 h-6 mr-2 text-blue-600" />
              Navigation
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
              aria-label="Close drawer"
            >
              <XMarkIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          
          {/* Search Input */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search bacentas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto sidebar-scroll p-4 space-y-6 min-h-0">

          {/* Main Navigation */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center">
              <ChartBarIcon className="w-4 h-4 mr-1" />
              Navigation
            </h3>
            <div className="space-y-2">
              <NavigationItem
                icon={<GroupIcon className="w-4 h-4" />}
                label="All Bacenta Leaders"
                isActive={currentTab.id === TabKeys.ALL_BACENTAS}
                onClick={() => {
                  switchTab({ id: TabKeys.ALL_BACENTAS, name: 'All Bacenta Leaders' });
                  onClose();
                }}
              />

              <NavigationItem
                icon={<UsersIcon className="w-4 h-4" />}
                label="New Believers"
                isActive={currentTab.id === TabKeys.NEW_BELIEVERS}
                onClick={() => {
                  switchTab({ id: TabKeys.NEW_BELIEVERS, name: 'New Believers' });
                  onClose();
                }}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200"></div>

          {/* Add New Bacenta Button */}
          <button
            onClick={handleAddBacenta}
            className="w-full flex items-center justify-center space-x-2 p-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <PlusCircleIcon className="w-5 h-5" />
            <span className="font-semibold">Create New Bacenta</span>
          </button>

          {/* Recent Bacentas */}
          {!searchQuery && validRecentBacentas.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center">
                <ClockIcon className="w-4 h-4 mr-1" />
                Recent
              </h3>
              <div className="space-y-2">
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

          {/* All Bacentas */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-600 flex items-center">
                <GroupIcon className="w-4 h-4 mr-1" />
                {searchQuery ? `Search Results (${filteredBacentas.length})` : `All Bacentas (${bacentas.length})`}
              </h3>
              {filteredBacentas.length > 5 && (
                <div className="text-xs text-gray-400 flex items-center">
                  <span>Scroll for more</span>
                  <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              )}
            </div>

            {filteredBacentas.length === 0 ? (
              <div className="text-center py-8 text-gray-500 flex-1 flex flex-col justify-center">
                {searchQuery ? (
                  <>
                    <SearchIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No bacentas found matching "{searchQuery}"</p>
                  </>
                ) : (
                  <>
                    <GroupIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No bacentas created yet</p>
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

                <div className="space-y-2 pb-4">
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
        className={`group relative p-3 rounded-xl cursor-pointer transition-all duration-200 select-none ${
          isActive
            ? 'bg-blue-50 border-2 border-blue-200 shadow-md'
            : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
        } ${showContextMenu ? 'bg-blue-100 border-blue-300' : ''}`}
      >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold truncate ${isActive ? 'text-blue-800' : 'text-gray-800'}`}>
            {bacenta.name}
          </h4>
          <div className="flex items-center mt-1 text-sm text-gray-600">
            <UsersIcon className="w-3 h-3 mr-1" />
            <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Long Press Indicator */}
        {showContextMenu && (
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        )}
      </div>

      {/* Active Indicator */}
      {isActive && (
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full" />
      )}
    </div>

    {/* Context Menu */}
    {showContextMenu && (
      <div
        className="context-menu-container fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 min-w-[160px]"
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
          className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-3"
        >
          <EditIcon className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">Edit Bacenta</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            console.log('🗑️ Context menu Delete button clicked');
            onDelete(e);
          }}
          className="w-full px-4 py-3 text-left hover:bg-red-50 transition-colors duration-200 flex items-center space-x-3"
        >
          <TrashIcon className="w-4 h-4 text-red-600" />
          <span className="text-sm font-medium text-red-700">Delete Bacenta</span>
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
  return (
    <button
      onClick={onClick}
      className={`relative w-full flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 ${
        isActive
          ? 'bg-blue-50 border-2 border-blue-200 shadow-md'
          : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
      }`}
    >
      <div className="flex items-center space-x-3">
        <div className={`${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
          {icon}
        </div>
        <span className={`font-semibold ${isActive ? 'text-blue-800' : 'text-gray-800'}`}>
          {label}
        </span>
      </div>

      {badge && (
        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
          {badge}
        </span>
      )}

      {/* Active Indicator */}
      {isActive && (
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full" />
      )}
    </button>
  );
};

export default BacentaDrawer;
