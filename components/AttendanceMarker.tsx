
import React from 'react';
import { AttendanceStatus } from '../types';
import { CheckIcon, XMarkIcon } from './icons';

interface AttendanceMarkerProps {
  memberId: string;
  date: string; // YYYY-MM-DD
  currentStatus?: AttendanceStatus;
  onMarkAttendance: (memberId: string, date: string, status: AttendanceStatus) => void;
  disabled?: boolean;
}

const AttendanceMarker: React.FC<AttendanceMarkerProps> = ({ memberId, date, currentStatus, onMarkAttendance, disabled }) => {
  const handlePresent = () => {
    if(!disabled) onMarkAttendance(memberId, date, 'Present');
  };

  const handleAbsent = () => {
    if(!disabled) onMarkAttendance(memberId, date, 'Absent');
  };
  
  const handleToggle = () => {
    if (disabled) return;
    if (currentStatus === 'Present') {
      onMarkAttendance(memberId, date, 'Absent');
    } else if (currentStatus === 'Absent') {
      onMarkAttendance(memberId, date, 'Present'); // Or clear it, depends on desired UX
    } else {
      onMarkAttendance(memberId, date, 'Present'); // Default to Present if no status
    }
  };


  return (
    <div className="flex items-center space-x-1">
      {/* Present Button */}
      <button
        onClick={handlePresent}
        disabled={disabled}
        className={`group relative p-1.5 rounded-lg transition-all duration-200 transform hover:scale-105 ${
          currentStatus === 'Present'
            ? 'bg-green-500 text-white shadow-md'
            : 'bg-gray-100 hover:bg-green-100 text-gray-400 hover:text-green-600'
        } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
        aria-label={`Mark ${memberId} Present on ${date}`}
        title="Present"
      >
        <CheckIcon className="w-4 h-4" />
      </button>

      {/* Absent Button */}
      <button
        onClick={handleAbsent}
        disabled={disabled}
        className={`group relative p-1.5 rounded-lg transition-all duration-200 transform hover:scale-105 ${
          currentStatus === 'Absent'
            ? 'bg-red-500 text-white shadow-md'
            : 'bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-600'
        } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
        aria-label={`Mark ${memberId} Absent on ${date}`}
        title="Absent"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

export default AttendanceMarker;
