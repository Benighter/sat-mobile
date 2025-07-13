
import { TabOption, TabKeys } from './types';

// CONGREGATION_GROUPS is removed as Bacentas are now dynamic.

export const FIXED_TABS: TabOption[] = [
  { id: TabKeys.DASHBOARD, name: 'Dashboard' },
  { id: TabKeys.ALL_CONGREGATIONS, name: 'All Members' }, // ID remains, name updated
  { id: TabKeys.ALL_BACENTAS, name: 'All Bacentas' },
  { id: TabKeys.CRITICAL_MEMBERS, name: 'Critical Alerts' },
  { id: TabKeys.ATTENDANCE_ANALYTICS, name: 'Attendance Analytics' },
  { id: TabKeys.NEW_BELIEVERS, name: 'New Believers' },
  { id: TabKeys.PROFILE_SETTINGS, name: 'Profile Settings' },
];

export const CONSECUTIVE_ABSENCE_THRESHOLD = 2;

export const DEFAULT_TAB_ID = TabKeys.DASHBOARD;

// Ministry options for New Believers dropdown
export const MINISTRY_OPTIONS = [
  'Choir',
  'Dancing Stars',
  'Ushers',
  'Arrival Stars',
  'Airport Stars',
  'Media'
];
