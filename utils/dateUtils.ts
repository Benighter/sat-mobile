
// Returns Sunday dates (as YYYY-MM-DD strings) for a given month and year
export const getSundaysOfMonth = (year: number, month: number): string[] => {
  const sundays: string[] = [];
  const date = new Date(year, month, 1);
  
  // Find the first Sunday
  while (date.getDay() !== 0) { // 0 is Sunday
    date.setDate(date.getDate() + 1);
    if (date.getMonth() !== month) return sundays; // Moved to next month
  }

  // Add all Sundays in the month
  while (date.getMonth() === month) {
    sundays.push(formatDateToYYYYMMDD(new Date(date.getTime())));
    date.setDate(date.getDate() + 7);
  }
  return sundays;
};

// Formats a Date object to 'YYYY-MM-DD'
export const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Formats a YYYY-MM-DD string to 'Sun MM/DD' or 'Mon DD/MM' etc.
export const formatDisplayDate = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00'); // Ensure parsing as local date
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
};

// Formats an ISO date string (with time) to a readable date format
export const formatISODate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// Formats a YYYY-MM-DD string or Date object to a more readable long format
export const formatFullDate = (dateInput: string | Date): string => {
  const date = typeof dateInput === 'string' ? new Date(dateInput + 'T00:00:00') : dateInput;
   return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
};

// Formats a YYYY-MM-DD string or Date object to an abbreviated format (e.g., "Sun, Aug 10, 2025")
export const formatAbbreviatedDate = (dateInput: string | Date): string => {
  const date = typeof dateInput === 'string' ? new Date(dateInput + 'T00:00:00') : dateInput;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' });
};

// Formats a YYYY-MM-DD string or Date object to a compact format (e.g., "Sun Aug 10, 2025")
export const formatCompactDate = (dateInput: string | Date): string => {
  const date = typeof dateInput === 'string' ? new Date(dateInput + 'T00:00:00') : dateInput;
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    weekday: 'short'
  };
  // Remove comma after weekday for more compact display
  return date.toLocaleDateString(undefined, options).replace(/,\s/, ' ');
};

// Formats a YYYY-MM-DD string to a display format like 'Jan 15, 2024'
export const formatDateToDisplay = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00'); // Ensure parsing as local date
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export const isSameDate = (date1Str: string, date2Str: string): boolean => {
  return date1Str === date2Str;
};

export const getTodayYYYYMMDD = (): string => {
  return formatDateToYYYYMMDD(new Date());
};

export const getMonthName = (monthIndex: number): string => {
  const date = new Date();
  date.setMonth(monthIndex);
  return date.toLocaleString('default', { month: 'long' });
}

// Get the current Sunday if today is Sunday, otherwise get the most recent past Sunday
export const getCurrentOrMostRecentSunday = (): string => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

  if (dayOfWeek === 0) {
    // Today is Sunday
    return formatDateToYYYYMMDD(today);
  } else {
    // Go back to the most recent Sunday
    const daysToSubtract = dayOfWeek;
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - daysToSubtract);
    return formatDateToYYYYMMDD(lastSunday);
  }
};

// Get the next Sunday from a given date
export const getNextSunday = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00');
  date.setDate(date.getDate() + 7);
  return formatDateToYYYYMMDD(date);
};

// Get the previous Sunday from a given date
export const getPreviousSunday = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00');
  date.setDate(date.getDate() - 7);
  return formatDateToYYYYMMDD(date);
};

// Get the next upcoming Sunday (if today is Monday, return next Sunday; if today is Sunday, return today)
export const getUpcomingSunday = (): string => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

  if (dayOfWeek === 0) {
    // Today is Sunday, return today's date
    return formatDateToYYYYMMDD(today);
  } else if (dayOfWeek === 1) {
    // Today is Monday, get next Sunday (6 days ahead)
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + 6);
    return formatDateToYYYYMMDD(nextSunday);
  } else {
    // Get the upcoming Sunday
    const daysUntilSunday = 7 - dayOfWeek;
    const upcomingSunday = new Date(today);
    upcomingSunday.setDate(today.getDate() + daysUntilSunday);
    return formatDateToYYYYMMDD(upcomingSunday);
  }
};

// Get the Tuesday of the week containing the given anchor date.
// Weeks are considered Tue..Sun for Prayer tracking.
export const getTuesdayOfWeek = (anchor: string | Date = new Date()): string => {
  const d = typeof anchor === 'string' ? new Date(anchor + 'T00:00:00') : new Date(anchor);
  const day = d.getDay(); // 0..6 (Sun..Sat)
  // Compute offset from current day to Tuesday (2)
  // For Sunday(0) and Monday(1), go back to previous Tuesday (-5 and -6 respectively)
  let diff = 2 - day;
  if (day === 0) diff = -5; // Sun -> previous Tue
  if (day === 1) diff = -6; // Mon -> previous Tue
  const tuesday = new Date(d);
  tuesday.setDate(d.getDate() + diff);
  return formatDateToYYYYMMDD(tuesday);
};

// Return an array of YYYY-MM-DD strings for Tue..Sun for the week of the given anchor date
export const getTuesdayToSundayRange = (anchor: string | Date = new Date()): string[] => {
  const tue = getTuesdayOfWeek(anchor);
  const start = new Date(tue + 'T00:00:00');
  const days: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(formatDateToYYYYMMDD(d));
  }
  return days; // Tue..Sun (6 days)
};

// Helpers to navigate to previous/next Tue..Sun week window
export const getPreviousPrayerWeekAnchor = (anchor: string): string => {
  const a = new Date(anchor + 'T00:00:00');
  a.setDate(a.getDate() - 7);
  return formatDateToYYYYMMDD(a);
};

export const getNextPrayerWeekAnchor = (anchor: string): string => {
  const a = new Date(anchor + 'T00:00:00');
  a.setDate(a.getDate() + 7);
  return formatDateToYYYYMMDD(a);
};
