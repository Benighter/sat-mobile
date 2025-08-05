
import React, { memo, useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { hasAdminPrivileges } from '../../utils/permissionUtils';
import { PeopleIcon, AttendanceIcon, CalendarIcon, ChartBarIcon, ChevronRightIcon, CheckIcon } from '../icons';
import { getMonthName, getCurrentOrMostRecentSunday, formatFullDate, getUpcomingSunday } from '../../utils/dateUtils';
import { db } from '../../firebase.config';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseUtils } from '../../services/firebaseService';

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
    className={`p-3 sm:p-4 md:p-6 shadow-lg rounded-xl sm:rounded-2xl border-l-4 ${colorClass} relative min-h-[120px] sm:min-h-[140px] md:h-40 flex flex-col justify-between ${
      onClick ? 'cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300' : ''
    }`}
    onClick={onClick}
  >
    {/* Header with title and icon */}
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-dark-300 uppercase tracking-wider mb-2 sm:mb-3">{title}</p>
      </div>
      <div className="text-gray-400 dark:text-dark-400 ml-2 sm:ml-4 flex-shrink-0">
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
          <div className="flex-1 max-w-12 sm:max-w-16 h-1.5 sm:h-2 bg-gray-200 dark:bg-dark-600 rounded-full overflow-hidden">
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
  const { members, attendanceRecords, newBelievers, displayedSundays, displayedDate, sundayConfirmations, guests, switchTab, user, userProfile, currentChurchId } = useAppContext(); // Use displayedSundays

  const totalMembers = members.length;
  const [confirmationTarget, setConfirmationTarget] = useState<number>(0);
  const [isLoadingTarget, setIsLoadingTarget] = useState<boolean>(true);

  // Check if current user is admin
  const isAdmin = hasAdminPrivileges(userProfile);

  // Load target from Firebase for upcoming Sunday
  useEffect(() => {
    const loadTarget = async () => {
      if (!user) {
        setIsLoadingTarget(false);
        return;
      }

      setIsLoadingTarget(true);
      try {
        const upcomingSunday = getUpcomingSunday();

        // Get the current church ID (same for admin and leaders in the same church)
        const churchId = firebaseUtils.getCurrentChurchId();
        if (!churchId) {
          console.warn('No church context available yet for dashboard, will retry when available');
          setIsLoadingTarget(false);
          return;
        }

        // Validate inputs before making Firestore request
        if (!upcomingSunday || upcomingSunday.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(upcomingSunday)) {
          console.error('Invalid upcomingSunday format:', upcomingSunday);
          setIsLoadingTarget(false);
          return;
        }

        console.log('Dashboard loading target for:', { churchId, upcomingSunday });

        // Use proper church-scoped path
        const targetDocRef = doc(db, `churches/${churchId}/sundayTargets`, upcomingSunday);
        const targetDoc = await getDoc(targetDocRef);

        if (targetDoc.exists() && targetDoc.data().target) {
          const target = targetDoc.data().target;
          setConfirmationTarget(target);
        } else {
          // Default to total member count if no target is set
          // Only use totalMembers if we actually have members loaded
          const defaultTarget = totalMembers > 0 ? totalMembers : 0;
          setConfirmationTarget(defaultTarget);
        }
      } catch (error: any) {
        console.error('Error loading confirmation target for dashboard:', {
          error: error.message,
          code: error.code,
          stack: error.stack,
          churchId: firebaseUtils.getCurrentChurchId(),
          upcomingSunday
        });

        // Check if it's an offline error
        const isOffline = error?.code === 'unavailable' ||
                         error?.message?.includes('offline') ||
                         error?.message?.includes('network') ||
                         error?.message?.includes('backend');

        if (isOffline) {
          console.log('Dashboard operating in offline mode - using cached data');
        }

        // Fallback to member count, but only if we have members loaded
        const defaultTarget = totalMembers > 0 ? totalMembers : 0;
        setConfirmationTarget(defaultTarget);
      } finally {
        setIsLoadingTarget(false);
      }
    };

    // Only load target if we have user
    if (user) {
      loadTarget();
    }
  }, [user, totalMembers, currentChurchId]); // Added totalMembers and currentChurchId as dependencies
  
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

    // Count only confirmations for existing members and guests
    let confirmedCount = 0;

    confirmationRecords.forEach(record => {
      if (record.memberId) {
        // Check if member still exists
        const memberExists = members.some(member => member.id === record.memberId);
        if (memberExists) {
          confirmedCount++;
        }
      } else if (record.guestId) {
        // Check if guest still exists
        const guestExists = guests.some(guest => guest.id === record.guestId);
        if (guestExists) {
          confirmedCount++;
        }
      }
    });

    return {
      total: confirmedCount,
      date: upcomingSunday,
      formattedDate: formatFullDate(upcomingSunday)
    };
  };

  const weeklyAttendance = getCurrentWeekAttendance();
  const upcomingConfirmations = getUpcomingSundayConfirmations();



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

      {/* Stats Grid - Utilizing full space with better layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
        <StatCard
          title="Total Members"
          value={totalMembers}
          icon={<PeopleIcon className="w-full h-full" />}
          colorClass="border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100"
          onClick={() => switchTab({ id: 'all_members', name: 'All Members' })}
        />
        <StatCard
          title="Attendance Rate"
          value={`${currentMonthAttendancePercentage()}%`}
          icon={<AttendanceIcon className="w-full h-full" />}
          colorClass="border-green-500 bg-gradient-to-br from-green-50 to-green-100"
          description={`For ${monthName}`}
          onClick={() => switchTab({ id: 'attendance_analytics', name: 'Attendance Analytics' })}
        />
        <StatCard
          title="Weekly Attendance"
          value={weeklyAttendance.total}
          icon={<CalendarIcon className="w-full h-full" />}
          colorClass="border-purple-500 bg-gradient-to-br from-purple-50 to-purple-100"
          description={`For ${formatFullDate(weeklyAttendance.date).split(',')[0]}`}
          onClick={() => switchTab({ id: 'weekly_attendance', name: 'Weekly Attendance' })}
        />
        <StatCard
          title="Outreach"
          value="Coming Soon"
          icon={<ChartBarIcon className="w-full h-full" />}
          colorClass="border-orange-500 bg-gradient-to-br from-orange-50 to-orange-100"
          description="Community outreach programs"
          onClick={() => {}}
        />
        <div className="sm:col-span-2 lg:col-span-4 xl:col-span-1">
          <EnhancedConfirmationCard
            title="Sunday Confirmations"
            confirmedCount={upcomingConfirmations.total}
            totalMembers={confirmationTarget}
            isLoadingTarget={isLoadingTarget}
            date={upcomingConfirmations.date}
            onClick={() => switchTab({ id: 'sunday_confirmations', name: 'Sunday Confirmations' })}
          />
        </div>
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
  isLoadingTarget?: boolean;
  date: string;
  onClick: () => void;
}

const EnhancedConfirmationCard: React.FC<EnhancedConfirmationCardProps> = memo(({
  title,
  confirmedCount,
  totalMembers, // This now represents the target
  isLoadingTarget = false,
  date,
  onClick
}) => {
  const percentage = !isLoadingTarget && totalMembers > 0 ? Math.round((confirmedCount / totalMembers) * 100) : 0;
  const circumference = 2 * Math.PI * 20; // radius = 20 (smaller)
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className="p-4 sm:p-6 shadow-lg rounded-xl border-l-4 border-indigo-500 bg-gradient-to-br from-indigo-50 to-indigo-100 relative min-h-[140px] md:h-40 flex flex-col justify-between cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
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
                strokeDashoffset={isLoadingTarget ? circumference : strokeDashoffset}
                className="text-indigo-500 transition-all duration-500 ease-out"
                strokeLinecap="round"
              />
            </svg>
            {/* Center percentage */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-indigo-600">
                {isLoadingTarget ? '...' : `${percentage}%`}
              </span>
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
            of {isLoadingTarget ? '...' : totalMembers}
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
