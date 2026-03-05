/**
 * Constituency Service
 * 
 * Service for managing constituency/church selection and information
 */

import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.config';

export interface Constituency {
  id: string;
  name: string;
  address?: string;
  contactInfo?: {
    phone?: string;
    email?: string;
  };
  isActive?: boolean;
}

/**
 * Get all available constituencies for transfer selection
 */
export const getAvailableConstituencies = async (): Promise<Constituency[]> => {
  try {
    console.log('🔍 [Constituency Service] Fetching available constituencies...');
    
    // Get all users to find their churches
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const constituencies: Constituency[] = [];
    const seenChurchIds = new Set<string>();
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      // Skip ministry accounts - we want default churches only
      if (userData.isMinistryAccount === true) {
        continue;
      }
      
      const churchId = userData.contexts?.defaultChurchId || userData.churchId;
      if (!churchId || seenChurchIds.has(churchId)) {
        continue;
      }
      
      seenChurchIds.add(churchId);
      
      try {
        // Get church information
        const churchDoc = await getDoc(doc(db, 'churches', churchId));
        if (churchDoc.exists()) {
          const churchData = churchDoc.data();
          constituencies.push({
            id: churchId,
            name: churchData.name || `Church ${churchId.substring(0, 8)}`,
            address: churchData.address,
            contactInfo: churchData.contactInfo,
            isActive: churchData.isActive !== false
          });
        }
      } catch (e) {
        console.warn(`Failed to fetch church data for ${churchId}:`, e);
        // Add basic entry even if we can't get details
        constituencies.push({
          id: churchId,
          name: `Church ${churchId.substring(0, 8)}`,
          isActive: true
        });
      }
    }
    
    // Sort by name
    constituencies.sort((a, b) => a.name.localeCompare(b.name));
    
    console.log(`✅ [Constituency Service] Found ${constituencies.length} constituencies`);
    return constituencies;
    
  } catch (error) {
    console.error('❌ [Constituency Service] Failed to fetch constituencies:', error);
    throw error;
  }
};

/**
 * Get constituency information by ID
 */
export const getConstituencyById = async (constituencyId: string): Promise<Constituency | null> => {
  try {
    const churchDoc = await getDoc(doc(db, 'churches', constituencyId));
    if (!churchDoc.exists()) {
      return null;
    }
    
    const churchData = churchDoc.data();
    return {
      id: constituencyId,
      name: churchData.name || `Church ${constituencyId.substring(0, 8)}`,
      address: churchData.address,
      contactInfo: churchData.contactInfo,
      isActive: churchData.isActive !== false
    };
  } catch (error) {
    console.error(`❌ [Constituency Service] Failed to fetch constituency ${constituencyId}:`, error);
    return null;
  }
};
