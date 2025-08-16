import { Member, User, Bacenta, NotificationRecipient, BirthdayNotification } from '../types';
import { calculateDaysUntilBirthday } from './birthdayUtils';

// Feature flag: When true, only admins and leaders linked by an admin receive birthday notifications
const ONLY_ADMIN_AND_LINKED = true;

/**
 * Determine who should receive birthday notifications for a specific member
 * Respects organizational hierarchy and privacy boundaries
 */
export const determineNotificationRecipients = (
  member: Member,
  users: User[],
  bacentas: Bacenta[],
  options?: { actorAdminId?: string }
): NotificationRecipient[] => {
  const recipients: NotificationRecipient[] = [];
  const memberBacenta = bacentas.find(b => b.id === member.bacentaId);
  // If no bacenta, we'll still notify admins/invited leaders; log and continue
  if (!memberBacenta) {
    console.warn(`No bacenta found for member ${member.id}; will notify admins/invited leaders only`);
  }

  // Find users who should receive notifications for this member
  users.forEach(user => {
    const resolvedUid = (user as any).uid || (user as any).id;
  // Note: In-app birthday reminders are independent of email preferences.
  // We do not filter by emailNotifications or per-user birthday toggle here
  // to ensure all relevant linked recipients get the reminder.

    let shouldReceiveNotification = false;
    let relationshipToMember: 'admin' | 'bacenta_leader' | 'fellowship_leader' = 'admin';

    // Admins always receive
    if (user.role === 'admin') {
      // If an actor admin is specified, only that admin should get the notification.
      // Otherwise, all admins receive.
      const isActorAdmin = options?.actorAdminId ? resolvedUid === options.actorAdminId : true;
      if (isActorAdmin) {
        shouldReceiveNotification = true;
        relationshipToMember = 'admin';
      }
    }

    // Leaders explicitly linked by an admin (invited) receive as 'admin' scope
    if (!shouldReceiveNotification && user.role === 'leader') {
      const invitedByAdminId = (user as any).invitedByAdminId as string | undefined;
      const invitedFlag = (user as any).isInvitedAdminLeader === true;
      const actorMatches = options?.actorAdminId ? invitedByAdminId === options.actorAdminId : true;
  if (actorMatches && (invitedFlag || !!invitedByAdminId)) {
        shouldReceiveNotification = true;
        relationshipToMember = 'admin';
      }
    }

    // Optional extended delivery to bacenta/fellowship leaders (disabled when ONLY_ADMIN_AND_LINKED)
    if (!ONLY_ADMIN_AND_LINKED && user.role === 'leader') {
      if (member.bacentaLeaderId === user.uid) {
        shouldReceiveNotification = true;
        relationshipToMember = 'bacenta_leader';
      }
      const userAsMember = findUserAsMember(user.uid, member, users);
      if (userAsMember && userAsMember.bacentaId === member.bacentaId && userAsMember.role === 'Fellowship Leader') {
        shouldReceiveNotification = true;
        relationshipToMember = 'fellowship_leader';
      }
    }

  if (shouldReceiveNotification) {
      const display = user.displayName || '';
      const [df, ...dl] = display ? display.split(' ') : [''];
      recipients.push({
    userId: resolvedUid,
        email: user.email || '',
        firstName: user.firstName || df || 'User',
        lastName: user.lastName || (dl.length ? dl.join(' ') : ''),
        role: user.role,
        relationshipToMember,
        bacentaId: relationshipToMember !== 'admin' ? member.bacentaId : undefined
      });
    }
  });

  return recipients;
};

/**
 * Helper function to find a user as a member in the members collection
 */
const findUserAsMember = (_userId: string, _currentMember: Member, _users: User[]): Member | null => {
  // This would need to be implemented based on how users are linked to members
  // For now, we'll assume the user ID matches the member ID or there's a mapping
  return null; // Placeholder - implement based on your user-member relationship
};

/**
 * Check if a notification has already been sent for a specific member and date
 */
export const hasNotificationBeenSent = (
  existingNotifications: BirthdayNotification[],
  memberId: string,
  daysBeforeBirthday: number,
  targetDate: Date
): boolean => {
  const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  return existingNotifications.some(notification => 
    notification.memberId === memberId &&
    notification.daysBeforeBirthday === daysBeforeBirthday &&
    notification.notificationDate === targetDateStr &&
    notification.status === 'sent'
  );
};

/**
 * Get members who need birthday notifications today
 */
