
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

// Formats a YYYY-MM-DD string or Date object to a more readable long format
export const formatFullDate = (dateInput: string | Date): string => {
  const date = typeof dateInput === 'string' ? new Date(dateInput + 'T00:00:00') : dateInput;
   return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
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
