
import React from 'react';
import { useAppData } from '../hooks/useAppData';
import { PeopleIcon, AttendanceIcon, AlertIcon, ChartBarIcon, ChevronRightIcon } from './icons';
import { getMonthName } from '../utils/dateUtils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass: string;
  description?: string;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, colorClass, description, onClick }) => (
  <div
    className={`glass p-6 shadow-lg rounded-2xl border-l-4 ${colorClass} relative h-40 flex flex-col justify-between ${
      onClick ? 'cursor-pointer hover:shadow-xl transition-all duration-200' : ''
    }`}
    onClick={onClick}
  >
    {/* Header with title and icon */}
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-600 uppercase tracking-wider mb-3">{title}</p>
      </div>
      <div className="text-gray-400 ml-4">
        {icon}
      </div>
    </div>

    {/* Value section */}
    <div className="flex-1 flex flex-col justify-center">
      <div className="flex items-center space-x-3">
        <p className="text-4xl font-bold gradient-text">{value}</p>
        {title === "Attendance Rate" && (
          <div className="flex-1 max-w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
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
      {description && <p className="text-sm text-gray-500 font-medium">{description}</p>}
    </div>
  </div>
);


const DashboardView: React.FC = () => {
  const { members, attendanceRecords, criticalMemberIds, bacentas, displayedSundays, displayedDate, changeTab } = useAppData(); // Use displayedSundays

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

  const membersPerBacenta = bacentas.map(b => { // Renamed from membersPerCongregation
    const count = members.filter(m => m.bacentaId === b.id).length; // Use bacentaId
    return { id: b.id, name: b.name, count };
  });

  const monthName = getMonthName(displayedDate.getMonth());
  const year = displayedDate.getFullYear();

  return (
    <div className="space-y-8">
      {/* Enhanced Header */}
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold gradient-text font-serif mb-2">
          Dashboard
        </h2>
        <div className="flex items-center justify-center space-x-2 text-gray-600">
          <span className="text-2xl">📊</span>
          <p className="text-lg font-medium">{monthName} {year}</p>
          <span className="text-2xl">⛪</span>
        </div>
        <div className="w-24 h-1 bg-gradient-to-r from-gray-400 to-gray-600 rounded-full mx-auto mt-3"></div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Total Members"
          value={totalMembers}
          icon={<PeopleIcon className="w-12 h-12" />}
          colorClass="border-gray-500"
          onClick={() => changeTab('all_members')}
        />
        <StatCard
          title="Attendance Rate"
          value={`${currentMonthAttendancePercentage()}%`}
          icon={<AttendanceIcon className="w-12 h-12" />}
          colorClass="border-blue-500"
          description={`For ${monthName}`}
          onClick={() => changeTab('attendance_analytics')}
        />
        <StatCard
          title="Critical Alerts"
          value={criticalMemberIds.length}
          icon={<AlertIcon className="w-12 h-12" />}
          colorClass="border-red-500"
          description="Members needing follow-up"
          onClick={() => changeTab('critical_members')}
        />
      </div>

      {/* Enhanced Members per Bacenta Section */}
      <div className="glass p-8 shadow-lg rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold gradient-text flex items-center">
            <ChartBarIcon className="w-8 h-8 mr-3 text-gray-600" />
            Members per Bacenta
          </h3>
          <div className="text-sm text-gray-500 bg-white/50 px-3 py-1 rounded-full">
            {membersPerBacenta.length} Bacentas
          </div>
        </div>

        {membersPerBacenta.length > 0 ? (
          <div className="space-y-4">
            {membersPerBacenta.map((item) => (
              <div
                key={item.id}
                onClick={() => changeTab(item.id)}
                className="flex justify-between items-center p-4 glass rounded-xl cursor-pointer hover:shadow-xl transition-all duration-200 group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-gray-500 to-gray-600 group-hover:from-blue-500 group-hover:to-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg transition-all duration-200">
                    {item.name.charAt(0)}
                  </div>
                  <span className="font-semibold text-gray-700 group-hover:text-blue-700 transition-colors duration-200">
                    {item.name}
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  {/* Progress bar */}
                  <div className="w-20 h-2 bg-gray-200 group-hover:bg-blue-100 rounded-full overflow-hidden transition-colors duration-200">
                    <div
                      className="h-full bg-gradient-to-r from-gray-400 to-gray-600 group-hover:from-blue-400 group-hover:to-blue-600 rounded-full transition-all duration-200"
                      style={{
                        width: `${totalMembers > 0 ? (item.count / totalMembers) * 100 : 0}%`
                      }}
                    ></div>
                  </div>

                  {/* Count badge */}
                  <span className="font-bold text-gray-700 group-hover:text-blue-700 bg-gray-100 group-hover:bg-blue-50 px-3 py-1 rounded-full text-sm shadow-sm transition-all duration-200">
                    {item.count}
                  </span>

                  {/* Clickable indicator */}
                  <ChevronRightIcon className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors duration-200" />
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
};

export default DashboardView;
