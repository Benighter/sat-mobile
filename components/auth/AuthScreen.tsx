// Enhanced Authentication Screen with Login and Register
import React, { useState, useEffect, ReactNode } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { authService, FirebaseUser, setActiveContext } from '../../services/firebaseService';
import { LoginForm } from './LoginForm';
import RegisterForm from './RegisterForm';
// Ministry variant removed – use standard forms only
import OptimizedLoader from '../common/OptimizedLoader';
import SuperAdminDashboard from '../super-admin/SuperAdminDashboard';
import { getAppDisplayName } from '../../constants';
import { TabKeys } from '../../types';
import Modal from '../ui/Modal';
import ContactView from '../views/ContactView';

// Utility function to convert Firebase errors to user-friendly messages
const getErrorMessage = (error: string): string => {
  if (error.includes('auth/invalid-credential') || error.includes('auth/wrong-password')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (error.includes('auth/user-not-found')) {
    return 'No account found with this email address. Please check your email or create a new account.';
  }
  if (error.includes('auth/invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (error.includes('auth/user-disabled')) {
    return 'This account has been disabled. Please contact support for assistance.';
  }
  if (error.includes('auth/too-many-requests')) {
    return 'Too many failed attempts. Please wait a few minutes before trying again.';
  }
  if (error.includes('auth/network-request-failed')) {
    return 'Network error. Please check your internet connection and try again.';
  }
  if (error.includes('auth/operation-not-allowed')) {
    return 'Email/password sign-in is not enabled. Please contact support.';
  }
  if (error.includes('auth/popup-closed-by-user')) {
    return 'Sign-in was cancelled. Please try again.';
  }
  if (error.includes('auth/popup-blocked')) {
    return 'Pop-up was blocked by your browser. Please allow pop-ups and try again.';
  }
  if (error.includes('auth/cancelled-popup-request')) {
    return 'Sign-in was cancelled. Please try again.';
  }

  // Default fallback for unknown errors
  return 'Authentication failed. Please try again or contact support if the problem persists.';
};

interface AuthScreenProps {
  children: ReactNode;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ children, showToast }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [ministryMode, setMinistryMode] = useState<boolean>(false);
  // Super Admin prototype state (bypasses firebase auth when using hardcoded credentials)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  // Must come before any conditional return (Rules of Hooks)
  const { isImpersonating, stopImpersonation, switchTab } = useAppContext();

  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportModalData, setSupportModalData] = useState<{initialEmail?: string; initialMessage?: string; contextMeta?: any}>({});

  const openSupport = (opts?: { email?: string; errorCode?: string; errorMessage?: string; screen?: string; feature?: string }) => {
    const email = opts?.email || (typeof window !== 'undefined' ? localStorage.getItem('last_known_email') || undefined : undefined);
    // Show a modal immediately (works even before full app nav is available)
    setSupportModalData({
      initialEmail: email,
      initialMessage: opts?.errorMessage ? `I encountered an issue: ${opts.errorMessage}` : undefined,
      contextMeta: { screen: opts?.screen || 'Login', feature: opts?.feature || 'Authentication', errorCode: opts?.errorCode, errorMessage: opts?.errorMessage }
    });
    setIsSupportModalOpen(true);

    // Also push the Contact tab into nav stack for later use (non-blocking)
    try {
      switchTab({
        id: TabKeys.CONTACT, name: 'Contact',
        data: {
          supportPrompted: true,
          initialEmail: email,
          initialMessage: opts?.errorMessage ? `I encountered an issue: ${opts.errorMessage}` : undefined,
          contextMeta: { screen: opts?.screen || 'Login', feature: opts?.feature || 'Authentication', errorCode: opts?.errorCode, errorMessage: opts?.errorMessage }
        }
      });
    } catch {}
  };

  // Watchdog: if auth/loading persists beyond 5 seconds, notify user
  useEffect(() => {
    let t: any;
    if (loading) {
      t = setTimeout(() => {
        try { showToast('warning', 'Still loading…', 'If this takes too long, please restart the app.'); } catch {}
      }, 5000);
    }
    return () => t && clearTimeout(t);
  }, [loading, showToast]);

  useEffect(() => {
    // Restore Super Admin prototype session (if previously set)
    try {
      const persisted = localStorage.getItem('superadmin_session');
      if (persisted === 'true') {
        setIsSuperAdmin(true);
        setLoading(false);
        return; // Skip Firebase listener until user signs out
      }
    } catch {}

    // Listen to authentication state changes
    const unsubscribe = authService.onAuthStateChanged((user) => {
      // Select data context based on toggle
  // Fire and forget; no await in non-async callback
  setActiveContext(ministryMode ? 'ministry' : 'default').catch(() => {});
      // Ministry mode now uses direct Firestore queries like SuperAdmin - no sync needed
      if (user && ministryMode) {
        console.log('🔄 [Ministry Mode] User switched to ministry mode - will use cross-church aggregation');
        // The FirebaseAppContext will automatically handle cross-church data fetching
      }
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ministryMode]);

  const handleSignIn = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      // Hardcoded Super Admin credentials - now properly authenticate with Firebase
      if (email.trim().toLowerCase() === 'admin@gmail.com' && password === 'Admin@123') {
        try {
          // Try to sign in with Firebase Auth first
          const user = await authService.signIn(email, password);
          setUser(user);
          setIsSuperAdmin(true);
          try { localStorage.setItem('superadmin_session', 'true'); } catch {}
          showToast('success', 'Super Admin', 'Signed in as Super Admin');
          return;
        } catch (authError: any) {
          // If auth fails, it means the SuperAdmin user doesn't exist yet
          console.log('SuperAdmin user not found, will need to be created manually');
          setError('SuperAdmin user not found. Please create the admin@gmail.com user with superAdmin flag in Firestore.');
          showToast('error', 'SuperAdmin Setup Required', 'Please create the admin@gmail.com user with superAdmin: true in Firestore users collection.');
          return;
        }
      }
      // Attempt sign-in directly; rely on Auth errors to guide UX

      const user = ministryMode
        ? await authService.signInMinistry(email, password)
        : await authService.signIn(email, password);

      // Ministry mode gate with dual-context support
      const hasMinistry = (user.contexts && user.contexts.ministryChurchId) ? true : (user.isMinistryAccount === true);
      const hasDefault = (user.contexts && user.contexts.defaultChurchId) ? true : (user.isMinistryAccount !== true);

      if (ministryMode && !hasMinistry) {
        await authService.signOut();
        setUser(null);
        const msg = 'This account is not a Ministry account. Switch off Ministry mode or register a Ministry account.';
        setError(msg);
        showToast('warning', 'Ministry Mode Enabled', msg);
        return;
      }
      if (!ministryMode && !hasDefault) {
        await authService.signOut();
        setUser(null);
        const msg = 'This email is currently a Ministry-only account. Turn on Ministry mode to sign in.';
        setError(msg);
        showToast('warning', 'Use Ministry Mode', msg);
        return;
      }

      // Select data context based on toggle before rendering app
      try {
        await setActiveContext(ministryMode ? 'ministry' : 'default').catch(() => {});
      } catch {}

      // Ministry mode now uses direct Firestore queries like SuperAdmin - no sync needed
      if (ministryMode) {
        console.log('🔄 [Ministry Mode] Switching to cross-church data aggregation (SuperAdmin style)');
        // The FirebaseAppContext will automatically handle cross-church data fetching
      }

      setUser(user);
      showToast('success', 'Welcome Back!', `Signed in as ${user.displayName || user.email}`);
    } catch (error: any) {
      const raw = error.message || error.code || error.toString();
      const friendlyMessage = getErrorMessage(raw);
      setError(friendlyMessage || raw);
      showToast('error', 'Sign In Failed', friendlyMessage || raw);
    } finally {
      setLoading(false);
    }
  };



  const handleSignOut = async () => {
    try {
      await authService.signOut();
      setUser(null);
      showToast('success', 'Signed Out', 'You have been signed out successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Sign Out Failed', error.message);
    }
  };

  const handleSuperAdminSignOut = () => {
    setIsSuperAdmin(false);
  try { localStorage.removeItem('superadmin_session'); } catch {}
    setAuthMode('login');
    showToast('success', 'Signed Out', 'Super Admin session ended');
  };

  const handleRegisterSuccess = () => {
    // Registration successful – user will be signed in automatically.
    // If in ministry mode, route to Ministries dashboard after auth state flips.
    if (ministryMode) {
      try {
        switchTab({ id: 'ministries', name: 'Ministries' });
      } catch {}
    } else {
      setAuthMode('login');
    }
  };

  const switchToRegister = () => {
    setAuthMode('register');
    setError(null);
  };

  const switchToLogin = () => {
    setAuthMode('login');
    setError(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="glass rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col items-center space-y-4">
            <OptimizedLoader />
            <div className="text-center">
              <p className="text-lg font-semibold gradient-text">Loading {getAppDisplayName('SAT Mobile')}...</p>
              <p className="text-sm text-gray-600 mt-1">Preparing your spiritual dashboard</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isSuperAdmin && !isImpersonating) {
    return <SuperAdminDashboard onSignOut={handleSuperAdminSignOut} />;
  }

  if (isSuperAdmin && isImpersonating) {
    return (
      <div className="relative min-h-screen">
        {/* App (children) runs under impersonated context */}
        {children}
        {/* Fallback floating exit (in case header not rendered yet) */}
        <button
          onClick={stopImpersonation}
          className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-lg"
        >Exit Impersonation</button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden ${ministryMode
          ? 'bg-gradient-to-br from-rose-50 via-fuchsia-50 to-purple-50'
          : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'}`}>
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl ${ministryMode ? 'bg-gradient-to-br from-rose-400/10 to-purple-400/10' : 'bg-gradient-to-br from-blue-400/10 to-purple-400/10'}`}></div>
          <div className={`absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl ${ministryMode ? 'bg-gradient-to-br from-fuchsia-400/10 to-rose-400/10' : 'bg-gradient-to-br from-indigo-400/10 to-blue-400/10'}`}></div>
        </div>
        <div className="w-full relative z-10">
          {/* Ministry Mode Toggle – polished glassy switch */}
          <div className="w-full flex justify-center mb-6 -mt-1">
            <div
              className={`relative isolate min-w-[300px] max-w-sm rounded-2xl px-4 py-3 shadow-lg ring-1 backdrop-blur-xl ${
                ministryMode
                  ? 'bg-gradient-to-br from-rose-50/90 via-white/80 to-fuchsia-50/90 ring-rose-100'
                  : 'bg-white/80 ring-black/5'
              }`}
            >
              {/* soft gradient glow */}
              <div
                aria-hidden
                className={`pointer-events-none absolute inset-0 -z-10 rounded-2xl opacity-60 blur-xl ${
                  ministryMode
                    ? 'bg-gradient-to-r from-rose-300/20 via-fuchsia-300/20 to-purple-300/20'
                    : 'bg-gradient-to-r from-blue-300/20 via-indigo-300/20 to-purple-300/20'
                }`}
              />

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs shadow-sm ring-1 ${
                      ministryMode
                        ? 'bg-rose-500/10 text-rose-600 ring-rose-200'
                        : 'bg-indigo-500/10 text-indigo-600 ring-indigo-200'
                    }`}
                    aria-hidden
                  >
                    ⚡
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold tracking-wide ${
                        ministryMode ? 'text-rose-700' : 'text-gray-700'
                      }`}
                    >
                      Ministry mode
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                        ministryMode
                          ? 'bg-rose-100/80 text-rose-700 border-rose-200'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      {ministryMode ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMinistryMode((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setMinistryMode((v) => !v);
                    }
                  }}
                  className={`relative inline-flex h-8 w-16 items-center rounded-full p-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                    ministryMode
                      ? 'bg-gradient-to-r from-rose-500 to-fuchsia-600 shadow-[0_8px_24px_-8px_rgba(244,63,94,0.45)]'
                      : 'bg-gray-200'
                  } focus-visible:ring-indigo-500`}
                  role="switch"
                  aria-checked={ministryMode}
                  aria-label="Toggle Ministry Mode"
                >
                  {/* icons inside track */}
                  <span
                    className={`absolute left-2 text-[10px] select-none transition-opacity ${
                      ministryMode ? 'opacity-0' : 'opacity-70'
                    }`}
                    aria-hidden
                  >
                    🙂
                  </span>
                  <span
                    className={`absolute right-2 text-[10px] select-none transition-opacity ${
                      ministryMode ? 'opacity-90' : 'opacity-0'
                    }`}
                    aria-hidden
                  >
                    ⛪
                  </span>
                  <span
                    className={`h-6 w-6 rounded-full bg-white shadow-md transform transition-transform ${
                      ministryMode ? 'translate-x-8' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
          {authMode === 'login' ? (
            <div>
              <LoginForm
                onSignIn={handleSignIn}
                error={error}
                loading={loading}
                showToast={showToast}
                ministryMode={ministryMode}
                onEmailChange={(em) => {
                  try { localStorage.setItem('last_known_email', em); } catch {}
                }}
                onContactSupport={() => openSupport({
                  email: (typeof window !== 'undefined' ? localStorage.getItem('last_known_email') || undefined : undefined),
                  errorMessage: error || undefined,
                  screen: 'Login',
                  feature: 'Authentication'
                })}
              />

              {/* Switch to Register */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <button
                    onClick={switchToRegister}
                    className="text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200"
                  >
                    Create one here
                  </button>

              {/* Support modal for unauthenticated state */}
              <Modal isOpen={isSupportModalOpen} onClose={() => setIsSupportModalOpen(false)} title="Contact Support" size="lg">
                <ContactView
                  initialEmail={supportModalData.initialEmail}
                  initialMessage={supportModalData.initialMessage}
                  supportPrompted={true}
                  contextMeta={supportModalData.contextMeta}
                  onMessageSent={() => {
                    // Clear the error and close the modal when message is sent successfully
                    setError(null);
                    setIsSupportModalOpen(false);
                  }}
                />
              </Modal>

                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-md mx-auto">
              <div className={`backdrop-blur-xl rounded-3xl shadow-2xl p-8 border ${ministryMode ? 'bg-white/95 border-rose-100' : 'bg-white/90 border-white/30'}`}>
                {/* Header */}
                <div className="text-center mb-8">
                  <div className={`mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-lg transform hover:scale-105 transition-transform duration-200 p-1 ${ministryMode ? 'bg-rose-50 ring-2 ring-rose-100' : 'bg-white'}`}>
                    <img src="/logo.png" alt="First Love Church" className="w-full h-full object-contain" />
                  </div>
                  <h1 className={`text-2xl font-bold bg-clip-text text-transparent mb-1 ${ministryMode ? 'bg-gradient-to-r from-rose-600 to-fuchsia-600' : 'bg-gradient-to-r from-green-600 to-emerald-600'}`}>Join {getAppDisplayName('SAT Mobile')}</h1>
                  <p className="text-gray-500 text-sm">{ministryMode ? 'You are creating a ministry account' : 'Join First Love Church'}</p>
                </div>

                <RegisterForm
                  onSuccess={() => handleRegisterSuccess()}
                  onSwitchToLogin={switchToLogin}
                  showToast={showToast}
                  ministryMode={ministryMode}
                />

                {/* Switch to Login */}
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600">
                    Already have an account?{' '}
                    <button
                      onClick={switchToLogin}
                      className="text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200"
                    >
                      Sign in here
                    </button>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* User info bar */}
      <div className="bg-white shadow-sm border-b border-gray-100 px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-medium">
                {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {user.displayName || 'User'}
              </p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-600 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition-all duration-200 font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main app content */}
      <div className="pt-0">
        {children}
      </div>

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-md shadow-lg z-50">
          {error}
        </div>
      )}
    </div>
  );
};
