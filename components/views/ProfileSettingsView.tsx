import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
// import { useTheme } from '../../contexts/ThemeContext'; // Theme selection disabled
import { userService } from '../../services/userService';
import { inviteService } from '../../services/inviteService';
import useCurrencyFormatter from '../../hooks/useCurrencyFormatter';
import { formatIncomeDisplay, formatZarPerUsdRate } from '../../utils/currency';
import { getDefaultNotificationPreferences } from '../../utils/notificationUtils';
// import { emailServiceClient } from '../../services/emailServiceClient'; // Email feature on hold
// Ministry feature removed – no MINISTRY_OPTIONS import
import { NotificationPreferences, CrossTenantInvite, UserPreferences, TabKeys } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ImageUpload from '../ui/ImageUpload';
import ChangePasswordModal from '../auth/ChangePasswordModal';
import EmailVerificationPrompt from '../auth/EmailVerificationPrompt';

import PushNotificationSettings from '../notifications/PushNotificationSettings';
import { canManageAdminInvites, hasAdminPrivileges, isCampusShepherd, isPromotedCampusAdmin } from '../../utils/permissionUtils';
import {
  SunIcon,
  UserIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  ShieldCheckIcon,
  KeyIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  BellIcon,
  CakeIcon,
  ArrowLeftIcon,
  XMarkIcon
} from '../icons';
import { collection, doc, getDocs, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../../firebase.config';
import { crossTenantService } from '../../services/crossTenantService';

interface ProfileFormData {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  profilePicture: string;
}

type SettingsTabId = 'profile' | 'app' | 'notifications' | 'management' | 'constituencies' | 'security';

interface SettingsTabDefinition {
  id: SettingsTabId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}

interface SettingsTabButtonProps {
  tab: SettingsTabDefinition;
  isActive: boolean;
  onClick: () => void;
  compact?: boolean;
}

const SettingsTabButton: React.FC<SettingsTabButtonProps> = ({
  tab,
  isActive,
  onClick,
  compact = false
}) => {
  const Icon = tab.icon;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={`group relative flex w-full border text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 ${
        compact
          ? 'min-h-[176px] flex-col items-center justify-center rounded-[28px] px-5 py-6 text-center'
          : 'items-start gap-4 rounded-[26px] p-4'
      } ${
        isActive
          ? 'border-slate-900 bg-slate-900 text-white shadow-[0_24px_48px_-30px_rgba(15,23,42,0.88)]'
          : 'border-slate-200/90 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.45)]'
      }`}
    >
      <div className={`flex shrink-0 items-center justify-center bg-gradient-to-br ${tab.gradient} text-white shadow-sm ring-1 ring-white/25 ${compact ? 'mb-4 h-16 w-16 rounded-[22px]' : 'h-12 w-12 rounded-2xl'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className={`min-w-0 ${compact ? 'w-full text-center' : 'flex-1 text-left'}`}>
        <p className={`font-semibold tracking-tight ${compact ? 'text-[1.05rem]' : 'text-base'}`}>{tab.label}</p>
        <p className={`mt-2 leading-6 ${isActive ? 'text-slate-300' : 'text-slate-500'} ${compact ? 'text-sm' : 'text-sm'}`}>
          {tab.description}
        </p>
      </div>
    </button>
  );
};

const ProfileSettingsView: React.FC = () => {
  const {
    userProfile,
    user,
    showToast,
    refreshUserProfile,
    // Cross-tenant switching
    refreshAccessibleChurchLinks,
    accessibleChurchLinks,
    switchToExternalChurch,
    switchBackToOwnChurch,
    isImpersonating,
    currentChurchId,
    switchTab
  } = useAppContext();
  // const { theme, setTheme } = useTheme(); // Theme selection disabled
  const { currencyOptions, rates } = useCurrencyFormatter();

  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: userProfile?.preferences?.theme || 'light',
    allowEditPreviousSundays: true, // default enabled
    isCampusShepherd: userProfile?.preferences?.isCampusShepherd,
    preferredCurrency: userProfile?.preferences?.preferredCurrency || 'ZAR'
  });

  // Constituency (church) name editor – linked to Super Admin feature
  const [constituencyName, setConstituencyName] = useState<string>(userProfile?.churchName || '');

  // Force birthday preferences to org defaults: enabled, days [7,3,1,0], time '00:00'
  const forcedBirthdayDefaults = {
    enabled: true,
    daysBeforeNotification: [7, 3, 1, 0],
    emailTime: '00:00'
  } as NotificationPreferences['birthdayNotifications'];

  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(
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

  const [profileData, setProfileData] = useState<ProfileFormData>({
    firstName: userProfile?.firstName || '',
    lastName: userProfile?.lastName || '',
    phoneNumber: userProfile?.phoneNumber || '',
    profilePicture: userProfile?.profilePicture || ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>(userProfile?.profilePicture || '');
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  const [isConstituencyManagerOpen, setIsConstituencyManagerOpen] = useState(false);
  const [isSavingCampusShepherd, setIsSavingCampusShepherd] = useState(false);
  // const [isSendingTestEmail, setIsSendingTestEmail] = useState(false); // Email feature on hold

  const isPromotedAdmin = isPromotedCampusAdmin(userProfile);
  const hasAdminAccess = hasAdminPrivileges(userProfile);
  const canConfigureCurrencyDisplay = isCampusShepherd(userProfile);
  const canOpenAdminInviteManagement = canManageAdminInvites(userProfile);
  const liveUsdZarRateLabel = formatZarPerUsdRate(rates);
  const tabContentRef = useRef<HTMLDivElement | null>(null);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTabId>('profile');

  const settingsTabs = useMemo<SettingsTabDefinition[]>(() => {
    const tabs: SettingsTabDefinition[] = [
      {
        id: 'profile',
        label: 'Profile',
        description: 'Photo, personal details, and account identity.',
        icon: UserIcon,
        gradient: 'from-blue-500 to-violet-600'
      },
      {
        id: 'app',
        label: 'App',
        description: 'Church name, currency display, and app behaviour.',
        icon: SunIcon,
        gradient: 'from-orange-500 to-pink-600'
      },
      {
        id: 'notifications',
        label: 'Notifications',
        description: 'Email, birthday, and device notification preferences.',
        icon: BellIcon,
        gradient: 'from-pink-500 to-purple-600'
      }
    ];

    if (hasAdminAccess) {
      tabs.push({
        id: 'management',
        label: 'Management',
        description: 'Leader and admin tools in one place.',
        icon: UserGroupIcon,
        gradient: 'from-emerald-500 to-teal-600'
      });
    }

    if (hasAdminAccess) {
      tabs.push({
        id: 'constituencies',
        label: 'Constituencies',
        description: 'Switch linked constituencies and manage external access.',
        icon: BuildingOfficeIcon,
        gradient: 'from-indigo-500 to-blue-600'
      });
    }

    tabs.push({
      id: 'security',
      label: 'Security',
      description: 'Email verification and password protection.',
      icon: ShieldCheckIcon,
      gradient: 'from-red-500 to-pink-600'
    });

    return tabs;
  }, [hasAdminAccess]);

  useEffect(() => {
    if (!settingsTabs.some(tab => tab.id === activeSettingsTab)) {
      setActiveSettingsTab(settingsTabs[0]?.id || 'profile');
    }
  }, [activeSettingsTab, settingsTabs]);

  const activeSettingsTabMeta = settingsTabs.find(tab => tab.id === activeSettingsTab) || settingsTabs[0];

  const handleSettingsTabChange = (tabId: SettingsTabId) => {
    if (tabId === activeSettingsTab) return;
    setActiveSettingsTab(tabId);
    requestAnimationFrame(() => {
      const contentNode = tabContentRef.current;
      if (!contentNode) {
        return;
      }

      const shouldScroll = window.innerWidth < 1280 || contentNode.getBoundingClientRect().top < 96;
      if (shouldScroll) {
        contentNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  // Update state when userProfile changes
  useEffect(() => {
    if (userProfile) {
      setPreferences({
        theme: userProfile.preferences?.theme || 'light',
        allowEditPreviousSundays: true,
        isCampusShepherd: userProfile.preferences?.isCampusShepherd,
        preferredCurrency: userProfile.preferences?.preferredCurrency || 'ZAR'
      });

      setConstituencyName(userProfile.churchName || '');

      // Always start from a safe base to avoid spreading undefined and to keep all keys defined
      const basePrefs = (userProfile.notificationPreferences || getDefaultNotificationPreferences()) as NotificationPreferences;
      setNotificationPreferences({
        ...basePrefs,
        birthdayNotifications: {
          ...basePrefs.birthdayNotifications,
          ...forcedBirthdayDefaults
        }
      } as NotificationPreferences);

      setProfileData({
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        phoneNumber: userProfile.phoneNumber || '',
        profilePicture: userProfile.profilePicture || ''
      });

      setImagePreview(userProfile.profilePicture || '');
    }
  }, [userProfile]);

  // const handlePreferenceChange = (key: keyof UserPreferences, value: any) => {
  //   setPreferences(prev => ({ ...prev, [key]: value }));
  // };

  const handleNotificationPreferenceChange = (key: keyof NotificationPreferences, value: any) => {
    setNotificationPreferences(prev => ({ ...prev, [key]: value }));
  };

  // Removed legacy app/ministry display name sync – header uses churchName now

  // Birthday notification preferences are controlled by the organisation and cannot be changed via profile UI
  const handleBirthdayNotificationChange = (_key: keyof NotificationPreferences['birthdayNotifications'], _value: any) => {
    // Admin-managed; intentionally a no-op
  };
  // Reference once to avoid tree-shaking/unused warnings (no runtime effect)
  useEffect(() => {
    if (false) handleBirthdayNotificationChange('enabled', true);
  }, []);

  const handleCampusShepherdPreferenceUpdate = async (value: boolean) => {
    if (!user || preferences.isCampusShepherd === value) {
      return;
    }

    const previousValue = preferences.isCampusShepherd;
    setPreferences(prev => ({ ...prev, isCampusShepherd: value }));
    setIsSavingCampusShepherd(true);

    try {
      await userService.updateUserPreferences(user.uid, { isCampusShepherd: value });
      await refreshUserProfile();
      showToast(
        'success',
        'Campus Shepherd Updated',
        value
          ? 'Sunday income is now visible in Weekly Attendance for this account.'
          : 'Sunday income is now hidden in Weekly Attendance for this account.'
      );
    } catch (error: any) {
      setPreferences(prev => ({ ...prev, isCampusShepherd: previousValue }));
      showToast('error', 'Update Failed', error?.message || 'Could not update Campus Shepherd mode.');
    } finally {
      setIsSavingCampusShepherd(false);
    }
  };

  // const handleSendTestEmail = async () => {
  //   if (!user || !user.email) {
  //     showToast('error', 'Not Signed In', 'You must be signed in with an email to send a test email');
  //     return;
  //   }
  //   if (!hasAdminPrivileges(userProfile)) {
  //     showToast('error', 'Admin Only', 'Only admins can send the test email');
  //     return;
  //   }
  //   try {
  //     setIsSendingTestEmail(true);
  //     const displayName = `${userProfile?.firstName || user.displayName || 'Admin'} ${userProfile?.lastName || ''}`.trim();
  //     const res = await emailServiceClient.sendTestBirthdayEmail({
  //       uid: user.uid,
  //       email: user.email,
  //       displayName,
  //       role: (userProfile as any)?.role || 'admin'
  //     });
  //     if ((res as any)?.success) {
  //       showToast('success', 'Test Email Sent', 'Please check your inbox for the birthday test email');
  //     } else {
  //       const msg = (res as any)?.error || 'Unknown failure while sending the test email';
  //       showToast('error', 'Test Email Failed', msg);
  //     }
  //   } catch (e: any) {
  //     showToast('error', 'Test Email Failed', e?.message || 'An error occurred while sending the test email');
  //   } finally {
  //     setIsSendingTestEmail(false);
  //   }
  // };

  // Note: Birthday notification timing is admin-managed; UI controls are disabled.

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
        preferences: { ...preferences, allowEditPreviousSundays: true, theme: 'light' as any },
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
              try { window.dispatchEvent(new CustomEvent('constituencyUpdated', { detail: { adminId: user.uid, newName } })); } catch { }
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

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading profile...</div>
      </div>
    );
  }

  const roleDisplayName = isPromotedAdmin ? 'Promoted Campus Admin' : (userProfile.role || 'Member');
  const shellPanelClassName = 'rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_24px_55px_-36px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:border-dark-600 dark:bg-dark-800';
  const settingsSummaryItems = [
    {
      label: 'Email',
      value: userProfile.email || 'No email',
      icon: EnvelopeIcon,
      accentClassName: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
    },
    {
      label: 'Constituency',
      value: userProfile.churchName || 'No Constituency',
      icon: BuildingOfficeIcon,
      accentClassName: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
    },
    {
      label: 'Access',
      value: roleDisplayName,
      icon: ShieldCheckIcon,
      accentClassName: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300'
    }
  ];

  const userFullName = `${profileData.firstName || userProfile.firstName || ''} ${profileData.lastName || userProfile.lastName || ''}`.trim() || userProfile.displayName || user?.displayName || 'User';

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-28 pt-0 lg:pb-10">
          {/* Redesigned Premium Header Card */}
          <section className={`${shellPanelClassName} overflow-hidden p-6 sm:p-8 relative`}>
            {/* Subtle premium background glow accents */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-gradient-to-tr from-emerald-500/5 to-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              
              {/* Left Column: Avatar & User Info */}
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start lg:gap-6 flex-1 min-w-0">
                {/* Profile Image with subtle ring glow */}
                <div className="relative mx-auto shrink-0 sm:mx-0 self-center sm:self-start">
                  <div className={`absolute -inset-1.5 rounded-[24px] bg-gradient-to-br ${activeSettingsTabMeta.gradient} opacity-25 blur-md transition-all duration-300 group-hover:opacity-40`} />
                  <div className="relative p-0.5 rounded-[22px] bg-white dark:bg-dark-800 ring-2 ring-slate-100 dark:ring-dark-700 shadow-md">
                    <ImageUpload
                      value={imagePreview || profileData.profilePicture}
                      onChange={handleImageChange}
                      size="md"
                      className="relative"
                      enableCropping={true}
                      cropPresets={true}
                      onError={(title, message) => showToast('error', title, message)}
                    />
                  </div>
                </div>

                {/* Header Text & Badges */}
                <div className="min-w-0 flex-1 text-center sm:text-left space-y-3">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:bg-dark-700 dark:text-dark-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Settings & Preferences
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-dark-100 sm:text-3xl lg:text-4xl">
                      Account & app preferences
                    </h1>
                    <p className="text-sm font-medium text-slate-500 dark:text-dark-400">
                      Welcome back, <span className="font-bold text-slate-800 dark:text-dark-100">{userFullName}</span>
                    </p>
                  </div>
                  
                  <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-dark-300">
                    Keep your profile, constituency setup, notifications, leadership tools, and security in one place without the clutter.
                  </p>

                  {/* Redesigned sleek metadata horizontal pills */}
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-2">
                    {settingsSummaryItems.map(item => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.label}
                          className="flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1.5 shadow-sm backdrop-blur-xs transition-all duration-200 hover:border-slate-300 hover:bg-white dark:border-dark-600 dark:bg-dark-700/50 dark:hover:border-dark-500"
                          title={`${item.label}: ${item.value}`}
                        >
                          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.accentClassName}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex items-center text-xs">
                            <span className="font-bold uppercase tracking-wider text-slate-400 dark:text-dark-400 mr-1 text-[10px]">
                              {item.label}:
                            </span>
                            <span className="font-semibold text-slate-700 dark:text-dark-200 max-w-[120px] sm:max-w-[180px] truncate">
                              {item.value}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Actions (Save changes placed elegantly) */}
              <div className="flex flex-col sm:flex-row lg:flex-col items-center justify-center gap-3 shrink-0 self-center lg:self-center">
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSaveSettings}
                  disabled={isLoading}
                  className="h-12 px-6 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white hover:from-slate-800 hover:to-slate-700 shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 font-semibold tracking-wide w-full sm:w-auto min-w-[160px] active:scale-95"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheckIcon className="w-5 h-5 text-emerald-400" />
                      <span>Save Changes</span>
                    </>
                  )}
                </Button>
              </div>

            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)] xl:gap-6">
            <aside className="hidden xl:block xl:sticky xl:top-24 xl:self-start">
              <div className={`${shellPanelClassName} p-3`}>
                <div className="flex items-center justify-between px-2 pb-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Settings map</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-dark-100">Categories</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-dark-700 dark:text-dark-200">
                    {settingsTabs.length}
                  </span>
                </div>

                <nav className="space-y-3" aria-label="Settings categories">
                  {settingsTabs.map(tab => (
                    <SettingsTabButton
                      key={tab.id}
                      tab={tab}
                      isActive={tab.id === activeSettingsTab}
                      onClick={() => handleSettingsTabChange(tab.id)}
                    />
                  ))}
                </nav>
              </div>
            </aside>

            <div className="min-w-0 space-y-5">
              <div className={`${shellPanelClassName} p-3 xl:hidden`}>
                <div className="flex items-center justify-between px-2 pb-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Quick sections</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-dark-100">Choose a category</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-dark-700 dark:text-dark-200">
                    {settingsTabs.length}
                  </span>
                </div>

                <nav className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Settings categories">
                  {settingsTabs.map(tab => (
                    <SettingsTabButton
                      key={tab.id}
                      tab={tab}
                      compact
                      isActive={tab.id === activeSettingsTab}
                      onClick={() => handleSettingsTabChange(tab.id)}
                    />
                  ))}
                </nav>
              </div>

              {/* Unified Settings Workspace Panel */}
              <div
                ref={tabContentRef}
                className={`${shellPanelClassName} scroll-mt-28 overflow-hidden`}
              >
                {/* Unified Card Header */}
                <div className="border-b border-slate-100 dark:border-dark-700/60 bg-slate-50/50 dark:bg-dark-800/40 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${activeSettingsTabMeta.gradient} text-white shadow-sm ring-1 ring-white/10`}>
                        <activeSettingsTabMeta.icon className="h-5.5 w-5.5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-dark-500">Settings Section</span>
                        <h2 className="text-xl font-extrabold text-slate-900 dark:text-dark-100 sm:text-2xl tracking-tight">{activeSettingsTabMeta.label}</h2>
                      </div>
                    </div>

                    <p className="max-w-xl text-sm font-medium text-slate-500 dark:text-dark-400 sm:text-right leading-relaxed">
                      {activeSettingsTabMeta.description}
                    </p>
                  </div>
                </div>

                {/* Unified Card Content Area */}
                <div className="p-5 sm:p-6 lg:p-8">
                  {activeSettingsTab === 'constituencies' && hasAdminAccess && (
                    <div id="constituencies-section" className="space-y-6 text-center py-6">
                      <div className="max-w-md mx-auto space-y-4">
                        <p className="text-sm text-slate-500 dark:text-dark-400 leading-relaxed">
                          You can switch between external constituencies that have granted you permission, or manage access links under your authority.
                        </p>
                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => setIsConstituencyManagerOpen(true)}
                          className="h-12 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 w-full sm:w-auto font-semibold shadow-md shrink-0 border-none"
                        >
                          Manage Constituencies
                        </Button>
                      </div>

                      {isImpersonating && (
                        <div className="mt-8 p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-sm text-indigo-800 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-300 max-w-xl mx-auto">
                          <div className="flex items-center justify-between gap-4">
                            <div className="text-left">
                              <span className="font-bold">Active Impersonation</span>
                              <p className="text-xs text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">Currently viewing an external constituency</p>
                            </div>
                            <button
                              onClick={() => switchBackToOwnChurch()}
                              className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-dark-750 dark:hover:bg-dark-700 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 font-semibold hover:bg-indigo-50 transition-colors shadow-xs cursor-pointer"
                            >
                              Switch back
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeSettingsTab === 'profile' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-slate-700 dark:text-dark-200">
                            First Name <span className="text-red-500">*</span>
                          </label>
                          <Input
                            type="text"
                            name="firstName"
                            value={profileData.firstName}
                            onChange={(val) => setProfileData(p => ({ ...p, firstName: val }))}
                            placeholder="Enter first name"
                            required
                            className="h-12 text-base border border-slate-200 dark:border-dark-600 focus:border-blue-500 dark:focus:border-blue-400 rounded-2xl px-4 transition-all duration-200 bg-white dark:bg-dark-700 text-slate-900 dark:text-dark-100 placeholder-slate-400 shadow-xs"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-slate-700 dark:text-dark-200">
                            Last Name
                          </label>
                          <Input
                            type="text"
                            name="lastName"
                            value={profileData.lastName}
                            onChange={(val) => setProfileData(p => ({ ...p, lastName: val }))}
                            placeholder="Enter last name"
                            className="h-12 text-base border border-slate-200 dark:border-dark-600 focus:border-blue-500 dark:focus:border-blue-400 rounded-2xl px-4 transition-all duration-200 bg-white dark:bg-dark-700 text-slate-900 dark:text-dark-100 placeholder-slate-400 shadow-xs"
                          />
                        </div>

                        <div className="lg:col-span-2 space-y-2">
                          <label className="block text-sm font-bold text-slate-700 dark:text-dark-200">
                            Phone Number
                          </label>
                          <Input
                            type="tel"
                            name="phoneNumber"
                            value={profileData.phoneNumber}
                            onChange={(val) => setProfileData(p => ({ ...p, phoneNumber: val }))}
                            placeholder="Enter phone number"
                            className="h-12 text-base border border-slate-200 dark:border-dark-600 focus:border-blue-500 dark:focus:border-blue-400 rounded-2xl px-4 transition-all duration-200 bg-white dark:bg-dark-700 text-slate-900 dark:text-dark-100 placeholder-slate-400 shadow-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeSettingsTab === 'app' && (
                    <div className="space-y-6">
                      {/* Constituency Name (linked to Super Admin) */}
                      <div className="bg-gradient-to-r from-indigo-50/50 to-blue-50/50 dark:from-indigo-950/10 dark:to-blue-950/10 rounded-2xl p-6 border border-slate-100 dark:border-dark-700/60 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-slate-900 dark:text-dark-100">Constituency Name</h3>
                            <p className="text-sm text-slate-500 dark:text-dark-400 mt-1 leading-relaxed">This updates the name shown at the top of the app and syncs with Super Admin</p>
                          </div>
                          <Input
                            type="text"
                            name="constituencyName"
                            value={constituencyName}
                            onChange={(val) => setConstituencyName(val)}
                            placeholder="Enter constituency name"
                            wrapperClassName="mb-0 sm:mb-0 flex-shrink-0"
                            className="h-12 text-base border border-slate-200 dark:border-dark-600 focus:border-indigo-500 dark:focus:border-indigo-400 rounded-2xl px-4 transition-all duration-200 bg-white dark:bg-dark-700 text-slate-900 dark:text-dark-100 min-w-[240px] placeholder-slate-400 shadow-xs"
                          />
                        </div>
                      </div>

                      {canConfigureCurrencyDisplay && (
                        <div className="rounded-2xl border border-slate-100 bg-gradient-to-r from-emerald-50/50 to-cyan-50/50 p-6 dark:border-dark-700/60 dark:from-emerald-950/10 dark:to-cyan-950/10 shadow-xs">
                          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 text-white shadow-sm ring-1 ring-white/10">
                                  <CurrencyDollarIcon className="h-5 w-5" />
                                </div>
                                <div>
                                  <h3 className="text-base font-bold text-slate-900 dark:text-dark-100">Currency Display</h3>
                                  <p className="text-sm text-slate-500 dark:text-dark-400 mt-1 leading-relaxed">
                                    Campus Shepherd income uses your selected currency, with live USD shown in brackets unless USD is selected.
                                  </p>
                                </div>
                              </div>

                              <div className="mt-5 max-w-sm">
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-dark-400" htmlFor="preferredCurrency">
                                  Preferred currency
                                </label>
                                <select
                                  id="preferredCurrency"
                                  value={preferences.preferredCurrency || 'ZAR'}
                                  onChange={(event) => setPreferences(prev => ({ ...prev, preferredCurrency: event.target.value }))}
                                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white dark:border-dark-600 dark:bg-dark-700 px-4 text-base text-slate-900 dark:text-dark-100 transition-all duration-200 focus:border-emerald-500 focus:outline-none shadow-xs font-medium cursor-pointer"
                                >
                                  {currencyOptions.map(option => (
                                    <option key={option.code} value={option.code} className="dark:bg-dark-800">
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-slate-100 bg-white dark:border-dark-600/70 dark:bg-dark-700/80 p-5 shadow-sm lg:min-w-[280px]">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Preview</p>
                              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-dark-100 tracking-tight">
                                {formatIncomeDisplay(1250, preferences.preferredCurrency || 'ZAR', rates, { showUsdComparison: true })}
                              </p>
                              <p className="mt-2 text-xs text-slate-500 dark:text-dark-400 font-medium">Stored internally in South African Rand.</p>
                              <p className="mt-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {liveUsdZarRateLabel ? `Live rate: 1 USD = ZAR ${liveUsdZarRateLabel}` : 'Updating live USD/ZAR rate...'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeSettingsTab === 'management' && hasAdminAccess && (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="bg-gradient-to-r from-sky-50/50 to-indigo-50/50 dark:from-sky-950/10 dark:to-indigo-950/10 rounded-2xl p-6 border border-slate-100 dark:border-dark-700/60 shadow-xs">
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base font-bold text-slate-900 dark:text-dark-100">Campus Shepherd Mode</h3>
                              <p className="text-sm text-slate-500 dark:text-dark-400 mt-1 leading-relaxed">
                                Controls whether this admin can view and manage Sunday income inside Weekly Attendance.
                              </p>
                              {isPromotedAdmin && (
                                <p className="mt-2 text-xs font-bold text-purple-600 dark:text-purple-400">
                                  Your Campus Shepherd access is managed by the main leader.
                                </p>
                              )}
                              <p className="mt-3.5 text-xs font-bold text-slate-700 dark:text-dark-300 flex items-center gap-2">
                                <span>Status:</span>
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  preferences.isCampusShepherd === true
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30'
                                    : preferences.isCampusShepherd === false
                                      ? 'bg-slate-100 text-slate-700 dark:bg-dark-700 dark:text-dark-300 border border-slate-200/50 dark:border-dark-600/50'
                                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-100/50 dark:border-amber-900/30'
                                }`}>
                                  {preferences.isCampusShepherd === true
                                    ? 'Campus Shepherd'
                                    : preferences.isCampusShepherd === false
                                      ? 'Not Campus Shepherd'
                                      : 'Not answered yet'}
                                </span>
                              </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 sm:min-w-[280px] shrink-0">
                              <Button
                                type="button"
                                variant="primary"
                                disabled={isPromotedAdmin || isSavingCampusShepherd || preferences.isCampusShepherd === true}
                                onClick={() => handleCampusShepherdPreferenceUpdate(true)}
                                className="h-11 px-6 rounded-2xl font-bold transition-all duration-200 flex items-center justify-center min-w-[130px] border-none"
                              >
                                {isSavingCampusShepherd && preferences.isCampusShepherd === true ? 'Saving...' : 'Yes'}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={isPromotedAdmin || isSavingCampusShepherd || preferences.isCampusShepherd === false}
                                onClick={() => handleCampusShepherdPreferenceUpdate(false)}
                                className="h-11 px-6 rounded-2xl font-bold transition-all duration-200 flex items-center justify-center min-w-[130px] border border-slate-200 dark:border-dark-600 bg-white hover:bg-slate-50 dark:bg-dark-700 dark:hover:bg-dark-600 text-slate-700 dark:text-dark-200"
                              >
                                {isSavingCampusShepherd && preferences.isCampusShepherd === false ? 'Saving...' : 'No'}
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Admin Invite Management */}
                        {canOpenAdminInviteManagement && (
                          <div className="bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/10 dark:to-teal-950/10 rounded-2xl p-6 border border-slate-100 dark:border-dark-700/60 shadow-xs">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-base font-bold text-slate-900 dark:text-dark-100">Admin Invite Management</h3>
                                <p className="text-sm text-slate-500 dark:text-dark-400 mt-1 leading-relaxed">Generate invites and promote accepted leaders under your authority</p>
                              </div>
                              <Button
                                type="button"
                                variant="primary"
                                onClick={() => switchTab({ id: TabKeys.ADMIN_INVITES, name: 'Leadership Management' })}
                                className="h-12 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-2xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 min-w-[180px] shadow-sm shrink-0 border-none"
                              >
                                <UserGroupIcon className="w-5 h-5 text-emerald-100" />
                                <span>Manage Invites</span>
                              </Button>
                            </div>
                          </div>
                        )}


                      </div>
                    </div>
                  )}

                  {activeSettingsTab === 'notifications' && (
                    <div className="space-y-6">
                      {/* General Email Settings */}
                      <div className="bg-slate-50/50 dark:bg-dark-750/30 rounded-2xl p-6 border border-slate-100 dark:border-dark-750/50 shadow-xs">
                        <h3 className="text-base font-bold text-slate-900 dark:text-dark-100 mb-4 flex items-center gap-2">
                          <EnvelopeIcon className="w-5 h-5 text-blue-500" />
                          General Email Settings
                        </h3>

                        <div className="space-y-4">
                          <label className="flex items-start gap-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={!!notificationPreferences?.emailNotifications}
                              onChange={(e) => handleNotificationPreferenceChange('emailNotifications', e.target.checked)}
                              className="w-4 h-4 mt-0.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <span className="text-sm font-bold text-slate-700 dark:text-dark-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Enable Email Notifications</span>
                              <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5 leading-relaxed">Receive all email notifications from the church management system</p>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Birthday Notification Settings */}
                      <div className="bg-gradient-to-r from-pink-50/50 to-purple-50/50 dark:from-pink-950/10 dark:to-purple-950/10 rounded-2xl p-6 border border-slate-100 dark:border-dark-700/60 shadow-xs">
                        <h3 className="text-base font-bold text-slate-900 dark:text-dark-100 mb-4 flex items-center gap-2">
                          <CakeIcon className="w-5 h-5 text-pink-500" />
                          Birthday Notification Settings
                        </h3>

                        <div className="space-y-5">
                          <label className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={true}
                              disabled
                              className="w-4 h-4 mt-0.5 text-pink-600 border-slate-300 dark:border-dark-600 rounded bg-slate-100 dark:bg-dark-700 cursor-not-allowed"
                            />
                            <div className="min-w-0">
                              <span className="text-sm font-bold text-slate-700 dark:text-dark-200">Birthday Notifications (managed by admin)</span>
                              <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5 leading-relaxed">These settings are controlled by the organisation and cannot be changed here</p>
                            </div>
                          </label>

                          {notificationPreferences.birthdayNotifications.enabled && (
                            <div className="pl-7 space-y-5 border-l border-pink-100 dark:border-pink-900/40 mt-4">
                              {/* Notification Timing */}
                              <div className="space-y-2">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-dark-400">
                                  When to send notifications:
                                </label>
                                <div className="grid grid-cols-2 gap-3 max-w-md">
                                  {[
                                    { days: 7, label: '7 days before' },
                                    { days: 3, label: '3 days before' },
                                    { days: 1, label: '1 day before' },
                                    { days: 0, label: 'On the day' }
                                  ].map(option => (
                                    <label key={option.days} className="flex items-center gap-2 cursor-not-allowed">
                                      <input
                                        type="checkbox"
                                        checked={notificationPreferences.birthdayNotifications.daysBeforeNotification.includes(option.days)}
                                        disabled
                                        className="w-4 h-4 text-pink-600 border-slate-300 dark:border-dark-600 rounded bg-slate-100 dark:bg-dark-700"
                                      />
                                      <span className="text-sm text-slate-600 dark:text-dark-300 font-medium">{option.label}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              {/* Email Time */}
                              <div className="space-y-2 max-w-xs">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-dark-400">
                                  Preferred notification time:
                                </label>
                                <select
                                  value={notificationPreferences.birthdayNotifications.emailTime}
                                  disabled
                                  className="h-10 w-full px-3 border border-slate-200 bg-slate-50 dark:border-dark-600 dark:bg-dark-700 rounded-xl text-sm font-medium text-slate-700 dark:text-dark-350 cursor-not-allowed"
                                >
                                  <option value="00:00">12:00 AM</option>
                                </select>
                                <p className="text-[10px] font-medium text-slate-400 dark:text-dark-500 mt-1">
                                  Notifications will be sent around this time each day
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Privacy Notice */}
                      <div className="bg-blue-50/50 rounded-2xl p-5 border border-slate-100 dark:bg-blue-950/10 dark:border-dark-700/60 shadow-xs">
                        <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-1.5">
                          <ShieldCheckIcon className="w-4 h-4 text-blue-500" />
                          Privacy Notice
                        </h4>
                        <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed font-medium">
                          You will only receive birthday notifications for members within your organizational responsibility.
                          This includes members in bacentas you lead or oversee. We respect data privacy and organizational boundaries.
                        </p>
                      </div>

                      <div className="pt-4 border-t border-slate-100 dark:border-dark-700/60">
                        <PushNotificationSettings className="mt-2" />
                      </div>
                    </div>
                  )}

                  {activeSettingsTab === 'security' && (
                    <div className="space-y-6">
                      <EmailVerificationPrompt mode="settings" className="mb-2" />

                      <div className="bg-gradient-to-r from-red-50/50 to-pink-50/50 dark:from-red-950/10 dark:to-pink-950/10 rounded-2xl p-6 border border-slate-100 dark:border-dark-700/60 shadow-xs">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-slate-900 dark:text-dark-100">Password Management</h3>
                            <p className="text-sm text-slate-500 dark:text-dark-400 mt-1 leading-relaxed">Update your account password to keep your account secure</p>
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsChangePasswordModalOpen(true)}
                            className="h-12 px-6 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white rounded-2xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 min-w-[180px] shadow-sm shrink-0 border-none"
                          >
                            <KeyIcon className="w-5 h-5 text-red-100" />
                            <span>Change Password</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            <div className="sticky bottom-4 z-20 lg:hidden">
              <div className="rounded-[24px] bg-slate-900/95 p-4 text-white shadow-[0_24px_50px_-28px_rgba(15,23,42,0.85)] backdrop-blur-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Save changes</p>
                    <p className="mt-1 text-xs text-slate-300">Your edits stay here while you move between tabs.</p>
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleSaveSettings}
                    disabled={isLoading}
                    className="h-11 shrink-0 rounded-2xl bg-white px-5 text-slate-900 hover:bg-slate-100"
                  >
                    {isLoading ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />



      {/* Constituency Manager Overlay */}
      {isConstituencyManagerOpen && (
        <ConstituencyManagerScreen
          isOpen={isConstituencyManagerOpen}
          onClose={() => setIsConstituencyManagerOpen(false)}
          links={accessibleChurchLinks || []}
          isImpersonating={isImpersonating}
          currentChurchId={currentChurchId || ''}
          onSwitch={async (link) => {
            setIsConstituencyManagerOpen(false);
            // Always grant full access during cross-tenant impersonation
            switchToExternalChurch({ ...link, permission: 'read-write' });
            try { await refreshAccessibleChurchLinks?.(); } catch { }
          }}
          onSwitchBack={switchBackToOwnChurch}
        />
      )}
    </div>
  );
};

// Lightweight, inline component for listing many constituencies with UX controls
interface ConstituenciesListProps {
  links: Array<{
    id: string;
    ownerChurchId: string;
    ownerChurchName?: string;
    ownerName?: string;
    permission: 'read-only' | 'read-write';
  }>;
  isImpersonating: boolean;
  currentChurchId: string;
  onSwitch: (link: any, mode: 'read-only' | 'read-write') => void;
}

const ConstituenciesList: React.FC<ConstituenciesListProps> = ({ links, isImpersonating, currentChurchId, onSwitch }) => {
  const { showToast, refreshAccessibleChurchLinks, switchBackToOwnChurch } = useAppContext();
  // Pagination only (search/filters removed per request)
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Normalize with safe fallbacks
  const normalized = useMemo(() => links.map(l => ({
    ...l,
    ownerChurchName: l.ownerChurchName || 'External Constituency',
    ownerName: l.ownerName || 'Unknown Admin'
  })), [links]);

  const filtered = normalized; // no filtering UI

  const sorted = useMemo(() => {
    const arr = [...filtered];
    // Default sort: name asc
    arr.sort((a, b) => (a.ownerChurchName || '').localeCompare(b.ownerChurchName || ''));
    return arr;
  }, [filtered]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageItems = useMemo(() => sorted.slice((page - 1) * pageSize, page * pageSize), [sorted, page]);

  // Helper for initials avatar
  const getInitials = (name?: string) => (name || 'C').split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase();

  return (
    <div className="space-y-5">
      {/* Simple header note */}
      <div className="text-center text-sm text-gray-600">
        Tap a card to open the constituency.
      </div>

      {/* Empty state */}
      {links.length === 0 && (
        <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white grid place-items-center text-lg font-bold">☰</div>
          <p className="text-gray-700 font-medium">No external constituencies yet</p>
          <p className="text-gray-500 text-sm mt-1">Ask another admin to grant you access via an invite.</p>
        </div>
      )}

      {/* No results for current filters */}
      {links.length > 0 && filtered.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
          <p className="text-gray-700 font-medium">No matches</p>
          <p className="text-gray-500 text-sm mt-1">Try changing filters or clearing the search.</p>
        </div>
      )}

      {/* Grid List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
        {pageItems.map(link => {
          const isActive = isImpersonating && link.ownerChurchId === currentChurchId;
          const initials = getInitials(link.ownerChurchName);
          return (
            <div
              key={link.id}
              onClick={() => onSwitch(link, 'read-write')}
              title="Tap to open with Full Access"
              className={`group relative overflow-hidden rounded-2xl border p-4 transition-all cursor-pointer ${isActive ? 'bg-indigo-50/70 border-indigo-200' : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md'}`}
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white grid place-items-center text-sm font-bold flex-shrink-0">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{link.ownerChurchName}</h3>
                    {isActive && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-indigo-600 text-white">Current</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                    <span className="truncate">Admin: {link.ownerName}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={(e) => { e.stopPropagation(); onSwitch(link, 'read-write'); }}
                    className={`h-10 px-4 rounded-xl ${isActive ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
                  >
                    Full Access
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const { crossTenantService } = await import('../../services/crossTenantService');
                        await crossTenantService.revokeAccess(link.id);
                        if (isImpersonating && link.ownerChurchId === currentChurchId) {
                          try { await switchBackToOwnChurch(); } catch { }
                        }
                        try { await refreshAccessibleChurchLinks?.(); } catch { }
                        showToast('success', 'Access revoked', 'This constituency has been removed from your list');
                      } catch (err: any) {
                        console.warn('Revoke access failed', err);
                        showToast('error', 'Failed to revoke access', err.message || String(err));
                      }
                    }}
                    className="h-10 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 flex items-center gap-1"
                    title="Remove this external constituency from my list"
                  >
                    <XMarkIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Revoke</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-gray-600">
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-full border border-gray-300 bg-white hover:border-indigo-300 disabled:opacity-50"
              disabled={page === 1}
            >
              Prev
            </button>
            <span className="text-sm text-gray-700">Page {page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-full border border-gray-300 bg-white hover:border-indigo-300 disabled:opacity-50"
              disabled={page === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileSettingsView;

// Full-screen overlay for managing and switching constituencies
interface ConstituencyManagerScreenProps {
  isOpen: boolean;
  onClose: () => void;
  links: ConstituenciesListProps['links'];
  isImpersonating: boolean;
  currentChurchId: string;

  onSwitch: (link: any, mode: 'read-only' | 'read-write') => void;
  onSwitchBack: () => void;
}

const ConstituencyManagerScreen: React.FC<ConstituencyManagerScreenProps> = ({
  isOpen,
  onClose,
  links,
  isImpersonating,
  currentChurchId,
  onSwitch,
  onSwitchBack
}) => {
  const { user, userProfile, showToast } = useAppContext();
  const [inviteEmail, setInviteEmail] = useState('');

  const [isInviting, setIsInviting] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<CrossTenantInvite[]>([]);

  const refreshPending = async () => {
    try {
      if (!user?.uid) return;
      const items = await crossTenantService.getOutgoingInvites(user.uid);
      setPendingInvites(items);
    } catch (e: any) {
      console.warn('Failed to load pending invites', e);
    }
  };

  useEffect(() => {
    refreshPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, isOpen]);

  const handleSendInvite = async () => {
    if (!user || !userProfile) return;
    const email = inviteEmail.trim();
    if (!email) {
      showToast('error', 'Missing email', 'Enter the admin’s email to invite');
      return;
    }
    try {
      setIsInviting(true);
      // Look up the target admin by email
      const target = await inviteService.searchUserByEmail(email, { inviterIsMinistry: !!user?.isMinistryAccount });
      if (!target) {
        showToast('error', 'Admin not found', 'No active user matches that email');
        setIsInviting(false);
        return;
      }
      // Prevent inviting self
      if (target.uid === user.uid) {
        showToast('warning', 'Cannot invite yourself');
        setIsInviting(false);
        return;
      }
      // Send cross-tenant invite
      await crossTenantService.sendInvite({
        fromAdminUid: user.uid,
        fromAdminName: userProfile.displayName || `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || 'Admin',
        fromChurchId: userProfile.churchId,
        fromChurchName: userProfile.churchName,
        toAdminUid: target.uid!,
        toAdminEmail: target.email,
        toAdminName: target.displayName || `${target.firstName || ''} ${target.lastName || ''}`.trim() || undefined,
        permission: 'read-write'
      });
      setInviteEmail('');
      showToast('success', 'Invite sent', 'They’ll see your request to grant access');
      await refreshPending();
    } catch (e: any) {
      console.warn('sendInvite failed', e);
      showToast('error', 'Failed to send invite', e.message || String(e));
    } finally {
      setIsInviting(false);
    }
  };

  return (isOpen ?
    <div
      className="fixed bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 z-50 overflow-hidden"
      style={{
        top: 'calc(var(--navbar-height, 0px) + env(safe-area-inset-top, 0px))',
        left: 'env(safe-area-inset-left, 0px)',
        right: 'env(safe-area-inset-right, 0px)',
        bottom: 'env(safe-area-inset-bottom, 0px)',
        height:
          'calc(100vh - var(--navbar-height, 0px) - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
        minHeight:
          'calc(100dvh - var(--navbar-height, 0px) - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))'
      }}
    >
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-6 relative">
          <button
            onClick={onClose}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-xl transition-colors duration-200"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="w-6 h-6 text-gray-600" />
          </button>

          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Manage Constituencies
            </h1>
            <p className="text-sm sm:text-base text-gray-600">View and switch to constituencies you are linked to</p>
          </div>

          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg ring-1 ring-white/60">
            <BuildingOfficeIcon className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      {/* Impersonation banner */}
      {isImpersonating && (
        <div className="bg-indigo-50 border-b border-indigo-100">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between text-sm text-indigo-800">
            <div>
              <span className="font-medium">Currently viewing an external constituency</span>

            </div>
            <button
              onClick={() => {
                onSwitchBack();
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100"
            >
              Switch back to my constituency
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 scroll-smooth scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent touch-pan-y"
        style={{ height: 'calc(100% - 84px)' }}
      >
        <div className="max-w-5xl mx-auto">
          {/* Invite Admin Section */}
          <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Invite an Admin</h3>
              <span className="text-xs text-gray-500">Grant you access to their constituency</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="email"
                value={inviteEmail}
                onChange={setInviteEmail}
                placeholder="Admin email (example@domain.com)"
                className="h-11 flex-1"
              />

              <Button
                type="button"
                variant="primary"
                onClick={handleSendInvite}
                disabled={isInviting}
                className="h-11 px-5 rounded-xl"
              >
                {isInviting ? 'Sending…' : 'Send Invite'}
              </Button>
            </div>
            {pendingInvites.length > 0 && (
              <div className="mt-4">
                <div className="text-sm text-gray-700 font-medium mb-2">Pending invites</div>
                <div className="space-y-2">
                  {pendingInvites.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between rounded-xl border border-gray-200 p-3">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{inv.toAdminName || inv.toAdminEmail}</div>
                        <div className="text-xs text-gray-500">Full access • {inv.toAdminEmail}</div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={async () => { try { await crossTenantService.cancelInvite(inv.id); await refreshPending(); showToast('success', 'Invite cancelled'); } catch (e: any) { showToast('error', 'Failed to cancel invite', e.message || String(e)); } }}
                        className="h-9 px-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                      >
                        Cancel
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <ConstituenciesList
            links={links}
            isImpersonating={isImpersonating}
            currentChurchId={currentChurchId}
            onSwitch={onSwitch}
          />
        </div>
      </div>
    </div>
    : null);
};
