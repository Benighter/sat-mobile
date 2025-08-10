import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Smartphone, Globe, Check, AlertCircle, Settings, TestTube, CheckCircle } from 'lucide-react';
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
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const { showToast } = useAppContext();

  useEffect(() => {
    checkPushNotificationStatus();
  }, []);

  const checkPushNotificationStatus = async () => {
    try {
      setIsLoading(true);
      
      // Check if push notifications are supported
      const supported = await pushNotificationHelpers.isSupported();
      setIsSupported(supported);
      try {
        // Direct access to diagnostics (optional chain if service not yet exported)
        const d: any = (pushNotificationService as any).getSupportDiagnostics?.();
        if (d) setDiagnostics(d);
      } catch {}

      if (supported) {
        // Check current permission status
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
      
      // Request permissions
      const granted = await pushNotificationHelpers.requestPermissions();
      
      if (granted) {
        // Initialize push notifications
        const initialized = await pushNotificationHelpers.initialize();
        
        if (initialized) {
          setIsInitialized(true);
          setPermissionStatus('granted');
          showToast('success', 'Success', 'Push notifications enabled successfully! 🎉');
        } else {
          showToast('error', 'Error', 'Failed to initialize push notifications');
        }
      } else {
        setPermissionStatus('denied');
        showToast('error', 'Permission Denied', 'Push notifications require permission to work');
      }
    } catch (error) {
      console.error('Failed to enable push notifications:', error);
      showToast('error', 'Error', 'Failed to enable push notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);
      
      const success = await pushNotificationHelpers.sendTestNotification();
      
      if (success) {
        setTestResult('success');
        showToast('success', 'Test Sent', 'Check your device for the test notification!');
      } else {
        setTestResult('error');
        showToast('error', 'Test Failed', 'Failed to send test notification');
      }
    } catch (error) {
      console.error('Failed to send test notification:', error);
      setTestResult('error');
      showToast('error', 'Error', 'Failed to send test notification');
    } finally {
      setIsTesting(false);
      // Clear test result after 5 seconds
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const getPlatformIcon = () => {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      return <Smartphone className="w-5 h-5 text-blue-600" />;
    }
    return <Globe className="w-5 h-5 text-blue-600" />;
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
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          <span className="text-gray-600">Loading notification settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Push Notifications</h3>
              <p className="text-sm text-gray-500">Get notified even when the app is closed</p>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {!isSupported ? (
          // Not supported
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BellOff className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">Push notifications not supported</h4>
            <p className="text-gray-500 max-w-sm mx-auto">
              We couldn't verify full push support. You can still attempt to enable notifications below.
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
              <button
                onClick={() => { localStorage.setItem('forcePushSupport','true'); checkPushNotificationStatus(); }}
                className="text-xs text-blue-600 hover:underline"
              >Force support & recheck</button>
            </div>
          </div>
        ) : permissionStatus === 'denied' ? (
          // Permission denied
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BellOff className="w-8 h-8 text-red-500" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">Notifications blocked</h4>
            <p className="text-gray-500 max-w-sm mx-auto mb-4">
              You've blocked notifications for this site. To enable them, click the lock icon in your browser's address bar and allow notifications.
            </p>
            <button
              onClick={checkPushNotificationStatus}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Check Again</span>
            </button>
          </div>
        ) : !isInitialized ? (
          // Not enabled - show enable option
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-blue-600" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">Enable Push Notifications</h4>
            <p className="text-gray-500 max-w-sm mx-auto mb-6">
              Get instant notifications on your device when important activities happen, even when the app is closed.
            </p>
            
            {/* Features list */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-6 max-w-sm mx-auto">
              <h5 className="font-medium text-gray-900 mb-3">You'll be notified about:</h5>
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
          // Enabled - show status and test option
          <div className="space-y-6">
            {/* Status info */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-1">Notifications are active</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    You'll receive push notifications on this device when activities happen in your church.
                  </p>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    {getPlatformIcon()}
                    <span>
                      {navigator.userAgent.includes('Mobile') || navigator.userAgent.includes('Android') || navigator.userAgent.includes('iPhone') 
                        ? 'Mobile Device' 
                        : 'Desktop Browser'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Test notification */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-medium text-gray-900">Test Notifications</h5>
                  <p className="text-sm text-gray-500">Send a test notification to verify everything works</p>
                </div>
                <button
                  onClick={handleTestNotification}
                  disabled={isTesting}
                  className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                    testResult === 'success' 
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : testResult === 'error'
                      ? 'bg-red-100 text-red-700 border border-red-200'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isTesting ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                      <span>Sending...</span>
                    </>
                  ) : testResult === 'success' ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Sent!</span>
                    </>
                  ) : testResult === 'error' ? (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      <span>Failed</span>
                    </>
                  ) : (
                    <>
                      <TestTube className="w-4 h-4" />
                      <span>Send Test</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Privacy note */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h5 className="font-medium text-gray-700 mb-2">Privacy & Control</h5>
              <div className="text-sm text-gray-600 space-y-1">
                <p>• Notifications are only sent for activities related to your church</p>
                <p>• You can disable notifications anytime in your browser settings</p>
                <p>• No personal data is included in notification content</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PushNotificationSettings;
