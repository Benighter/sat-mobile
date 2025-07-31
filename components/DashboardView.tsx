
import React, { memo, useState, useEffect } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { hasAdminPrivileges } from '../utils/permissionUtils';
import { PeopleIcon, AttendanceIcon, CalendarIcon, ChartBarIcon, ChevronRightIcon, CheckIcon } from './icons';
import { getMonthName, getCurrentOrMostRecentSunday, formatFullDate, getUpcomingSunday } from '../utils/dateUtils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass: string;
  description?: string;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = memo(({ title, value, icon, colorClass, description, onClick }) => (
  <div
    className={`glass p-3 sm:p-4 md:p-6 shadow-lg rounded-xl sm:rounded-2xl border-l-4 ${colorClass} relative min-h-[120px] sm:min-h-[140px] md:h-40 flex flex-col justify-between ${
      onClick ? 'cursor-pointer hover:shadow-xl transition-all duration-200' : ''
    }`}
    onClick={onClick}
  >
    {/* Header with title and icon */}
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-xs sm:text-sm font-medium text-gray-600 uppercase tracking-wider mb-2 sm:mb-3">{title}</p>
      </div>
      <div className="text-gray-400 ml-2 sm:ml-4 flex-shrink-0">
        <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-12 md:h-12">
          {icon}
        </div>
      </div>
    </div>

    {/* Value section */}
    <div className="flex-1 flex flex-col justify-center">
      <div className="flex items-center space-x-2 sm:space-x-3">
        <p className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text">{value}</p>
        {title === "Attendance Rate" && (
          <div className="flex-1 max-w-12 sm:max-w-16 h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
              style={{ width: `${typeof value === 'string' ? parseInt(value) : 0}%` }}
            ></div>
          </div>
        )}
      </div>
    </div>

    {/* Description section */}
    <div>
      {description && <p className="text-xs sm:text-sm text-gray-500 font-medium">{description}</p>}
    </div>
  </div>
));


