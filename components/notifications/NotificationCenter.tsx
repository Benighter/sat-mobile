import React, { useState, useEffect } from 'react';
import { stopNotificationSound } from '../../services/notificationSound';
import { Bell, Check, CheckCheck, X, User, Users, UserPlus, Calendar, Heart, Home, Trash2, Clock, Sparkles, Snowflake, Repeat, Cake } from 'lucide-react';
import { AdminNotification, NotificationActivityType } from '../../types';
import { notificationService } from '../../services/notificationService';
import { useAppContext } from '../../contexts/FirebaseAppContext';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [markingAsRead, setMarkingAsRead] = useState<string | null>(null);
  const { userProfile, showToast } = useAppContext();

  useEffect(() => {
    if (isOpen && userProfile?.uid) {
      loadNotifications();
    }
  }, [isOpen, userProfile?.uid]);

  // Stop any playing notification sound when the center is opened
  useEffect(() => {
    if (isOpen) {
      try { stopNotificationSound(); } catch { /* ignore */ }
    }
  }, [isOpen]);

  // Handle clicking outside to close modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isOpen && target.closest('.notification-modal') === null) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const loadNotifications = async () => {
    if (!userProfile?.uid) return;
    
    try {
      setLoading(true);
      const notificationList = await notificationService.getForAdmin(userProfile.uid);
      setNotifications(notificationList);
    } catch (error: any) {
      console.error('Failed to load notifications:', error);
      showToast('error', 'Error', 'Failed to load notifications');
      setNotifications([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      setMarkingAsRead(notificationId);
      await notificationService.markAsRead(notificationId);
      
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, isRead: true }
            : notification
        )
      );
    } catch (error: any) {
      showToast('error', 'Error', 'Failed to mark notification as read');
    } finally {
      setMarkingAsRead(null);
    }
  };

  const markAllAsRead = async () => {
    if (!userProfile?.uid) return;
    
    try {
      await notificationService.markAllAsRead(userProfile.uid);
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, isRead: true }))
      );
      showToast('success', 'Success', 'All notifications marked as read');
    } catch (error: any) {
      showToast('error', 'Error', 'Failed to mark all notifications as read');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await notificationService.delete(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      showToast('success', 'Success', 'Notification deleted');
    } catch (error: any) {
      showToast('error', 'Error', 'Failed to delete notification');
    }
  };

  const getActivityIcon = (activityType: NotificationActivityType) => {
    switch (activityType) {
      case 'member_added':
        return (
          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg">
            <UserPlus className="w-5 h-5 text-white" />
          </div>
        );
      case 'member_updated':
        return (
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
            <User className="w-5 h-5 text-white" />
          </div>
        );
      case 'member_deleted':
        return (
          <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center shadow-lg">
            <User className="w-5 h-5 text-white" />
          </div>
        );
      case 'attendance_confirmed':
        return (
          <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
            <Check className="w-5 h-5 text-white" />
          </div>
        );
      case 'attendance_updated':
        return (
          <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-lg">
            <Calendar className="w-5 h-5 text-white" />
          </div>
        );
      case 'new_believer_added':
        return (
          <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-pink-600 rounded-full flex items-center justify-center shadow-lg">
            <Heart className="w-5 h-5 text-white" />
          </div>
        );
      case 'new_believer_updated':
        return (
          <div className="w-10 h-10 bg-gradient-to-br from-pink-300 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
            <Heart className="w-5 h-5 text-white" />
          </div>
        );
      case 'guest_added':
        return (
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
            <Users className="w-5 h-5 text-white" />
          </div>
        );
      case 'bacenta_assignment_changed':
        return (
          <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center shadow-lg">
            <Home className="w-5 h-5 text-white" />
          </div>
        );
      case 'member_freeze_toggled':
        return (
          <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-sky-600 rounded-full flex items-center justify-center shadow-lg">
            <Snowflake className="w-5 h-5 text-white" />
          </div>
        );
      case 'member_converted':
        return (
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg">
            <Repeat className="w-5 h-5 text-white" />
          </div>
        );
      case 'birthday_reminder':
        return (
          <div className="w-10 h-10 bg-gradient-to-br from-rose-400 to-rose-600 rounded-full flex items-center justify-center shadow-lg">
            <Cake className="w-5 h-5 text-white" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center shadow-lg">
            <Bell className="w-5 h-5 text-white" />
          </div>
        );
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - notificationTime.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return notificationTime.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
      <div className="notification-modal bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col overflow-hidden transform transition-all duration-300 ease-out animate-in slide-in-from-top-4">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <Bell className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Notifications</h2>
                <p className="text-blue-100 text-sm">Stay updated with leader activities</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-all duration-200 group"
            >
              <X className="w-5 h-5 text-white group-hover:rotate-90 transition-transform duration-200" />
            </button>
          </div>

          {unreadCount > 0 && (
            <div className="absolute -bottom-3 left-6">
              <div className="bg-red-500 text-white text-sm font-bold rounded-full px-3 py-1 shadow-lg animate-pulse">
                {unreadCount} new
              </div>
            </div>
          )}

          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white bg-opacity-10 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-white bg-opacity-10 rounded-full translate-y-10 -translate-x-10"></div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-purple-50 border-b flex items-center justify-between space-x-4">
          <div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center space-x-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-all duration-200 hover:scale-105 group"
              >
                <CheckCheck className="w-4 h-4 group-hover:rotate-12 transition-transform duration-200" />
                <span>Mark all as read</span>
                <Sparkles className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {!showClearConfirm ? (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-sm text-red-600 hover:text-red-700 transition-all duration-200 px-3 py-2 bg-white border border-red-100 rounded-md shadow-sm hover:scale-105"
                title="Clear all notifications"
              >
                Clear all
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Confirm?</span>
                <button
                  onClick={async () => {
                    if (!userProfile?.uid) return;
                    try {
                      setClearingAll(true);
                      await notificationService.clearAll(userProfile.uid);
                      setNotifications([]);
                      showToast('success', 'Success', 'All notifications cleared');
                    } catch (error: any) {
                      console.error(error);
                      showToast('error', 'Error', 'Failed to clear notifications');
                    } finally {
                      setClearingAll(false);
                      setShowClearConfirm(false);
                    }
                  }}
                  disabled={clearingAll}
                  className="text-sm text-white bg-red-600 hover:bg-red-700 px-3 py-2 rounded-md shadow-sm disabled:opacity-50"
                >
                  {clearingAll ? 'Clearing...' : 'Yes'}
                </button>

                <button
                  onClick={() => setShowClearConfirm(false)}
                  disabled={clearingAll}
                  className="text-sm text-gray-600 bg-white px-3 py-2 rounded-md border border-gray-100 shadow-sm hover:scale-105 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200"></div>
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent absolute top-0 left-0"></div>
              </div>
              <p className="text-gray-500 text-sm mt-4 animate-pulse">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mb-4">
                <Bell className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">All caught up!</h3>
              <p className="text-sm text-center max-w-xs">No notifications yet. Leader activities will appear here when they happen.</p>
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {notifications.map((notification, index) => (
                <div
                  key={notification.id}
                  className={`relative bg-white rounded-xl shadow-sm border transition-all duration-300 hover:shadow-md hover:scale-[1.02] group ${
                    !notification.isRead
                      ? 'border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={{
                    animationDelay: `${index * 50}ms`
                  }}
                >
                  {/* Unread indicator */}
                  {!notification.isRead && (
                    <div className="absolute -left-1 top-4 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  )}

                  <div className="p-4">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        {getActivityIcon(notification.activityType)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 leading-relaxed mb-1">
                              {notification.details.description}
                            </p>

                            <div className="flex items-center space-x-2 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              <span>{getTimeAgo(notification.timestamp)}</span>
                              <span className="text-gray-300">•</span>
                              <span className="font-medium text-gray-600">{notification.leaderName}</span>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            {!notification.isRead && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                disabled={markingAsRead === notification.id}
                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-all duration-200 disabled:opacity-50 hover:scale-110"
                                title="Mark as read"
                              >
                                {markingAsRead === notification.id ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-600 border-t-transparent"></div>
                                ) : (
                                  <Check className="w-3 h-3" />
                                )}
                              </button>
                            )}

                            <button
                              onClick={() => deleteNotification(notification.id)}
                              className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-all duration-200 hover:scale-110"
                              title="Delete notification"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Additional metadata */}
                        {notification.metadata?.attendanceCount && (
                          <div className="mt-3 inline-flex items-center space-x-1 text-xs font-medium text-purple-700 bg-purple-100 rounded-full px-2 py-1">
                            <Users className="w-3 h-3" />
                            <span>{notification.metadata.attendanceCount} members</span>
                          </div>
                        )}

                        {notification.metadata?.changes && (
                          <div className="mt-3 inline-flex items-center space-x-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full px-2 py-1">
                            <Sparkles className="w-3 h-3" />
                            <span>{notification.metadata.changes.length} changes</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-t text-center">
          <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span>Live updates from your linked leaders</span>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;