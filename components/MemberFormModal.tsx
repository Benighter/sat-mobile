
import React, { useState, useEffect } from 'react';
import { Member, MemberRole } from '../types';
import { useAppContext } from '../contexts/FirebaseAppContext';
import Modal from './ui/Modal';
import Input from './ui/Input';
import Select from './ui/Select';
import Checkbox from './ui/Checkbox';
import Button from './ui/Button';
import ImageUpload from './ui/ImageUpload';
import { formatDateToYYYYMMDD } from '../utils/dateUtils';
import { canAssignMemberRoles } from '../utils/permissionUtils';
import { User, MapPin, Phone, Home, Users, Shield } from 'lucide-react';

interface MemberFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
}

const MemberFormModal: React.FC<MemberFormModalProps> = ({ isOpen, onClose, member }) => {
  const { addMemberHandler, updateMemberHandler, bacentas, currentTab, userProfile } = useAppContext();

  // Check if user can assign roles
  const canAssignRoles = canAssignMemberRoles(userProfile);

  // Check if we're currently in a specific bacenta (not dashboard/fixed tabs)
  const isInSpecificBacenta = currentTab && bacentas.some(b => b.id === currentTab.id);
  const currentBacentaId = isInSpecificBacenta ? currentTab.id : '';
  const currentBacentaName = isInSpecificBacenta ? currentTab.name : '';

  const initialFormData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'> = {
    firstName: '',
    lastName: '',
    phoneNumber: '',
    buildingAddress: '',
    roomNumber: '',
    profilePicture: '',
    bornAgainStatus: false,
    bacentaId: currentBacentaId || (bacentas.length > 0 ? bacentas[0].id : ''),
    role: 'Member' as MemberRole, // Default role is Member
  };
  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (member) {
      setFormData({
        firstName: member.firstName,
        lastName: member.lastName || '',
        phoneNumber: member.phoneNumber,
        buildingAddress: member.buildingAddress,
        roomNumber: member.roomNumber || '',
        profilePicture: member.profilePicture || '',
        bornAgainStatus: member.bornAgainStatus,
        bacentaId: member.bacentaId,
        role: member.role || 'Member', // Default to Member if role is not set (for backward compatibility)
      });
    } else {
      // For new members, default to current bacenta if we're in one
      const defaultBacentaId = currentBacentaId || (bacentas.length > 0 ? bacentas[0].id : '');
      setFormData({
        ...initialFormData,
        bacentaId: defaultBacentaId,
      });
    }
    setErrors({});
  }, [isOpen, member, bacentas, currentBacentaId]); // Added currentBacentaId dependency

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleImageChange = (base64: string | null) => {
    setFormData(prev => ({ ...prev, profilePicture: base64 || '' }));
  };

  const handleRoomNumberChange = (value: string) => {
    setFormData(prev => ({ ...prev, roomNumber: value }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required.';
    // Last name is now optional - removed validation
    if (formData.phoneNumber && !/^[0-9().+\-\s]+$/.test(formData.phoneNumber)) { // Allow more chars for phone
        newErrors.phoneNumber = 'Phone number format is invalid.';
    }
    // Room number validation - allow common room number formats
    if (formData.roomNumber && formData.roomNumber.trim()) {
      const roomNumber = formData.roomNumber.trim();
      // Allow formats like: 101, A-205, B1, 2A, Room 101, Apt 2B, etc.
      if (!/^[A-Za-z0-9\-\.\/\s]{1,20}$/.test(roomNumber)) {
        newErrors.roomNumber = 'Room number format is invalid. Use letters, numbers, dashes, dots, or slashes only (max 20 characters).';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (member) {
      await updateMemberHandler({ ...member, ...formData });
    } else {
      await addMemberHandler(formData);
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="lg">
      <div className="p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {member ? 'Edit Member' : 'Add New Member'}
          </h2>
          <p className="text-gray-600">
            {member ? 'Update member information' : 'Add a new member to your community'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Profile Picture Section */}
          <div className="flex flex-col items-center space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Profile Photo</h3>
              <p className="text-sm text-gray-500">Upload a profile picture (optional)</p>
            </div>
            <ImageUpload
              value={formData.profilePicture}
              onChange={handleImageChange}
              size="lg"
            />
          </div>

          {/* Context-aware message for adding members to specific bacenta */}
          {isInSpecificBacenta && !member && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <Users className="w-5 h-5 text-blue-600 mt-0.5" />
                </div>
                <div>
                  <h4 className="font-medium text-blue-800 mb-1">Adding to {currentBacentaName}</h4>
                  <p className="text-sm text-blue-700">
                    This member will be automatically assigned to the <strong>{currentBacentaName}</strong> bacenta.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Personal Information */}
          <div className="space-y-6">
            <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
              <User className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  First Name <span className="text-red-500">*</span>
                </label>
                <Input
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  error={errors.firstName}
                  placeholder="Enter first name"
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <Input
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  error={errors.lastName}
                  placeholder="Enter last name"
                  className="h-12"
                />
              </div>
            </div>
          </div>
          {/* Contact Information */}
          <div className="space-y-6">
            <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
              <Phone className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <Input
                name="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={handleChange}
                error={errors.phoneNumber}
                placeholder="e.g., (555) 123-4567"
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Home Address
              </label>
              <Input
                name="buildingAddress"
                value={formData.buildingAddress}
                onChange={handleChange}
                error={errors.buildingAddress}
                placeholder="Enter home address"
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Room Number
              </label>
              <Input
                name="roomNumber"
                value={formData.roomNumber}
                onChange={handleRoomNumberChange}
                error={errors.roomNumber}
                placeholder="e.g., 101, A-205"
                maxLength={20}
                pattern="[A-Za-z0-9\-\.\/\s]+"
                title="Room number should contain only letters, numbers, dashes, dots, or slashes"
                className="h-12"
              />
            </div>
          </div>

          {/* Church Information */}
          <div className="space-y-6">
            <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
              <Home className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Church Information</h3>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Bacenta
                </label>
                {isInSpecificBacenta && !member ? (
                  <div className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-gray-50 text-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{currentBacentaName}</span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        Current Bacenta
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Adding member to current Bacenta. Switch to Dashboard to choose a different Bacenta.
                    </p>
                  </div>
                ) : (
                  <select
                    name="bacentaId"
                    value={formData.bacentaId}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border ${errors.bacentaId ? 'border-red-500' : 'border-gray-300'} rounded-lg shadow-sm focus:outline-none focus:ring-2 ${errors.bacentaId ? 'focus:ring-red-500' : 'focus:ring-blue-500'} focus:border-transparent transition-colors h-12`}
                  >
                    <option value="">Select a Bacenta</option>
                    {bacentas.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                )}
                {errors.bacentaId && <p className="mt-1 text-xs text-red-600">{errors.bacentaId}</p>}
              </div>

              {canAssignRoles && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    <Shield className="w-4 h-4 inline mr-1" />
                    Role
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border ${errors.role ? 'border-red-500' : 'border-gray-300'} rounded-lg shadow-sm focus:outline-none focus:ring-2 ${errors.role ? 'focus:ring-red-500' : 'focus:ring-blue-500'} focus:border-transparent transition-colors h-12`}
                  >
                    <option value="Member">Member</option>
                    <option value="Fellowship Leader">Fellowship Leader</option>
                    <option value="Bacenta Leader">Bacenta Leader</option>
                  </select>
                  {errors.role && <p className="mt-1 text-xs text-red-600">{errors.role}</p>}
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="bornAgainStatus"
                    name="bornAgainStatus"
                    checked={formData.bornAgainStatus}
                    onChange={handleChange}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <label htmlFor="bornAgainStatus" className="text-sm font-medium text-gray-700">
                    Born Again Status
                  </label>
                </div>
                <p className="text-xs text-gray-500 ml-8">Check if this member has been born again</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="px-6 py-3"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="px-6 py-3"
            >
              {member ? 'Update Member' : 'Add Member'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default MemberFormModal;
