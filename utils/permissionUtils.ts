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
 * Check if a user can assign member roles (Red Bacenta, Green Bacenta, etc.)
 * @param user The user object to check
 * @returns boolean indicating if the user can assign member roles
 */
export const canAssignMemberRoles = (user: User | null): boolean => {
  return hasAdminPrivileges(user);
};

/**
 * Check if a user can manage hierarchy (assign/remove Red Bacentas to/from Green Bacentas)
 * @param user The user object to check
 * @returns boolean indicating if the user can manage hierarchy
 */
export const canManageHierarchy = (user: User | null): boolean => {
  return hasAdminPrivileges(user);
};

/**
 * Check if a user can assign Green Bacentas to bacentas
 * @param user The user object to check
 * @returns boolean indicating if the user can assign Green Bacentas
 */
export const canAssignBacentaLeaders = (user: User | null): boolean => {
  return hasAdminPrivileges(user);
};

/**
 * Check if a user is an invited admin who became a leader
 * @param user The user object to check
 * @returns boolean indicating if the user is an invited admin leader
 */
export const isInvitedAdminLeader = (user: User | null): boolean => {
  if (!user) return false;
  return user.role === 'leader' && user.isInvitedAdminLeader === true;
};

/**
 * Check if a user can delete members with leader roles (Green Bacenta, Red Bacenta)
 * Invited admin leaders cannot delete other leaders, only original admins can
 * @param user The user object to check
 * @returns boolean indicating if the user can delete leaders
 */
export const canDeleteLeaders = (user: User | null): boolean => {
  if (!user) return false;

  // Only original admins can delete leaders
  // Invited admin leaders (who became leaders through invites) cannot delete leaders
  return user.role === 'admin' && !isInvitedAdminLeader(user);
};

/**
 * Check if a user can delete a specific member based on the member's role
 * @param user The current user object to check permissions for
 * @param memberRole The role of the member to be deleted
 * @returns boolean indicating if the user can delete this member
 */
export const canDeleteMemberWithRole = (user: User | null, memberRole: string): boolean => {
  if (!user) return false;

  // If the member is a regular member, any leader or admin can delete them
  if (memberRole === 'Member') {
    return hasLeaderPrivileges(user);
  }

  // If the member is an Assistant or Admin role, any leader or admin can delete them
  if (memberRole === 'Assistant' || memberRole === 'Admin') {
    return hasLeaderPrivileges(user);
  }

  // If the member is a leader (Green Bacenta or Red Bacenta),
  // only original admins can delete them, not invited admin leaders
  if (memberRole === 'Bacenta Leader' || memberRole === 'Fellowship Leader') {
    return canDeleteLeaders(user);
  }

  // For any other roles, use standard leader privileges
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
