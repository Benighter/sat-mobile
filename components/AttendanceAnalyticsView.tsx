import React, { useState, useMemo, useCallback } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import {
  ChartBarIcon,
  CalendarIcon,
  UsersIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from './icons';
import { getMonthName, getSundaysOfMonth, formatDateToYYYYMMDD } from '../utils/dateUtils';

type ViewType = 'overview' | 'trends' | 'members' | 'bacentas' | 'insights' | 'comparison';
type ChartType = 'bar' | 'line' | 'doughnut' | 'radar' | 'polar';
type TimePeriod = 'current' | 'last3months' | 'last6months' | 'lastyear' | 'all';
type FilterType = 'all' | 'high' | 'medium' | 'low' | 'critical';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  subtitle?: string;
  onClick?: () => void;
  isClickable?: boolean;
}

interface AnalyticsData {
  overallRate: number;
  totalMembers: number;
  totalServices: number;
  weeklyData: Array<{
    date: string;
    attendance: number;
    label: string;
    rate: number;
  }>;
  memberStats: Array<{
    id: string;
    firstName: string;
    lastName: string;
    attendanceCount: number;
    attendanceRate: number;
    streak: number;
    lastAttended: string;
    bacentaId: string;
    trend: 'improving' | 'declining' | 'stable';
  }>;
  bacentaStats: Array<{
    id: string;
    name: string;
    memberCount: number;
    attendanceRate: number;
    totalAttendances: number;
    averageRate: number;
    trend: 'improving' | 'declining' | 'stable';
  }>;
  insights: {
    highPerformers: number;
    needsAttention: number;
    improving: number;
    declining: number;
    perfectAttendance: number;
    newMemberRetention: number;
  };
  trends: {
    monthlyGrowth: number;
    consistencyScore: number;
    engagementLevel: 'high' | 'medium' | 'low';
  };
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  colorClass,
  trend,
  trendValue,
  subtitle,
  onClick,
  isClickable = false
}) => (
  <div
    className={`glass p-6 shadow-lg rounded-2xl border-l-4 ${colorClass} relative h-32 flex flex-col justify-between transition-all duration-200 ${
      isClickable ? 'cursor-pointer hover:shadow-xl hover:scale-105' : ''
    }`}
    onClick={onClick}
  >
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-600 uppercase tracking-wider mb-2">{title}</p>
        <p className="text-3xl font-bold gradient-text">{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
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

// Helper function to format dates nicely
const formatDateLabel = (dateString: string) => {
  try {
    // Handle different date formats
    let date: Date;
    if (dateString.includes('/')) {
      // Format like "1/6", "8/6" etc.
      const [day, month] = dateString.split('/');
      const currentYear = new Date().getFullYear();
      date = new Date(currentYear, parseInt(month) - 1, parseInt(day));
    } else {
      // Try to parse as is
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) {
      return dateString; // Return original if parsing fails
    }

    // Format as "04 May", "11 May" etc.
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short'
    });
  } catch (error) {
    return dateString; // Return original if any error
  }
};

