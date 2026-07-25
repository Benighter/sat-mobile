import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, ShieldCheck } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import {
  ANDROID_UPDATE_AVAILABLE_EVENT,
  announceAndroidUpdate,
  androidUpdater,
  isSelfHostedAndroidApp,
  type AndroidUpdateInfo,
} from '../../services/androidUpdater';

type UpdateStage = 'available' | 'downloading' | 'permission' | 'error';

const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return '';
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : 'The update could not be installed. Please try again.';

const AndroidUpdatePrompt: React.FC = () => {
  const didCheck = useRef(false);
  const [update, setUpdate] = useState<AndroidUpdateInfo | null>(null);
  const [stage, setStage] = useState<UpdateStage>('available');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isSelfHostedAndroidApp() || didCheck.current) return;
    didCheck.current = true;

    let active = true;
    const timeout = window.setTimeout(async () => {
      try {
        const result = await androidUpdater.checkForUpdate();
        if (active && result.available) {
          announceAndroidUpdate(result);
        }
      } catch {
        // Update checks are deliberately silent when offline or when no release channel exists yet.
      }
    }, 2_500);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const handleUpdateAvailable = (event: Event) => {
      const availableUpdate = (event as CustomEvent<AndroidUpdateInfo>).detail;
      if (!availableUpdate?.available) return;
      setUpdate(availableUpdate);
      setStage('available');
      setProgress(0);
      setError('');
    };

    window.addEventListener(ANDROID_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);
    return () => window.removeEventListener(ANDROID_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);
  }, []);

  useEffect(() => {
    if (!isSelfHostedAndroidApp()) return;

    let disposed = false;
    let listener: { remove: () => Promise<void> } | undefined;
    void androidUpdater.addListener('updateDownloadProgress', (event) => {
      if (!disposed) setProgress(event.percent);
    }).then((handle) => {
      if (disposed) {
        void handle.remove();
      } else {
        listener = handle;
      }
    });

    return () => {
      disposed = true;
      if (listener) void listener.remove();
    };
  }, []);

  const startUpdate = async () => {
    setStage('downloading');
    setProgress(0);
    setError('');

    try {
      const result = await androidUpdater.downloadAndInstall();
      if (result.status === 'permissionRequired') {
        setStage('permission');
        return;
      }
      setUpdate(null);
    } catch (installError) {
      setError(errorMessage(installError));
      setStage('error');
    }
  };

  if (!update) return null;

  const releaseSize = formatBytes(update.sizeBytes);
  return (
    <Modal
      isOpen
      onClose={() => setUpdate(null)}
      size="sm"
      title={stage === 'permission' ? 'Allow app updates' : 'SAT Mobile update'}
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setUpdate(null)} disabled={stage === 'downloading'}>
            Later
          </Button>
          <Button
            onClick={() => void startUpdate()}
            loading={stage === 'downloading'}
            leftIcon={stage === 'permission' ? <ShieldCheck className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          >
            {stage === 'permission' ? 'I allowed it — continue' : stage === 'error' ? 'Try again' : 'Download update'}
          </Button>
        </div>
      )}
    >
      <div className="space-y-4 text-gray-700 dark:text-dark-200">
        {stage === 'permission' ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm">
              Android opened this app&apos;s settings. Turn on <strong>Allow from this source</strong>, return here,
              then continue. This permission only lets SAT Mobile hand a verified APK to Android&apos;s installer.
            </p>
          </div>
        ) : (
          <>
            <div>
              <p className="text-base font-semibold text-gray-900 dark:text-dark-100">
                Version {update.versionName} is available
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-dark-400">
                Installed: {update.installedVersionName || `code ${update.installedVersionCode}`}
                {releaseSize ? ` · Download: ${releaseSize}` : ''}
              </p>
            </div>

            {update.releaseNotes && (
              <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm dark:bg-dark-700">
                {update.releaseNotes}
              </div>
            )}

            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm">
                The download is checked against its SHA-256 digest and the signing certificate already installed on this device.
                Android will ask you to confirm before replacing the app.
              </p>
            </div>
          </>
        )}

        {stage === 'downloading' && (
          <div aria-live="polite">
            <div className="mb-1 flex justify-between text-xs text-gray-500">
              <span>Downloading and verifying…</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full bg-slate-600 transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {stage === 'error' && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default AndroidUpdatePrompt;
