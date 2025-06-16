import React, { useState, useMemo } from 'react';
import { useAppData } from '../hooks/useAppData';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { ChartBarIcon, CalendarIcon, UsersIcon, TrendingUpIcon, TrendingDownIcon } from './icons';
import { getMonthName } from '../utils/dateUtils';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type ViewType = 'overview' | 'monthly' | 'members' | 'bacentas';
type ChartType = 'bar' | 'line' | 'doughnut';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, colorClass, trend, trendValue }) => (
  <div className={`glass p-6 shadow-lg rounded-2xl border-l-4 ${colorClass} relative h-32 flex flex-col justify-between`}>
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-600 uppercase tracking-wider mb-2">{title}</p>
        <p className="text-3xl font-bold gradient-text">{value}</p>
      </div>
      <div className="text-gray-400">
        {icon}
      </div>
    </div>
    {trend && trendValue && (
      <div className="flex items-center space-x-1">
        {trend === 'up' ? (
          <TrendingUpIcon className="w-4 h-4 text-green-500" />
        ) : trend === 'down' ? (
          <TrendingDownIcon className="w-4 h-4 text-red-500" />
        ) : null}
        <span className={`text-sm font-medium ${
          trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'
        }`}>
          {trendValue}
        </span>
      </div>
    )}
  </div>
);

