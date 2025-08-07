import React, { useMemo } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { getUpcomingBirthdays, getBirthdayStats, calculateAge } from '../../utils/birthdayUtils';
import { CakeIcon, GiftIcon, CalendarIcon, UserIcon } from '../icons';

const BirthdaysView: React.FC = () => {
  const { members, bacentas } = useAppContext();

  const upcomingBirthdays = useMemo(() => {
    return getUpcomingBirthdays(members);
  }, [members]);

  const birthdayStats = useMemo(() => {
    return getBirthdayStats(members);
  }, [members]);

  const getBacentaName = (bacentaId: string) => {
    const bacenta = bacentas.find(b => b.id === bacentaId);
    return bacenta?.name || 'Unassigned';
  };

  const ProfileAvatar = ({ member }: { member: any }) => {
    if (member.profilePicture) {
      return (
        <img
          src={member.profilePicture}
          alt={`${member.firstName} ${member.lastName || ''}`}
          className="w-12 h-12 rounded-full object-cover shadow-lg ring-2 ring-white/20"
        />
      );
    }

    const initials = `${member.firstName.charAt(0)}${(member.lastName || '').charAt(0)}`.toUpperCase();
    return (
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-lg ring-2 ring-white/20">
        <span className="text-sm">{initials}</span>
      </div>
    );
  };

  const BirthdayCard = ({ birthday }: { birthday: any }) => {
    const { member, age, daysUntil, isToday, displayDate } = birthday;
    
    return (
      <div className={`p-4 rounded-xl border-2 transition-all duration-300 hover:shadow-lg ${
        isToday 
          ? 'border-yellow-300 bg-gradient-to-r from-yellow-50 to-orange-50 shadow-md' 
          : 'border-gray-200 bg-white hover:border-blue-300'
      }`}>
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            <ProfileAvatar member={member} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {member.firstName} {member.lastName || ''}
              </h3>
              {isToday && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  <CakeIcon className="w-3 h-3 mr-1" />
                  Today!
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <CalendarIcon className="w-4 h-4" />
                <span>{displayDate}</span>
              </div>
              
              <div className="flex items-center space-x-1">
                <GiftIcon className="w-4 h-4" />
                <span>Turning {age}</span>
              </div>
              
              <div className="flex items-center space-x-1">
                <UserIcon className="w-4 h-4" />
                <span className="truncate">{getBacentaName(member.bacentaId)}</span>
              </div>
            </div>
            
            {!isToday && (
              <div className="mt-2">
                <span className="text-xs text-gray-500">
                  {daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const EmptyState = () => (
    <div className="text-center py-12">
      <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <CakeIcon className="w-12 h-12 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No Upcoming Birthdays</h3>
      <p className="text-gray-500 max-w-md mx-auto">
        There are no birthdays coming up in the current period. Check back later or add birthday information to member profiles.
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
            <CakeIcon className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Upcoming Birthdays</h1>
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Celebrate with your church family! Here are the upcoming birthdays for this month and the next 7 days.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{birthdayStats.totalMembersWithBirthdays}</p>
              <p className="text-sm text-gray-600">Members with Birthdays</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{birthdayStats.upcomingCount}</p>
              <p className="text-sm text-gray-600">Upcoming Birthdays</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <CakeIcon className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{birthdayStats.todayCount}</p>
              <p className="text-sm text-gray-600">Today's Birthdays</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <GiftIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{birthdayStats.percentageWithBirthdays}%</p>
              <p className="text-sm text-gray-600">Coverage</p>
            </div>
          </div>
        </div>
      </div>

      {/* Birthday List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {upcomingBirthdays.length > 0 ? `${upcomingBirthdays.length} Upcoming Birthday${upcomingBirthdays.length !== 1 ? 's' : ''}` : 'No Upcoming Birthdays'}
          </h2>
        </div>
        
        <div className="p-6">
          {upcomingBirthdays.length > 0 ? (
            <div className="space-y-4">
              {upcomingBirthdays.map((birthday, index) => (
                <BirthdayCard key={`${birthday.member.id}-${birthday.birthday}`} birthday={birthday} />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
};

export default BirthdaysView;
