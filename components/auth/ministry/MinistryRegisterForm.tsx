import React, { useState } from 'react';
import { MINISTRY_OPTIONS, getVariantDisplayNameKey } from '../../../constants';
import { authService } from '../../../services/firebaseService';
import { EyeIcon, EyeSlashIcon } from '../../icons';

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
  ministry: string;
}

const getErrorMessage = (error: string): string => {
  if (error.includes('auth/email-already-in-use')) return 'An account with this email already exists. Please sign in instead.';
  if (error.includes('auth/weak-password')) return 'Password is too weak. Please choose a stronger password (at least 6 characters).';
  if (error.includes('auth/invalid-email')) return 'Please enter a valid email address.';
  if (error.includes('auth/operation-not-allowed')) return 'Account creation is not enabled. Please contact support.';
  if (error.includes('auth/network-request-failed')) return 'Network error. Please check your internet connection and try again.';
  if (error.includes('auth/too-many-requests')) return 'Too many attempts. Please wait a few minutes before trying again.';
  return 'Registration failed. Please try again or contact support if the problem persists.';
};

const MinistryRegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, onSwitchToLogin, showToast }) => {
  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    churchName: 'First Love Church',
    phoneNumber: '',
    ministry: MINISTRY_OPTIONS[0]
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateFirstName = (v: string) => !v.trim() ? 'First name is required' : v.trim().length < 2 ? 'First name must be at least 2 characters long' : v.trim().length > 50 ? 'First name is too long (maximum 50 characters)' : !/^[a-zA-Z\s'-]+$/.test(v.trim()) ? 'First name can only contain letters, spaces, hyphens, and apostrophes' : '';
  const validateLastName = (v: string) => v.trim() && v.trim().length < 2 ? 'Last name must be at least 2 characters long' : v.trim().length > 50 ? 'Last name is too long (maximum 50 characters)' : v.trim() && !/^[a-zA-Z\s'-]+$/.test(v.trim()) ? 'Last name can only contain letters, spaces, hyphens, and apostrophes' : '';
  const validateEmail = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return 'Email address is required';
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(trimmed)) return 'Please enter a valid email address (e.g., user@example.com)';
    if (trimmed.length > 254) return 'Email address is too long (maximum 254 characters)';
    if (trimmed.includes('..')) return 'Email address cannot contain consecutive dots';
    if (trimmed.startsWith('.') || trimmed.endsWith('.')) return 'Email address cannot start or end with a dot';
    const parts = trimmed.split('@');
    if (parts.length !== 2) return 'Email address must contain exactly one @ symbol';
    const [localPart, domain] = parts;
    if (localPart.length === 0 || localPart.length > 64) return 'Email address local part must be between 1 and 64 characters';
    if (domain.length === 0 || domain.length > 253) return 'Email domain must be between 1 and 253 characters';
    if (!domain.includes('.')) return 'Email domain must contain at least one dot';
    if (domain.split('.').some(part => part.length === 0)) return 'Email domain cannot have empty parts';
    return '';
  };
  const validatePassword = (v: string) => !v ? 'Password is required' : v.length < 8 ? 'Password must be at least 8 characters long' : v.length > 128 ? 'Password is too long (maximum 128 characters)' : !/[A-Z]/.test(v) ? 'Password must contain at least one uppercase letter' : !/[a-z]/.test(v) ? 'Password must contain at least one lowercase letter' : !/\d/.test(v) ? 'Password must contain at least one number' : ['password', '12345678', 'password123', 'admin123', 'qwerty123'].includes(v.toLowerCase()) ? 'Please choose a stronger password' : '';
  const validateConfirmPassword = (p: string, c: string) => !c ? 'Please confirm your password' : p !== c ? 'Passwords do not match' : '';
  const validateChurchName = (v: string) => !v.trim() ? 'Church name is required' : v.trim().length < 2 ? 'Church name must be at least 2 characters' : v.trim().length > 100 ? 'Church name must be no more than 100 characters' : '';
  const validatePhoneNumber = (v: string) => { const t = v.trim(); if (!t) return ''; const d = t.replace(/\D/g, ''); if (d.length < 10) return 'Phone number must be at least 10 digits'; if (d.length > 15) return 'Phone number is too long'; if (!/^[\+]?[[0-9\s\-\(\)]+$/.test(t)) return 'Please enter a valid phone number (e.g., +1 234 567 8900)'; return ''; };

  const handleFieldBlur = async (field: keyof RegisterFormData) => {
    let err = '';
    if (field === 'firstName') err = validateFirstName(formData.firstName);
    else if (field === 'lastName') err = validateLastName(formData.lastName);
    else if (field === 'email') { err = validateEmail(formData.email); if (!err) await checkEmailExists(formData.email); }
    else if (field === 'password') { err = validatePassword(formData.password); if (formData.confirmPassword) { const c = validateConfirmPassword(formData.password, formData.confirmPassword); setErrors(prev => ({ ...prev, confirmPassword: c })); } }
    else if (field === 'confirmPassword') err = validateConfirmPassword(formData.password, formData.confirmPassword);
    else if (field === 'churchName') err = validateChurchName(formData.churchName);
    else if (field === 'phoneNumber') err = validatePhoneNumber(formData.phoneNumber);
    setErrors(prev => ({ ...prev, [field]: err }));
  };

  const checkEmailExists = async (email: string) => {
    const trimmed = email.trim();
    if (!trimmed || validateEmail(trimmed)) return;
    setIsCheckingEmail(true);
    try {
      const exists = await authService.checkEmailExists(trimmed);
      if (exists) setErrors(prev => ({ ...prev, email: 'This email address is already registered. Please use a different email or sign in instead.' }));
      else setErrors(prev => { const e = { ...prev }; if (e.email?.includes('already registered')) delete e.email; return e; });
    } catch (e) {
      console.error('Error checking email existence:', e);
    } finally { setIsCheckingEmail(false); }
  };

  const validateForm = async () => {
    const e: Record<string, string> = {};
    const f = validateFirstName(formData.firstName); if (f) e.firstName = f;
    const l = validateLastName(formData.lastName); if (l) e.lastName = l;
    const em = validateEmail(formData.email); if (em) e.email = em; else { try { if (await authService.checkEmailExists(formData.email)) e.email = 'This email address is already registered. Please use a different email or sign in instead.'; } catch {} }
    const p = validatePassword(formData.password); if (p) e.password = p;
    const cp = validateConfirmPassword(formData.password, formData.confirmPassword); if (cp) e.confirmPassword = cp;
    const cn = validateChurchName(formData.churchName); if (cn) e.churchName = cn;
    const ph = validatePhoneNumber(formData.phoneNumber); if (ph) e.phoneNumber = ph;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    if (!(await validateForm())) { setIsLoading(false); return; }
    try {
      const churchName = formData.churchName.trim() || 'First Love Church';
      await authService.register(formData.email, formData.password, {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        churchName,
        phoneNumber: formData.phoneNumber.trim(),
        role: 'admin'
      });
      try {
        localStorage.setItem(getVariantDisplayNameKey(), formData.ministry.trim() || 'Ministry App');
      } catch {}
      showToast('success', 'Registration Successful!', `Welcome! ${formData.ministry} has been set as your ministry. You can change it later in Settings.`);
      onSuccess();
    } catch (error: any) {
      showToast('error', 'Registration Failed', getErrorMessage(error.message || error.code || error.toString()));
    } finally { setIsLoading(false); }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="relative">
              <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} onBlur={() => handleFieldBlur('firstName')} className={`w-full px-4 py-3.5 bg-gray-50/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white transition-all duration-200 placeholder-gray-400 ${errors.firstName ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} placeholder="First Name" required autoComplete="given-name" spellCheck="false" />
            </div>
            {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
          </div>
          <div>
            <div className="relative">
              <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} onBlur={() => handleFieldBlur('lastName')} className={`w-full px-4 py-3.5 bg-gray-50/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white transition-all duration-200 placeholder-gray-400 ${errors.lastName ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} placeholder="Last Name (optional)" autoComplete="family-name" spellCheck="false" />
            </div>
            {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
          </div>
        </div>
        <div>
          <div className="relative">
            <input type="email" name="email" value={formData.email} onChange={handleInputChange} onBlur={() => handleFieldBlur('email')} className={`w-full px-4 py-3.5 bg-gray-50/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white transition-all duration-200 placeholder-gray-400 ${errors.email ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} placeholder="Email address" required autoComplete="email" spellCheck="false" />
            {isCheckingEmail && (<div className="absolute right-3 top-1/2 transform -translate-y-1/2"><div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div></div>)}
          </div>
          {errors.email && (<p className="text-red-500 text-xs mt-1">{errors.email}</p>)}
          {isCheckingEmail && !errors.email && (<p className="text-blue-500 text-xs mt-1">Checking email availability...</p>)}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Ministry</label>
          <select name="ministry" value={formData.ministry} onChange={(e) => setFormData(prev => ({ ...prev, ministry: e.target.value }))} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white">
            {MINISTRY_OPTIONS.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
          </select>
          <p className="mt-1 text-xs text-gray-500">This becomes the app title as “FLC {formData.ministry}”. You can change it later in Settings.</p>
        </div>
        <div>
          <div className="relative">
            <input type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} onBlur={() => handleFieldBlur('phoneNumber')} className={`w-full px-4 py-3.5 bg-gray-50/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white transition-all duration-200 placeholder-gray-400 ${errors.phoneNumber ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} placeholder="Phone number (optional)" autoComplete="tel" />
          </div>
          {errors.phoneNumber && (<p className="text-red-500 text-xs mt-1">{errors.phoneNumber}</p>)}
        </div>
        <div>
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleInputChange} onBlur={() => handleFieldBlur('password')} className={`w-full pl-4 pr-12 py-3.5 bg-gray-50/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white transition-all duration-200 placeholder-gray-400 ${errors.password ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} placeholder="Password" required autoComplete="new-password" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1">
              {showPassword ? (<EyeSlashIcon className="w-4 h-4" />) : (<EyeIcon className="w-4 h-4" />)}
            </button>
          </div>
          {errors.password && (<p className="text-red-500 text-xs mt-1">{errors.password}</p>)}
        </div>
        <div>
          <div className="relative">
            <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} onBlur={() => handleFieldBlur('confirmPassword')} className={`w-full pl-4 pr-12 py-3.5 bg-gray-50/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white transition-all duration-200 placeholder-gray-400 ${errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} placeholder="Confirm password" required autoComplete="new-password" />
            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1">
              {showConfirmPassword ? (<EyeSlashIcon className="w-4 h-4" />) : (<EyeIcon className="w-4 h-4" />)}
            </button>
          </div>
          {errors.confirmPassword && (<p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>)}
        </div>
        <button type="submit" disabled={isLoading} className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01] transition-all duration-200 mt-6">
          {isLoading ? (<div className="flex items-center justify-center"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Creating Account...</div>) : ('Create Account')}
        </button>
      </form>
    </div>
  );
};

export default MinistryRegisterForm;
