
import { TabOption, TabKeys } from './types';

// CONGREGATION_GROUPS is removed as Bacentas are now dynamic.

export const FIXED_TABS: TabOption[] = [
  { id: TabKeys.DASHBOARD, name: 'Dashboard' },
  { id: TabKeys.ALL_CONGREGATIONS, name: 'All Members' }, // ID remains, name updated
  { id: TabKeys.ALL_BACENTAS, name: 'All Bacenta Leaders' },
  { id: TabKeys.ATTENDANCE_ANALYTICS, name: 'Attendance Analytics' },
  { id: TabKeys.WEEKLY_ATTENDANCE, name: 'Weekly Attendance' },
  { id: TabKeys.SUNDAY_CONFIRMATIONS, name: 'Sunday Confirmations' },
  { id: TabKeys.NEW_BELIEVERS, name: 'New Believers' },
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
  'Choir',
  'Dancing Stars',
  'Ushers',
  'Arrival Stars',
  'Airport Stars',
  'Media'
];
