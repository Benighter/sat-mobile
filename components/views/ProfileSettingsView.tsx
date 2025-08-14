import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { useTheme } from '../../contexts/ThemeContext';
import { userService } from '../../services/userService';
import { inviteService } from '../../services/inviteService';
import { getDefaultNotificationPreferences } from '../../utils/notificationUtils';
// Ministry feature removed – no MINISTRY_OPTIONS import
import { NotificationPreferences } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';
import ImageUpload from '../ui/ImageUpload';
import ChangePasswordModal from '../auth/ChangePasswordModal';
import AdminInviteManager from '../admin/AdminInviteManager';
// import PushNotificationSettings from '../notifications/PushNotificationSettings';
import { hasAdminPrivileges, hasLeaderPrivileges } from '../../utils/permissionUtils';
import {
  SunIcon,
  UserIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  ShieldCheckIcon,
  KeyIcon,
  UserGroupIcon,
  RefreshIcon,
  BellIcon,
  CakeIcon
} from '../icons';
import { collection, doc, getDocs, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../../firebase.config';

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
  const { theme, setTheme } = useTheme();

  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: theme,
    allowEditPreviousSundays: userProfile?.preferences?.allowEditPreviousSundays ?? true
  });

  // Constituency (church) name editor – linked to Super Admin feature
  const [constituencyName, setConstituencyName] = useState<string>(userProfile?.churchName || '');

  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(
    userProfile?.notificationPreferences || getDefaultNotificationPreferences()
  );

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

  // Update state when userProfile changes
  useEffect(() => {
    if (userProfile) {
      setPreferences({
        theme: theme,
        allowEditPreviousSundays: userProfile.preferences?.allowEditPreviousSundays ?? true
      });

      setConstituencyName(userProfile.churchName || '');

      setNotificationPreferences(
        userProfile.notificationPreferences || getDefaultNotificationPreferences()
      );

      setProfileData({
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        phoneNumber: userProfile.phoneNumber || '',
        profilePicture: userProfile.profilePicture || ''
      });

      setImagePreview(userProfile.profilePicture || '');
    }
  }, [userProfile, theme]);

  const handlePreferenceChange = (key: keyof UserPreferences, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));

    // If theme is being changed, update the theme context immediately
    if (key === 'theme') {
      setTheme(value);
    }
  };

  const handleNotificationPreferenceChange = (key: keyof NotificationPreferences, value: any) => {
    setNotificationPreferences(prev => ({ ...prev, [key]: value }));
  };

  // Removed legacy app/ministry display name sync – header uses churchName now

  const handleBirthdayNotificationChange = (key: keyof NotificationPreferences['birthdayNotifications'], value: any) => {
    setNotificationPreferences(prev => ({
      ...prev,
      birthdayNotifications: {
        ...prev.birthdayNotifications,
        [key]: value
      }
    }));
  };

  const handleNotificationDaysChange = (days: number, enabled: boolean) => {
    const currentDays = notificationPreferences.birthdayNotifications.daysBeforeNotification;
    let newDays: number[];

    if (enabled) {
      newDays = [...currentDays, days].sort((a, b) => b - a);
    } else {
      newDays = currentDays.filter(d => d !== days);
    }

    handleBirthdayNotificationChange('daysBeforeNotification', newDays);
  };

  // Removed old handleProfileChange (inputs now use inline setters)

  const handleImageChange = (base64: string | null) => {
    const imageData = base64 || '';
    setImagePreview(imageData);
    setProfileData(prev => ({ ...prev, profilePicture: imageData }));
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
    // Safety: ensure we never get stuck in loading state
    const clearLoadingSafely = () => setIsLoading(false);
    const safetyTimer = setTimeout(clearLoadingSafely, 15000);
    try {
      const updates = {
        firstName: profileData.firstName.trim(),
        lastName: profileData.lastName.trim(),
        displayName: `${profileData.firstName.trim()} ${profileData.lastName.trim()}`,
        phoneNumber: profileData.phoneNumber.trim(),
        profilePicture: profileData.profilePicture,
        preferences: preferences,
        notificationPreferences: notificationPreferences
      };

      await userService.updateUserProfile(user.uid, updates);

      // If constituency name changed and user is an admin, update own doc immediately
      // and propagate to others in the background so Save UI isn't blocked.
      const newName = (constituencyName || '').trim();
      const currentName = userProfile?.churchName || '';
      const isAdmin = hasAdminPrivileges(userProfile);
      if (isAdmin && newName && newName !== currentName) {
        try {
          // Immediate update to current admin's doc
          await updateDoc(doc(db, 'users', user.uid), { churchName: newName, lastUpdated: Timestamp.now() });

          // Fire-and-forget background propagation to reduce UI wait time
          (async () => {
            try {
              // Update church doc if present
              if (userProfile?.churchId) {
                try {
                  await updateDoc(doc(db, 'churches', userProfile.churchId), { name: newName, lastUpdated: Timestamp.now() });
                } catch (e) { console.warn('Failed updating church doc', e); }
              }

              // Cascade to leaders and all users of same church
              const updatedLeaderIds = new Set<string>();
              const adminUid = user.uid;
              const leadersByInvite = query(collection(db, 'users'), where('invitedByAdminId', '==', adminUid), where('role', '==', 'leader'));
              const leadersByInviteSnap = await getDocs(leadersByInvite);
              const writes: Promise<any>[] = [];
              leadersByInviteSnap.forEach(l => {
                updatedLeaderIds.add(l.id);
                writes.push(updateDoc(doc(db, 'users', l.id), { churchName: newName, lastUpdated: Timestamp.now() }));
              });
              if (userProfile?.churchId) {
                const leadersByChurch = query(collection(db, 'users'), where('churchId', '==', userProfile.churchId), where('role', '==', 'leader'));
                const leadersByChurchSnap = await getDocs(leadersByChurch);
                leadersByChurchSnap.forEach(l => {
                  if (!updatedLeaderIds.has(l.id)) {
                    updatedLeaderIds.add(l.id);
                    writes.push(updateDoc(doc(db, 'users', l.id), { churchName: newName, lastUpdated: Timestamp.now() }));
                  }
                });
                const allUsersSameChurch = query(collection(db, 'users'), where('churchId', '==', userProfile.churchId));
                const allSnap = await getDocs(allUsersSameChurch);
                allSnap.forEach(u => {
                  if (u.id !== user.uid && !updatedLeaderIds.has(u.id)) {
                    writes.push(updateDoc(doc(db, 'users', u.id), { churchName: newName, lastUpdated: Timestamp.now() }));
                  }
                });
              }
              if (writes.length) await Promise.allSettled(writes);
              try { window.dispatchEvent(new CustomEvent('constituencyUpdated', { detail: { adminId: user.uid, newName } })); } catch {}
            } catch (e) {
              console.warn('Background propagation of constituency rename failed', e);
            }
          })();
        } catch (e) {
          console.warn('Failed to update constituency on current admin profile', e);
        }
      }
      await refreshUserProfile();

  showToast('success', 'Profile Updated!', 'Your profile and preferences have been saved successfully');
    } catch (error: any) {
      showToast('error', 'Save Failed', error.message);
    } finally {
      clearTimeout(safetyTimer);
      setIsLoading(false);
    }
  };

  // getInitials helper removed (unused after UI adjustments)

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-dark-900 dark:via-dark-800 dark:to-dark-900">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header Section */}
        <div className="bg-white dark:bg-dark-800 rounded-3xl shadow-xl border border-gray-100 dark:border-dark-600 p-6 sm:p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            {/* Profile Picture */}
            <div className="flex-shrink-0 mx-auto lg:mx-0">
              <div className="text-center lg:text-left mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Profile Picture</h3>
                <p className="text-sm text-gray-500">Upload and crop your profile picture</p>
              </div>
              <div className="flex justify-center lg:justify-start">
                <ImageUpload
                  value={imagePreview || profileData.profilePicture}
                  onChange={handleImageChange}
                  size="lg"
                  enableCropping={true}
                  cropPresets={true}
                />
              </div>
            </div>

            {/* User Info */}
            <div className="flex-1 text-center lg:text-left">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-dark-100 mb-4">
                {userProfile.displayName || `${userProfile.firstName} ${userProfile.lastName}` || 'User Profile'}
              </h1>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center justify-center lg:justify-start text-gray-600 dark:text-dark-300 bg-gray-50 dark:bg-dark-700 rounded-2xl p-3">
                  <EnvelopeIcon className="w-5 h-5 mr-3 text-blue-500" />
                  <span className="text-sm font-medium truncate">{userProfile.email}</span>
                </div>
                <div className="flex items-center justify-center lg:justify-start text-gray-600 dark:text-dark-300 bg-gray-50 dark:bg-dark-700 rounded-2xl p-3" title={userProfile.churchName ? `Constituency: ${userProfile.churchName}` : 'No constituency set'}>
                  <BuildingOfficeIcon className="w-5 h-5 mr-3 text-green-500" />
                  <span className="text-sm font-medium truncate">{userProfile.churchName || 'No Constituency'}</span>
                </div>
                <div className="flex items-center justify-center lg:justify-start text-gray-600 dark:text-dark-300 bg-gray-50 dark:bg-dark-700 rounded-2xl p-3">
                  <ShieldCheckIcon className="w-5 h-5 mr-3 text-purple-500" />
                  <span className="text-sm font-medium capitalize">{userProfile.role || 'Member'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="bg-white dark:bg-dark-800 rounded-3xl shadow-xl border border-gray-100 dark:border-dark-600 p-6 sm:p-8 mb-8">
          <div className="flex items-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mr-4">
              <UserIcon className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Personal Information</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-dark-200">
                First Name *
              </label>
              <Input
                type="text"
                name="firstName"
                value={profileData.firstName}
                onChange={(val) => setProfileData(p => ({ ...p, firstName: val }))}
                placeholder="Enter first name"
                required
                className="h-14 text-base border-2 border-gray-200 dark:border-dark-600 focus:border-blue-500 dark:focus:border-blue-400 rounded-2xl px-4 transition-all duration-200 bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-dark-200">
                Last Name
              </label>
              <Input
                type="text"
                name="lastName"
                value={profileData.lastName}
                onChange={(val) => setProfileData(p => ({ ...p, lastName: val }))}
                placeholder="Enter last name"
                className="h-14 text-base border-2 border-gray-200 dark:border-dark-600 focus:border-blue-500 dark:focus:border-blue-400 rounded-2xl px-4 transition-all duration-200 bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100"
              />
            </div>

            <div className="lg:col-span-2 space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-dark-200">
                Phone Number
              </label>
              <Input
                type="tel"
                name="phoneNumber"
                value={profileData.phoneNumber}
                onChange={(val) => setProfileData(p => ({ ...p, phoneNumber: val }))}
                placeholder="Enter phone number"
                className="h-14 text-base border-2 border-gray-200 dark:border-dark-600 focus:border-blue-500 dark:focus:border-blue-400 rounded-2xl px-4 transition-all duration-200 bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100"
              />
            </div>
          </div>
        </div>


        {/* App Preferences */}
        <div className="bg-white dark:bg-dark-800 rounded-3xl shadow-xl border border-gray-100 dark:border-dark-600 p-6 sm:p-8 mb-8">
          <div className="flex items-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-pink-600 rounded-2xl flex items-center justify-center mr-4">
              <SunIcon className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-100">App Preferences</h2>
          </div>

          <div className="space-y-6">
            {/* Constituency Name (linked to Super Admin) */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-2xl p-6 border border-indigo-100 dark:border-indigo-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-2">Constituency Name</h3>
                  <p className="text-gray-600 dark:text-dark-300">This updates the name shown at the top of the app and syncs with Super Admin</p>
                </div>
                <Input
                  type="text"
                  name="constituencyName"
                  value={constituencyName}
                  onChange={(val) => setConstituencyName(val)}
                  placeholder="Enter constituency name"
                  className="h-12 text-base border-2 border-gray-200 dark:border-dark-600 focus:border-indigo-500 dark:focus:border-indigo-400 rounded-2xl px-4 transition-all duration-200 bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 min-w-[220px]"
                />
              </div>
            </div>

            <div className="bg-gradient-to-r from-orange-50 to-pink-50 dark:from-orange-900/20 dark:to-pink-900/20 rounded-2xl p-6 border border-orange-100 dark:border-orange-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-2">Theme</h3>
                  <p className="text-gray-600 dark:text-dark-300">Choose your preferred theme appearance</p>
                </div>
                <select
                  value={preferences.theme}
                  onChange={(e) => handlePreferenceChange('theme', e.target.value)}
                  className="h-12 px-4 border-2 border-gray-200 dark:border-dark-600 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-dark-700 text-base font-medium min-w-[140px] text-gray-900 dark:text-dark-100"
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

        {/* Notification Preferences */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8 mb-8">
          <div className="flex items-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center mr-4">
              <BellIcon className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Notification Preferences</h2>
          </div>

          <div className="space-y-6">
            {/* General Email Settings */}
            <div className="bg-gray-50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <EnvelopeIcon className="w-5 h-5 mr-2 text-blue-600" />
                General Email Settings
              </h3>

              <div className="space-y-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationPreferences.emailNotifications}
                    onChange={(e) => handleNotificationPreferenceChange('emailNotifications', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Enable Email Notifications</span>
                    <p className="text-xs text-gray-500">Receive all email notifications from the church management system</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Birthday Notification Settings */}
            <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl p-6 border border-pink-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <CakeIcon className="w-5 h-5 mr-2 text-pink-600" />
                Birthday Notification Settings
              </h3>

              <div className="space-y-6">
                {/* Enable Birthday Notifications */}
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationPreferences.birthdayNotifications.enabled}
                    onChange={(e) => handleBirthdayNotificationChange('enabled', e.target.checked)}
                    className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Enable Birthday Notifications</span>
                    <p className="text-xs text-gray-500">Receive email notifications for upcoming member birthdays</p>
                  </div>
                </label>

                {notificationPreferences.birthdayNotifications.enabled && (
                  <>
                    {/* Notification Timing */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        When to send notifications:
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { days: 7, label: '7 days before' },
                          { days: 3, label: '3 days before' },
                          { days: 1, label: '1 day before' },
                          { days: 0, label: 'On the day' }
                        ].map(option => (
                          <label key={option.days} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={notificationPreferences.birthdayNotifications.daysBeforeNotification.includes(option.days)}
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
                        value={notificationPreferences.birthdayNotifications.emailTime}
                        onChange={(e) => handleBirthdayNotificationChange('emailTime', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      >
                        {[
                          { value: '08:00', label: '8:00 AM' },
                          { value: '09:00', label: '9:00 AM' },
                          { value: '10:00', label: '10:00 AM' },
                          { value: '11:00', label: '11:00 AM' },
                          { value: '12:00', label: '12:00 PM' }
                        ].map(option => (
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
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Privacy Notice</h4>
              <p className="text-xs text-blue-800">
                You will only receive birthday notifications for members within your organizational responsibility.
                This includes members in bacentas you lead or oversee. We respect data privacy and organizational boundaries.
              </p>
            </div>
          </div>
        </div>

        {/* Push Notification Settings (temporarily disabled)
            Original (restore when re‑enabling push):
            {hasAdminPrivileges(userProfile) && (
              <PushNotificationSettings className="mb-8" />
            )}
        */}

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
