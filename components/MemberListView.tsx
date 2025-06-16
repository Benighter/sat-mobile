
import React, { useState, useMemo } from 'react';
import { useAppData } from '../hooks/useAppData';
import MemberCard from './MemberCard';
import { LoadingSpinnerIcon, SearchIcon, UsersIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from './icons'; // Added Calendar, Chevron icons
import Input from './ui/Input';
import Button from './ui/Button';
import { getMonthName } from '../utils/dateUtils';


interface MemberListViewProps {
  bacentaFilter: string | null; 
}

const MemberListView: React.FC<MemberListViewProps> = ({ bacentaFilter }) => {
  const { 
    members, 
    isLoading, 
    criticalMemberIds, 
    bacentas, 
    currentTab,
    displayedDate, // For month navigation
    navigateToPreviousMonth, // For month navigation
    navigateToNextMonth, // For month navigation
  } = useAppData();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMembers = useMemo(() => {
    return members
      .filter(member => {
        if (bacentaFilter && member.bacentaId !== bacentaFilter) {
          return false;
        }
        if (searchTerm) {
          const lowerSearchTerm = searchTerm.toLowerCase();
          return (
            member.firstName.toLowerCase().includes(lowerSearchTerm) ||
            member.lastName.toLowerCase().includes(lowerSearchTerm) ||
            member.phoneNumber.toLowerCase().includes(lowerSearchTerm) ||
            (member.bacentaId && bacentas.find(b => b.id === member.bacentaId)?.name.toLowerCase().includes(lowerSearchTerm)) || // Search by Bacenta name
            member.buildingAddress.toLowerCase().includes(lowerSearchTerm)
          );
        }
        return true;
      })
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  }, [members, bacentaFilter, searchTerm, bacentas]);

  if (isLoading && !members.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <LoadingSpinnerIcon className="w-10 h-10 text-blue-500" />
        <p className="mt-2 text-gray-500">Loading members...</p>
      </div>
    );
  }
  
  const currentMonthName = getMonthName(displayedDate.getMonth());
  const currentYear = displayedDate.getFullYear();

  return (
    <div className="animate-fade-in">
      {/* Enhanced Header */}
      <div className="mb-8 glass p-6 shadow-2xl rounded-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
          <div className="text-center sm:text-left">
            <h2 className="text-3xl font-bold gradient-text flex items-center justify-center sm:justify-start font-serif">
              <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl flex items-center justify-center mr-3 floating">
                <UsersIcon className="w-6 h-6 text-white" />
              </div>
              {currentTab.name}
            </h2>
            <div className="flex items-center justify-center sm:justify-start space-x-2 mt-2">
              <span className="text-2xl">👥</span>
              <p className="text-lg font-medium text-gray-600">{filteredMembers.length} member(s) found</p>
            </div>
          </div>

          {/* Enhanced Search */}
          <div className="mt-4 sm:mt-0 w-full sm:w-auto sm:max-w-sm">
            <div className="relative group">
              <Input
                type="text"
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-4 py-3 glass border-0 rounded-xl text-gray-700 placeholder-gray-500 focus:ring-2 focus:ring-gray-500/50 transition-all duration-200"
                wrapperClassName="relative mb-0"
                aria-label="Search members"
              />
              <SearchIcon className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 transform -translate-y-1/2 group-hover:scale-110 transition-transform" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Enhanced Month Navigation */}
        <div className="mt-6 pt-6 border-t border-white/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center">
                <CalendarIcon className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold gradient-text">Attendance Period</h3>
                <p className="text-sm text-gray-600">{currentMonthName} {currentYear}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={navigateToPreviousMonth}
                className="group flex items-center space-x-2 px-4 py-2 glass hover:bg-white/20 rounded-xl transition-all duration-200 hover:scale-105"
                aria-label="Previous month for attendance"
              >
                <ChevronLeftIcon className="w-5 h-5 text-gray-600 group-hover:-translate-x-1 transition-transform" />
                <span className="hidden sm:inline font-medium text-gray-700">Previous</span>
              </button>
              <button
                onClick={navigateToNextMonth}
                className="group flex items-center space-x-2 px-4 py-2 glass hover:bg-white/20 rounded-xl transition-all duration-200 hover:scale-105"
                aria-label="Next month for attendance"
              >
                <span className="hidden sm:inline font-medium text-gray-700">Next</span>
                <ChevronRightIcon className="w-5 h-5 text-gray-600 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
          <div className="bg-gradient-to-r from-gray-100 to-gray-200 p-3 rounded-xl">
            <p className="text-sm text-gray-700 text-center">
              📊 Attendance data shown for <span className="font-semibold">{currentMonthName} {currentYear}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Enhanced Empty State */}
      {filteredMembers.length === 0 && !isLoading && (
        <div className="glass p-12 rounded-2xl text-center shadow-2xl animate-fade-in">
          <div className="w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6 floating">
            <UsersIcon className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-2xl font-bold gradient-text mb-3">No Members Found</h3>
          {searchTerm && (
            <div className="space-y-2">
              <p className="text-gray-600">No results for "<span className="font-semibold text-primary-600">{searchTerm}</span>"</p>
              <p className="text-sm text-gray-500">Try adjusting your search terms</p>
            </div>
          )}
          {!bacentaFilter && !searchTerm && (
            <div className="space-y-2">
              <p className="text-gray-600">Ready to build your community?</p>
              <p className="text-sm text-gray-500">Add your first member using the floating action button</p>
            </div>
          )}
          {bacentaFilter && !searchTerm && (
            <div className="space-y-2">
              <p className="text-gray-600">This Bacenta is waiting for members</p>
              <p className="text-sm text-gray-500">Add members to get started with attendance tracking</p>
            </div>
          )}
        </div>
      )}

      {/* Enhanced Member List */}
      <div className="space-y-6">
        {filteredMembers.map((member, index) => (
          <div
            key={member.id}
            className="animate-fade-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <MemberCard
              member={member}
              isCritical={criticalMemberIds.includes(member.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MemberListView;
