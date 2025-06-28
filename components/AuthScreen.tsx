// Enhanced Authentication Screen with Login and Register
import React, { useState, useEffect, ReactNode } from 'react';
import { authService, FirebaseUser } from '../services/firebaseService';
import { LoginForm } from './LoginForm';
import RegisterForm from './RegisterForm';
import OptimizedLoader from './OptimizedLoader';

interface AuthScreenProps {
  children: ReactNode;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ children, showToast }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

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
      const user = await authService.signIn(email, password);
      setUser(user);
      showToast('success', 'Welcome Back!', `Signed in as ${user.displayName || user.email}`);
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Sign In Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError(null);
      setLoading(true);
      const user = await authService.signInWithGoogle();
      setUser(user);
      showToast('success', 'Welcome!', `Signed in with Google as ${user.displayName || user.email}`);
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Google Sign In Failed', error.message);
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
              <LoginForm onSignIn={handleSignIn} onGoogleSignIn={handleGoogleSignIn} error={error} loading={loading} />

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
                  <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg transform hover:scale-105 transition-transform duration-200">
                    <span className="text-white text-2xl">⛪</span>
                  </div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-1">Join SAT Mobile</h1>
                  <p className="text-gray-500 text-sm">Create your church account</p>
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
