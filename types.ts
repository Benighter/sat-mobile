
export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  buildingAddress: string;
  bornAgainStatus: boolean;
  bacentaId: string; // Renamed from congregationGroup, stores Bacenta.id, empty if unassigned
  joinedDate: string; // ISO string, YYYY-MM-DD from form
  createdDate: string; // ISO string
  lastUpdated: string; // ISO string
}

export interface NewBeliever {
  id: string;
  name: string; // Required field
  surname: string;
  contact: string;
  dateOfBirth: string; // ISO string, YYYY-MM-DD
  residence: string;
  studies: string;
  campus: string;
  occupation: string;
  year: string;
  isFirstTime: boolean; // First Time? boolean field
  ministry: string; // Ministry dropdown selection
  joinedDate: string; // Date they joined as new believer, ISO string YYYY-MM-DD
  createdDate: string; // ISO string
  lastUpdated: string; // ISO string
}

export type AttendanceStatus = 'Present' | 'Absent';

export interface AttendanceRecord {
  id: string; // memberId_date (YYYY-MM-DD) or newBelieverId_date (YYYY-MM-DD)
  memberId?: string; // For regular members
  newBelieverId?: string; // For new believers
  date: string; // Sunday date as YYYY-MM-DD
  status: AttendanceStatus;
}

export interface Bacenta { // Renamed from CongregationGroup
  id: string;
  name: string;
}

export interface TabOption {
  id: string; 
  name: string;
}

export enum TabKeys {
  DASHBOARD = 'dashboard',
  ALL_CONGREGATIONS = 'all_members', // Kept ID for now, name will change in FIXED_TABS
  ALL_BACENTAS = 'all_bacentas',
  CRITICAL_MEMBERS = 'critical_members',
  ATTENDANCE_ANALYTICS = 'attendance_analytics',
  NEW_BELIEVERS = 'new_believers',
}

export interface NavigationHistoryItem {
  tabId: string;
  timestamp: number;
  data?: any; // For storing additional context like bacenta filters
}

export interface NavigationHistoryItem {
  tabId: string;
  timestamp: number;
  data?: any; // For storing additional context like bacenta filters
}
