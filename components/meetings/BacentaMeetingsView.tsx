import React, { useState, useMemo } from 'react';
import { getLatestMeetingDay, formatFullDate, formatDateToYYYYMMDD } from '../../utils/dateUtils';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, BuildingOfficeIcon, CheckCircleIcon } from '../icons';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import BacentaAttendanceForm from './BacentaAttendanceForm';

// Meeting date picker that cycles through Wed -> Thu -> Next Wed -> Next Thu
const MeetingDatePicker: React.FC<{
  currentDate: string;
  onNavigate: (newDate: string) => void;
}> = ({ currentDate, onNavigate }) => {

  const handlePrevious = () => {
    const date = new Date(currentDate + 'T00:00:00');
    const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

    if (dayOfWeek === 3) { // Wednesday - go to previous Thursday
      const prevThursday = new Date(date);
      prevThursday.setDate(date.getDate() - 6); // Go back 6 days to previous Thursday
      onNavigate(formatDateToYYYYMMDD(prevThursday));
    } else if (dayOfWeek === 4) { // Thursday - go to same week's Wednesday
      const wednesday = new Date(date);
      wednesday.setDate(date.getDate() - 1); // Go back 1 day to Wednesday
      onNavigate(formatDateToYYYYMMDD(wednesday));
    }
  };

  const handleNext = () => {
    const date = new Date(currentDate + 'T00:00:00');
    const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

    if (dayOfWeek === 3) { // Wednesday - go to same week's Thursday
      const thursday = new Date(date);
      thursday.setDate(date.getDate() + 1); // Go forward 1 day to Thursday
      onNavigate(formatDateToYYYYMMDD(thursday));
    } else if (dayOfWeek === 4) { // Thursday - go to next Wednesday
      const nextWednesday = new Date(date);
      nextWednesday.setDate(date.getDate() + 6); // Go forward 6 days to next Wednesday
      onNavigate(formatDateToYYYYMMDD(nextWednesday));
    }
  };

  const dayName = new Date(currentDate + 'T00:00:00').getDay() === 3 ? 'Wednesday' : 'Thursday';

  return (
    <div className="inline-flex items-center gap-2 bg-white/70 dark:bg-dark-700/60 rounded-full px-2 py-1.5 border border-gray-200 dark:border-dark-600 shadow-sm relative z-20 pointer-events-auto">
      <button
        type="button"
        className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-600 text-gray-600 pointer-events-auto relative z-30"
        onClick={handlePrevious}
        aria-label="Previous meeting date"
      >
        <ChevronLeftIcon className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2 px-2">
        <CalendarIcon className="w-4 h-4 text-gray-600" />
        <span className="font-semibold tracking-wide">
          {dayName} · {formatFullDate(currentDate)}
        </span>
      </div>
      <button
        type="button"
        className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-600 text-gray-600 pointer-events-auto relative z-30"
        onClick={handleNext}
        aria-label="Next meeting date"
      >
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

const BacentaMeetingsView: React.FC = () => {
  const { bacentas, members, meetingRecords } = useAppContext();

  // Initialize with the latest meeting day (Wed/Thu). If it's Fri–Tue, we want last Thursday.
  const [currentDate, setCurrentDate] = useState<string>(() => {
    return getLatestMeetingDay();
  });

  // State for meeting details view
  const [selectedBacentaId, setSelectedBacentaId] = useState<string | null>(null);
  const [selectedMeetingRecord, setSelectedMeetingRecord] = useState<any>(null);

  // Get current day name
  const currentDayName = new Date(currentDate + 'T00:00:00').getDay() === 3 ? 'Wednesday' : 'Thursday';

  // Filter bacentas that have meetings on the current selected day AND have both day and time configured
  const bacentasForCurrentDay = useMemo(() => {
    return bacentas.filter(bacenta =>
      // Must have both meeting day and time configured
      bacenta.meetingDay &&
      bacenta.meetingTime &&
      bacenta.meetingDay === currentDayName
    );
  }, [bacentas, currentDayName]);

  // Get member count for each bacenta
  const getMemberCount = (bacentaId: string) => {
    return members.filter(m => m.bacentaId === bacentaId && !m.frozen).length;
  };

  // Check if meeting record exists for bacenta and date
  const getMeetingRecord = (bacentaId: string, date: string) => {
    const meetingId = `${bacentaId}_${date}`;
    return meetingRecords.find(record => record.id === meetingId);
  };

  // Attendance removed in redesign

  // No attendance summary in redesigned view

  // Show meeting details if a bacenta is selected
  if (selectedBacentaId) {
    return (
      <BacentaAttendanceForm
        bacentaId={selectedBacentaId}
        meetingDate={currentDate}
        existingRecord={selectedMeetingRecord}
        onBack={() => {
          setSelectedBacentaId(null);
          setSelectedMeetingRecord(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-dark-950 dark:via-dark-900 dark:to-dark-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Header Section */}
          <div className="text-center space-y-6">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
                  Bacenta Meetings
                </span>
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Manage meeting details for {currentDayName}
              </p>
            </div>
            <MeetingDatePicker
              currentDate={currentDate}
              onNavigate={setCurrentDate}
            />

            {/* Day Summary: Meetings only */}
            {bacentasForCurrentDay.length > 0 && (
              <div className="mt-6 bg-white/80 backdrop-blur-sm rounded-xl border border-blue-200 p-4 shadow-sm">
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <BuildingOfficeIcon className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-900">{bacentasForCurrentDay.length}</div>
                    <div className="text-xs text-blue-600">Bacenta{bacentasForCurrentDay.length !== 1 ? 's' : ''} Meeting</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bacentas Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bacentasForCurrentDay.map((bacenta) => {
              const memberCount = getMemberCount(bacenta.id);
              const existingMeetingRecord = getMeetingRecord(bacenta.id, currentDate);
              const hasExistingRecord = !!existingMeetingRecord;

              return (
                <button
                  key={bacenta.id}
                  onClick={() => {
                    setSelectedBacentaId(bacenta.id);
                    setSelectedMeetingRecord(existingMeetingRecord);
                  }}
                  className="group relative bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all duration-300 overflow-hidden w-full text-left cursor-pointer transform hover:scale-[1.02]"
                >
                  {/* Gradient accent */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>

                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <BuildingOfficeIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-lg">
                            {bacenta.name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {memberCount} member{memberCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      {/* Recorded Badge */}
                      <div className="text-right space-y-1">
                        {hasExistingRecord && (
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircleIcon className="w-3 h-3 mr-1" />
                            Recorded
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Details Hint */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                      <div className="flex items-center space-x-2">
                        <CalendarIcon className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Meeting details</span>
                      </div>
                    </div>

                    {/* Meeting Schedule */}
                    <div className="bg-blue-50 rounded-lg p-3 mb-4">
                      <div className="flex items-center space-x-2">
                        <CalendarIcon className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">
                          {bacenta.meetingDay || currentDayName}
                        </span>
                        {bacenta.meetingTime && (
                          <>
                            <ClockIcon className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">
                              {bacenta.meetingTime}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Click indicator */}
                    <div className="mt-4 text-center">
                      <div className={`inline-flex items-center text-sm font-medium ${
                        hasExistingRecord
                          ? 'text-green-600'
                          : 'text-blue-600'
                      }`}>
                        <span>{hasExistingRecord ? 'View meeting details' : 'Click to add details'}</span>
                        <svg className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Empty State */}
          {bacentasForCurrentDay.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CalendarIcon className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No meetings scheduled for {currentDayName}
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">
                Configure both meeting day and time for your bacentas to see them here. Use the settings button (⚙️) in individual bacenta views to set up meeting schedules.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BacentaMeetingsView;
