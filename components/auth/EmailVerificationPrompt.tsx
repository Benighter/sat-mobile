import React, { useCallback, useEffect, useRef, useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../../firebase.config';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import Button from '../ui/Button';
import { CheckIcon, EnvelopeIcon, RefreshIcon, WarningIcon, XMarkIcon } from '../icons';

type EmailVerificationPromptMode = 'banner' | 'settings';

interface EmailVerificationPromptProps {
  mode?: EmailVerificationPromptMode;
  className?: string;
}

const RESEND_COOLDOWN_MS = 60 * 1000;
const VERIFICATION_RECHECK_INTERVAL_MS = 10 * 1000;

const getLastSentKey = (uid: string) => `sat-email-verification-last-sent-${uid}`;

const readLastSentAt = (uid?: string | null): number | null => {
  if (!uid || typeof window === 'undefined') return null;

  const storedValue = window.localStorage.getItem(getLastSentKey(uid));
  const parsedValue = storedValue ? Number(storedValue) : NaN;
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const writeLastSentAt = (uid: string, value: number) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getLastSentKey(uid), String(value));
};

const getFirebaseErrorToast = (error: any) => {
  const message = String(error?.message || '');

  if (message.includes('ERR_BLOCKED_BY_CLIENT')) {
    return {
      type: 'warning' as const,
      title: 'Request Blocked',
      message: 'A browser or device filter blocked a Firebase request. Disable blockers for SAT Mobile and try again.'
    };
  }

  switch (error?.code) {
    case 'auth/too-many-requests':
      return {
        type: 'warning' as const,
        title: 'Please Wait',
        message: 'Firebase is limiting verification emails for now. Try again in a few minutes.'
      };
    case 'auth/network-request-failed':
      return {
        type: 'error' as const,
        title: 'Network Error',
        message: 'Check your connection and try again.'
      };
    case 'auth/user-token-expired':
      return {
        type: 'error' as const,
        title: 'Session Expired',
        message: 'Please sign in again before sending a verification email.'
      };
    default:
      return {
        type: 'error' as const,
        title: 'Verification Failed',
        message: error?.message || 'Could not update your email verification status.'
      };
  }
};

