import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { 
  getCurrentOrMostRecentSunday, 
  getNextSunday, 
  getPreviousSunday, 
  formatFullDate,
  getTodayYYYYMMDD 
} from '../utils/dateUtils';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  UsersIcon,
  ClipboardIcon
} from './icons';
import { Member, NewBeliever, Bacenta } from '../types';

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

            return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
          });

          // Add regular members with role indicators
          sortedMembers.forEach((member, memberIndex) => {
            let roleIndicator = '';
            if (member.role === 'Bacenta Leader') {
              roleIndicator = ' 💚';
            } else if (member.role === 'Fellowship Leader') {
              roleIndicator = ' ❤️';
            }
            text += `${memberIndex + 1}. ${member.firstName} ${member.lastName}${roleIndicator}\n`;
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="glass p-6 rounded-2xl shadow-lg mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl">
                <CalendarIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold gradient-text">Weekly Attendance</h1>
                <p className="text-gray-600">Sunday attendance summary by bacenta</p>
              </div>
            </div>

            {/* Copy Button */}
            <button
              onClick={copyAttendanceText}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
              title="Copy attendance as text"
            >
              <ClipboardIcon className="w-5 h-5" />
              <span className="hidden sm:inline font-medium">Copy</span>
            </button>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePreviousSunday}
              className="flex items-center space-x-2 px-4 py-2 bg-white/50 hover:bg-white/70 rounded-xl transition-all duration-200 border border-gray-200"
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Previous</span>
            </button>

            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-800">
                {formatFullDate(selectedSunday)}
              </h2>
            </div>

            <button
              onClick={handleNextSunday}
              disabled={!canGoNext}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-200 border border-gray-200 ${
                canGoNext 
                  ? 'bg-white/50 hover:bg-white/70 text-gray-700' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <span className="text-sm font-medium">Next</span>
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Attendance Summary */}
        <div className="space-y-4">
          {attendanceData.attendanceList.length === 0 ? (
            <div className="glass p-8 rounded-2xl shadow-lg text-center">
              <UsersIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Attendance Records</h3>
              <p className="text-gray-500">No one was marked present for this Sunday.</p>
            </div>
          ) : (
            <>
              {attendanceData.attendanceList.map((attendance) => (
                <div key={attendance.bacenta.id} className="glass p-6 rounded-2xl shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-800">{attendance.bacenta.name}</h3>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                      Total: {attendance.total}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {/* Regular Members - Sorted by Role Hierarchy */}
                    {(() => {
                      // Sort members by role priority: Bacenta Leaders first, then Fellowship Leaders, then Members
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

                        // Within same role, sort by last name, then first name
                        return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
                      });

                      return sortedMembers.map((member, index) => (
                        <div key={member.id} className="flex items-center space-x-3">
                          <span className="text-gray-600 font-medium w-8">
                            {index + 1}.
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-800">
                              {member.firstName} {member.lastName}
                            </span>
                            {/* Role Badge */}
                            {member.role === 'Bacenta Leader' && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center">
                                <span className="mr-1">💚</span>
                                Bacenta Leader
                              </span>
                            )}
                            {member.role === 'Fellowship Leader' && (
                              <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center">
                                <span className="mr-1">❤️</span>
                                Fellowship Leader
                              </span>
                            )}
                          </div>
                        </div>
                      ));
                    })()}

                    {/* New Believers */}
                    {attendance.presentNewBelievers.map((newBeliever, index) => (
                      <div key={newBeliever.id} className="flex items-center space-x-3">
                        <span className="text-gray-600 font-medium w-8">
                          {attendance.presentMembers.length + index + 1}.
                        </span>
                        <span className="text-gray-800">
                          {newBeliever.name} {newBeliever.surname}
                        </span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                          New Believer
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Grand Total */}
              <div className="glass p-6 rounded-2xl shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">Grand Total</h3>
                  <span className="text-3xl font-bold">{attendanceData.grandTotal}</span>
                </div>
                <p className="text-blue-100 mt-2">
                  Total attendance across all bacentas for {formatFullDate(selectedSunday)}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeeklyAttendanceView;
