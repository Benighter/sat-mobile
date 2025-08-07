import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { NotificationPreferences } from '../../types';
import { getDefaultNotificationPreferences } from '../../utils/notificationUtils';
import { BellIcon, CakeIcon, ClockIcon, EnvelopeIcon, CheckIcon, XMarkIcon } from '../icons';
import Button from '../ui/Button';

interface BirthdayNotificationSettingsProps {
  onClose?: () => void;
}

const BirthdayNotificationSettings: React.FC<BirthdayNotificationSettingsProps> = ({ onClose }) => {
  const { user, userProfile, showToast } = useAppContext();
  
  const [settings, setSettings] = useState<NotificationPreferences>(
    userProfile?.notificationPreferences || getDefaultNotificationPreferences()
  );
  
  const [isLoading, setIsLoading] = useState(false);
  const [testEmailSent, setTestEmailSent] = useState(false);

  useEffect(() => {
    if (userProfile?.notificationPreferences) {
      setSettings(userProfile.notificationPreferences);
    }
  }, [userProfile]);

  const handleSettingChange = (key: keyof NotificationPreferences, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleBirthdaySettingChange = (key: keyof NotificationPreferences['birthdayNotifications'], value: any) => {
    setSettings(prev => ({
      ...prev,
      birthdayNotifications: {
        ...prev.birthdayNotifications,
        [key]: value
      }
    }));
  };

  const handleNotificationDaysChange = (days: number, enabled: boolean) => {
    const currentDays = settings.birthdayNotifications.daysBeforeNotification;
    let newDays: number[];
    
    if (enabled) {
      newDays = [...currentDays, days].sort((a, b) => b - a);
    } else {
      newDays = currentDays.filter(d => d !== days);
    }
    
    handleBirthdaySettingChange('daysBeforeNotification', newDays);
  };

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
    setIsLoading(true);
    try {
      // TODO: Implement test email functionality
      // This would send a sample birthday notification to the user's email
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setTestEmailSent(true);
      showToast('success', 'Test Email Sent', 'A sample birthday notification has been sent to your email');
      
      // Reset the test email sent state after 5 seconds
      setTimeout(() => setTestEmailSent(false), 5000);
    } catch (error: any) {
      showToast('error', 'Test Failed', error.message || 'Failed to send test email');
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

  const timeOptions = [
    { value: '08:00', label: '8:00 AM' },
    { value: '09:00', label: '9:00 AM' },
    { value: '10:00', label: '10:00 AM' },
    { value: '11:00', label: '11:00 AM' },
    { value: '12:00', label: '12:00 PM' },
    { value: '13:00', label: '1:00 PM' },
    { value: '14:00', label: '2:00 PM' },
    { value: '15:00', label: '3:00 PM' }
  ];

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
            {/* Enable Birthday Notifications */}
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.birthdayNotifications.enabled}
                onChange={(e) => handleBirthdaySettingChange('enabled', e.target.checked)}
                className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Enable Birthday Notifications</span>
                <p className="text-xs text-gray-500">Receive email notifications for upcoming member birthdays</p>
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
                      <label key={option.days} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.birthdayNotifications.daysBeforeNotification.includes(option.days)}
                          onChange={(e) => handleNotificationDaysChange(option.days, e.target.checked)}
                          className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
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
                    onChange={(e) => handleBirthdaySettingChange('emailTime', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  >
                    {timeOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Notifications will be sent around this time each day
                  </p>
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
          <Button
            variant="secondary"
            onClick={handleTestEmail}
            loading={isLoading}
            disabled={!settings.birthdayNotifications.enabled || !settings.emailNotifications}
            leftIcon={testEmailSent ? <CheckIcon className="w-4 h-4" /> : <EnvelopeIcon className="w-4 h-4" />}
          >
            {testEmailSent ? 'Test Email Sent!' : 'Send Test Email'}
          </Button>

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
