
import { TabOption, TabKeys } from './types';

// CONGREGATION_GROUPS is removed as Bacentas are now dynamic.

export const FIXED_TABS: TabOption[] = [
  { id: TabKeys.DASHBOARD, name: 'Dashboard' },
  { id: TabKeys.ALL_CONGREGATIONS, name: 'All Members' }, // ID remains, name updated
  { id: TabKeys.CRITICAL_MEMBERS, name: 'Critical Alerts' },
];

export const CONSECUTIVE_ABSENCE_THRESHOLD = 2;

export const DEFAULT_TAB_ID = TabKeys.DASHBOARD;
