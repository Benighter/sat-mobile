
import React, { useState, useEffect } from 'react';
import { Bacenta } from '../../../types';
import { useAppContext } from '../../../contexts/FirebaseAppContext';
import Modal from '../../ui/Modal';
import Input from '../../ui/Input';
import Button from '../../ui/Button';


interface BacentaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  bacenta: Bacenta | null; // Current bacenta for editing, or null for new
}

const BacentaFormModal: React.FC<BacentaFormModalProps> = ({ isOpen, onClose, bacenta }) => {
  const { addBacentaHandler, updateBacentaHandler, switchTab, closeBacentaDrawer } = useAppContext();
  const [name, setName] = useState('');
  const [meetingDay, setMeetingDay] = useState<'Wednesday' | 'Thursday' | ''>('');
  const [meetingTime, setMeetingTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (bacenta) {
      setName(bacenta.name);
      setMeetingDay(bacenta.meetingDay || '');
      setMeetingTime(bacenta.meetingTime || '');
    } else {
      setName('');
      setMeetingDay('');
      setMeetingTime('');
    }
    setError(null); // Clear error when modal opens or bacenta changes
  }, [isOpen, bacenta]);

  const validate = (): boolean => {
    if (!name.trim()) {
      setError('Bacenta name cannot be empty.');
      return false;
    }

    // Validate meeting time format if provided
    if (meetingTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(meetingTime)) {
      setError('Meeting time must be in HH:MM format (e.g., 19:00).');
      return false;
    }

    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  if (isSubmitting) return; // prevent duplicates
  if (!validate()) return;

    try {
      setIsSubmitting(true);

      const bacentaData = {
        name,
        meetingDay: meetingDay || undefined,
        meetingTime: meetingTime || undefined,
      };

      if (bacenta) {
        await updateBacentaHandler({ ...bacenta, ...bacentaData });
        onClose();
      } else {
        // Create and navigate into the new Bacenta
        const newId: string = await addBacentaHandler(bacentaData);
        // Mark that we should show the bulk-add tip once
        try { localStorage.setItem('church_connect_show_bulk_tip_once', 'true'); } catch {}
        // Switch into the newly created bacenta and ensure drawer is closed
        switchTab({ id: newId, name });
        if (typeof closeBacentaDrawer === 'function') {
          closeBacentaDrawer();
        }
        onClose();
      }
    } catch (err) {
      // Errors already toasted by handlers
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={bacenta ? 'Edit Bacenta' : 'Add New Bacenta'} size="md">
      <div className="relative">
        {isSubmitting && (
          <div className="absolute inset-0 z-20 bg-white/70 dark:bg-dark-900/60 backdrop-blur-sm flex items-center justify-center rounded-xl">
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/90 dark:bg-dark-800 border border-gray-200 dark:border-dark-600 shadow">
              <svg className="animate-spin h-5 w-5 text-indigo-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0a12 12 0 00-12 12h4z"></path>
              </svg>
              <span className="text-sm font-medium text-gray-700 dark:text-dark-100">{bacenta ? 'Saving bacenta…' : 'Creating bacenta…'}</span>
            </div>
          </div>
        )}
      <form onSubmit={handleSubmit} className="space-y-4" aria-busy={isSubmitting}>
        {!bacenta && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-sm">💡</span>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-blue-800 mb-1">Quick Start</h4>
                <p className="text-sm text-blue-700">
                  After creating this Bacenta, you'll be automatically taken inside it where you can start adding members right away!
                </p>
              </div>
            </div>
          </div>
        )}

        <Input
          label="Bacenta Name"
          name="bacentaName"
          value={name}
          onChange={(value) => setName(value)}
          error={error || undefined}
          required
          autoFocus
          placeholder="Enter a name for your Bacenta..."
        />

        {/* Meeting Schedule Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 space-y-4 border border-blue-200">
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 text-sm">📅</span>
            </div>
            <h4 className="font-semibold text-blue-900">Bible Study Schedule</h4>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-blue-800">
              Meeting Day
            </label>
            <select
              value={meetingDay}
              onChange={(e) => setMeetingDay(e.target.value as 'Wednesday' | 'Thursday' | '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              style={{ color: '#1f2937' }}
            >
              <option value="" style={{ color: '#6b7280' }}>Select a day (optional)</option>
              <option value="Wednesday" style={{ color: '#1f2937' }}>Wednesday</option>
              <option value="Thursday" style={{ color: '#1f2937' }}>Thursday</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-blue-800">
              Meeting Time
            </label>
            <input
              type="time"
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              style={{ color: '#1f2937' }}
              placeholder="e.g., 19:00"
            />
            <p className="text-xs text-blue-600">
              Optional: Set the time for bible study meetings
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={isSubmitting} loading={isSubmitting}>
            {bacenta ? 'Save Changes' : 'Create & Enter Bacenta'}
          </Button>
        </div>
      </form>
      </div>
    </Modal>
  );
};

export default BacentaFormModal;
