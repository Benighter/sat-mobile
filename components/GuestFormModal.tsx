import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { Guest } from '../types';
import { XMarkIcon, UserPlusIcon } from './icons';
import Modal from './ui/Modal';
import Input from './ui/Input';
import Button from './ui/Button';
import Select from './ui/Select';

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
  const { addGuestHandler, updateGuestHandler, isLoading, bacentas } = useAppContext();

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

    // Bacenta is required
    if (!formData.bacentaId) {
      newErrors.bacentaId = 'Bacenta selection is required';
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
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <UserPlusIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {editingGuest ? 'Edit Guest' : 'Add Guest'}
              </h2>
              <p className="text-sm text-gray-600">
                {editingGuest ? 'Update guest information' : 'Add a new guest for Sunday service'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
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

          {/* Bacenta - Required */}
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

          {/* Room Number - Optional */}
          <Input
            label="Room Number"
            value={formData.roomNumber}
            onChange={(value) => handleInputChange('roomNumber', value)}
            placeholder="e.g., 101, A-205"
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
