import React, { useCallback, useEffect, useState } from 'react';
import Button from '../ui/Button';
import { ShieldCheckIcon } from '../icons';
import { nativeAuthEnrollmentService } from '../../services/supabase/nativeAuthEnrollmentService';

interface NativeAuthEnrollmentGateProps {
  onComplete: () => void;
  onSignOut: () => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

type GateState = 'checking' | 'required' | 'error';

const policyMessage = 'Use 12 or more characters with uppercase, lowercase, a number, and a symbol.';

const NativeAuthEnrollmentGate: React.FC<NativeAuthEnrollmentGateProps> = ({
  onComplete,
  onSignOut,
  showToast,
}) => {
  const [state, setState] = useState<GateState>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    setState('checking');
    setError(null);
    try {
      const status = await nativeAuthEnrollmentService.getStatus();
      if (status.linked || !status.eligible) {
        onComplete();
        return;
      }
      setState('required');
    } catch {
      setError('SAT Mobile could not securely check your account migration. Your Firebase account and data are unchanged.');
      setState('error');
    }
  }, [onComplete]);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password)
      || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setError(policyMessage);
      return;
    }

    setIsSubmitting(true);
    try {
      await nativeAuthEnrollmentService.enroll(password);
      setPassword('');
      setConfirmation('');
      showToast('success', 'Account Secured', 'Your new SAT Mobile password is ready. Your data and current session were preserved.');
      onComplete();
    } catch {
      setError('Your new sign-in could not be prepared. Nothing was removed or changed in Firebase; please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl sm:p-8">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
            <ShieldCheckIcon className="h-10 w-10" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Secure your SAT Mobile account</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            We are upgrading SAT Mobile sign-in. Create a new password once; your profile, church access, and history will stay exactly where they are.
          </p>
        </div>

        {state === 'checking' && (
          <div className="mt-7 flex items-center justify-center gap-3 rounded-2xl bg-slate-50 p-5 text-sm font-medium text-slate-600" role="status">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
            Checking your secure migration status…
          </div>
        )}

        {state === 'error' && (
          <div className="mt-7">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900" role="alert">
              {error}
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <Button type="button" onClick={() => void checkStatus()}>Try again</Button>
              <Button type="button" variant="secondary" onClick={onSignOut}>Sign out</Button>
            </div>
          </div>
        )}

        {state === 'required' && (
          <form className="mt-7 space-y-5" onSubmit={submit}>
            <div>
              <label htmlFor="native-password" className="mb-2 block text-sm font-semibold text-slate-800">New SAT Mobile password</label>
              <input
                id="native-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label htmlFor="native-password-confirmation" className="mb-2 block text-sm font-semibold text-slate-800">Confirm new password</label>
              <input
                id="native-password-confirmation"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={isSubmitting}
                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <p className="text-xs leading-5 text-slate-500">{policyMessage}</p>
            {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}
            <Button type="submit" loading={isSubmitting} className="w-full">Create secure password</Button>
            <Button type="button" variant="secondary" onClick={onSignOut} disabled={isSubmitting} className="w-full">Sign out</Button>
            <p className="text-center text-xs leading-5 text-slate-500">
              Firebase remains available as a protected fallback until this upgrade is verified on released clients.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default NativeAuthEnrollmentGate;
