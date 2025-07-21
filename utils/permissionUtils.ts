// Permission utility functions for role-based access control

import { User } from '../types';

/**
 * Check if a user has admin privileges
 * @param user The user object to check
 * @returns boolean indicating if the user has admin privileges
 */
export const hasAdminPrivileges = (user: User | null): boolean => {
  if (!user) return false;
  return user.role === 'admin';
};

/**
 * Check if a user has leader privileges (admin or leader role)
 * @param user The user object to check
 * @returns boolean indicating if the user has leader privileges
 */
export const hasLeaderPrivileges = (user: User | null): boolean => {
  if (!user) return false;
  return user.role === 'admin' || user.role === 'leader';
};

/**
 * Check if a user can manage members (add, edit, delete)
 * @param user The user object to check
 * @returns boolean indicating if the user can manage members
 */
export const canManageMembers = (user: User | null): boolean => {
  return hasLeaderPrivileges(user);
};

/**
 * Check if a user can manage bacentas (add, edit, delete)
 * @param user The user object to check
 * @returns boolean indicating if the user can manage bacentas
 */
export const canManageBacentas = (user: User | null): boolean => {
  return hasLeaderPrivileges(user);
};

/**
 * Check if a user can manage attendance records
 * @param user The user object to check
 * @returns boolean indicating if the user can manage attendance
 */
export const canManageAttendance = (user: User | null): boolean => {
  return hasLeaderPrivileges(user);
};

/**
 * Check if a user can manage new believers
 * @param user The user object to check
 * @returns boolean indicating if the user can manage new believers
 */
export const canManageNewBelievers = (user: User | null): boolean => {
  return hasLeaderPrivileges(user);
};

/**
 * Check if a user can manage admin invites (admin only feature)
 * @param user The user object to check
 * @returns boolean indicating if the user can manage admin invites
 */
export const canManageAdminInvites = (user: User | null): boolean => {
  return hasAdminPrivileges(user);
};

/**
 * Check if a user can view analytics
 * @param user The user object to check
 * @returns boolean indicating if the user can view analytics
 */
export const canViewAnalytics = (user: User | null): boolean => {
  return hasLeaderPrivileges(user);
};

/**
 * Check if a user can export data
 * @param user The user object to check
 * @returns boolean indicating if the user can export data
 */
export const canExportData = (user: User | null): boolean => {
  return hasLeaderPrivileges(user);
};

/**
 * Check if a user can import data
 * @param user The user object to check
 * @returns boolean indicating if the user can import data
 */
export const canImportData = (user: User | null): boolean => {
  return hasLeaderPrivileges(user);
};

/**
 * Get a user-friendly role display name
 * @param role The role string from the user object
 * @returns A user-friendly display name for the role
 */
export const getRoleDisplayName = (role: string): string => {
  switch (role) {
    case 'admin':
      return 'Administrator';
    case 'leader':
      return 'Leader';
    case 'member':
      return 'Member';
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
};
