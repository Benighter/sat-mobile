import ExcelJS from 'exceljs';
import { Member, Bacenta, AttendanceRecord } from '../types';
import { DirectoryHandle, saveFileToDirectory } from './fileSystemUtils';
import { formatDateDayMonthYear } from './dateUtils';
import { DEFAULT_CHURCH, MINISTRY_OPTIONS } from '../constants';
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

  const tonguesCount = activeMembers.filter(m => m.speaksInTongues === true).length;
  const baptisedCount = activeMembers.filter(m => m.baptized === true).length;
  const firstTimersCount = activeMembers.filter(m => m.isFirstTimer === true).length;
  const ministriesCount = new Set(activeMembers.filter(m => m.ministry).map(m => m.ministry!.trim().toLowerCase())).size;

  return {
    totalTabs: 5,
    bacentaCount: uniqueBacentas.size,
    memberCount: activeMembers.length,
    servicesCount: dates.length,
    dateRangeDays,
    firstDate,
    lastDate,
    features: [
      `Tab 1 — Hierarchy: sections for ${sectionNames || 'all hierarchy levels'} with attendance`,
      `Tab 2 — First Timers: ${firstTimersCount} member${firstTimersCount !== 1 ? 's' : ''} (grouped by leader)`,
      `Tab 3 — Basontas: ${ministriesCount} ministr${ministriesCount !== 1 ? 'ies' : 'y'} categorised`,
      `Tab 4 — Speaks in Tongues: ${tonguesCount} member${tonguesCount !== 1 ? 's' : ''}`,
      `Tab 5 — Water Baptised: ${baptisedCount} member${baptisedCount !== 1 ? 's' : ''}`,
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

    // ── Helper: simple member-list worksheet ────────────────────────────
    const createSimpleMemberSheet = (sheetName: string, sheetMembers: Member[]) => {
      const ws = workbook.addWorksheet(sheetName);
      const cols = 4; // #, Fullname, Contacts, Bacenta

      // Title
      const titleCell = ws.getCell(1, 1);
      titleCell.value = `${reportName} — ${sheetName}`;
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: 'center' };
      ws.mergeCells(1, 1, 1, cols);

      // Count subtitle
      const countCell = ws.getCell(2, 1);
      countCell.value = `Total: ${sheetMembers.length}`;
      countCell.alignment = { horizontal: 'center' };
      ws.mergeCells(2, 1, 2, cols);

      // Header row
      const headerRow = ws.getRow(4);
      ['#', 'Fullname', 'Contacts', 'Bacenta'].forEach((h, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = h;
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
      });

      // Data rows
      sheetMembers.forEach((member, index) => {
        const row = ws.getRow(5 + index);
        row.getCell(1).value = index + 1;
        row.getCell(2).value = getFullName(member);
        row.getCell(3).value = member.phoneNumber;
        row.getCell(4).value = getBacentaName(bacentas, member.bacentaId);
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: index % 2 === 0 ? 'FFF2F2F2' : 'FFFFFFFF' }
        };
      });

      // Borders
      const thinB = {
        top: { style: 'thin' as const },
        left: { style: 'thin' as const },
        bottom: { style: 'thin' as const },
        right: { style: 'thin' as const }
      };
      for (let r = 4; r <= 4 + sheetMembers.length; r++) {
        const row = ws.getRow(r);
        for (let c = 1; c <= cols; c++) {
          row.getCell(c).border = thinB;
        }
      }

      // Auto-width
      ws.columns.forEach(column => {
        let maxLength = 10;
        column.eachCell({ includeEmpty: true }, cell => {
          const v = cell.value ? cell.value.toString() : '';
          maxLength = Math.max(maxLength, v.length + 2);
        });
        column.width = Math.min(maxLength, 40);
      });

      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];
    };

    // First Timers tab (grouped by Bacenta Leader / Fellowship Leader)
    (() => {
      const firstTimers = activeMembers.filter(m => m.isFirstTimer === true);
      if (!firstTimers.length) return;

      const ws = workbook.addWorksheet('First Timers');
      let currentRow = 1;

      const BL_COLOR = 'FFD9EAD3';
      const FL_COLOR = 'FFF4CCCC';
      const UNASSIGNED_COLOR = 'FFF2F2F2';
      const thinB = {
        top: { style: 'thin' as const },
        left: { style: 'thin' as const },
        bottom: { style: 'thin' as const },
        right: { style: 'thin' as const }
      };

      ws.mergeCells(currentRow, 1, currentRow, 4);
      const ftTitleCell = ws.getCell(currentRow, 1);
      ftTitleCell.value = `${reportName} — First Timers`;
      ftTitleCell.font = { bold: true, size: 16 };
      ftTitleCell.alignment = { horizontal: 'center' };
      currentRow++;

      ws.mergeCells(currentRow, 1, currentRow, 4);
      const ftCountCell = ws.getCell(currentRow, 1);
      ftCountCell.value = `Total First Timers: ${firstTimers.length}`;
      ftCountCell.alignment = { horizontal: 'center' };
      currentRow += 2;

      const writeSection = (headerText: string, sectionMembers: Member[], color: string) => {
        if (!sectionMembers.length) return;
        ws.mergeCells(currentRow, 1, currentRow, 4);
        const hCell = ws.getCell(currentRow, 1);
        hCell.value = headerText;
        hCell.font = { bold: true, size: 12 };
        hCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
        currentRow++;
        ['#', 'Fullname', 'Contacts', 'Bacenta'].forEach((h, i) => {
          const cell = ws.getCell(currentRow, i + 1);
          cell.value = h;
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
          cell.border = thinB;
        });
        currentRow++;
        sectionMembers.forEach((m, idx) => {
          ws.getCell(currentRow, 1).value = idx + 1;
          ws.getCell(currentRow, 2).value = getFullName(m);
          ws.getCell(currentRow, 3).value = m.phoneNumber;
          ws.getCell(currentRow, 4).value = getBacentaName(bacentas, m.bacentaId);
          for (let col = 1; col <= 4; col++) ws.getCell(currentRow, col).border = thinB;
          currentRow++;
        });
        currentRow++; // blank row between sections
      };

      const placedIds = new Set<string>();
      const allBacentaLeaders = members.filter(m => m.role === 'Bacenta Leader' && m.isActive !== false);
      const allFellowshipLeaders = members.filter(m => m.role === 'Fellowship Leader' && m.isActive !== false);

      allBacentaLeaders
        .sort((a, b) => getBacentaName(bacentas, a.bacentaId).localeCompare(getBacentaName(bacentas, b.bacentaId)))
        .forEach(bl => {
          const blBacentaName = getBacentaName(bacentas, bl.bacentaId);
          const flsUnderBl = allFellowshipLeaders.filter(fl => fl.bacentaLeaderId === bl.id);
          const blDirectFirstTimers = firstTimers.filter(m =>
            m.bacentaId === bl.bacentaId && m.role !== 'Fellowship Leader' && !placedIds.has(m.id)
          );
          const flHasTimers = flsUnderBl.some(fl =>
            firstTimers.some(m => m.bacentaId === fl.bacentaId && !placedIds.has(m.id))
          );
          if (!blDirectFirstTimers.length && !flHasTimers) return;

          writeSection(`💚 Bacenta Leader: ${getFullName(bl)} (${blBacentaName})`, blDirectFirstTimers, BL_COLOR);
          blDirectFirstTimers.forEach(m => placedIds.add(m.id));

          flsUnderBl
            .sort((a, b) => getBacentaName(bacentas, a.bacentaId).localeCompare(getBacentaName(bacentas, b.bacentaId)))
            .forEach(fl => {
              const flFirstTimers = firstTimers.filter(m => m.bacentaId === fl.bacentaId && !placedIds.has(m.id));
              if (!flFirstTimers.length) return;
              const flBacentaName = getBacentaName(bacentas, fl.bacentaId);
              writeSection(`  ❤️ Fellowship Leader: ${getFullName(fl)} (${flBacentaName})`, flFirstTimers, FL_COLOR);
              flFirstTimers.forEach(m => placedIds.add(m.id));
            });
        });

      const unassigned = firstTimers.filter(m => !placedIds.has(m.id));
      if (unassigned.length) writeSection('Unassigned', unassigned, UNASSIGNED_COLOR);

      ws.columns.forEach(column => {
        let maxLength = 10;
        column.eachCell({ includeEmpty: true }, cell => {
          const v = cell.value ? cell.value.toString() : '';
          maxLength = Math.max(maxLength, v.length + 2);
        });
        column.width = Math.min(maxLength, 40);
      });
      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];
    })();

    // Basontas tab (all ministries, categorised)
    (() => {
      const ws = workbook.addWorksheet('Basontas');
      const COLS = 4;
      let currentRow = 1;

      const thinB = {
        top: { style: 'thin' as const },
        left: { style: 'thin' as const },
        bottom: { style: 'thin' as const },
        right: { style: 'thin' as const }
      };

      // Collect all distinct ministries: known ones first, then any extra found in members
      const membersWithMinistry = activeMembers.filter(m => m.ministry && m.ministry.trim());
      const knownMinistries = MINISTRY_OPTIONS.filter(min =>
        membersWithMinistry.some(m => m.ministry!.toLowerCase() === min.toLowerCase())
      );
      const extraMinistries = Array.from(
        new Set(membersWithMinistry.map(m => m.ministry!.trim()))
      ).filter(min => !MINISTRY_OPTIONS.some(k => k.toLowerCase() === min.toLowerCase())).sort();
      const allMinistries = [...knownMinistries, ...extraMinistries];

      // Title
      ws.mergeCells(currentRow, 1, currentRow, COLS);
      const titleCell = ws.getCell(currentRow, 1);
      titleCell.value = `${reportName} — Basontas (Ministries)`;
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: 'center' };
      currentRow++;

      ws.mergeCells(currentRow, 1, currentRow, COLS);
      const subtitleCell = ws.getCell(currentRow, 1);
      subtitleCell.value = `${allMinistries.length} ministr${allMinistries.length !== 1 ? 'ies' : 'y'} • ${membersWithMinistry.length} member${membersWithMinistry.length !== 1 ? 's' : ''} assigned`;
      subtitleCell.alignment = { horizontal: 'center' };
      currentRow += 2; // blank line

      // Palette of distinct ministry header colours
      const PALETTE = [
        'FFD9EAD3', // green
        'FFF4CCCC', // red
        'FFC9DAF8', // blue
        'FFFFF2CC', // yellow
        'FFD9D2E9', // purple
        'FFFFE0B2', // orange
        'FFB2EBF2', // teal
        'FFF8BBD0', // pink
      ];

      allMinistries.forEach((ministry, mIdx) => {
        const ministryMembers = membersWithMinistry
          .filter(m => m.ministry!.toLowerCase() === ministry.toLowerCase())
          .sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '') || a.firstName.localeCompare(b.firstName));

        if (!ministryMembers.length) return;

        const color = PALETTE[mIdx % PALETTE.length];

        // Ministry header row
        ws.mergeCells(currentRow, 1, currentRow, COLS);
        const headerCell = ws.getCell(currentRow, 1);
        headerCell.value = `${ministry.toUpperCase()}  (${ministryMembers.length})`;
        headerCell.font = { bold: true, size: 13 };
        headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
        headerCell.alignment = { horizontal: 'left', indent: 1 };
        headerCell.border = thinB;
        currentRow++;

        // Column labels
        ['#', 'Fullname', 'Contacts', 'Bacenta'].forEach((h, i) => {
          const cell = ws.getCell(currentRow, i + 1);
          cell.value = h;
          cell.font = { bold: true, size: 11 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
          cell.border = thinB;
        });
        currentRow++;

        // Member rows
        ministryMembers.forEach((m, idx) => {
          ws.getCell(currentRow, 1).value = idx + 1;
          ws.getCell(currentRow, 2).value = getFullName(m);
          ws.getCell(currentRow, 3).value = m.phoneNumber;
          ws.getCell(currentRow, 4).value = getBacentaName(bacentas, m.bacentaId);
          const rowBg = idx % 2 === 0 ? 'FFF9F9F9' : 'FFFFFFFF';
          for (let col = 1; col <= COLS; col++) {
            const cell = ws.getCell(currentRow, col);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
            cell.border = thinB;
          }
          currentRow++;
        });

        currentRow++; // blank row between ministries
      });

      // Auto-width
      ws.columns.forEach(column => {
        let maxLength = 10;
        column.eachCell({ includeEmpty: true }, cell => {
          const v = cell.value ? cell.value.toString() : '';
          maxLength = Math.max(maxLength, v.length + 2);
        });
        column.width = Math.min(maxLength, 42);
      });

      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];
    })();

    // Speaks in Tongues tab
    const tonguesMembers = activeMembers.filter(m => m.speaksInTongues === true);
    createSimpleMemberSheet('Speaks in Tongues', tonguesMembers);

    // Water Baptised tab
    const baptisedMembers = activeMembers.filter(m => m.baptized === true);
    createSimpleMemberSheet('Water Baptised', baptisedMembers);

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

