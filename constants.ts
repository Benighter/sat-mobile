
import { TabOption, TabKeys, MemberRole } from './types';

// CONGREGATION_GROUPS is removed as Bacentas are now dynamic.

// Role display name mapping - converts database role values to user-facing labels
export const getRoleDisplayName = (role: MemberRole, plural: boolean = false): string => {
  switch (role) {
    case 'Bacenta Leader':
      return plural ? 'Green Bacentas' : 'Green Bacenta';
    case 'Fellowship Leader':
      return plural ? 'Red Bacentas' : 'Red Bacenta';
    case 'Assistant':
      return plural ? 'Assistants' : 'Assistant';
    case 'Admin':
      return plural ? 'Admins' : 'Admin';
    case 'Member':
      return plural ? 'Members' : 'Member';
    default:
      return role;
  }
};

export const FIXED_TABS: TabOption[] = [
  { id: TabKeys.DASHBOARD, name: 'Dashboard' },
  { id: TabKeys.ALL_CONGREGATIONS, name: 'All Members' }, // ID remains, name updated
  { id: TabKeys.ALL_BACENTAS, name: 'All Green Bacentas' },
  { id: TabKeys.ATTENDANCE_ANALYTICS, name: 'Attendance Analytics' },
  { id: TabKeys.WEEKLY_ATTENDANCE, name: 'Weekly Attendance' },
  { id: TabKeys.SUNDAY_HEAD_COUNTS, name: 'Sunday Head counts' },
  { id: TabKeys.SUNDAY_HEAD_COUNT_SECTION, name: 'Head Count Section' },
  { id: TabKeys.SUNDAY_CONFIRMATIONS, name: 'Sunday Confirmations' },
  { id: TabKeys.PRAYER, name: 'Prayer' },
  { id: TabKeys.NEW_BELIEVERS, name: 'Born Again' },
  { id: TabKeys.SONS_OF_GOD, name: 'Sons of God' },
  { id: TabKeys.OUTREACH, name: 'Outreach' },
  { id: TabKeys.BACENTA_MEETINGS, name: 'Bacenta Meetings' },
  { id: TabKeys.BIRTHDAYS, name: 'Birthdays' },
  { id: TabKeys.PROFILE_SETTINGS, name: 'Profile Settings' },
  { id: TabKeys.MINISTRIES, name: 'Ministries' },
  { id: TabKeys.BIDIRECTIONAL_SYNC_TEST, name: 'Bidirectional Sync Test' },
  { id: TabKeys.CONTACT, name: 'Contact' },
  { id: TabKeys.ASSIGNMENT_MANAGEMENT, name: 'Assignment Management' },
  { id: TabKeys.LEADER_HIERARCHY, name: 'Leader Hierarchy' },
];

export const DEFAULT_TAB_ID = TabKeys.DASHBOARD;

// Default church configuration
export const DEFAULT_CHURCH = {
  ID: 'first-love-church',
  NAME: 'First Love Church'
};

// Ministry options for member assignment (used in forms)
export const MINISTRY_OPTIONS: string[] = [
  'Choir',
  'Dancing Stars',
  'Ushers',
  'Airport Stars',
  'Arrival Stars',
  'Media',
];

// Ministry-specific role label generator
export const getMinistryRoleLabels = (ministryName?: string) => {
  const name = (ministryName || '').trim();
  const key = name.toLowerCase();
  switch (key) {
    case 'ushers':
      return { head: 'Ministry Head', leader: 'Ministry Leader', assistant: 'Ministry Assistant', member: 'Ministry Member', admin: 'Ministry Admin' };
    case 'choir':
      return { head: 'Ministry Head', leader: 'Ministry Leader', assistant: 'Ministry Assistant', member: 'Ministry Member', admin: 'Ministry Admin' };
    case 'youth':
      return { head: 'Ministry Head', leader: 'Ministry Leader', assistant: 'Ministry Assistant', member: 'Ministry Member', admin: 'Ministry Admin' };
    case 'media':
      return { head: 'Ministry Head', leader: 'Ministry Leader', assistant: 'Ministry Assistant', member: 'Ministry Member', admin: 'Ministry Admin' };
    case 'dancing stars':
      return { head: 'Ministry Head', leader: 'Ministry Leader', assistant: 'Ministry Assistant', member: 'Ministry Member', admin: 'Ministry Admin' };
    default: {
      // Generic labels across all ministries
      return { head: 'Ministry Head', leader: 'Ministry Leader', assistant: 'Ministry Assistant', member: 'Ministry Member', admin: 'Ministry Admin' };
    }
  }
};


export const getVariantDisplayNameKey = (): string => {
  // Kept for backward compatibility; returns single unified key
  return `app.displayName.sat`;
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

// Resolve primary external Email API URL from globals or localStorage.
// If not set, client code should fall back to Firebase callable.
export const getPrimaryEmailApiUrl = (): string | undefined => {
  try {
    const g: any = (globalThis as any) || {};
    const fromGlobal = g.__PRIMARY_EMAIL_API_URL__ || g.__EMAIL_API_URL__;
    if (typeof fromGlobal === 'string' && fromGlobal.trim()) return fromGlobal.trim();
    if (typeof window !== 'undefined') {
      const fromLs =
        window.localStorage.getItem('PRIMARY_EMAIL_API_URL') ||
        window.localStorage.getItem('EMAIL_API_URL');
      if (fromLs && fromLs.trim()) return fromLs.trim();
    }
  } catch {}
  return undefined;
};

// Optional API key for the external Email API, read from globals or localStorage.
export const getPrimaryEmailApiKey = (): string | undefined => {
  try {
    const g: any = (globalThis as any) || {};
    const fromGlobal = g.__PRIMARY_EMAIL_API_KEY__ || g.__EMAIL_API_KEY__;
    if (typeof fromGlobal === 'string' && fromGlobal.trim()) return fromGlobal.trim();
    if (typeof window !== 'undefined') {
      const fromLs =
        window.localStorage.getItem('PRIMARY_EMAIL_API_KEY') ||
        window.localStorage.getItem('EMAIL_API_KEY');
      if (fromLs && fromLs.trim()) return fromLs.trim();
    }
  } catch {}
  return undefined;
};
