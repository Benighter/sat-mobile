import React, { useState, useMemo, useEffect } from 'react';
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
import { hasAdminPrivileges } from '../../utils/permissionUtils';
import { MINISTRY_OPTIONS } from '../../constants';

// New grouped structure types
interface LinkedBacentaGroup {
  bacenta: Bacenta | { id: string; name: string };
  members: Member[]; // members present in the linked bacenta (no leader listed here)
  total: number;
}

interface FellowshipGroup {
  fellowshipLeader: Member; // role: Fellowship Leader (Red Bacenta)
  bacenta: Bacenta | { id: string; name: string };
  members: Member[]; // includes fellowshipLeader + present members in that Red Bacenta's bacenta
  linkedBacentaGroups: LinkedBacentaGroup[]; // Additional linked bacentas for this Red Bacenta
  total: number; // members length + linked groups member counts
}

interface BacentaLeaderGroup {
  bacentaLeader: Member; // role: Bacenta Leader (Green Bacenta)
  bacenta: Bacenta | { id: string; name: string };
  mainMembers: Member[]; // Present members in leader's own bacenta (including leader) excluding Red Bacentas
  fellowshipGroups: FellowshipGroup[]; // Nested Red Bacenta groups linked via bacentaLeaderId
  linkedBacentaGroups: LinkedBacentaGroup[]; // Additional linked bacentas for this Green Bacenta
  newBelievers: NewBeliever[]; // Present new believers (unassigned or could be associated later)
  total: number; // mainMembers + sum fellowshipGroups totals + linked groups + newBelievers
}

