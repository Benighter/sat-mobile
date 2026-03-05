import React, { useState, useEffect } from 'react';
import { CustomPrayer, CustomPrayerCategory } from '../../types';
import { validateCustomPrayer, isOvernightPrayer, calculatePrayerDuration } from '../../utils/customPrayerUtils';

interface CustomPrayerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (prayer: Omit<CustomPrayer, 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => Promise<void>;
  prayer?: CustomPrayer | null;
  memberId: string;
}

const CustomPrayerFormModal: React.FC<CustomPrayerFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  prayer,
  memberId
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<CustomPrayerCategory>('Personal');
  const [customCategory, setCustomCategory] = useState('');
  const [days, setDays] = useState({
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
    sunday: false
  });
  const [startTime, setStartTime] = useState('05:00');
  const [endTime, setEndTime] = useState('06:00');
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Initialize form when modal opens or prayer changes
  useEffect(() => {
    if (isOpen) {
      if (prayer) {
        setName(prayer.name);
        setCategory(prayer.category);
        setCustomCategory(prayer.customCategory || '');
        setDays(prayer.days);
        setStartTime(prayer.startTime);
        setEndTime(prayer.endTime);
        setIsActive(prayer.isActive);
      } else {
        // Reset to defaults
        setName('');
        setCategory('Personal');
        setCustomCategory('');
        setDays({
          monday: false,
          tuesday: false,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
          sunday: false
        });
        setStartTime('05:00');
        setEndTime('06:00');
        setIsActive(true);
      }
      setErrors([]);
    }
  }, [isOpen, prayer]);

  const handleDayToggle = (day: keyof typeof days) => {
    setDays(prev => ({ ...prev, [day]: !prev[day] }));
  };

  const handleSave = async () => {
    const prayerData: Partial<CustomPrayer> = {
      id: prayer?.id || '',
      memberId,
      name: name.trim(),
      category,
      customCategory: category === 'Other' ? customCategory.trim() : undefined,
      days,
      startTime,
      endTime,
      isActive
    };

    const validationErrors = validateCustomPrayer(prayerData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSaving(true);
    setErrors([]);

    try {
      await onSave(prayerData as Omit<CustomPrayer, 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>);
      onClose();
    } catch (error: any) {
      setErrors([error.message || 'Failed to save custom prayer']);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const isOvernight = isOvernightPrayer(startTime, endTime);
  const duration = calculatePrayerDuration(startTime, endTime);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-xl">
          <h2 className="text-xl font-semibold text-white">
            {prayer ? 'Edit Custom Prayer' : 'Add Custom Prayer'}
          </h2>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-red-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                  <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Prayer Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prayer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Morning Prayer, Night Vigil"
              maxLength={50}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">{name.length}/50 characters</p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CustomPrayerCategory)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Personal">Personal Prayer</option>
              <option value="All-night Vigil">All-night Vigil</option>
              <option value="Quiet Time">Quiet Time</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Custom Category (shown when "Other" is selected) */}
          {category === 'Other' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Category Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Enter custom category name"
                maxLength={30}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          {/* Days of Week */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Days of Week <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(days).map(([day, isSelected]) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayToggle(day as keyof typeof days)}
                  className={`px-4 py-2 rounded-lg border-2 font-medium transition-all ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'
                  }`}
                >
                  {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Time Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Duration Display */}
          <div className={`p-4 rounded-lg ${isOvernight ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50 border border-gray-200'}`}>
            <div className="flex items-center space-x-2">
              {isOvernight && (
                <span className="text-2xl">🌙</span>
              )}
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Duration: {duration.toFixed(1)} hours
                </p>
                {isOvernight && (
                  <p className="text-xs text-purple-700 mt-1">
                    This prayer session crosses midnight (overnight prayer)
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              Active (uncheck to temporarily disable this prayer)
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-xl flex justify-end space-x-3 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : prayer ? 'Update Prayer' : 'Add Prayer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomPrayerFormModal;

