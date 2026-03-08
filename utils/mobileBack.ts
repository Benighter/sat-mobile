import { Capacitor, type PluginListenerHandle, registerPlugin } from '@capacitor/core';

type NativeBackButtonEvent = {
  canGoBack: boolean;
};

type BackInterceptSource = 'button' | 'gesture' | 'hardware' | 'native' | 'browser';

interface AppPlugin {
  addListener(
    eventName: 'backButton',
    listenerFunc: (event: NativeBackButtonEvent) => void,
  ): Promise<PluginListenerHandle> | PluginListenerHandle;
  exitApp(): Promise<void>;
}

interface AppShellPlugin {
  exitApp(): Promise<void>;
}

const NativeApp = registerPlugin<AppPlugin>('App');
const NativeAppShell = registerPlugin<AppShellPlugin>('AppShell');

export const APP_BACK_INTERCEPT_EVENT = 'sat-mobile:back-intercept';

export const dispatchBackIntercept = (source: BackInterceptSource): boolean => {
  const event = new CustomEvent(APP_BACK_INTERCEPT_EVENT, {
    cancelable: true,
    detail: { source },
  });

  return !document.dispatchEvent(event);
};

export const addNativeBackButtonListener = async (
  listener: (event: NativeBackButtonEvent) => void,
): Promise<PluginListenerHandle | null> => {
  const isAndroidNative =
    typeof Capacitor.isNativePlatform === 'function' &&
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'android';

  if (!isAndroidNative) {
    return null;
  }

  try {
    return await NativeApp.addListener('backButton', listener);
  } catch {
    return null;
  }
};

export const exitNativeApp = async (): Promise<boolean> => {
  try {
    await NativeAppShell.exitApp();
    return true;
  } catch {
    try {
      await NativeApp.exitApp();
      return true;
    } catch {
      try {
        window.close();
        return true;
      } catch {
        return false;
      }
    }
  }
};