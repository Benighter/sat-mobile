import React, { useState, useMemo } from 'react';
import { NewBeliever, AttendanceStatus } from '../types';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { formatDateToDisplay, formatDisplayDate } from '../utils/dateUtils';
import { SmartTextParser } from '../utils/smartTextParser';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Badge from './ui/Badge';
import AttendanceMarker from './AttendanceMarker';
import { 
  UserIcon, 
  EditIcon, 
  TrashIcon, 
  CalendarIcon, 
  PhoneIcon, 
  MapPinIcon,
  AcademicCapIcon,
  BriefcaseIcon,
  HomeIcon,
  ClockIcon
} from './icons';

interface NewBelieverDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  newBeliever: NewBeliever | null;
}

const NewBelieverDetailModal: React.FC<NewBelieverDetailModalProps> = ({ 
  isOpen, 
  onClose, 
  newBeliever 
}) => {
  const {
    attendanceRecords,
    displayedSundays,
    markNewBelieverAttendanceHandler,
    openNewBelieverForm,
    deleteNewBelieverHandler,
    showConfirmation,
    showToast
  } = useAppContext();

  if (!newBeliever) return null;

  const handleContactClick = async (contact: string) => {
    await SmartTextParser.copyPhoneToClipboard(contact, showToast);
  };

  // Get attendance status for a specific date
  const getAttendanceStatus = (date: string): AttendanceStatus | undefined => {
    const record = attendanceRecords.find(ar => ar.newBelieverId === newBeliever.id && ar.date === date);
    return record?.status;
  };

  // Calculate attendance statistics
  const attendanceStats = useMemo(() => {
    if (displayedSundays.length === 0) return { present: 0, absent: 0, late: 0, rate: 0 };
    
    const present = displayedSundays.filter(date => getAttendanceStatus(date) === 'Present').length;
    const absent = displayedSundays.filter(date => getAttendanceStatus(date) === 'Absent').length;
    const late = displayedSundays.filter(date => getAttendanceStatus(date) === 'Late').length;
    const rate = Math.round((present / displayedSundays.length) * 100);
    
    return { present, absent, late, rate };
  }, [displayedSundays, attendanceRecords, newBeliever.id]);

  const getDisplayName = () => {
    return `${newBeliever.name}${newBeliever.surname ? ` ${newBeliever.surname}` : ''}`;
  };

  const handleEdit = () => {
    openNewBelieverForm(newBeliever);
    onClose();
  };

  const handleDelete = () => {
    showConfirmation(
      'deleteNewBeliever',
      newBeliever,
      () => {
        deleteNewBelieverHandler(newBeliever.id);
        onClose();
      }
    );
  };

  const daysSinceCreated = Math.floor(
    (new Date().getTime() - new Date(newBeliever.createdDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Believer Details" size="xl">
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded-2xl flex items-center justify-center">
              <UserIcon className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{getDisplayName()}</h2>
              <div className="flex items-center space-x-2 mt-1">
                {newBeliever.isFirstTime && (
                  <Badge variant="success">First Time Visitor</Badge>
                )}
                {newBeliever.ministry && (
                  <Badge variant="info">{newBeliever.ministry}</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="secondary"
              leftIcon={<EditIcon className="w-4 h-4" />}
              onClick={handleEdit}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              leftIcon={<TrashIcon className="w-4 h-4" />}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        </div>

        {/* Personal Information */}
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <UserIcon className="w-5 h-5 mr-2 text-blue-600" />
            Personal Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {newBeliever.contact && (
              <div
                className="flex items-center space-x-3 cursor-pointer hover:bg-blue-50 rounded p-2 transition-colors"
                onClick={() => handleContactClick(newBeliever.contact)}
              >
                <PhoneIcon className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Contact</div>
                  <div className="font-medium">{newBeliever.contact}</div>
                </div>
              </div>
            )}
            {newBeliever.dateOfBirth && (
              <div className="flex items-center space-x-3">
                <CalendarIcon className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Date of Birth</div>
                  <div className="font-medium">{formatDateToDisplay(newBeliever.dateOfBirth)}</div>
                </div>
              </div>
            )}
            {newBeliever.residence && (
              <div className="flex items-center space-x-3">
                <MapPinIcon className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Residence</div>
                  <div className="font-medium">{newBeliever.residence}</div>
                </div>
              </div>
            )}
            <div className="flex items-center space-x-3">
              <ClockIcon className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Created Date</div>
                <div className="font-medium">
                  {formatDateToDisplay(newBeliever.createdDate)} ({daysSinceCreated} days ago)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Education & Work */}
        {(newBeliever.studies || newBeliever.campus || newBeliever.occupation || newBeliever.year) && (
          <div className="bg-blue-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <AcademicCapIcon className="w-5 h-5 mr-2 text-blue-600" />
              Education & Work
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {newBeliever.studies && (
                <div className="flex items-center space-x-3">
                  <AcademicCapIcon className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-sm text-gray-500">Studies</div>
                    <div className="font-medium">{newBeliever.studies}</div>
                  </div>
                </div>
              )}
              {newBeliever.campus && (
                <div className="flex items-center space-x-3">
                  <HomeIcon className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-sm text-gray-500">Campus</div>
                    <div className="font-medium">{newBeliever.campus}</div>
                  </div>
                </div>
              )}
              {newBeliever.occupation && (
                <div className="flex items-center space-x-3">
                  <BriefcaseIcon className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-sm text-gray-500">Occupation</div>
                    <div className="font-medium">{newBeliever.occupation}</div>
                  </div>
                </div>
              )}
              {newBeliever.year && (
                <div className="flex items-center space-x-3">
                  <CalendarIcon className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-sm text-gray-500">Year</div>
                    <div className="font-medium">{newBeliever.year}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Attendance Summary */}
        <div className="bg-purple-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CalendarIcon className="w-5 h-5 mr-2 text-purple-600" />
            Attendance Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{attendanceStats.present}</div>
              <div className="text-sm text-gray-500">Present</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{attendanceStats.absent}</div>
              <div className="text-sm text-gray-500">Absent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{attendanceStats.late}</div>
              <div className="text-sm text-gray-500">Late</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{attendanceStats.rate}%</div>
              <div className="text-sm text-gray-500">Rate</div>
            </div>
          </div>

          {/* Attendance Grid */}
          {displayedSundays.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">This Month's Attendance</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {displayedSundays.map(date => {
                  const status = getAttendanceStatus(date);
                  return (
                    <div key={date} className="text-center">
                      <div className="text-xs text-gray-500 mb-1">
                        {formatDisplayDate(date)}
                      </div>
                      <AttendanceMarker
                        memberId={newBeliever.id}
                        date={date}
                        currentStatus={status}
                        onMarkAttendance={(id, date, status) => markNewBelieverAttendanceHandler(id, date, status)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={handleEdit} leftIcon={<EditIcon className="w-4 h-4" />}>
            Edit Details
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default NewBelieverDetailModal;
