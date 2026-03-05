import { Member } from '../types';

export interface UpcomingBirthday {
  member: Member;
  birthday: string; // YYYY-MM-DD format
  age: number; // Age they turned or will be turning
  daysUntil: number; // Days until next birthday (0 for today, negative for passed)
  isToday: boolean;
  displayDate: string; // Formatted display date
  // True when this year's occurrence of the birthday has already passed
  hasPassedThisYear: boolean;
  // Days since this year's occurrence (only when hasPassedThisYear is true)
  daysSince?: number;
  // ISO string for next occurrence date (YYYY-MM-DD)
  nextOccurrenceDate?: string;
  // Current age (what they are today)
  currentAge: number;
}

/**
 * Calculate age based on birthday and target date
 */
export const calculateAge = (birthday: string, targetDate: Date = new Date()): number => {
  const birthDate = new Date(birthday);
  const today = new Date(targetDate);
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Calculate days until next birthday
 */
export const calculateDaysUntilBirthday = (birthday: string, fromDate: Date = new Date()): number => {
  const birthDate = new Date(birthday);
  const today = new Date(fromDate);
  // Normalize to midnight to avoid off-by-one due to time of day
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Handle Feb 29 logic for non-leap years using helper
  const targetYear = todayMidnight.getFullYear();
  const month = birthDate.getMonth();
  const day = birthDate.getDate();
  let thisYearMonth = month;
  let thisYearDay = day;
  if (month === 1 && day === 29) {
    const leapHandled = getLeapYearBirthdayDate(birthday, targetYear);
    const d2 = new Date(leapHandled);
    thisYearMonth = d2.getMonth();
    thisYearDay = d2.getDate();
  }

  const thisYearBirthday = new Date(targetYear, thisYearMonth, thisYearDay);
  if (thisYearBirthday < todayMidnight) {
    // Next year's occurrence (also handle leap-year mapping)
    const nextYear = targetYear + 1;
    const nextDateStr = getLeapYearBirthdayDate(birthday, nextYear);
    const nextYearBirthday = new Date(nextDateStr);
    const diffTime = nextYearBirthday.getTime() - todayMidnight.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  const diffTime = thisYearBirthday.getTime() - todayMidnight.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Check if a birthday is today
 */
export const isBirthdayToday = (birthday: string, checkDate: Date = new Date()): boolean => {
  const birthDate = new Date(birthday);
  const today = new Date(checkDate);
  
  return birthDate.getMonth() === today.getMonth() && 
         birthDate.getDate() === today.getDate();
};

/**
 * Format birthday for display (e.g., "March 15" or "Today")
 */
export const formatBirthdayDisplay = (birthday: string, showYear: boolean = false, hasPassedThisYear: boolean = false): string => {
  const birthDate = new Date(birthday);
  const today = new Date();
  
  if (isBirthdayToday(birthday, today)) {
    return 'Today';
  }
  
  const options: Intl.DateTimeFormatOptions = { 
    month: 'long', 
    day: 'numeric' 
  };
  
  if (showYear) {
    options.year = 'numeric';
  }
  
  const dateString = birthDate.toLocaleDateString('en-US', options);
  
  // Add "Passed" indicator for birthdays that have already occurred this year
  if (hasPassedThisYear) {
    return `${dateString} (Passed)`;
  }
  
  return dateString;
};

/**
 * Get upcoming birthdays based on the specified logic:
 * - Current month birthdays (only future ones, not passed)
 * - Next 7 days if we're near month-end
 */
export const getUpcomingBirthdays = (members: Member[], referenceDate: Date = new Date()): UpcomingBirthday[] => {
  const today = new Date(referenceDate);
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const currentDate = today.getDate();
  
  // Get last day of current month
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const isNearMonthEnd = currentDate > lastDayOfMonth - 7;
  
  const upcomingBirthdays: UpcomingBirthday[] = [];
  
  members.forEach(member => {
    if (!member.birthday) return;
    
    const birthDate = new Date(member.birthday);
    const birthMonth = birthDate.getMonth();
    const birthDay = birthDate.getDate();
    
    // Check if birthday is in current month
    const isCurrentMonth = birthMonth === currentMonth;
    
    // Check if birthday is in next month but within 7 days
    const nextMonth = (currentMonth + 1) % 12;
    const isNextMonthWithin7Days = isNearMonthEnd && birthMonth === nextMonth && birthDay <= 7;
    
    if (isCurrentMonth || isNextMonthWithin7Days) {
      const daysUntil = calculateDaysUntilBirthday(member.birthday, today);
      const isToday = isBirthdayToday(member.birthday, today);

      // Determine this year's occurrence and whether it's passed
      const thisYearOccurrence = new Date(currentYear, birthMonth, birthDay);
      const todayMidnight = new Date(currentYear, today.getMonth(), today.getDate());
      const hasPassedThisYear = thisYearOccurrence < todayMidnight;
      
      // Only include if it's today or hasn't passed yet (upcoming only)
      if (isToday || !hasPassedThisYear) {
        const daysSince = hasPassedThisYear
          ? Math.ceil((todayMidnight.getTime() - thisYearOccurrence.getTime()) / (1000 * 60 * 60 * 24))
          : undefined;

        // Compute age they will be turning on the next occurrence date
        const nextYear = hasPassedThisYear ? currentYear + 1 : currentYear;
        const nextOccurrenceStr = getLeapYearBirthdayDate(member.birthday, nextYear);
        const nextOccurrenceDate = new Date(nextOccurrenceStr);
        const ageOnNextBirthday = calculateAge(member.birthday, nextOccurrenceDate);
        const currentAge = calculateAge(member.birthday, today);
        const displayDate = formatBirthdayDisplay(member.birthday, false, hasPassedThisYear);
        
        upcomingBirthdays.push({
          member,
          birthday: member.birthday,
          age: hasPassedThisYear ? currentAge : ageOnNextBirthday,
          daysUntil,
          isToday,
          displayDate,
          hasPassedThisYear,
          daysSince,
          nextOccurrenceDate: nextOccurrenceStr,
          currentAge
        });
      }
    }
  });
  
  // Sort by days until birthday (today first, then chronologically)
  return upcomingBirthdays.sort((a, b) => {
    if (a.isToday && !b.isToday) return -1;
    if (!a.isToday && b.isToday) return 1;
    return a.daysUntil - b.daysUntil;
  });
};

/**
 * Get birthdays for a specific month (based on provided referenceDate's month)
 * - Shows all birthdays in the selected month (no next-7-days spillover)
 * - Computes daysUntil relative to the provided referenceDate
 */
export const getBirthdaysForMonth = (members: Member[], referenceDate: Date = new Date()): UpcomingBirthday[] => {
  // We always compute relative to "today" to show accurate remaining days
  const today = new Date();
  const targetMonth = new Date(referenceDate).getMonth();
  const targetYear = new Date(referenceDate).getFullYear();
  const currentYear = today.getFullYear();

  const monthBirthdays: UpcomingBirthday[] = [];

  members.forEach(member => {
    if (!member.birthday) return;

    const birthDate = new Date(member.birthday);
    const birthMonth = birthDate.getMonth();
    const birthDay = birthDate.getDate();

    if (birthMonth !== targetMonth) return;

    // For the target month/year, has this birthday already occurred?
    let hasPassedThisYear = false;
    let thisYearOccurrence: Date;
    
    // If we're viewing the current year
    if (targetYear === currentYear) {
      thisYearOccurrence = new Date(currentYear, birthMonth, birthDay);
      const todayMidnight = new Date(currentYear, today.getMonth(), today.getDate());
      hasPassedThisYear = thisYearOccurrence < todayMidnight;
    } else {
      // If viewing a different year, nothing has "passed this year" in that context
      thisYearOccurrence = new Date(targetYear, birthMonth, birthDay);
      hasPassedThisYear = false;
    }

    // Determine next occurrence year for accurate age and daysUntil
    const nextOccurrenceYear = hasPassedThisYear ? currentYear + 1 : Math.max(targetYear, currentYear);
    const nextOccurrenceDate = new Date(nextOccurrenceYear, birthMonth, birthDay);

    const daysUntil = Math.ceil((nextOccurrenceDate.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / (1000 * 60 * 60 * 24));
    const isToday = isBirthdayToday(member.birthday, today);
    const ageOnNextBirthday = calculateAge(member.birthday, nextOccurrenceDate);
    const currentAge = calculateAge(member.birthday, today);
    const displayDate = formatBirthdayDisplay(member.birthday, false, hasPassedThisYear);

    monthBirthdays.push({
      member,
      birthday: member.birthday,
      age: hasPassedThisYear ? currentAge : ageOnNextBirthday,
      daysUntil,
      isToday,
      displayDate,
      hasPassedThisYear,
      currentAge
    });
  });

  // Sort chronologically by the next occurrence date
  return monthBirthdays.sort((a, b) => a.daysUntil - b.daysUntil);
};

/**
 * Handle leap year birthdays (February 29th)
 * Returns the appropriate date to celebrate in non-leap years
 */
export const getLeapYearBirthdayDate = (birthday: string, targetYear: number): string => {
  const birthDate = new Date(birthday);
  
  // If not February 29th, return as is
  if (birthDate.getMonth() !== 1 || birthDate.getDate() !== 29) {
    return birthday;
  }
  
  // Check if target year is a leap year
  const isLeapYear = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
  
  if (isLeapYear) {
    return `${targetYear}-02-29`;
  } else {
    // Celebrate on February 28th in non-leap years
    return `${targetYear}-02-28`;
  }
};

/**
 * Get birthday statistics
 */
export const getBirthdayStats = (members: Member[]) => {
  const membersWithBirthdays = members.filter(member => member.birthday);
  const upcomingBirthdays = getUpcomingBirthdays(members);
  const todaysBirthdays = upcomingBirthdays.filter(b => b.isToday);
  
  return {
    totalMembersWithBirthdays: membersWithBirthdays.length,
    upcomingCount: upcomingBirthdays.length,
    todayCount: todaysBirthdays.length,
    percentageWithBirthdays: members.length > 0 ? Math.round((membersWithBirthdays.length / members.length) * 100) : 0
  };
};

/**
 * Group birthdays by month for analytics
 */
export const groupBirthdaysByMonth = (members: Member[]) => {
  const monthGroups: { [key: number]: Member[] } = {};
  
  members.forEach(member => {
    if (!member.birthday) return;
    
    const birthDate = new Date(member.birthday);
    const month = birthDate.getMonth();
    
    if (!monthGroups[month]) {
      monthGroups[month] = [];
    }
    
    monthGroups[month].push(member);
  });
  
  return monthGroups;
};
