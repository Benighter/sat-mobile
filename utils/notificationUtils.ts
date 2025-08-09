import { Member, User, Bacenta, NotificationRecipient, BirthdayNotification } from '../types';
import { calculateDaysUntilBirthday } from './birthdayUtils';

/**
 * Determine who should receive birthday notifications for a specific member
 * Respects organizational hierarchy and privacy boundaries
 */
export const determineNotificationRecipients = (
  member: Member,
  users: User[],
  bacentas: Bacenta[]
): NotificationRecipient[] => {
  const recipients: NotificationRecipient[] = [];
  const memberBacenta = bacentas.find(b => b.id === member.bacentaId);

  if (!memberBacenta) {
    console.warn(`No bacenta found for member ${member.id}`);
    return recipients;
  }

  // Find users who should receive notifications for this member
  users.forEach(user => {
    // Skip if user has disabled birthday notifications
    if (user.notificationPreferences?.birthdayNotifications?.enabled === false) {
      return;
    }

    // Skip if user has disabled email notifications entirely
    if (user.notificationPreferences?.emailNotifications === false) {
      return;
    }

    let shouldReceiveNotification = false;
    let relationshipToMember: 'admin' | 'bacenta_leader' | 'fellowship_leader' = 'admin';

    // Admin users: Only if they have oversight of this member's bacenta
    if (user.role === 'admin') {
      // For now, all admins receive notifications (can be refined based on church structure)
      shouldReceiveNotification = true;
      relationshipToMember = 'admin';
    }

    // Bacenta Leaders: Only if they are the leader of this member's bacenta
    if (user.role === 'leader') {
      // Check if this user is the Bacenta Leader for the member's bacenta
      if (member.bacentaLeaderId === user.uid) {
        shouldReceiveNotification = true;
        relationshipToMember = 'bacenta_leader';
      }
      
      // Check if this user is a Fellowship Leader in the same bacenta
      // (Fellowship Leaders report to the Bacenta Leader)
      const userAsMember = findUserAsMember(user.uid, member, users);
      if (userAsMember && 
          userAsMember.bacentaId === member.bacentaId && 
          userAsMember.role === 'Fellowship Leader') {
        shouldReceiveNotification = true;
        relationshipToMember = 'fellowship_leader';
      }
    }

    if (shouldReceiveNotification && user.email) {
      recipients.push({
        userId: user.uid,
        email: user.email,
        firstName: user.firstName || user.displayName.split(' ')[0] || 'User',
        lastName: user.lastName || user.displayName.split(' ').slice(1).join(' ') || '',
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
  notificationDays: number[] = [7, 3, 1],
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
    daysBeforeNotification: [7, 3, 1],
    emailTime: '09:00'
  },
  emailNotifications: true,
  pushNotifications: true
});

/**
 * Calculate the next notification date for a member
 */
export const getNextNotificationDate = (
  member: Member,
  notificationDays: number[] = [7, 3, 1],
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
