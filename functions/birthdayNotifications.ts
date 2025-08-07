/**
 * Firebase Cloud Function for automated birthday notifications
 * Runs daily at 9:00 AM to send birthday alerts to relevant administrators and leaders
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Member, User, Bacenta, Church } from '../types';
import { BirthdayNotificationService } from '../services/birthdayNotificationService';

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

/**
 * Scheduled function that runs daily at 9:00 AM to process birthday notifications
 */
export const processDailyBirthdayNotifications = onSchedule({
  schedule: '0 9 * * *', // Run daily at 9:00 AM
  timeZone: 'UTC', // Adjust based on your church's timezone
  memory: '1GiB',
  timeoutSeconds: 540, // 9 minutes timeout
}, async (event) => {
  logger.info('Starting daily birthday notification processing');
  
  try {
    // Get all active churches
    const churchesSnapshot = await db.collection('churches').get();
    const churches = churchesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Church));

    let totalProcessed = 0;
    let totalSent = 0;
    let totalFailed = 0;
    let totalErrors: string[] = [];

    // Process notifications for each church
    for (const church of churches) {
      try {
        logger.info(`Processing birthday notifications for church: ${church.name} (${church.id})`);

        // Check if birthday notifications are enabled for this church
        if (church.settings?.notificationSettings?.birthdayNotificationsEnabled === false) {
          logger.info(`Birthday notifications disabled for church ${church.name}`);
          continue;
        }

        // Get church data
        const [membersSnapshot, usersSnapshot, bacentasSnapshot] = await Promise.all([
          db.collection(`churches/${church.id}/members`).get(),
          db.collection(`churches/${church.id}/users`).get(),
          db.collection(`churches/${church.id}/bacentas`).get()
        ]);

        const members = membersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Member));

        const users = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as User));

        const bacentas = bacentasSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Bacenta));

        // Filter out members without birthdays
        const membersWithBirthdays = members.filter(member => member.birthday);
        
        if (membersWithBirthdays.length === 0) {
          logger.info(`No members with birthdays found for church ${church.name}`);
          continue;
        }

        // Get notification settings
        const notificationDays = church.settings?.notificationSettings?.defaultNotificationDays || [7, 3, 1];
        
        // Process notifications
        const notificationService = BirthdayNotificationService.getInstance();
        const results = await notificationService.processBirthdayNotifications(
          church.id,
          membersWithBirthdays,
          users,
          bacentas,
          notificationDays,
          new Date()
        );

        // Aggregate results
        totalProcessed += results.processed;
        totalSent += results.sent;
        totalFailed += results.failed;
        totalErrors.push(...results.errors);

        logger.info(`Church ${church.name} results:`, {
          processed: results.processed,
          sent: results.sent,
          failed: results.failed,
          skipped: results.skipped
        });

        // Log any errors for this church
        if (results.errors.length > 0) {
          logger.error(`Errors for church ${church.name}:`, results.errors);
        }

      } catch (churchError: any) {
        logger.error(`Error processing church ${church.id}:`, churchError);
        totalErrors.push(`Church ${church.id}: ${churchError.message}`);
      }
    }

    // Log final results
    logger.info('Daily birthday notification processing completed', {
      totalChurches: churches.length,
      totalProcessed,
      totalSent,
      totalFailed,
      totalErrors: totalErrors.length
    });

    if (totalErrors.length > 0) {
      logger.error('Errors encountered during processing:', totalErrors);
    }

    return {
      success: true,
      totalProcessed,
      totalSent,
      totalFailed,
      errors: totalErrors
    };

  } catch (error: any) {
    logger.error('Fatal error in birthday notification processing:', error);
    throw error;
  }
});

/**
 * Manual trigger function for testing birthday notifications
 * Can be called via HTTP request for testing purposes
 */
export const testBirthdayNotifications = onSchedule({
  schedule: 'every 24 hours', // Placeholder schedule, will be triggered manually
  memory: '1GiB',
  timeoutSeconds: 540,
}, async (event) => {
  logger.info('Manual birthday notification test triggered');
  
  // This function can be used for testing by manually triggering it
  // It uses the same logic as the daily function but can be run on demand
  return await processDailyBirthdayNotifications.run(event);
});

