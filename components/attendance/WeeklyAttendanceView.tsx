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

// New grouped structure types
interface LinkedBacentaGroup {
  bacenta: Bacenta | { id: string; name: string };
  members: Member[]; // members present in the linked bacenta (no leader listed here)
  total: number;
}

interface FellowshipGroup {
  fellowshipLeader: Member; // role: Fellowship Leader
  bacenta: Bacenta | { id: string; name: string };
  members: Member[]; // includes fellowshipLeader + present members in that fellowship leader's bacenta
  linkedBacentaGroups: LinkedBacentaGroup[]; // Additional linked bacentas for this fellowship leader
  total: number; // members length + linked groups member counts
}

interface BacentaLeaderGroup {
  bacentaLeader: Member; // role: Bacenta Leader
  bacenta: Bacenta | { id: string; name: string };
  mainMembers: Member[]; // Present members in leader's own bacenta (including leader) excluding fellowship leaders
  fellowshipGroups: FellowshipGroup[]; // Nested fellowship leader groups linked via bacentaLeaderId
  linkedBacentaGroups: LinkedBacentaGroup[]; // Additional linked bacentas for this bacenta leader
  newBelievers: NewBeliever[]; // Present new believers (unassigned or could be associated later)
  total: number; // mainMembers + sum fellowshipGroups totals + linked groups + newBelievers
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

  // Calculate new grouped attendance data for the selected Sunday
  const groupedAttendance = useMemo(() => {
    const sundayRecords = attendanceRecords.filter(r => r.date === selectedSunday && r.status === 'Present');
    const presentMemberIds = new Set(
      sundayRecords.filter(r => r.memberId).map(r => r.memberId as string)
    );
    const presentNewBelieverIds = new Set(
      sundayRecords.filter(r => r.newBelieverId).map(r => r.newBelieverId as string)
    );

  const presentMembers = members.filter(m => !m.frozen && presentMemberIds.has(m.id));
    const presentNewBelievers = newBelievers.filter(nb => presentNewBelieverIds.has(nb.id));

    // Helper lookups
    const bacentaMap = new Map<string, Bacenta>();
    bacentas.forEach(b => bacentaMap.set(b.id, b));

    const presentByBacenta = new Map<string, Member[]>();
  presentMembers.forEach(m => {
      const key = m.bacentaId || 'unassigned';
      if (!presentByBacenta.has(key)) presentByBacenta.set(key, []);
      presentByBacenta.get(key)!.push(m);
    });

    // All bacenta leaders (regardless of presence)
  const allBacentaLeaders = members.filter(m => m.role === 'Bacenta Leader');

    const groups: BacentaLeaderGroup[] = allBacentaLeaders.map(leader => {
      const leaderBacenta = leader.bacentaId ? bacentaMap.get(leader.bacentaId) || { id: leader.bacentaId, name: 'Unknown Bacenta' } : { id: 'unassigned', name: 'Unassigned' };
      const allInLeaderBacenta = presentByBacenta.get(leader.bacentaId) || [];
      // Exclude fellowship leaders (they get their own section) from main list
      const mainMembers = allInLeaderBacenta.filter(m => m.role !== 'Fellowship Leader');

      // Fellowship leaders under this bacenta leader
  const fellowshipLeaders = members.filter(m => m.role === 'Fellowship Leader' && m.bacentaLeaderId === leader.id);
      const fellowshipGroups: FellowshipGroup[] = fellowshipLeaders.map(fl => {
        const flBacenta = fl.bacentaId ? bacentaMap.get(fl.bacentaId) || { id: fl.bacentaId, name: 'Unknown Bacenta' } : { id: 'unassigned', name: 'Unassigned' };
        const membersInFellowship = (presentByBacenta.get(fl.bacentaId) || []); // all present in that bacenta incl fellowship leader (if present)
        // Linked bacentas for fellowship leader
        const linkedGroups: LinkedBacentaGroup[] = (fl.linkedBacentaIds || [])
          .filter(id => id && id !== fl.bacentaId)
          .map(id => {
            const b = bacentaMap.get(id) || { id, name: 'Unknown Bacenta' };
            const membersInLinked = (presentByBacenta.get(id) || []).filter(m => m.id !== fl.id); // exclude leader duplication
            return { bacenta: b, members: membersInLinked, total: membersInLinked.length };
          })
          .filter(g => g.total > 0)
          .sort((a, b) => a.bacenta.name.localeCompare(b.bacenta.name));
        const fgTotal = membersInFellowship.length + linkedGroups.reduce((s, g) => s + g.total, 0);
        return {
          fellowshipLeader: fl,
          bacenta: flBacenta,
          members: membersInFellowship,
          linkedBacentaGroups: linkedGroups,
          total: fgTotal
        };
      }).sort((a, b) => a.bacenta.name.localeCompare(b.bacenta.name));

      // Linked bacentas for bacenta leader
      const linkedBacentaGroups: LinkedBacentaGroup[] = (leader.linkedBacentaIds || [])
        .filter(id => id && id !== leader.bacentaId)
        .map(id => {
          const b = bacentaMap.get(id) || { id, name: 'Unknown Bacenta' };
          const membersInLinked = (presentByBacenta.get(id) || []).filter(m => m.id !== leader.id); // safety exclude leader
          return { bacenta: b, members: membersInLinked, total: membersInLinked.length };
        })
        .filter(g => g.total > 0)
        .sort((a, b) => a.bacenta.name.localeCompare(b.bacenta.name));

      const nbForLeader: NewBeliever[] = presentNewBelievers; // Currently no direct linkage; include globally later

      const total = mainMembers.length 
        + fellowshipGroups.reduce((s, g) => s + g.total, 0)
        + linkedBacentaGroups.reduce((s, g) => s + g.total, 0)
        + nbForLeader.length;

      return {
        bacentaLeader: leader,
        bacenta: leaderBacenta,
        mainMembers: mainMembers.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '') || a.firstName.localeCompare(b.firstName)),
        fellowshipGroups,
        linkedBacentaGroups,
        newBelievers: nbForLeader, // Could refine distribution later
        total
      };
    }).filter(g => g.total > 0) // only keep groups with present attendees somewhere
      .sort((a, b) => a.bacenta.name.localeCompare(b.bacenta.name));

