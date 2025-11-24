import { Member, Bacenta } from '../types';
import { isMemberActive } from './memberStatus';

/**
 * Filters out frozen members and members from frozen bacentas
 * @param members Array of members to filter
 * @param bacentas Array of bacentas to check for frozen status
 * @returns Array of active (non-frozen) members from non-frozen bacentas
 */
export const getActiveMembers = (members: Member[], bacentas: Bacenta[]): Member[] => {
  const frozenBacentaIds = new Set(bacentas.filter(b => b.frozen).map(b => b.id));
  
  return members.filter(member => {
    // Exclude frozen/archived members
    if (!isMemberActive(member)) return false;
    
    // Exclude members from frozen bacentas
    if (member.bacentaId && frozenBacentaIds.has(member.bacentaId)) return false;
    
    return true;
  });
};

/**
 * Filters members by bacenta and excludes frozen members/bacentas
 * @param members Array of members to filter
 * @param bacentas Array of bacentas to check for frozen status
 * @param bacentaId ID of the bacenta to filter by (null for unassigned)
 * @returns Array of active members from the specified bacenta
 */
export const getActiveMembersByBacenta = (
  members: Member[], 
  bacentas: Bacenta[], 
  bacentaId: string | null
): Member[] => {
  const frozenBacentaIds = new Set(bacentas.filter(b => b.frozen).map(b => b.id));
  
  return members.filter(member => {
    // Filter by bacenta
    if (member.bacentaId !== bacentaId) return false;
    
    // Exclude frozen/archived members
    if (!isMemberActive(member)) return false;
    
    // Exclude members from frozen bacentas
    if (member.bacentaId && frozenBacentaIds.has(member.bacentaId)) return false;
    
    return true;
  });
};

/**
 * Gets member count for a bacenta, excluding frozen members and checking if bacenta is frozen
 * @param members Array of members
 * @param bacentas Array of bacentas
 * @param bacentaId ID of the bacenta
 * @returns Number of active members in the bacenta (0 if bacenta is frozen)
 */
export const getActiveMemberCount = (
  members: Member[], 
  bacentas: Bacenta[], 
  bacentaId: string
): number => {
  const bacenta = bacentas.find(b => b.id === bacentaId);
  
  // If bacenta is frozen, return 0
  if (bacenta?.frozen) return 0;
  
  return members.filter(m => m.bacentaId === bacentaId && isMemberActive(m)).length;
};