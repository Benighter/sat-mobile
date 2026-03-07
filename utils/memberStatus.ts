import { Member, MemberRole, MemberStatus } from '../types';

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

export const withLeadershipFirstTimerRule = <T extends Partial<Member>>(member: T): T => {
  if (!member.isFirstTimer || !isLeadershipPosition(member as Pick<Member, 'role' | 'ministryPosition'>)) {
    return member;
  }

  return {
    ...member,
    isFirstTimer: false
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

  if (!mergedMember.isFirstTimer || !isLeadershipPosition(mergedMember as Pick<Member, 'role' | 'ministryPosition'>)) {
    return updates;
  }

  return {
    ...updates,
    isFirstTimer: false
  };
};
