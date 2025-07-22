import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { userService } from '../services/userService';
import { inviteService } from '../services/inviteService';
import Button from './ui/Button';
import Input from './ui/Input';
import Badge from './ui/Badge';
import ChangePasswordModal from './ChangePasswordModal';
import AdminInviteManager from './AdminInviteManager';
import { hasAdminPrivileges, hasLeaderPrivileges } from '../utils/permissionUtils';
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
  KeyIcon,
  UserGroupIcon,
  RefreshIcon
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
  const [isAdminInviteModalOpen, setIsAdminInviteModalOpen] = useState(false);
  const [isFixingAccess, setIsFixingAccess] = useState(false);
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
    // Last name is now optional - removed validation
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

  const handleFixAccess = async () => {
    if (!user) return;

    setIsFixingAccess(true);
    try {
      const result = await inviteService.fixLeaderAccess(user.uid);
      if (result.success) {
        showToast('success', 'Access Fixed', result.message);
        // Refresh user profile to get updated church data
        await refreshUserProfile();
        // Reload the page to refresh all data with new church context
        window.location.reload();
      } else {
        showToast('error', 'Fix Failed', result.message);
      }
    } catch (error: any) {
      showToast('error', 'Fix Failed', error.message);
    } finally {
      setIsFixingAccess(false);
    }
  };

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header Section */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            {/* Profile Picture */}
            <div className="relative flex-shrink-0 mx-auto lg:mx-0">
              <div className="w-32 h-32 bg-gray-200 rounded-3xl flex items-center justify-center overflow-hidden shadow-lg">
                {imagePreview ? (
                  <img src={imagePreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-3xl">
                    {getInitials(userProfile)}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-3 -right-3 w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center text-white hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <CameraIcon className="w-5 h-5" />
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
            <div className="flex-1 text-center lg:text-left">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                {userProfile.displayName || `${userProfile.firstName} ${userProfile.lastName}` || 'User Profile'}
              </h1>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center justify-center lg:justify-start text-gray-600 bg-gray-50 rounded-2xl p-3">
                  <EnvelopeIcon className="w-5 h-5 mr-3 text-blue-500" />
                  <span className="text-sm font-medium truncate">{userProfile.email}</span>
                </div>
                <div className="flex items-center justify-center lg:justify-start text-gray-600 bg-gray-50 rounded-2xl p-3">
                  <BuildingOfficeIcon className="w-5 h-5 mr-3 text-green-500" />
                  <span className="text-sm font-medium truncate">{userProfile.churchName || 'Church Member'}</span>
                </div>
                <div className="flex items-center justify-center lg:justify-start text-gray-600 bg-gray-50 rounded-2xl p-3">
                  <ShieldCheckIcon className="w-5 h-5 mr-3 text-purple-500" />
                  <span className="text-sm font-medium capitalize">{userProfile.role || 'Member'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8 mb-8">
          <div className="flex items-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mr-4">
              <UserIcon className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Personal Information</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                First Name *
              </label>
              <Input
                type="text"
                name="firstName"
                value={profileData.firstName}
                onChange={handleProfileChange}
                placeholder="Enter first name"
                required
                className="h-14 text-base border-2 border-gray-200 focus:border-blue-500 rounded-2xl px-4 transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Last Name
              </label>
              <Input
                type="text"
                name="lastName"
                value={profileData.lastName}
                onChange={handleProfileChange}
                placeholder="Enter last name"
                className="h-14 text-base border-2 border-gray-200 focus:border-blue-500 rounded-2xl px-4 transition-all duration-200"
              />
            </div>

            <div className="lg:col-span-2 space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Phone Number
              </label>
              <Input
                type="tel"
                name="phoneNumber"
                value={profileData.phoneNumber}
                onChange={handleProfileChange}
                placeholder="Enter phone number"
                className="h-14 text-base border-2 border-gray-200 focus:border-blue-500 rounded-2xl px-4 transition-all duration-200"
              />
            </div>
          </div>
        </div>


        {/* App Preferences */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8 mb-8">
          <div className="flex items-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-pink-600 rounded-2xl flex items-center justify-center mr-4">
              <SunIcon className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">App Preferences</h2>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-r from-orange-50 to-pink-50 rounded-2xl p-6 border border-orange-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Theme</h3>
                  <p className="text-gray-600">Choose your preferred theme appearance</p>
                </div>
                <select
                  value={preferences.theme}
                  onChange={(e) => handlePreferenceChange('theme', e.target.value)}
                  className="h-12 px-4 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white text-base font-medium min-w-[140px]"
                >
                  <option value="light">☀️ Light</option>
                  <option value="dark">🌙 Dark</option>
                  <option value="system">⚙️ System</option>
                </select>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Edit Previous Sundays</h3>
                  <p className="text-gray-600">Allow editing attendance for past dates</p>
                </div>
                <button
                  type="button"
                  onClick={() => handlePreferenceChange('allowEditPreviousSundays', !preferences.allowEditPreviousSundays)}
                  className={`relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-300 ${
                    preferences.allowEditPreviousSundays
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg'
                      : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-300 shadow-md ${
                      preferences.allowEditPreviousSundays ? 'translate-x-9' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Features */}
        {hasAdminPrivileges(userProfile) && (
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8 mb-8">
            <div className="flex items-center mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl flex items-center justify-center mr-4">
                <UserGroupIcon className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Admin Features</h2>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-2xl p-6 border border-green-100">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Admin Invite Management</h3>
                  <p className="text-gray-600">Generate invites to promote other admins to leaders under your authority</p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setIsAdminInviteModalOpen(true)}
                  className="h-12 px-6 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 rounded-2xl font-medium transition-all duration-200 flex items-center justify-center space-x-2 min-w-[160px]"
                >
                  <UserGroupIcon className="w-5 h-5" />
                  <span>Manage Invites</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Leader Features - Show for both admin and leader roles */}
        {hasLeaderPrivileges(userProfile) && (
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8 mb-8">
            <div className="flex items-center mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mr-4">
                <UserIcon className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                {userProfile?.role === 'leader' ? 'Leader Features' : 'Leader Management'}
              </h2>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-6 border border-purple-100">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Role Information</h3>
                    <p className="text-gray-600">
                      {userProfile?.role === 'leader'
                        ? 'You have leader privileges to manage all church data and attendance records'
                        : 'You have full admin privileges including role management and system administration'}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <Badge color={userProfile?.role === 'admin' ? 'blue' : 'purple'} size="md">
                      {userProfile?.role === 'admin' ? 'Administrator' : 'Leader'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Fix Access Button for Leaders */}
              {userProfile?.role === 'leader' && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-6 border border-yellow-100">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Access</h3>
                      <p className="text-gray-600">
                        If you can't see church data or attendance records, click here to fix your access permissions
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleFixAccess}
                      disabled={isFixingAccess}
                      className="h-12 px-6 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white rounded-2xl font-medium transition-all duration-200 flex items-center justify-center space-x-2 min-w-[140px]"
                    >
                      {isFixingAccess ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Fixing...</span>
                        </>
                      ) : (
                        <>
                          <RefreshIcon className="w-5 h-5" />
                          <span>Fix Access</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Security Settings */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8 mb-8">
          <div className="flex items-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl flex items-center justify-center mr-4">
              <ShieldCheckIcon className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Security Settings</h2>
          </div>

          <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl p-6 border border-red-100">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Password Management</h3>
                <p className="text-gray-600">Update your account password to keep your account secure</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsChangePasswordModalOpen(true)}
                className="h-12 px-6 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white rounded-2xl font-medium transition-all duration-200 flex items-center justify-center space-x-2 min-w-[180px]"
              >
                <KeyIcon className="w-5 h-5" />
                <span>Change Password</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-center pb-8">
          <Button
            type="button"
            variant="primary"
            onClick={handleSaveSettings}
            disabled={isLoading}
            className="h-14 px-12 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 text-white rounded-2xl font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 min-w-[200px]"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />

      {/* Admin Invite Manager Modal */}
      <AdminInviteManager
        isOpen={isAdminInviteModalOpen}
        onClose={() => setIsAdminInviteModalOpen(false)}
      />
    </div>
  );
};

export default ProfileSettingsView;
