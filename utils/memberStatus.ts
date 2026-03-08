import { Member, MemberRole, MemberStatus } from '../types';
import { formatDateToYYYYMMDD, getCurrentOrMostRecentSunday } from './dateUtils';

export type MemberListStatusFilter = 'active' | 'frozen' | 'went_home' | 'all';

export const getMemberStatus = (member: Member): MemberStatus => {
  return member.memberStatus || 'active';
};

export const isMemberWentHome = (member: Member): boolean => {
  return getMemberStatus(member) === 'went_home';
};

export const isMemberActive = (member: Member): boolean => {
  if (member.isActive === false) return false;
  if (member.frozen) return false;
  return !isMemberWentHome(member);
};

export const isLeadershipMemberRole = (role?: MemberRole): boolean => {
  return role === 'Admin'
    || role === 'Assistant'
    || role === 'Bacenta Leader'
    || role === 'Fellowship Leader';
};

export const isLeadershipPosition = (member?: Pick<Member, 'role' | 'ministryPosition'> | null): boolean => {
  if (!member) return false;
  if (isLeadershipMemberRole(member.role)) return true;

  const ministryPosition = (member.ministryPosition || '').trim().toLowerCase();
  return ministryPosition === 'assistant';
};

const parseDateReference = (value?: string): Date | null => {
  if (!value) return null;

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00`
    : value;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getSundayForDateReference = (value?: string): string | undefined => {
  const parsed = parseDateReference(value);
  if (!parsed) return undefined;

  const sunday = new Date(parsed);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(sunday.getDate() - sunday.getDay());
  return formatDateToYYYYMMDD(sunday);
};

export const getMemberFirstTimerWeekDate = (
  member?: Pick<Member, 'isFirstTimer' | 'firstTimerWeekDate' | 'createdDate' | 'lastUpdated' | 'role' | 'ministryPosition'> | null
): string | undefined => {
  if (!member?.isFirstTimer || isLeadershipPosition(member)) return undefined;

  const explicitWeekDate = (member.firstTimerWeekDate || '').trim();
  if (explicitWeekDate) return explicitWeekDate;

  // Legacy fallback for records created before firstTimerWeekDate existed.
  return getSundayForDateReference(member.lastUpdated || member.createdDate);
};

export const isMemberFirstTimerOnSunday = (
  member?: Pick<Member, 'isFirstTimer' | 'firstTimerWeekDate' | 'createdDate' | 'lastUpdated' | 'role' | 'ministryPosition'> | null,
  sunday?: string
): boolean => {
  if (!member || !sunday) return false;
  return getMemberFirstTimerWeekDate(member) === sunday;
};

export const isMemberCurrentlyFirstTimer = (
  member?: Pick<Member, 'isFirstTimer' | 'firstTimerWeekDate' | 'createdDate' | 'lastUpdated' | 'role' | 'ministryPosition'> | null,
  sunday: string = getCurrentOrMostRecentSunday()
): boolean => {
  return isMemberFirstTimerOnSunday(member, sunday);
};

export const withLeadershipFirstTimerRule = <T extends Partial<Member>>(member: T): T => {
  if (!isLeadershipPosition(member as Pick<Member, 'role' | 'ministryPosition'>)
    || (!member.isFirstTimer && !member.firstTimerWeekDate)) {
    return member;
  }

  return {
    ...member,
    isFirstTimer: false,
    firstTimerWeekDate: ''
  };
};

export const applyLeadershipFirstTimerRule = (
  existingMember: Partial<Member> | null | undefined,
  updates: Partial<Member>
): Partial<Member> => {
  const mergedMember = {
    ...(existingMember || {}),
    ...updates
  } as Partial<Member>;

  if (!isLeadershipPosition(mergedMember as Pick<Member, 'role' | 'ministryPosition'>)
    || (!mergedMember.isFirstTimer && !mergedMember.firstTimerWeekDate)) {
    return updates;
  }

  return {
    ...updates,
    isFirstTimer: false,
    firstTimerWeekDate: ''
  };
};
