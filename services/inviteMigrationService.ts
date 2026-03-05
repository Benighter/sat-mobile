import { db } from '../firebase.config';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, writeBatch, setDoc } from 'firebase/firestore';
import { AdminInvite, User } from '../types';

/**
 * Service to fix data inconsistencies from ministry invitations accepted before the bug fix.
 * 
 * THE BUG:
 * Before the fix, when a ministry admin invited another admin:
 * 1. The invitation was created with invitedUserId = ministry account UID
 * 2. When the user accepted while logged into their NORMAL account, the system updated
 *    the NORMAL account instead of the MINISTRY account
 * 3. This left the ministry account as "admin" instead of changing it to "leader"
 * 
 * THE FIX:
 * This service identifies affected invitations and corrects the user data.
 */

export interface MigrationResult {
  totalInvitesChecked: number;
  affectedInvites: number;
  fixedUsers: number;
  errors: string[];
  details: {
    inviteId: string;
    invitedUserId: string;
    invitedUserEmail: string;
    issue: string;
    fixed: boolean;
    error?: string;
  }[];
}

export const inviteMigrationService = {
  /**
   * Identify and fix users affected by the ministry invitation bug.
   * 
   * This function:
   * 1. Finds all accepted invitations that were sent to ministry accounts
   * 2. Checks if the invited user's ministry account was properly updated
   * 3. If not, applies the correct role change and church sync
   */
  fixMinistryInvitationData: async (): Promise<MigrationResult> => {
    const result: MigrationResult = {
      totalInvitesChecked: 0,
      affectedInvites: 0,
      fixedUsers: 0,
      errors: [],
      details: []
    };

    try {
      // Step 1: Find all accepted invitations
      // We look for invitations that were accepted and handled as 'leader-role-change'
      // (not cross-tenant links, as those don't change roles)
      const invitesQuery = query(
        collection(db, 'adminInvites'),
        where('status', '==', 'accepted'),
        where('handledAs', '==', 'leader-role-change')
      );

      const invitesSnap = await getDocs(invitesQuery);
      result.totalInvitesChecked = invitesSnap.size;

      console.log(`[Migration] Checking ${result.totalInvitesChecked} accepted invitations...`);

      // Step 2: Check each invitation
      for (const inviteDoc of invitesSnap.docs) {
        const invite = { id: inviteDoc.id, ...inviteDoc.data() } as AdminInvite;
        
        try {
          // Get the invited user's document
          const userDocRef = doc(db, 'users', invite.invitedUserId);
          const userSnap = await getDoc(userDocRef);

          if (!userSnap.exists()) {
            result.details.push({
              inviteId: invite.id,
              invitedUserId: invite.invitedUserId,
              invitedUserEmail: invite.invitedUserEmail,
              issue: 'User document not found',
              fixed: false,
              error: 'User document does not exist'
            });
            result.errors.push(`User ${invite.invitedUserId} not found for invite ${invite.id}`);
            continue;
          }

          const userData = userSnap.data() as User;

          // Step 3: Check if this user needs fixing
          // A user needs fixing if:
          // - They should be a leader (invite was accepted)
          // - But their role is still "admin"
          // - And their churchId doesn't match the invite's churchId
          const needsFix = (
            userData.role === 'admin' && 
            userData.churchId !== invite.churchId
          );

          if (needsFix) {
            result.affectedInvites++;
            
            console.log(`[Migration] Found affected user: ${invite.invitedUserEmail} (${invite.invitedUserId})`);
            console.log(`  Current role: ${userData.role}, Current churchId: ${userData.churchId}`);
            console.log(`  Expected role: leader, Expected churchId: ${invite.churchId}`);

            // Step 4: Apply the fix
            try {
              // Get the church name for the invite's church
              let churchName: string | undefined;
              try {
                const churchSnap = await getDoc(doc(db, 'churches', invite.churchId));
                if (churchSnap.exists()) {
                  churchName = (churchSnap.data() as any)?.name;
                }
              } catch (e) {
                console.warn(`[Migration] Could not fetch church name for ${invite.churchId}`, e);
              }

              // Update the user document with the correct data
              await updateDoc(userDocRef, {
                role: 'leader',
                churchId: invite.churchId,
                ...(churchName ? { churchName } : {}),
                isInvitedAdminLeader: true,
                invitedByAdminId: invite.createdBy,
                lastUpdated: new Date().toISOString(),
                // Add a flag to track that this was fixed by migration
                _fixedByMigration: true,
                _fixedAt: new Date().toISOString()
              });

              result.fixedUsers++;
              result.details.push({
                inviteId: invite.id,
                invitedUserId: invite.invitedUserId,
                invitedUserEmail: invite.invitedUserEmail,
                issue: `Role was "${userData.role}" instead of "leader", churchId was "${userData.churchId}" instead of "${invite.churchId}"`,
                fixed: true
              });

              console.log(`[Migration] ✓ Fixed user ${invite.invitedUserEmail}`);
            } catch (error: any) {
              result.details.push({
                inviteId: invite.id,
                invitedUserId: invite.invitedUserId,
                invitedUserEmail: invite.invitedUserEmail,
                issue: `Role was "${userData.role}" instead of "leader"`,
                fixed: false,
                error: error.message
              });
              result.errors.push(`Failed to fix user ${invite.invitedUserId}: ${error.message}`);
              console.error(`[Migration] ✗ Failed to fix user ${invite.invitedUserEmail}:`, error);
            }
          } else {
            // User is already correct, no fix needed
            console.log(`[Migration] User ${invite.invitedUserEmail} is already correct (role: ${userData.role}, churchId: ${userData.churchId})`);
          }
        } catch (error: any) {
          result.errors.push(`Error processing invite ${invite.id}: ${error.message}`);
          console.error(`[Migration] Error processing invite ${invite.id}:`, error);
        }
      }

      console.log(`[Migration] Complete. Checked: ${result.totalInvitesChecked}, Affected: ${result.affectedInvites}, Fixed: ${result.fixedUsers}`);

      return result;
    } catch (error: any) {
      result.errors.push(`Migration failed: ${error.message}`);
      console.error('[Migration] Fatal error:', error);
      return result;
    }
  },

  /**
   * Fix ministry context for leaders who accepted ministry invites.
   *
   * THE BUG:
   * When a ministry admin invited another admin and they accepted:
   * 1. The user's churchId was updated to the admin's church
   * 2. But contexts.ministryChurchId was NOT updated
   * 3. So when the leader logs into ministry mode, they see their OLD church data instead of the admin's church
   *
   * THE FIX:
   * This function updates contexts.ministryChurchId to match churchId for ministry invite leaders
   */
  fixMinistryContextForLeaders: async (): Promise<MigrationResult> => {
    const result: MigrationResult = {
      totalInvitesChecked: 0,
      affectedInvites: 0,
      fixedUsers: 0,
      errors: [],
      details: []
    };

    try {
      // Find all accepted ministry invites that were handled as role-change
      const invitesQuery = query(
        collection(db, 'adminInvites'),
        where('status', '==', 'accepted'),
        where('handledAs', '==', 'leader-role-change'),
        where('isMinistryInvite', '==', true)
      );

      const invitesSnap = await getDocs(invitesQuery);
      result.totalInvitesChecked = invitesSnap.size;

      console.log(`[Ministry Context Migration] Checking ${result.totalInvitesChecked} ministry role-change invites...`);

      for (const inviteDoc of invitesSnap.docs) {
        const invite = { id: inviteDoc.id, ...inviteDoc.data() } as AdminInvite;

        try {
          // Get the invited user's document
          const userDocRef = doc(db, 'users', invite.invitedUserId);
          const userSnap = await getDoc(userDocRef);

          if (!userSnap.exists()) {
            result.details.push({
              inviteId: invite.id,
              invitedUserId: invite.invitedUserId,
              invitedUserEmail: invite.invitedUserEmail,
              issue: 'User document not found',
              fixed: false,
              error: 'User document does not exist'
            });
            result.errors.push(`User ${invite.invitedUserId} not found for invite ${invite.id}`);
            continue;
          }

          const userData = userSnap.data() as User;
          const currentMinistryChurchId = userData.contexts?.ministryChurchId;
          const currentChurchId = userData.churchId;

          // Check if ministryChurchId needs to be updated
          const needsFix = currentMinistryChurchId !== currentChurchId;

          if (needsFix) {
            result.affectedInvites++;

            console.log(`[Ministry Context Migration] Found affected user: ${invite.invitedUserEmail}`);
            console.log(`  Current churchId: ${currentChurchId}`);
            console.log(`  Current ministryChurchId: ${currentMinistryChurchId}`);

            try {
              // Update the user's ministry context
              await updateDoc(userDocRef, {
                'contexts.ministryChurchId': currentChurchId,
                lastUpdated: new Date().toISOString(),
                _ministryContextFixed: true,
                _ministryContextFixedAt: new Date().toISOString()
              });

              result.fixedUsers++;
              result.details.push({
                inviteId: invite.id,
                invitedUserId: invite.invitedUserId,
                invitedUserEmail: invite.invitedUserEmail,
                issue: `Ministry context mismatch: ministryChurchId was "${currentMinistryChurchId}" but churchId is "${currentChurchId}"`,
                fixed: true
              });

              console.log(`[Ministry Context Migration] ✓ Fixed ministry context for ${invite.invitedUserEmail}`);
            } catch (error: any) {
              result.details.push({
                inviteId: invite.id,
                invitedUserId: invite.invitedUserId,
                invitedUserEmail: invite.invitedUserEmail,
                issue: `Ministry context mismatch: ministryChurchId was "${currentMinistryChurchId}"`,
                fixed: false,
                error: error.message
              });
              result.errors.push(`Failed to fix ministry context for ${invite.invitedUserId}: ${error.message}`);
              console.error(`[Ministry Context Migration] ✗ Failed to fix ${invite.invitedUserEmail}:`, error);
            }
          } else {
            console.log(`[Ministry Context Migration] User ${invite.invitedUserEmail} is already correct (ministryChurchId: ${currentMinistryChurchId})`);
          }
        } catch (error: any) {
          result.errors.push(`Error processing invite ${invite.id}: ${error.message}`);
          console.error(`[Ministry Context Migration] Error processing invite ${invite.id}:`, error);
        }
      }

      console.log(`[Ministry Context Migration] Complete. Checked: ${result.totalInvitesChecked}, Affected: ${result.affectedInvites}, Fixed: ${result.fixedUsers}`);

      return result;
    } catch (error: any) {
      result.errors.push(`Migration failed: ${error.message}`);
      console.error('[Ministry Context Migration] Fatal error:', error);
      return result;
    }
  },

  /**
   * Preview what would be fixed without actually making changes.
   * Useful for admins to see what the migration will do before running it.
   */
  previewFixes: async (): Promise<MigrationResult> => {
    const result: MigrationResult = {
      totalInvitesChecked: 0,
      affectedInvites: 0,
      fixedUsers: 0,
      errors: [],
      details: []
    };

    try {
      const invitesQuery = query(
        collection(db, 'adminInvites'),
        where('status', '==', 'accepted'),
        where('handledAs', '==', 'leader-role-change')
      );

      const invitesSnap = await getDocs(invitesQuery);
      result.totalInvitesChecked = invitesSnap.size;

      for (const inviteDoc of invitesSnap.docs) {
        const invite = { id: inviteDoc.id, ...inviteDoc.data() } as AdminInvite;
        
        try {
          const userDocRef = doc(db, 'users', invite.invitedUserId);
          const userSnap = await getDoc(userDocRef);

          if (!userSnap.exists()) {
            result.details.push({
              inviteId: invite.id,
              invitedUserId: invite.invitedUserId,
              invitedUserEmail: invite.invitedUserEmail,
              issue: 'User document not found',
              fixed: false,
              error: 'User document does not exist'
            });
            continue;
          }

          const userData = userSnap.data() as User;

          const needsFix = (
            userData.role === 'admin' && 
            userData.churchId !== invite.churchId
          );

          if (needsFix) {
            result.affectedInvites++;
            result.details.push({
              inviteId: invite.id,
              invitedUserId: invite.invitedUserId,
              invitedUserEmail: invite.invitedUserEmail,
              issue: `Role is "${userData.role}" (should be "leader"), churchId is "${userData.churchId}" (should be "${invite.churchId}")`,
              fixed: false
            });
          }
        } catch (error: any) {
          result.errors.push(`Error checking invite ${invite.id}: ${error.message}`);
        }
      }

      return result;
    } catch (error: any) {
      result.errors.push(`Preview failed: ${error.message}`);
      return result;
    }
  },

  /**
   * Fix cross-tenant access links that were created with wrong church IDs for ministry invites.
   *
   * THE BUG:
   * Before the fix, when a ministry admin invited another ministry admin who had their own data:
   * 1. The system created a cross-tenant access link
   * 2. But it used userData.churchId instead of userData.contexts.ministryChurchId
   * 3. This meant the inviting admin couldn't access the invited leader's ministry church data
   *
   * THE FIX:
   * This function:
   * 1. Finds all accepted ministry invites that were handled as 'cross-tenant-link'
   * 2. Checks if the cross-tenant link points to the wrong church
   * 3. Updates the link to point to the correct ministry church
   */
  fixMinistryModeCrossTenantLinks: async (): Promise<MigrationResult> => {
    const result: MigrationResult = {
      totalInvitesChecked: 0,
      affectedInvites: 0,
      fixedUsers: 0,
      errors: [],
      details: []
    };

    try {
      // Step 1: Find all accepted ministry invites that were handled as cross-tenant links
      const invitesQuery = query(
        collection(db, 'adminInvites'),
        where('status', '==', 'accepted'),
        where('handledAs', '==', 'cross-tenant-link'),
        where('isMinistryInvite', '==', true)
      );

      const invitesSnap = await getDocs(invitesQuery);
      result.totalInvitesChecked = invitesSnap.size;

      console.log(`[Migration] Checking ${result.totalInvitesChecked} ministry cross-tenant invites...`);

      if (result.totalInvitesChecked === 0) {
        console.log('[Migration] No ministry cross-tenant invites found. This could mean:');
        console.log('  1. No ministry invites have been accepted yet');
        console.log('  2. All ministry invites were handled as role-change (not cross-tenant-link)');
        console.log('  3. The isMinistryInvite flag was not set on the invites');
      }

      // Step 2: Check each invitation
      for (const inviteDoc of invitesSnap.docs) {
        const invite = { id: inviteDoc.id, ...inviteDoc.data() } as AdminInvite;

        try {
          // Get the invited user's document
          const userDocRef = doc(db, 'users', invite.invitedUserId);
          const userSnap = await getDoc(userDocRef);

          if (!userSnap.exists()) {
            result.details.push({
              inviteId: invite.id,
              invitedUserId: invite.invitedUserId,
              invitedUserEmail: invite.invitedUserEmail,
              issue: 'User document not found',
              fixed: false,
              error: 'User document does not exist'
            });
            result.errors.push(`User ${invite.invitedUserId} not found for invite ${invite.id}`);
            continue;
          }

          const userData = userSnap.data() as User;

          // Check if user has a ministry church context
          const ministryChurchId = userData.contexts?.ministryChurchId;
          const regularChurchId = userData.churchId;

          if (!ministryChurchId) {
            console.log(`[Migration] User ${invite.invitedUserEmail} has no ministry church context, skipping`);
            continue;
          }

          // Step 3: Find the cross-tenant link for this invite
          const linksQuery = query(
            collection(db, 'crossTenantAccessLinks'),
            where('viewerUid', '==', invite.createdBy),
            where('ownerUid', '==', invite.invitedUserId)
          );

          const linksSnap = await getDocs(linksQuery);

          if (linksSnap.empty) {
            result.details.push({
              inviteId: invite.id,
              invitedUserId: invite.invitedUserId,
              invitedUserEmail: invite.invitedUserEmail,
              issue: 'Cross-tenant link not found',
              fixed: false,
              error: 'No cross-tenant link exists for this invite'
            });
            result.errors.push(`No cross-tenant link found for invite ${invite.id}`);
            continue;
          }

          // Check each link (there should only be one, but handle multiple just in case)
          for (const linkDoc of linksSnap.docs) {
            const linkData = linkDoc.data();
            const currentChurchId = linkData.ownerChurchId;

            // Check if the link points to the wrong church
            const needsFix = currentChurchId !== ministryChurchId && currentChurchId === regularChurchId;

            if (needsFix) {
              result.affectedInvites++;

              console.log(`[Migration] Found affected cross-tenant link for: ${invite.invitedUserEmail}`);
              console.log(`  Current ownerChurchId: ${currentChurchId}`);
              console.log(`  Correct ownerChurchId: ${ministryChurchId}`);

              // Step 4: Apply the fix
              try {
                // For ministry accounts, churchId and churchName are the ministry church
                // So we use the user's churchName as the ownerChurchName
                const correctChurchName = userData.churchName;

                // Update the cross-tenant link
                await updateDoc(doc(db, 'crossTenantAccessLinks', linkDoc.id), {
                  ownerChurchId: ministryChurchId,
                  ownerChurchName: correctChurchName,
                  _fixedByMigration: true,
                  _fixedAt: new Date().toISOString()
                });

                // Update the cross-tenant access index
                const oldIndexId = `${invite.createdBy}_${currentChurchId}`;
                const newIndexId = `${invite.createdBy}_${ministryChurchId}`;

                // Revoke the old index
                try {
                  await updateDoc(doc(db, 'crossTenantAccessIndex', oldIndexId), {
                    revoked: true,
                    revokedAt: new Date().toISOString(),
                    _replacedBy: newIndexId
                  });
                } catch (e) {
                  console.warn(`[Migration] Could not revoke old index ${oldIndexId}`, e);
                }

                // Create the new index
                await setDoc(doc(db, 'crossTenantAccessIndex', newIndexId), {
                  viewerUid: invite.createdBy,
                  ownerUid: invite.invitedUserId,
                  ownerChurchId: ministryChurchId,
                  permission: linkData.permission || 'read-only',
                  createdAt: linkData.createdAt || new Date().toISOString(),
                  revoked: false,
                  _fixedByMigration: true,
                  _fixedAt: new Date().toISOString()
                });

                result.fixedUsers++;
                result.details.push({
                  inviteId: invite.id,
                  invitedUserId: invite.invitedUserId,
                  invitedUserEmail: invite.invitedUserEmail,
                  issue: `Cross-tenant link pointed to wrong church: "${currentChurchId}" instead of "${ministryChurchId}"`,
                  fixed: true
                });

                console.log(`[Migration] ✓ Fixed cross-tenant link for ${invite.invitedUserEmail}`);
              } catch (error: any) {
                result.details.push({
                  inviteId: invite.id,
                  invitedUserId: invite.invitedUserId,
                  invitedUserEmail: invite.invitedUserEmail,
                  issue: `Cross-tenant link pointed to wrong church: "${currentChurchId}"`,
                  fixed: false,
                  error: error.message
                });
                result.errors.push(`Failed to fix cross-tenant link for ${invite.invitedUserId}: ${error.message}`);
                console.error(`[Migration] ✗ Failed to fix cross-tenant link for ${invite.invitedUserEmail}:`, error);
              }
            } else {
              console.log(`[Migration] Cross-tenant link for ${invite.invitedUserEmail} is already correct`);
            }
          }
        } catch (error: any) {
          result.errors.push(`Error processing invite ${invite.id}: ${error.message}`);
          console.error(`[Migration] Error processing invite ${invite.id}:`, error);
        }
      }

      console.log(`[Migration] Complete. Checked: ${result.totalInvitesChecked}, Affected: ${result.affectedInvites}, Fixed: ${result.fixedUsers}`);

      return result;
    } catch (error: any) {
      result.errors.push(`Migration failed: ${error.message}`);
      console.error('[Migration] Fatal error:', error);
      return result;
    }
  }
};

