
export type MemberRole = 'Member' | 'Fellowship Leader' | 'Bacenta Leader';

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  buildingAddress: string;
  bornAgainStatus: boolean;
  bacentaId: string; // Renamed from congregationGroup, stores Bacenta.id, empty if unassigned
  bacentaLeaderId?: string; // For Fellowship Leaders: ID of the Bacenta Leader they report to
  role: MemberRole; // Role assignment: Member (default), Fellowship Leader, or Bacenta Leader
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
  WEEKLY_ATTENDANCE = 'weekly_attendance',
  NEW_BELIEVERS = 'new_believers',
  PROFILE_SETTINGS = 'profile_settings',
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

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  allowEditPreviousSundays: boolean;
}

export interface User {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  profilePicture?: string;
  churchId: string;
  churchName?: string;
  role: 'admin' | 'leader' | 'member';
  preferences?: UserPreferences;
  createdAt: string;
  lastLoginAt: string;
  lastUpdated?: string;
  isActive: boolean;
}

export interface Church {
  id: string;
  name: string;
  address?: string;
  contactInfo?: {
    phone?: string;
    email?: string;
  };
  settings?: {
    timezone?: string;
    defaultMinistries?: string[];
  };
  createdAt: string;
  lastUpdated: string;
}
