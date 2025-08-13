
import { TabOption, TabKeys } from './types';

// CONGREGATION_GROUPS is removed as Bacentas are now dynamic.

export const FIXED_TABS: TabOption[] = [
  { id: TabKeys.DASHBOARD, name: 'Dashboard' },
  { id: TabKeys.ALL_CONGREGATIONS, name: 'All Members' }, // ID remains, name updated
  { id: TabKeys.ALL_BACENTAS, name: 'All Bacenta Leaders' },
  { id: TabKeys.ATTENDANCE_ANALYTICS, name: 'Attendance Analytics' },
  { id: TabKeys.WEEKLY_ATTENDANCE, name: 'Weekly Attendance' },
  { id: TabKeys.SUNDAY_CONFIRMATIONS, name: 'Sunday Confirmations' },
  { id: TabKeys.PRAYER, name: 'Prayer' },
  { id: TabKeys.NEW_BELIEVERS, name: 'Born Again' },
  { id: TabKeys.OUTREACH, name: 'Outreach' },
  { id: TabKeys.BIRTHDAYS, name: 'Birthdays' },
  { id: TabKeys.PROFILE_SETTINGS, name: 'Profile Settings' },
];

export const DEFAULT_TAB_ID = TabKeys.DASHBOARD;

// Default church configuration
export const DEFAULT_CHURCH = {
  ID: 'first-love-church',
  NAME: 'First Love Church'
};

// Ministry options for New Believers dropdown
export const MINISTRY_OPTIONS = [
  'GLGC',
  'Choir',
  'Dancing Stars',
  'Ushers',
  'Arrival Stars',
  'Airport Stars',
  'Media'
];

export const isMinistryVariant = (): boolean => {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).__APP_VARIANT__ === 'ministry') return true;
    if (typeof window !== 'undefined' && window.location.pathname.includes('ministry')) return true;
  } catch {}
  return false;
};

export const getVariantDisplayNameKey = (): string => {
  return `app.displayName.${isMinistryVariant() ? 'ministry' : 'sat'}`;
};

// Resolve app display name from variant-specific key
export const getAppDisplayName = (fallback: string = 'SAT Mobile'): string => {
  try {
    const g: any = (globalThis as any) || {};
    if (g.__APP_NAME__) return g.__APP_NAME__;
    if (typeof window !== 'undefined') {
      const key = getVariantDisplayNameKey();
      const stored = window.localStorage.getItem(key);
      if (stored) return stored;
    }
  } catch {}
  return fallback;
};
