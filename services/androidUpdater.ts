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

export type AndroidUpdateCheckKind = 'updateAvailable' | 'upToDate' | 'error';

export interface AndroidUpdateCheckStatus {
  checkedAt: string;
  kind: AndroidUpdateCheckKind;
  installedVersionCode?: number;
  installedVersionName?: string;
  latestVersionCode?: number;
  latestVersionName?: string;
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
export const ANDROID_UPDATE_CHECK_STATUS_EVENT = 'sat-mobile:android-update-check-status';
export const CURRENT_APP_VERSION = __APP_VERSION__;

const ANDROID_UPDATE_CHECK_STORAGE_KEY = 'sat-mobile:android-update-check-status';

const isAndroidUpdateCheckStatus = (value: unknown): value is AndroidUpdateCheckStatus => {
  if (!value || typeof value !== 'object') return false;
  const status = value as Partial<AndroidUpdateCheckStatus>;
  return typeof status.checkedAt === 'string'
    && (status.kind === 'updateAvailable' || status.kind === 'upToDate' || status.kind === 'error');
};

export const getLastAndroidUpdateCheck = (): AndroidUpdateCheckStatus | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(ANDROID_UPDATE_CHECK_STORAGE_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return isAndroidUpdateCheckStatus(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const saveAndroidUpdateCheck = (status: AndroidUpdateCheckStatus): AndroidUpdateCheckStatus => {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ANDROID_UPDATE_CHECK_STORAGE_KEY, JSON.stringify(status));
    } catch {
      // The in-memory event still updates an open Settings screen when storage is unavailable.
    }
    window.dispatchEvent(new CustomEvent<AndroidUpdateCheckStatus>(ANDROID_UPDATE_CHECK_STATUS_EVENT, { detail: status }));
  }
  return status;
};

export const recordAndroidUpdateCheckResult = (result: AndroidUpdateInfo): AndroidUpdateCheckStatus =>
  saveAndroidUpdateCheck({
    checkedAt: new Date().toISOString(),
    kind: result.available ? 'updateAvailable' : 'upToDate',
    installedVersionCode: result.installedVersionCode,
    installedVersionName: result.installedVersionName,
    latestVersionCode: result.versionCode,
    latestVersionName: result.versionName,
  });

export const recordAndroidUpdateCheckError = (): AndroidUpdateCheckStatus =>
  saveAndroidUpdateCheck({
    checkedAt: new Date().toISOString(),
    kind: 'error',
  });

export const announceAndroidUpdate = (update: AndroidUpdateInfo): void => {
  if (typeof window === 'undefined' || !update.available) return;
  window.dispatchEvent(new CustomEvent<AndroidUpdateInfo>(ANDROID_UPDATE_AVAILABLE_EVENT, { detail: update }));
};

export const isSelfHostedAndroidApp = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export const androidUpdater = AndroidUpdater;
