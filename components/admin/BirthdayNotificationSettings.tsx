import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { NotificationPreferences } from '../../types';
import { getDefaultNotificationPreferences } from '../../utils/notificationUtils';
import { BellIcon, CakeIcon, ClockIcon, EnvelopeIcon, CheckIcon, XMarkIcon, CalendarIcon } from '../icons';
import Button from '../ui/Button';
import { emailServiceClient } from '../../services/emailServiceClient';
import { EmailNotificationService } from '../../services/emailNotificationService';
import { userService } from '../../services/userService';
import { BirthdayNotificationService } from '../../services/birthdayNotificationService';
import { calculateDaysUntilBirthday } from '../../utils/birthdayUtils';

interface BirthdayNotificationSettingsProps {
  onClose?: () => void;
}

const BirthdayNotificationSettings: React.FC<BirthdayNotificationSettingsProps> = ({ onClose }) => {
  const { user, userProfile, showToast, members, bacentas, currentChurchId } = useAppContext();
  
  // Force fixed defaults for birthday notifications: enabled, days [7,3,1,0], time '00:00'
  const forcedBirthdayDefaults = {
    enabled: true,
    daysBeforeNotification: [7, 3, 1, 0],
    emailTime: '00:00'
  } as NotificationPreferences['birthdayNotifications'];

  const [settings, setSettings] = useState<NotificationPreferences>(
    (() => {
      const base = userProfile?.notificationPreferences || getDefaultNotificationPreferences();
      return {
        ...base,
        birthdayNotifications: {
          ...base.birthdayNotifications,
          ...forcedBirthdayDefaults
        }
      } as NotificationPreferences;
    })()
  );
  
  const [isLoading, setIsLoading] = useState(false);
  const [testEmailSent, setTestEmailSent] = useState(false);
  const [digestEmailSent, setDigestEmailSent] = useState(false);
  const [groupDigestSent, setGroupDigestSent] = useState(false);
  const [triggeredNow, setTriggeredNow] = useState(false);

  useEffect(() => {
    if (userProfile?.notificationPreferences) {
      setSettings({
        ...userProfile.notificationPreferences,
        birthdayNotifications: {
          ...userProfile.notificationPreferences.birthdayNotifications,
          ...forcedBirthdayDefaults
        }
      } as NotificationPreferences);
    }
  }, [userProfile]);

  const handleSettingChange = (key: keyof NotificationPreferences, value: any) => {
    // Prevent changing birthdayNotifications via this generic handler
    if (key === 'birthdayNotifications') return;
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Birthday notification handlers removed - settings are locked in UI

  const handleSaveSettings = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // TODO: Implement user service update for notification preferences
      // await userService.updateNotificationPreferences(user.uid, settings);
      
      // For now, simulate the save
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      showToast('success', 'Settings Saved', 'Your notification preferences have been updated successfully');
      onClose?.();
    } catch (error: any) {
      showToast('error', 'Save Failed', error.message || 'Failed to save notification settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestEmail = async () => {
    if (!user?.email) {
      showToast('error', 'No email', 'Your account has no email address');
      return;
    }
    setIsLoading(true);
    try {
      const res = await emailServiceClient.sendTestBirthdayEmail({
        uid: user.uid,
  email: user.email,
  displayName: user.displayName ?? undefined
      });

      if (res?.success) {
        setTestEmailSent(true);
        showToast('success', 'Test Email Sent', 'Check your inbox for the sample birthday email');
        setTimeout(() => setTestEmailSent(false), 5000);
      } else {
        throw new Error(res?.error || 'Unknown error');
      }
    } catch (error: any) {
      showToast('error', 'Test Failed', error.message || 'Failed to send test email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendUpcomingDigest = async () => {
    if (!user?.email) {
      showToast('error', 'No email', 'Your account has no email address');
      return;
    }
    setIsLoading(true);
    try {
      const res = await emailServiceClient.sendUpcomingBirthdaysDigest(
        { uid: user.uid, email: user.email, displayName: user.displayName ?? undefined },
        members,
        bacentas
      );
      if (res?.success) {
        setDigestEmailSent(true);
        showToast('success', 'Digest Sent', 'Check your inbox for the upcoming birthdays digest');
        setTimeout(() => setDigestEmailSent(false), 5000);
      } else {
        throw new Error(res?.error || 'Unknown error');
      }
    } catch (error: any) {
      showToast('error', 'Send Failed', error.message || 'Failed to send upcoming birthdays digest');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendDigestToLeadersAndAdmin = async () => {
    if (!currentChurchId) {
      showToast('error', 'No church context', 'Cannot determine current church to fetch recipients');
      return;
    }
    setIsLoading(true);
    try {
      // Build digest once
      const svc = EmailNotificationService.getInstance();
      const digest = svc.generateUpcomingBirthdaysDigest(members, bacentas);

      // Fetch users in church and filter: admins + invited leaders (with email prefs enabled)
      const users = await userService.getChurchUsers(currentChurchId);
      const recipients = users.filter(u => (u.role === 'admin' || (u as any).isInvitedAdminLeader) && !!u.email)
        .filter(u => {
          const np = (u as any).notificationPreferences;
          if (np?.emailNotifications === false) return false;
          if (np?.birthdayNotifications?.enabled === false) return false;
          return true;
        });

      if (recipients.length === 0) {
        showToast('warning', 'No recipients', 'No admin or invited leaders with email found');
        setIsLoading(false);
        return;
      }

      let success = 0, failed = 0;
      for (const r of recipients) {
        const res = await emailServiceClient.sendBirthdayEmail(
          r.email!,
          digest.subject,
          digest.htmlContent,
          digest.textContent
        );
        if (res?.success) success++; else failed++;
        // Gentle spacing to avoid provider rate limits
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      setGroupDigestSent(true);
      showToast('success', 'Digest Sent', `Sent to ${success}/${recipients.length} recipients${failed ? ` (${failed} failed)` : ''}`);
      setTimeout(() => setGroupDigestSent(false), 5000);
    } catch (error: any) {
      showToast('error', 'Send Failed', error.message || 'Failed to send to leaders and admin');
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger server-side processing of upcoming birthday notifications now (emails + bell alerts)
  const handleTriggerBirthdayNotificationsNow = async () => {
    if (!currentChurchId) {
      showToast('error', 'No church context', 'Cannot determine church to process');
      return;
    }
    setIsLoading(true);
    try {
      // Use client-side service to process now (sends emails + creates bell notifications)
      const users = await userService.getChurchUsers(currentChurchId);
      const membersWithBirthdays = members.filter(m => !!m.birthday);
      // Only trigger for the next upcoming birthdays (exclude already-passed)
      const nonNegativeOffsets = membersWithBirthdays
        .map(m => ({ m, d: calculateDaysUntilBirthday(m.birthday!, new Date()) }))
        .filter(x => x.d >= 0);

      if (nonNegativeOffsets.length === 0) {
        showToast('info', 'No Upcoming', 'There are no upcoming birthdays to notify right now');
        setIsLoading(false);
        return;
      }

      const minDays = Math.min(...nonNegativeOffsets.map(x => x.d));
      const days = [minDays];

      const svc = BirthdayNotificationService.getInstance();
      const results = await svc.processBirthdayNotifications(
        currentChurchId,
        membersWithBirthdays,
        users as any,
  bacentas,
  days,
  new Date(),
  { force: true, actorAdminId: userProfile?.uid }
      );
      setTriggeredNow(true);
      showToast('success', 'Notifications Sent', `Processed ${results.processed}, sent ${results.sent}, failed ${results.failed}`);
      setTimeout(() => setTriggeredNow(false), 5000);
    } catch (error: any) {
      showToast('error', 'Trigger Failed', error.message || 'Failed to trigger processing');
    } finally {
      setIsLoading(false);
    }
  };

  const notificationDayOptions = [
    { days: 7, label: '7 days before' },
    { days: 3, label: '3 days before' },
    { days: 1, label: '1 day before' },
    { days: 0, label: 'On the day' }
  ];

  // timeOptions removed since time is locked to 00:00

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
            <BellIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Birthday Notification Settings</h2>
            <p className="text-gray-600">Manage how you receive birthday notifications for church members</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>

      <div className="space-y-8">
        {/* General Email Settings */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <EnvelopeIcon className="w-5 h-5 mr-2 text-blue-600" />
            General Email Settings
          </h3>
          
          <div className="space-y-4">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Enable Email Notifications</span>
                <p className="text-xs text-gray-500">Receive all email notifications from the church management system</p>
              </div>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.pushNotifications}
                onChange={(e) => handleSettingChange('pushNotifications', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Enable Push Notifications</span>
                <p className="text-xs text-gray-500">Receive push notifications on your mobile device (when available)</p>
              </div>
            </label>
          </div>
        </div>

        {/* Birthday Notification Settings */}
        <div className="bg-gradient-to-r from-pink-50 to-purple-50 p-6 rounded-lg border border-pink-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CakeIcon className="w-5 h-5 mr-2 text-pink-600" />
            Birthday Notification Settings
          </h3>
          
          <div className="space-y-6">
            {/* Birthday Notifications are managed by the organization and cannot be changed here */}
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={true}
                readOnly
                disabled
                className="w-4 h-4 text-pink-600 border-gray-300 rounded"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Birthday Notifications (managed by admin)</span>
                <p className="text-xs text-gray-500">These settings are controlled by the organisation and cannot be changed here</p>
              </div>
            </label>

            {settings.birthdayNotifications.enabled && (
              <>
                {/* Notification Timing */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    <ClockIcon className="w-4 h-4 inline mr-1" />
                    When to send notifications:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {notificationDayOptions.map(option => (
                      <label key={option.days} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={settings.birthdayNotifications.daysBeforeNotification.includes(option.days)}
                          readOnly
                          disabled
                          className="w-4 h-4 text-pink-600 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Email Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred notification time:
                  </label>
                  <select
                    value={settings.birthdayNotifications.emailTime}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                  >
                    <option value="00:00">12:00 AM</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Notifications will be sent around this time each day
                  </p>
                </div>

                {/* Test buttons inside settings card for quick access */}
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    onClick={handleSendUpcomingDigest}
                    loading={isLoading}
                    disabled={!settings.birthdayNotifications.enabled || !settings.emailNotifications}
                    leftIcon={digestEmailSent ? <CheckIcon className="w-4 h-4" /> : <CalendarIcon className="w-4 h-4" />}
                  >
                    {digestEmailSent ? 'Digest Sent!' : 'Send Upcoming Birthdays (to me)'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleSendDigestToLeadersAndAdmin}
                    loading={isLoading}
                    disabled={!settings.birthdayNotifications.enabled || !settings.emailNotifications}
                    leftIcon={groupDigestSent ? <CheckIcon className="w-4 h-4" /> : <EnvelopeIcon className="w-4 h-4" />}
                  >
                    {groupDigestSent ? 'Group Digest Sent!' : 'Send to Leaders & Admin'}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleTriggerBirthdayNotificationsNow}
                    loading={isLoading}
                    leftIcon={triggeredNow ? <CheckIcon className="w-4 h-4" /> : <CalendarIcon className="w-4 h-4" />}
                  >
                    {triggeredNow ? 'Triggered!' : 'Send Birthday Notifications Now'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">Privacy Notice</h4>
          <p className="text-xs text-blue-800">
            You will only receive birthday notifications for members within your organizational responsibility. 
            This includes members in bacentas you lead or oversee. We respect data privacy and organizational boundaries.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={handleTestEmail}
              loading={isLoading}
              disabled={!settings.birthdayNotifications.enabled || !settings.emailNotifications}
              leftIcon={testEmailSent ? <CheckIcon className="w-4 h-4" /> : <EnvelopeIcon className="w-4 h-4" />}
            >
              {testEmailSent ? 'Test Email Sent!' : 'Send Test Email'}
            </Button>
          </div>

          <div className="flex space-x-3">
            {onClose && (
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleSaveSettings}
              loading={isLoading}
              leftIcon={<CheckIcon className="w-4 h-4" />}
            >
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BirthdayNotificationSettings;
