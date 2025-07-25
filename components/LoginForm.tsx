// Clean Modern Login Form Component
import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, Church } from 'lucide-react';
import ForgotPasswordModal from './ForgotPasswordModal';

interface LoginFormProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  error: string | null;
  loading: boolean;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

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
  if (error.includes('auth/weak-password')) {
    return 'Password is too weak. Please choose a stronger password.';
  }
  if (error.includes('auth/email-already-in-use')) {
    return 'An account with this email already exists. Please sign in instead.';
  }

  // Default fallback for unknown errors
  return 'Sign in failed. Please try again or contact support if the problem persists.';
};

export const LoginForm: React.FC<LoginFormProps> = ({ onSignIn, error, loading, showToast }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{email?: string; password?: string}>({});
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  const validateEmail = (emailValue: string): string => {
    const trimmedEmail = emailValue.trim();

    if (!trimmedEmail) {
      return 'Email address is required';
    }

    // More comprehensive email validation with stricter rules
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    if (!emailRegex.test(trimmedEmail)) {
      return 'Please enter a valid email address (e.g., user@example.com)';
    }

    if (trimmedEmail.length > 254) {
      return 'Email address is too long (maximum 254 characters)';
    }

    // Check for common invalid patterns
    if (trimmedEmail.includes('..')) {
      return 'Email address cannot contain consecutive dots';
    }

    if (trimmedEmail.startsWith('.') || trimmedEmail.endsWith('.')) {
      return 'Email address cannot start or end with a dot';
    }

    // Check for valid domain
    const parts = trimmedEmail.split('@');
    if (parts.length !== 2) {
      return 'Email address must contain exactly one @ symbol';
    }

    const [localPart, domain] = parts;
    if (localPart.length === 0 || localPart.length > 64) {
      return 'Email address local part must be between 1 and 64 characters';
    }

    if (domain.length === 0 || domain.length > 253) {
      return 'Email domain must be between 1 and 253 characters';
    }

    // Check for valid domain format
    if (!domain.includes('.')) {
      return 'Email domain must contain at least one dot';
    }

    const domainParts = domain.split('.');
    if (domainParts.some(part => part.length === 0)) {
      return 'Email domain cannot have empty parts';
    }

    return '';
  };

  const validatePassword = (passwordValue: string): string => {
    if (!passwordValue) {
      return 'Password is required';
    }

    if (passwordValue.length < 6) {
      return 'Password must be at least 6 characters long';
    }

    if (passwordValue.length > 128) {
      return 'Password is too long (maximum 128 characters)';
    }

    // Check for common weak passwords
    const commonPasswords = ['password', '123456', 'password123', 'admin', 'qwerty'];
    if (commonPasswords.includes(passwordValue.toLowerCase())) {
      return 'Please choose a stronger password';
    }

    return '';
  };

  const validateForm = (): boolean => {
    const errors: {email?: string; password?: string} = {};

    // Validate email
    const emailError = validateEmail(email);
    if (emailError) {
      errors.email = emailError;
    }

    // Validate password
    const passwordError = validatePassword(password);
    if (passwordError) {
      errors.password = passwordError;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Real-time validation functions
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);

    // Clear error immediately when user starts typing
    if (validationErrors.email) {
      setValidationErrors(prev => ({ ...prev, email: undefined }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);

    // Clear error immediately when user starts typing
    if (validationErrors.password) {
      setValidationErrors(prev => ({ ...prev, password: undefined }));
    }
  };

  // Validate on blur for better UX
  const handleEmailBlur = () => {
    if (email.trim()) {
      const emailError = validateEmail(email);
      if (emailError) {
        setValidationErrors(prev => ({ ...prev, email: emailError }));
      }
    }
  };

  const handlePasswordBlur = () => {
    if (password) {
      const passwordError = validatePassword(password);
      if (passwordError) {
        setValidationErrors(prev => ({ ...prev, password: passwordError }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    await onSignIn(email, password);
  };

  return (
    <div className="w-full max-w-sm mx-auto px-4">
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/30">
        {/* Single Logo Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-lg transform hover:scale-105 transition-transform duration-200 p-1">
            <img src="/logo.png" alt="First Love Church" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-1">
            SAT Mobile
          </h1>
          <p className="text-gray-500 text-sm">Welcome to First Love Church</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600 text-center">{getErrorMessage(error)}</p>
          </div>
        )}



        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                onBlur={handleEmailBlur}
                className={`w-full pl-10 pr-4 py-3.5 bg-gray-50/50 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all duration-200 placeholder-gray-400 ${
                  validationErrors.email
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="Email address"
                disabled={loading}
                autoComplete="email"
                spellCheck="false"
              />
            </div>
            {validationErrors.email && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>
            )}
          </div>

          <div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={handlePasswordChange}
                onBlur={handlePasswordBlur}
                className={`w-full pl-10 pr-12 py-3.5 bg-gray-50/50 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all duration-200 placeholder-gray-400 ${
                  validationErrors.password
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="Password"
                disabled={loading}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {validationErrors.password && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01] transition-all duration-200 mt-6"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Signing in...
              </div>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Forgot Password */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setIsForgotPasswordOpen(true)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            Forgot password?
          </button>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            Secure church management platform
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        showToast={showToast}
      />
    </div>
  );
};
