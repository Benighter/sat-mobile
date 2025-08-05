import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import {
  getCurrentOrMostRecentSunday,
  getNextSunday,
  getPreviousSunday,
  formatFullDate,
  formatCompactDate,
  getTodayYYYYMMDD
} from '../../utils/dateUtils';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  UsersIcon,
  ClipboardIcon
} from '../icons';
import { Member, NewBeliever, Bacenta } from '../../types';

interface BacentaAttendance {
  bacenta: Bacenta;
  presentMembers: Member[];
  presentNewBelievers: NewBeliever[];
  total: number;
}

const WeeklyAttendanceView: React.FC = () => {
  const {
    members,
    newBelievers,
    bacentas,
    attendanceRecords,
    showToast
  } = useAppContext();

  const [selectedSunday, setSelectedSunday] = useState<string>(getCurrentOrMostRecentSunday());

  // Calculate attendance data for the selected Sunday
  const attendanceData = useMemo(() => {
    // Get all attendance records for the selected Sunday
    const sundayRecords = attendanceRecords.filter(
      record => record.date === selectedSunday && record.status === 'Present'
    );

    // Get present member IDs and new believer IDs
    const presentMemberIds = sundayRecords
      .filter(record => record.memberId)
      .map(record => record.memberId!);
    
    const presentNewBelieverIds = sundayRecords
      .filter(record => record.newBelieverId)
      .map(record => record.newBelieverId!);

    // Get present members and new believers
    const presentMembers = members.filter(member => presentMemberIds.includes(member.id));
    const presentNewBelievers = newBelievers.filter(nb => presentNewBelieverIds.includes(nb.id));

    // Group by bacenta
    const bacentaAttendanceMap = new Map<string, BacentaAttendance>();

    // Initialize all bacentas
    bacentas.forEach(bacenta => {
      bacentaAttendanceMap.set(bacenta.id, {
        bacenta,
        presentMembers: [],
        presentNewBelievers: [],
        total: 0
      });
    });

    // Add a special entry for unassigned members
    bacentaAttendanceMap.set('unassigned', {
      bacenta: { id: 'unassigned', name: 'Unassigned Members' },
      presentMembers: [],
      presentNewBelievers: [],
      total: 0
    });

    // Group present members by bacenta
    presentMembers.forEach(member => {
      const bacentaId = member.bacentaId || 'unassigned';
      const attendance = bacentaAttendanceMap.get(bacentaId);
      if (attendance) {
        attendance.presentMembers.push(member);
        attendance.total++;
      }
    });

    // Add present new believers (they don't have bacenta assignments, so add to unassigned)
    presentNewBelievers.forEach(newBeliever => {
      const attendance = bacentaAttendanceMap.get('unassigned');
      if (attendance) {
        attendance.presentNewBelievers.push(newBeliever);
        attendance.total++;
      }
    });

    // Convert to array and filter out bacentas with no attendance
    const attendanceList = Array.from(bacentaAttendanceMap.values())
      .filter(attendance => attendance.total > 0)
      .sort((a, b) => a.bacenta.name.localeCompare(b.bacenta.name));

    const grandTotal = attendanceList.reduce((sum, attendance) => sum + attendance.total, 0);

    return { attendanceList, grandTotal };
  }, [selectedSunday, attendanceRecords, members, newBelievers, bacentas]);

  // Copy attendance data as formatted text
  const copyAttendanceText = async () => {
    try {
      const dateText = formatFullDate(selectedSunday);
      let text = `Weekly Attendance - ${dateText}\n\n`;

      if (attendanceData.attendanceList.length === 0) {
        text += 'No attendance records for this Sunday.';
      } else {
        attendanceData.attendanceList.forEach((attendance, index) => {
          text += `${attendance.bacenta.name}\n`;

          // Sort members by role hierarchy for text output
          const getRolePriority = (role: string | undefined) => {
            switch (role) {
              case 'Bacenta Leader': return 1;
              case 'Fellowship Leader': return 2;
              case 'Member': return 3;
              default: return 4;
            }
          };

          const sortedMembers = [...attendance.presentMembers].sort((a, b) => {
            const rolePriorityA = getRolePriority(a.role);
            const rolePriorityB = getRolePriority(b.role);

            if (rolePriorityA !== rolePriorityB) {
              return rolePriorityA - rolePriorityB;
            }

            return (a.lastName || '').localeCompare(b.lastName || '') || a.firstName.localeCompare(b.firstName);
          });

          // Add regular members with role indicators
          sortedMembers.forEach((member, memberIndex) => {
            let roleIndicator = '';
            if (member.role === 'Bacenta Leader') {
              roleIndicator = ' 💚';
            } else if (member.role === 'Fellowship Leader') {
              roleIndicator = ' ❤️';
            }
            text += `${memberIndex + 1}. ${member.firstName} ${member.lastName || ''}${roleIndicator}\n`;
          });

          // Add new believers
          attendance.presentNewBelievers.forEach((newBeliever, nbIndex) => {
            const number = attendance.presentMembers.length + nbIndex + 1;
            text += `${number}. ${newBeliever.name} ${newBeliever.surname} (New Believer)\n`;
          });

          text += `Total: ${attendance.total}\n`;

          // Add spacing between bacentas (except for the last one)
          if (index < attendanceData.attendanceList.length - 1) {
            text += '\n';
          }
        });

        text += `\nGrand Total: ${attendanceData.grandTotal}`;
      }

      await navigator.clipboard.writeText(text);
      showToast('success', 'Copied!', 'Weekly attendance copied to clipboard');
    } catch (error) {
      console.error('Failed to copy text:', error);
      showToast('error', 'Copy Failed', 'Unable to copy to clipboard');
    }
  };

  const handlePreviousSunday = () => {
    setSelectedSunday(getPreviousSunday(selectedSunday));
  };

  const handleNextSunday = () => {
    setSelectedSunday(getNextSunday(selectedSunday));
  };

  const canGoNext = selectedSunday < getTodayYYYYMMDD();

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Professional Container */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Professional Header */}
          <div className="border-b border-gray-200 pt-8 pb-6 px-6 text-center">
            {/* Title */}
            <div className="mb-6">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                  <CalendarIcon className="w-6 h-6 text-slate-600" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Weekly Attendance</h1>
              <p className="text-gray-600 text-sm mt-1">Sunday attendance summary</p>
            </div>

            {/* Professional Date Navigation - Optimized for Full Date Display */}
            <div className="flex items-center justify-center mb-4 px-2 sm:px-4">
              <div className="flex items-center w-full max-w-sm sm:max-w-md lg:max-w-lg">
                <button
                  onClick={handlePreviousSunday}
                  className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 text-gray-700 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md flex-shrink-0"
                  title="Previous Sunday"
                >
                  <ChevronLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                <div className="text-center flex-1 min-w-0 mx-3 sm:mx-4">
                  <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 leading-tight">
                    {formatCompactDate(selectedSunday)}
                  </h2>
                </div>

                <button
                  onClick={handleNextSunday}
                  disabled={!canGoNext}
                  className={`flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl transition-all duration-200 shadow-sm flex-shrink-0 ${
                    canGoNext
                      ? 'bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 text-gray-700 hover:shadow-md'
                      : 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  title="Next Sunday"
                >
                  <ChevronRightIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

            {/* Copy Button */}
            <button
              onClick={copyAttendanceText}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-all duration-200 text-sm font-medium shadow-sm"
              title="Copy attendance as text"
            >
              <ClipboardIcon className="w-4 h-4" />
              <span>Copy Attendance</span>
            </button>
          </div>

          {/* Professional Attendance Content */}
          <div className="p-6">
            {attendanceData.attendanceList.length === 0 ? (
              <div className="text-center py-12">
                <UsersIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-1">No Attendance Records</h3>
                <p className="text-gray-500 text-sm">No one was marked present for this Sunday.</p>
              </div>
            ) : (
              <>
                {/* Professional Attendance List */}
                <div className="divide-y divide-gray-100">
                  {attendanceData.attendanceList.map((attendance, bacentaIndex) => {
                    // Sort members by role priority
                    const getRolePriority = (role: string | undefined) => {
                      switch (role) {
                        case 'Bacenta Leader': return 1;
                        case 'Fellowship Leader': return 2;
                        case 'Member': return 3;
                        default: return 4;
                      }
                    };

                    const sortedMembers = [...attendance.presentMembers].sort((a, b) => {
                      const rolePriorityA = getRolePriority(a.role);
                      const rolePriorityB = getRolePriority(b.role);

                      if (rolePriorityA !== rolePriorityB) {
                        return rolePriorityA - rolePriorityB;
                      }

                      return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
                    });

                    return (
                      <div key={attendance.bacenta.id} className={`py-4 ${bacentaIndex > 0 ? 'pt-6' : ''}`}>
                        {/* Professional Bacenta Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
                              <span className="text-white font-bold">
                                {attendance.bacenta.name.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">{attendance.bacenta.name}</h3>
                              <p className="text-sm text-gray-500">Bacenta Community</p>
                            </div>
                          </div>
                          <div className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-lg border border-indigo-200">
                            <span className="text-lg font-bold">{attendance.total}</span>
                            <span className="text-sm ml-1">present</span>
                          </div>
                        </div>

                        {/* Professional Members List */}
                        <div className="space-y-2">
                          {sortedMembers.map((member, index) => (
                            <div key={member.id} className="flex items-start">
                              <span className="text-gray-500 text-sm font-medium w-6 pt-0.5">
                                {index + 1}.
                              </span>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-gray-900">
                                  {member.firstName} {member.lastName}
                                </span>
                                {/* Role Indicator */}
                                {member.role === 'Bacenta Leader' && (
                                  <span className="inline-flex items-center px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded-md border border-emerald-200">
                                    <span className="mr-1">💚</span>
                                    <span className="hidden sm:inline">Bacenta Leader</span>
                                  </span>
                                )}
                                {member.role === 'Fellowship Leader' && (
                                  <span className="inline-flex items-center px-2 py-1 text-xs bg-rose-100 text-rose-700 rounded-md border border-rose-200">
                                    <span className="mr-1">❤️</span>
                                    <span className="hidden sm:inline">Fellowship Leader</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}

                          {/* New Believers */}
                          {attendance.presentNewBelievers.map((newBeliever, index) => (
                            <div key={newBeliever.id} className="flex items-start">
                              <span className="text-gray-500 text-sm font-medium w-6 pt-0.5">
                                {attendance.presentMembers.length + index + 1}.
                              </span>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-gray-900">
                                  {newBeliever.name} {newBeliever.surname}
                                </span>
                                <span className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-md border border-blue-200">
                                  New Believer
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Professional Grand Total */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Grand Total</h3>
                    <span className="text-2xl font-bold text-slate-600">{attendanceData.grandTotal}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Total attendance across all bacentas for {formatFullDate(selectedSunday)}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyAttendanceView;
