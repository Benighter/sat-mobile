import ExcelJS from 'exceljs';
import { Member, Bacenta, AttendanceRecord } from '../types';
import { formatDateToYYYYMMDD } from './dateUtils';
import { DirectoryHandle, saveFileToDirectory } from './fileSystemUtils';

export interface AdvancedExcelExportOptions {
  includeCharts: boolean;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  selectedBacentas: string[];
  includePersonalInfo: boolean;
  theme: 'professional' | 'colorful' | 'minimal';
  directory?: DirectoryHandle | null;
}

export interface AdvancedExcelData {
  members: Member[];
  bacentas: Bacenta[];
  attendanceRecords: AttendanceRecord[];
  options: AdvancedExcelExportOptions;
}

// Color schemes for different themes
const COLOR_SCHEMES = {
  professional: {
    primary: 'FF2E5266',      // Dark blue-gray
    secondary: 'FF6C7B7F',    // Medium gray
    accent: 'FF4A90E2',       // Blue
    success: 'FF27AE60',      // Green
    warning: 'FFF39C12',      // Orange
    danger: 'FFE74C3C',       // Red
    background: 'FFF8F9FA',   // Light gray
    header: 'FF34495E',       // Dark gray
    text: 'FF2C3E50'          // Dark text
  },
  colorful: {
    primary: 'FF8E44AD',      // Purple
    secondary: 'FF3498DB',    // Blue
    accent: 'FF1ABC9C',       // Teal
    success: 'FF2ECC71',      // Green
    warning: 'FFF1C40F',      // Yellow
    danger: 'FFE67E22',       // Orange
    background: 'FFECF0F1',   // Light background
    header: 'FF9B59B6',       // Purple header
    text: 'FF2C3E50'          // Dark text
  },
  minimal: {
    primary: 'FF000000',      // Black
    secondary: 'FF6C757D',    // Gray
    accent: 'FF007BFF',       // Blue
    success: 'FF28A745',      // Green
    warning: 'FFFFC107',      // Yellow
    danger: 'FFDC3545',       // Red
    background: 'FFFFFFFF',   // White
    header: 'FF343A40',       // Dark gray
    text: 'FF212529'          // Dark text
  }
};

// Helper function to get Sundays in a date range
const getSundaysInRange = (startDate: Date, endDate: Date): Date[] => {
  const sundays: Date[] = [];
  const current = new Date(startDate);
  
  while (current.getDay() !== 0) {
    current.setDate(current.getDate() + 1);
  }
  
  while (current <= endDate) {
    sundays.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  
  return sundays;
};

// Calculate attendance statistics
const calculateAttendanceStats = (
  members: Member[],
  attendanceRecords: AttendanceRecord[],
  dateRange: { startDate: Date; endDate: Date }
) => {
  const startDateStr = formatDateToYYYYMMDD(dateRange.startDate);
  const endDateStr = formatDateToYYYYMMDD(dateRange.endDate);

  const relevantRecords = attendanceRecords.filter(record =>
    record.date >= startDateStr && record.date <= endDateStr
  );

  const totalServices = getSundaysInRange(dateRange.startDate, dateRange.endDate).length;
  const totalPossibleAttendances = members.length * totalServices;
  const totalActualAttendances = relevantRecords.filter(r => r.status === 'Present').length;
  const overallRate = totalPossibleAttendances > 0 ? Math.round((totalActualAttendances / totalPossibleAttendances) * 100) : 0;

  return {
    totalMembers: members.length,
    totalServices,
    totalPossibleAttendances,
    totalActualAttendances,
    overallRate,
    absentCount: relevantRecords.filter(r => r.status === 'Absent').length
  };
};

// Apply professional styling to a worksheet
const applyWorksheetStyling = (worksheet: ExcelJS.Worksheet, theme: string) => {
  const colors = COLOR_SCHEMES[theme as keyof typeof COLOR_SCHEMES];
  
  // Set default font
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.font = {
        name: 'Calibri',
        size: 11,
        color: { argb: colors.text }
      };
    });
  });
  
  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    if (column.eachCell) {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(Math.max(maxLength + 2, 12), 50);
    }
  });
};

// Create professional header
const createWorksheetHeader = (
  worksheet: ExcelJS.Worksheet, 
  title: string, 
  subtitle: string,
  theme: string
) => {
  const colors = COLOR_SCHEMES[theme as keyof typeof COLOR_SCHEMES];
  
  // Church name and title
  worksheet.mergeCells('A1:H1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = CHURCH_INFO.name;
  titleCell.font = {
    name: 'Calibri',
    size: 20,
    bold: true,
    color: { argb: colors.primary }
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Subtitle
  worksheet.mergeCells('A2:H2');
  const subtitleCell = worksheet.getCell('A2');
  subtitleCell.value = CHURCH_INFO.tagline;
  subtitleCell.font = {
    name: 'Calibri',
    size: 12,
    italic: true,
    color: { argb: colors.secondary }
  };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  
  // Report title
  worksheet.mergeCells('A4:H4');
  const reportTitleCell = worksheet.getCell('A4');
  reportTitleCell.value = title;
  reportTitleCell.font = {
    name: 'Calibri',
    size: 16,
    bold: true,
    color: { argb: colors.header }
  };
  reportTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  reportTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: colors.background }
  };
  
  // Report subtitle
  worksheet.mergeCells('A5:H5');
  const reportSubtitleCell = worksheet.getCell('A5');
  reportSubtitleCell.value = subtitle;
  reportSubtitleCell.font = {
    name: 'Calibri',
    size: 12,
    color: { argb: colors.secondary }
  };
  reportSubtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  
  // Generation date
  worksheet.mergeCells('A6:H6');
  const dateCell = worksheet.getCell('A6');
  dateCell.value = `Generated on: ${new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}`;
  dateCell.font = {
    name: 'Calibri',
    size: 10,
    color: { argb: colors.secondary }
  };
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
  
  return 8; // Return the next available row
};

