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
  WarningIcon
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
    criticalMemberIds
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

  const handleBacentaClick = (bacenta: Bacenta) => {
    switchTab(bacenta.id);
    onClose();
  };

  const handleEditBacenta = (e: React.MouseEvent, bacenta: Bacenta) => {
    e.stopPropagation();
    openBacentaForm(bacenta);
  };

  const handleDeleteBacenta = (e: React.MouseEvent, bacentaId: string) => {
    e.stopPropagation();
    deleteBacentaHandler(bacentaId);
  };

  const handleAddBacenta = () => {
    openBacentaForm(null);
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
                icon={<ChartBarIcon className="w-4 h-4" />}
                label="Dashboard"
                isActive={currentTab.id === TabKeys.DASHBOARD}
                onClick={() => {
                  switchTab(TabKeys.DASHBOARD);
                  onClose();
                }}
              />
              <NavigationItem
                icon={<UsersIcon className="w-4 h-4" />}
                label="All Members"
                isActive={currentTab.id === TabKeys.ALL_CONGREGATIONS}
                onClick={() => {
                  switchTab(TabKeys.ALL_CONGREGATIONS);
                  onClose();
                }}
              />
              <NavigationItem
                icon={<GroupIcon className="w-4 h-4" />}
                label="All Bacentas"
                isActive={currentTab.id === TabKeys.ALL_BACENTAS}
                onClick={() => {
                  switchTab(TabKeys.ALL_BACENTAS);
                  onClose();
                }}
              />
              <NavigationItem
                icon={<WarningIcon className="w-4 h-4" />}
                label="Critical Alerts"
                isActive={currentTab.id === TabKeys.CRITICAL_MEMBERS}
                onClick={() => {
                  switchTab(TabKeys.CRITICAL_MEMBERS);
                  onClose();
                }}
                badge={criticalMemberIds.length > 0 ? criticalMemberIds.length : undefined}
              />
              <NavigationItem
                icon={<UsersIcon className="w-4 h-4" />}
                label="New Believers"
                isActive={currentTab.id === TabKeys.NEW_BELIEVERS}
                onClick={() => {
                  switchTab(TabKeys.NEW_BELIEVERS);
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
  return (
    <div
      onClick={onClick}
      className={`group relative p-3 rounded-xl cursor-pointer transition-all duration-200 ${
        isActive
          ? 'bg-blue-50 border-2 border-blue-200 shadow-md'
          : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
      }`}
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
        
        {/* Action Buttons */}
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-white rounded-lg transition-colors duration-200"
            title={`Edit ${bacenta.name}`}
          >
            <EditIcon className="w-3.5 h-3.5 text-gray-600 hover:text-blue-600" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-white rounded-lg transition-colors duration-200"
            title={`Delete ${bacenta.name}`}
          >
            <TrashIcon className="w-3.5 h-3.5 text-gray-600 hover:text-red-600" />
          </button>
        </div>
      </div>
      
      {/* Active Indicator */}
      {isActive && (
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full" />
      )}
    </div>
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