const EmailVerificationPrompt: React.FC<EmailVerificationPromptProps> = ({ mode = 'banner', className = '' }) => {
  const { user, showToast, refreshUserProfile } = useAppContext();
  const [dismissed, setDismissed] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(true);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const autoCheckInFlightRef = useRef(false);
  const verifiedToastShownRef = useRef(false);

  const syncVerificationState = useCallback(() => {
    const firebaseUser = auth.currentUser;
    const nextEmail = firebaseUser?.email || user?.email || null;
    const nextVerified = firebaseUser ? firebaseUser.emailVerified : user?.emailVerified === true;
    const nextUid = firebaseUser?.uid || user?.uid;

    setEmail(nextEmail);
    setIsVerified(Boolean(nextVerified));
    setLastSentAt(readLastSentAt(nextUid));
  }, [user?.email, user?.emailVerified, user?.uid]);

  useEffect(() => {
    syncVerificationState();
    setDismissed(false);
  }, [syncVerificationState]);

  const rememberSentAt = (uid: string, value: number) => {
    writeLastSentAt(uid, value);
    setLastSentAt(value);
  };

  const refreshVerificationStatus = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      if (!silent) {
        showToast('error', 'Session Unavailable', 'Please sign in again to refresh your verification status.');
      }
      return false;
    }

    if (autoCheckInFlightRef.current) {
      return false;
    }

    autoCheckInFlightRef.current = true;
    if (!silent) {
      setIsChecking(true);
    }

    try {
      await firebaseUser.reload();
      const verified = auth.currentUser?.emailVerified === true;

      syncVerificationState();

      if (verified) {
        setDismissed(true);
        setIsVerified(true);
        await refreshUserProfile();

        if (!silent || !verifiedToastShownRef.current) {
          showToast('success', 'Email Verified', 'Thanks, your account email is now verified.');
          verifiedToastShownRef.current = true;
        }
      } else if (!silent) {
        showToast('info', 'Still Unverified', 'After opening the email link, return to the app. We will keep checking automatically.');
      }

      return verified;
    } catch (error: any) {
      if (!silent) {
        const toast = getFirebaseErrorToast(error);
        showToast(toast.type, toast.title, toast.message);
      }
      return false;
    } finally {
      autoCheckInFlightRef.current = false;
      if (!silent) {
        setIsChecking(false);
      }
    }
  }, [refreshUserProfile, showToast, syncVerificationState]);

  useEffect(() => {
    if (mode !== 'banner' || !user || !email || isVerified) {
      return;
    }

    const runSilentCheck = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      void refreshVerificationStatus({ silent: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runSilentCheck();
      }
    };

    const intervalId = window.setInterval(runSilentCheck, VERIFICATION_RECHECK_INTERVAL_MS);
    window.addEventListener('focus', runSilentCheck);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', runSilentCheck);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [email, isVerified, mode, refreshVerificationStatus, user]);

  const handleResendVerification = async () => {
    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      showToast('error', 'Session Unavailable', 'Please sign in again before sending a verification email.');
      return;
    }

    if (!firebaseUser.email) {
      showToast('error', 'No Email Address', 'This account does not have an email address that Firebase can verify.');
      return;
    }

    setIsSending(true);
    try {
      if (firebaseUser.emailVerified) {
        syncVerificationState();
        showToast('success', 'Email Already Verified', 'Your account email is already verified.');
        return;
      }

      const storedLastSentAt = readLastSentAt(firebaseUser.uid);
      const mostRecentSend = Math.max(storedLastSentAt || 0, lastSentAt || 0);
      const elapsedMs = Date.now() - mostRecentSend;

      if (mostRecentSend && elapsedMs < RESEND_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsedMs) / 1000);
        showToast('warning', 'Please Wait', `You can request another verification email in ${waitSeconds} seconds.`);
        return;
      }

      await sendEmailVerification(firebaseUser);
      rememberSentAt(firebaseUser.uid, Date.now());
      showToast('success', 'Verification Email Sent', `Check ${firebaseUser.email}. If it is not in your inbox, check Spam or Promotions.`);
    } catch (error: any) {
      if (error?.code === 'auth/too-many-requests') {
        rememberSentAt(firebaseUser.uid, Date.now());
      }
      const toast = getFirebaseErrorToast(error);
      showToast(toast.type, toast.title, toast.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleRecheckVerification = async () => {
    await refreshVerificationStatus();
  };

  if (!user) {
    return null;
  }

  if (mode === 'banner' && (dismissed || (email && isVerified))) {
    return null;
  }

  const statusLabel = !email ? 'No Email' : isVerified ? 'Verified' : 'Unverified';
  const statusClasses = !email
    ? 'bg-gray-100 text-gray-700 border-gray-200'
    : isVerified
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-amber-100 text-amber-800 border-amber-200';
  const canSendVerification = Boolean(email && !isVerified && !isSending && !isChecking);

  const message = !email
    ? 'This account does not have an email address that Firebase can verify.'
    : isVerified
      ? 'Your account email is verified for SAT Mobile notifications, birthday reminders, and other important account messages.'
      : 'Verify your email so SAT Mobile can send notifications, birthday reminders, and important account messages. If you do not see the email, check Spam or Promotions. After clicking the link, return to the app; this message will update automatically.';
  const settingsStatusDescription = !email
    ? 'No verifiable email address is attached to this account.'
    : isVerified
      ? 'Verified and ready for notification emails.'
      : 'Unverified. Email notifications may not reach this account until verification is complete.';
  const settingsContainerClasses = !email
    ? 'border-gray-200 bg-gray-50'
    : isVerified
      ? 'border-green-100 bg-gradient-to-r from-green-50 to-emerald-50'
      : 'border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50';

  const actions = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {!isVerified && (
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={handleResendVerification}
          disabled={!canSendVerification}
          loading={isSending}
          leftIcon={<EnvelopeIcon className="h-4 w-4" />}
          className="w-full sm:w-auto"
        >
          {lastSentAt ? 'Resend Email' : 'Send Verification Email'}
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={handleRecheckVerification}
        disabled={isChecking || isSending}
        loading={isChecking}
        leftIcon={<RefreshIcon className="h-4 w-4" />}
        className="w-full sm:w-auto"
      >
        {isVerified ? 'Recheck Status' : 'I Verified'}
      </Button>
    </div>
  );

  if (mode === 'settings') {
    return (
      <div className={`rounded-2xl border p-6 ${settingsContainerClasses} ${className}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900">Email Verification</h3>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses}`}>
                {isVerified && <CheckIcon className="mr-1 h-3 w-3" />}
                {statusLabel}
              </span>
            </div>
            <p className="text-sm text-gray-600">{message}</p>
            <p className="mt-2 text-xs font-semibold text-gray-500">Status: {settingsStatusDescription}</p>
            {email && <p className="mt-2 break-all text-xs font-medium text-gray-500">{email}</p>}
          </div>
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div className={`mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-700/60 dark:bg-amber-900/20 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-800/60 dark:text-amber-100">
          <WarningIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">Verify Your Email</h3>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClasses}`}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-amber-900 dark:text-amber-100/90">{message}</p>
          {email && <p className="mt-1 break-all text-xs font-medium text-amber-800 dark:text-amber-100/80">{email}</p>}
          <div className="mt-4">{actions}</div>
        </div>
        <button
          type="button"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-amber-800 transition hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-800/50"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss email verification reminder"
          title="Dismiss"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default EmailVerificationPrompt;