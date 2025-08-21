import React, { useState } from 'react';
import { authService } from '../../services/firebaseService';
// contextService methods are embedded in service as helpers; we'll call through authService.register for normal mode
import { contextService } from '../../services/firebaseService';
import { EyeIcon, EyeSlashIcon } from '../icons/index';
import { MINISTRY_OPTIONS } from '../../constants';

// Utility: map Firebase registration errors to friendly messages; otherwise pass through
const getErrorMessage = (error: string, ministryMode: boolean): string => {
  const raw = error || '';
  const err = raw.toLowerCase();

  if (err.includes('auth/email-already-in-use')) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (err.includes('auth/weak-password')) {
    return 'Password is too weak. Please choose a stronger password (at least 8 characters, with a mix of letters and numbers).';
  }
  if (err.includes('auth/wrong-password') || err.includes('auth/invalid-credential')) {
    if (ministryMode) {
      return 'This email already has an account. Enter the existing password to attach your ministry account, or reset your password.';
    }
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (err.includes('auth/invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (err.includes('auth/operation-not-allowed')) {
    return 'Account creation is not enabled. Please contact support.';
  }
  if (err.includes('auth/network-request-failed')) {
    return 'Network error. Please check your internet connection and try again.';
  }
  if (err.includes('auth/too-many-requests')) {
    return 'Too many attempts. Please wait a few minutes before trying again.';
  }

  return raw;
};

interface RegisterFormProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
  ministryMode?: boolean;
}

interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  churchName: string;
  phoneNumber: string;
  ministry?: string;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, onSwitchToLogin: _onSwitchToLogin, showToast, ministryMode = false }) => {
  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    churchName: 'First Love Church', // Default church name
  phoneNumber: '',
  ministry: ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [showResetHint, setShowResetHint] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Real-time validation on blur for better UX
  const handleFieldBlur = async (fieldName: string) => {
    let error = '';

    switch (fieldName) {
      case 'firstName':
        error = validateFirstName(formData.firstName);
        break;
      case 'lastName':
        error = validateLastName(formData.lastName);
        break;
      case 'email':
        error = validateEmail(formData.email);
        if (error) {
          setErrors(prev => ({ ...prev, [fieldName]: error }));
        } else {
          // In ministry mode we allow reusing an existing email, so skip existence check
          if (!ministryMode) {
            await checkEmailExists(formData.email);
          }
        }
        return; // Early return to avoid setting error again below
      case 'password':
        error = validatePassword(formData.password);
        // Also revalidate confirm password if it has a value
        if (formData.confirmPassword) {
          const confirmError = validateConfirmPassword(formData.password, formData.confirmPassword);
          if (confirmError) {
            setErrors(prev => ({ ...prev, confirmPassword: confirmError }));
          } else {
            setErrors(prev => ({ ...prev, confirmPassword: '' }));
          }
        }
        break;
      case 'confirmPassword':
        error = validateConfirmPassword(formData.password, formData.confirmPassword);
        break;
      case 'phoneNumber':
        error = validatePhoneNumber(formData.phoneNumber);
        break;
      case 'churchName':
        error = validateChurchName(formData.churchName);
        break;
      case 'ministry':
        if (ministryMode) {
          error = validateMinistry(formData.ministry || '');
        }
        break;
  // no ministry field in SAT variant
    }

    if (error) {
      setErrors(prev => ({ ...prev, [fieldName]: error }));
    }
  };

  // Individual field validation functions
  const validateFirstName = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'First name is required';
    }
    if (trimmed.length < 2) {
      return 'First name must be at least 2 characters long';
    }
    if (trimmed.length > 50) {
      return 'First name is too long (maximum 50 characters)';
    }
    if (!/^[a-zA-Z\s'-]+$/.test(trimmed)) {
      return 'First name can only contain letters, spaces, hyphens, and apostrophes';
    }
    return '';
  };

  const validateLastName = (value: string): string => {
    const trimmed = value.trim();
    if (trimmed && trimmed.length < 2) {
      return 'Last name must be at least 2 characters long';
    }
    if (trimmed.length > 50) {
      return 'Last name is too long (maximum 50 characters)';
    }
    if (trimmed && !/^[a-zA-Z\s'-]+$/.test(trimmed)) {
      return 'Last name can only contain letters, spaces, hyphens, and apostrophes';
    }
    return '';
  };

  const validateEmail = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Email address is required';
    }

    // More comprehensive email validation with stricter rules
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    if (!emailRegex.test(trimmed)) {
      return 'Please enter a valid email address (e.g., user@example.com)';
    }

    if (trimmed.length > 254) {
      return 'Email address is too long (maximum 254 characters)';
    }

    // Check for common invalid patterns
    if (trimmed.includes('..')) {
      return 'Email address cannot contain consecutive dots';
    }

    if (trimmed.startsWith('.') || trimmed.endsWith('.')) {
      return 'Email address cannot start or end with a dot';
    }

    // Check for valid domain
    const parts = trimmed.split('@');
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

  // Live email existence check
  const checkEmailExists = async (email: string): Promise<void> => {
    const trimmed = email.trim();

    // Only check if email format is valid
    if (!trimmed || validateEmail(trimmed)) {
      return;
    }

    setIsCheckingEmail(true);
    try {
      const exists = await authService.checkEmailExists(trimmed);
      if (exists) {
        setErrors(prev => ({
          ...prev,
          email: 'This email address is already registered. Please use a different email or sign in instead.'
        }));
      } else {
        // Clear email error if it was about email existence
        setErrors(prev => {
          const newErrors = { ...prev };
          if (newErrors.email?.includes('already registered')) {
            delete newErrors.email;
          }
          return newErrors;
        });
      }
    } catch (error) {
      console.error('Error checking email existence:', error);
      // Don't show error to user, just log it
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const validatePassword = (value: string): string => {
    if (!value) {
      return 'Password is required';
    }

    if (value.length < 8) {
      return 'Password must be at least 8 characters long';
    }

    if (value.length > 128) {
      return 'Password is too long (maximum 128 characters)';
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(value)) {
      return 'Password must contain at least one uppercase letter';
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(value)) {
      return 'Password must contain at least one lowercase letter';
    }

    // Check for at least one number
    if (!/\d/.test(value)) {
      return 'Password must contain at least one number';
    }

    // Check for common weak passwords
    const commonPasswords = ['password', '12345678', 'password123', 'admin123', 'qwerty123'];
    if (commonPasswords.includes(value.toLowerCase())) {
      return 'Please choose a stronger password';
    }

    return '';
  };

  const validateConfirmPassword = (password: string, confirmPassword: string): string => {
    if (!confirmPassword) {
      return 'Please confirm your password';
    }

    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }

    return '';
  };

  const validateChurchName = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Church name is required';
    }

    if (trimmed.length < 2) {
      return 'Church name must be at least 2 characters';
    }

    if (trimmed.length > 100) {
      return 'Church name must be no more than 100 characters';
    }

    return '';
  };

  const validateMinistry = (value: string): string => {
    if (!ministryMode) return '';
    const trimmed = value.trim();
    if (!trimmed) return 'Please select your ministry';
    if (!MINISTRY_OPTIONS.includes(trimmed)) return 'Select a valid ministry';
    return '';
  };

  const validatePhoneNumber = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      return ''; // Phone number is optional
    }

    // Remove all non-digit characters for validation
    const digitsOnly = trimmed.replace(/\D/g, '');

    if (digitsOnly.length < 10) {
      return 'Phone number must be at least 10 digits';
    }

    if (digitsOnly.length > 15) {
      return 'Phone number is too long';
    }

    // Allow international format with +, spaces, hyphens, and parentheses
    if (!/^[\+]?[0-9\s\-\(\)]+$/.test(trimmed)) {
      return 'Please enter a valid phone number (e.g., +1 234 567 8900)';
    }

    return '';
  };

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};

    // Validate all fields
    const firstNameError = validateFirstName(formData.firstName);
    if (firstNameError) newErrors.firstName = firstNameError;

    const lastNameError = validateLastName(formData.lastName);
    if (lastNameError) newErrors.lastName = lastNameError;

    const emailError = validateEmail(formData.email);
    if (emailError) {
      newErrors.email = emailError;
    } else if (!ministryMode) {
      // Only block duplicates in normal mode; ministry mode can attach to existing email
      try {
        const emailExists = await authService.checkEmailExists(formData.email);
        if (emailExists) {
          newErrors.email = 'This email address is already registered. Please use a different email or sign in instead.';
        }
      } catch (error) {
        console.error('Error checking email existence during form validation:', error);
      }
    }

    const passwordError = validatePassword(formData.password);
    if (passwordError) newErrors.password = passwordError;

    const confirmPasswordError = validateConfirmPassword(formData.password, formData.confirmPassword);
    if (confirmPasswordError) newErrors.confirmPassword = confirmPasswordError;

    const churchNameError = validateChurchName(formData.churchName);
    if (churchNameError) newErrors.churchName = churchNameError;

  // Ministry required in ministry mode
  const ministryError = validateMinistry(formData.ministry || '');
  if (ministryError) newErrors.ministry = ministryError;

    const phoneError = validatePhoneNumber(formData.phoneNumber);
    if (phoneError) newErrors.phoneNumber = phoneError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);

    // Validate form including email existence check
    const isValid = await validateForm();
    if (!isValid) {
      setIsLoading(false);
      return;
    }

  try {
      const churchName = formData.churchName.trim() || 'First Love Church';

      // In ministry mode, allow reusing the same email by attaching a ministry context
      if (ministryMode) {
        await contextService.registerOrAttachMinistryAccount(formData.email, formData.password, {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          churchName: churchName,
          phoneNumber: formData.phoneNumber.trim(),
          role: 'admin',
          ministry: formData.ministry || ''
        });
      } else {
        await authService.register(formData.email, formData.password, {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        churchName: churchName,
        phoneNumber: formData.phoneNumber.trim(),
        role: 'admin', // First user becomes admin
        // Store ministry preference if in ministry mode; backend may ignore otherwise
        ministry: '',
        isMinistryAccount: false
      });
      }

      showToast('success', 'Registration Successful!',
        'Welcome! Your account has been created successfully.');
      onSuccess();
    } catch (error: any) {
      const msg = getErrorMessage(error.message || error.code || error.toString(), ministryMode);
      showToast('error', 'Registration Failed', msg);
      if (ministryMode && (String(error?.code || '').includes('auth/wrong-password') || String(error?.code || '').includes('auth/invalid-credential'))) {
        setShowResetHint(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // No ministry selector in SAT variant

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Name Fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="relative">
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                onBlur={() => handleFieldBlur('firstName')}
                className={`w-full px-4 py-3.5 bg-gray-50/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white transition-all duration-200 placeholder-gray-400 ${
                  errors.firstName ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}
                placeholder="First Name"
                required
                autoComplete="given-name"
                spellCheck="false"
              />
            </div>
            {errors.firstName && (
              <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
            )}
          </div>

          <div>
            <div className="relative">
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                onBlur={() => handleFieldBlur('lastName')}
                className={`w-full px-4 py-3.5 bg-gray-50/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white transition-all duration-200 placeholder-gray-400 ${
                  errors.lastName ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}
                placeholder="Last Name (optional)"
                autoComplete="family-name"
                spellCheck="false"
              />
            </div>
            {errors.lastName && (
              <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
            )}
          </div>
        </div>

  {/* Email */}
        <div>
          <div className="relative">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              onBlur={() => handleFieldBlur('email')}
              className={`w-full px-4 pr-12 sm:pr-14 py-3.5 bg-gray-50/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white transition-all duration-200 placeholder-gray-400 input-with-right-icon ${
                errors.email ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
              placeholder="Email address"
              required
              autoComplete="email"
              spellCheck="false"
            />
            {isCheckingEmail && (
              <div className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
          )}
          {isCheckingEmail && !errors.email && (
            <p className="text-blue-500 text-xs mt-1">Checking email availability...</p>
          )}
        </div>

        {/* Ministry selector (only in ministry mode) */}
        {ministryMode && (
          <div>
            <div className="relative">
              <select
                name="ministry"
                value={formData.ministry}
                onChange={handleSelectChange}
                onBlur={() => handleFieldBlur('ministry')}
                className={`w-full px-4 py-3.5 bg-rose-50/40 border rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 focus:bg-white transition-all duration-200 ${errors.ministry ? 'border-red-300 bg-red-50' : 'border-rose-200'}`}
              >
                <option value="">Select your ministry</option>
                {MINISTRY_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            {errors.ministry && (
              <p className="text-red-500 text-xs mt-1">{errors.ministry}</p>
            )}
          </div>
        )}

  {/* Phone Number */}
        <div>
          <div className="relative">
            <input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              onBlur={() => handleFieldBlur('phoneNumber')}
              className={`w-full px-4 py-3.5 bg-gray-50/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white transition-all duration-200 placeholder-gray-400 ${
                errors.phoneNumber ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
              placeholder="Phone number (optional)"
              autoComplete="tel"
            />
          </div>
          {errors.phoneNumber && (
            <p className="text-red-500 text-xs mt-1">{errors.phoneNumber}</p>
          )}
        </div>

  {/* Password */}
        <div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              onBlur={() => handleFieldBlur('password')}
              className={`w-full pl-4 pr-12 py-3.5 bg-gray-50/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white transition-all duration-200 placeholder-gray-400 ${
                errors.password ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
              placeholder="Password"
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              {showPassword ? (
                <EyeSlashIcon className="w-4 h-4" />
              ) : (
                <EyeIcon className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-500 text-xs mt-1">{errors.password}</p>
          )}
          {ministryMode && showResetHint && !errors.password && (
            <div className="text-xs mt-2 text-rose-700">
              Forgot your existing password?{' '}
              <button
                type="button"
                className="text-rose-600 underline hover:text-rose-700"
                onClick={async () => {
                  try {
                    await authService.resetPassword(formData.email.trim());
                    showToast('info', 'Password Reset Sent', 'Check your inbox for a password reset link. After resetting, come back to attach your ministry account.');
                  } catch (e: any) {
                    showToast('error', 'Reset Failed', 'We could not send a reset email. Please verify the address.');
                  }
                }}
              >Reset it</button>
              .
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              onBlur={() => handleFieldBlur('confirmPassword')}
              className={`w-full pl-4 pr-12 py-3.5 bg-gray-50/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white transition-all duration-200 placeholder-gray-400 ${
                errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
              placeholder="Confirm password"
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              {showConfirmPassword ? (
                <EyeSlashIcon className="w-4 h-4" />
              ) : (
                <EyeIcon className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3.5 text-white font-semibold rounded-xl transition-colors duration-200 mt-5 border ${
            ministryMode
              ? 'bg-gradient-to-r from-rose-500/95 to-fuchsia-600/95 border-white/50 focus:ring-rose-400/60'
              : 'bg-gradient-to-r from-green-600/95 to-emerald-600/95 border-white/50 focus:ring-emerald-400/60'
          } focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-[1.05]`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Creating Account...
            </div>
          ) : (
            'Create Account'
          )}
        </button>
      </form>
    </div>
  );
};

export default RegisterForm;
