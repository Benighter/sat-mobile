import React, { useState, useEffect } from 'react';
import { NewBeliever } from '../types';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { formatDateToYYYYMMDD } from '../utils/dateUtils';
import { MINISTRY_OPTIONS } from '../constants';
import Modal from './ui/Modal';
import Input from './ui/Input';
import Checkbox from './ui/Checkbox';
import Button from './ui/Button';

interface NewBelieverFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  newBeliever: NewBeliever | null; // Current new believer for editing, or null for new
}

const NewBelieverFormModal: React.FC<NewBelieverFormModalProps> = ({ isOpen, onClose, newBeliever }) => {
  const { addNewBelieverHandler, updateNewBelieverHandler } = useAppContext();

  const initialFormData: Omit<NewBeliever, 'id' | 'createdDate' | 'lastUpdated'> = {
    name: '',
    surname: '',
    contact: '',
    dateOfBirth: '',
    residence: '',
    studies: '',
    campus: '',
    occupation: '',
    year: '',
    isFirstTime: false,
    ministry: '',
    joinedDate: formatDateToYYYYMMDD(new Date()), // Default to today
  };

  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (newBeliever) {
      setFormData({
        name: newBeliever.name,
        surname: newBeliever.surname,
        contact: newBeliever.contact,
        dateOfBirth: newBeliever.dateOfBirth,
        residence: newBeliever.residence,
        studies: newBeliever.studies,
        campus: newBeliever.campus,
        occupation: newBeliever.occupation,
        year: newBeliever.year,
        isFirstTime: newBeliever.isFirstTime,
        ministry: newBeliever.ministry,
        joinedDate: newBeliever.joinedDate,
      });
    } else {
      setFormData({
        ...initialFormData,
        joinedDate: formatDateToYYYYMMDD(new Date()),
      });
    }
    setErrors({});
  }, [newBeliever, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Only name is mandatory
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    // Validate date format if provided
    if (formData.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(formData.dateOfBirth)) {
      newErrors.dateOfBirth = 'Please enter a valid date';
    }

    if (formData.joinedDate && !/^\d{4}-\d{2}-\d{2}$/.test(formData.joinedDate)) {
      newErrors.joinedDate = 'Please enter a valid date';
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
      if (newBeliever) {
        await updateNewBelieverHandler({ ...newBeliever, ...formData });
      } else {
        await addNewBelieverHandler(formData);
      }
      onClose();
    } catch (error) {
      console.error('Error saving new believer:', error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={newBeliever ? 'Edit New Believer' : 'Add New Believer'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {!newBeliever && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-sm">🌱</span>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-green-800 mb-1">Welcome New Believer!</h4>
                <p className="text-sm text-green-700">
                  Only the name field is required. Fill in as much information as available to help with follow-up and ministry assignment.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Name and Surname */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input 
            label="Name" 
            name="name" 
            value={formData.name} 
            onChange={handleChange} 
            error={errors.name}
            required 
            placeholder="Enter first name"
          />
          <Input 
            label="Surname" 
            name="surname" 
            value={formData.surname} 
            onChange={handleChange} 
            error={errors.surname}
            placeholder="Enter last name"
          />
        </div>

        {/* Contact and Date of Birth */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input 
            label="Contact" 
            name="contact"
            type="tel"
            value={formData.contact} 
            onChange={handleChange} 
            error={errors.contact}
            placeholder="Phone number or email"
          />
          <Input
            label="Date of Birth"
            name="dateOfBirth"
            type="date"
            value={formData.dateOfBirth}
            onChange={handleChange}
            error={errors.dateOfBirth}
          />
        </div>

        {/* Residence and Studies */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input 
            label="Residence" 
            name="residence" 
            value={formData.residence} 
            onChange={handleChange} 
            error={errors.residence}
            placeholder="Where they live"
          />
          <Input 
            label="Studies" 
            name="studies" 
            value={formData.studies} 
            onChange={handleChange} 
            error={errors.studies}
            placeholder="Field of study or education"
          />
        </div>

        {/* Campus and Occupation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input 
            label="Campus" 
            name="campus" 
            value={formData.campus} 
            onChange={handleChange} 
            error={errors.campus}
            placeholder="School or university campus"
          />
          <Input 
            label="Occupation" 
            name="occupation" 
            value={formData.occupation} 
            onChange={handleChange} 
            error={errors.occupation}
            placeholder="Job or profession"
          />
        </div>

        {/* Year and Joined Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input 
            label="Year" 
            name="year" 
            value={formData.year} 
            onChange={handleChange} 
            error={errors.year}
            placeholder="Academic year or year of study"
          />
          <Input
            label="Joined Date"
            name="joinedDate"
            type="date"
            value={formData.joinedDate}
            onChange={handleChange}
            error={errors.joinedDate}
            required
          />
        </div>

        {/* Ministry Dropdown */}
        <div>
          <label htmlFor="ministry" className="block text-sm font-medium text-gray-700 mb-1">Ministry Interest</label>
          <select
            id="ministry"
            name="ministry"
            value={formData.ministry}
            onChange={handleChange}
            className={`w-full px-3 py-2 border ${errors.ministry ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-2 ${errors.ministry ? 'focus:ring-red-500' : 'focus:ring-blue-500'} focus:border-transparent transition-colors`}
          >
            <option value="">Select a ministry (optional)</option>
            {MINISTRY_OPTIONS.map(ministry => (
              <option key={ministry} value={ministry}>{ministry}</option>
            ))}
          </select>
          {errors.ministry && <p className="mt-1 text-xs text-red-600">{errors.ministry}</p>}
        </div>

        {/* First Time Checkbox */}
        <Checkbox 
          label="First Time Visitor?"
          name="isFirstTime"
          checked={formData.isFirstTime}
          onChange={handleChange}
          error={errors.isFirstTime}
        />

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">{newBeliever ? 'Save Changes' : 'Add New Believer'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default NewBelieverFormModal;