const AttendanceAnalyticsView: React.FC = () => {
  const { members, attendanceRecords, bacentas, displayedDate } = useAppData();
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  const [chartType, setChartType] = useState<ChartType>('bar');

  // Calculate analytics data
  const analyticsData = useMemo(() => {
    const currentMonth = displayedDate.getMonth();
    const currentYear = displayedDate.getFullYear();
    
    // Get all Sundays for the current month
    const getSundaysInMonth = (year: number, month: number) => {
      const sundays = [];
      const date = new Date(year, month, 1);
      while (date.getMonth() === month) {
        if (date.getDay() === 0) {
          sundays.push(new Date(date));
        }
        date.setDate(date.getDate() + 1);
      }
      return sundays;
    };

    const currentMonthSundays = getSundaysInMonth(currentYear, currentMonth);
    
    // Overall attendance rate
    const totalPossibleAttendances = members.length * currentMonthSundays.length;
    const actualAttendances = attendanceRecords.filter(record => 
      record.status === 'Present' && 
      currentMonthSundays.some(sunday => 
        sunday.toISOString().split('T')[0] === record.date
      )
    ).length;
    
    const overallRate = totalPossibleAttendances > 0 ? 
      Math.round((actualAttendances / totalPossibleAttendances) * 100) : 0;

    // Weekly attendance data
    const weeklyData = currentMonthSundays.map(sunday => {
      const dateStr = sunday.toISOString().split('T')[0];
      const dayAttendance = attendanceRecords.filter(record => 
        record.date === dateStr && record.status === 'Present'
      ).length;
      return {
        date: dateStr,
        attendance: dayAttendance,
        label: `${sunday.getDate()}/${sunday.getMonth() + 1}`
      };
    });

    // Member attendance patterns
    const memberStats = members.map(member => {
      const memberAttendance = attendanceRecords.filter(record => 
        record.memberId === member.id && 
        record.status === 'Present' &&
        currentMonthSundays.some(sunday => 
          sunday.toISOString().split('T')[0] === record.date
        )
      ).length;
      
      const attendanceRate = currentMonthSundays.length > 0 ? 
        Math.round((memberAttendance / currentMonthSundays.length) * 100) : 0;
      
      return {
        ...member,
        attendanceCount: memberAttendance,
        attendanceRate
      };
    });

    // Bacenta attendance data
    const bacentaStats = bacentas.map(bacenta => {
      const bacentaMembers = members.filter(m => m.bacentaId === bacenta.id);
      const totalPossible = bacentaMembers.length * currentMonthSundays.length;
      const actualPresent = attendanceRecords.filter(record => 
        record.status === 'Present' &&
        bacentaMembers.some(m => m.id === record.memberId) &&
        currentMonthSundays.some(sunday => 
          sunday.toISOString().split('T')[0] === record.date
        )
      ).length;
      
      const rate = totalPossible > 0 ? Math.round((actualPresent / totalPossible) * 100) : 0;
      
      return {
        ...bacenta,
        memberCount: bacentaMembers.length,
        attendanceRate: rate,
        totalAttendances: actualPresent
      };
    });

    return {
      overallRate,
      totalMembers: members.length,
      totalServices: currentMonthSundays.length,
      weeklyData,
      memberStats: memberStats.sort((a, b) => b.attendanceRate - a.attendanceRate),
      bacentaStats: bacentaStats.sort((a, b) => b.attendanceRate - a.attendanceRate),
      highAttendanceMembers: memberStats.filter(m => m.attendanceRate >= 80).length,
      lowAttendanceMembers: memberStats.filter(m => m.attendanceRate < 50).length,
    };
  }, [members, attendanceRecords, bacentas, displayedDate]);

  // Chart configurations
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            family: 'Inter, system-ui, sans-serif',
            size: 12,
          },
          color: '#6B7280',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#374151',
        bodyColor: '#6B7280',
        borderColor: '#E5E7EB',
        borderWidth: 1,
        cornerRadius: 8,
        titleFont: {
          family: 'Inter, system-ui, sans-serif',
          size: 14,
          weight: '600',
        },
        bodyFont: {
          family: 'Inter, system-ui, sans-serif',
          size: 12,
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: '#F3F4F6',
        },
        ticks: {
          color: '#6B7280',
          font: {
            family: 'Inter, system-ui, sans-serif',
            size: 11,
          },
        },
      },
      y: {
        grid: {
          color: '#F3F4F6',
        },
        ticks: {
          color: '#6B7280',
          font: {
            family: 'Inter, system-ui, sans-serif',
            size: 11,
          },
        },
      },
    },
  };

  const weeklyChartData = {
    labels: analyticsData.weeklyData.map(d => d.label),
    datasets: [
      {
        label: 'Attendance',
        data: analyticsData.weeklyData.map(d => d.attendance),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        borderRadius: 6,
        fill: chartType === 'line',
      },
    ],
  };

  const bacentaChartData = {
    labels: analyticsData.bacentaStats.map(b => b.name),
    datasets: [
      {
        label: 'Attendance Rate (%)',
        data: analyticsData.bacentaStats.map(b => b.attendanceRate),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)',
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(139, 92, 246, 1)',
          'rgba(236, 72, 153, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const monthName = getMonthName(displayedDate.getMonth());
  const year = displayedDate.getFullYear();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold gradient-text font-serif mb-2">
          Attendance Analytics
        </h2>
        <div className="flex items-center justify-center space-x-2 text-gray-600">
          <span className="text-2xl">📊</span>
          <p className="text-lg font-medium">{monthName} {year}</p>
          <span className="text-2xl">📈</span>
        </div>
        <div className="w-24 h-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full mx-auto mt-3"></div>
      </div>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Overall Rate"
          value={`${analyticsData.overallRate}%`}
          icon={<ChartBarIcon className="w-8 h-8" />}
          colorClass="border-blue-500"
          trend={analyticsData.overallRate >= 70 ? 'up' : analyticsData.overallRate >= 50 ? 'neutral' : 'down'}
          trendValue={analyticsData.overallRate >= 70 ? 'Excellent' : analyticsData.overallRate >= 50 ? 'Good' : 'Needs Attention'}
        />
        <StatCard
          title="Total Services"
          value={analyticsData.totalServices}
          icon={<CalendarIcon className="w-8 h-8" />}
          colorClass="border-green-500"
        />
        <StatCard
          title="High Attendance"
          value={analyticsData.highAttendanceMembers}
          icon={<TrendingUpIcon className="w-8 h-8" />}
          colorClass="border-emerald-500"
          trendValue="≥80% attendance"
        />
        <StatCard
          title="Need Follow-up"
          value={analyticsData.lowAttendanceMembers}
          icon={<TrendingDownIcon className="w-8 h-8" />}
          colorClass="border-red-500"
          trendValue="<50% attendance"
        />
      </div>

      {/* View Controls */}
      <div className="glass p-6 shadow-lg rounded-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'overview', label: 'Overview', icon: '📊' },
              { key: 'monthly', label: 'Monthly Trend', icon: '📈' },
              { key: 'members', label: 'Member Analysis', icon: '👥' },
              { key: 'bacentas', label: 'Bacenta Comparison', icon: '🏛️' },
            ].map((view) => (
              <button
                key={view.key}
                onClick={() => setCurrentView(view.key as ViewType)}
                className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${
                  currentView === view.key
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-white/50 text-gray-600 hover:bg-white/80'
                }`}
              >
                <span>{view.icon}</span>
                <span>{view.label}</span>
              </button>
            ))}
          </div>

          {(currentView === 'overview' || currentView === 'monthly') && (
            <div className="flex gap-2">
              {[
                { key: 'bar', label: 'Bar', icon: '📊' },
                { key: 'line', label: 'Line', icon: '📈' },
              ].map((chart) => (
                <button
                  key={chart.key}
                  onClick={() => setChartType(chart.key as ChartType)}
                  className={`px-3 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-1 ${
                    chartType === chart.key
                      ? 'bg-gray-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span className="text-sm">{chart.icon}</span>
                  <span className="text-sm">{chart.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chart Display */}
      {currentView === 'overview' && (
        <div className="glass p-8 shadow-lg rounded-2xl">
          <h3 className="text-2xl font-bold gradient-text mb-6 flex items-center">
            <ChartBarIcon className="w-8 h-8 mr-3 text-gray-600" />
            Weekly Attendance Overview
          </h3>
          <div className="h-80">
            {chartType === 'bar' ? (
              <Bar data={weeklyChartData} options={chartOptions} />
            ) : (
              <Line data={weeklyChartData} options={chartOptions} />
            )}
          </div>
        </div>
      )}

      {currentView === 'bacentas' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="glass p-8 shadow-lg rounded-2xl">
            <h3 className="text-2xl font-bold gradient-text mb-6 flex items-center">
              <ChartBarIcon className="w-8 h-8 mr-3 text-gray-600" />
              Bacenta Performance
            </h3>
            <div className="h-80">
              <Doughnut data={bacentaChartData} options={{
                ...chartOptions,
                plugins: {
                  ...chartOptions.plugins,
                  legend: {
                    position: 'bottom' as const,
                    labels: {
                      font: {
                        family: 'Inter, system-ui, sans-serif',
                        size: 11,
                      },
                      color: '#6B7280',
                      padding: 15,
                    },
                  },
                },
              }} />
            </div>
          </div>

          <div className="glass p-8 shadow-lg rounded-2xl">
            <h3 className="text-2xl font-bold gradient-text mb-6">Bacenta Rankings</h3>
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {analyticsData.bacentaStats.map((bacenta, index) => (
                <div key={bacenta.id} className="flex items-center justify-between p-4 bg-white/50 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700">{bacenta.name}</p>
                      <p className="text-sm text-gray-500">{bacenta.memberCount} members</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold gradient-text">{bacenta.attendanceRate}%</p>
                    <p className="text-sm text-gray-500">{bacenta.totalAttendances} attendances</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {currentView === 'members' && (
        <div className="glass p-8 shadow-lg rounded-2xl">
          <h3 className="text-2xl font-bold gradient-text mb-6 flex items-center">
            <UsersIcon className="w-8 h-8 mr-3 text-gray-600" />
            Member Attendance Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
            {analyticsData.memberStats.map((member) => (
              <div key={member.id} className="bg-white/50 p-4 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-700 truncate">
                    {member.firstName} {member.lastName}
                  </h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    member.attendanceRate >= 80 ? 'bg-green-100 text-green-800' :
                    member.attendanceRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                    member.attendanceRate >= 40 ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {member.attendanceRate}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{member.attendanceCount}/{analyticsData.totalServices} services</span>
                  <span className="text-xs">
                    {bacentas.find(b => b.id === member.bacentaId)?.name || 'No Bacenta'}
                  </span>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      member.attendanceRate >= 80 ? 'bg-green-500' :
                      member.attendanceRate >= 60 ? 'bg-yellow-500' :
                      member.attendanceRate >= 40 ? 'bg-orange-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${member.attendanceRate}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentView === 'monthly' && (
        <div className="glass p-8 shadow-lg rounded-2xl">
          <h3 className="text-2xl font-bold gradient-text mb-6 flex items-center">
            <CalendarIcon className="w-8 h-8 mr-3 text-gray-600" />
            Monthly Attendance Trend
          </h3>
          <div className="h-80">
            {chartType === 'bar' ? (
              <Bar data={weeklyChartData} options={chartOptions} />
            ) : (
              <Line data={weeklyChartData} options={chartOptions} />
            )}
          </div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/50 p-4 rounded-xl text-center">
              <p className="text-sm text-gray-600 mb-1">Average Attendance</p>
              <p className="text-2xl font-bold gradient-text">
                {analyticsData.weeklyData.length > 0 ?
                  Math.round(analyticsData.weeklyData.reduce((sum, d) => sum + d.attendance, 0) / analyticsData.weeklyData.length) : 0}
              </p>
            </div>
            <div className="bg-white/50 p-4 rounded-xl text-center">
              <p className="text-sm text-gray-600 mb-1">Highest Attendance</p>
              <p className="text-2xl font-bold gradient-text">
                {Math.max(...analyticsData.weeklyData.map(d => d.attendance), 0)}
              </p>
            </div>
            <div className="bg-white/50 p-4 rounded-xl text-center">
              <p className="text-sm text-gray-600 mb-1">Lowest Attendance</p>
              <p className="text-2xl font-bold gradient-text">
                {analyticsData.weeklyData.length > 0 ? Math.min(...analyticsData.weeklyData.map(d => d.attendance)) : 0}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceAnalyticsView;
