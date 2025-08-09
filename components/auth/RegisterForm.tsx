import React, { useState } from 'react';
import { authService } from '../../services/firebaseService';
import { EyeIcon, EyeSlashIcon } from '../icons/index';

// Utility function to convert Firebase errors to user-friendly messages
const getErrorMessage = (error: string): string => {
  if (error.includes('auth/email-already-in-use')) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (error.includes('auth/weak-password')) {
    return 'Password is too weak. Please choose a stronger password (at least 6 characters).';
  }
  if (error.includes('auth/invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (error.includes('auth/operation-not-allowed')) {
    return 'Account creation is not enabled. Please contact support.';
  }
  if (error.includes('auth/network-request-failed')) {
    return 'Network error. Please check your internet connection and try again.';
  }
  if (error.includes('auth/too-many-requests')) {
    return 'Too many attempts. Please wait a few minutes before trying again.';
  }

  // Default fallback for unknown errors
  return 'Registration failed. Please try again or contact support if the problem persists.';
};

interface RegisterFormProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  churchName: string;
  phoneNumber: string;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, onSwitchToLogin, showToast }) => {
  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    churchName: 'First Love Church', // Default church name
    phoneNumber: ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
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
          // If basic validation passes, check if email exists
          await checkEmailExists(formData.email);
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
    } else {
      // Check if email exists only if basic validation passes
      try {
        const emailExists = await authService.checkEmailExists(formData.email);
        if (emailExists) {
          newErrors.email = 'This email address is already registered. Please use a different email or sign in instead.';
        }
      } catch (error) {
        console.error('Error checking email existence during form validation:', error);
        // Don't block form submission on email check error
      }
    }

    const passwordError = validatePassword(formData.password);
    if (passwordError) newErrors.password = passwordError;

    const confirmPasswordError = validateConfirmPassword(formData.password, formData.confirmPassword);
    if (confirmPasswordError) newErrors.confirmPassword = confirmPasswordError;

    const churchNameError = validateChurchName(formData.churchName);
    if (churchNameError) newErrors.churchName = churchNameError;

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

      await authService.register(formData.email, formData.password, {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        churchName: churchName,
        phoneNumber: formData.phoneNumber.trim(),
        role: 'admin' // First user becomes admin
      });

      showToast('success', 'Registration Successful!',
        `Welcome to SAT Mobile! Your church "${churchName}" has been set up.`);
      onSuccess();
    } catch (error: any) {
      showToast('error', 'Registration Failed', getErrorMessage(error.message || error.code || error.toString()));
    } finally {
      setIsLoading(false);
    }
  };

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
              className={`w-full px-4 py-3.5 bg-gray-50/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white transition-all duration-200 placeholder-gray-400 ${
                errors.email ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
              placeholder="Email address"
              required
              autoComplete="email"
              spellCheck="false"
            />
            {isCheckingEmail && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
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
          className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01] transition-all duration-200 mt-6"
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
