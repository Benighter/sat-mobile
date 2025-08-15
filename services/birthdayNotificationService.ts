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
    notificationDays: number[] = [7, 3, 1],
    referenceDate: Date = new Date()
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

      // Process each member
      for (const { member, daysUntilBirthday } of membersNeedingNotifications) {
        results.processed++;

        try {
          // Check if notification already sent
          if (hasNotificationBeenSent(existingNotifications, member.id, daysUntilBirthday, referenceDate)) {
            console.log(`Notification already sent for ${member.firstName} ${member.lastName} (${daysUntilBirthday} days)`);
            results.skipped++;
            continue;
          }

          // Determine recipients
          const recipients = determineNotificationRecipients(member, users, bacentas);
          
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

          // Send emails to recipients
          const emailTemplates = recipients.map(recipient => ({
            template: this.emailService.generateBirthdayEmailTemplate(
              member,
              recipient,
              bacentaName,
              daysUntilBirthday
            ),
            recipient
          }));

          const emailResults = await this.emailService.sendBulkBirthdayNotifications(emailTemplates);

          // Check if all emails were sent successfully
          const allEmailsSent = emailResults.every(result => result.success);
          const failedEmails = emailResults.filter(result => !result.success);

          if (allEmailsSent) {
            // Update notification status to sent
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
            console.log(`Birthday notification sent successfully for ${member.firstName} ${member.lastName}`);

            // Also create in-app bell notifications for each recipient
            try {
              // Ensure notification context is set for creation
              // Use a pseudo/system user context to attribute the reminder
              setNotificationContext({
                // Minimal User shape for context
                id: 'system',
                uid: 'system',
                email: 'noreply@sat-mobile',
                displayName: 'System',
                churchId,
                role: 'leader',
                isActive: true,
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString()
              } as any, churchId);

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
                } as any
              );
            } catch (bellErr) {
              console.warn('Failed to create in-app birthday bell notifications:', bellErr);
            }
          } else {
            // Update notification status to failed
            const failureReasons = failedEmails.map(result => 
              `${result.recipient.email}: ${result.error}`
            ).join('; ');

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
