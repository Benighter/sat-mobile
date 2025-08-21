import React, { useState, useMemo } from 'react';
import { getCurrentMeetingWeek, formatFullDate, formatDateToYYYYMMDD } from '../../utils/dateUtils';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, BuildingOfficeIcon, UsersIcon, CheckCircleIcon } from '../icons';
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
  const { bacentas, members, attendanceRecords, guests, meetingRecords, switchTab } = useAppContext();

  // Initialize with current Wednesday
  const [currentDate, setCurrentDate] = useState<string>(() => {
    return getCurrentMeetingWeek(); // This returns the current week's Wednesday
  });

  // State for attendance form
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

  // Get attendance for a specific bacenta on the current date
  const getBacentaAttendance = (bacentaId: string) => {
    const bacentaMembers = members.filter(m => m.bacentaId === bacentaId && !m.frozen);
    const presentMembers = bacentaMembers.filter(member => {
      const attendanceRecord = attendanceRecords.find(
        ar => ar.memberId === member.id && ar.date === currentDate && ar.status === 'Present'
      );
      return !!attendanceRecord;
    });

    // Also count guests for this bacenta on this date
    const bacentaGuests = guests.filter(g =>
      g.bacentaId === bacentaId &&
      g.date === currentDate &&
      g.status === 'Present'
    );

    return {
      totalMembers: bacentaMembers.length,
      presentMembers: presentMembers.length,
      presentGuests: bacentaGuests.length,
      totalPresent: presentMembers.length + bacentaGuests.length
    };
  };

  // Calculate overall statistics for the day
  const dayStatistics = useMemo(() => {
    const totalBacentas = bacentasForCurrentDay.length;
    let totalMembers = 0;
    let totalPresent = 0;

    bacentasForCurrentDay.forEach(bacenta => {
      const attendance = getBacentaAttendance(bacenta.id);
      totalMembers += attendance.totalMembers;
      totalPresent += attendance.totalPresent;
    });

    return {
      totalBacentas,
      totalMembers,
      totalPresent
    };
  }, [bacentasForCurrentDay, currentDate, attendanceRecords, guests, members]);

  // Show attendance form if a bacenta is selected
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
                Track bible study attendance for {currentDayName}
              </p>
            </div>
            <MeetingDatePicker
              currentDate={currentDate}
              onNavigate={setCurrentDate}
            />

            {/* Day Summary Statistics */}
            {bacentasForCurrentDay.length > 0 && (
              <div className="mt-6 bg-white/80 backdrop-blur-sm rounded-xl border border-blue-200 p-4 shadow-sm">
                <div className="flex items-center justify-center space-x-8">
                  {/* Bacentas Count */}
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <BuildingOfficeIcon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-900">
                        {dayStatistics.totalBacentas}
                      </div>
                      <div className="text-xs text-blue-600">
                        Bacenta{dayStatistics.totalBacentas !== 1 ? 's' : ''} Meeting
                      </div>
                    </div>
                  </div>

                  {/* Total Attendance */}
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircleIcon className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-900">
                        {dayStatistics.totalPresent}
                      </div>
                      <div className="text-xs text-green-600">
                        Total Attending
                      </div>
                    </div>
                  </div>

                  {/* Total Members */}
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <UsersIcon className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">
                        {dayStatistics.totalMembers}
                      </div>
                      <div className="text-xs text-gray-600">
                        Total Members
                      </div>
                    </div>
                  </div>
                </div>

                {/* Attendance Rate */}
                {dayStatistics.totalMembers > 0 && (
                  <div className="mt-3 text-center">
                    <div className="text-sm text-gray-600">
                      Attendance Rate: <span className="font-semibold text-blue-700">
                        {Math.round((dayStatistics.totalPresent / dayStatistics.totalMembers) * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bacentas Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bacentasForCurrentDay.map((bacenta) => {
              const memberCount = getMemberCount(bacenta.id);
              const attendance = getBacentaAttendance(bacenta.id);
              const hasSchedule = bacenta.meetingDay || bacenta.meetingTime;
              const attendanceRate = memberCount > 0 ? Math.round((attendance.totalPresent / memberCount) * 100) : 0;
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

                      {/* Attendance Badge */}
                      <div className="text-right space-y-1">
                        {hasExistingRecord && (
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircleIcon className="w-3 h-3 mr-1" />
                            Recorded
                          </div>
                        )}
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          attendance.totalPresent > 0
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          <UsersIcon className="w-3 h-3 mr-1" />
                          {attendance.totalPresent > 0 ? `${attendanceRate}%` : 'No data'}
                        </div>
                      </div>
                    </div>

                    {/* Attendance Details */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <UsersIcon className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-700">Attendance</span>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900">
                            {attendance.totalPresent}
                            <span className="text-sm font-normal text-gray-500">/{memberCount}</span>
                          </div>
                          {attendance.presentGuests > 0 && (
                            <div className="text-xs text-green-600">
                              +{attendance.presentGuests} guest{attendance.presentGuests !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Attendance breakdown */}
                      {attendance.totalPresent > 0 && (
                        <div className="mt-2 text-xs text-gray-600">
                          {attendance.presentMembers} member{attendance.presentMembers !== 1 ? 's' : ''}
                          {attendance.presentGuests > 0 && ` + ${attendance.presentGuests} guest${attendance.presentGuests !== 1 ? 's' : ''}`}
                        </div>
                      )}
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
                        <span>
                          {hasExistingRecord ? 'View attendance record' : 'Click to take attendance'}
                        </span>
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
