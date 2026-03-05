import { CustomPrayer, CustomPrayerRecord } from '../types';

/**
 * Calculate the duration of a prayer session in hours
 * Handles overnight prayers that span across two days
 */
export function calculatePrayerDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  // If end time is less than start time, it crosses midnight
  if (endMinutes < startMinutes) {
    // Add 24 hours (1440 minutes) to end time
    return (endMinutes + 1440 - startMinutes) / 60;
  }
  
  return (endMinutes - startMinutes) / 60;
}

/**
 * Check if a prayer session crosses midnight
 */
export function isOvernightPrayer(startTime: string, endTime: string): boolean {
  const [startHour] = startTime.split(':').map(Number);
  const [endHour] = endTime.split(':').map(Number);
  return endHour < startHour || (endHour === startHour && endTime < startTime);
}

/**
 * Get the day of week name from a date string
 */
export function getDayOfWeek(date: string): keyof CustomPrayer['days'] {
  const d = new Date(date + 'T00:00:00');
  const dayIndex = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const days: (keyof CustomPrayer['days'])[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[dayIndex];
}

/**
 * Check if a custom prayer is active on a specific date
 */
export function isPrayerActiveOnDate(prayer: CustomPrayer, date: string): boolean {
  if (!prayer.isActive) return false;
  const dayOfWeek = getDayOfWeek(date);
  return prayer.days[dayOfWeek];
}

/**
 * Get all custom prayers active on a specific date
 */
export function getActivePrayersForDate(prayers: CustomPrayer[], date: string): CustomPrayer[] {
  return prayers.filter(prayer => isPrayerActiveOnDate(prayer, date));
}

/**
 * Calculate total hours for a member from custom prayer records
 */
export function calculateCustomPrayerHours(
  prayers: CustomPrayer[],
  records: CustomPrayerRecord[]
): number {
  let totalHours = 0;
  
  for (const record of records) {
    if (record.status === 'Prayed') {
      const prayer = prayers.find(p => p.id === record.customPrayerId);
      if (prayer) {
        totalHours += calculatePrayerDuration(prayer.startTime, prayer.endTime);
      }
    }
  }
  
  return totalHours;
}

/**
 * Get custom prayer records for a specific date range
 */
export function getRecordsForDateRange(
  records: CustomPrayerRecord[],
  startDate: string,
  endDate: string
): CustomPrayerRecord[] {
  return records.filter(r => r.date >= startDate && r.date <= endDate);
}

/**
 * Format time display with overnight indicator
 */
export function formatPrayerTime(startTime: string, endTime: string): string {
  const duration = calculatePrayerDuration(startTime, endTime);
  const isOvernight = isOvernightPrayer(startTime, endTime);
  const durationStr = duration.toFixed(1) + 'h';
  
  if (isOvernight) {
    return `${startTime} → ${endTime} (${durationStr}) 🌙`;
  }
  
  return `${startTime} - ${endTime} (${durationStr})`;
}

/**
 * Get active days as a readable string
 */
export function getActiveDaysString(days: CustomPrayer['days']): string {
  const dayNames = {
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
    sunday: 'Sun'
  };
  
  const activeDays = Object.entries(days)
    .filter(([_, isActive]) => isActive)
    .map(([day]) => dayNames[day as keyof typeof dayNames]);
  
  if (activeDays.length === 0) return 'No days selected';
  if (activeDays.length === 7) return 'Every day';
  
  return activeDays.join(', ');
}

/**
 * Validate custom prayer data
 */
export function validateCustomPrayer(prayer: Partial<CustomPrayer>): string[] {
  const errors: string[] = [];
  
  if (!prayer.name || prayer.name.trim().length === 0) {
    errors.push('Prayer name is required');
  }
  
  if (prayer.name && prayer.name.length > 50) {
    errors.push('Prayer name must be 50 characters or less');
  }
  
  if (!prayer.category) {
    errors.push('Category is required');
  }
  
  if (prayer.category === 'Other' && (!prayer.customCategory || prayer.customCategory.trim().length === 0)) {
    errors.push('Custom category name is required when "Other" is selected');
  }
  
  if (!prayer.startTime || !prayer.endTime) {
    errors.push('Start and end times are required');
  }
  
  if (prayer.days) {
    const hasAtLeastOneDay = Object.values(prayer.days).some(day => day === true);
    if (!hasAtLeastOneDay) {
      errors.push('At least one day must be selected');
    }
  } else {
    errors.push('Days selection is required');
  }
  
  return errors;
}

/**
 * Create a default custom prayer object
 */
export function createDefaultCustomPrayer(memberId: string): Omit<CustomPrayer, 'id' | 'createdAt' | 'createdBy'> {
  return {
    memberId,
    name: '',
    category: 'Personal',
    days: {
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false
    },
    startTime: '05:00',
    endTime: '06:00',
    isActive: true
  };
}

/**
 * Get the next date when a custom prayer is active
 */
export function getNextActiveDate(prayer: CustomPrayer, fromDate: string = new Date().toISOString().slice(0, 10)): string | null {
  if (!prayer.isActive) return null;
  
  const date = new Date(fromDate + 'T00:00:00');
  
  // Check next 14 days
  for (let i = 0; i < 14; i++) {
    const checkDate = new Date(date);
    checkDate.setDate(date.getDate() + i);
    const dateStr = checkDate.toISOString().slice(0, 10);
    
    if (isPrayerActiveOnDate(prayer, dateStr)) {
      return dateStr;
    }
  }
  
  return null;
}

/**
 * Calculate total custom prayer hours for a member in a date range
 */
export function calculateTotalCustomHours(
  prayers: CustomPrayer[],
  records: CustomPrayerRecord[],
  memberId: string,
  startDate: string,
  endDate: string
): number {
  const memberPrayers = prayers.filter(p => p.memberId === memberId);
  const memberRecords = records.filter(r => 
    r.memberId === memberId && 
    r.date >= startDate && 
    r.date <= endDate &&
    r.status === 'Prayed'
  );
  
  return calculateCustomPrayerHours(memberPrayers, memberRecords);
}

