// Service Worker for Ministry App Push Notifications
// This file handles push notifications for the Ministry app

// Import Firebase Messaging SW scripts
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker for MINISTRY project
// NOTE: Replace the placeholders with your Ministry Firebase project's config
const firebaseConfig = {
  apiKey: self.MINISTRY_FB_API_KEY || "REPLACE_WITH_MINISTRY_API_KEY",
  authDomain: self.MINISTRY_FB_AUTH_DOMAIN || "REPLACE_WITH_MINISTRY_AUTH_DOMAIN",
  projectId: self.MINISTRY_FB_PROJECT_ID || "REPLACE_WITH_MINISTRY_PROJECT_ID",
  storageBucket: self.MINISTRY_FB_STORAGE_BUCKET || "REPLACE_WITH_MINISTRY_STORAGE_BUCKET",
  messagingSenderId: self.MINISTRY_FB_MESSAGING_SENDER_ID || "REPLACE_WITH_MINISTRY_SENDER_ID",
  appId: self.MINISTRY_FB_APP_ID || "REPLACE_WITH_MINISTRY_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw-ministry.js] Received background message ', payload);

  const notificationTitle = payload.notification?.title || 'Ministry App';
  const notificationOptions = {
    body: payload.notification?.body || 'New notification',
    icon: payload.notification?.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'ministry-app-notification',
    data: {
      ...payload.data,
      url: payload.data?.deepLink || '/ministry.html#/notifications'
    },
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Open App', icon: '/icon-192.png' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw-ministry.js] Notification click received.');
  event.notification.close();
  if (event.action === 'dismiss') return;
  const urlToOpen = event.notification.data?.url || '/ministry.html#/notifications';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', url: urlToOpen, data: event.notification.data });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(self.location.origin + urlToOpen);
      }
    })
  );
});

self.addEventListener('install', function() {
  console.log('[firebase-messaging-sw-ministry.js] Service worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[firebase-messaging-sw-ministry.js] Service worker activating...');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
