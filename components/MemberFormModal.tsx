
import React, { useState, useEffect } from 'react';
import { Member } from '../types';
import { useAppContext } from '../contexts/SimpleFirebaseContext';
import Modal from './ui/Modal';
import Input from './ui/Input';
import Checkbox from './ui/Checkbox';
import Button from './ui/Button';
import { formatDateToYYYYMMDD } from '../utils/dateUtils';

interface MemberFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
}

const MemberFormModal: React.FC<MemberFormModalProps> = ({ isOpen, onClose, member }) => {
  const { addMemberHandler, updateMemberHandler, bacentas, currentTab } = useAppContext();

  // Check if we're currently in a specific bacenta (not dashboard/fixed tabs)
  const isInSpecificBacenta = currentTab && bacentas.some(b => b.id === currentTab.id);
  const currentBacentaId = isInSpecificBacenta ? currentTab.id : '';
  const currentBacentaName = isInSpecificBacenta ? currentTab.name : '';

  const initialFormData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'> = {
    firstName: '',
    lastName: '',
    phoneNumber: '',
    buildingAddress: '',
    bornAgainStatus: false,
    bacentaId: currentBacentaId || (bacentas.length > 0 ? bacentas[0].id : ''),
    joinedDate: formatDateToYYYYMMDD(new Date()), // Default to today for new members
  };
  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (member) {
      setFormData({
        firstName: member.firstName,
        lastName: member.lastName,
        phoneNumber: member.phoneNumber,
        buildingAddress: member.buildingAddress,
        bornAgainStatus: member.bornAgainStatus,
        bacentaId: member.bacentaId,
        joinedDate: member.joinedDate ? member.joinedDate : formatDateToYYYYMMDD(new Date(member.createdDate)), // Use existing or fallback
      });
    } else {
      // For new members, default to current bacenta if we're in one
      const defaultBacentaId = currentBacentaId || (bacentas.length > 0 ? bacentas[0].id : '');
      setFormData({
        ...initialFormData,
        bacentaId: defaultBacentaId,
        joinedDate: formatDateToYYYYMMDD(new Date()), // Default for new
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

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required.';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required.';
    if (!formData.joinedDate) newErrors.joinedDate = 'Joined date is required.';
    else {
        // Basic validation for YYYY-MM-DD format, though type="date" input helps
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if(!datePattern.test(formData.joinedDate)) {
            newErrors.joinedDate = 'Joined date must be in YYYY-MM-DD format.';
        } else {
            const dateObj = new Date(formData.joinedDate);
            if (isNaN(dateObj.getTime())) { // Check if date is valid
                 newErrors.joinedDate = 'Invalid joined date.';
            }
        }
    }
    if (formData.phoneNumber && !/^[0-9().+\-\s]+$/.test(formData.phoneNumber)) { // Allow more chars for phone
        newErrors.phoneNumber = 'Phone number format is invalid.';
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
    <Modal isOpen={isOpen} onClose={onClose} title={member ? 'Edit Member' : 'Add New Member'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Context-aware message for adding members to specific bacenta */}
        {isInSpecificBacenta && !member && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-sm">👥</span>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-blue-800 mb-1">Adding to {currentBacentaName}</h4>
                <p className="text-sm text-blue-700">
                  This member will be automatically added to <strong>{currentBacentaName}</strong>.
                  To add members to a different Bacenta, go to the Dashboard first.
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input 
            label="First Name" 
            name="firstName" 
            value={formData.firstName} 
            onChange={handleChange} 
            error={errors.firstName}
            required 
          />
          <Input 
            label="Last Name" 
            name="lastName" 
            value={formData.lastName} 
            onChange={handleChange} 
            error={errors.lastName}
            required 
          />
        </div>
        <Input 
          label="Phone Number" 
          name="phoneNumber"
          type="tel"
          value={formData.phoneNumber} 
          onChange={handleChange} 
          error={errors.phoneNumber}
          placeholder="e.g., (555) 123-4567"
        />
        <Input 
          label="Building/Home Address" 
          name="buildingAddress" 
          value={formData.buildingAddress} 
          onChange={handleChange} 
          error={errors.buildingAddress}
        />
         <Input
            label="Joined Date"
            name="joinedDate"
            type="date" // HTML5 date input
            value={formData.joinedDate}
            onChange={handleChange}
            error={errors.joinedDate}
            required
        />
        <div>
          <label htmlFor="bacentaId" className="block text-sm font-medium text-gray-700 mb-1">Bacenta</label>
          {isInSpecificBacenta && !member ? (
            // When adding a new member from within a specific bacenta, show read-only field
            <div className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-700">
              <div className="flex items-center justify-between">
                <span className="font-medium">{currentBacentaName}</span>
                <span className="text-xs text-gray-500 bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  Current Bacenta
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Adding member to current Bacenta. Switch to Dashboard to choose a different Bacenta.
              </p>
            </div>
          ) : (
            // When editing a member or adding from dashboard, show dropdown
            <select
              id="bacentaId"
              name="bacentaId"
              value={formData.bacentaId}
              onChange={handleChange}
              className={`w-full px-3 py-2 border ${errors.bacentaId ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-2 ${errors.bacentaId ? 'focus:ring-red-500' : 'focus:ring-blue-500'} focus:border-transparent transition-colors`}
            >
              <option value="">Unassigned</option>
              {bacentas.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          {errors.bacentaId && <p className="mt-1 text-xs text-red-600">{errors.bacentaId}</p>}
        </div>
        <Checkbox 
            label="Born Again Status"
            name="bornAgainStatus"
            checked={formData.bornAgainStatus}
            onChange={handleChange}
            error={errors.bornAgainStatus}
        />
        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">{member ? 'Save Changes' : 'Add Member'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default MemberFormModal;