const WeeklyAttendanceView: React.FC = () => {
  const {
    members,
    newBelievers,
    bacentas,
    attendanceRecords,
    showToast,
    userProfile,
    isMinistryContext,
    activeMinistryName
  } = useAppContext();

  const isAdmin = hasAdminPrivileges(userProfile);

  // Keep constituency name in sync with App Preferences (and react immediately to updates)
  const [constituencyName, setConstituencyName] = useState<string>(userProfile?.churchName || '');
  useEffect(() => {
    setConstituencyName(userProfile?.churchName || '');
  }, [userProfile?.churchName]);
  useEffect(() => {
    const handler = (e: any) => {
      if (e?.detail?.newName) setConstituencyName(e.detail.newName);
    };
    window.addEventListener('constituencyUpdated', handler as EventListener);
    return () => window.removeEventListener('constituencyUpdated', handler as EventListener);
  }, []);

  const [selectedSunday, setSelectedSunday] = useState<string>(getCurrentOrMostRecentSunday());
  const [selectedMinistry, setSelectedMinistry] = useState<string>(''); // '' means all ministries

  // Auto-set ministry filter when in ministry context
  useEffect(() => {
    if (isMinistryContext && activeMinistryName) {
      setSelectedMinistry(activeMinistryName);
    }
  }, [isMinistryContext, activeMinistryName]);

  // Auto-set ministry filter when in ministry context
  useEffect(() => {
    if (isMinistryContext && activeMinistryName) {
      setSelectedMinistry(activeMinistryName);
    }
  }, [isMinistryContext, activeMinistryName]);

  // Calculate new grouped attendance data for the selected Sunday
  const groupedAttendance = useMemo(() => {
    const sundayRecords = attendanceRecords.filter(r => r.date === selectedSunday && r.status === 'Present');
    const presentMemberIds = new Set(
      sundayRecords.filter(r => r.memberId).map(r => r.memberId as string)
    );
    const presentNewBelieverIds = new Set(
      sundayRecords.filter(r => r.newBelieverId).map(r => r.newBelieverId as string)
    );

    // Filter members by ministry if selected, and exclude frozen members
    let filteredMembers = members.filter(m => !m.frozen && presentMemberIds.has(m.id));
    if (selectedMinistry) {
      filteredMembers = filteredMembers.filter(m =>
        m.ministry && m.ministry.toLowerCase() === selectedMinistry.toLowerCase()
      );
    }

    const presentMembers = filteredMembers;
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
      // Exclude Red Bacentas (fellowship leaders) - they get their own section - from main list
      const mainMembers = allInLeaderBacenta.filter(m => m.role !== 'Fellowship Leader');

      // Red Bacentas (Fellowship leaders) under this Green Bacenta (bacenta leader)
  const fellowshipLeaders = members.filter(m => m.role === 'Fellowship Leader' && m.bacentaLeaderId === leader.id);
      const fellowshipGroups: FellowshipGroup[] = fellowshipLeaders.map(fl => {
        const flBacenta = fl.bacentaId ? bacentaMap.get(fl.bacentaId) || { id: fl.bacentaId, name: 'Unknown Bacenta' } : { id: 'unassigned', name: 'Unassigned' };
        const membersInFellowship = (presentByBacenta.get(fl.bacentaId) || []); // all present in that bacenta incl Red Bacenta (fellowship leader) if present
        // Linked bacentas for Red Bacenta (fellowship leader)
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
  }, [selectedSunday, attendanceRecords, members, newBelievers, bacentas, selectedMinistry]);

  // Helper: format date as "10 August 2025"
  const formatDayMonthYear = (dateStr: string) => {
    // Always formats the provided Sunday (selectedSunday) as "10 August 2025" using user's locale for month name only
    const d = new Date(dateStr + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return dateStr; // fallback to raw
    return `${d.getDate()} ${d.toLocaleString(undefined, { month: 'long' })} ${d.getFullYear()}`;
  };

  // Copy attendance data as formatted text (ministry-specific format when ministry is selected)
  const copyAttendanceText = async () => {
    try {
      const dateText = formatDayMonthYear(selectedSunday);

      // If ministry is selected, use the ministry-specific format
      if (selectedMinistry) {
        const ministryMembers = groupedAttendance.groups.flatMap(g => g.mainMembers)
          .concat(groupedAttendance.groups.flatMap(g => g.fellowshipGroups.flatMap(fg => fg.members)))
          .concat(groupedAttendance.groups.flatMap(g => g.linkedBacentaGroups.flatMap(lg => lg.members)))
          .concat(groupedAttendance.leftoverGroup?.members || []);

        // Get all members with the selected ministry (both present and absent)
        const allMinistryMembers = members.filter(m =>
          !m.frozen && m.ministry && m.ministry.toLowerCase() === selectedMinistry.toLowerCase()
        );

        const presentMemberIds = new Set(ministryMembers.map(m => m.id));
        const absentMembers = allMinistryMembers.filter(m => !presentMemberIds.has(m.id));

        let text = `*${selectedMinistry}'s attendance*\n`;
        text += `*${dateText}*\n\n`;

        ministryMembers.forEach((m, idx) => {
          text += `${idx + 1}. ${m.firstName}${m.lastName ? ' ' + m.lastName : ''}\n`;
        });

        text += `\n*Total: ${ministryMembers.length}*\n\n`;
        text += `Absentees\n`;

        absentMembers.forEach((m, idx) => {
          text += `${idx + 1}. ${m.firstName}${m.lastName ? ' ' + m.lastName : ''}\n`;
        });

        text += `\n*Total: ${absentMembers.length}*\n\n`;
        text += `*Grand total: ${allMinistryMembers.length}*`;

        await navigator.clipboard.writeText(text);
        showToast('success', 'Copied!', `${selectedMinistry} attendance copied to clipboard`);
        return;
      }

      // Default format for general attendance
      let text = `Weekly Attendance - ${formatFullDate(selectedSunday)}\n\n`;

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
            text += `\n❤️ Red Bacenta: ${fg.fellowshipLeader.firstName} ${fg.fellowshipLeader.lastName || ''} (${fg.bacenta.name})\n`;
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

  // Copy COs report (Admins only)
  const copyCOsReportText = async () => {
    try {
  // Constituency/Admin details (kept in sync with App Preferences)
      const coFirstName = (userProfile?.firstName || '').trim() || 'CO';

      // Build per-leader totals (members only; exclude new believers)
      const leaderTotals = groupedAttendance.groups.map(g => ({
        name: `${g.bacentaLeader.firstName}`.trim(),
        count:
          g.mainMembers.length +
          g.fellowshipGroups.reduce((s, fg) => s + fg.total, 0) +
          g.linkedBacentaGroups.reduce((s, lg) => s + lg.total, 0)
      }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

      const totalAttendance = leaderTotals.reduce((s, x) => s + x.count, 0);

      // First timers present today (new believers marked present AND isFirstTime)
      const presentNewBelieverIds = new Set(
        attendanceRecords
          .filter(r => r.date === selectedSunday && r.status === 'Present' && r.newBelieverId)
          .map(r => r.newBelieverId as string)
      );
      const todaysFirstTimers = newBelievers.filter(nb => presentNewBelieverIds.has(nb.id) && nb.isFirstTime).length;

      // Today's new believers (joined today)
      const todaysNewBelievers = newBelievers.filter(nb => nb.joinedDate === selectedSunday).length || 0;

      // Previous week's new believers (from last Sunday up to day before selected Sunday)
      const prevSunday = getPreviousSunday(selectedSunday);
      const prevWeeksNewBelievers = newBelievers.filter(nb => nb.joinedDate >= prevSunday && nb.joinedDate < selectedSunday).length || 0;

      // Compose text
  let text = `*${constituencyName}* COs Sunday Report\n\n`;
      text += `*(CO Name: ${coFirstName})*\n\n`;
      text += `*Date: ${formatDayMonthYear(selectedSunday)}*\n\n`;
      text += `*Attendance per bacenta leader: in descending order*\n\n`;
      if (leaderTotals.length === 0) {
        text += `No bacenta leaders with attendance.\n`;
      } else {
        leaderTotals.forEach((lt, idx) => {
          text += `${idx + 1}. ${lt.name}: ${lt.count}\n`;
        });
      }
      text += `\n*Total: ${totalAttendance}*\n\n`;
      text += `*No of Today's First Timers: ${todaysFirstTimers}*\n\n`;
      text += `*No of Todays New believers: ${todaysNewBelievers}*\n\n`;
      text += `*Number of Previous weeks new believers: ${prevWeeksNewBelievers}*`;

      await navigator.clipboard.writeText(text);
      showToast('success', 'Copied!', 'COs report copied to clipboard');
    } catch (error) {
      console.error('Failed to copy COs report:', error);
      showToast('error', 'Copy Failed', 'Unable to copy COs report');
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
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedMinistry ? `${selectedMinistry} Weekly Attendance` : 'Weekly Attendance'}
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                {selectedMinistry ? `${selectedMinistry} ministry attendance summary` : 'Sunday attendance summary'}
              </p>
            </div>

            {/* Ministry Filter - Only show if not in ministry context */}
            {!isMinistryContext && (
              <div className="mb-6">
                <div className="flex justify-center">
                  <div className="w-full max-w-xs">
                    <select
                      value={selectedMinistry}
                      onChange={(e) => setSelectedMinistry(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white text-gray-900 text-center cursor-pointer"
                    >
                      <option value="">All Ministries</option>
                      {MINISTRY_OPTIONS.map(ministry => (
                        <option key={ministry} value={ministry}>{ministry}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

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

            {/* Copy Buttons */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={copyAttendanceText}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-all duration-200 text-sm font-medium shadow-sm"
                title={selectedMinistry ? `Copy ${selectedMinistry} attendance as text` : "Copy attendance as text"}
              >
                <ClipboardIcon className="w-4 h-4" />
                <span>{selectedMinistry ? `Copy ${selectedMinistry}` : 'Copy Attendance'}</span>
              </button>
              {isAdmin && !selectedMinistry && (
                <button
                  onClick={copyCOsReportText}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-all duration-200 text-sm font-medium shadow-sm"
                  title="Copy COs report (Admins only)"
                >
                  <ClipboardIcon className="w-4 h-4" />
                  <span>Copy COs report</span>
                </button>
              )}
            </div>
          </div>

          {/* Professional Attendance Content */}
          <div className="p-6">
            {groupedAttendance.groups.length === 0 && !groupedAttendance.leftoverGroup ? (
              <div className="text-center py-12">
                <UsersIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-1">No Attendance Records</h3>
                <p className="text-gray-500 text-sm">
                  {selectedMinistry
                    ? `No ${selectedMinistry} members were marked present for this Sunday.`
                    : 'No one was marked present for this Sunday.'
                  }
                </p>
              </div>
            ) : (
              <>
                {/* Ministry Mode: Flat List */}
                {isMinistryContext ? (
                  <div className="space-y-6">
                    {/* Present Members */}
                    <div>
                      <ol className="space-y-1 list-decimal list-inside">
                        {(() => {
                          // Collect all present members from all groups
                          const allPresentMembers = [
                            ...groupedAttendance.groups.flatMap(g => g.mainMembers),
                            ...groupedAttendance.groups.flatMap(g => g.fellowshipGroups.flatMap(fg => fg.members)),
                            ...groupedAttendance.groups.flatMap(g => g.linkedBacentaGroups.flatMap(lg => lg.members)),
                            ...(groupedAttendance.leftoverGroup?.members || [])
                          ].sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '') || a.firstName.localeCompare(b.firstName));

                          return allPresentMembers.map(m => (
                            <li key={m.id} className="text-gray-800">{m.firstName}{m.lastName ? ' ' + m.lastName : ''}</li>
                          ));
                        })()}
                      </ol>
                      <div className="mt-4 text-sm font-semibold text-gray-700">
                        Total: {groupedAttendance.groups.reduce((sum, g) => sum + g.total, 0) + (groupedAttendance.leftoverGroup?.members.length || 0)}
                      </div>
                    </div>

                    {/* Absentees */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Absentees</h3>
                      <ol className="space-y-1 list-decimal list-inside">
                        {(() => {
                          // Get all present member IDs
                          const presentMemberIds = new Set([
                            ...groupedAttendance.groups.flatMap(g => g.mainMembers.map(m => m.id)),
                            ...groupedAttendance.groups.flatMap(g => g.fellowshipGroups.flatMap(fg => fg.members.map(m => m.id))),
                            ...groupedAttendance.groups.flatMap(g => g.linkedBacentaGroups.flatMap(lg => lg.members.map(m => m.id))),
                            ...(groupedAttendance.leftoverGroup?.members.map(m => m.id) || [])
                          ]);

                          // Get all ministry members (both present and absent)
                          const allMinistryMembers = members.filter(m =>
                            !m.frozen && m.ministry && m.ministry.toLowerCase() === (selectedMinistry || activeMinistryName || '').toLowerCase()
                          );

                          // Filter to get absent members
                          const absentMembers = allMinistryMembers
                            .filter(m => !presentMemberIds.has(m.id))
                            .sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '') || a.firstName.localeCompare(b.firstName));

                          return absentMembers.map(m => (
                            <li key={m.id} className="text-gray-800">{m.firstName}{m.lastName ? ' ' + m.lastName : ''}</li>
                          ));
                        })()}
                      </ol>
                      <div className="mt-4 text-sm font-semibold text-gray-700">
                        Total: {(() => {
                          const presentMemberIds = new Set([
                            ...groupedAttendance.groups.flatMap(g => g.mainMembers.map(m => m.id)),
                            ...groupedAttendance.groups.flatMap(g => g.fellowshipGroups.flatMap(fg => fg.members.map(m => m.id))),
                            ...groupedAttendance.groups.flatMap(g => g.linkedBacentaGroups.flatMap(lg => lg.members.map(m => m.id))),
                            ...(groupedAttendance.leftoverGroup?.members.map(m => m.id) || [])
                          ]);
                          const allMinistryMembers = members.filter(m =>
                            !m.frozen && m.ministry && m.ministry.toLowerCase() === (selectedMinistry || activeMinistryName || '').toLowerCase()
                          );
                          return allMinistryMembers.filter(m => !presentMemberIds.has(m.id)).length;
                        })()}
                      </div>
                    </div>

                    {/* Grand Total */}
                    <div className="border-t pt-4">
                      <div className="text-lg font-bold text-gray-900">
                        Grand total: {(() => {
                          const allMinistryMembers = members.filter(m =>
                            !m.frozen && m.ministry && m.ministry.toLowerCase() === (selectedMinistry || activeMinistryName || '').toLowerCase()
                          );
                          return allMinistryMembers.length;
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Normal Mode: Grouped Attendance List */
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
                      {/* Red Bacenta Groups */}
                      {group.fellowshipGroups.map(fg => (
                        <div key={fg.fellowshipLeader.id} className="mb-4 last:mb-0">
                          <h4 className="font-medium text-gray-900 flex items-center">
                            <span className="mr-2 text-lg">❤️</span>
                            Red Bacenta: {fg.fellowshipLeader.firstName} {fg.fellowshipLeader.lastName || ''} ({fg.bacenta.name})
                          </h4>
                          <ol className="mt-2 space-y-1 list-decimal list-inside">
                            {fg.members.map(m => (
                              <li key={m.id} className="text-gray-800">{m.firstName} {m.lastName}</li>
                            ))}
                          </ol>
                          {/* Linked bacentas under Red Bacenta */}
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
                )}

                {/* Grand Total and Ministry-specific Stats - Hidden in Ministry Mode */}
                {!isMinistryContext && (
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    {selectedMinistry ? (
                    <>
                      {/* Ministry-specific totals */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                          <h4 className="text-sm font-medium text-green-800 mb-1">Present</h4>
                          <span className="text-2xl font-bold text-green-600">{groupedAttendance.grandTotal}</span>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                          <h4 className="text-sm font-medium text-red-800 mb-1">Absent</h4>
                          <span className="text-2xl font-bold text-red-600">
                            {(() => {
                              const allMinistryMembers = members.filter(m =>
                                !m.frozen && m.ministry && m.ministry.toLowerCase() === selectedMinistry.toLowerCase()
                              );
                              return allMinistryMembers.length - groupedAttendance.grandTotal;
                            })()}
                          </span>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                          <h4 className="text-sm font-medium text-blue-800 mb-1">Total Members</h4>
                          <span className="text-2xl font-bold text-blue-600">
                            {(() => {
                              const allMinistryMembers = members.filter(m =>
                                !m.frozen && m.ministry && m.ministry.toLowerCase() === selectedMinistry.toLowerCase()
                              );
                              return allMinistryMembers.length;
                            })()}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 text-center">
                        {selectedMinistry} ministry attendance for {formatFullDate(selectedSunday)}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">Grand Total</h3>
                        <span className="text-2xl font-bold text-slate-600">{groupedAttendance.grandTotal}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Total attendance across all bacentas for {formatFullDate(selectedSunday)}
                      </p>
                    </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyAttendanceView;
