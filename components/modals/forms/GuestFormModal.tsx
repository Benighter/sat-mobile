import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../../contexts/FirebaseAppContext';
import { Guest } from '../../../types';
import { UserPlusIcon } from '../../icons';
import Modal from '../../ui/Modal';
import Input from '../../ui/Input';
import Button from '../../ui/Button';
import Select from '../../ui/Select';

interface GuestFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingGuest?: Guest | null;
}

const GuestFormModal: React.FC<GuestFormModalProps> = ({
  isOpen,
  onClose,
  editingGuest
}) => {
  const { addGuestHandler, updateGuestHandler, isLoading, bacentas, isMinistryContext, activeMinistryName } = useAppContext();

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    bacentaId: '',
    roomNumber: '',
    phoneNumber: '',
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens/closes or editing guest changes
  useEffect(() => {
    if (isOpen) {
      if (editingGuest) {
        setFormData({
          firstName: editingGuest.firstName || '',
          lastName: editingGuest.lastName || '',
          bacentaId: editingGuest.bacentaId || '',
          roomNumber: editingGuest.roomNumber || '',
          phoneNumber: editingGuest.phoneNumber || '',
          notes: editingGuest.notes || ''
        });
      } else {
        setFormData({
          firstName: '',
          lastName: '',
          bacentaId: '',
          roomNumber: '',
          phoneNumber: '',
          notes: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, editingGuest]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // First name is required
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    // Bacenta is required unless in ministry mode
    if (!isMinistryContext && !formData.bacentaId) {
      newErrors.bacentaId = 'Bacenta selection is required';
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
    
    if (!validateForm()) {
      return;
    }

    try {
      // Build guest data object, omitting undefined fields for Firestore
      const guestData: Omit<Guest, 'id' | 'createdDate' | 'lastUpdated' | 'createdBy'> = {
        firstName: formData.firstName.trim(),
        bacentaId: formData.bacentaId
      };

      // Only include optional fields if they have values
      const lastName = formData.lastName.trim();
      if (lastName) {
        guestData.lastName = lastName;
      }

      const roomNumber = formData.roomNumber.trim();
      if (roomNumber) {
        guestData.roomNumber = roomNumber;
      }

      const phoneNumber = formData.phoneNumber.trim();
      if (phoneNumber) {
        guestData.phoneNumber = phoneNumber;
      }

      const notes = formData.notes.trim();
      if (notes) {
        guestData.notes = notes;
      }

      if (editingGuest) {
        await updateGuestHandler({
          ...editingGuest,
          ...guestData,
          lastUpdated: new Date().toISOString()
        });
      } else {
        await addGuestHandler(guestData);
      }

      onClose();
    } catch (error) {
      console.error('Failed to save guest:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingGuest ? 'Edit Guest' : 'Add Guest'}
      size="md"
    >
      <div className="p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
            <UserPlusIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-dark-300">
            {editingGuest ? 'Update guest information' : 'Add a new guest for Sunday service'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* First Name - Required */}
          <Input
            label="First Name"
            value={formData.firstName}
            onChange={(value) => handleInputChange('firstName', value)}
            error={errors.firstName}
            placeholder="Enter first name"
            required
          />

          {/* Last Name - Optional */}
          <Input
            label="Last Name"
            value={formData.lastName}
            onChange={(value) => handleInputChange('lastName', value)}
            placeholder="Enter last name (optional)"
          />

          {/* Bacenta - Required unless Ministry Mode */}
          {!isMinistryContext ? (
            <Select
              label="Bacenta"
              value={formData.bacentaId}
              onChange={(value) => handleInputChange('bacentaId', value)}
              error={errors.bacentaId}
              required
            >
              <option value="">Select a Bacenta</option>
              {bacentas && bacentas.length > 0 ? (
                bacentas.map((bacenta) => (
                  <option key={bacenta.id} value={bacenta.id}>
                    {bacenta.name}
                  </option>
                ))
              ) : (
                <option value="" disabled>No Bacentas available</option>
              )}
            </Select>
          ) : (
            <div className="w-full px-3 py-2 border border-green-200 rounded-md shadow-sm bg-green-50 text-green-800">
              <div className="flex items-center justify-between">
                <span className="font-medium">Ministry Mode</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">{activeMinistryName || 'Selected Ministry'}</span>
              </div>
              <p className="text-xs mt-1">Guests will be added to the ministry. Bacenta selection is not required.</p>
            </div>
          )}

          {/* Room Number - Optional */}
          <Input
            label="Room Number"
            value={formData.roomNumber}
            onChange={(value) => handleInputChange('roomNumber', value)}
            error={errors.roomNumber}
            placeholder="e.g., 101, A-205"
            maxLength={20}
            pattern="[A-Za-z0-9\-\.\/\s]+"
            title="Room number should contain only letters, numbers, dashes, dots, or slashes"
          />

          {/* Phone Number - Optional */}
          <Input
            label="Phone Number"
            value={formData.phoneNumber}
            onChange={(value) => handleInputChange('phoneNumber', value)}
            placeholder="Enter phone number (optional)"
            type="tel"
          />

          {/* Notes - Optional */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Additional notes about the guest (optional)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
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
              loading={isLoading}
            >
              {editingGuest ? 'Update Guest' : 'Add Guest'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default GuestFormModal;