    // Fallback group for present members without a bacenta leader (unassigned or leader absent)
    const accountedMemberIds = new Set<string>();
    groups.forEach(g => {
      g.mainMembers.forEach(m => accountedMemberIds.add(m.id));
      g.fellowshipGroups.forEach(fg => {
        fg.members.forEach(m => accountedMemberIds.add(m.id));
        fg.linkedBacentaGroups.forEach(lg => lg.members.forEach(m => accountedMemberIds.add(m.id)));
      });
      g.linkedBacentaGroups.forEach(lg => lg.members.forEach(m => accountedMemberIds.add(m.id)));
    });

    const leftovers = presentMembers.filter(m => !accountedMemberIds.has(m.id));
    let leftoverGroup: { members: Member[] } | null = null;
    if (leftovers.length) {
      leftoverGroup = { members: leftovers.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '') || a.firstName.localeCompare(b.firstName)) };
    }

    const grandTotal = presentMembers.length + presentNewBelievers.length; // unique counts

    return { groups, leftoverGroup, grandTotal };
  }, [selectedSunday, attendanceRecords, members, newBelievers, bacentas]);

  // Copy attendance data as formatted text
  const copyAttendanceText = async () => {
    try {
      const dateText = formatFullDate(selectedSunday);
      let text = `Weekly Attendance - ${dateText}\n\n`;

      if (groupedAttendance.groups.length === 0 && !groupedAttendance.leftoverGroup) {
        text += 'No attendance records for this Sunday.';
      } else {
        groupedAttendance.groups.forEach((group, i) => {
          text += `💚 Bacenta leader: ${group.bacentaLeader.firstName} ${group.bacentaLeader.lastName || ''} (${group.bacenta.name})\n`;
          group.mainMembers.forEach((m, idx) => {
            text += `${idx + 1}. ${m.firstName} ${m.lastName || ''}\n`;
          });
          // Linked bacentas for bacenta leader
          group.linkedBacentaGroups.forEach(lg => {
            text += `\n❤ ${lg.bacenta.name}\n`;
            lg.members.forEach((m, idx) => {
              text += `${idx + 1}. ${m.firstName} ${m.lastName || ''}\n`;
            });
          });
          group.fellowshipGroups.forEach(fg => {
            text += `\n❤️ Fellowship leader: ${fg.fellowshipLeader.firstName} ${fg.fellowshipLeader.lastName || ''} (${fg.bacenta.name})\n`;
            fg.members.forEach((m, idx) => {
              text += `${idx + 1}. ${m.firstName} ${m.lastName || ''}\n`;
            });
            fg.linkedBacentaGroups.forEach(lg => {
              text += `\n❤ ${lg.bacenta.name}\n`;
              lg.members.forEach((m, idx) => {
                text += `${idx + 1}. ${m.firstName} ${m.lastName || ''}\n`;
              });
            });
          });
          if (group.newBelievers.length) {
            text += `\nNew Believers:\n`;
            group.newBelievers.forEach((nb, nbIdx) => {
              text += `${nbIdx + 1}. ${nb.name} ${nb.surname} (New Believer)\n`;
            });
          }
            text += `\nTotal: ${group.total}\n`;
          if (i < groupedAttendance.groups.length - 1 || groupedAttendance.leftoverGroup) text += '\n';
        });
        if (groupedAttendance.leftoverGroup) {
          text += `Unassigned / No Leader Group\n`;
            groupedAttendance.leftoverGroup.members.forEach((m, idx) => {
              text += `${idx + 1}. ${m.firstName} ${m.lastName || ''}\n`;
            });
          text += `Total: ${groupedAttendance.leftoverGroup.members.length}\n`;
        }
        text += `\nGrand Total: ${groupedAttendance.grandTotal}`;
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
            {groupedAttendance.groups.length === 0 && !groupedAttendance.leftoverGroup ? (
              <div className="text-center py-12">
                <UsersIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-1">No Attendance Records</h3>
                <p className="text-gray-500 text-sm">No one was marked present for this Sunday.</p>
              </div>
            ) : (
              <>
                {/* Grouped Attendance List */}
                <div className="space-y-10">
                  {groupedAttendance.groups.map(group => (
                    <div key={group.bacentaLeader.id} className="border border-gray-200 rounded-xl p-4 shadow-sm">
                      {/* Bacenta Leader Section */}
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                          <span className="mr-2 text-xl">💚</span>
                          Bacenta leader: {group.bacentaLeader.firstName} {group.bacentaLeader.lastName || ''} ({group.bacenta.name})
                        </h3>
                        <ol className="mt-2 space-y-1 list-decimal list-inside">
                          {group.mainMembers.map(m => (
                            <li key={m.id} className="text-gray-800">{m.firstName} {m.lastName}</li>
                          ))}
                        </ol>
                      </div>
                      {/* Linked Bacentas under Bacenta Leader */}
                      {group.linkedBacentaGroups && group.linkedBacentaGroups.map(lg => (
                        <div key={lg.bacenta.id} className="mb-4">
                          <h4 className="font-medium text-gray-900 flex items-center">
                            <span className="mr-2 text-lg">❤</span>
                            {lg.bacenta.name}
                          </h4>
                          <ol className="mt-2 space-y-1 list-decimal list-inside">
                            {lg.members.map(m => (
                              <li key={m.id} className="text-gray-800">{m.firstName} {m.lastName}</li>
                            ))}
                          </ol>
                        </div>
                      ))}
                      {/* Fellowship Leader Groups */}
                      {group.fellowshipGroups.map(fg => (
                        <div key={fg.fellowshipLeader.id} className="mb-4 last:mb-0">
                          <h4 className="font-medium text-gray-900 flex items-center">
                            <span className="mr-2 text-lg">❤️</span>
                            Fellowship leader: {fg.fellowshipLeader.firstName} {fg.fellowshipLeader.lastName || ''} ({fg.bacenta.name})
                          </h4>
                          <ol className="mt-2 space-y-1 list-decimal list-inside">
                            {fg.members.map(m => (
                              <li key={m.id} className="text-gray-800">{m.firstName} {m.lastName}</li>
                            ))}
                          </ol>
                          {/* Linked bacentas under Fellowship Leader */}
                          {fg.linkedBacentaGroups && fg.linkedBacentaGroups.map(lg => (
                            <div key={lg.bacenta.id} className="mt-3">
                              <h5 className="font-medium text-gray-800 flex items-center">
                                <span className="mr-2 text-base">❤</span>
                                {lg.bacenta.name}
                              </h5>
                              <ol className="mt-1 space-y-1 list-decimal list-inside">
                                {lg.members.map(m => (
                                  <li key={m.id} className="text-gray-800">{m.firstName} {m.lastName}</li>
                                ))}
                              </ol>
                            </div>
                          ))}
                        </div>
                      ))}
                      {/* New Believers */}
                      {group.newBelievers.length > 0 && (
                        <div className="mt-2">
                          <h5 className="text-sm font-semibold text-blue-600">New Believers</h5>
                          <ol className="mt-1 space-y-1 list-decimal list-inside">
                            {group.newBelievers.map(nb => (
                              <li key={nb.id} className="text-gray-800">{nb.name} {nb.surname} <span className="text-xs text-blue-500">(New Believer)</span></li>
                            ))}
                          </ol>
                        </div>
                      )}
                      <div className="mt-4 text-sm font-semibold text-gray-700">Total: {group.total}</div>
                    </div>
                  ))}
                  {groupedAttendance.leftoverGroup && (
                    <div className="border border-gray-200 rounded-xl p-4 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Unassigned / No Leader</h3>
                      <ol className="space-y-1 list-decimal list-inside">
                        {groupedAttendance.leftoverGroup.members.map(m => (
                          <li key={m.id} className="text-gray-800">{m.firstName} {m.lastName}</li>
                        ))}
                      </ol>
                      <div className="mt-4 text-sm font-semibold text-gray-700">Total: {groupedAttendance.leftoverGroup.members.length}</div>
                    </div>
                  )}
                </div>

                {/* Grand Total */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Grand Total</h3>
                    <span className="text-2xl font-bold text-slate-600">{groupedAttendance.grandTotal}</span>
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
