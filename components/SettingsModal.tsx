import React, { useState } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { userService } from '../services/userService';
import Modal from './ui/Modal';
import Button from './ui/Button';
import DataManagement from './DataManagement';
import {
  BellIcon,
  MoonIcon,
  SunIcon,
  ShieldCheckIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  CogIcon
} from './icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onUpdate?: () => void;
}

interface UserPreferences {
  notifications: boolean;
  theme: 'light' | 'dark' | 'system';
  emailNotifications: boolean;
  attendanceReminders: boolean;
  weeklyReports: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  currentUser, 
  onUpdate 
}) => {
  const [preferences, setPreferences] = useState<UserPreferences>({
    notifications: currentUser?.preferences?.notifications ?? true,
    theme: currentUser?.preferences?.theme ?? 'light',
    emailNotifications: currentUser?.preferences?.emailNotifications ?? true,
    attendanceReminders: currentUser?.preferences?.attendanceReminders ?? true,
    weeklyReports: currentUser?.preferences?.weeklyReports ?? false
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [showDataClearConfirm, setShowDataClearConfirm] = useState(false);
  const [showDataManagement, setShowDataManagement] = useState(false);
  const { showToast } = useAppContext();

  const handlePreferenceChange = (key: keyof UserPreferences, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
      await userService.updateUserProfile(currentUser.uid, {
        preferences: preferences
      });
      
      showToast('success', 'Settings Saved!', 'Your preferences have been updated successfully');
      onUpdate?.();
    } catch (error: any) {
      showToast('error', 'Save Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const ToggleSwitch: React.FC<{
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    disabled?: boolean;
  }> = ({ enabled, onChange, disabled = false }) => (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        enabled ? 'bg-blue-600' : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      disabled={disabled}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      size="lg"
    >
      <div className="space-y-6">
        {/* Notification Settings */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <BellIcon className="w-5 h-5 text-blue-600" />
            <span>Notifications</span>
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-700">Push Notifications</p>
                <p className="text-sm text-gray-500">Receive notifications in the app</p>
              </div>
              <ToggleSwitch
                enabled={preferences.notifications}
                onChange={(value) => handlePreferenceChange('notifications', value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-700">Email Notifications</p>
                <p className="text-sm text-gray-500">Receive important updates via email</p>
              </div>
              <ToggleSwitch
                enabled={preferences.emailNotifications}
                onChange={(value) => handlePreferenceChange('emailNotifications', value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-700">Attendance Reminders</p>
                <p className="text-sm text-gray-500">Get reminded about upcoming services</p>
              </div>
              <ToggleSwitch
                enabled={preferences.attendanceReminders}
                onChange={(value) => handlePreferenceChange('attendanceReminders', value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-700">Weekly Reports</p>
                <p className="text-sm text-gray-500">Receive weekly attendance summaries</p>
              </div>
              <ToggleSwitch
                enabled={preferences.weeklyReports}
                onChange={(value) => handlePreferenceChange('weeklyReports', value)}
              />
            </div>
          </div>
        </div>

        {/* Theme Settings */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <SunIcon className="w-5 h-5 text-yellow-600" />
            <span>Appearance</span>
          </h3>
          
          <div>
            <p className="font-medium text-gray-700 mb-3">Theme</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'light', label: 'Light', icon: SunIcon },
                { value: 'dark', label: 'Dark', icon: MoonIcon },
                { value: 'system', label: 'System', icon: InformationCircleIcon }
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handlePreferenceChange('theme', value)}
                  className={`p-3 rounded-lg border-2 transition-all duration-200 flex flex-col items-center space-y-2 ${
                    preferences.theme === value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Theme changes will take effect after refreshing the page
            </p>
          </div>
        </div>

        {/* Account Information */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <ShieldCheckIcon className="w-5 h-5 text-blue-600" />
            <span>Account Information</span>
          </h3>
          
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Account Created:</span>
              <span className="font-medium">
                {currentUser?.createdDate ? new Date(currentUser.createdDate).toLocaleDateString() : 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Login:</span>
              <span className="font-medium">
                {currentUser?.lastLoginDate ? new Date(currentUser.lastLoginDate).toLocaleDateString() : 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Account Status:</span>
              <span className={`font-medium ${currentUser?.isActive ? 'text-green-600' : 'text-red-600'}`}>
                {currentUser?.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center space-x-2">
            <CogIcon className="w-5 h-5 text-blue-600" />
            <span>Data Management</span>
          </h3>

          <div className="space-y-3">
            <p className="text-sm text-blue-700">
              Backup, restore, and manage your church data.
            </p>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setShowDataManagement(true)}
              className="flex items-center space-x-2"
            >
              <CogIcon className="w-4 h-4" />
              <span>Open Data Management</span>
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSaveSettings}
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      {/* Data Management Modal */}
      {showDataManagement && (
        <DataManagement
          isOpen={showDataManagement}
          onClose={() => setShowDataManagement(false)}
        />
      )}
    </Modal>
  );
};

export default SettingsModal;
