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
  startAfter,
  DocumentSnapshot
} from 'firebase/firestore';
import { db } from '../firebase.config';
import { BirthdayNotification } from '../types';

/**
 * Service for tracking and auditing birthday notifications
 * Provides duplicate prevention, audit logging, and analytics
 */
export class NotificationTrackingService {
  private static instance: NotificationTrackingService;
  
  private constructor() {}
  
  public static getInstance(): NotificationTrackingService {
    if (!NotificationTrackingService.instance) {
      NotificationTrackingService.instance = new NotificationTrackingService();
    }
    return NotificationTrackingService.instance;
  }

  /**
   * Create audit log entry for notification attempt
   */
  public async createAuditLog(
    churchId: string,
    action: 'notification_sent' | 'notification_failed' | 'notification_skipped' | 'settings_updated',
    details: {
      memberId?: string;
      memberName?: string;
      recipientEmails?: string[];
      errorMessage?: string;
      notificationId?: string;
      userId?: string;
      timestamp?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    try {
      const auditLogRef = collection(db, `churches/${churchId}/notificationAuditLogs`);
      const auditEntry = {
        action,
        ...details,
        timestamp: details.timestamp || new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      
      const docRef = await addDoc(auditLogRef, auditEntry);
      return docRef.id;
    } catch (error: any) {
      console.error('Error creating audit log:', error);
      throw new Error(`Failed to create audit log: ${error.message}`);
    }
  }

  /**
   * Get audit logs with pagination
   */
  public async getAuditLogs(
    churchId: string,
    options: {
      limit?: number;
      startAfterDoc?: DocumentSnapshot;
      action?: string;
      memberId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    logs: Array<any>;
    hasMore: boolean;
    lastDoc?: DocumentSnapshot;
  }> {
    try {
      const auditLogRef = collection(db, `churches/${churchId}/notificationAuditLogs`);
      let q = query(auditLogRef, orderBy('timestamp', 'desc'));

      // Apply filters
      if (options.action) {
        q = query(q, where('action', '==', options.action));
      }
      
      if (options.memberId) {
        q = query(q, where('memberId', '==', options.memberId));
      }
      
      if (options.startDate) {
        q = query(q, where('timestamp', '>=', options.startDate.toISOString()));
      }
      
      if (options.endDate) {
        q = query(q, where('timestamp', '<=', options.endDate.toISOString()));
      }

      // Apply pagination
      if (options.startAfterDoc) {
        q = query(q, startAfter(options.startAfterDoc));
      }
      
      q = query(q, limit(options.limit || 50));

      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return {
        logs,
        hasMore: snapshot.docs.length === (options.limit || 50),
        lastDoc: snapshot.docs[snapshot.docs.length - 1]
      };
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
      throw new Error(`Failed to fetch audit logs: ${error.message}`);
    }
  }

  /**
   * Check for duplicate notifications with enhanced logic
   */
  public async checkForDuplicates(
    churchId: string,
    memberId: string,
    daysBeforeBirthday: number,
    targetDate: Date,
    windowHours: number = 24
  ): Promise<{
    isDuplicate: boolean;
    existingNotification?: BirthdayNotification;
    reason?: string;
  }> {
    try {
      const targetDateStr = targetDate.toISOString().split('T')[0];
      
      // Check for exact match first
      const notificationsRef = collection(db, `churches/${churchId}/birthdayNotifications`);
      const exactMatchQuery = query(
        notificationsRef,
        where('memberId', '==', memberId),
        where('daysBeforeBirthday', '==', daysBeforeBirthday),
        where('notificationDate', '==', targetDateStr),
        where('status', '==', 'sent')
      );

      const exactMatchSnapshot = await getDocs(exactMatchQuery);
      if (!exactMatchSnapshot.empty) {
        return {
          isDuplicate: true,
          existingNotification: {
            id: exactMatchSnapshot.docs[0].id,
            ...exactMatchSnapshot.docs[0].data()
          } as BirthdayNotification,
          reason: 'Exact match found for same member, days before birthday, and date'
        };
      }

      // Check for notifications within the time window
      const windowStart = new Date(targetDate);
      windowStart.setHours(windowStart.getHours() - windowHours);
      const windowEnd = new Date(targetDate);
      windowEnd.setHours(windowEnd.getHours() + windowHours);

      const windowQuery = query(
        notificationsRef,
        where('memberId', '==', memberId),
        where('daysBeforeBirthday', '==', daysBeforeBirthday),
        where('createdAt', '>=', windowStart.toISOString()),
        where('createdAt', '<=', windowEnd.toISOString()),
        where('status', '==', 'sent')
      );

      const windowSnapshot = await getDocs(windowQuery);
      if (!windowSnapshot.empty) {
        return {
          isDuplicate: true,
          existingNotification: {
            id: windowSnapshot.docs[0].id,
            ...windowSnapshot.docs[0].data()
          } as BirthdayNotification,
          reason: `Notification sent within ${windowHours} hour window`
        };
      }

      return { isDuplicate: false };
    } catch (error: any) {
      console.error('Error checking for duplicates:', error);
      throw new Error(`Failed to check for duplicates: ${error.message}`);
    }
  }

  /**
   * Get notification analytics for dashboard
   */
  public async getNotificationAnalytics(
    churchId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalNotifications: number;
    successfulNotifications: number;
    failedNotifications: number;
    uniqueMembers: number;
    notificationsByDay: Array<{ date: string; count: number }>;
    notificationsByType: Array<{ daysBeforeBirthday: number; count: number }>;
    topRecipients: Array<{ userId: string; email: string; count: number }>;
    errorSummary: Array<{ error: string; count: number }>;
  }> {
    try {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Get all notifications in the date range
      const notificationsRef = collection(db, `churches/${churchId}/birthdayNotifications`);
      const q = query(
        notificationsRef,
        where('notificationDate', '>=', startDateStr),
        where('notificationDate', '<=', endDateStr),
        orderBy('notificationDate', 'desc')
      );

      const snapshot = await getDocs(q);
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as BirthdayNotification));

      // Calculate analytics
      const totalNotifications = notifications.length;
      const successfulNotifications = notifications.filter(n => n.status === 'sent').length;
      const failedNotifications = notifications.filter(n => n.status === 'failed').length;
      const uniqueMembers = new Set(notifications.map(n => n.memberId)).size;

      // Notifications by day
      const notificationsByDay = this.groupNotificationsByDay(notifications);

      // Notifications by type (days before birthday)
      const notificationsByType = this.groupNotificationsByType(notifications);

      // Top recipients (users who receive the most notifications)
      const topRecipients = this.getTopRecipients(notifications);

      // Error summary
      const errorSummary = this.getErrorSummary(notifications);

      return {
        totalNotifications,
        successfulNotifications,
        failedNotifications,
        uniqueMembers,
        notificationsByDay,
        notificationsByType,
        topRecipients,
        errorSummary
      };
    } catch (error: any) {
      console.error('Error getting notification analytics:', error);
      throw new Error(`Failed to get notification analytics: ${error.message}`);
    }
  }

  /**
   * Group notifications by day
   */
  private groupNotificationsByDay(notifications: BirthdayNotification[]): Array<{ date: string; count: number }> {
    const groupedByDay = notifications.reduce((acc, notification) => {
      const date = notification.notificationDate;
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(groupedByDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Group notifications by type (days before birthday)
   */
  private groupNotificationsByType(notifications: BirthdayNotification[]): Array<{ daysBeforeBirthday: number; count: number }> {
    const groupedByType = notifications.reduce((acc, notification) => {
      const days = notification.daysBeforeBirthday;
      acc[days] = (acc[days] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return Object.entries(groupedByType)
      .map(([days, count]) => ({ daysBeforeBirthday: parseInt(days), count }))
      .sort((a, b) => b.daysBeforeBirthday - a.daysBeforeBirthday);
  }

  /**
   * Get top recipients of notifications
   */
  private getTopRecipients(notifications: BirthdayNotification[]): Array<{ userId: string; email: string; count: number }> {
    const recipientCounts = notifications.reduce((acc, notification) => {
      notification.sentTo.forEach(userId => {
        if (!acc[userId]) {
          acc[userId] = { userId, count: 0, email: '' };
        }
        acc[userId].count++;
      });
      return acc;
    }, {} as Record<string, { userId: string; count: number; email: string }>);

    return Object.values(recipientCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 recipients
  }

  /**
   * Get error summary from failed notifications
   */
  private getErrorSummary(notifications: BirthdayNotification[]): Array<{ error: string; count: number }> {
    const failedNotifications = notifications.filter(n => n.status === 'failed');
    const errorCounts = failedNotifications.reduce((acc, notification) => {
      const error = notification.emailDetails?.failureReason || 'Unknown error';
      acc[error] = (acc[error] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(errorCounts)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Mark notification as processed to prevent reprocessing
   */
  public async markNotificationProcessed(
    churchId: string,
    notificationId: string,
    processingResult: {
      status: 'sent' | 'failed';
      emailDetails?: any;
      processingTime: number;
      retryCount?: number;
    }
  ): Promise<void> {
    try {
      const notificationRef = doc(db, `churches/${churchId}/birthdayNotifications`, notificationId);
      await updateDoc(notificationRef, {
        ...processingResult,
        lastUpdated: new Date().toISOString(),
        processedAt: new Date().toISOString()
      });

      // Create audit log entry
      await this.createAuditLog(churchId, 
        processingResult.status === 'sent' ? 'notification_sent' : 'notification_failed',
        {
          notificationId,
          processingTime: processingResult.processingTime,
          retryCount: processingResult.retryCount,
          errorMessage: processingResult.status === 'failed' ? processingResult.emailDetails?.failureReason : undefined
        }
      );
    } catch (error: any) {
      console.error('Error marking notification as processed:', error);
      throw new Error(`Failed to mark notification as processed: ${error.message}`);
    }
  }

  /**
   * Get notification delivery rate for monitoring
   */
  public async getDeliveryRate(
    churchId: string,
    days: number = 30
  ): Promise<{
    totalAttempts: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    deliveryRate: number;
    averageProcessingTime: number;
  }> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      const analytics = await this.getNotificationAnalytics(churchId, startDate, endDate);
      
      const totalAttempts = analytics.totalNotifications;
      const successfulDeliveries = analytics.successfulNotifications;
      const failedDeliveries = analytics.failedNotifications;
      const deliveryRate = totalAttempts > 0 ? (successfulDeliveries / totalAttempts) * 100 : 0;

      // TODO: Calculate average processing time from audit logs
      const averageProcessingTime = 0; // Placeholder

      return {
        totalAttempts,
        successfulDeliveries,
        failedDeliveries,
        deliveryRate,
        averageProcessingTime
      };
    } catch (error: any) {
      console.error('Error getting delivery rate:', error);
      throw new Error(`Failed to get delivery rate: ${error.message}`);
    }
  }
}
