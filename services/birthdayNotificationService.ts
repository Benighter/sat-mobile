import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase.config';
import { BirthdayNotification, Member, User, Bacenta } from '../types';
import { 
  determineNotificationRecipients, 
  hasNotificationBeenSent, 
  getMembersNeedingNotifications,
  createBirthdayNotificationRecord
} from '../utils/notificationUtils';
import { EmailNotificationService } from './emailNotificationService';
import { notificationService, setNotificationContext } from './notificationService';

/**
 * Firebase service for managing birthday notifications
 * Handles notification tracking, duplicate prevention, and audit logging
 */
export class BirthdayNotificationService {
  private static instance: BirthdayNotificationService;
  private emailService: EmailNotificationService;
  // Feature flag: set to true to enable email delivery; false uses in-app notifications only
  private static ENABLE_BIRTHDAY_EMAILS = false;
  
  private constructor() {
    this.emailService = EmailNotificationService.getInstance();
  }
  
  public static getInstance(): BirthdayNotificationService {
    if (!BirthdayNotificationService.instance) {
      BirthdayNotificationService.instance = new BirthdayNotificationService();
    }
    return BirthdayNotificationService.instance;
  }

  /**
   * Get existing birthday notifications for duplicate prevention
   */
  public async getExistingNotifications(
    churchId: string,
    startDate: Date,
    endDate: Date
  ): Promise<BirthdayNotification[]> {
    try {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const notificationsRef = collection(db, `churches/${churchId}/birthdayNotifications`);
      const q = query(
        notificationsRef,
        where('notificationDate', '>=', startDateStr),
        where('notificationDate', '<=', endDateStr),
        orderBy('notificationDate', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as BirthdayNotification));
      
    } catch (error: any) {
      console.error('Error fetching existing notifications:', error);
      throw new Error(`Failed to fetch existing notifications: ${error.message}`);
    }
  }

  /**
   * Save birthday notification record to Firebase
   */
  public async saveBirthdayNotification(
    churchId: string,
    notification: Omit<BirthdayNotification, 'id'>
  ): Promise<string> {
    try {
      const notificationsRef = collection(db, `churches/${churchId}/birthdayNotifications`);
      const docRef = await addDoc(notificationsRef, notification);
      return docRef.id;
    } catch (error: any) {
      console.error('Error saving birthday notification:', error);
      throw new Error(`Failed to save notification: ${error.message}`);
    }
  }

