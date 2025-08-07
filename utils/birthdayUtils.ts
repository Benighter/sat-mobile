import { Member } from '../types';

export interface UpcomingBirthday {
  member: Member;
  birthday: string; // YYYY-MM-DD format
  age: number; // Age they will be turning
  daysUntil: number; // Days until birthday (0 for today)
  isToday: boolean;
  displayDate: string; // Formatted display date
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
  
  // Create this year's birthday
  const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  
  // If this year's birthday has passed, calculate for next year
  if (thisYearBirthday < today) {
    const nextYearBirthday = new Date(today.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate());
    const diffTime = nextYearBirthday.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  // Calculate days until this year's birthday
  const diffTime = thisYearBirthday.getTime() - today.getTime();
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
export const formatBirthdayDisplay = (birthday: string, showYear: boolean = false): string => {
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
  
  return birthDate.toLocaleDateString('en-US', options);
};

/**
 * Get upcoming birthdays based on the specified logic:
 * - Current month birthdays
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
      const age = calculateAge(member.birthday, today) + 1; // Age they will be turning
      const isToday = isBirthdayToday(member.birthday, today);
      const displayDate = formatBirthdayDisplay(member.birthday);
      
      upcomingBirthdays.push({
        member,
        birthday: member.birthday,
        age,
        daysUntil,
        isToday,
        displayDate
      });
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
