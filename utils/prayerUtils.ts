// Utilities for Prayer feature

// Returns session info for a given date string (YYYY-MM-DD)
export function getPrayerSessionInfo(date: string): { start: string; end: string; hours: number } {
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

export function getPrayerHoursForDate(date: string): number {
  return getPrayerSessionInfo(date).hours;
}
