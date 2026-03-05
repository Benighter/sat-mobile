import ExcelJS from 'exceljs';
import { Member, Bacenta, AttendanceRecord } from '../types';
import { DirectoryHandle, saveFileToDirectory } from './fileSystemUtils';
import { formatDateDayMonthYear } from './dateUtils';
import { DEFAULT_CHURCH } from '../constants';
import { isMemberWentHome } from './memberStatus';
import { buildHierarchyGrouping, HierarchySectionKind } from './hierarchyGrouping';

export interface HierarchyExcelExportOptions {
  directory?: DirectoryHandle | null;
  /**
   * Optional ISO date strings (YYYY-MM-DD) to limit the attendance range.
   * If omitted, the full available history is used.
   */
  startDate?: string;
  endDate?: string;
  /**
   * Optional constituency/church name to display in the report title.
   * Falls back to the default church name if not provided.
   */
  constituencyName?: string;
  isMinistryContext?: boolean;
  ministryName?: string;
}

export interface HierarchyExcelData {
  members: Member[];
  bacentas: Bacenta[];
  attendanceRecords: AttendanceRecord[];
  options: HierarchyExcelExportOptions;
}

export interface HierarchyExportPreview {
  totalTabs: number;
  bacentaCount: number;
  memberCount: number;
  servicesCount: number;
  dateRangeDays: number;
  firstDate?: string;
  lastDate?: string;
  features?: string[];
}

const CHURCH_INFO = {
  name: DEFAULT_CHURCH.NAME,
  appName: 'SAT Mobile'
};

const ROLE_COLORS: Record<string, string> = {
  'Bacenta Leader': 'FFD9EAD3', // light green
  'Fellowship Leader': 'FFF4CCCC', // light red
  Assistant: 'FFC9DAF8', // light blue
  Admin: 'FFC9DAF8', // same as Assistant
  Member: 'FFF2F2F2', // light gray
  MinistryHead: 'FFD9EAD3',
  MinistryLeader: 'FFF4CCCC',
  MinistryAssistant: 'FFC9DAF8',
  MinistryMember: 'FFF2F2F2'
};

const DEFAULT_SECTION_COLOR_KEYS: Record<HierarchySectionKind, string> = {
  head: 'Bacenta Leader',
  leader: 'Fellowship Leader',
  assistant: 'Assistant',
  member: 'Member'
};

const MINISTRY_SECTION_COLOR_KEYS: Record<HierarchySectionKind, string> = {
  head: 'MinistryHead',
  leader: 'MinistryLeader',
  assistant: 'MinistryAssistant',
  member: 'MinistryMember'
};

const getFullName = (member: Member): string => {
  return `${member.firstName} ${member.lastName || ''}`.trim();
};

const getBacentaName = (bacentas: Bacenta[], bacentaId: string | undefined): string => {
  if (!bacentaId) return '';
  const bacenta = bacentas.find(b => b.id === bacentaId);
  return bacenta ? bacenta.name : '';
};

const getActiveMembers = (members: Member[]): Member[] => {
  return members.filter(m => {
    if (m.isActive === false) return false;
    if (m.frozen && !isMemberWentHome(m)) return false;
    return true;
  });
};

const getUniqueAttendanceDates = (
  attendanceRecords: AttendanceRecord[],
  memberIds: Set<string>,
  startDate?: string,
  endDate?: string
): string[] => {
  const dates = new Set<string>();

  attendanceRecords.forEach(record => {
    if (!record.memberId || !memberIds.has(record.memberId)) return;

    if (startDate && record.date < startDate) return;
    if (endDate && record.date > endDate) return;

    dates.add(record.date);
  });

  return Array.from(dates).sort();
};

const buildAttendanceMap = (
  attendanceRecords: AttendanceRecord[],
  memberIds: Set<string>,
  startDate?: string,
  endDate?: string
): Map<string, string> => {
  const map = new Map<string, string>();

  attendanceRecords.forEach(record => {
    if (!record.memberId || !memberIds.has(record.memberId)) return;

    if (startDate && record.date < startDate) return;
    if (endDate && record.date > endDate) return;

    const key = `${record.memberId}|${record.date}`;
    map.set(key, record.status);
  });

  return map;
};


