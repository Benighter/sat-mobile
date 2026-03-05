import React from 'react';
import { Guest, Bacenta } from '../../types';
import { UserIcon, XMarkIcon } from '../icons';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

interface GuestConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  guest: Guest | null;
  bacenta: Bacenta | null;
  isLoading?: boolean;
}

const GuestConversionModal: React.FC<GuestConversionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  guest,
  bacenta,
  isLoading = false
}) => {
  if (!guest || !bacenta) return null;

  const guestName = `${guest.firstName} ${guest.lastName || ''}`.trim();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Convert Guest to Member
              </h2>
              <p className="text-sm text-gray-600">
                Convert {guestName} to a permanent member
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Guest Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Guest Details</h3>
            <div className="space-y-1 text-sm text-gray-600">
              <div><span className="font-medium">Name:</span> {guestName}</div>
              <div><span className="font-medium">Bacenta:</span> {bacenta.name}</div>
              {guest.roomNumber && (
                <div><span className="font-medium">Room:</span> {guest.roomNumber}</div>
              )}
              {guest.phoneNumber && (
                <div><span className="font-medium">Phone:</span> {guest.phoneNumber}</div>
              )}
            </div>
          </div>

          {/* Conversion Details */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <h3 className="text-sm font-medium text-blue-900 mb-2">What will happen:</h3>
            <ul className="space-y-1 text-sm text-blue-800">
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                Create a new member record with the guest's information
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                Transfer all Sunday confirmations to the new member
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                Remove the original guest record
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                Member will appear in the Members view and Sunday Confirmations
              </li>
            </ul>
          </div>

          {/* Member Defaults */}
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
            <h3 className="text-sm font-medium text-yellow-900 mb-2">Default Member Settings:</h3>
            <ul className="space-y-1 text-sm text-yellow-800">
              <li className="flex items-start">
                <span className="text-yellow-600 mr-2">•</span>
                Role: Member
              </li>
              <li className="flex items-start">
                <span className="text-yellow-600 mr-2">•</span>
                Born Again Status: Not set (can be updated later)
              </li>
              <li className="flex items-start">
                <span className="text-yellow-600 mr-2">•</span>
                Building Address: {guest.roomNumber ? `Room ${guest.roomNumber}` : 'Not set (can be updated later)'}
              </li>
              <li className="flex items-start">
                <span className="text-yellow-600 mr-2">•</span>
                Phone Number: {guest.phoneNumber ? guest.phoneNumber : 'Not set (can be updated later)'}
              </li>
            </ul>
          </div>

          {/* Warnings for incomplete data */}
          {(!guest.phoneNumber || !guest.roomNumber) && (
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
              <h3 className="text-sm font-medium text-orange-900 mb-2">⚠️ Incomplete Information:</h3>
              <ul className="space-y-1 text-sm text-orange-800">
                {!guest.phoneNumber && (
                  <li className="flex items-start">
                    <span className="text-orange-600 mr-2">•</span>
                    No phone number provided - you can add this later in the Members view
                  </li>
                )}
                {!guest.roomNumber && (
                  <li className="flex items-start">
                    <span className="text-orange-600 mr-2">•</span>
                    No room/address provided - you can add this later in the Members view
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 mt-6">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={isLoading}
            loading={isLoading}
          >
            Convert to Member
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default GuestConversionModal;
