import React, { useState, useEffect } from 'react';
import { ExclamationTriangleIcon, WifiIcon } from '../icons';

const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineMessage(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineMessage(true);
    };

    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also listen for Firebase-specific offline events
    const handleFirebaseOffline = () => {
      if (navigator.onLine) {
        // Network is available but Firebase is offline
        setShowOfflineMessage(true);
      }
    };

    // Check initial state
    if (!navigator.onLine) {
      setShowOfflineMessage(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-hide the message after 10 seconds if back online
  useEffect(() => {
    if (isOnline && showOfflineMessage) {
      const timer = setTimeout(() => {
        setShowOfflineMessage(false);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [isOnline, showOfflineMessage]);

  if (!showOfflineMessage) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-2 text-sm font-medium shadow-lg">
      <div className="flex items-center justify-center space-x-2">
        {isOnline ? (
          <>
            <ExclamationTriangleIcon className="w-4 h-4" />
            <span>Connection issues detected. Some features may not work properly.</span>
          </>
        ) : (
          <>
            <WifiIcon className="w-4 h-4" />
            <span>You're offline. The app will sync when connection is restored.</span>
          </>
        )}
        <button
          onClick={() => setShowOfflineMessage(false)}
          className="ml-4 text-yellow-100 hover:text-white"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default OfflineIndicator;