export const getHierarchyExportPreview = (data: HierarchyExcelData): HierarchyExportPreview => {
  const activeMembers = getActiveMembers(data.members);
  const memberIds = new Set(activeMembers.map(m => m.id));
  const { startDate, endDate } = data.options || {};
  const dates = getUniqueAttendanceDates(data.attendanceRecords, memberIds, startDate, endDate);
  const uniqueBacentas = new Set(activeMembers.map(m => m.bacentaId).filter(Boolean));
  const grouping = buildHierarchyGrouping(activeMembers, {
    isMinistryMode: Boolean(data.options?.isMinistryContext),
    ministryName: data.options?.ministryName
  });
  const sectionNames = grouping.sections.map(section => section.title).join(', ');

  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const dateRangeDays = firstDate && lastDate
    ? Math.ceil((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  return {
    totalTabs: 1,
    bacentaCount: uniqueBacentas.size,
    memberCount: activeMembers.length,
    servicesCount: dates.length,
    dateRangeDays,
    firstDate,
    lastDate,
    features: [
      `Single worksheet with sections for ${sectionNames || 'all hierarchy levels'}`,
      'Headings: Fullname, Contacts, Bacenta, then attendance across all dates',
      'Color-coded rows by role',
      'Attendance history for the selected date range (or full history)'
    ]
  };
};

export const exportHierarchyExcel = async (
  data: HierarchyExcelData
): Promise<{ success: boolean; path?: string; error?: string }> => {
  const { members, bacentas, attendanceRecords, options } = data;

  try {
    const activeMembers = getActiveMembers(members);
    const memberIds = new Set(activeMembers.map(m => m.id));
    const { startDate, endDate } = options || {};
    const dates = getUniqueAttendanceDates(attendanceRecords, memberIds, startDate, endDate);
    const attendanceMap = buildAttendanceMap(attendanceRecords, memberIds, startDate, endDate);
    const grouping = buildHierarchyGrouping(activeMembers, {
      isMinistryMode: Boolean(options?.isMinistryContext),
      ministryName: options?.ministryName
    });
    const sectionColorKeys = options?.isMinistryContext ? MINISTRY_SECTION_COLOR_KEYS : DEFAULT_SECTION_COLOR_KEYS;

    const workbook = new ExcelJS.Workbook();
    const reportName = options?.constituencyName || CHURCH_INFO.name;
    workbook.creator = reportName;
    workbook.lastModifiedBy = CHURCH_INFO.appName;
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet('Hierarchy');

    // Header
    const baseColumns = 4; // #, Fullname, Contacts, Bacenta
    const allColumnsCount = baseColumns + dates.length;
    const headerCell = worksheet.getCell(1, 1);
    headerCell.value = `${reportName} Attendance Report`;
    headerCell.font = { bold: true, size: 16 };
    headerCell.alignment = { horizontal: 'center' };
    worksheet.mergeCells(1, 1, 1, Math.max(allColumnsCount, baseColumns));

    if (dates.length > 0) {
      const subtitleCell = worksheet.getCell(2, 1);
      const formattedStart = formatDateDayMonthYear(dates[0]);
      const formattedEnd = formatDateDayMonthYear(dates[dates.length - 1]);
      subtitleCell.value = `From ${formattedStart} to ${formattedEnd}`;
      subtitleCell.alignment = { horizontal: 'center' };
      worksheet.mergeCells(2, 1, 2, Math.max(allColumnsCount, baseColumns));
    }

    let currentRowIndex = 4;
    const baseHeaders = ['#', 'Fullname', 'Contacts', 'Bacenta'];

    const writeSection = (
      title: string,
      sectionMembers: Member[],
      roleKeyForColor: string
    ) => {
      if (!sectionMembers.length) {
        return;
      }

      if (currentRowIndex > 4) {
        currentRowIndex += 1; // blank row between sections
      }

      const sectionColor = ROLE_COLORS[roleKeyForColor] || ROLE_COLORS.Member;

      const titleRow = worksheet.getRow(currentRowIndex++);
      titleRow.getCell(1).value = title;
      titleRow.font = { bold: true, size: 14 };
      titleRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: sectionColor }
      };

      const headerRow = worksheet.getRow(currentRowIndex++);
      baseHeaders.forEach((h, idx) => {
        headerRow.getCell(idx + 1).value = h;
      });
      dates.forEach((date, idx) => {
        headerRow.getCell(baseHeaders.length + idx + 1).value = formatDateDayMonthYear(date);
      });
      headerRow.font = { bold: true };

      sectionMembers.forEach((member, index) => {
        const row = worksheet.getRow(currentRowIndex++);
        row.getCell(1).value = index + 1;
        row.getCell(2).value = getFullName(member);
        row.getCell(3).value = member.phoneNumber;
        row.getCell(4).value = getBacentaName(bacentas, member.bacentaId);

        dates.forEach((date, idx) => {
          const key = `${member.id}|${date}`;
          const status = attendanceMap.get(key);
          const cell = row.getCell(baseHeaders.length + idx + 1);
          if (status === 'Present') {
            cell.value = 'P';
            cell.font = { ...(cell.font || {}), bold: true };
          } else if (status === 'Absent') {
            cell.value = 'A';
            cell.font = { ...(cell.font || {}), bold: true };
          } else {
            cell.value = '';
          }
        });

        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: sectionColor }
        };
      });

      const totalRow = worksheet.getRow(currentRowIndex++);
      totalRow.getCell(1).value = 'Total';
      totalRow.getCell(2).value = sectionMembers.length;
      totalRow.font = { bold: true };
      totalRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: sectionColor }
      };
    };

    // Apply borders to all data cells for readability
    const lastDataRow = currentRowIndex - 1;
    const thinBorder = {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const }
    };

    for (let rowIndex = 4; rowIndex <= lastDataRow; rowIndex++) {
      const row = worksheet.getRow(rowIndex);
      for (let colIndex = 1; colIndex <= allColumnsCount; colIndex++) {
        const cell = row.getCell(colIndex);
        cell.border = thinBorder;
      }
    }


    grouping.sections.forEach(section => {
      writeSection(section.title, section.members, sectionColorKeys[section.kind]);
    });

    // Auto-width columns
    worksheet.columns.forEach(column => {
      let maxLength = 10;
      column.eachCell({ includeEmpty: true }, cell => {
        const v = cell.value ? cell.value.toString() : '';
        maxLength = Math.max(maxLength, v.length + 2);
      });
      column.width = Math.min(maxLength, 40);
    });

    // Freeze panes below header rows
    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${CHURCH_INFO.name.replace(/\s+/g, '-')}-Hierarchy-Attendance-${timestamp}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();

    const result = await saveFileToDirectory(
      options.directory || null,
      filename,
      buffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    return result;
  } catch (error: any) {
    console.error('Hierarchy Excel export failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to export hierarchy Excel file'
    };
  }
};

