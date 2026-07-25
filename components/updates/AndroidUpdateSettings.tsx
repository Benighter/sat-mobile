import React, { useState } from 'react';
import { CheckCircle2, RefreshCw, Smartphone } from 'lucide-react';
import Button from '../ui/Button';
import {
  announceAndroidUpdate,
  androidUpdater,
  isSelfHostedAndroidApp,
} from '../../services/androidUpdater';

type CheckStatus =
  | { kind: 'idle'; message: string }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

const AndroidUpdateSettings: React.FC = () => {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<CheckStatus>({
    kind: 'idle',
    message: 'SAT Mobile also checks automatically shortly after every app start.',
  });

  if (!isSelfHostedAndroidApp()) return null;

  const checkNow = async () => {
    setChecking(true);
    setStatus({ kind: 'idle', message: 'Contacting the secure update channel…' });

    try {
      const result = await androidUpdater.checkForUpdate();
      if (result.available) {
        setStatus({ kind: 'success', message: `Version ${result.versionName} is ready to install.` });
        announceAndroidUpdate(result);
      } else {
        setStatus({
          kind: 'success',
          message: `You are up to date (version ${result.installedVersionName || result.installedVersionCode}).`,
        });
      }
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'The update service could not be reached. Please try again later.';
      setStatus({ kind: 'error', message });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-100 bg-gradient-to-r from-sky-50/60 to-indigo-50/60 p-6 shadow-xs dark:border-dark-700/60 dark:from-sky-950/10 dark:to-indigo-950/10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-dark-100">App updates</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-dark-400">
                Check the signed SAT Mobile release channel without waiting for Google Play.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => void checkNow()}
            loading={checking}
            leftIcon={<RefreshCw className="h-4 w-4" />}
            className="shrink-0"
          >
            Check for updates
          </Button>
        </div>

        <div
          aria-live="polite"
          className={`mt-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            status.kind === 'error'
              ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'
              : status.kind === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300'
                : 'border-slate-200 bg-white/80 text-slate-600 dark:border-dark-600 dark:bg-dark-700/70 dark:text-dark-300'
          }`}
        >
          {status.kind === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{status.message}</span>
        </div>
      </div>

      <p className="px-1 text-xs leading-relaxed text-slate-500 dark:text-dark-400">
        Updates are optional. SAT Mobile verifies the download, app identity, version, and signing certificate before Android asks you to install it.
      </p>
    </div>
  );
};

export default AndroidUpdateSettings;
