import { 
  determineNotificationRecipients,
  hasNotificationBeenSent,
  getMembersNeedingNotifications,
  validateNotificationSettings,
  getDefaultNotificationPreferences,
  isNotificationTime
} from '../utils/notificationUtils';
import { Member, User, Bacenta, BirthdayNotification } from '../types';

// Mock data for testing
const mockMembers: Member[] = [
  {
    id: 'member1',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '123-456-7890',
    buildingAddress: '123 Main St',
    bornAgainStatus: true,
    bacentaId: 'bacenta1',
    bacentaLeaderId: 'leader1',
    role: 'Member',
    birthday: '1990-12-25', // Christmas birthday
    createdDate: '2023-01-01T00:00:00Z',
    lastUpdated: '2023-01-01T00:00:00Z'
  },
  {
    id: 'member2',
    firstName: 'Jane',
    lastName: 'Smith',
    phoneNumber: '098-765-4321',
    buildingAddress: '456 Oak Ave',
    bornAgainStatus: false,
    bacentaId: 'bacenta2',
    bacentaLeaderId: 'leader2',
    role: 'Fellowship Leader',
    birthday: '1985-01-15',
    createdDate: '2023-01-01T00:00:00Z',
    lastUpdated: '2023-01-01T00:00:00Z'
  },
  {
    id: 'member3',
    firstName: 'Bob',
    lastName: 'Johnson',
    phoneNumber: '555-123-4567',
    buildingAddress: '789 Pine St',
    bornAgainStatus: true,
    bacentaId: 'bacenta1',
    role: 'Member',
    createdDate: '2023-01-01T00:00:00Z',
    lastUpdated: '2023-01-01T00:00:00Z'
    // No birthday set
  }
];

const mockUsers: User[] = [
  {
    id: 'admin1',
    uid: 'admin1',
    email: 'admin@church.com',
    displayName: 'Admin User',
    firstName: 'Admin',
    lastName: 'User',
    churchId: 'church1',
    role: 'admin',
    preferences: {
      theme: 'light',
      allowEditPreviousSundays: true
    },
    notificationPreferences: {
      birthdayNotifications: {
        enabled: true,
  daysBeforeNotification: [7, 3, 1, 0],
  emailTime: '00:00'
      },
      emailNotifications: true,
      pushNotifications: true
    },
    createdAt: '2023-01-01T00:00:00Z',
    lastLoginAt: '2023-01-01T00:00:00Z',
    isActive: true
  },
  {
    id: 'leader1',
    uid: 'leader1',
    email: 'leader1@church.com',
    displayName: 'Bacenta Leader 1',
    firstName: 'Leader',
    lastName: 'One',
    churchId: 'church1',
    role: 'leader',
    preferences: {
      theme: 'light',
      allowEditPreviousSundays: true
    },
    notificationPreferences: {
      birthdayNotifications: {
        enabled: true,
  daysBeforeNotification: [7, 3, 1, 0],
  emailTime: '00:00'
      },
      emailNotifications: true,
      pushNotifications: false
    },
    createdAt: '2023-01-01T00:00:00Z',
    lastLoginAt: '2023-01-01T00:00:00Z',
    isActive: true
  },
  {
    id: 'leader2',
    uid: 'leader2',
    email: 'leader2@church.com',
    displayName: 'Bacenta Leader 2',
    firstName: 'Leader',
    lastName: 'Two',
    churchId: 'church1',
    role: 'leader',
    preferences: {
      theme: 'dark',
      allowEditPreviousSundays: false
    },
    notificationPreferences: {
      birthdayNotifications: {
          enabled: false, // Disabled notifications
        daysBeforeNotification: [7, 3, 1, 0],
        emailTime: '00:00'
      },
      emailNotifications: true,
      pushNotifications: true
    },
    createdAt: '2023-01-01T00:00:00Z',
    lastLoginAt: '2023-01-01T00:00:00Z',
    isActive: true
  }
];

const mockBacentas: Bacenta[] = [
  { id: 'bacenta1', name: 'Bacenta Alpha' },
  { id: 'bacenta2', name: 'Bacenta Beta' }
];

const mockExistingNotifications: BirthdayNotification[] = [
  {
    id: 'notif1',
    memberId: 'member1',
    memberName: 'John Doe',
    memberBirthday: '1990-12-25',
    bacentaId: 'bacenta1',
    bacentaName: 'Bacenta Alpha',
    notificationDate: '2023-12-18', // 7 days before Christmas
    daysBeforeBirthday: 7,
    sentTo: ['admin1', 'leader1'],
    status: 'sent',
    createdAt: '2023-12-18T09:00:00Z',
    lastUpdated: '2023-12-18T09:00:00Z'
  }
];