export const getMembersNeedingNotifications = (
  members: Member[],
  notificationDays: number[] = [7, 3, 1, 0],
  referenceDate: Date = new Date()
): Array<{ member: Member; daysUntilBirthday: number }> => {
  const membersNeedingNotifications: Array<{ member: Member; daysUntilBirthday: number }> = [];

  members.forEach(member => {
    if (!member.birthday) return;

    const daysUntil = calculateDaysUntilBirthday(member.birthday, referenceDate);
    
    // Only send notifications for upcoming birthdays (0 or positive days)
    // Don't send for passed birthdays (negative days)
    if (daysUntil >= 0 && notificationDays.includes(daysUntil)) {
      membersNeedingNotifications.push({
        member,
        daysUntilBirthday: daysUntil
      });
    }
  });

  return membersNeedingNotifications;
};

/**
 * Create a birthday notification record
 */
export const createBirthdayNotificationRecord = (
  member: Member,
  bacentaName: string,
  daysBeforeBirthday: number,
  recipients: NotificationRecipient[],
  status: 'sent' | 'failed' | 'pending' = 'pending'
): Omit<BirthdayNotification, 'id'> => {
  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];

  return {
    memberId: member.id,
    memberName: `${member.firstName} ${member.lastName || ''}`.trim(),
    memberBirthday: member.birthday!,
    bacentaId: member.bacentaId,
    bacentaName,
    notificationDate: today,
    daysBeforeBirthday,
    sentTo: recipients.map(r => r.userId),
    status,
    createdAt: now,
    lastUpdated: now
  };
};

/**
 * Validate notification preferences and settings
 */
export const validateNotificationSettings = (
  user: User,
  churchSettings?: any
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check if user has email
  if (!user.email) {
    errors.push('User email is required for notifications');
  }

  // Check if user has enabled birthday notifications
  if (user.notificationPreferences?.birthdayNotifications?.enabled === false) {
    errors.push('User has disabled birthday notifications');
  }

  // Check if user has enabled email notifications
  if (user.notificationPreferences?.emailNotifications === false) {
    errors.push('User has disabled email notifications');
  }

  // Check church-level settings
  if (churchSettings?.notificationSettings?.birthdayNotificationsEnabled === false) {
    errors.push('Birthday notifications are disabled at church level');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Get default notification preferences for new users
 */
export const getDefaultNotificationPreferences = () => ({
  birthdayNotifications: {
    enabled: true,
  // Notify 7, 3, 1 days before and on the day (0)
  daysBeforeNotification: [7, 3, 1, 0],
    // Midnight by default
    emailTime: '00:00'
  },
  emailNotifications: true,
  pushNotifications: true
});

/**
 * Calculate the next notification date for a member
 */
export const getNextNotificationDate = (
  member: Member,
  notificationDays: number[] = [7, 3, 1, 0],
  referenceDate: Date = new Date()
): { date: Date; daysBeforeBirthday: number } | null => {
  if (!member.birthday) return null;

  const daysUntil = calculateDaysUntilBirthday(member.birthday, referenceDate);
  
  // Find the next notification day that hasn't passed
  const nextNotificationDay = notificationDays
    .filter(days => days <= daysUntil)
    .sort((a, b) => b - a)[0]; // Get the largest value that's <= daysUntil

  if (!nextNotificationDay) return null;

  const notificationDate = new Date(referenceDate);
  notificationDate.setDate(notificationDate.getDate() + (daysUntil - nextNotificationDay));

  return {
    date: notificationDate,
    daysBeforeBirthday: nextNotificationDay
  };
};

/**
 * Group notification recipients by their relationship to members
 */
export const groupRecipientsByRelationship = (recipients: NotificationRecipient[]) => {
  return recipients.reduce((groups, recipient) => {
    const relationship = recipient.relationshipToMember;
    if (!groups[relationship]) {
      groups[relationship] = [];
    }
    groups[relationship].push(recipient);
    return groups;
  }, {} as Record<string, NotificationRecipient[]>);
};

/**
 * Check if it's time to send notifications based on user preferences
 */
export const isNotificationTime = (
  userPreferences: any,
  currentTime: Date = new Date()
): boolean => {
  const notificationTime = userPreferences?.birthdayNotifications?.emailTime || '09:00';
  const [hours, minutes] = notificationTime.split(':').map(Number);
  
  const currentHours = currentTime.getHours();
  const currentMinutes = currentTime.getMinutes();
  
  // Allow a 30-minute window around the scheduled time
  const scheduledTime = hours * 60 + minutes;
  const currentTimeMinutes = currentHours * 60 + currentMinutes;
  
  return Math.abs(currentTimeMinutes - scheduledTime) <= 30;
};
