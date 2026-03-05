import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.app',
  appName: 'sat-mobile',
  webDir: 'dist',
  plugins: {
    Filesystem: {
      iosScheme: 'file',
      androidScheme: 'content'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