describe('Notification Utils', () => {
  describe('determineNotificationRecipients', () => {
    test('should return admin and bacenta leader for member in bacenta1', () => {
      const member = mockMembers[0]; // John Doe in bacenta1
      const recipients = determineNotificationRecipients(member, mockUsers, mockBacentas);
      
      expect(recipients).toHaveLength(2);
      expect(recipients.some(r => r.userId === 'admin1')).toBe(true);
      expect(recipients.some(r => r.userId === 'leader1')).toBe(true);
      expect(recipients.some(r => r.userId === 'leader2')).toBe(false); // Different bacenta
    });

    test('should exclude users with disabled birthday notifications', () => {
      const member = mockMembers[1]; // Jane Smith in bacenta2
      const recipients = determineNotificationRecipients(member, mockUsers, mockBacentas);
      
      // Should include admin but not leader2 (disabled notifications)
      expect(recipients.some(r => r.userId === 'admin1')).toBe(true);
      expect(recipients.some(r => r.userId === 'leader2')).toBe(false);
    });

    test('should return empty array for member with no bacenta', () => {
      const memberWithoutBacenta = {
        ...mockMembers[0],
        bacentaId: 'nonexistent'
      };
      const recipients = determineNotificationRecipients(memberWithoutBacenta, mockUsers, mockBacentas);
      
      expect(recipients).toHaveLength(0);
    });

    test('should respect organizational boundaries', () => {
      const member = mockMembers[0]; // bacenta1
      const recipients = determineNotificationRecipients(member, mockUsers, mockBacentas);
      
      // Should not include leader2 who is responsible for bacenta2
      expect(recipients.every(r => r.userId !== 'leader2')).toBe(true);
    });
  });

  describe('hasNotificationBeenSent', () => {
    test('should return true for existing notification', () => {
      const result = hasNotificationBeenSent(
        mockExistingNotifications,
        'member1',
        7,
        new Date('2023-12-18')
      );
      
      expect(result).toBe(true);
    });

    test('should return false for non-existing notification', () => {
      const result = hasNotificationBeenSent(
        mockExistingNotifications,
        'member1',
        3, // Different days before birthday
        new Date('2023-12-18')
      );
      
      expect(result).toBe(false);
    });

    test('should return false for different member', () => {
      const result = hasNotificationBeenSent(
        mockExistingNotifications,
        'member2',
        7,
        new Date('2023-12-18')
      );
      
      expect(result).toBe(false);
    });

    test('should return false for failed notifications', () => {
      const failedNotifications = [{
        ...mockExistingNotifications[0],
        status: 'failed' as const
      }];
      
      const result = hasNotificationBeenSent(
        failedNotifications,
        'member1',
        7,
        new Date('2023-12-18')
      );
      
      expect(result).toBe(false);
    });
  });

  describe('getMembersNeedingNotifications', () => {
    test('should return members with birthdays in notification window', () => {
      // Test for Christmas (Dec 25) - check 7 days before (Dec 18)
      const testDate = new Date('2023-12-18');
      const members = getMembersNeedingNotifications(mockMembers, [7, 3, 1], testDate);
      
      expect(members).toHaveLength(1);
      expect(members[0].member.id).toBe('member1');
      expect(members[0].daysUntilBirthday).toBe(7);
    });

    test('should exclude members without birthdays', () => {
      const testDate = new Date('2023-12-18');
      const members = getMembersNeedingNotifications(mockMembers, [7, 3, 1], testDate);
      
      // Should not include member3 who has no birthday
      expect(members.every(m => m.member.id !== 'member3')).toBe(true);
    });

    test('should return empty array when no birthdays match', () => {
      // Test for a date with no matching birthdays
      const testDate = new Date('2023-06-15');
      const members = getMembersNeedingNotifications(mockMembers, [7, 3, 1], testDate);
      
      expect(members).toHaveLength(0);
    });

    test('should handle custom notification days', () => {
      const testDate = new Date('2023-12-24'); // 1 day before Christmas
      const members = getMembersNeedingNotifications(mockMembers, [1], testDate);
      
      expect(members).toHaveLength(1);
      expect(members[0].daysUntilBirthday).toBe(1);
    });
  });

  describe('validateNotificationSettings', () => {
    test('should validate user with proper settings', () => {
      const user = mockUsers[0]; // admin1 with all settings enabled
      const result = validateNotificationSettings(user);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should invalidate user without email', () => {
      const userWithoutEmail = {
        ...mockUsers[0],
        email: ''
      };
      const result = validateNotificationSettings(userWithoutEmail);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('User email is required for notifications');
    });

    test('should invalidate user with disabled birthday notifications', () => {
      const user = mockUsers[2]; // leader2 with disabled birthday notifications
      const result = validateNotificationSettings(user);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('User has disabled birthday notifications');
    });

    test('should invalidate when church settings disable notifications', () => {
      const user = mockUsers[0];
      const churchSettings = {
        notificationSettings: {
          birthdayNotificationsEnabled: false
        }
      };
      const result = validateNotificationSettings(user, churchSettings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Birthday notifications are disabled at church level');
    });
  });

  describe('getDefaultNotificationPreferences', () => {
    test('should return default preferences', () => {
      const defaults = getDefaultNotificationPreferences();
      
      expect(defaults.birthdayNotifications.enabled).toBe(true);
  expect(defaults.birthdayNotifications.daysBeforeNotification).toEqual([7, 3, 1, 0]);
  expect(defaults.birthdayNotifications.emailTime).toBe('00:00');
      expect(defaults.emailNotifications).toBe(true);
      expect(defaults.pushNotifications).toBe(true);
    });
  });

  describe('isNotificationTime', () => {
    test('should return true when within notification time window', () => {
      const preferences = {
        birthdayNotifications: {
          emailTime: '09:00'
        }
      };
      
      // Test at 9:15 AM (within 30-minute window)
      const testTime = new Date('2023-12-18T09:15:00Z');
      const result = isNotificationTime(preferences, testTime);
      
      expect(result).toBe(true);
    });

    test('should return false when outside notification time window', () => {
      const preferences = {
        birthdayNotifications: {
          emailTime: '09:00'
        }
      };
      
      // Test at 11:00 AM (outside 30-minute window)
      const testTime = new Date('2023-12-18T11:00:00Z');
      const result = isNotificationTime(preferences, testTime);
      
      expect(result).toBe(false);
    });

    test('should handle edge cases at window boundaries', () => {
      const preferences = {
        birthdayNotifications: {
          emailTime: '09:00'
        }
      };
      
      // Test at exactly 30 minutes after (should still be true)
      const testTime = new Date('2023-12-18T09:30:00Z');
      const result = isNotificationTime(preferences, testTime);
      
      expect(result).toBe(true);
    });
  });

  describe('Privacy and Security Tests', () => {
    test('should not send notifications across bacenta boundaries', () => {
      const memberInBacenta1 = mockMembers[0];
      const recipients = determineNotificationRecipients(memberInBacenta1, mockUsers, mockBacentas);
      
      // Should not include leader2 who is responsible for bacenta2
      expect(recipients.every(r => r.relationshipToMember !== 'bacenta_leader' || r.bacentaId === 'bacenta1')).toBe(true);
    });

    test('should respect user privacy preferences', () => {
      const member = mockMembers[1]; // In bacenta2
      const recipients = determineNotificationRecipients(member, mockUsers, mockBacentas);
      
      // Should not include users who have disabled notifications
      expect(recipients.every(r => {
        const user = mockUsers.find(u => u.uid === r.userId);
        return user?.notificationPreferences?.birthdayNotifications?.enabled !== false;
      })).toBe(true);
    });

    test('should only include users with valid email addresses', () => {
      const member = mockMembers[0];
      const recipients = determineNotificationRecipients(member, mockUsers, mockBacentas);
      
      expect(recipients.every(r => r.email && r.email.includes('@'))).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle leap year birthdays', () => {
      const leapYearMember = {
        ...mockMembers[0],
        birthday: '1992-02-29' // Leap year birthday
      };
      
      // Test in non-leap year
      const testDate = new Date('2023-02-26'); // 2 days before Feb 28
      const members = getMembersNeedingNotifications([leapYearMember], [3], testDate);
      
      // Should handle leap year birthday appropriately
      expect(members).toHaveLength(0); // Or 1, depending on implementation
    });

    test('should handle empty arrays gracefully', () => {
      const recipients = determineNotificationRecipients(mockMembers[0], [], mockBacentas);
      expect(recipients).toHaveLength(0);
      
      const members = getMembersNeedingNotifications([], [7, 3, 1], new Date());
      expect(members).toHaveLength(0);
    });

    test('should handle invalid dates gracefully', () => {
      const memberWithInvalidBirthday = {
        ...mockMembers[0],
        birthday: 'invalid-date'
      };
      
      expect(() => {
        getMembersNeedingNotifications([memberWithInvalidBirthday], [7, 3, 1], new Date());
      }).not.toThrow();
    });
  });
});
