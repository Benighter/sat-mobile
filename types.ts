
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

export type AttendanceStatus = 'Present' | 'Absent';

export interface AttendanceRecord {
  id: string; // memberId_date (YYYY-MM-DD)
  memberId: string;
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
  CRITICAL_MEMBERS = 'critical_members',
  ATTENDANCE_ANALYTICS = 'attendance_analytics',
}
