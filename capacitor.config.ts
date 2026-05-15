import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.benighter.satmobile',
  appName: 'sat-mobile',
  webDir: 'dist',
  android: {
    adjustMarginsForEdgeToEdge: 'force'
  },
  plugins: {
    Filesystem: {
      iosScheme: 'file',
      androidScheme: 'content'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    LocalNotifications: {
      smallIcon: 'ic_notification',
      iconColor: '#334155',
      sound: 'default'
    }
  }
};

export default config;
