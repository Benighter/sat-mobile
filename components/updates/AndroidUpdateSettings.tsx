import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, Smartphone } from 'lucide-react';
import Button from '../ui/Button';
import {
  ANDROID_UPDATE_CHECK_STATUS_EVENT,
  announceAndroidUpdate,
  androidUpdater,
  CURRENT_APP_VERSION,
  getLastAndroidUpdateCheck,
  isSelfHostedAndroidApp,
  recordAndroidUpdateCheckError,
  recordAndroidUpdateCheckResult,
  type AndroidUpdateCheckStatus,
} from '../../services/androidUpdater';

const formatCheckedAt = (checkedAt: string): string => {
  const value = new Date(checkedAt);
  if (Number.isNaN(value.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
};

const statusMessage = (status: AndroidUpdateCheckStatus | null): string => {
  if (!status) return 'No update check has completed yet.';
  if (status.kind === 'error') return 'The update service could not be reached during the last check.';
  if (status.kind === 'updateAvailable') {
    return `Version ${status.latestVersionName || status.latestVersionCode} is ready to install.`;
  }
  return `You are up to date (version ${status.installedVersionName || status.installedVersionCode || CURRENT_APP_VERSION}).`;
};

const AndroidUpdateSettings: React.FC = () => {
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<AndroidUpdateCheckStatus | null>(() => getLastAndroidUpdateCheck());

  useEffect(() => {
    const handleStatus = (event: Event) => {
      const status = (event as CustomEvent<AndroidUpdateCheckStatus>).detail;
      if (status) setLastCheck(status);
    };
    window.addEventListener(ANDROID_UPDATE_CHECK_STATUS_EVENT, handleStatus);
    return () => window.removeEventListener(ANDROID_UPDATE_CHECK_STATUS_EVENT, handleStatus);
  }, []);

  if (!isSelfHostedAndroidApp()) return null;

  const checkNow = async () => {
    setChecking(true);
    try {
      const result = await androidUpdater.checkForUpdate();
      recordAndroidUpdateCheckResult(result);
      if (result.available) announceAndroidUpdate(result);
    } catch {
      recordAndroidUpdateCheckError();
    } finally {
      setChecking(false);
    }
  };

  const hasSuccessfulCheck = Boolean(lastCheck && lastCheck.kind !== 'error');

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

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-dark-600 dark:bg-dark-700/70">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-dark-400">
              Current version
            </dt>
            <dd className="mt-1 font-semibold text-slate-900 dark:text-dark-100">SAT Mobile {CURRENT_APP_VERSION}</dd>
            {lastCheck?.installedVersionCode && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-dark-400">Build {lastCheck.installedVersionCode}</p>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-dark-600 dark:bg-dark-700/70">
            <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-dark-400">
              <Clock3 className="h-3.5 w-3.5" /> Last checked
            </dt>
            <dd className="mt-1 font-semibold text-slate-900 dark:text-dark-100">
              {lastCheck ? formatCheckedAt(lastCheck.checkedAt) : 'Not checked yet'}
            </dd>
          </div>
        </dl>

        <div
          aria-live="polite"
          className={`mt-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            lastCheck?.kind === 'error'
              ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'
              : hasSuccessfulCheck
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300'
                : 'border-slate-200 bg-white/80 text-slate-600 dark:border-dark-600 dark:bg-dark-700/70 dark:text-dark-300'
          }`}
        >
          {lastCheck?.kind === 'error'
            ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            : hasSuccessfulCheck && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{checking ? 'Contacting the secure update channel…' : statusMessage(lastCheck)}</span>
        </div>
      </div>

      <p className="px-1 text-xs leading-relaxed text-slate-500 dark:text-dark-400">
        SAT Mobile also checks automatically shortly after every app start. Updates are optional, and every download is verified before Android asks you to install it.
      </p>
    </div>
  );
};

export default AndroidUpdateSettings;
