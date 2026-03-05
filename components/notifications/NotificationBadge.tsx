import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { notificationService, setNotificationContext } from '../../services/notificationService';
import { startNotificationSound, stopNotificationSound } from '../../services/notificationSound';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { hasLeaderPrivileges } from '../../utils/permissionUtils';
import NotificationCenter from './NotificationCenter';

const NotificationBadge: React.FC = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { userProfile, currentChurchId } = useAppContext();

  // Show notification badge for leaders and admins
  const isLeader = hasLeaderPrivileges(userProfile);

  useEffect(() => {
  if (!isLeader || !userProfile?.uid || !currentChurchId) {
      setUnreadCount(0);
      return;
    }

    // Set notification context
    setNotificationContext(userProfile, currentChurchId);

    // Load initial unread count
    loadUnreadCount();

    // Set up real-time listener for notifications
    let unsubscribe: (() => void) | null = null;
    
    try {
      let previousUnread = 0;
      let initialized = false;
      unsubscribe = notificationService.onSnapshot(
        userProfile.uid,
        (notifications) => {
          const unread = notifications.filter(n => !n.isRead).length;
          if (!initialized) {
            // Set baseline without sound on first snapshot
            initialized = true;
          } else {
            // Play sound when unread count increases (new notification)
            if (unread > previousUnread) {
              startNotificationSound(3000); // auto stops after ~3s
            }
          }
          previousUnread = unread;
          setUnreadCount(unread);
        }
      );
    } catch (error) {
      console.error('Failed to set up notification listener:', error);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isLeader, userProfile?.uid, currentChurchId]);

  const loadUnreadCount = async () => {
  if (!userProfile?.uid || !currentChurchId) return;

    try {
      setLoading(true);
      const count = await notificationService.getUnreadCount(userProfile.uid);
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
      setUnreadCount(0); // Reset to 0 on error
    } finally {
      setLoading(false);
    }
  };

  const handleBadgeClick = () => {
  // Stop any playing sound once the bell is opened
  stopNotificationSound();
    setIsNotificationCenterOpen(true);
  };

  // Don't render if user is not a leader/admin
  if (!isLeader) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleBadgeClick}
        aria-label="Notifications"
        className="relative inline-flex items-center justify-center w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 rounded-full text-gray-700 hover:text-gray-900 transition-transform duration-200 hover:scale-110 group touch-manipulation bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/40 shadow-sm hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50"
      >
        {/* Soft glow when there are notifications */}
        {unreadCount > 0 && (
          <span className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 opacity-20 animate-pulse pointer-events-none" />
        )}

        <Bell className="w-5 h-5 sm:w-5 sm:h-5 group-hover:animate-pulse" />

        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span
            className="absolute top-0 right-0 translate-x-1/4 -translate-y-1/4 xs:translate-x-1/3 xs:-translate-y-1/3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-full min-w-[18px] h-[18px] xs:min-w-[20px] xs:h-[20px] sm:min-w-[20px] sm:h-[20px] px-1 flex items-center justify-center text-[10px] xs:text-xs font-bold shadow-lg ring-2 ring-white"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* Loading indicator (tiny dot) when fetching */}
        {loading && unreadCount === 0 && (
          <span className="absolute top-0 right-0 translate-x-1/4 -translate-y-1/4 w-3 h-3 xs:w-3.5 xs:h-3.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse shadow" />
        )}
      </button>

      {/* Notification Center Modal */}
      <NotificationCenter
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
      />
    </>
  );
};

export default NotificationBadge;