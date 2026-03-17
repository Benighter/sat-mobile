import { AttendanceMemberSnapshot, AttendanceNewBelieverSnapshot, AttendanceRecord, Bacenta, Member, NewBeliever } from '../types';
import { formatDateToYYYYMMDD } from './dateUtils';

type AttendanceCountOptions = {
  date?: string;
  dates?: Iterable<string>;
  memberIds?: Set<string>;
  newBelieverIds?: Set<string>;
  recordFilter?: (record: AttendanceRecord) => boolean;
};

export const buildAttendanceMemberSnapshot = (
  member: Member,
  bacentas: Bacenta[] = []
): AttendanceMemberSnapshot => {
  const bacentaName = bacentas.find((bacenta) => bacenta.id === member.bacentaId)?.name;

  return {
    firstName: member.firstName,
    lastName: member.lastName,
    role: member.role,
    bacentaId: member.bacentaId,
    bacentaName,
    bacentaLeaderId: member.bacentaLeaderId,
    linkedBacentaIds: member.linkedBacentaIds,
    ministry: member.ministry,
    isNewBeliever: member.isNewBeliever,
    isFirstTimer: member.isFirstTimer,
    firstTimerWeekDate: member.firstTimerWeekDate,
    frozen: member.frozen
  };
};

export const buildAttendanceNewBelieverSnapshot = (
  newBeliever: NewBeliever
): AttendanceNewBelieverSnapshot => ({
  name: newBeliever.name,
  surname: newBeliever.surname,
  ministry: newBeliever.ministry,
  isFirstTime: newBeliever.isFirstTime
});

export const getAttendanceRecordDisplayName = (record: AttendanceRecord): string => {
  if (record.memberSnapshot) {
    return `${record.memberSnapshot.firstName} ${record.memberSnapshot.lastName || ''}`.trim();
  }

  if (record.newBelieverSnapshot) {
    return `${record.newBelieverSnapshot.name} ${record.newBelieverSnapshot.surname || ''}`.trim();
  }

  if (record.memberId) return 'Removed member';
  if (record.newBelieverId) return 'Removed new believer';
  return 'Unknown attendee';
};

export const getUniquePresentAttendanceCount = (
  attendanceRecords: AttendanceRecord[],
  options: AttendanceCountOptions = {}
): number => {
  const dateSet = options.date
    ? new Set([options.date])
    : options.dates
      ? new Set(options.dates)
      : null;
  const participantKeys = new Set<string>();

  attendanceRecords.forEach((record) => {
    if (record.status !== 'Present') return;
    if (dateSet && !dateSet.has(record.date)) return;
    if (options.recordFilter && !options.recordFilter(record)) return;

    if (record.memberId) {
      if (options.memberIds && !options.memberIds.has(record.memberId)) return;
      participantKeys.add(`member:${record.memberId}`);
      return;
    }

    if (record.newBelieverId) {
      if (options.newBelieverIds && !options.newBelieverIds.has(record.newBelieverId)) return;
      participantKeys.add(`newBeliever:${record.newBelieverId}`);
    }
  });

  return participantKeys.size;
};

/**
 * Check if a date is editable based on user preferences and date constraints
 * @param dateString - The date string in YYYY-MM-DD format
 * @param allowEditPreviousSundays - User preference to allow editing previous Sundays
 * @returns boolean indicating if the date is editable
 */
export const isDateEditable = (dateString: string, allowEditPreviousSundays: boolean = false): boolean => {
  const today = new Date();
  const todayStr = formatDateToYYYYMMDD(today);
  const targetDate = new Date(dateString + 'T00:00:00'); // Parse as local date
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const targetMonth = targetDate.getMonth();
  const targetYear = targetDate.getFullYear();

  // Don't allow editing future Sundays (compare date strings to avoid timezone issues)
  if (dateString > todayStr) {
    return false;
  }

  // If user has enabled editing previous Sundays, allow editing past months
  if (allowEditPreviousSundays) {
    return true;
  }

  // Don't allow editing past months (default behavior)
  if (targetYear < currentYear || (targetYear === currentYear && targetMonth < currentMonth)) {
    return false;
  }

  return true;
};

/**
 * Get tooltip message for disabled attendance states
 * @param dateString - The date string in YYYY-MM-DD format
 * @param action - The action being attempted ('Present' | 'Absent')
 * @param allowEditPreviousSundays - User preference to allow editing previous Sundays
 * @returns string with appropriate tooltip message
 */
export const getAttendanceTooltipMessage = (
  dateString: string, 
  action: 'Present' | 'Absent', 
  allowEditPreviousSundays: boolean = false
): string => {
  const today = new Date();
  const todayStr = formatDateToYYYYMMDD(today);
  const targetDate = new Date(dateString + 'T00:00:00');
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const targetMonth = targetDate.getMonth();
  const targetYear = targetDate.getFullYear();

  const isFuture = dateString > todayStr;
  const isPastMonth = targetYear < currentYear || (targetYear === currentYear && targetMonth < currentMonth);

  if (isFuture) {
    return `Future date - cannot mark ${action.toLowerCase()}`;
  }

  if (isPastMonth && !allowEditPreviousSundays) {
    return `Past month - cannot mark ${action.toLowerCase()}. Enable "Edit Previous Sundays" in settings to allow this.`;
  }

  return action;
};
