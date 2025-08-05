import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { notificationService, setNotificationContext } from '../services/notificationService';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { hasAdminPrivileges } from '../utils/permissionUtils';
import NotificationCenter from './NotificationCenter';

const NotificationBadge: React.FC = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { userProfile, currentChurchId } = useAppContext();

  // Only show notification badge for admins
  const isAdmin = hasAdminPrivileges(userProfile);

  useEffect(() => {
    if (!isAdmin || !userProfile?.uid || !currentChurchId) {
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
      unsubscribe = notificationService.onSnapshot(
        userProfile.uid,
        (notifications) => {
          const unread = notifications.filter(n => !n.isRead).length;
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
  }, [isAdmin, userProfile?.uid, currentChurchId]);

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
    setIsNotificationCenterOpen(true);
  };

  // Don't render if user is not an admin
  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleBadgeClick}
        className="relative p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 rounded-xl transition-all duration-300 hover:scale-110 group"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 group-hover:animate-pulse" />

        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full min-w-[20px] h-[20px] flex items-center justify-center font-bold shadow-lg animate-bounce">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* Loading indicator */}
        {loading && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse shadow-lg"></span>
        )}

        {/* Subtle glow effect when there are notifications */}
        {unreadCount > 0 && (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-xl opacity-20 animate-pulse"></div>
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