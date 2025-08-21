import React, { useState, useEffect } from 'react';
import { 
  XMarkIcon,
  UserIcon,
  PhoneIcon,
  MapPinIcon,
  HeartIcon,
  StarIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  UserPlusIcon
} from '../icons';
import Button from '../ui/Button';

interface AttendeeDetails {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phoneNumber: string;
  address: string;
  isMember: boolean;
  memberId?: string;
  isBornAgain: boolean;
  isFirstTimer: boolean;
  isConvert: boolean;
  confirmForService: boolean;
  notes: string;
  meetingDate: string;
  bacentaId: string;
}

interface AttendeeDetailModalProps {
  attendee: AttendeeDetails;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedAttendee: AttendeeDetails) => void;
  onConvertToMember?: (attendee: AttendeeDetails) => Promise<void>;
}

const AttendeeDetailModal: React.FC<AttendeeDetailModalProps> = ({
  attendee,
  isOpen,
  onClose,
  onSave,
  onConvertToMember
}) => {
  const [formData, setFormData] = useState<AttendeeDetails>(attendee);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setFormData(attendee);
    setErrors({});
  }, [attendee]);

  const handleInputChange = (field: keyof AttendeeDetails, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    
    if (formData.phoneNumber && !/^[\d\s\-\+\(\)]+$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid phone number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;
    
    const updatedAttendee = {
      ...formData,
      fullName: `${formData.firstName} ${formData.lastName}`.trim()
    };
    
    onSave(updatedAttendee);
  };

  const handleConvertToMember = async () => {
    if (!validateForm()) return;
    
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setErrors({
        firstName: !formData.firstName.trim() ? 'First name is required for conversion' : '',
        lastName: !formData.lastName.trim() ? 'Last name is required for conversion' : ''
      });
      return;
    }
    
    if (!formData.phoneNumber.trim()) {
      setErrors({
        phoneNumber: 'Phone number is required for conversion'
      });
      return;
    }
    
    setLoading(true);
    try {
      if (onConvertToMember) {
        await onConvertToMember(formData);
        onClose();
      }
    } catch (error) {
      console.error('Failed to convert to member:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Attendee Details
              </h2>
              <p className="text-sm text-gray-600">
                Manage personal information and spiritual status
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <UserIcon className="w-5 h-5 mr-2 text-blue-600" />
              Personal Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.firstName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter first name"
                />
                {errors.firstName && (
                  <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.lastName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter last name"
                />
                {errors.lastName && (
                  <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <PhoneIcon className="w-4 h-4 inline mr-1" />
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.phoneNumber ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter phone number"
              />
              {errors.phoneNumber && (
                <p className="text-red-500 text-xs mt-1">{errors.phoneNumber}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPinIcon className="w-4 h-4 inline mr-1" />
                Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter address"
              />
            </div>
          </div>

          {/* Spiritual Status */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <HeartIcon className="w-5 h-5 mr-2 text-red-600" />
              Spiritual Status
            </h3>
            
            <div className="space-y-3">
              <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isBornAgain}
                  onChange={(e) => handleInputChange('isBornAgain', e.target.checked)}
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <div>
                  <div className="font-medium text-gray-900">Born Again</div>
                  <div className="text-sm text-gray-600">Has accepted Jesus Christ as Lord and Savior</div>
                </div>
              </label>
              
              <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isFirstTimer}
                  onChange={(e) => handleInputChange('isFirstTimer', e.target.checked)}
                  className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                />
                <div>
                  <div className="font-medium text-gray-900">First Timer</div>
                  <div className="text-sm text-gray-600">First time attending this bacenta</div>
                </div>
              </label>
              
              <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isConvert}
                  onChange={(e) => handleInputChange('isConvert', e.target.checked)}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <div>
                  <div className="font-medium text-gray-900">Convert</div>
                  <div className="text-sm text-gray-600">Gave their life to Christ today</div>
                </div>
              </label>
              
              <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.confirmForService}
                  onChange={(e) => handleInputChange('confirmForService', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">Confirm for Service</div>
                  <div className="text-sm text-gray-600">Confirmed to attend upcoming service</div>
                </div>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <DocumentTextIcon className="w-5 h-5 mr-2 text-gray-600" />
              Notes & Comments
            </h3>
            
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Add any additional notes or comments..."
            />
          </div>

          {/* Member Status */}
          {formData.isMember && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <CheckCircleIcon className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-900">This person is already a member</span>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                Changes will update their existing member record.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>
          
          <div className="flex space-x-3">
            <Button
              variant="primary"
              onClick={handleSave}
            >
              Save Details
            </Button>
            
            {!formData.isMember && onConvertToMember && (
              <Button
                variant="success"
                onClick={handleConvertToMember}
                loading={loading}
                leftIcon={<UserPlusIcon className="w-4 h-4" />}
              >
                Convert to Member
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendeeDetailModal;
