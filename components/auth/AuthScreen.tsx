// Enhanced Authentication Screen with Login and Register
import React, { useState, useEffect, ReactNode } from 'react';
import { authService, FirebaseUser } from '../../services/firebaseService';
import { LoginForm } from './LoginForm';
import RegisterForm from './RegisterForm';
import OptimizedLoader from '../common/OptimizedLoader';
import SuperAdminDashboard from '../super-admin/SuperAdminDashboard';

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
  // Super Admin prototype state (bypasses firebase auth when using hardcoded credentials)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    // Listen to authentication state changes
    const unsubscribe = authService.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      // Hardcoded Super Admin credentials (temporary prototype)
      if (email.trim().toLowerCase() === 'admin@gmail.com' && password === 'Admin@123') {
        setIsSuperAdmin(true);
        showToast('success', 'Super Admin', 'Signed in as Super Admin');
        return; // Skip firebase auth
      }
      const user = await authService.signIn(email, password);
      setUser(user);
      showToast('success', 'Welcome Back!', `Signed in as ${user.displayName || user.email}`);
    } catch (error: any) {
      const friendlyMessage = getErrorMessage(error.message || error.code || error.toString());
      setError(friendlyMessage);
      showToast('error', 'Sign In Failed', friendlyMessage);
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
    setAuthMode('login');
    showToast('success', 'Signed Out', 'Super Admin session ended');
  };

  const handleRegisterSuccess = () => {
    // Registration successful, user will be automatically signed in
    // The auth state listener will handle the user state update
    setAuthMode('login');
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
              <p className="text-lg font-semibold gradient-text">Loading SAT Mobile...</p>
              <p className="text-sm text-gray-600 mt-1">Preparing your spiritual dashboard</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isSuperAdmin) {
    return <SuperAdminDashboard onSignOut={handleSuperAdminSignOut} />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-indigo-400/10 to-blue-400/10 rounded-full blur-3xl"></div>
        </div>
        <div className="w-full relative z-10">
          {authMode === 'login' ? (
            <div>
              <LoginForm
                onSignIn={handleSignIn}
                error={error}
                loading={loading}
                showToast={showToast}
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
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-md mx-auto">
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/30">
                {/* Header */}
                <div className="text-center mb-8">
                  <div className="mx-auto w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-lg transform hover:scale-105 transition-transform duration-200 p-1">
                    <img src="/logo.png" alt="First Love Church" className="w-full h-full object-contain" />
                  </div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-1">Join SAT Mobile</h1>
                  <p className="text-gray-500 text-sm">Join First Love Church</p>
                </div>

                <RegisterForm
                  onSuccess={handleRegisterSuccess}
                  onSwitchToLogin={switchToLogin}
                  showToast={showToast}
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
