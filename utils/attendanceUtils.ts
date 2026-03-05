import { formatDateToYYYYMMDD } from './dateUtils';

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
