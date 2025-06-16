
import React from 'react';
import { useAppData } from '../hooks/useAppData';
import MemberCard from './MemberCard';
import { WarningIcon, LoadingSpinnerIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
import { CONSECUTIVE_ABSENCE_THRESHOLD } from '../constants';
import Button from './ui/Button';
import { getMonthName } from '../utils/dateUtils';

const CriticalMembersView: React.FC = () => {
  const { 
    members, 
    criticalMemberIds, 
    isLoading,
    displayedDate, // For month navigation
    navigateToPreviousMonth, // For month navigation
    navigateToNextMonth, // For month navigation
    displayedSundays // To check if any sundays for context
  } = useAppData();

  const criticalMembers = members.filter(member => criticalMemberIds.includes(member.id))
    .sort((a,b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

  if (isLoading && !criticalMembers.length && !displayedSundays.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
        <div className="glass p-8 rounded-3xl shadow-2xl">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <LoadingSpinnerIcon className="w-12 h-12 text-red-500" />
              <div className="absolute inset-0 w-12 h-12 border-4 border-red-200 rounded-full"></div>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-red-600">Loading Critical Alerts...</p>
              <p className="text-sm text-gray-600 mt-1">Analyzing attendance patterns</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentMonthName = getMonthName(displayedDate.getMonth());
  const currentYear = displayedDate.getFullYear();

  return (
    <div className="animate-fade-in">
      {/* Enhanced Critical Alert Header */}
      <div className="mb-8 glass p-8 shadow-2xl rounded-2xl border-l-4 border-red-500 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-50/50 to-orange-50/50 animate-pulse-slow"></div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg floating">
                <WarningIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold gradient-text font-serif">Critical Alerts</h2>
                <p className="text-sm text-gray-600">Members requiring immediate follow-up</p>
              </div>
            </div>

            {criticalMembers.length > 0 && (
              <div className="bg-red-100 text-red-700 px-4 py-2 rounded-full font-bold text-lg animate-bounce-gentle">
                {criticalMembers.length} Alert{criticalMembers.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          <div className="bg-gradient-to-r from-red-100 to-orange-100 p-4 rounded-xl">
            <p className="text-red-700 font-medium">
              {criticalMembers.length > 0
                ? `⚠️ ${criticalMembers.length} member(s) flagged with ${CONSECUTIVE_ABSENCE_THRESHOLD} or more consecutive absences in ${currentMonthName} ${currentYear}.`
                : `✅ No members flagged as critical for ${currentMonthName} ${currentYear}.`}
            </p>
          </div>
        </div>
      </div>
      
      {/* Enhanced Month Navigation */}
      <div className="mb-8 glass p-6 shadow-2xl rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold gradient-text">Analysis Period</h3>
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
            📊 Critical status based on attendance records for <span className="font-semibold">{currentMonthName} {currentYear}</span>
          </p>
        </div>
      </div>

      {/* Enhanced Empty State */}
      {criticalMembers.length === 0 && !isLoading && (
        <div className="glass p-12 rounded-2xl text-center shadow-2xl animate-fade-in">
          <div className="w-24 h-24 bg-gradient-to-br from-green-200 to-green-300 rounded-full flex items-center justify-center mx-auto mb-6 floating">
            <div className="text-4xl">🎉</div>
          </div>
          <h3 className="text-3xl font-bold gradient-text mb-4 font-serif">Excellent News!</h3>
          <div className="space-y-3">
            <p className="text-xl text-gray-700">No critical members for {currentMonthName} {currentYear}</p>
            <p className="text-gray-600">All members have maintained good attendance patterns</p>
            <div className="bg-gradient-to-r from-green-100 to-green-200 p-4 rounded-xl mt-6">
              <p className="text-green-700 font-medium">
                ✨ Keep up the great work in building a committed community!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Member List */}
      <div className="space-y-6">
        {criticalMembers.map((member, index) => (
          <div
            key={member.id}
            className="animate-fade-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <MemberCard member={member} isCritical={true} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CriticalMembersView;
