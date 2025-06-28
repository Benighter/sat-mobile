import React, { useState, useRef } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { userService } from '../services/userService';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { 
  UserIcon, 
  CameraIcon, 
  TrashIcon,
  PhotoIcon,
  ExclamationTriangleIcon
} from './icons';

interface ProfileUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onUpdate?: () => void;
}

interface ProfileFormData {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  profilePicture: string;
}

const ProfileUpdateModal: React.FC<ProfileUpdateModalProps> = ({ 
  isOpen, 
  onClose, 
  currentUser, 
  onUpdate 
}) => {
  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: currentUser?.firstName || '',
    lastName: currentUser?.lastName || '',
    phoneNumber: currentUser?.phoneNumber || '',
    profilePicture: currentUser?.profilePicture || ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>(currentUser?.profilePicture || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useAppContext();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Invalid file type', 'Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showToast('error', 'File too large', 'Please select an image smaller than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      setImagePreview(base64String);
      setFormData(prev => ({ ...prev, profilePicture: base64String }));
    };
    reader.readAsDataURL(file);
  };

  const removeProfilePicture = () => {
    setImagePreview('');
    setFormData(prev => ({ ...prev, profilePicture: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (formData.phoneNumber && !/^[0-9+\-\s()]+$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const updates = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        displayName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
        phoneNumber: formData.phoneNumber.trim(),
        profilePicture: formData.profilePicture
      };

      await userService.updateUserProfile(currentUser.uid, updates);
      
      showToast('success', 'Profile Updated!', 'Your profile has been updated successfully');
      onUpdate?.();
      onClose();
    } catch (error: any) {
      showToast('error', 'Update Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (): string => {
    if (formData.firstName && formData.lastName) {
      return `${formData.firstName.charAt(0)}${formData.lastName.charAt(0)}`.toUpperCase();
    }
    return currentUser?.email?.charAt(0).toUpperCase() || 'U';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Profile"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Picture Section */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Profile preview"
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-2xl shadow-lg">
                {getInitials()}
              </div>
            )}
            
            {/* Camera overlay */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-700 transition-colors duration-200 shadow-lg"
              title="Change profile picture"
            >
              <CameraIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-2"
            >
              <PhotoIcon className="w-4 h-4" />
              <span>Choose Photo</span>
            </Button>
            
            {imagePreview && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={removeProfilePicture}
                className="flex items-center space-x-2"
              >
                <TrashIcon className="w-4 h-4" />
                <span>Remove</span>
              </Button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          
          <p className="text-xs text-gray-500 text-center">
            Upload a profile picture (max 2MB)
          </p>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Name *
            </label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                errors.firstName ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="John"
            />
            {errors.firstName && (
              <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last Name *
            </label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                errors.lastName ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Doe"
            />
            {errors.lastName && (
              <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number
          </label>
          <input
            type="tel"
            name="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
              errors.phoneNumber ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="+27 123 456 7890"
          />
          {errors.phoneNumber && (
            <p className="text-red-500 text-xs mt-1">{errors.phoneNumber}</p>
          )}
        </div>

        {/* Read-only fields */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          <h4 className="font-medium text-gray-700 flex items-center space-x-2">
            <ExclamationTriangleIcon className="w-4 h-4 text-gray-500" />
            <span>Account Information</span>
          </h4>
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Email:</span>
              <span className="ml-2 font-medium">{currentUser?.email}</span>
            </div>
            <div>
              <span className="text-gray-500">Church:</span>
              <span className="ml-2 font-medium">{currentUser?.churchName}</span>
            </div>
            <div>
              <span className="text-gray-500">Role:</span>
              <span className="ml-2 font-medium capitalize">{currentUser?.role}</span>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Contact your administrator to change email, church, or role.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading}
          >
            {isLoading ? 'Updating...' : 'Update Profile'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ProfileUpdateModal;
