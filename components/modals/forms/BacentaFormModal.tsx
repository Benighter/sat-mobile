
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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (bacenta) {
      setName(bacenta.name);
    } else {
      setName('');
    }
    setError(null); // Clear error when modal opens or bacenta changes
  }, [isOpen, bacenta]);

  const validate = (): boolean => {
    if (!name.trim()) {
      setError('Bacenta name cannot be empty.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setIsSubmitting(true);
      if (bacenta) {
        await updateBacentaHandler({ ...bacenta, name });
        onClose();
      } else {
        // Create and navigate into the new Bacenta
        const newId: string = await addBacentaHandler({ name });
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
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? (bacenta ? 'Saving...' : 'Creating...') : (bacenta ? 'Save Changes' : 'Create & Enter Bacenta')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default BacentaFormModal;
