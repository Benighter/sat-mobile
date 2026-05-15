import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Smartphone, Globe, Check, AlertCircle, Settings, CheckCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { pushNotificationHelpers } from '../../services/enhancedNotificationIntegration';
import { pushNotificationService } from '../../services/pushNotificationService';

interface PushNotificationSettingsProps {
  className?: string;
}

const PushNotificationSettings: React.FC<PushNotificationSettingsProps> = ({ className = '' }) => {
  const [isSupported, setIsSupported] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'default'>('default');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeniedHelp, setShowDeniedHelp] = useState(false);

  const { showToast } = useAppContext();
  const isNativeApp = Capacitor.isNativePlatform();
  const platformName = isNativeApp ? Capacitor.getPlatform() : 'web';

  useEffect(() => {
    checkPushNotificationStatus();
  }, []);

  const checkPushNotificationStatus = async () => {
    try {
      setIsLoading(true);

      const supported = await pushNotificationHelpers.isSupported();
      setIsSupported(supported);

      try {
        const d: any = (pushNotificationService as any).getSupportDiagnostics?.();
        if (d) setDiagnostics(d);
      } catch { }

      if (supported) {
        const status = await pushNotificationHelpers.getPermissionStatus();
        setPermissionStatus(status);
        setIsInitialized(status === 'granted');
      }
    } catch (error) {
      console.error('Failed to check push notification status:', error);
      showToast('error', 'Error', 'Failed to check notification settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnablePushNotifications = async () => {
    try {
      setIsLoading(true);

      const granted = await pushNotificationHelpers.requestPermissions();

      if (granted) {
        const initialized = await pushNotificationHelpers.initialize();

        if (initialized) {
          setIsInitialized(true);
          setPermissionStatus('granted');
          showToast('success', 'Success', 'Notifications enabled successfully!');
        } else {
          showToast('error', 'Error', 'Failed to initialize push notifications');
        }
      } else {
        const status = await pushNotificationHelpers.getPermissionStatus();
        setPermissionStatus(status);
        showToast(
          'error',
          status === 'denied' ? 'Permission Denied' : 'Notifications Not Enabled',
          'Notifications require permission to work'
        );
      }
    } catch (error) {
      console.error('Failed to enable notifications:', error);
      showToast('error', 'Error', 'Failed to enable notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const getPlatformIcon = () => {
    const userAgent = navigator.userAgent;
    if (isNativeApp || userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      return <Smartphone className="w-5 h-5 text-blue-600" />;
    }
    return <Globe className="w-5 h-5 text-blue-600" />;
  };

  const getPlatformLabel = () => {
    if (isNativeApp) {
      return `${platformName.charAt(0).toUpperCase()}${platformName.slice(1)} App`;
    }

    const userAgent = navigator.userAgent;
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      return 'Mobile Browser';
    }

    return 'Desktop Browser';
  };

  const getStatusBadge = () => {
    if (isLoading) {
      return (
        <div className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
          <div className="animate-spin w-3 h-3 border border-gray-400 border-t-transparent rounded-full"></div>
          <span>Checking...</span>
        </div>
      );
    }

    if (!isSupported) {
      return (
        <div className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
          <BellOff className="w-3 h-3" />
          <span>Not supported</span>
        </div>
      );
    }

    if (permissionStatus === 'granted' && isInitialized) {
      return (
        <div className="inline-flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
          <Check className="w-3 h-3" />
          <span>Enabled</span>
        </div>
      );
    }

    if (permissionStatus === 'denied') {
      return (
        <div className="inline-flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
          <BellOff className="w-3 h-3" />
          <span>Denied</span>
        </div>
      );
    }

    return (
      <div className="inline-flex items-center space-x-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
        <AlertCircle className="w-3 h-3" />
        <span>Not enabled</span>
      </div>
    );
  };

  if (isLoading && !isSupported && permissionStatus === 'default') {
    return (
      <div className={`rounded-[28px] border border-slate-200/80 bg-white/95 p-6 shadow-[0_24px_55px_-36px_rgba(15,23,42,0.45)] ${className}`}>
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          <span className="text-gray-600">Loading notification settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_24px_55px_-36px_rgba(15,23,42,0.45)] ${className}`}>
      <div className="border-b border-slate-200/80 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-slate-900">Phone & Browser Notifications</h3>
              <p className="text-sm leading-6 text-slate-500">Show SAT Mobile alerts in your device notification tray</p>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </div>

      <div className="p-6">
        {!isSupported ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-gray-100">
              <BellOff className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">Notifications not supported</h4>
            <p className="text-gray-500 max-w-sm mx-auto">
              We could not verify full push support. You can still attempt to enable notifications below.
            </p>
            <div className="mt-4 space-y-2 text-xs text-left inline-block bg-gray-50 rounded-lg p-3 max-w-sm">
              <div className="font-medium text-gray-700">Diagnostics</div>
              <pre className="whitespace-pre-wrap text-[10px] leading-tight text-gray-600">{JSON.stringify(diagnostics, null, 2)}</pre>
            </div>
            <div className="mt-6 flex flex-col items-center space-y-3">
              <button
                onClick={handleEnablePushNotifications}
                disabled={isLoading}
                className="inline-flex items-center space-x-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    <span>Trying...</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4" />
                    <span>Try Enable Anyway</span>
                  </>
                )}
              </button>
              {!isNativeApp && (
                <button
                  onClick={() => { localStorage.setItem('forcePushSupport', 'true'); checkPushNotificationStatus(); }}
                  className="text-xs text-blue-600 hover:underline"
                >Force support and recheck</button>
              )}
            </div>
          </div>
        ) : permissionStatus === 'denied' ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-red-100">
              <BellOff className="w-8 h-8 text-red-500" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">Notifications blocked</h4>
            <p className="text-gray-500 max-w-sm mx-auto mb-4">
              {isNativeApp
                ? 'Notifications are blocked for SAT Mobile on this device. Turn them back on in system settings, then return here and recheck.'
                : "You've previously blocked notifications. Browsers will not show the prompt again until you re-enable permissions manually."}
            </p>
            <div className="space-y-4">
              <div>
                <button
                  onClick={() => setShowDeniedHelp(s => !s)}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  <span>{showDeniedHelp ? 'Hide Fix Steps' : 'How To Re-Enable'}</span>
                </button>
              </div>
              {showDeniedHelp && (
                <div className="text-left mx-auto max-w-md bg-red-50 border border-red-200 rounded-lg p-4 space-y-3 text-sm leading-relaxed">
                  <p className="font-medium text-red-700">Steps to re-enable:</p>
                  {isNativeApp ? (
                    <ol className="list-decimal list-inside space-y-1 text-red-800">
                      <li><span className="font-semibold">Android:</span> Open Settings, then Apps, then SAT Mobile.</li>
                      <li>Tap Notifications and turn on Allow notifications.</li>
                      <li>Make sure the SAT Mobile Notifications channel is also allowed.</li>
                      <li>Return to SAT Mobile and press Recheck.</li>
                    </ol>
                  ) : (
                    <ol className="list-decimal list-inside space-y-1 text-red-800">
                      <li><span className="font-semibold">Chrome / Edge (Desktop):</span> Click the lock icon, then Site Settings, then Notifications, then Allow, then Reload.</li>
                      <li><span className="font-semibold">Chrome (Android):</span> Tap the lock icon in the address bar, then Permissions, then Notifications, then Allow, then Reload.</li>
                      <li><span className="font-semibold">Safari (iOS 16.4+):</span> Add the site to Home Screen first, open the installed app, then use iOS Settings, Notifications, app name, Allow.</li>
                      <li><span className="font-semibold">Safari (macOS):</span> Safari, Settings, Websites, Notifications, then Allow for this site.</li>
                      <li><span className="font-semibold">Firefox:</span> Click the shield or lock icon, then Permissions, then re-enable notifications.</li>
                    </ol>
                  )}
                  <p className="text-xs text-red-600">After changing the setting, come back and press Recheck below.</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {!isNativeApp && (
                      <button
                        onClick={() => { localStorage.setItem('forcePushSupport', 'true'); checkPushNotificationStatus(); }}
                        className="px-3 py-1.5 text-xs rounded-md bg-white border border-red-300 text-red-700 hover:bg-red-100"
                      >Force Recheck</button>
                    )}
                    <button
                      onClick={checkPushNotificationStatus}
                      className="px-3 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-700"
                    >Recheck</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : !isInitialized ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-blue-100">
              <Bell className="w-8 h-8 text-blue-600" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">Enable Notifications</h4>
            <p className="text-gray-500 max-w-sm mx-auto mb-6">
              Get instant phone or browser alerts when important activities happen in SAT Mobile.
            </p>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-6 max-w-sm mx-auto">
              <h5 className="font-medium text-gray-900 mb-3">You will be notified about:</h5>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>New members added by leaders</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Attendance confirmations</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>New believers and guests</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Important updates</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleEnablePushNotifications}
              disabled={isLoading}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transform"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Setting up...</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  <span>Enable Notifications</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-[24px] bg-gradient-to-r from-green-50 to-blue-50 p-5">
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-green-100">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-1">Notifications are active</h4>
                  <p className="text-sm text-gray-600 mb-3">
                     You will receive SAT Mobile alerts on this device when activities happen in your church.
                  </p>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    {getPlatformIcon()}
                    <span>{getPlatformLabel()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] bg-gray-50 p-5">
              <h5 className="font-medium text-gray-700 mb-2">Privacy & Control</h5>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Notifications are only sent for activities related to your church</p>
                <p>You can disable notifications anytime in system or browser settings</p>
                <p>No personal data is included in notification content</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PushNotificationSettings;
