export type AuthAction = 'login' | 'signup' | 'password-reset';

export const getFirebaseAuthErrorCode = (error: unknown): string => {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code || '').toLowerCase();
  }

  const text = String(error || '').toLowerCase();
  const match = text.match(/auth\/[a-z0-9-]+/);
  return match?.[0] || '';
};

export const getFirebaseAuthErrorMessage = (
  error: unknown,
  action: AuthAction,
  options?: { ministryMode?: boolean }
): string => {
  const code = getFirebaseAuthErrorCode(error);
  const raw = error instanceof Error ? error.message : String(error || '');

  switch (code) {
    case 'auth/email-already-in-use':
      return options?.ministryMode
        ? 'A ministry account already exists for this email. Sign in with its password or reset the password.'
        : 'An account with this email already exists. Sign in instead or reset your password.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return options?.ministryMode && action === 'signup'
        ? 'A ministry account already exists for this email, but the password is incorrect. Enter its existing password or reset it.'
        : 'The email or password is incorrect. Check your details and try again.';
    case 'auth/user-not-found':
      return 'No account was found with this email. Check the address or create an account.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/missing-password':
      return 'Enter your password.';
    case 'auth/weak-password':
      return 'Your password does not meet Firebase security requirements. Choose a stronger password.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support for assistance.';
    case 'auth/too-many-requests':
      return 'Too many attempts were made. Wait a few minutes, then try again or reset your password.';
    case 'auth/network-request-failed':
      return 'Could not reach Firebase. Check your internet connection and try again.';
    case 'auth/operation-not-allowed':
      return action === 'signup'
        ? 'Account creation is currently unavailable. Contact support.'
        : 'Email and password sign-in is currently unavailable. Contact support.';
    case 'auth/quota-exceeded':
      return 'The authentication service is temporarily unavailable. Try again later.';
    case 'auth/internal-error':
      return 'Firebase could not complete the request. Try again.';
  }

  // Preserve deliberate, user-facing service errors, but never expose a raw
  // Firebase/Identity Toolkit response to the interface.
  if (raw && !/firebase|identity toolkit|auth\//i.test(raw)) return raw;
  return action === 'signup'
    ? 'We could not create your account. Try again or contact support if the problem continues.'
    : action === 'password-reset'
      ? 'We could not send the password reset email. Try again.'
      : 'We could not sign you in. Try again or contact support if the problem continues.';
};