const DashboardView: React.FC = memo(() => {
  const { members, attendanceRecords, newBelievers, bacentas, displayedSundays, displayedDate, sundayConfirmations, switchTab, user, userProfile } = useAppContext(); // Use displayedSundays

  const totalMembers = members.length;
  const [confirmationTarget, setConfirmationTarget] = useState<number>(totalMembers);

  // Check if current user is admin
  const isAdmin = hasAdminPrivileges(userProfile);

  // Load target from Firebase for upcoming Sunday
  useEffect(() => {
    const loadTarget = async () => {
      if (!user) return;

      try {
        const upcomingSunday = getUpcomingSunday();
        const { db } = await import('../firebase.config');
        const { doc, getDoc } = await import('firebase/firestore');
        const { firebaseUtils } = await import('../services/firebaseService');

        // Get the current church ID (same for admin and leaders in the same church)
        const churchId = firebaseUtils.getCurrentChurchId();
        if (!churchId) {
          throw new Error('No church context available');
        }

        // Use proper church-scoped path
        const targetDocRef = doc(db, `churches/${churchId}/sundayTargets`, upcomingSunday);
        const targetDoc = await getDoc(targetDocRef);

        if (targetDoc.exists() && targetDoc.data().target) {
          const target = targetDoc.data().target;
          setConfirmationTarget(target);
        } else {
          // Default to total member count if no target is set
          setConfirmationTarget(totalMembers);
        }
      } catch (error) {
        console.error('Error loading confirmation target for dashboard:', error);
        // Fallback to member count
        setConfirmationTarget(totalMembers);
      }
    };

    loadTarget();
  }, [user, totalMembers]);
  
  const currentMonthAttendancePercentage = () => {
    if (!displayedSundays.length || !members.length) return 0;

    let totalPossibleAttendances = members.length * displayedSundays.length;
    let actualPresents = 0;

    displayedSundays.forEach(sunday => {
      members.forEach(member => {
        const record = attendanceRecords.find(ar => ar.memberId === member.id && ar.date === sunday);
        if (record && record.status === 'Present') {
          actualPresents++;
        }
      });
    });

    return totalPossibleAttendances > 0 ? Math.round((actualPresents / totalPossibleAttendances) * 100) : 0;
  };

  // Calculate current week's attendance
  const getCurrentWeekAttendance = () => {
    const currentSunday = getCurrentOrMostRecentSunday();

    // Get all attendance records for the current Sunday
    const sundayRecords = attendanceRecords.filter(
      record => record.date === currentSunday && record.status === 'Present'
    );

    // Get present member IDs and new believer IDs
    const presentMemberIds = sundayRecords
      .filter(record => record.memberId)
      .map(record => record.memberId!);

    const presentNewBelieverIds = sundayRecords
      .filter(record => record.newBelieverId)
      .map(record => record.newBelieverId!);

    // Filter to only include members and new believers that actually exist
    // This prevents counting orphaned attendance records for deleted members
    const presentMembers = members.filter(member => presentMemberIds.includes(member.id));
    const presentNewBelievers = newBelievers.filter(nb => presentNewBelieverIds.includes(nb.id));

    const totalPresent = presentMembers.length + presentNewBelievers.length;

    return {
      total: totalPresent,
      date: currentSunday,
      formattedDate: formatFullDate(currentSunday)
    };
  };

  // Calculate upcoming Sunday confirmations
  const getUpcomingSundayConfirmations = () => {
    const upcomingSunday = getUpcomingSunday();

    // Get all confirmation records for the upcoming Sunday
    const confirmationRecords = sundayConfirmations.filter(
      record => record.date === upcomingSunday && record.status === 'Confirmed'
    );

    const confirmedCount = confirmationRecords.length;

    return {
      total: confirmedCount,
      date: upcomingSunday,
      formattedDate: formatFullDate(upcomingSunday)
    };
  };

  const weeklyAttendance = getCurrentWeekAttendance();
  const upcomingConfirmations = getUpcomingSundayConfirmations();

  const membersPerBacenta = bacentas.map(b => { // Renamed from membersPerCongregation
    const count = members.filter(m => m.bacentaId === b.id).length; // Use bacentaId
    return { id: b.id, name: b.name, count };
  });

  const monthName = getMonthName(displayedDate.getMonth());
  const year = displayedDate.getFullYear();

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-5">
      {/* Enhanced Header */}
      <div className="text-center mb-2 sm:mb-3 md:mb-4">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text font-serif mb-1">
          Dashboard
        </h2>
        <div className="flex items-center justify-center space-x-2 text-gray-600">
          <span className="text-lg sm:text-xl md:text-2xl">📊</span>
          <p className="text-sm sm:text-base md:text-lg font-medium">{monthName} {year}</p>
          <span className="text-lg sm:text-xl md:text-2xl">⛪</span>
        </div>
        <div className="w-16 sm:w-20 md:w-24 h-0.5 sm:h-1 bg-gradient-to-r from-gray-400 to-gray-600 rounded-full mx-auto mt-1 sm:mt-2"></div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
        <StatCard
          title="Total Members"
          value={totalMembers}
          icon={<PeopleIcon className="w-full h-full" />}
          colorClass="border-gray-500"
          onClick={() => switchTab({ id: 'all_members', name: 'All Members' })}
        />
        <StatCard
          title="Attendance Rate"
          value={`${currentMonthAttendancePercentage()}%`}
          icon={<AttendanceIcon className="w-full h-full" />}
          colorClass="border-blue-500"
          description={`For ${monthName}`}
          onClick={() => switchTab({ id: 'attendance_analytics', name: 'Attendance Analytics' })}
        />
        <EnhancedConfirmationCard
          title="Sunday Confirmations"
          confirmedCount={upcomingConfirmations.total}
          totalMembers={confirmationTarget}
          date={upcomingConfirmations.date}
          onClick={() => switchTab({ id: 'sunday_confirmations', name: 'Sunday Confirmations' })}
        />
        <StatCard
          title="Weekly Attendance"
          value={weeklyAttendance.total}
          icon={<CalendarIcon className="w-full h-full" />}
          colorClass="border-green-500"
          description={`For ${formatFullDate(weeklyAttendance.date).split(',')[0]}`}
          onClick={() => switchTab({ id: 'weekly_attendance', name: 'Weekly Attendance' })}
        />
      </div>

      {/* Enhanced Members per Bacenta Section */}
      <div className="glass p-3 sm:p-4 md:p-5 shadow-lg rounded-xl sm:rounded-2xl">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold gradient-text flex items-center">
            <ChartBarIcon className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 mr-2 sm:mr-3 text-gray-600" />
            <span className="hidden sm:inline">Members per Bacenta</span>
            <span className="sm:hidden">Bacentas</span>
          </h3>
          <div className="text-xs sm:text-sm text-gray-500 bg-white/50 px-2 sm:px-3 py-1 rounded-full">
            {membersPerBacenta.length} Bacentas
          </div>
        </div>

        {membersPerBacenta.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {membersPerBacenta.map((item) => (
              <div
                key={item.id}
                onClick={() => switchTab({ id: item.id, name: item.name })}
                className="flex justify-between items-center p-3 sm:p-4 glass rounded-xl cursor-pointer hover:shadow-xl transition-all duration-200 group"
              >
                <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-gray-500 to-gray-600 group-hover:from-blue-500 group-hover:to-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-bold shadow-lg transition-all duration-200 flex-shrink-0">
                    <span className="text-sm sm:text-base">{item.name.charAt(0)}</span>
                  </div>
                  <span className="font-semibold text-sm sm:text-base text-gray-700 group-hover:text-blue-700 transition-colors duration-200 truncate">
                    {item.name}
                  </span>
                </div>

                <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
                  {/* Progress bar - hidden on very small screens */}
                  <div className="hidden sm:block w-16 md:w-20 h-1.5 md:h-2 bg-gray-200 group-hover:bg-blue-100 rounded-full overflow-hidden transition-colors duration-200">
                    <div
                      className="h-full bg-gradient-to-r from-gray-400 to-gray-600 group-hover:from-blue-400 group-hover:to-blue-600 rounded-full transition-all duration-200"
                      style={{
                        width: `${totalMembers > 0 ? (item.count / totalMembers) * 100 : 0}%`
                      }}
                    ></div>
                  </div>

                  {/* Count badge */}
                  <span className="font-bold text-gray-700 group-hover:text-blue-700 bg-gray-100 group-hover:bg-blue-50 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm shadow-sm transition-all duration-200">
                    {item.count}
                  </span>

                  {/* Clickable indicator */}
                  <ChevronRightIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-blue-500 transition-colors duration-200" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🏛️</span>
            </div>
            <p className="text-gray-500 text-lg font-medium mb-2">No Bacentas Yet</p>
            <p className="text-gray-400 text-sm">Create your first Bacenta to get started</p>
          </div>
        )}
      </div>
    </div>
  );
});

DashboardView.displayName = 'DashboardView';

// Clean Confirmation Card Component
interface EnhancedConfirmationCardProps {
  title: string;
  confirmedCount: number;
  totalMembers: number; // This now represents the target, keeping same name for compatibility
  date: string;
  onClick: () => void;
}

const EnhancedConfirmationCard: React.FC<EnhancedConfirmationCardProps> = memo(({
  title,
  confirmedCount,
  totalMembers, // This now represents the target
  date,
  onClick
}) => {
  const percentage = totalMembers > 0 ? Math.round((confirmedCount / totalMembers) * 100) : 0;
  const circumference = 2 * Math.PI * 20; // radius = 20 (smaller)
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className="glass p-4 sm:p-6 shadow-sm rounded-xl border-l-4 border-green-500 relative min-h-[140px] md:h-40 flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow duration-200"
      onClick={onClick}
    >
      {/* Header with title and progress ring */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs sm:text-sm font-medium text-gray-600 uppercase tracking-wider mb-2 sm:mb-3">{title}</p>
        </div>
        <div className="ml-4 flex-shrink-0 relative">
          {/* Smaller Progress Ring */}
          <div className="relative w-10 h-10">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 50 50">
              {/* Background circle */}
              <circle
                cx="25"
                cy="25"
                r="20"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-gray-200"
              />
              {/* Progress circle */}
              <circle
                cx="25"
                cy="25"
                r="20"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="text-green-500 transition-all duration-500 ease-out"
                strokeLinecap="round"
              />
            </svg>
            {/* Center percentage */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-green-600">{percentage}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Value section */}
      <div>
        <div className="flex items-baseline space-x-2 mb-2">
          <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
            {confirmedCount}
          </span>
          <span className="text-sm text-gray-500 font-medium">
            of {totalMembers}
          </span>
        </div>
        <p className="text-xs sm:text-sm text-gray-500 font-medium">
          For {formatFullDate(date).split(',')[0]}
        </p>
      </div>
    </div>
  );
});

EnhancedConfirmationCard.displayName = 'EnhancedConfirmationCard';

export default DashboardView;