  /**
   * Update birthday notification status
   */
  public async updateNotificationStatus(
    churchId: string,
    notificationId: string,
    status: 'sent' | 'failed',
    emailDetails?: {
      subject: string;
      sentAt: string;
      failureReason?: string;
      messageId?: string;
    }
  ): Promise<void> {
    try {
      const notificationRef = doc(db, `churches/${churchId}/birthdayNotifications`, notificationId);
      await updateDoc(notificationRef, {
        status,
        emailDetails,
        lastUpdated: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error updating notification status:', error);
      throw new Error(`Failed to update notification status: ${error.message}`);
    }
  }

  /**
   * Process birthday notifications for a specific date
   */
  public async processBirthdayNotifications(
    churchId: string,
    members: Member[],
    users: User[],
    bacentas: Bacenta[],
  notificationDays: number[] = [7, 3, 1, 0],
  referenceDate: Date = new Date(),
  options?: { force?: boolean; actorAdminId?: string }
  ): Promise<{
    processed: number;
    sent: number;
    failed: number;
    skipped: number;
    errors: string[];
  }> {
    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[]
    };

    try {
      // Ensure notification service has church/user context so bell writes succeed
      // Prefer the acting admin as context; otherwise fall back to a system actor
      // Resolve acting admin: prefer explicit actorAdminId, otherwise pick the first active admin in users
      let actor = null as any;
      if (options?.actorAdminId) {
        actor = users.find(u => u.uid === options.actorAdminId || (u as any).id === options.actorAdminId) || null;
      }
      if (!actor) {
        actor = users.find(u => u.role === 'admin' && (u as any).isActive !== false) || null;
      }

      const actorForContext = actor || ({
        id: 'system',
        uid: 'system',
        email: 'noreply@sat-mobile',
        displayName: 'System',
        churchId,
        role: 'leader',
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      } as any);
      try {
        setNotificationContext(actorForContext as any, churchId);
      } catch (ctxErr) {
        console.warn('Failed to set notification context, proceeding anyway:', ctxErr);
      }

      // Get members who need notifications today
      const membersNeedingNotifications = getMembersNeedingNotifications(
        members, 
        notificationDays, 
        referenceDate
      );

      if (membersNeedingNotifications.length === 0) {
        console.log('No members need birthday notifications today');
        return results;
      }

      // Get existing notifications to prevent duplicates
      const startDate = new Date(referenceDate);
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date(referenceDate);
      endDate.setDate(endDate.getDate() + 1);
      
      const existingNotifications = await this.getExistingNotifications(
        churchId, 
        startDate, 
        endDate
      );

      // Helper to enforce a timeout on async operations
      const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
        return await new Promise<T>((resolve, reject) => {
          const id = setTimeout(() => reject(new Error('Operation timed out')), ms);
          promise
            .then((val) => {
              clearTimeout(id);
              resolve(val);
            })
            .catch((err) => {
              clearTimeout(id);
              reject(err);
            });
        });
      };

    const force = options?.force === true;

    // Process each member
      for (const { member, daysUntilBirthday } of membersNeedingNotifications) {
        results.processed++;

        try {
          // Check if notification already sent
      if (!force && hasNotificationBeenSent(existingNotifications, member.id, daysUntilBirthday, referenceDate)) {
            console.log(`Notification already sent for ${member.firstName} ${member.lastName} (${daysUntilBirthday} days)`);
            results.skipped++;
            continue;
          }

          // Determine recipients
          let recipients = determineNotificationRecipients(
            member,
            users,
            bacentas,
            { actorAdminId: options?.actorAdminId }
          );

          // If triggered by a specific admin, ensure recipients explicitly include:
          // - the acting admin
          // - all leaders linked to that admin via adminInvites (accepted)
          if (options?.actorAdminId) {
            try {
              // Acting admin
              const actorUser = users.find(u => (u as any).uid === options.actorAdminId || (u as any).id === options.actorAdminId);
              if (actorUser) {
                recipients.push({
                  userId: (actorUser as any).uid || (actorUser as any).id,
                  email: actorUser.email || '',
                  firstName: actorUser.firstName || (actorUser.displayName || '').split(' ')[0] || 'User',
                  lastName: actorUser.lastName || (actorUser.displayName || '').split(' ').slice(1).join(' ') || '',
                  role: actorUser.role,
                  relationshipToMember: 'admin'
                } as any);
              }

              // Leaders linked via adminInvites
              const invitesRef = collection(db, 'adminInvites');
              const qInv = query(
                invitesRef,
                where('createdBy', '==', options.actorAdminId),
                where('status', '==', 'accepted'),
                where('churchId', '==', churchId)
              );
              const invSnap = await getDocs(qInv);
              const invitedLeaderIds = invSnap.docs.map(d => (d.data() as any).invitedUserId).filter(Boolean);
              const invitedLeaders = users.filter(u => invitedLeaderIds.includes((u as any).uid || (u as any).id));
              invitedLeaders.forEach(u => {
                recipients.push({
                  userId: (u as any).uid || (u as any).id,
                  email: u.email || '',
                  firstName: u.firstName || (u.displayName || '').split(' ')[0] || 'User',
                  lastName: u.lastName || (u.displayName || '').split(' ').slice(1).join(' ') || '',
                  role: u.role,
                  relationshipToMember: 'admin'
                } as any);
              });

              // Deduplicate by userId
              const seen = new Set<string>();
              recipients = recipients.filter(r => {
                if (!r.userId) return false;
                if (seen.has(r.userId)) return false;
                seen.add(r.userId);
                return true;
              });
            } catch (linkErr) {
              console.warn('Failed to augment recipients via adminInvites linkage:', linkErr);
            }
          }
          
          if (recipients.length === 0) {
            console.log(`No valid recipients found for ${member.firstName} ${member.lastName}`);
            results.skipped++;
            continue;
          }

          // Get bacenta name
          const bacenta = bacentas.find(b => b.id === member.bacentaId);
          const bacentaName = bacenta?.name || 'Unassigned';

          // Create notification record
          const notificationRecord = createBirthdayNotificationRecord(
            member,
            bacentaName,
            daysUntilBirthday,
            recipients,
            'pending'
          );

          // Save notification record
          const notificationId = await this.saveBirthdayNotification(churchId, notificationRecord);

          // Create in-app bell notifications for each recipient immediately (not dependent on email success)
          try {
            const recipientIds = recipients.map(r => r.userId);
            const description = daysUntilBirthday === 0
              ? `Birthday today: ${member.firstName} ${member.lastName || ''}`.trim()
              : `Birthday in ${daysUntilBirthday} day${daysUntilBirthday !== 1 ? 's' : ''}: ${member.firstName} ${member.lastName || ''}`.trim();

            await notificationService.createForRecipients(
              recipientIds,
              'birthday_reminder',
              description,
              {
                memberName: `${member.firstName} ${member.lastName || ''}`.trim(),
                description
              },
              {
                daysUntilBirthday,
                bacentaId: member.bacentaId,
                bacentaName
              } as any,
              { id: 'system', name: 'System' }
            );
            // Also push a church-wide admin copy for traceability (optional)
            // no-op if you want minimal volume
          } catch (bellErr) {
            console.warn('Failed to create in-app birthday bell notifications:', bellErr);
          }

          if (BirthdayNotificationService.ENABLE_BIRTHDAY_EMAILS) {
            // Send emails to recipients with a timeout so UI doesn't hang indefinitely
            const emailTemplates = recipients
              .filter(r => !!r.email) // only those with emails
              .map(recipient => ({
              template: this.emailService.generateBirthdayEmailTemplate(
                member,
                recipient,
                bacentaName,
                daysUntilBirthday
              ),
              recipient
            }));

            try {
              const emailResults = await withTimeout(
                this.emailService.sendBulkBirthdayNotifications(emailTemplates),
                20000 // 20s timeout for bulk send
              );

              const allEmailsSent = emailResults.every(result => result.success);
              const failedEmails = emailResults.filter(result => !result.success);

              if (allEmailsSent) {
                await this.updateNotificationStatus(
                  churchId,
                  notificationId,
                  'sent',
                  {
                    subject: emailTemplates[0].template.subject,
                    sentAt: new Date().toISOString(),
                    messageId: emailResults[0].messageId
                  }
                );
                results.sent++;
                console.log(`Birthday notification emails sent for ${member.firstName} ${member.lastName}`);
              } else {
                const failureReasons = failedEmails.map(result => `${result.recipient.email}: ${result.error}`).join('; ');
                await this.updateNotificationStatus(
                  churchId,
                  notificationId,
                  'failed',
                  {
                    subject: emailTemplates[0].template.subject,
                    sentAt: new Date().toISOString(),
                    failureReason: failureReasons
                  }
                );
                results.failed++;
                results.errors.push(`Failed to send notification for ${member.firstName} ${member.lastName}: ${failureReasons}`);
              }
            } catch (emailErr: any) {
              await this.updateNotificationStatus(
                churchId,
                notificationId,
                'failed',
                {
                  subject: 'Birthday Notification',
                  sentAt: new Date().toISOString(),
                  failureReason: emailErr?.message || 'Email send failed (timeout)'
                }
              );
              results.failed++;
              results.errors.push(`Email send error for ${member.firstName} ${member.lastName}: ${emailErr?.message || 'timeout'}`);
            }
          } else {
            // Email delivery disabled: mark as sent based on in-app notifications
            await this.updateNotificationStatus(
              churchId,
              notificationId,
              'sent',
              {
                subject: 'Birthday Notification',
                sentAt: new Date().toISOString()
              }
            );
            results.sent++;
          }

        } catch (memberError: any) {
          results.failed++;
          results.errors.push(`Error processing ${member.firstName} ${member.lastName}: ${memberError.message}`);
          console.error(`Error processing member ${member.id}:`, memberError);
        }
      }

      console.log(`Birthday notification processing complete:`, results);
      return results;

    } catch (error: any) {
      results.errors.push(`Fatal error in notification processing: ${error.message}`);
      console.error('Fatal error in birthday notification processing:', error);
      return results;
    }
  }