// Create professional table with styling
const createStyledTable = (
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  headers: string[],
  data: any[][],
  theme: string,
  tableName?: string
) => {
  const colors = COLOR_SCHEMES[theme as keyof typeof COLOR_SCHEMES];
  
  // Add table name if provided
  let currentRow = startRow;
  if (tableName) {
    worksheet.mergeCells(`A${currentRow}:${String.fromCharCode(64 + headers.length)}${currentRow}`);
    const nameCell = worksheet.getCell(`A${currentRow}`);
    nameCell.value = tableName;
    nameCell.font = {
      name: 'Calibri',
      size: 14,
      bold: true,
      color: { argb: colors.header }
    };
    nameCell.alignment = { horizontal: 'left', vertical: 'middle' };
    currentRow += 2;
  }
  
  // Create headers
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = {
      name: 'Calibri',
      size: 12,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colors.primary }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: colors.secondary } },
      left: { style: 'thin', color: { argb: colors.secondary } },
      bottom: { style: 'thin', color: { argb: colors.secondary } },
      right: { style: 'thin', color: { argb: colors.secondary } }
    };
  });
  
  currentRow++;
  
  // Add data rows with alternating colors
  data.forEach((row, rowIndex) => {
    row.forEach((cellValue, colIndex) => {
      const cell = worksheet.getCell(currentRow, colIndex + 1);
      cell.value = cellValue;
      
      // Alternating row colors
      const isEvenRow = rowIndex % 2 === 0;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isEvenRow ? 'FFFFFFFF' : colors.background }
      };
      
      cell.border = {
        top: { style: 'thin', color: { argb: colors.secondary } },
        left: { style: 'thin', color: { argb: colors.secondary } },
        bottom: { style: 'thin', color: { argb: colors.secondary } },
        right: { style: 'thin', color: { argb: colors.secondary } }
      };
      
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    currentRow++;
  });
  
  return currentRow + 1; // Return next available row
};