/**
 * Function to get birthday notification statistics
 * Useful for admin dashboards and monitoring
 */
export const getBirthdayNotificationStats = onSchedule({
  schedule: '0 10 * * *', // Run daily at 10:00 AM (after notifications are sent)
  timeZone: 'UTC',
  memory: '512MiB',
  timeoutSeconds: 300,
}, async (event) => {
  logger.info('Generating birthday notification statistics');
  
  try {
    const churchesSnapshot = await db.collection('churches').get();
    const churches = churchesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Church));

    const stats = [];
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    for (const church of churches) {
      try {
        const notificationService = BirthdayNotificationService.getInstance();
        const churchStats = await notificationService.getNotificationStats(
          church.id,
          thirtyDaysAgo,
          today
        );

        stats.push({
          churchId: church.id,
          churchName: church.name,
          ...churchStats
        });

        // Store stats in Firestore for dashboard access
        await db.collection(`churches/${church.id}/notificationStats`).add({
          ...churchStats,
          generatedAt: new Date().toISOString(),
          period: {
            startDate: thirtyDaysAgo.toISOString(),
            endDate: today.toISOString()
          }
        });

      } catch (error: any) {
        logger.error(`Error generating stats for church ${church.id}:`, error);
      }
    }

    logger.info('Birthday notification statistics generated', { totalChurches: stats.length });
    return { success: true, stats };

  } catch (error: any) {
    logger.error('Error generating birthday notification statistics:', error);
    throw error;
  }
});

/**
 * Cleanup function to remove old notification records
 * Runs weekly to maintain database performance
 */
export const cleanupOldBirthdayNotifications = onSchedule({
  schedule: '0 2 * * 0', // Run weekly on Sunday at 2:00 AM
  timeZone: 'UTC',
  memory: '512MiB',
  timeoutSeconds: 600,
}, async (event) => {
  logger.info('Starting cleanup of old birthday notification records');
  
  try {
    const churchesSnapshot = await db.collection('churches').get();
    const churches = churchesSnapshot.docs.map(doc => ({ id: doc.id }));

    let totalCleaned = 0;

    for (const church of churches) {
      try {
        const notificationService = BirthdayNotificationService.getInstance();
        const cleaned = await notificationService.cleanupOldNotifications(
          church.id,
          90 // Keep records for 90 days
        );
        
        totalCleaned += cleaned;
        logger.info(`Cleaned ${cleaned} records for church ${church.id}`);

      } catch (error: any) {
        logger.error(`Error cleaning up church ${church.id}:`, error);
      }
    }

    logger.info(`Cleanup completed. Total records cleaned: ${totalCleaned}`);
    return { success: true, totalCleaned };

  } catch (error: any) {
    logger.error('Error in cleanup function:', error);
    throw error;
  }
});

/**
 * HTTP function for manual notification processing (for admin use)
 */
import { onRequest } from 'firebase-functions/v2/https';

export const manualBirthdayNotificationTrigger = onRequest({
  memory: '1GiB',
  timeoutSeconds: 540,
}, async (req, res) => {
  // Add authentication check here
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // TODO: Verify the token and check if user has admin privileges
  
  try {
    logger.info('Manual birthday notification trigger called');
    
    const churchId = req.body.churchId;
    if (!churchId) {
      res.status(400).json({ error: 'Church ID is required' });
      return;
    }

    // Get church data
    const [membersSnapshot, usersSnapshot, bacentasSnapshot] = await Promise.all([
      db.collection(`churches/${churchId}/members`).get(),
      db.collection(`churches/${churchId}/users`).get(),
      db.collection(`churches/${churchId}/bacentas`).get()
    ]);

    const members = membersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Member));

    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as User));

    const bacentas = bacentasSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Bacenta));

    // Process notifications
    const notificationService = BirthdayNotificationService.getInstance();
    const results = await notificationService.processBirthdayNotifications(
      churchId,
      members.filter(m => m.birthday),
      users,
      bacentas,
      [7, 3, 1],
      new Date()
    );

    res.json({
      success: true,
      message: 'Birthday notifications processed successfully',
      results
    });

  } catch (error: any) {
    logger.error('Error in manual notification trigger:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});
