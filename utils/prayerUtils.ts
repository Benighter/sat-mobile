// Utilities for Prayer feature
import { PrayerSchedule } from '../types';
import { getTuesdayOfWeek } from './dateUtils';

// Default hardcoded times (fallback when no custom schedule exists)
function getDefaultSessionInfo(date: string): { start: string; end: string; hours: number } {
  const dt = new Date(date + 'T00:00:00');
  const day = dt.getDay(); // 0=Sun,1=Mon,2=Tue...6=Sat
  // Tue(2), Fri(5): 04:30-06:30; Wed(3), Thu(4): 04:00-06:00; Sat(6), Sun(0): 05:00-07:00
  if (day === 2 || day === 5) {
    return { start: '04:30', end: '06:30', hours: 2 };
  }
  if (day === 3 || day === 4) {
    return { start: '04:00', end: '06:00', hours: 2 };
  }
  if (day === 6 || day === 0) {
    return { start: '05:00', end: '07:00', hours: 2 };
  }
  return { start: '00:00', end: '00:00', hours: 0 };
}

// Calculate hours from start and end time strings (HH:MM format)
function calculateHours(start: string, end: string): number {
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return (endMinutes - startMinutes) / 60;
}

// Get day name from date
function getDayName(date: string): 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' | null {
  const dt = new Date(date + 'T00:00:00');
  const day = dt.getDay(); // 0=Sun,1=Mon,2=Tue...6=Sat
  const dayMap: { [key: number]: 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' | null } = {
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
    0: 'sunday'
  };
  return dayMap[day] || null;
}

// Returns session info for a given date string (YYYY-MM-DD)
// Checks for custom schedules (week-specific or default) before falling back to hardcoded defaults
// Also checks if the day is disabled for the given date
export function getPrayerSessionInfo(
  date: string,
  schedules?: PrayerSchedule[]
): { start: string; end: string; hours: number; disabled?: boolean } {
  // If no schedules provided, use default hardcoded times
  if (!schedules || schedules.length === 0) {
    return getDefaultSessionInfo(date);
  }

  const dayName = getDayName(date);
  if (!dayName) {
    return { start: '00:00', end: '00:00', hours: 0 };
  }

  // Get the Tuesday of the week for this date
  const weekStart = getTuesdayOfWeek(date);

  // First, check for a week-specific schedule
  const weekSchedule = schedules.find(s => !s.isPermanent && s.weekStart === weekStart);

  // Check if this day is disabled for this date
  let isDisabled = false;
  if (weekSchedule?.disabledDays?.[dayName]) {
    const disabledFromDate = weekSchedule.disabledDays[dayName];
    if (disabledFromDate && date >= disabledFromDate) {
      isDisabled = true;
    }
  }

  // If not disabled by week-specific schedule, check default schedule
  if (!isDisabled) {
    const defaultSchedule = schedules.find(s => s.isPermanent && s.id === 'default');
    if (defaultSchedule?.disabledDays?.[dayName]) {
      const disabledFromDate = defaultSchedule.disabledDays[dayName];
      if (disabledFromDate && date >= disabledFromDate) {
        isDisabled = true;
      }
    }
  }

  // If day is disabled, return 0 hours
  if (isDisabled) {
    return { start: '00:00', end: '00:00', hours: 0, disabled: true };
  }

  if (weekSchedule && weekSchedule.times[dayName]) {
    const { start, end } = weekSchedule.times[dayName];
    return { start, end, hours: calculateHours(start, end) };
  }

  // Second, check for a permanent (default) schedule
  const defaultSchedule = schedules.find(s => s.isPermanent && s.id === 'default');
  if (defaultSchedule && defaultSchedule.times[dayName]) {
    const { start, end } = defaultSchedule.times[dayName];
    return { start, end, hours: calculateHours(start, end) };
  }

  // Fallback to hardcoded defaults
  return getDefaultSessionInfo(date);
}

export function getPrayerHoursForDate(date: string, schedules?: PrayerSchedule[]): number {
  return getPrayerSessionInfo(date, schedules).hours;
}