// Create charts for the worksheet
const addChartsToWorksheet = (
  worksheet: ExcelJS.Worksheet,
  data: AdvancedExcelData,
  chartType: 'attendance' | 'bacenta-performance' | 'monthly-trends',
  startRow: number
): number => {
  const { options } = data;

  if (!options.includeCharts) return startRow;

  const colors = COLOR_SCHEMES[options.theme];
  let currentRow = startRow + 2;

  try {
    // Add chart section header
    worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
    const chartTitleCell = worksheet.getCell(`A${currentRow}`);
    chartTitleCell.value = `📊 ${chartType.replace('-', ' ').toUpperCase()} CHART DATA`;
    chartTitleCell.font = {
      name: 'Calibri',
      size: 14,
      bold: true,
      color: { argb: colors.header }
    };
    chartTitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colors.background }
    };
    chartTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow += 1;

    // Add instruction note
    worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
    const noteCell = worksheet.getCell(`A${currentRow}`);
    noteCell.value = 'Use this data to create charts in Excel: Select data → Insert → Charts → Choose chart type';
    noteCell.font = {
      name: 'Calibri',
      size: 10,
      italic: true,
      color: { argb: colors.secondary }
    };
    noteCell.alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow += 2;

    if (chartType === 'attendance') {
      // Create attendance trend chart data
      const sundays = getSundaysInRange(data.options.dateRange.startDate, data.options.dateRange.endDate);
      const chartData = [
        ['Date', 'Present', 'Absent', 'Attendance Rate']
      ];

      sundays.forEach(sunday => {
        const dateStr = formatDateToYYYYMMDD(sunday);
        const dayRecords = data.attendanceRecords.filter(r => r.date === dateStr);
        const presentCount = dayRecords.filter(r => r.status === 'Present').length;
        const absentCount = dayRecords.filter(r => r.status === 'Absent').length;
        const total = presentCount + absentCount;
        const rate = total > 0 ? Math.round((presentCount / total) * 100) : 0;

        chartData.push([
          sunday.toLocaleDateString(),
          presentCount.toString(),
          absentCount.toString(),
          `${rate}%`
        ]);
      });

      currentRow = createStyledTable(worksheet, currentRow, chartData[0], chartData.slice(1), options.theme, 'Attendance Trend Chart Data');
    }

    if (chartType === 'bacenta-performance') {
      // Create bacenta performance chart data
      const chartData = [
        ['Bacenta Name', 'Members', 'Attendance Rate', 'Performance Score']
      ];

      data.bacentas.forEach(bacenta => {
        const bacentaMembers = data.members.filter(m => m.bacentaId === bacenta.id);
        const bacentaStats = calculateAttendanceStats(bacentaMembers, data.attendanceRecords, data.options.dateRange);
        const performanceScore = Math.round(
          (bacentaStats.overallRate * 0.7) +
          (bacentaMembers.length * 2) +
          (bacentaMembers.filter(m => m.bornAgainStatus).length * 3)
        );

        chartData.push([
          bacenta.name,
          bacentaStats.totalMembers.toString(),
          `${bacentaStats.overallRate}%`,
          performanceScore.toString()
        ]);
      });

      currentRow = createStyledTable(worksheet, currentRow, chartData[0], chartData.slice(1), options.theme, 'Bacenta Performance Chart Data');
    }

    if (chartType === 'monthly-trends') {
      // Create monthly trends chart data
      const monthlyData = new Map<string, { present: number; absent: number; total: number }>();

      data.attendanceRecords.forEach(record => {
        const recordDate = new Date(record.date);
        if (recordDate >= data.options.dateRange.startDate && recordDate <= data.options.dateRange.endDate) {
          const monthKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`;

          if (!monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, { present: 0, absent: 0, total: 0 });
          }

          const monthStats = monthlyData.get(monthKey)!;
          if (record.status === 'Present') {
            monthStats.present++;
          } else {
            monthStats.absent++;
          }
          monthStats.total++;
        }
      });

      const chartData = [
        ['Month', 'Present', 'Absent', 'Attendance Rate', 'Trend']
      ];

      const sortedMonths = Array.from(monthlyData.entries()).sort(([a], [b]) => a.localeCompare(b));
      let previousRate = 0;

      sortedMonths.forEach(([monthKey, stats], index) => {
        const [year, month] = monthKey.split('-');
        const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long'
        });

        const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
        let trend = 'Stable';

        if (index > 0) {
          if (rate > previousRate + 5) trend = 'Improving ↗';
          else if (rate < previousRate - 5) trend = 'Declining ↘';
          else trend = 'Stable →';
        }

        chartData.push([
          monthName,
          stats.present.toString(),
          stats.absent.toString(),
          `${rate}%`,
          trend
        ]);

        previousRate = rate;
      });

      currentRow = createStyledTable(worksheet, currentRow, chartData[0], chartData.slice(1), options.theme, 'Monthly Trends Chart Data');
    }

  } catch (error) {
    console.warn('Chart creation failed:', error);
    // Continue without charts if there's an error
  }

  return currentRow;
};



import { DEFAULT_CHURCH } from '../constants';

// Church information constants
const CHURCH_INFO = {
  name: DEFAULT_CHURCH.NAME,
  tagline: 'Faith • Community • Growth',
  appName: 'Church Connect Mobile'
};

// Helper function to apply performance-based cell formatting
const applyPerformanceFormatting = (
  cell: ExcelJS.Cell,
  performance: string,
  colors: any
) => {
  const colorMap = {
    'Excellent': colors.success,
    'Good': colors.warning,
    'Needs Attention': colors.danger,
    'Active': colors.accent,
    'Highly Active': colors.success,
    'Irregular': colors.warning,
    'Inactive': colors.danger,
    'Critical': colors.danger,
    'Poor': colors.danger,
    'Improving': colors.success,
    'Declining': colors.danger,
    'Stable': colors.secondary
  };

  const color = colorMap[performance as keyof typeof colorMap] || colors.secondary;
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: color }
  };
  cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
};

// Helper function to apply attendance rate formatting
const applyAttendanceRateFormatting = (
  cell: ExcelJS.Cell,
  rate: number,
  colors: any
) => {
  let color = colors.danger;
  if (rate >= 80) color = colors.success;
  else if (rate >= 60) color = colors.warning;

  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: color }
  };
  cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
};



// Create Executive Dashboard worksheet with all members and leaders
const createExecutiveDashboard = async (workbook: ExcelJS.Workbook, data: AdvancedExcelData): Promise<ExcelJS.Worksheet> => {
  const { members, bacentas, attendanceRecords, options } = data;
  const worksheet = workbook.addWorksheet('Executive Dashboard');
  const theme = options.theme;
  const colors = COLOR_SCHEMES[theme];
  const sundays = getSundaysInRange(options.dateRange.startDate, options.dateRange.endDate);

  // Create header
  let currentRow = createWorksheetHeader(
    worksheet,
    'Executive Dashboard',
    `Period: ${options.dateRange.startDate.toLocaleDateString()} - ${options.dateRange.endDate.toLocaleDateString()}`,
    theme
  );

  // Key Performance Indicators
  const stats = calculateAttendanceStats(members, attendanceRecords, options.dateRange);

  // KPI Cards
  const kpiData = [
    ['Metric', 'Value', 'Status'],
    ['Total Members', stats.totalMembers.toString(), stats.totalMembers > 50 ? 'Excellent' : 'Good'],
    ['Total Bacentas', bacentas.length.toString(), bacentas.length > 5 ? 'Excellent' : 'Good'],
    ['Overall Attendance Rate', `${stats.overallRate}%`, stats.overallRate >= 80 ? 'Excellent' : stats.overallRate >= 60 ? 'Good' : 'Needs Attention'],
    ['Total Services', stats.totalServices.toString(), 'Active'],
    ['Total Attendances', stats.totalActualAttendances.toString(), 'Tracked']
  ];

  currentRow = createStyledTable(worksheet, currentRow, kpiData[0], kpiData.slice(1), theme, 'Key Performance Indicators');

  // Apply conditional formatting to KPI status column
  for (let i = 1; i <= kpiData.length - 1; i++) {
    const statusCell = worksheet.getCell(currentRow - kpiData.length + i, 3);
    const status = kpiData[i][2];
    applyPerformanceFormatting(statusCell, status, colors);
  }

  currentRow += 2;

  // All Members Table
  const membersHeaders = ['First Name', 'Last Name', 'Phone', 'Bacenta', 'Role', 'Born Again', 'Attendance Rate', 'Present Count'];
  const membersData = members.map(member => {
    const bacenta = bacentas.find(b => b.id === member.bacentaId);
    let presentCount = 0;

    // Calculate attendance for this member
    sundays.forEach(sunday => {
      const dateStr = formatDateToYYYYMMDD(sunday);
      const record = attendanceRecords.find(r => r.memberId === member.id && r.date === dateStr);
      if (record && record.status === 'Present') presentCount++;
    });

    const attendanceRate = sundays.length > 0 ? Math.round((presentCount / sundays.length) * 100) : 0;

    return [
      member.firstName,
      member.lastName,
      options.includePersonalInfo ? member.phoneNumber : 'Hidden',
      bacenta ? bacenta.name : 'Unassigned',
      member.role || 'Member',
      member.bornAgainStatus ? 'Yes' : 'No',
      `${attendanceRate}%`,
      presentCount.toString()
    ];
  });

  currentRow = createStyledTable(worksheet, currentRow, membersHeaders, membersData, theme, 'All Members');

  // Apply conditional formatting to attendance rate column
  for (let i = 0; i < membersData.length; i++) {
    const attendanceCell = worksheet.getCell(currentRow - membersData.length + i, 8);
    const rate = parseInt(membersData[i][7]);
    if (rate >= 80) {
      attendanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.success } };
    } else if (rate >= 60) {
      attendanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.warning } };
    } else {
      attendanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.danger } };
    }
    attendanceCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
  }

  currentRow += 2;

  // All Leaders Table (Bacenta & Fellowship Leaders)
  const leadersHeaders = ['Name', 'Role', 'Bacenta', 'Phone', 'Attendance Rate', 'Present Count', 'Leadership Info'];
  const leaders = members.filter(m => m.role === 'Bacenta Leader' || m.role === 'Fellowship Leader');

  const leadersData = leaders.map(leader => {
    const bacenta = bacentas.find(b => b.id === leader.bacentaId);
    let presentCount = 0;

    // Calculate attendance for this leader
    sundays.forEach(sunday => {
      const dateStr = formatDateToYYYYMMDD(sunday);
      const record = attendanceRecords.find(r => r.memberId === leader.id && r.date === dateStr);
      if (record && record.status === 'Present') presentCount++;
    });

    const attendanceRate = sundays.length > 0 ? Math.round((presentCount / sundays.length) * 100) : 0;

    // Get leadership info
    let leadershipInfo = '';
    if (leader.role === 'Bacenta Leader') {
      const fellowshipLeadersCount = members.filter(m => m.role === 'Fellowship Leader' && m.bacentaLeaderId === leader.id).length;
      const totalUnderLeadership = members.filter(m =>
        (m.role === 'Fellowship Leader' && m.bacentaLeaderId === leader.id) ||
        (m.role === 'Member' && m.bacentaId === leader.bacentaId)
      ).length;
      leadershipInfo = `${fellowshipLeadersCount} FL, ${totalUnderLeadership} total under leadership`;
    } else if (leader.role === 'Fellowship Leader') {
      const bacentaLeader = members.find(m => m.id === leader.bacentaLeaderId);
      leadershipInfo = bacentaLeader ? `Reports to ${bacentaLeader.firstName} ${bacentaLeader.lastName}` : 'Unassigned';
    }

    return [
      `${leader.firstName} ${leader.lastName}`,
      leader.role,
      bacenta ? bacenta.name : 'Unassigned',
      options.includePersonalInfo ? leader.phoneNumber : 'Hidden',
      `${attendanceRate}%`,
      presentCount.toString(),
      leadershipInfo
    ];
  });

  currentRow = createStyledTable(worksheet, currentRow, leadersHeaders, leadersData, theme, 'All Leaders (Bacenta & Fellowship Leaders)');

  // Apply conditional formatting to leaders attendance rate column
  for (let i = 0; i < leadersData.length; i++) {
    const attendanceCell = worksheet.getCell(currentRow - leadersData.length + i, 5);
    const rate = parseInt(leadersData[i][4]);
    if (rate >= 80) {
      attendanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.success } };
    } else if (rate >= 60) {
      attendanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.warning } };
    } else {
      attendanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.danger } };
    }
    attendanceCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
  }

  currentRow += 2;

  // Bacenta Performance Summary
  const bacentaPerformance = bacentas.map(bacenta => {
    const bacentaMembers = members.filter(m => m.bacentaId === bacenta.id);
    const bacentaStats = calculateAttendanceStats(bacentaMembers, attendanceRecords, options.dateRange);
    return [
      bacenta.name,
      bacentaStats.totalMembers.toString(),
      `${bacentaStats.overallRate}%`,
      bacentaStats.totalActualAttendances.toString(),
      bacentaStats.overallRate >= 80 ? 'Excellent' : bacentaStats.overallRate >= 60 ? 'Good' : 'Needs Attention'
    ];
  });

  const bacentaHeaders = ['Bacenta Name', 'Members', 'Attendance Rate', 'Total Attendances', 'Performance'];
  currentRow = createStyledTable(worksheet, currentRow, bacentaHeaders, bacentaPerformance, theme, 'Bacenta Performance Summary');

  // Apply conditional formatting to performance column
  for (let i = 0; i < bacentaPerformance.length; i++) {
    const performanceCell = worksheet.getCell(currentRow - bacentaPerformance.length + i, 5);
    const performance = bacentaPerformance[i][4];
    applyPerformanceFormatting(performanceCell, performance, colors);
  }

  // Add charts if enabled
  if (options.includeCharts) {
    currentRow = addChartsToWorksheet(worksheet, data, 'bacenta-performance', currentRow);
  }

  // Apply styling
  applyWorksheetStyling(worksheet, theme);

  // Freeze panes
  worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 8 }];

  return worksheet;
};

// Create Enhanced Summary worksheet
const createEnhancedSummary = async (workbook: ExcelJS.Workbook, data: AdvancedExcelData): Promise<ExcelJS.Worksheet> => {
  const { members, bacentas, attendanceRecords, options } = data;
  const worksheet = workbook.addWorksheet('Summary Report');
  const theme = options.theme;
  const colors = COLOR_SCHEMES[theme];

  // Create header
  let currentRow = createWorksheetHeader(
    worksheet,
    'Comprehensive Summary Report',
    `Analysis Period: ${options.dateRange.startDate.toLocaleDateString()} - ${options.dateRange.endDate.toLocaleDateString()}`,
    theme
  );

  const stats = calculateAttendanceStats(members, attendanceRecords, options.dateRange);

  // Overview Statistics
  const overviewData = [
    ['Statistic', 'Value', 'Details'],
    ['Total Members', stats.totalMembers.toString(), 'Active church members'],
    ['Total Bacentas', bacentas.length.toString(), 'Active bacenta groups'],
    ['Services Analyzed', stats.totalServices.toString(), 'Sunday services in period'],
    ['Overall Attendance Rate', `${stats.overallRate}%`, 'Average attendance percentage'],
    ['Total Present Attendances', stats.totalActualAttendances.toString(), 'Sum of all present records'],
    ['Total Absent Records', stats.absentCount.toString(), 'Sum of all absent records'],
    ['Possible Attendances', stats.totalPossibleAttendances.toString(), 'Maximum possible attendances']
  ];

  currentRow = createStyledTable(worksheet, currentRow, overviewData[0], overviewData.slice(1), theme, 'Church Overview Statistics');
  currentRow += 2;

  // Detailed Bacenta Analysis
  const detailedBacentaData = bacentas.map(bacenta => {
    const bacentaMembers = members.filter(m => m.bacentaId === bacenta.id);
    const bacentaStats = calculateAttendanceStats(bacentaMembers, attendanceRecords, options.dateRange);
    const avgAge = bacentaMembers.length > 0 ?
      Math.round(bacentaMembers.reduce((sum, member) => {
        const memberDays = Math.floor((Date.now() - new Date(member.createdDate).getTime()) / (1000 * 60 * 60 * 24));
        return sum + memberDays;
      }, 0) / bacentaMembers.length) : 0;

    const bornAgainCount = bacentaMembers.filter(m => m.bornAgainStatus).length;
    const bornAgainRate = bacentaMembers.length > 0 ? Math.round((bornAgainCount / bacentaMembers.length) * 100) : 0;

    return [
      bacenta.name,
      bacentaStats.totalMembers.toString(),
      `${bacentaStats.overallRate}%`,
      bacentaStats.totalActualAttendances.toString(),
      `${avgAge} days`,
      `${bornAgainCount}/${bacentaMembers.length} (${bornAgainRate}%)`,
      bacentaStats.overallRate >= 80 ? 'Excellent' : bacentaStats.overallRate >= 60 ? 'Good' : 'Needs Attention'
    ];
  });

  const detailedHeaders = ['Bacenta Name', 'Total Members', 'Attendance Rate', 'Total Attendances', 'Avg Member Age', 'Born Again Status', 'Performance Rating'];
  currentRow = createStyledTable(worksheet, currentRow, detailedHeaders, detailedBacentaData, theme, 'Detailed Bacenta Analysis');

  // Apply conditional formatting to attendance rate and performance columns
  for (let i = 0; i < detailedBacentaData.length; i++) {
    const attendanceRateCell = worksheet.getCell(currentRow - detailedBacentaData.length + i, 3);
    const performanceCell = worksheet.getCell(currentRow - detailedBacentaData.length + i, 7);

    const attendanceRate = parseInt(detailedBacentaData[i][2].replace('%', ''));
    const performance = detailedBacentaData[i][6];

    applyAttendanceRateFormatting(attendanceRateCell, attendanceRate, colors);
    applyPerformanceFormatting(performanceCell, performance, colors);
  }

  // Add charts if enabled
  if (options.includeCharts) {
    currentRow = addChartsToWorksheet(worksheet, data, 'monthly-trends', currentRow);
  }

  // Apply styling
  applyWorksheetStyling(worksheet, theme);

  // Freeze panes
  worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 8 }];

  return worksheet;
};

// Create Enhanced Individual Bacenta worksheet
const createEnhancedBacentaWorksheet = async (workbook: ExcelJS.Workbook, bacenta: Bacenta, data: AdvancedExcelData): Promise<ExcelJS.Worksheet> => {
  const { members, attendanceRecords, options } = data;
  const sheetName = bacenta.name.length > 31 ? bacenta.name.substring(0, 28) + '...' : bacenta.name;
  const worksheet = workbook.addWorksheet(sheetName);
  const theme = options.theme;
  const colors = COLOR_SCHEMES[theme];

  const bacentaMembers = members.filter(m => m.bacentaId === bacenta.id);
  const sundays = getSundaysInRange(options.dateRange.startDate, options.dateRange.endDate);

  // Create header
  let currentRow = createWorksheetHeader(
    worksheet,
    `${bacenta.name} - Detailed Attendance Report`,
    `Members: ${bacentaMembers.length} | Period: ${options.dateRange.startDate.toLocaleDateString()} - ${options.dateRange.endDate.toLocaleDateString()}`,
    theme
  );

  // Bacenta Statistics Summary
  const bacentaStats = calculateAttendanceStats(bacentaMembers, attendanceRecords, options.dateRange);
  const summaryData = [
    ['Metric', 'Value'],
    ['Total Members', bacentaStats.totalMembers.toString()],
    ['Services in Period', bacentaStats.totalServices.toString()],
    ['Overall Attendance Rate', `${bacentaStats.overallRate}%`],
    ['Total Present Attendances', bacentaStats.totalActualAttendances.toString()],
    ['Total Absent Records', bacentaStats.absentCount.toString()],
    ['Born Again Members', bacentaMembers.filter(m => m.bornAgainStatus).length.toString()],
    ['New Members (Last 30 days)', bacentaMembers.filter(m => {
      const createdDate = new Date(m.createdDate);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return createdDate >= thirtyDaysAgo;
    }).length.toString()]
  ];

  currentRow = createStyledTable(worksheet, currentRow, summaryData[0], summaryData.slice(1), theme, 'Bacenta Summary');
  currentRow += 2;

  // Member Attendance Matrix
  const attendanceHeaders = ['Member Name', 'Phone', 'Born Again'];
  sundays.forEach(sunday => {
    attendanceHeaders.push(sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  });
  attendanceHeaders.push('Total Present', 'Attendance Rate', 'Performance');

  const attendanceData = bacentaMembers.map(member => {
    const memberRow = [
      `${member.firstName} ${member.lastName}`,
      options.includePersonalInfo ? member.phoneNumber : 'Hidden',
      member.bornAgainStatus ? 'Yes' : 'No'
    ];

    let presentCount = 0;
    sundays.forEach(sunday => {
      const dateStr = formatDateToYYYYMMDD(sunday);
      const record = attendanceRecords.find(r => r.memberId === member.id && r.date === dateStr);
      const status = record ? record.status : 'Absent';
      memberRow.push(status === 'Present' ? 'P' : 'A');
      if (status === 'Present') presentCount++;
    });

    const attendanceRate = sundays.length > 0 ? Math.round((presentCount / sundays.length) * 100) : 0;
    const performance = attendanceRate >= 80 ? 'Excellent' : attendanceRate >= 60 ? 'Good' : 'Needs Attention';

    memberRow.push(presentCount.toString(), `${attendanceRate}%`, performance);

    return memberRow;
  });

  currentRow = createStyledTable(worksheet, currentRow, attendanceHeaders, attendanceData, theme, 'Member Attendance Matrix');

  // Apply conditional formatting to attendance data
  const attendanceStartCol = 4; // After Name, Phone, Born Again
  const attendanceEndCol = attendanceStartCol + sundays.length - 1;
  const rateCol = attendanceEndCol + 2; // Attendance Rate column
  const performanceCol = rateCol + 1; // Performance column

  for (let i = 0; i < attendanceData.length; i++) {
    const rowNum = currentRow - attendanceData.length + i;

    // Color code individual attendance cells
    for (let col = attendanceStartCol; col <= attendanceEndCol; col++) {
      const cell = worksheet.getCell(rowNum, col);
      if (cell.value === 'P') {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colors.success }
        };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      } else {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colors.danger }
        };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      }
    }

    // Color code attendance rate and performance
    const rateCell = worksheet.getCell(rowNum, rateCol);
    const performanceCell = worksheet.getCell(rowNum, performanceCol);
    const rate = parseInt(attendanceData[i][rateCol - 1].replace('%', ''));
    const performance = attendanceData[i][performanceCol - 1];

    applyAttendanceRateFormatting(rateCell, rate, colors);
    applyPerformanceFormatting(performanceCell, performance, colors);
  }

  // Apply styling
  applyWorksheetStyling(worksheet, theme);

  // Freeze panes (freeze first 4 columns and header rows)
  worksheet.views = [{ state: 'frozen', xSplit: 4, ySplit: currentRow - attendanceData.length - 1 }];

  return worksheet;
};

// Create Enhanced Member Directory worksheet
const createEnhancedMemberDirectory = async (workbook: ExcelJS.Workbook, data: AdvancedExcelData): Promise<ExcelJS.Worksheet> => {
  const { members, bacentas, attendanceRecords, options } = data;
  const worksheet = workbook.addWorksheet('Member Directory');
  const theme = options.theme;
  const colors = COLOR_SCHEMES[theme];

  // Create header
  let currentRow = createWorksheetHeader(
    worksheet,
    'Complete Member Directory',
    `Total Members: ${members.length} | Generated: ${new Date().toLocaleDateString()}`,
    theme
  );

  // Member directory data with enhanced information
  const memberData = members.map(member => {
    const bacenta = bacentas.find(b => b.id === member.bacentaId);
    const memberSince = Math.floor((Date.now() - new Date(member.createdDate).getTime()) / (1000 * 60 * 60 * 24));

    // Calculate member's attendance statistics
    const memberRecords = attendanceRecords.filter(r =>
      r.memberId === member.id &&
      r.date >= formatDateToYYYYMMDD(options.dateRange.startDate) &&
      r.date <= formatDateToYYYYMMDD(options.dateRange.endDate)
    );

    const presentCount = memberRecords.filter(r => r.status === 'Present').length;
    const totalRecords = memberRecords.length;
    const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

    // Determine member status
    let memberStatus = 'Active';
    if (attendanceRate < 30) memberStatus = 'Inactive';
    else if (attendanceRate < 60) memberStatus = 'Irregular';
    else if (attendanceRate >= 90) memberStatus = 'Highly Active';

    // Calculate engagement score (0-100)
    const engagementScore = Math.round(
      (attendanceRate * 0.7) +
      (member.bornAgainStatus ? 20 : 0) +
      (memberSince > 365 ? 10 : memberSince / 365 * 10)
    );

    return [
      member.firstName,
      member.lastName,
      options.includePersonalInfo ? member.phoneNumber : 'Hidden',
      options.includePersonalInfo ? member.buildingAddress : 'Hidden',
      bacenta ? bacenta.name : 'Unassigned',
      member.bornAgainStatus ? 'Yes' : 'No',
      new Date(member.createdDate).toLocaleDateString(),
      `${memberSince} days`,
      `${attendanceRate}%`,
      presentCount.toString(),
      totalRecords.toString(),
      memberStatus,
      `${engagementScore}/100`
    ];
  });

  const memberHeaders = [
    'First Name', 'Last Name', 'Phone', 'Address', 'Bacenta',
    'Born Again', 'Created Date', 'Member Since', 'Attendance Rate',
    'Present Count', 'Total Records', 'Status', 'Engagement Score'
  ];

  currentRow = createStyledTable(worksheet, currentRow, memberHeaders, memberData, theme, 'Member Directory & Analytics');

  // Apply conditional formatting
  for (let i = 0; i < memberData.length; i++) {
    const rowNum = currentRow - memberData.length + i;

    // Color code attendance rate (column 9)
    const attendanceRateCell = worksheet.getCell(rowNum, 9);
    const attendanceRate = parseInt(memberData[i][8].replace('%', ''));
    applyAttendanceRateFormatting(attendanceRateCell, attendanceRate, colors);

    // Color code member status (column 12)
    const statusCell = worksheet.getCell(rowNum, 12);
    const status = memberData[i][11];
    applyPerformanceFormatting(statusCell, status, colors);

    // Color code engagement score (column 13)
    const engagementCell = worksheet.getCell(rowNum, 13);
    const engagementScore = parseInt(memberData[i][12].split('/')[0]);
    applyAttendanceRateFormatting(engagementCell, engagementScore, colors);
  }

  // Apply styling
  applyWorksheetStyling(worksheet, theme);

  // Freeze panes
  worksheet.views = [{ state: 'frozen', xSplit: 2, ySplit: currentRow - memberData.length - 1 }];

  // Add auto-filter
  const headerRow = currentRow - memberData.length - 1;
  worksheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: currentRow - 1, column: memberHeaders.length }
  };

  return worksheet;
};

// Create Advanced Analytics worksheet
const createAdvancedAnalytics = async (workbook: ExcelJS.Workbook, data: AdvancedExcelData): Promise<ExcelJS.Worksheet> => {
  const { members, attendanceRecords, options } = data;
  const worksheet = workbook.addWorksheet('Advanced Analytics');
  const theme = options.theme;
  const colors = COLOR_SCHEMES[theme];

  const sundays = getSundaysInRange(options.dateRange.startDate, options.dateRange.endDate);

  // Create header
  let currentRow = createWorksheetHeader(
    worksheet,
    'Advanced Attendance Analytics',
    `Comprehensive analysis for ${sundays.length} services`,
    theme
  );

  // Weekly attendance breakdown
  const weeklyData = sundays.map(sunday => {
    const dateStr = formatDateToYYYYMMDD(sunday);
    const dayRecords = attendanceRecords.filter(r => r.date === dateStr);
    const presentCount = dayRecords.filter(r => r.status === 'Present').length;
    const absentCount = dayRecords.filter(r => r.status === 'Absent').length;
    const totalRecords = presentCount + absentCount;
    const rate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

    let trend = 'Stable';
    const previousSunday = new Date(sunday);
    previousSunday.setDate(previousSunday.getDate() - 7);
    const prevDateStr = formatDateToYYYYMMDD(previousSunday);
    const prevRecords = attendanceRecords.filter(r => r.date === prevDateStr);
    const prevPresentCount = prevRecords.filter(r => r.status === 'Present').length;
    const prevTotalRecords = prevRecords.length;
    const prevRate = prevTotalRecords > 0 ? Math.round((prevPresentCount / prevTotalRecords) * 100) : 0;

    if (rate > prevRate + 5) trend = 'Improving';
    else if (rate < prevRate - 5) trend = 'Declining';

    return [
      sunday.toLocaleDateString(),
      presentCount.toString(),
      absentCount.toString(),
      totalRecords.toString(),
      `${rate}%`,
      trend
    ];
  });

  const weeklyHeaders = ['Service Date', 'Present', 'Absent', 'Total', 'Attendance Rate', 'Trend'];
  currentRow = createStyledTable(worksheet, currentRow, weeklyHeaders, weeklyData, theme, 'Weekly Attendance Analysis');

  // Apply conditional formatting to weekly data
  for (let i = 0; i < weeklyData.length; i++) {
    const rowNum = currentRow - weeklyData.length + i;
    const rateCell = worksheet.getCell(rowNum, 5);
    const trendCell = worksheet.getCell(rowNum, 6);

    const rate = parseInt(weeklyData[i][4].replace('%', ''));
    const trend = weeklyData[i][5];

    applyAttendanceRateFormatting(rateCell, rate, colors);
    applyPerformanceFormatting(trendCell, trend, colors);
  }

  currentRow += 2;

  // Member performance analysis
  const memberPerformanceData = members.map(member => {
    const memberRecords = attendanceRecords.filter(r =>
      r.memberId === member.id &&
      r.date >= formatDateToYYYYMMDD(options.dateRange.startDate) &&
      r.date <= formatDateToYYYYMMDD(options.dateRange.endDate)
    );

    const presentCount = memberRecords.filter(r => r.status === 'Present').length;
    const absentCount = memberRecords.filter(r => r.status === 'Absent').length;
    const total = presentCount + absentCount;
    const rate = total > 0 ? Math.round((presentCount / total) * 100) : 0;

    let status = 'Good';
    let recommendation = 'Continue current engagement';

    if (rate < 30) {
      status = 'Critical';
      recommendation = 'Immediate pastoral care needed';
    } else if (rate < 50) {
      status = 'Poor';
      recommendation = 'Follow-up and encouragement needed';
    } else if (rate < 70) {
      status = 'Needs Attention';
      recommendation = 'Regular check-ins recommended';
    } else if (rate >= 90) {
      status = 'Excellent';
      recommendation = 'Consider for leadership roles';
    }

    return [
      `${member.firstName} ${member.lastName}`,
      presentCount.toString(),
      absentCount.toString(),
      `${rate}%`,
      status,
      recommendation
    ];
  });

  const performanceHeaders = ['Member Name', 'Present', 'Absent', 'Rate', 'Status', 'Recommendation'];
  currentRow = createStyledTable(worksheet, currentRow, performanceHeaders, memberPerformanceData, theme, 'Member Performance Analysis');

  // Apply conditional formatting to member performance
  for (let i = 0; i < memberPerformanceData.length; i++) {
    const rowNum = currentRow - memberPerformanceData.length + i;
    const rateCell = worksheet.getCell(rowNum, 4);
    const statusCell = worksheet.getCell(rowNum, 5);

    const rate = parseInt(memberPerformanceData[i][3].replace('%', ''));
    const status = memberPerformanceData[i][4];

    applyAttendanceRateFormatting(rateCell, rate, colors);
    applyPerformanceFormatting(statusCell, status, colors);
  }

  // Add charts if enabled
  if (options.includeCharts) {
    currentRow = addChartsToWorksheet(worksheet, data, 'attendance', currentRow);
  }

  // Apply styling
  applyWorksheetStyling(worksheet, theme);

  // Freeze panes
  worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 8 }];

  return worksheet;
};

// Main advanced export function
export const exportToAdvancedExcel = async (data: AdvancedExcelData): Promise<{ success: boolean; path?: string; error?: string }> => {
  const { bacentas, options } = data;

  try {
    // Filter bacentas if specific ones are selected
    const targetBacentas = options.selectedBacentas.length > 0
      ? bacentas.filter(b => options.selectedBacentas.includes(b.id))
      : bacentas;

    // Create workbook
    const workbook = new ExcelJS.Workbook();

    // Set workbook properties
    workbook.creator = CHURCH_INFO.name;
    workbook.lastModifiedBy = CHURCH_INFO.appName;
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.lastPrinted = new Date();
    workbook.properties.date1904 = true;
    workbook.calcProperties.fullCalcOnLoad = true;

    // Add worksheets in order of importance

    // 1. Executive Dashboard
    await createExecutiveDashboard(workbook, data);

    // 2. Enhanced Summary
    await createEnhancedSummary(workbook, data);

    // 3. Member Directory
    await createEnhancedMemberDirectory(workbook, data);

    // 4. Advanced Analytics
    await createAdvancedAnalytics(workbook, data);

    // 5. Individual Bacenta worksheets
    for (const bacenta of targetBacentas) {
      await createEnhancedBacentaWorksheet(workbook, bacenta, data);
    }

    // Generate filename with timestamp
    const startDate = options.dateRange.startDate.toISOString().split('T')[0];
    const endDate = options.dateRange.endDate.toISOString().split('T')[0];
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${CHURCH_INFO.name.replace(/\s+/g, '-')}-Report-${startDate}-to-${endDate}-${timestamp}.xlsx`;

    // Write file
    const buffer = await workbook.xlsx.writeBuffer();

    // Save file using the new file system utility
    const result = await saveFileToDirectory(
      options.directory || null,
      filename,
      buffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    return result;
  } catch (error: any) {
    console.error('Advanced Excel export failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to export Excel file'
    };
  }
};

// Export preview function for the modal
export const getAdvancedExportPreview = (data: AdvancedExcelData) => {
  const { members, bacentas, options } = data;
  const targetBacentas = options.selectedBacentas.length > 0
    ? bacentas.filter(b => options.selectedBacentas.includes(b.id))
    : bacentas;

  const sundays = getSundaysInRange(options.dateRange.startDate, options.dateRange.endDate);
  const dateRangeDays = Math.ceil((options.dateRange.endDate.getTime() - options.dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24));

  return {
    totalTabs: 4 + targetBacentas.length, // Dashboard + Summary + Directory + Analytics + Individual Bacentas
    bacentaCount: targetBacentas.length,
    memberCount: members.length,
    dateRangeDays,
    servicesCount: sundays.length,
    features: [
      'Executive Dashboard with KPIs',
      'Enhanced Summary with Performance Analysis',
      'Complete Member Directory with Engagement Scores',
      'Advanced Analytics with Trends',
      'Individual Bacenta Reports with Attendance Matrix',
      'Professional Styling and Conditional Formatting',
      'Auto-filtering and Frozen Panes',
      'Color-coded Performance Indicators'
    ]
  };
};
