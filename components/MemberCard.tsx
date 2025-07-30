
import React from 'react';
import { Member } from '../types';
import { useAppContext } from '../contexts/FirebaseAppContext';
import AttendanceMarker from './AttendanceMarker';
import ConfirmationMarker from './ConfirmationMarker';
import { formatDisplayDate, formatFullDate, formatDateToYYYYMMDD, getUpcomingSunday } from '../utils/dateUtils';
import { isDateEditable } from '../utils/attendanceUtils';
import { canDeleteMemberWithRole } from '../utils/permissionUtils';
import { SmartTextParser } from '../utils/smartTextParser';
import { UserIcon, EditIcon, TrashIcon, WarningIcon, PhoneIcon, HomeIcon, CalendarIcon } from './icons';
import Button from './ui/Button';
import Badge from './ui/Badge';

interface MemberCardProps {
  member: Member;
}

const MemberCard: React.FC<MemberCardProps> = ({ member }) => {
  const { displayedSundays, attendanceRecords, sundayConfirmations, markAttendanceHandler, markConfirmationHandler, deleteMemberHandler, openMemberForm, bacentas, userProfile, showConfirmation, showToast } = useAppContext();

  // Get user preference for editing previous Sundays
  const allowEditPreviousSundays = userProfile?.preferences?.allowEditPreviousSundays ?? false;

  const getAttendanceStatus = (date: string) => {
    const record = attendanceRecords.find(ar => ar.memberId === member.id && ar.date === date);
    return record?.status;
  };

  const getConfirmationStatus = (date: string) => {
    const record = sundayConfirmations.find(cr => cr.memberId === member.id && cr.date === date);
    return record?.status;
  };

  const upcomingSunday = getUpcomingSunday();

  const getAttendanceStats = () => {
    const totalServices = displayedSundays.length;
    const presentCount = displayedSundays.filter(date => getAttendanceStatus(date) === 'Present').length;
    const absentCount = displayedSundays.filter(date => getAttendanceStatus(date) === 'Absent').length;
    return `${presentCount} Present • ${absentCount} Absent • ${totalServices - presentCount - absentCount} Unmarked`;
  };

  const getAttendancePercentage = () => {
    const totalServices = displayedSundays.length;
    if (totalServices === 0) return 0;
    const presentCount = displayedSundays.filter(date => getAttendanceStatus(date) === 'Present').length;
    return Math.round((presentCount / totalServices) * 100);
  };



  const memberBacenta = bacentas.find(b => b.id === member.bacentaId);

  const formatPhoneNumber = (phone: string) => {
    if(!phone) return 'N/A';
    const cleaned = ('' + phone).replace(/\D/g, '');
    // Basic US-like formatting, can be enhanced
    const matchNA = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (matchNA) return `(${matchNA[1]}) ${matchNA[2]}-${matchNA[3]}`;
    if (cleaned.length > 6) return `${cleaned.slice(0,3)}-${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
    return phone;
  };

  const formatDateForTimestamp = (isoString: string): string => {
    if (!isoString || isoString === 'Invalid Date') return 'N/A';
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      });
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const handlePhoneClick = async (phoneNumber: string) => {
    await SmartTextParser.copyPhoneToClipboard(phoneNumber, showToast);
  };

  return (
    <div className="group glass shadow-2xl rounded-2xl p-6 mb-6 border-l-4 border-gray-500 transition-all duration-300 relative overflow-hidden animate-fade-in">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between relative z-10">
        <div className="flex items-start mb-4 sm:mb-0 flex-1">
          <div className="relative w-16 h-16 rounded-2xl mr-4 shadow-lg floating overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
            {member.profilePicture ? (
              <img
                src={member.profilePicture}
                alt={`${member.firstName} ${member.lastName || ''}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <UserIcon className="w-8 h-8 text-gray-600" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="text-xl font-bold text-gray-800 group-hover:text-gray-900 transition-colors">
                {member.firstName} {member.lastName || ''}
              </h3>

            </div>

            {/* Role Badge */}
            <div className="flex items-center space-x-2 mb-2">
              {member.role === 'Bacenta Leader' && (
                <div className="flex items-center space-x-1 bg-gradient-to-r from-green-100 to-green-200 text-green-700 px-3 py-1 rounded-full text-sm font-semibold shadow-sm">
                  <span>💚</span>
                  <span>Bacenta Leader</span>
                </div>
              )}
              {member.role === 'Fellowship Leader' && (
                <div className="flex items-center space-x-1 bg-gradient-to-r from-red-100 to-red-200 text-red-700 px-3 py-1 rounded-full text-sm font-semibold shadow-sm">
                  <span>❤️</span>
                  <span>Fellowship Leader</span>
                </div>
              )}
              {member.role === 'Member' && (
                <div className="flex items-center space-x-1 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm font-semibold shadow-sm">
                  <span>👤</span>
                  <span>Member</span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm text-gray-600">📍</span>
              <p className="text-sm font-medium text-gray-600">
                {memberBacenta?.name || <span className="italic text-gray-400">Unassigned</span>}
              </p>
            </div>

            {member.bornAgainStatus && (
              <div className="inline-flex items-center space-x-1 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold shadow-sm">
                <span>✨</span>
                <span>Born Again</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex space-x-2 mt-2 sm:mt-0 self-start sm:self-center">
          <button
            onClick={() => openMemberForm(member)}
            className="group/btn flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-800 rounded-xl transition-all duration-200 shadow-sm"
            aria-label="Edit Member"
          >
            <EditIcon className="w-4 h-4 transition-colors" />
            <span className="hidden sm:inline font-medium">Edit</span>
          </button>
          {canDeleteMemberWithRole(userProfile, member.role) ? (
            <button
              onClick={() => showConfirmation(
                'deleteMember',
                { member },
                () => deleteMemberHandler(member.id)
              )}
              className="group/btn flex items-center space-x-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 hover:text-red-800 rounded-xl transition-all duration-200 shadow-sm"
              aria-label="Delete Member"
            >
              <TrashIcon className="w-4 h-4 transition-colors" />
              <span className="hidden sm:inline font-medium">Delete</span>
            </button>
          ) : (
            <div
              className="group/btn flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-xl cursor-not-allowed opacity-50"
              title={member.role === 'Bacenta Leader' || member.role === 'Fellowship Leader'
                ? "You cannot delete leaders. Only original administrators can delete Bacenta Leaders and Fellowship Leaders."
                : "You do not have permission to delete this member"
              }
            >
              <TrashIcon className="w-4 h-4" />
              <span className="hidden sm:inline font-medium">Delete</span>
            </div>
          )}
        </div>
      </div>



      {/* Enhanced Member Details */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className={`glass p-4 rounded-xl hover:scale-102 transition-transform duration-200 ${
            member.phoneNumber && member.phoneNumber.trim() !== '' ? 'cursor-pointer hover:bg-blue-50' : ''
          }`}
          onClick={() => member.phoneNumber && handlePhoneClick(member.phoneNumber)}
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
              <PhoneIcon className="w-5 h-5 text-blue-600"/>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Phone</p>
              <p className="font-semibold text-gray-700">{formatPhoneNumber(member.phoneNumber) || <span className="text-gray-400 italic">No phone</span>}</p>
            </div>
          </div>
        </div>

        <div className="glass p-4 rounded-xl hover:scale-102 transition-transform duration-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center">
              <HomeIcon className="w-5 h-5 text-green-600"/>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Address</p>
              <p className="font-semibold text-gray-700">{member.buildingAddress || <span className="text-gray-400 italic">No address</span>}</p>
            </div>
          </div>
        </div>


      </div>


      {/* Clean Sunday Service Confirmation Section */}
      <div className="mt-6 pt-6 border-t border-white/20">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-bold gradient-text flex items-center">
            <span className="text-xl mr-2">✅</span>
            Sunday Confirmation
          </h4>
        </div>

        <div className="glass p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">
                {formatDisplayDate(upcomingSunday)}
              </p>
              <p className="text-xs text-gray-500">
                Confirm your attendance for the upcoming Sunday service
              </p>
            </div>
            <div className="flex items-center">
              <ConfirmationMarker
                memberId={member.id}
                date={upcomingSunday}
                currentStatus={getConfirmationStatus(upcomingSunday)}
                onConfirm={markConfirmationHandler}
                compact={false}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Redesigned Attendance Section */}
      <div className="mt-6 pt-6 border-t border-white/20">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-lg font-bold gradient-text flex items-center">
            <span className="text-xl mr-2">📊</span>
            Attendance Record
          </h4>
          <div className="flex items-center space-x-2">
            <div className="text-sm text-gray-500 bg-white/50 px-3 py-1 rounded-full">
              {displayedSundays.length} Services
            </div>
            <div className="text-xs text-gray-400">
              {getAttendancePercentage()}% Present
            </div>
          </div>
        </div>

        {displayedSundays.length > 0 ? (
          <div className="space-y-4">
            {/* Attendance Summary Bar */}
            <div className="glass p-4 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-600">Monthly Overview</span>
                <span className="text-sm font-bold text-gray-700">{getAttendanceStats()}</span>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${getAttendancePercentage()}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Individual Service Records */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedSundays.map((sundayDate, index) => {
                const status = getAttendanceStatus(sundayDate);
                const isEditable = isDateEditable(sundayDate, allowEditPreviousSundays);
                const today = new Date();
                const todayStr = formatDateToYYYYMMDD(today);
                const targetDate = new Date(sundayDate + 'T00:00:00');
                const isFuture = sundayDate > todayStr;
                const isPastMonth = targetDate.getFullYear() < today.getFullYear() ||
                                  (targetDate.getFullYear() === today.getFullYear() && targetDate.getMonth() < today.getMonth());

                return (
                  <div
                    key={sundayDate}
                    className={`glass p-4 rounded-xl transition-all duration-200 animate-fade-in border-l-4 relative ${
                      !isEditable
                        ? isPastMonth
                          ? 'border-gray-400 bg-gray-50/50 opacity-75'
                          : 'border-blue-400 bg-blue-50/50 opacity-75'
                        : status === 'Present'
                        ? 'border-green-500 bg-green-50/50 hover:scale-102'
                        : status === 'Absent'
                        ? 'border-red-500 bg-red-50/50 hover:scale-102'
                        : 'border-gray-300 hover:scale-102'
                    }`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {/* Visual indicator for non-editable dates - REMOVED */}
                    {false && !isEditable && (
                      <div className="absolute top-2 right-2">
                        {isFuture ? (
                          <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center" title="Future date - cannot edit">
                            <svg className="w-2.5 h-2.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center" title="Past month - cannot edit">
                            <svg className="w-2.5 h-2.5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-semibold ${!isEditable ? 'text-gray-500' : 'text-gray-700'}`}>
                          {formatDisplayDate(sundayDate)}
                        </p>
                        <p className={`text-xs font-medium ${
                          !isEditable
                            ? 'text-gray-400'
                            : status === 'Present'
                            ? 'text-green-600'
                            : status === 'Absent'
                            ? 'text-red-600'
                            : 'text-gray-500'
                        }`}>
                          {status || 'Not Marked'}
                          {!isEditable && (
                            <span className="ml-1 text-xs">
                              {isFuture ? '(Future)' : '(Past Month)'}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center space-x-1">
                        <AttendanceMarker
                          memberId={member.id}
                          date={sundayDate}
                          currentStatus={status}
                          onMarkAttendance={markAttendanceHandler}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📅</span>
            </div>
            <h5 className="text-lg font-semibold text-gray-600 mb-2">No Services Scheduled</h5>
            <p className="text-sm text-gray-500">No Sundays scheduled for the selected month</p>
          </div>
        )}
      </div>

      {/* Enhanced Footer */}
      <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center space-x-4">
          <span>Created: {formatDateForTimestamp(member.createdDate)}</span>
          <span>•</span>
          <span>Updated: {formatDateForTimestamp(member.lastUpdated)}</span>
        </div>
        <div className="text-gray-500">
          ID: {member.id.slice(-6)}
        </div>
      </div>
    </div>
  );
};

export default MemberCard;
