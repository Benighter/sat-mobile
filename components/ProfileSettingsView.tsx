import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { userService } from '../services/userService';
import Button from './ui/Button';
import Input from './ui/Input';
import ChangePasswordModal from './ChangePasswordModal';
import {
  MoonIcon,
  SunIcon,
  UserIcon,
  CameraIcon,
  CheckIcon,
  XMarkIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  ShieldCheckIcon,
  KeyIcon
} from './icons';

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  allowEditPreviousSundays: boolean;
}

interface ProfileFormData {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  profilePicture: string;
}

const ProfileSettingsView: React.FC = () => {
  const { userProfile, user, showToast, refreshUserProfile } = useAppContext();
  
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: userProfile?.preferences?.theme ?? 'light',
    allowEditPreviousSundays: userProfile?.preferences?.allowEditPreviousSundays ?? true
  });

  const [profileData, setProfileData] = useState<ProfileFormData>({
    firstName: userProfile?.firstName || '',
    lastName: userProfile?.lastName || '',
    phoneNumber: userProfile?.phoneNumber || '',
    profilePicture: userProfile?.profilePicture || ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>(userProfile?.profilePicture || '');
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update state when userProfile changes
  useEffect(() => {
    if (userProfile) {
      setPreferences({
        theme: userProfile.preferences?.theme ?? 'light',
        allowEditPreviousSundays: userProfile.preferences?.allowEditPreviousSundays ?? true
      });

      setProfileData({
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        phoneNumber: userProfile.phoneNumber || '',
        profilePicture: userProfile.profilePicture || ''
      });

      setImagePreview(userProfile.profilePicture || '');
    }
  }, [userProfile]);

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
      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showToast('error', 'File Too Large', 'Please select an image smaller than 5MB');
        return;
      }

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
    return true;
  };

  const handleSaveSettings = async () => {
    if (!validateProfile() || !user) {
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

      await userService.updateUserProfile(user.uid, updates);
      await refreshUserProfile();

      showToast('success', 'Profile Updated!', 'Your profile and preferences have been saved successfully');
    } catch (error: any) {
      showToast('error', 'Save Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (user: any) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.displayName) {
      const names = user.displayName.split(' ');
      return names.length > 1 
        ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
        : names[0][0].toUpperCase();
    }
    return 'U';
  };

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header Section */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center space-x-6">
          {/* Profile Picture */}
          <div className="relative">
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
              {imagePreview ? (
                <img src={imagePreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-2xl">
                  {getInitials(userProfile)}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white hover:bg-blue-600 transition-colors shadow-lg"
            >
              <CameraIcon className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* User Info */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {userProfile.displayName || `${userProfile.firstName} ${userProfile.lastName}` || 'User Profile'}
            </h1>
            <div className="space-y-1 mt-2">
              <div className="flex items-center text-gray-600">
                <EnvelopeIcon className="w-4 h-4 mr-2" />
                <span className="text-sm">{userProfile.email}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <BuildingOfficeIcon className="w-4 h-4 mr-2" />
                <span className="text-sm">{userProfile.churchName || 'Church Member'}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <ShieldCheckIcon className="w-4 h-4 mr-2" />
                <span className="text-sm capitalize">{userProfile.role || 'Member'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="glass-card p-6 rounded-2xl">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <UserIcon className="w-5 h-5 mr-2 text-blue-600" />
          Personal Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name *
            </label>
            <Input
              type="text"
              name="firstName"
              value={profileData.firstName}
              onChange={handleProfileChange}
              placeholder="Enter first name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name *
            </label>
            <Input
              type="text"
              name="lastName"
              value={profileData.lastName}
              onChange={handleProfileChange}
              placeholder="Enter last name"
              required
            />
          </div>

          <div className="md:col-span-2">
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


      {/* App Preferences */}
      <div className="glass-card p-6 rounded-2xl">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <SunIcon className="w-5 h-5 mr-2 text-blue-600" />
          App Preferences
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Theme</h3>
              <p className="text-sm text-gray-500">Choose your preferred theme</p>
            </div>
            <select
              value={preferences.theme}
              onChange={(e) => handlePreferenceChange('theme', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Edit Previous Sundays</h3>
              <p className="text-sm text-gray-500">Allow editing attendance for past dates</p>
            </div>
            <button
              type="button"
              onClick={() => handlePreferenceChange('allowEditPreviousSundays', !preferences.allowEditPreviousSundays)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.allowEditPreviousSundays ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.allowEditPreviousSundays ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="glass-card p-6 rounded-2xl">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <ShieldCheckIcon className="w-5 h-5 mr-2 text-blue-600" />
          Security
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Password</h3>
              <p className="text-sm text-gray-500">Change your account password</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsChangePasswordModalOpen(true)}
              className="flex items-center space-x-2"
            >
              <KeyIcon className="w-4 h-4" />
              <span>Change Password</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          onClick={handleSaveSettings}
          disabled={isLoading}
          className="px-8"
        >
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />
    </div>
  );
};

export default ProfileSettingsView;