// Enhanced Interactive Bar Chart Component
const InteractiveBarChart: React.FC<{
  data: Array<{ label: string; value: number; }>;
  maxValue?: number;
  height?: string;
  showGrid?: boolean;
  animated?: boolean;
}> = ({ data, maxValue, height = "h-80", showGrid = true, animated = true }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [animationComplete, setAnimationComplete] = useState(false);

  // Calculate proper scaling - use 0 as baseline for better visual comparison
  const max = maxValue || Math.max(...data.map(d => d.value));
  const chartMax = max; // Use actual max without padding for now
  const chartMin = 0; // Always start from 0 for attendance data
  const chartRange = chartMax - chartMin;

  // Generate grid lines
  const gridLines = showGrid ? Array.from({ length: 6 }, (_, i) => {
    const value = chartMin + (chartRange * i) / 5;
    return Math.round(value);
  }).reverse() : [];

  React.useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => setAnimationComplete(true), 100);
      return () => clearTimeout(timer);
    } else {
      setAnimationComplete(true);
    }
  }, [animated]);

  const getBarHeight = (value: number) => {
    if (chartRange === 0 || value === 0) return 0;
    const height = (value / chartMax) * 100;
    return height;
  };

  const getBarColor = (index: number, _value: number) => {
    const isHovered = hoveredIndex === index;

    // Define a set of beautiful gradient colors optimized for white text readability
    const colorPalette = [
      'bg-gradient-to-t from-blue-700 to-blue-500',      // Blue
      'bg-gradient-to-t from-emerald-700 to-emerald-500', // Emerald
      'bg-gradient-to-t from-purple-700 to-purple-500',   // Purple
      'bg-gradient-to-t from-rose-700 to-rose-500',       // Rose
      'bg-gradient-to-t from-amber-700 to-amber-500',     // Amber
      'bg-gradient-to-t from-teal-700 to-teal-500',       // Teal
      'bg-gradient-to-t from-indigo-700 to-indigo-500',   // Indigo
      'bg-gradient-to-t from-cyan-700 to-cyan-500',       // Cyan
    ];

    // Hover state - make it brighter but still readable
    if (isHovered) {
      const hoverColors = [
        'bg-gradient-to-t from-blue-600 to-blue-400',
        'bg-gradient-to-t from-emerald-600 to-emerald-400',
        'bg-gradient-to-t from-purple-600 to-purple-400',
        'bg-gradient-to-t from-rose-600 to-rose-400',
        'bg-gradient-to-t from-amber-600 to-amber-400',
        'bg-gradient-to-t from-teal-600 to-teal-400',
        'bg-gradient-to-t from-indigo-600 to-indigo-400',
        'bg-gradient-to-t from-cyan-600 to-cyan-400',
      ];
      return hoverColors[index % hoverColors.length];
    }

    // Use different color for each bar based on index
    return colorPalette[index % colorPalette.length];
  };

  return (
    <div className={`${height} relative flex`}>
      {/* Y-Axis Area */}
      <div className="w-16 flex-shrink-0 relative">
        {/* Y-Axis Labels */}
        {showGrid && (
          <div className="absolute inset-0 flex flex-col justify-between py-6">
            {gridLines.map((value, index) => (
              <div key={index} className="flex items-center justify-end pr-3">
                <span className="text-sm text-gray-500 font-medium">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chart Area */}
      <div className="flex-1 relative">
        {/* Grid Lines */}
        {showGrid && (
          <div className="absolute inset-0 flex flex-col justify-between py-6 pr-6">
            {gridLines.map((_, index) => (
              <div key={index} className="flex items-center">
                <div className="w-full h-px bg-gray-300 opacity-60"></div>
              </div>
            ))}
          </div>
        )}

        {/* Chart Bars */}
        <div className="absolute inset-0 flex items-end justify-center space-x-6 p-6">
          {data.map((item, index) => (
            <div
              key={index}
              className="flex flex-col items-center space-y-4 flex-1 max-w-32 group"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Bar Container */}
              <div className="relative w-full flex flex-col justify-end" style={{ height: '320px' }}>
                <div
                  className={`relative w-full rounded-lg transition-all duration-700 ease-out shadow-lg hover:shadow-xl cursor-pointer ${getBarColor(index, item.value)} flex items-center justify-center`}
                  style={{
                    height: animationComplete ? `${getBarHeight(item.value)}%` : '0%',
                    minHeight: item.value > 0 ? '48px' : '0px',
                    transform: hoveredIndex === index ? 'scale(1.02)' : 'scale(1)',
                  }}
                >
                  {/* Shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 rounded-lg"></div>

                  {/* Value embedded in bar */}
                  {item.value > 0 && (
                    <div className={`relative z-10 text-white font-bold transition-all duration-200 ${
                      getBarHeight(item.value) > 15 ? 'text-lg' : 'text-sm'
                    } ${hoveredIndex === index ? 'scale-110' : ''}`}>
                      {item.value}
                    </div>
                  )}
                </div>

                {/* Hover tooltip for additional info */}
                {hoveredIndex === index && (
                  <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg z-20 whitespace-nowrap">
                    <div className="font-semibold">{item.value} attendees</div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                  </div>
                )}
              </div>

              {/* Label */}
              <div className={`text-sm text-gray-700 text-center font-medium transition-all duration-200 px-2 ${
                hoveredIndex === index ? 'text-gray-900 font-semibold scale-105' : ''
              }`}>
                {formatDateLabel(item.label)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Enhanced Interactive Line Chart Component
const InteractiveLineChart: React.FC<{
  data: Array<{ label: string; value: number; }>;
  maxValue?: number;
  height?: string;
  showGrid?: boolean;
  animated?: boolean;
}> = ({ data, maxValue, height = "h-80", showGrid = true, animated = true }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [animationComplete, setAnimationComplete] = useState(false);

  // Calculate proper scaling - use 0 as baseline for better visual comparison
  const max = maxValue || Math.max(...data.map(d => d.value));
  const chartMax = max; // Use actual max
  const chartMin = 0; // Always start from 0 for attendance data
  const chartRange = chartMax - chartMin;

  // Generate grid lines
  const gridLines = showGrid ? Array.from({ length: 6 }, (_, i) => {
    const value = chartMin + (chartRange * i) / 5;
    return Math.round(value);
  }).reverse() : [];

  React.useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => setAnimationComplete(true), 500);
      return () => clearTimeout(timer);
    } else {
      setAnimationComplete(true);
    }
  }, [animated]);

  const getPointY = (value: number) => {
    if (chartRange === 0) return 50;
    return 90 - ((value - chartMin) / chartRange) * 80; // 90% to 10% of container
  };

  const getPointX = (index: number) => {
    return 10 + (index / Math.max(data.length - 1, 1)) * 80; // 10% to 90% of container
  };

  // Generate SVG path for the line
  const linePath = data.map((item, index) => {
    const x = getPointX(index);
    const y = getPointY(item.value);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Generate area path for gradient fill
  const areaPath = data.length > 0 ?
    `${linePath} L ${getPointX(data.length - 1)} 90 L ${getPointX(0)} 90 Z` : '';

  // Get point color based on index
  const getPointColor = (index: number) => {
    const colors = [
      'bg-blue-500',      // Blue
      'bg-emerald-500',   // Emerald
      'bg-purple-500',    // Purple
      'bg-rose-500',      // Rose
      'bg-amber-500',     // Amber
      'bg-teal-500',      // Teal
      'bg-indigo-500',    // Indigo
      'bg-cyan-500',      // Cyan
    ];
    return colors[index % colors.length];
  };

  const getPointHoverColor = (index: number) => {
    const colors = [
      'bg-blue-600',      // Blue
      'bg-emerald-600',   // Emerald
      'bg-purple-600',    // Purple
      'bg-rose-600',      // Rose
      'bg-amber-600',     // Amber
      'bg-teal-600',      // Teal
      'bg-indigo-600',    // Indigo
      'bg-cyan-600',      // Cyan
    ];
    return colors[index % colors.length];
  };

  return (
    <div className={`${height} relative`}>
      {/* Grid Lines */}
      {showGrid && (
        <div className="absolute inset-0 flex flex-col justify-between py-4 pr-4 pl-12">
          {gridLines.map((value, index) => (
            <div key={index} className="flex items-center">
              <span className="text-xs text-gray-400 w-8 text-right mr-2">{value}</span>
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>
          ))}
        </div>
      )}

      {/* SVG Chart */}
      <div className="absolute inset-0 p-4 pl-12">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Area gradient */}
          <defs>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          {animationComplete && areaPath && (
            <path
              d={areaPath}
              fill="url(#areaGradient)"
              className="transition-all duration-1000 ease-out"
            />
          )}

          {/* Line */}
          {animationComplete && linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="rgb(59, 130, 246)"
              strokeWidth="0.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-1000 ease-out"
              style={{
                strokeDasharray: animated ? '200' : 'none',
                strokeDashoffset: animated ? '0' : 'none',
                animation: animated ? 'drawLine 2s ease-out' : 'none'
              }}
            />
          )}
        </svg>

        {/* Data Points */}
        <div className="absolute inset-0">
          {data.map((item, index) => (
            <div
              key={index}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
              style={{
                left: `${getPointX(index)}%`,
                top: `${getPointY(item.value)}%`,
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Point */}
              <div className={`w-3 h-3 rounded-full border-2 border-white shadow-lg transition-all duration-200 ${
                hoveredIndex === index ? `${getPointHoverColor(index)} scale-150` : `${getPointColor(index)} scale-100`
              }`}></div>

              {/* Tooltip */}
              {hoveredIndex === index && (
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                  <div className="font-bold">{item.value}</div>
                  <div className="text-gray-300">{item.label}</div>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-800"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="absolute bottom-0 left-12 right-4 flex justify-between items-end pb-3">
        {data.map((item, index) => (
          <div key={index} className={`text-xs text-gray-600 text-center font-medium transition-all duration-200 px-1 ${
            hoveredIndex === index ? 'text-gray-800 font-bold' : ''
          }`}>
            {formatDateLabel(item.label)}
          </div>
        ))}
      </div>
    </div>
  );
};

// Simple Doughnut Chart Component
const SimpleDoughnutChart: React.FC<{
  data: Array<{ label: string; value: number; color: string; }>;
}> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cumulativePercentage = 0;

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative w-48 h-48">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          {data.map((item, index) => {
            const percentage = total > 0 ? (item.value / total) * 100 : 0;
            const strokeDasharray = `${percentage * 2.51} ${251.2 - percentage * 2.51}`;
            const strokeDashoffset = -cumulativePercentage * 2.51;
            cumulativePercentage += percentage;

            return (
              <circle
                key={index}
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={item.color}
                strokeWidth="8"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-700">{total}</div>
            <div className="text-sm text-gray-500">Total</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
        {data.map((item, index) => (
          <div key={index} className="flex items-center space-x-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm text-gray-600 truncate">{item.label}</span>
            <span className="text-sm font-medium text-gray-700">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const AttendanceAnalyticsView: React.FC = () => {
  const {
    members,
    newBelievers,
    attendanceRecords,
    bacentas,
    displayedDate,
    navigateToPreviousMonth,
    navigateToNextMonth
  } = useAppContext();
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('current');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBacenta, setSelectedBacenta] = useState<string>('all');

  // Helper function to get date range based on time period
  const getDateRange = useCallback((period: TimePeriod, baseDate: Date) => {
    const endDate = new Date(baseDate);
    let startDate = new Date(baseDate);

    switch (period) {
      case 'current':
        startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        break;
      case 'last3months':
        startDate = new Date(baseDate.getFullYear(), baseDate.getMonth() - 3, 1);
        break;
      case 'last6months':
        startDate = new Date(baseDate.getFullYear(), baseDate.getMonth() - 6, 1);
        break;
      case 'lastyear':
        startDate = new Date(baseDate.getFullYear() - 1, baseDate.getMonth(), 1);
        break;
      case 'all':
        startDate = new Date(2020, 0, 1); // Arbitrary early date
        break;
    }

    return { startDate, endDate };
  }, []);

  // Calculate comprehensive analytics data
  const analyticsData: AnalyticsData = useMemo(() => {
    const currentMonth = displayedDate.getMonth();
    const currentYear = displayedDate.getFullYear();
    const { startDate, endDate } = getDateRange(timePeriod, displayedDate);

    // Get all Sundays in the selected period
    const getAllSundaysInRange = (start: Date, end: Date) => {
      const sundays = [];
      const current = new Date(start);

      while (current <= end) {
        if (current.getDay() === 0) {
          sundays.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
      }
      return sundays;
    };

    const periodSundays = getAllSundaysInRange(startDate, endDate);
    const currentMonthSundays = getSundaysOfMonth(currentYear, currentMonth);

    // Overall attendance rate for the period (including both members and new believers)
    const totalPossibleAttendances = (members.length + newBelievers.length) * periodSundays.length;

    // Count actual attendances by getting unique member and new believer attendances
    const periodAttendanceRecords = attendanceRecords.filter(record =>
      record.status === 'Present' &&
      periodSundays.some(sunday =>
        formatDateToYYYYMMDD(sunday) === record.date
      )
    );

    // Count unique member and new believer attendances to avoid double counting
    const memberAttendances = periodAttendanceRecords.filter(record => record.memberId).length;
    const newBelieverAttendances = periodAttendanceRecords.filter(record => record.newBelieverId).length;
    const actualAttendances = memberAttendances + newBelieverAttendances;

    const overallRate = totalPossibleAttendances > 0 ?
      Math.round((actualAttendances / totalPossibleAttendances) * 100) : 0;

    // Weekly attendance data for current month
    const weeklyData = currentMonthSundays.map(sundayStr => {
      // Get all attendance records for this Sunday
      const sundayRecords = attendanceRecords.filter(record =>
        record.date === sundayStr && record.status === 'Present'
      );

      // Separate member and new believer attendance records
      const presentMemberIds = sundayRecords
        .filter(record => record.memberId)
        .map(record => record.memberId!);

      const presentNewBelieverIds = sundayRecords
        .filter(record => record.newBelieverId)
        .map(record => record.newBelieverId!);

      // Count actual present members and new believers (to avoid counting duplicates)
      const presentMembers = members.filter(member => presentMemberIds.includes(member.id));
      const presentNewBelievers = newBelievers.filter(nb => presentNewBelieverIds.includes(nb.id));

      // Total attendance is the sum of present members and new believers
      const dayAttendance = presentMembers.length + presentNewBelievers.length;

      // Calculate rate based on total possible attendees (members + new believers)
      const totalPossibleAttendees = members.length + newBelievers.length;
      const dayRate = totalPossibleAttendees > 0 ? Math.round((dayAttendance / totalPossibleAttendees) * 100) : 0;

      // Convert string back to Date for label formatting
      const sundayDate = new Date(sundayStr);

      return {
        date: sundayStr,
        attendance: dayAttendance,
        rate: dayRate,
        label: `${sundayDate.getDate()}/${sundayDate.getMonth() + 1}`
      };
    });

    // Enhanced member attendance analysis
    const memberStats = members.map(member => {
      const memberRecords = attendanceRecords.filter(record =>
        record.memberId === member.id &&
        periodSundays.some(sunday =>
          formatDateToYYYYMMDD(sunday) === record.date
        )
      );

      const presentRecords = memberRecords.filter(r => r.status === 'Present');
      const attendanceCount = presentRecords.length;
      const attendanceRate = periodSundays.length > 0 ?
        Math.round((attendanceCount / periodSundays.length) * 100) : 0;

      // Calculate streak and trend
      const recentRecords = memberRecords
        .filter(r => periodSundays.slice(-8).some(s => formatDateToYYYYMMDD(s) === r.date))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      let streak = 0;
      for (const record of recentRecords) {
        if (record.status === 'Present') streak++;
        else break;
      }

      const lastAttended = presentRecords.length > 0 ?
        presentRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date :
        'Never';

      // Determine trend
      const firstHalf = recentRecords.slice(4).filter(r => r.status === 'Present').length;
      const secondHalf = recentRecords.slice(0, 4).filter(r => r.status === 'Present').length;
      const trend: 'improving' | 'declining' | 'stable' = secondHalf > firstHalf ? 'improving' :
                   secondHalf < firstHalf ? 'declining' : 'stable';

      return {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        attendanceCount,
        attendanceRate,
        streak,
        lastAttended,
        bacentaId: member.bacentaId,
        trend
      };
    });

    // Enhanced bacenta attendance analysis
    const bacentaStats = bacentas.map(bacenta => {
      const bacentaMembers = members.filter(m => m.bacentaId === bacenta.id);
      const totalPossible = bacentaMembers.length * periodSundays.length;
      const actualPresent = attendanceRecords.filter(record =>
        record.status === 'Present' &&
        bacentaMembers.some(m => m.id === record.memberId) &&
        periodSundays.some(sunday =>
          formatDateToYYYYMMDD(sunday) === record.date
        )
      ).length;

      const rate = totalPossible > 0 ? Math.round((actualPresent / totalPossible) * 100) : 0;

      // Calculate average rate and trend for bacenta
      const recentSundays = periodSundays.slice(-8);
      const recentAttendances = recentSundays.map(sunday => {
        const sundayStr = formatDateToYYYYMMDD(sunday);
        return attendanceRecords.filter(record =>
          record.status === 'Present' &&
          record.date === sundayStr &&
          bacentaMembers.some(m => m.id === record.memberId)
        ).length;
      });

      const averageRate = recentAttendances.length > 0 ?
        Math.round(recentAttendances.reduce((sum, att) => sum + att, 0) / recentAttendances.length) : 0;

      // Determine trend
      const firstHalf = recentAttendances.slice(0, 4).reduce((sum, att) => sum + att, 0);
      const secondHalf = recentAttendances.slice(4).reduce((sum, att) => sum + att, 0);
      const trend: 'improving' | 'declining' | 'stable' = secondHalf > firstHalf ? 'improving' :
                   secondHalf < firstHalf ? 'declining' : 'stable';

      return {
        id: bacenta.id,
        name: bacenta.name,
        memberCount: bacentaMembers.length,
        attendanceRate: rate,
        totalAttendances: actualPresent,
        averageRate,
        trend
      };
    });

    // Calculate insights
    const insights = {
      highPerformers: memberStats.filter(m => m.attendanceRate >= 80).length,
      needsAttention: memberStats.filter(m => m.attendanceRate < 50).length,
      improving: memberStats.filter(m => m.trend === 'improving').length,
      declining: memberStats.filter(m => m.trend === 'declining').length,
      perfectAttendance: memberStats.filter(m => m.attendanceRate === 100).length,
      newMemberRetention: members.filter(m => {
        const joinedDate = new Date(m.joinedDate);
        const monthsAgo = new Date();
        monthsAgo.setMonth(monthsAgo.getMonth() - 3);
        const memberStat = memberStats.find(ms => ms.id === m.id);
        return joinedDate >= monthsAgo && memberStat && memberStat.attendanceRate >= 70;
      }).length
    };

    // Calculate trends
    const monthlyGrowth = weeklyData.length > 1 ?
      ((weeklyData[weeklyData.length - 1].attendance - weeklyData[0].attendance) / weeklyData[0].attendance) * 100 : 0;

    const consistencyScore = weeklyData.length > 0 ?
      100 - (Math.max(...weeklyData.map(d => d.attendance)) - Math.min(...weeklyData.map(d => d.attendance))) : 0;

    const engagementLevel: 'high' | 'medium' | 'low' = overallRate >= 75 ? 'high' : overallRate >= 50 ? 'medium' : 'low';

    const trends = {
      monthlyGrowth: Math.round(monthlyGrowth),
      consistencyScore: Math.max(0, Math.round(consistencyScore)),
      engagementLevel
    };

    return {
      overallRate,
      totalMembers: members.length,
      totalServices: periodSundays.length,
      weeklyData,
      memberStats: memberStats.sort((a, b) => b.attendanceRate - a.attendanceRate),
      bacentaStats: bacentaStats.sort((a, b) => b.attendanceRate - a.attendanceRate),
      insights,
      trends
    };
  }, [members, newBelievers, attendanceRecords, bacentas, displayedDate, timePeriod, getDateRange]);

  // Get month and year for display
  const monthName = getMonthName(displayedDate.getMonth());
  const year = displayedDate.getFullYear();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold gradient-text font-serif mb-2">
          Attendance Analytics
        </h2>
        <div className="flex items-center justify-center space-x-4 text-gray-600 mb-4">
          <span className="text-2xl">📊</span>
          <div className="flex items-center space-x-3">
            <button
              onClick={navigateToPreviousMonth}
              className="group month-nav-button flex items-center space-x-2 px-4 py-2 rounded-xl"
              aria-label="Previous month"
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-600 group-hover:-translate-x-1 transition-transform duration-300" />
              <span className="hidden sm:inline font-medium text-gray-700">Previous</span>
            </button>
            <div className="month-display">
              <p className="text-lg font-semibold">{monthName} {year}</p>
            </div>
            <button
              onClick={navigateToNextMonth}
              className="group month-nav-button flex items-center space-x-2 px-4 py-2 rounded-xl"
              aria-label="Next month"
            >
              <span className="hidden sm:inline font-medium text-gray-700">Next</span>
              <ChevronRightIcon className="w-5 h-5 text-gray-600 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          </div>
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
          title="High Performers"
          value={analyticsData.insights.highPerformers}
          icon={<TrendingUpIcon className="w-8 h-8" />}
          colorClass="border-emerald-500"
          trendValue="≥80% attendance"
          subtitle={`${analyticsData.insights.perfectAttendance} perfect attendance`}
        />
        <StatCard
          title="Need Follow-up"
          value={analyticsData.insights.needsAttention}
          icon={<TrendingDownIcon className="w-8 h-8" />}
          colorClass="border-red-500"
          trendValue="<50% attendance"
          subtitle={`${analyticsData.insights.declining} declining trend`}
        />
      </div>

      {/* View Controls */}
      <div className="glass p-6 shadow-lg rounded-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'overview', label: 'Overview', icon: '📊' },
              { key: 'trends', label: 'Trends & Growth', icon: '📈' },
              { key: 'members', label: 'Member Analysis', icon: '👥' },
              { key: 'bacentas', label: 'Bacenta Comparison', icon: '🏛️' },
              { key: 'insights', label: 'Smart Insights', icon: '🧠' },
              { key: 'comparison', label: 'Period Comparison', icon: '⚖️' },
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

          {(currentView === 'overview' || currentView === 'trends') && (
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
        <div className="glass p-10 shadow-lg rounded-2xl chart-container">
          <h3 className="text-2xl font-bold gradient-text mb-10 flex items-center justify-center">
            <ChartBarIcon className="w-8 h-8 mr-3 text-gray-600" />
            Weekly Attendance Overview
          </h3>
          <div className="px-4 py-2">
            {chartType === 'bar' ? (
              <InteractiveBarChart
                data={analyticsData.weeklyData.map(d => ({
                  label: d.label,
                  value: d.attendance
                }))}
                height="h-[28rem]"
                showGrid={true}
                animated={true}
              />
            ) : (
              <InteractiveLineChart
                data={analyticsData.weeklyData.map(d => ({
                  label: d.label,
                  value: d.attendance
                }))}
                height="h-[28rem]"
                showGrid={true}
                animated={true}
              />
            )}
          </div>
        </div>
      )}

      {currentView === 'bacentas' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="glass p-8 shadow-lg rounded-2xl">
            <h3 className="text-2xl font-bold gradient-text mb-6 flex items-center justify-center">
              <ChartBarIcon className="w-8 h-8 mr-3 text-gray-600" />
              Bacenta Performance
            </h3>
            <div className="h-80 flex items-center justify-center">
              <SimpleDoughnutChart
                data={analyticsData.bacentaStats.map((bacenta, index) => ({
                  label: bacenta.name,
                  value: bacenta.attendanceRate,
                  color: [
                    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'
                  ][index % 6]
                }))}
              />
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
        <div className="space-y-6">
          {/* Search and Filter Controls */}
          <div className="glass p-6 shadow-lg rounded-2xl">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as FilterType)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Members</option>
                  <option value="high">High Performers (≥80%)</option>
                  <option value="medium">Medium (50-79%)</option>
                  <option value="low">Low (30-49%)</option>
                  <option value="critical">Critical (&lt;30%)</option>
                </select>

                <select
                  value={selectedBacenta}
                  onChange={(e) => setSelectedBacenta(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Bacentas</option>
                  {bacentas.map(bacenta => (
                    <option key={bacenta.id} value={bacenta.id}>{bacenta.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Member Analysis Grid */}
          <div className="glass p-8 shadow-lg rounded-2xl">
            <h3 className="text-2xl font-bold gradient-text mb-6 flex items-center">
              <div className="flex items-center justify-center flex-1">
                <UsersIcon className="w-8 h-8 mr-3 text-gray-600" />
                Member Attendance Analysis
              </div>
              <span className="ml-auto text-sm font-normal text-gray-500">
                {analyticsData.memberStats.filter(member => {
                  const matchesSearch = searchTerm === '' ||
                    `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
                  const matchesFilter = filterType === 'all' ||
                    (filterType === 'high' && member.attendanceRate >= 80) ||
                    (filterType === 'medium' && member.attendanceRate >= 50 && member.attendanceRate < 80) ||
                    (filterType === 'low' && member.attendanceRate >= 30 && member.attendanceRate < 50) ||
                    (filterType === 'critical' && member.attendanceRate < 30);
                  const matchesBacenta = selectedBacenta === 'all' || member.bacentaId === selectedBacenta;
                  return matchesSearch && matchesFilter && matchesBacenta;
                }).length} members
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {analyticsData.memberStats
                .filter(member => {
                  const matchesSearch = searchTerm === '' ||
                    `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
                  const matchesFilter = filterType === 'all' ||
                    (filterType === 'high' && member.attendanceRate >= 80) ||
                    (filterType === 'medium' && member.attendanceRate >= 50 && member.attendanceRate < 80) ||
                    (filterType === 'low' && member.attendanceRate >= 30 && member.attendanceRate < 50) ||
                    (filterType === 'critical' && member.attendanceRate < 30);
                  const matchesBacenta = selectedBacenta === 'all' || member.bacentaId === selectedBacenta;
                  return matchesSearch && matchesFilter && matchesBacenta;
                })
                .map((member) => (
                <div key={member.id} className="bg-white/50 p-4 rounded-xl hover:bg-white/70 transition-all duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-700 truncate">
                      {member.firstName} {member.lastName}
                    </h4>
                    <div className="flex items-center space-x-2">
                      {member.trend === 'improving' && (
                        <span className="text-green-500 text-xs">↗️</span>
                      )}
                      {member.trend === 'declining' && (
                        <span className="text-red-500 text-xs">↘️</span>
                      )}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        member.attendanceRate >= 80 ? 'bg-green-100 text-green-800' :
                        member.attendanceRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        member.attendanceRate >= 40 ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {member.attendanceRate}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center justify-between">
                      <span>Attendance:</span>
                      <span className="font-medium">{member.attendanceCount}/{analyticsData.totalServices} services</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Current Streak:</span>
                      <span className="font-medium text-blue-600">{member.streak} weeks</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Last Attended:</span>
                      <span className="font-medium">{member.lastAttended === 'Never' ? 'Never' : new Date(member.lastAttended).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Bacenta:</span>
                      <span className="text-xs font-medium">
                        {bacentas.find(b => b.id === member.bacentaId)?.name || 'No Bacenta'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        member.attendanceRate >= 80 ? 'bg-green-500' :
                        member.attendanceRate >= 60 ? 'bg-yellow-500' :
                        member.attendanceRate >= 40 ? 'bg-orange-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${member.attendanceRate}%` }}
                    ></div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className={`font-medium ${
                      member.trend === 'improving' ? 'text-green-600' :
                      member.trend === 'declining' ? 'text-red-600' :
                      'text-gray-600'
                    }`}>
                      {member.trend === 'improving' ? '📈 Improving' :
                       member.trend === 'declining' ? '📉 Declining' :
                       '➡️ Stable'}
                    </span>
                    {member.attendanceRate === 100 && (
                      <span className="text-yellow-600 font-medium">⭐ Perfect</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {analyticsData.memberStats.filter(member => {
              const matchesSearch = searchTerm === '' ||
                `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
              const matchesFilter = filterType === 'all' ||
                (filterType === 'high' && member.attendanceRate >= 80) ||
                (filterType === 'medium' && member.attendanceRate >= 50 && member.attendanceRate < 80) ||
                (filterType === 'low' && member.attendanceRate >= 30 && member.attendanceRate < 50) ||
                (filterType === 'critical' && member.attendanceRate < 30);
              const matchesBacenta = selectedBacenta === 'all' || member.bacentaId === selectedBacenta;
              return matchesSearch && matchesFilter && matchesBacenta;
            }).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p className="text-lg">No members found matching your criteria</p>
                <p className="text-sm mt-2">Try adjusting your search or filter settings</p>
              </div>
            )}
          </div>
        </div>
      )}

      {currentView === 'trends' && (
        <div className="space-y-8">
          <div className="glass p-10 shadow-lg rounded-2xl chart-container">
            <h3 className="text-2xl font-bold gradient-text mb-10 flex items-center justify-center">
              <TrendingUpIcon className="w-8 h-8 mr-3 text-gray-600" />
              Attendance Trends & Growth
            </h3>
            <div className="px-4 py-2">
              {chartType === 'bar' ? (
                <InteractiveBarChart
                  data={analyticsData.weeklyData.map(d => ({
                    label: d.label,
                    value: d.attendance
                  }))}
                  height="h-[28rem]"
                  showGrid={true}
                  animated={true}
                />
              ) : (
                <InteractiveLineChart
                  data={analyticsData.weeklyData.map(d => ({
                    label: d.label,
                    value: d.attendance
                  }))}
                  height="h-[28rem]"
                  showGrid={true}
                  animated={true}
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass p-6 rounded-2xl text-center">
              <h4 className="text-lg font-semibold text-gray-700 mb-2">Monthly Growth</h4>
              <p className={`text-3xl font-bold mb-2 ${
                analyticsData.trends.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {analyticsData.trends.monthlyGrowth >= 0 ? '+' : ''}{analyticsData.trends.monthlyGrowth}%
              </p>
              <p className="text-sm text-gray-500">vs previous period</p>
            </div>

            <div className="glass p-6 rounded-2xl text-center">
              <h4 className="text-lg font-semibold text-gray-700 mb-2">Consistency Score</h4>
              <p className="text-3xl font-bold text-blue-600 mb-2">
                {analyticsData.trends.consistencyScore}%
              </p>
              <p className="text-sm text-gray-500">attendance stability</p>
            </div>

            <div className="glass p-6 rounded-2xl text-center">
              <h4 className="text-lg font-semibold text-gray-700 mb-2">Engagement Level</h4>
              <p className={`text-3xl font-bold mb-2 ${
                analyticsData.trends.engagementLevel === 'high' ? 'text-green-600' :
                analyticsData.trends.engagementLevel === 'medium' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {analyticsData.trends.engagementLevel.toUpperCase()}
              </p>
              <p className="text-sm text-gray-500">overall participation</p>
            </div>
          </div>
        </div>
      )}

      {currentView === 'insights' && (
        <div className="space-y-8">
          <div className="glass p-8 shadow-lg rounded-2xl">
            <h3 className="text-2xl font-bold gradient-text mb-6">🧠 Smart Insights & Recommendations</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                <h4 className="text-lg font-semibold text-green-800 mb-2">High Performers</h4>
                <p className="text-3xl font-bold text-green-600 mb-2">{analyticsData.insights.highPerformers}</p>
                <p className="text-sm text-green-700">Members with ≥80% attendance</p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl border border-blue-200">
                <h4 className="text-lg font-semibold text-blue-800 mb-2">Improving Trend</h4>
                <p className="text-3xl font-bold text-blue-600 mb-2">{analyticsData.insights.improving}</p>
                <p className="text-sm text-blue-700">Members showing improvement</p>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-pink-50 p-6 rounded-xl border border-red-200">
                <h4 className="text-lg font-semibold text-red-800 mb-2">Need Attention</h4>
                <p className="text-3xl font-bold text-red-600 mb-2">{analyticsData.insights.needsAttention}</p>
                <p className="text-sm text-red-700">Members requiring follow-up</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-xl border border-purple-200">
              <h4 className="text-lg font-semibold text-purple-800 mb-4">📊 Key Insights</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-purple-700 mb-1">Perfect Attendance</p>
                  <p className="text-2xl font-bold text-purple-600">{analyticsData.insights.perfectAttendance} members</p>
                </div>
                <div>
                  <p className="text-sm text-purple-700 mb-1">New Member Retention</p>
                  <p className="text-2xl font-bold text-purple-600">{analyticsData.insights.newMemberRetention} members</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentView === 'comparison' && (
        <div className="space-y-8">
          <div className="glass p-8 shadow-lg rounded-2xl">
            <h3 className="text-2xl font-bold gradient-text mb-6">⚖️ Period Comparison</h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-700">Current Period vs Previous</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-4 bg-white/50 rounded-xl">
                    <span className="text-gray-600">Overall Attendance Rate</span>
                    <span className="font-bold text-blue-600">{analyticsData.overallRate}%</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-white/50 rounded-xl">
                    <span className="text-gray-600">Total Services</span>
                    <span className="font-bold text-gray-700">{analyticsData.totalServices}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-white/50 rounded-xl">
                    <span className="text-gray-600">Active Members</span>
                    <span className="font-bold text-gray-700">{analyticsData.totalMembers}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-700">Performance Metrics</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-4 bg-white/50 rounded-xl">
                    <span className="text-gray-600">High Performers</span>
                    <span className="font-bold text-green-600">{analyticsData.insights.highPerformers}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-white/50 rounded-xl">
                    <span className="text-gray-600">Improving Members</span>
                    <span className="font-bold text-blue-600">{analyticsData.insights.improving}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-white/50 rounded-xl">
                    <span className="text-gray-600">Need Follow-up</span>
                    <span className="font-bold text-red-600">{analyticsData.insights.needsAttention}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceAnalyticsView;
