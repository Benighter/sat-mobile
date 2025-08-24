import React, { useState } from 'react';
import { Building2, MapPin, Phone, Mail, Globe } from 'lucide-react';
import { userService } from '../../services/userService';

interface ChurchSetupModalProps {
  isOpen: boolean;
  onComplete: () => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

interface ChurchFormData {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  timezone: string;
}

const ChurchSetupModal: React.FC<ChurchSetupModalProps> = ({ isOpen, onComplete, showToast }) => {
  const [formData, setFormData] = useState<ChurchFormData>({
    name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<ChurchFormData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<ChurchFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Church name is required';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Church address is required';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (formData.website && !formData.website.match(/^https?:\/\/.+/)) {
      newErrors.website = 'Please enter a valid website URL (starting with http:// or https://)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    
    if (!validateForm()) {
      return;
    }

  setIsLoading(true);
    try {
      // Create church and update user profile
      await userService.createChurchAndUpdateUser({
        name: formData.name.trim(),
        address: formData.address.trim(),
        contactInfo: {
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          website: formData.website.trim()
        },
        settings: {
          timezone: formData.timezone,
          defaultMinistries: ['choir', 'ushers', 'media', 'security']
        }
      });

      showToast('success', 'Church Setup Complete!', 
        `Welcome to ${formData.name}! You can now start managing your church data.`);
      onComplete();
    } catch (error: any) {
      showToast('error', 'Setup Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof ChurchFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 z-50 flex items-center justify-center p-4">
      <div className="relative bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <Building2 className="w-6 h-6 text-blue-300" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Set Up Your Church</h2>
                <p className="text-gray-300 text-sm">Complete your church profile to get started</p>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
  <form onSubmit={handleSubmit} className="p-6 space-y-6" aria-busy={isLoading}>
          {/* Church Name */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Church Name *
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full pl-10 pr-10 sm:pr-12 py-3 text-center bg-white/10 border rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  errors.name ? 'border-red-400' : 'border-white/20'
                }`}
                placeholder="Enter your church name"
              />
            </div>
            {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Church Address *
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <textarea
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                rows={3}
                className={`w-full pl-10 pr-10 sm:pr-12 py-3 text-center bg-white/10 border rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none ${
                  errors.address ? 'border-red-400' : 'border-white/20'
                }`}
                placeholder="Enter your church address"
              />
            </div>
            {errors.address && <p className="text-red-400 text-sm mt-1">{errors.address}</p>}
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full pl-10 pr-10 sm:pr-12 py-3 text-center bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`w-full pl-10 pr-10 sm:pr-12 py-3 text-center bg-white/10 border rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                    errors.email ? 'border-red-400' : 'border-white/20'
                  }`}
                  placeholder="contact@yourchurch.com"
                />
              </div>
              {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email}</p>}
            </div>
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Website (Optional)
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="url"
                value={formData.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
                className={`w-full pl-10 pr-10 sm:pr-12 py-3 text-center bg-white/10 border rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  errors.website ? 'border-red-400' : 'border-white/20'
                }`}
                placeholder="https://www.yourchurch.com"
              />
            </div>
            {errors.website && <p className="text-red-400 text-sm mt-1">{errors.website}</p>}
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Timezone
            </label>
            <select
              value={formData.timezone}
              onChange={(e) => handleInputChange('timezone', e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="America/Anchorage">Alaska Time (AKT)</option>
              <option value="Pacific/Honolulu">Hawaii Time (HST)</option>
            </select>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 text-white rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Setting up your church...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128v-2.88a3 3 0 00-3-3H6a3 3 0 00-3 3v2.88M8.25 9.75A3.75 3.75 0 108.25 2.25a3.75 3.75 0 000 7.5zM20.25 19.128V17.25a3 3 0 00-2.25-2.904M18.75 8.25a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                  <span>Complete Church Setup</span>
                </>
              )}
            </button>
          </div>
        </form>
        {isLoading && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] rounded-2xl flex items-center justify-center z-10">
            <div className="bg-white/90 px-4 py-2 rounded-lg shadow text-sm font-medium flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Processing…
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChurchSetupModal;
