import { Member, MemberStatus } from '../types';

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