  /**
   * Get notification statistics for admin dashboard
   */
  public async getNotificationStats(
    churchId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalNotifications: number;
    sentNotifications: number;
    failedNotifications: number;
    pendingNotifications: number;
    uniqueMembers: number;
  }> {
    try {
      const notifications = await this.getExistingNotifications(churchId, startDate, endDate);
      
      const stats = {
        totalNotifications: notifications.length,
        sentNotifications: notifications.filter(n => n.status === 'sent').length,
        failedNotifications: notifications.filter(n => n.status === 'failed').length,
        pendingNotifications: notifications.filter(n => n.status === 'pending').length,
        uniqueMembers: new Set(notifications.map(n => n.memberId)).size
      };

      return stats;
    } catch (error: any) {
      console.error('Error getting notification stats:', error);
      throw new Error(`Failed to get notification stats: ${error.message}`);
    }
  }

  /**
   * Clean up old notification records (for maintenance)
   */
  public async cleanupOldNotifications(
    churchId: string,
    olderThanDays: number = 90
  ): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

      const notificationsRef = collection(db, `churches/${churchId}/birthdayNotifications`);
      const q = query(
        notificationsRef,
        where('notificationDate', '<', cutoffDateStr),
        limit(100) // Process in batches
      );

      const snapshot = await getDocs(q);
      let deletedCount = 0;

      // Note: In a production environment, you'd want to use batch deletes
      // and possibly run this as a scheduled Cloud Function
      for (const docSnapshot of snapshot.docs) {
        await deleteDoc(docSnapshot.ref);
        deletedCount++;
      }

      console.log(`Cleaned up ${deletedCount} old notification records`);
      return deletedCount;
    } catch (error: any) {
      console.error('Error cleaning up old notifications:', error);
      throw new Error(`Failed to cleanup old notifications: ${error.message}`);
    }
  }
}
