
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
  // Sunday stays in the current Tue–Sun week (use previous Tuesday);
  // Monday starts the new week at 00:00 (use next Tuesday)
  let diff = 2 - day;
  if (day === 0) diff = -5; // Sun -> previous Tue (end of current week)
  else if (day === 1) diff = 1; // Mon -> next Tue (start of new week)
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

// BACENTA MEETINGS DATE UTILITIES - Wednesday/Thursday focused
// These functions handle the specific logic for Bacenta Meetings which occur on Wed/Thu

// Get the current meeting week's Wednesday date
// Meeting weeks run Wednesday to Thursday
export const getCurrentMeetingWeek = (): string => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

  // Calculate days to get to this week's Wednesday
  let daysToWednesday: number;

  switch (dayOfWeek) {
    case 0: // Sunday - go forward 3 days to Wednesday
      daysToWednesday = 3;
      break;
    case 1: // Monday - go forward 2 days to Wednesday
      daysToWednesday = 2;
      break;
    case 2: // Tuesday - go forward 1 day to Wednesday
      daysToWednesday = 1;
      break;
    case 3: // Wednesday - today is Wednesday
      daysToWednesday = 0;
      break;
    case 4: // Thursday - go back 1 day to Wednesday
      daysToWednesday = -1;
      break;
    case 5: // Friday - go back 2 days to Wednesday
      daysToWednesday = -2;
      break;
    case 6: // Saturday - go back 3 days to Wednesday
      daysToWednesday = -3;
      break;
    default:
      daysToWednesday = 0;
  }

  const wednesday = new Date(today);
  wednesday.setDate(today.getDate() + daysToWednesday);
  wednesday.setHours(0, 0, 0, 0);

  return formatDateToYYYYMMDD(wednesday);
};

// Get the latest meeting day (most recent past or today) between Wednesday and Thursday
// Rules:
// - If today is Wednesday -> return today's Wednesday
// - If today is Thursday -> return today's Thursday
// - If today is Monday or Tuesday -> return the upcoming Wednesday of the current week
// - Otherwise (Fri, Sat, Sun) -> return the most recent Thursday in the past
export const getLatestMeetingDay = (): string => {
  const today = new Date();
  const day = today.getDay(); // 0..6 (Sun..Sat)

  // New behaviour: from Monday/Tuesday, reset to this week's upcoming Wednesday
  if (day === 1) { // Monday
    const nextWed = new Date(today);
    nextWed.setDate(today.getDate() + 2);
    nextWed.setHours(0, 0, 0, 0);
    return formatDateToYYYYMMDD(nextWed);
  }
  if (day === 2) { // Tuesday
    const nextWed = new Date(today);
    nextWed.setDate(today.getDate() + 1);
    nextWed.setHours(0, 0, 0, 0);
    return formatDateToYYYYMMDD(nextWed);
  }

  if (day === 3) {
    // Wednesday
    today.setHours(0, 0, 0, 0);
    return formatDateToYYYYMMDD(today);
  }
  if (day === 4) {
    // Thursday
    today.setHours(0, 0, 0, 0);
    return formatDateToYYYYMMDD(today);
  }

  // Compute last Thursday
  const diffToLastThursday = (day - 4 + 7) % 7; // days since last Thu
  const lastThu = new Date(today);
  lastThu.setDate(today.getDate() - diffToLastThursday);
  lastThu.setHours(0, 0, 0, 0);
  return formatDateToYYYYMMDD(lastThu);
};

// Get Wednesday and Thursday dates for a given Wednesday date
export const getMeetingWeekDates = (wednesdayDate: string): { wednesday: string; thursday: string } => {
  const wed = new Date(wednesdayDate + 'T00:00:00');
  const thu = new Date(wed);
  thu.setDate(wed.getDate() + 1);

  return {
    wednesday: formatDateToYYYYMMDD(wed),
    thursday: formatDateToYYYYMMDD(thu)
  };
};

// Get array of [Wednesday, Thursday] dates for a given Wednesday
export const getMeetingWeekRange = (wednesdayDate: string): string[] => {
  const dates = getMeetingWeekDates(wednesdayDate);
  return [dates.wednesday, dates.thursday];
};

