import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '../icons';
import { PrayerSchedule } from '../../types';

interface EditPrayerTimesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (schedule: Omit<PrayerSchedule, 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>, isPermanent: boolean) => Promise<void>;
  weekStart: string; // Tuesday date (YYYY-MM-DD)
  currentSchedule?: PrayerSchedule; // Existing schedule for this week or default
  defaultSchedule?: PrayerSchedule; // The permanent default schedule
}

const EditPrayerTimesModal: React.FC<EditPrayerTimesModalProps> = ({
  isOpen,
  onClose,
  onSave,
  weekStart,
  currentSchedule,
  defaultSchedule
}) => {
  const [isPermanent, setIsPermanent] = useState(false);
  const [times, setTimes] = useState({
    tuesday: { start: '04:30', end: '06:30' },
    wednesday: { start: '04:00', end: '06:00' },
    thursday: { start: '04:00', end: '06:00' },
    friday: { start: '04:30', end: '06:30' },
    saturday: { start: '05:00', end: '07:00' },
    sunday: { start: '05:00', end: '07:00' }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize times when modal opens
  useEffect(() => {
    if (isOpen) {
      // Use current schedule if available, otherwise use default schedule, otherwise use hardcoded defaults
      const scheduleToUse = currentSchedule || defaultSchedule;
      if (scheduleToUse) {
        setTimes(scheduleToUse.times);
        setIsPermanent(scheduleToUse.isPermanent || false);
      } else {
        // Reset to hardcoded defaults
        setTimes({
          tuesday: { start: '04:30', end: '06:30' },
          wednesday: { start: '04:00', end: '06:00' },
          thursday: { start: '04:00', end: '06:00' },
          friday: { start: '04:30', end: '06:30' },
          saturday: { start: '05:00', end: '07:00' },
          sunday: { start: '05:00', end: '07:00' }
        });
        setIsPermanent(false);
      }
      setSaveSuccess(false);
    }
  }, [isOpen, currentSchedule, defaultSchedule]);

  const handleTimeChange = (day: keyof typeof times, field: 'start' | 'end', value: string) => {
    setTimes(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const schedule: Omit<PrayerSchedule, 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> = {
        id: isPermanent ? 'default' : weekStart,
        weekStart: isPermanent ? undefined : weekStart,
        isPermanent,
        times
      };
      await onSave(schedule, isPermanent);
      setSaveSuccess(true);
      // Close modal after a brief delay to show success message
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (error) {
      console.error('Failed to save prayer schedule:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const days: Array<{ key: keyof typeof times; label: string }> = [
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 rounded-t-xl flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Edit Prayer Times</h2>
            <p className="text-sm text-blue-100 mt-1">
              Week of {new Date(weekStart + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            disabled={isSaving}
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Permanent vs Week-specific toggle */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isPermanent}
                onChange={(e) => setIsPermanent(e.target.checked)}
                className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="font-semibold text-blue-900">Make this schedule permanent</div>
                <div className="text-sm text-blue-700 mt-1">
                  {isPermanent
                    ? 'This schedule will apply to all future weeks (starting from this week)'
                    : 'This schedule will only apply to this specific week'}
                </div>
              </div>
            </label>
          </div>

          {/* Time inputs for each day */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 text-lg">Prayer Session Times</h3>
            {days.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center p-4 bg-gray-50 rounded-lg">
                <div className="font-medium text-gray-700">{label}</div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-600 block">Start Time</label>
                  <input
                    type="time"
                    value={times[key].start}
                    onChange={(e) => handleTimeChange(key, 'start', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-600 block">End Time</label>
                  <input
                    type="time"
                    value={times[key].end}
                    onChange={(e) => handleTimeChange(key, 'end', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Info message */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Times are in 24-hour format. The duration will be automatically calculated based on start and end times.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-xl border-t border-gray-200">
          {/* Success message */}
          {saveSuccess && (
            <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-green-800">
                Schedule saved successfully! Times updated in the table.
              </span>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || saveSuccess}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {saveSuccess ? (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Saved!</span>
                </>
              ) : (
                <span>{isSaving ? 'Saving...' : isPermanent ? 'Save as Default' : 'Save for This Week'}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditPrayerTimesModal;

