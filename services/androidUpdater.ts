import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface AndroidUpdateInfo {
  available: boolean;
  installedVersionCode: number;
  installedVersionName: string;
  versionCode: number;
  versionName: string;
  releaseNotes: string;
  publishedAt: string;
  sizeBytes: number;
}

export interface AndroidUpdateProgress {
  bytesDownloaded: number;
  totalBytes: number;
  percent: number;
}

interface AndroidUpdaterPlugin {
  checkForUpdate(): Promise<AndroidUpdateInfo>;
  downloadAndInstall(): Promise<{ status: 'permissionRequired' | 'installerOpened' }>;
  addListener(
    eventName: 'updateDownloadProgress',
    listener: (progress: AndroidUpdateProgress) => void,
  ): Promise<PluginListenerHandle>;
}

const AndroidUpdater = registerPlugin<AndroidUpdaterPlugin>('AndroidUpdater');

export const ANDROID_UPDATE_AVAILABLE_EVENT = 'sat-mobile:android-update-available';

export const announceAndroidUpdate = (update: AndroidUpdateInfo): void => {
  if (typeof window === 'undefined' || !update.available) return;
  window.dispatchEvent(new CustomEvent<AndroidUpdateInfo>(ANDROID_UPDATE_AVAILABLE_EVENT, { detail: update }));
};

export const isSelfHostedAndroidApp = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export const androidUpdater = AndroidUpdater;