// Navigate to next meeting week (next Wednesday)
export const getNextMeetingWeek = (currentWednesday: string): string => {
  const wed = new Date(currentWednesday + 'T00:00:00');
  wed.setDate(wed.getDate() + 7); // Add 7 days to get next Wednesday
  return formatDateToYYYYMMDD(wed);
};

// Navigate to previous meeting week (previous Wednesday)
export const getPreviousMeetingWeek = (currentWednesday: string): string => {
  const wed = new Date(currentWednesday + 'T00:00:00');
  wed.setDate(wed.getDate() - 7); // Subtract 7 days to get previous Wednesday
  return formatDateToYYYYMMDD(wed);
};

// WEEKLY TOTALS DATE UTILITIES - Monday to Sunday focused
// These functions handle weekly totals that accumulate Monday through Sunday 23:59, then reset on Monday

// Get the current week's Monday date (Monday-based week)
export const getCurrentWeekMonday = (): string => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

  // Calculate days to get to this week's Monday
  let daysToMonday: number;

  switch (dayOfWeek) {
    case 0: // Sunday - go back 6 days to Monday
      daysToMonday = -6;
      break;
    case 1: // Monday - today is Monday
      daysToMonday = 0;
      break;
    case 2: // Tuesday - go back 1 day to Monday
      daysToMonday = -1;
      break;
    case 3: // Wednesday - go back 2 days to Monday
      daysToMonday = -2;
      break;
    case 4: // Thursday - go back 3 days to Monday
      daysToMonday = -3;
      break;
    case 5: // Friday - go back 4 days to Monday
      daysToMonday = -4;
      break;
    case 6: // Saturday - go back 5 days to Monday
      daysToMonday = -5;
      break;
    default:
      daysToMonday = 0;
  }

  const monday = new Date(today);
  monday.setDate(today.getDate() + daysToMonday);
  monday.setHours(0, 0, 0, 0);

  return formatDateToYYYYMMDD(monday);
};

// Get Monday through Sunday dates for a given Monday date
export const getWeeklyTotalsDates = (mondayDate: string): { monday: string; tuesday: string; wednesday: string; thursday: string; friday: string; saturday: string; sunday: string } => {
  const mon = new Date(mondayDate + 'T00:00:00');

  const dates = {
    monday: formatDateToYYYYMMDD(mon),
    tuesday: formatDateToYYYYMMDD(new Date(mon.getTime() + 24 * 60 * 60 * 1000)),
    wednesday: formatDateToYYYYMMDD(new Date(mon.getTime() + 2 * 24 * 60 * 60 * 1000)),
    thursday: formatDateToYYYYMMDD(new Date(mon.getTime() + 3 * 24 * 60 * 60 * 1000)),
    friday: formatDateToYYYYMMDD(new Date(mon.getTime() + 4 * 24 * 60 * 60 * 1000)),
    saturday: formatDateToYYYYMMDD(new Date(mon.getTime() + 5 * 24 * 60 * 60 * 1000)),
    sunday: formatDateToYYYYMMDD(new Date(mon.getTime() + 6 * 24 * 60 * 60 * 1000))
  };

  return dates;
};

// Get array of Monday through Sunday dates for a given Monday
export const getWeeklyTotalsRange = (mondayDate: string): string[] => {
  const dates = getWeeklyTotalsDates(mondayDate);
  return [dates.monday, dates.tuesday, dates.wednesday, dates.thursday, dates.friday, dates.saturday, dates.sunday];
};

// Legacy functions for backward compatibility (redirecting to new functions)
export const getWednesdayOfWeek = (anchor: string | Date = new Date()): string => {
  if (typeof anchor === 'string') {
    // If given a specific date, find that week's Wednesday
    const date = new Date(anchor + 'T00:00:00');
    const dayOfWeek = date.getDay();
    const daysToWednesday = 3 - dayOfWeek; // Wednesday is day 3
    const wednesday = new Date(date);
    wednesday.setDate(date.getDate() + daysToWednesday);
    return formatDateToYYYYMMDD(wednesday);
  } else {
    // If no anchor provided, get current meeting week
    return getCurrentMeetingWeek();
  }
};

export const getWednesdayToThursdayRange = (anchor: string | Date = new Date()): string[] => {
  const wednesday = getWednesdayOfWeek(anchor);
  return getMeetingWeekRange(wednesday);
};
