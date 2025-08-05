import React from 'react';
import { AttendanceStatus } from '../../types';
import { CheckIcon, XMarkIcon } from '../icons';
import { formatDateToYYYYMMDD } from '../../utils/dateUtils';
import { isDateEditable, getAttendanceTooltipMessage } from '../../utils/attendanceUtils';
import { useAppContext } from '../../contexts/FirebaseAppContext';

interface AttendanceMarkerProps {
  memberId: string;
  date: string; // YYYY-MM-DD
  currentStatus?: AttendanceStatus;
  onMarkAttendance: (memberId: string, date: string, status: AttendanceStatus) => void;
  disabled?: boolean;
}

const AttendanceMarker: React.FC<AttendanceMarkerProps> = ({ memberId, date, currentStatus, onMarkAttendance, disabled }) => {
  const { userProfile } = useAppContext();

  // Get user preference for editing previous Sundays
  const allowEditPreviousSundays = userProfile?.preferences?.allowEditPreviousSundays ?? false;

  const isEditable = !disabled && isDateEditable(date, allowEditPreviousSundays);
  const today = new Date();
  const todayStr = formatDateToYYYYMMDD(today);
  const targetDate = new Date(date + 'T00:00:00');
  const isFuture = date > todayStr;
  const isPastMonth = targetDate.getFullYear() < today.getFullYear() ||
                    (targetDate.getFullYear() === today.getFullYear() && targetDate.getMonth() < today.getMonth());

  const handlePresent = () => {
    if(isEditable) onMarkAttendance(memberId, date, 'Present');
  };

  const handleAbsent = () => {
    if(isEditable) onMarkAttendance(memberId, date, 'Absent');
  };
  
  const handleToggle = () => {
    if (!isEditable) return;
    if (currentStatus === 'Present') {
      onMarkAttendance(memberId, date, 'Absent');
    } else if (currentStatus === 'Absent') {
      onMarkAttendance(memberId, date, 'Present'); // Or clear it, depends on desired UX
    } else {
      onMarkAttendance(memberId, date, 'Present'); // Default to Present if no status
    }
  };

  // Get tooltip message for disabled states
  const getTooltipMessage = (action: 'Present' | 'Absent') => {
    if (!isEditable) {
      return getAttendanceTooltipMessage(date, action, allowEditPreviousSundays);
    }
    return action;
  };

  return (
    <div className="flex items-center space-x-1">
      {/* Present Button */}
      <button
        onClick={handlePresent}
        disabled={!isEditable}
        className={`group relative p-1.5 rounded-lg transition-all duration-200 transform ${
          isEditable ? 'hover:scale-105' : ''
        } ${
          currentStatus === 'Present' && isEditable
            ? 'bg-green-500 text-white shadow-md'
            : isEditable
            ? 'bg-gray-100 hover:bg-green-100 text-gray-400 hover:text-green-600'
            : isPastMonth
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
            : 'bg-blue-50 text-blue-400 cursor-not-allowed opacity-60'
        } ${!isEditable ? 'cursor-not-allowed' : ''}`}
        aria-label={`Mark ${memberId} Present on ${date}`}
        title={getTooltipMessage('Present')}
      >
        {/* Only show checkmark if editable and present */}
        {isEditable && currentStatus === 'Present' ? (
          <CheckIcon className="w-4 h-4" />
        ) : isEditable ? (
          <CheckIcon className="w-4 h-4" />
        ) : (
          <div className="w-4 h-4"></div>
        )}
      </button>

      {/* Absent Button */}
      <button
        onClick={handleAbsent}
        disabled={!isEditable}
        className={`group relative p-1.5 rounded-lg transition-all duration-200 transform ${
          isEditable ? 'hover:scale-105' : ''
        } ${
          currentStatus === 'Absent' && isEditable
            ? 'bg-red-500 text-white shadow-md'
            : isEditable
            ? 'bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-600'
            : isPastMonth
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
            : 'bg-blue-50 text-blue-400 cursor-not-allowed opacity-60'
        } ${!isEditable ? 'cursor-not-allowed' : ''}`}
        aria-label={`Mark ${memberId} Absent on ${date}`}
        title={getTooltipMessage('Absent')}
      >
        {/* Only show X mark if editable and absent */}
        {isEditable && currentStatus === 'Absent' ? (
          <XMarkIcon className="w-4 h-4" />
        ) : isEditable ? (
          <XMarkIcon className="w-4 h-4" />
        ) : (
          <div className="w-4 h-4"></div>
        )}
      </button>
    </div>
  );
};

export default AttendanceMarker;
