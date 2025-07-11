import React, { useState, useRef } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { userService } from '../services/userService';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input from './ui/Input';
import DataManagement from './DataManagement';
import {
  BellIcon,
  MoonIcon,
  SunIcon,
  InformationCircleIcon,
  CogIcon,
  UserIcon,
  CameraIcon
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
  allowEditPreviousSundays: boolean;
}

interface ProfileFormData {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  profilePicture: string;
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
    weeklyReports: currentUser?.preferences?.weeklyReports ?? false,
    allowEditPreviousSundays: currentUser?.preferences?.allowEditPreviousSundays ?? true
  });

  const [profileData, setProfileData] = useState<ProfileFormData>({
    firstName: currentUser?.firstName || '',
    lastName: currentUser?.lastName || '',
    phoneNumber: currentUser?.phoneNumber || '',
    profilePicture: currentUser?.profilePicture || ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showDataManagement, setShowDataManagement] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>(currentUser?.profilePicture || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useAppContext();

  const handlePreferenceChange = (key: keyof UserPreferences, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImagePreview(result);
        setProfileData(prev => ({ ...prev, profilePicture: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validateProfile = (): boolean => {
    if (!profileData.firstName.trim()) {
      showToast('error', 'Validation Error', 'First name is required');
      return false;
    }
    if (!profileData.lastName.trim()) {
      showToast('error', 'Validation Error', 'Last name is required');
      return false;
    }
    if (profileData.phoneNumber && !/^[0-9+\-\s()]+$/.test(profileData.phoneNumber)) {
      showToast('error', 'Validation Error', 'Please enter a valid phone number');
      return false;
    }
    return true;
  };

  const handleSaveSettings = async () => {
    if (!validateProfile()) {
      return;
    }

    setIsLoading(true);
    try {
      const updates = {
        firstName: profileData.firstName.trim(),
        lastName: profileData.lastName.trim(),
        displayName: `${profileData.firstName.trim()} ${profileData.lastName.trim()}`,
        phoneNumber: profileData.phoneNumber.trim(),
        profilePicture: profileData.profilePicture,
        preferences: preferences
      };

      await userService.updateUserProfile(currentUser.uid, updates);

      showToast('success', 'Settings Saved!', 'Your profile and preferences have been updated successfully');
      onUpdate?.();
      onClose();
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
        {/* Profile Settings */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <UserIcon className="w-5 h-5 text-blue-600" />
            <span>Profile Information</span>
          </h3>

          <div className="space-y-4">
            {/* Profile Picture */}
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white hover:bg-blue-600 transition-colors"
                >
                  <CameraIcon className="w-3 h-3" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
              <div>
                <p className="font-medium text-gray-700">Profile Picture</p>
                <p className="text-sm text-gray-500">Click the camera icon to upload a new photo</p>
              </div>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <Input
                  type="text"
                  name="firstName"
                  value={profileData.firstName}
                  onChange={handleProfileChange}
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <Input
                  type="text"
                  name="lastName"
                  value={profileData.lastName}
                  onChange={handleProfileChange}
                  placeholder="Enter last name"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <Input
                type="tel"
                name="phoneNumber"
                value={profileData.phoneNumber}
                onChange={handleProfileChange}
                placeholder="Enter phone number"
              />
            </div>
          </div>
        </div>

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
            <UserIcon className="w-5 h-5 text-blue-600" />
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
