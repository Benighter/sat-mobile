import { Member } from '../types';
import { getMinistryRoleLabels } from '../constants';

export type HierarchySectionKind = 'head' | 'leader' | 'assistant' | 'member';

export interface HierarchyLabels {
  head: string;
  leader: string;
  assistant: string;
  member: string;
}

export interface HierarchySection {
  kind: HierarchySectionKind;
  title: string;
  members: Member[];
}

export interface HierarchyGroupingOptions {
  isMinistryMode?: boolean;
  ministryName?: string;
}

const DEFAULT_LABELS: HierarchyLabels = {
  head: 'Green Bacentas',
  leader: 'Red Bacentas',
  assistant: 'Assistants',
  member: 'Members'
};

const getFullName = (member: Member): string => `${member.firstName} ${member.lastName || ''}`.trim();

const sortByFullName = (a: Member, b: Member): number => getFullName(a).localeCompare(getFullName(b));

const isAssistantRole = (member: Member): boolean => member.role === 'Assistant' || member.role === 'Admin';

const isMinistryAssistant = (member: Member): boolean => {
  if (isAssistantRole(member)) return true;
  return (member.ministryPosition || '').trim().toLowerCase() === 'assistant';
};

export const buildHierarchyGrouping = (
  members: Member[],
  options: HierarchyGroupingOptions = {}
): { labels: HierarchyLabels; sections: HierarchySection[]; isMinistryMode: boolean } => {
  const headMembers = members.filter(m => m.role === 'Bacenta Leader').sort(sortByFullName);
  const leaderMembers = members.filter(m => m.role === 'Fellowship Leader').sort(sortByFullName);

  const assistantPredicate = options.isMinistryMode ? isMinistryAssistant : isAssistantRole;
  const assistantMembers = members.filter(m => assistantPredicate(m)).sort(sortByFullName);

  const excludedIds = new Set<string>();
  headMembers.forEach(m => excludedIds.add(m.id));
  leaderMembers.forEach(m => excludedIds.add(m.id));
  assistantMembers.forEach(m => excludedIds.add(m.id));

  const memberMembers = members
    .filter(m => !excludedIds.has(m.id))
    .sort(sortByFullName);

  const isMinistryMode = Boolean(options.isMinistryMode);
  const labels = isMinistryMode
    ? getMinistryRoleLabels(options.ministryName)
    : { ...DEFAULT_LABELS };

  const sections: HierarchySection[] = [
    { kind: 'head', title: labels.head, members: headMembers },
    { kind: 'leader', title: labels.leader, members: leaderMembers },
    { kind: 'assistant', title: labels.assistant, members: assistantMembers },
    { kind: 'member', title: labels.member, members: memberMembers }
  ];

  return { labels, sections, isMinistryMode };
};
