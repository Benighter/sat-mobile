import React from 'react';
import { ConfirmationStatus } from '../types';
import { CheckIcon, ClockIcon } from './icons';

interface ConfirmationMarkerProps {
  memberId: string;
  date: string; // YYYY-MM-DD
  currentStatus?: ConfirmationStatus;
  onConfirm: (memberId: string, date: string, status: ConfirmationStatus) => void;
  disabled?: boolean;
  compact?: boolean; // For table view
}

const ConfirmationMarker: React.FC<ConfirmationMarkerProps> = ({
  memberId,
  date,
  currentStatus,
  onConfirm,
  disabled = false,
  compact = false
}) => {
  const isConfirmed = currentStatus === 'Confirmed';

  const handleToggle = () => {
    if (disabled) return;

    const newStatus: ConfirmationStatus = isConfirmed ? 'Not Confirmed' : 'Confirmed';
    onConfirm(memberId, date, newStatus);
  };

  if (compact) {
    // Professional compact version for table view
    return (
      <button
        onClick={handleToggle}
        disabled={disabled}
        className={`p-2 rounded-lg transition-all duration-200 ${
          isConfirmed
            ? 'bg-emerald-500 text-white shadow-sm'
            : 'bg-gray-100 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 border border-gray-200'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
        aria-label={`${isConfirmed ? 'Unconfirm' : 'Confirm'} attendance for ${date}`}
        title={isConfirmed ? 'Confirmed for Sunday' : 'Click to confirm attendance'}
      >
        {isConfirmed ? (
          <CheckIcon className="w-4 h-4" />
        ) : (
          <ClockIcon className="w-4 h-4" />
        )}
      </button>
    );
  }

  // Professional full version for card view
  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={handleToggle}
        disabled={disabled}
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
          isConfirmed
            ? 'bg-emerald-500 text-white shadow-sm'
            : 'bg-gray-100 hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 border border-gray-200'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
        aria-label={`${isConfirmed ? 'Unconfirm' : 'Confirm'} attendance for ${date}`}
      >
        {isConfirmed ? (
          <>
            <CheckIcon className="w-4 h-4" />
            <span className="text-sm font-medium">Confirmed</span>
          </>
        ) : (
          <>
            <ClockIcon className="w-4 h-4" />
            <span className="text-sm font-medium">Confirm Attendance</span>
          </>
        )}
      </button>
    </div>
  );
};

export default ConfirmationMarker;
