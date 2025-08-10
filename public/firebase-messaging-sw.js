// Service Worker for SAT Mobile Push Notifications
// This file handles push notifications when the app is not active

// Import Firebase Messaging SW scripts
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
const firebaseConfig = {
  apiKey: "AIzaSyDkyjDhyz_LCbUpRgftD2qo31e5SteAiKg",
  authDomain: "sat-mobile-de6f1.firebaseapp.com",
  projectId: "sat-mobile-de6f1",
  storageBucket: "sat-mobile-de6f1.firebasestorage.app",
  messagingSenderId: "1076014285349",
  appId: "1:1076014285349:web:d72d460aefe5ca8d76b5cc"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  // Customize the notification here
  const notificationTitle = payload.notification?.title || 'SAT Mobile';
  const notificationOptions = {
    body: payload.notification?.body || 'New notification',
    icon: payload.notification?.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'sat-mobile-notification',
    data: {
      ...payload.data,
      url: payload.data?.deepLink || '/#/notifications'
    },
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Open App',
        icon: '/icon-192.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notification click received.');

  event.notification.close();

  if (event.action === 'dismiss') {
    // User dismissed the notification
    return;
  }

  // Default action or 'open' action
  const urlToOpen = event.notification.data?.url || '/#/notifications';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      // Check if the app is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // App is open, focus it and navigate
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            url: urlToOpen,
            data: event.notification.data
          });
          return client.focus();
        }
      }

      // App is not open, open it
      if (clients.openWindow) {
        return clients.openWindow(self.location.origin + urlToOpen);
      }
    })
  );
});

// Handle push event (for additional customization)
self.addEventListener('push', function(event) {
  console.log('[firebase-messaging-sw.js] Push event received.');
  
  if (event.data) {
    const payload = event.data.json();
    console.log('Push payload:', payload);
    
    // Firebase Messaging will handle this automatically,
    // but you can add custom logic here if needed
  }
});

// Service worker installation and activation
self.addEventListener('install', function(event) {
  console.log('[firebase-messaging-sw.js] Service worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[firebase-messaging-sw.js] Service worker activating...');
  event.waitUntil(self.clients.claim());
});

// Handle messages from the main thread
self.addEventListener('message', function(event) {
  console.log('[firebase-messaging-sw.js] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
