
import React, { memo } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { PeopleIcon, AttendanceIcon, CalendarIcon, ChartBarIcon, ChevronRightIcon, CheckIcon } from './icons';
import { getMonthName, getCurrentOrMostRecentSunday, formatFullDate } from '../utils/dateUtils';

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
  const { members, attendanceRecords, newBelievers, bacentas, displayedSundays, displayedDate, switchTab } = useAppContext(); // Use displayedSundays

  const totalMembers = members.length;
  
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

  const weeklyAttendance = getCurrentWeekAttendance();

  const membersPerBacenta = bacentas.map(b => { // Renamed from membersPerCongregation
    const count = members.filter(m => m.bacentaId === b.id).length; // Use bacentaId
    return { id: b.id, name: b.name, count };
  });

  const monthName = getMonthName(displayedDate.getMonth());
  const year = displayedDate.getFullYear();

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8">
      {/* Enhanced Header */}
      <div className="text-center mb-4 sm:mb-6 md:mb-8">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text font-serif mb-2">
          Dashboard
        </h2>
        <div className="flex items-center justify-center space-x-2 text-gray-600">
          <span className="text-lg sm:text-xl md:text-2xl">📊</span>
          <p className="text-sm sm:text-base md:text-lg font-medium">{monthName} {year}</p>
          <span className="text-lg sm:text-xl md:text-2xl">⛪</span>
        </div>
        <div className="w-16 sm:w-20 md:w-24 h-0.5 sm:h-1 bg-gradient-to-r from-gray-400 to-gray-600 rounded-full mx-auto mt-2 sm:mt-3"></div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
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
        <StatCard
          title="Sunday Confirmations"
          value={0}
          icon={<CheckIcon className="w-full h-full" />}
          colorClass="border-purple-500"
          description="Coming Soon"
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
      <div className="glass p-4 sm:p-6 md:p-8 shadow-lg rounded-xl sm:rounded-2xl">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
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

export default DashboardView;
