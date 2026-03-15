import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import {
  getCurrentOrMostRecentSunday,
  getNextSunday,
  getPreviousSunday,
  formatFullDate,
  formatCompactDate,
  getTodayYYYYMMDD,
  formatDateToYYYYMMDD,
  getWeeklyTotalsDates
} from '../../utils/dateUtils';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  UsersIcon,
  ClipboardIcon,
  TrendingUpIcon
} from '../icons';
import { Member, NewBeliever, Bacenta, SundayOfferingRecord } from '../../types';
import { hasAdminPrivileges, isCampusShepherd } from '../../utils/permissionUtils';
import { isLeadershipPosition, isMemberFirstTimerOnSunday } from '../../utils/memberStatus';
import { MINISTRY_OPTIONS } from '../../constants';
import { membersFirebaseService } from '../../services/firebaseService';
import { compressImageForInlineSave } from '../../services/imageStorageService';

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
    meetingRecords,
    sundayOfferingRecords,
    showToast,
    userProfile,
    isMinistryContext,
    activeMinistryName,
    saveSundayOfferingHandler
  } = useAppContext();

  const isAdmin = hasAdminPrivileges(userProfile);
  const canManageSundayIncome = isCampusShepherd(userProfile);

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
  const [togglingFirstTimer, setTogglingFirstTimer] = useState<Set<string>>(new Set());
  const [togglingNewBeliever, setTogglingNewBeliever] = useState<Set<string>>(new Set());
  const [cashOfferingInput, setCashOfferingInput] = useState<string>('0');
  const [onlineOfferingInput, setOnlineOfferingInput] = useState<string>('0');
  const [editingOfferingField, setEditingOfferingField] = useState<'cash' | 'online' | null>(null);
  const [reportImages, setReportImages] = useState<string[]>([]);
  const [selectedReportImage, setSelectedReportImage] = useState<string | null>(null);
  const [isCampusReportModalOpen, setIsCampusReportModalOpen] = useState(false);
  const [isSavingReportImages, setIsSavingReportImages] = useState(false);
  const [isSharingCampusReport, setIsSharingCampusReport] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const reportImageInputRef = useRef<HTMLInputElement | null>(null);
  const normalizedSelectedMinistry = selectedMinistry.trim().toLowerCase();

  const selectedSundayOffering = useMemo(() => (
    sundayOfferingRecords.find(record => record.date === selectedSunday) || null
  ), [selectedSunday, sundayOfferingRecords]);

  const presentMemberIds = useMemo(() => new Set(
    attendanceRecords
      .filter(r => r.date === selectedSunday && r.status === 'Present' && r.memberId)
      .map(r => r.memberId as string)
  ), [attendanceRecords, selectedSunday]);

  const presentNewBelieverIds = useMemo(() => new Set(
    attendanceRecords
      .filter(r => r.date === selectedSunday && r.status === 'Present' && r.newBelieverId)
      .map(r => r.newBelieverId as string)
  ), [attendanceRecords, selectedSunday]);

  const presentMembersForSelectedSunday = useMemo(() => {
    const filteredMembers = members.filter(member => {
      if (member.frozen || !presentMemberIds.has(member.id)) return false;
      if (!normalizedSelectedMinistry) return true;
      return (member.ministry || '').trim().toLowerCase() === normalizedSelectedMinistry;
    });

    return filteredMembers.sort((a, b) =>
      (a.lastName || '').localeCompare(b.lastName || '') || a.firstName.localeCompare(b.firstName)
    );
  }, [members, normalizedSelectedMinistry, presentMemberIds]);

  const presentFirstTimerMembers = useMemo(() => (
    presentMembersForSelectedSunday.filter(member => isMemberFirstTimerOnSunday(member, selectedSunday))
  ), [presentMembersForSelectedSunday, selectedSunday]);

  const presentFirstTimeNewBelievers = useMemo(() => {
    const filteredNewBelievers = newBelievers.filter(newBeliever => {
      if (!presentNewBelieverIds.has(newBeliever.id) || !newBeliever.isFirstTime) return false;
      if (!normalizedSelectedMinistry) return true;
      return (newBeliever.ministry || '').trim().toLowerCase() === normalizedSelectedMinistry;
    });

    return filteredNewBelievers.sort((a, b) =>
      `${a.name} ${a.surname || ''}`.localeCompare(`${b.name} ${b.surname || ''}`)
    );
  }, [newBelievers, normalizedSelectedMinistry, presentNewBelieverIds]);

  const totalPresentFirstTimers = presentFirstTimerMembers.length + presentFirstTimeNewBelievers.length;
  const parsedCashOffering = Math.max(0, Number(cashOfferingInput || 0));
  const parsedOnlineOffering = Math.max(0, Number(onlineOfferingInput || 0));
  const totalSundayOffering = parsedCashOffering + parsedOnlineOffering;

  useEffect(() => {
    setCashOfferingInput(String(selectedSundayOffering?.cashOffering ?? 0));
    setOnlineOfferingInput(String(selectedSundayOffering?.onlineOffering ?? 0));
  }, [selectedSundayOffering]);

  useEffect(() => {
    const nextImages = selectedSundayOffering?.reportImages || [];
    setReportImages(nextImages);
    setSelectedReportImage(currentSelected => {
      if (currentSelected && nextImages.includes(currentSelected)) {
        return currentSelected;
      }
      return nextImages[0] || null;
    });
  }, [selectedSundayOffering?.reportImages]);

  const toggleFirstTimer = async (member: Member) => {
    const isFirstTimerForSelectedSunday = isMemberFirstTimerOnSunday(member, selectedSunday);

    if (isLeadershipPosition(member) && !isFirstTimerForSelectedSunday) {
      showToast('warning', 'Unavailable', 'Leadership roles cannot be marked as first timers.');
      return;
    }
    if (togglingFirstTimer.has(member.id)) return;
    setTogglingFirstTimer(prev => new Set(prev).add(member.id));
    try {
      await membersFirebaseService.update(
        member.id,
        isFirstTimerForSelectedSunday
          ? { isFirstTimer: false, firstTimerWeekDate: '' }
          : { isFirstTimer: true, firstTimerWeekDate: selectedSunday }
      );
    } catch {
      showToast('error', 'Update Failed', 'Could not update first timer status.');
    } finally {
      setTogglingFirstTimer(prev => { const next = new Set(prev); next.delete(member.id); return next; });
    }
  };

  const toggleNewBeliever = async (member: Member) => {
    if (togglingNewBeliever.has(member.id)) return;
    setTogglingNewBeliever(prev => new Set(prev).add(member.id));
    try {
      await membersFirebaseService.update(member.id, { isNewBeliever: !member.isNewBeliever });
    } catch {
      showToast('error', 'Update Failed', 'Could not update new believer status.');
    } finally {
      setTogglingNewBeliever(prev => { const next = new Set(prev); next.delete(member.id); return next; });
    }
  };

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

  const copyFirstTimersText = async () => {
    try {
      const heading = selectedMinistry
        ? `${selectedMinistry} First Timers - ${formatFullDate(selectedSunday)}`
        : `First Timers - ${formatFullDate(selectedSunday)}`;

      let text = `${heading}\n\n`;

      if (!presentFirstTimerMembers.length && !presentFirstTimeNewBelievers.length) {
        text += 'No first timers were recorded for this Sunday.';
      } else {
        if (presentFirstTimerMembers.length > 0) {
          text += 'Members\n';
          presentFirstTimerMembers.forEach((member, index) => {
            const phoneNumber = (member.phoneNumber || '').trim() || 'No contact';
            text += `${index + 1}. ${member.firstName} ${member.lastName || ''} - ${phoneNumber}\n`;
          });
          text += `Total: ${presentFirstTimerMembers.length}\n`;
        }

        if (presentFirstTimeNewBelievers.length > 0) {
          if (presentFirstTimerMembers.length > 0) {
            text += '\n';
          }
          text += 'New Believers\n';
          presentFirstTimeNewBelievers.forEach((newBeliever, index) => {
            const contact = (newBeliever.contact || '').trim() || 'No contact';
            text += `${index + 1}. ${newBeliever.name} ${newBeliever.surname || ''} - ${contact}\n`;
          });
          text += `Total: ${presentFirstTimeNewBelievers.length}\n`;
        }

        text += `\nGrand Total: ${totalPresentFirstTimers}`;
      }

      await navigator.clipboard.writeText(text);
      showToast('success', 'Copied!', 'First timers with contacts copied to clipboard');
    } catch (error) {
      console.error('Failed to copy first timers:', error);
      showToast('error', 'Copy Failed', 'Unable to copy first timers');
    }
  };

  const buildCampusReportText = () => {
    const campusName = constituencyName.trim() || 'No Constituency';
    const campusShepherdName = [userProfile?.firstName, userProfile?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() || userProfile?.displayName || 'Admin';

    const leaderTotals = groupedAttendance.groups.map(g => ({
      name: `${g.bacentaLeader.firstName} ${g.bacentaLeader.lastName || ''}`.trim(),
      count:
        g.mainMembers.length +
        g.fellowshipGroups.reduce((sum, fellowshipGroup) => sum + fellowshipGroup.total, 0) +
        g.linkedBacentaGroups.reduce((sum, linkedGroup) => sum + linkedGroup.total, 0)
    }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const totalAttendance = groupedAttendance.grandTotal;
    const presentNewBelieverIds = new Set(
      attendanceRecords
        .filter(record => record.date === selectedSunday && record.status === 'Present' && record.newBelieverId)
        .map(record => record.newBelieverId as string)
    );
    const todaysFirstTimers = totalPresentFirstTimers;
    const todaysNewConverts = newBelievers.filter(
      newBeliever => presentNewBelieverIds.has(newBeliever.id) && newBeliever.joinedDate === selectedSunday
    ).length;

    let text = '*Gathering Service attendance*\n\n';
    text += `*Campus Name : ${campusName}*\n\n`;
    text += `Campus Shepherd : ${campusShepherdName}\n\n`;
    text += `Date of service: ${formatSlashDate(selectedSunday)}\n\n`;
    text += `*Gathering service total attendance : ${formatCount(totalAttendance)}*\n\n`;
    text += `*TOTAL Income (week) : ${formatReportCurrency(weeklyIncomeSummary.totalWeekIncome)}*\n\n`;
    text += `*Gathering service Income Cash: ${formatCompactReportCurrency(weeklyIncomeSummary.sundayCash)}*\n`;
    text += `*Offering: ${formatReportCurrency(weeklyIncomeSummary.sundayCash)}*\n`;
    text += `*Tithe: ${untrackedCurrencySplit}*\n\n`;
    text += `*Total EFT transfers* (electronic only): ${formatReportCurrency(weeklyIncomeSummary.sundayOnline)}\n`;
    text += `*EFT tithes : ${untrackedCurrencySplit}:*\n`;
    text += `*EFT offering : ${formatReportCurrency(weeklyIncomeSummary.sundayOnline)}*\n\n`;
    text += 'Breakdown Per Bacenta Leader\n';

    if (leaderTotals.length > 0) {
      text += '\n';
      leaderTotals.forEach((leaderTotal, index) => {
        text += `${index + 1}. ${leaderTotal.name}: ${formatCount(leaderTotal.count)}\n`;
      });
      text += '\n';
    } else {
      text += '\n';
    }

    text += `*New converts: ${formatCount(todaysNewConverts)}*\n`;
    text += `*First Timers: ${formatCount(todaysFirstTimers)}*\n`;
    text += `*Total attendance: ${formatCount(totalAttendance)}*`;

    return text;
  };

  const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });

  const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert image for clipboard'));
    reader.readAsDataURL(blob);
  });

  const blobToPngBlob = async (blob: Blob): Promise<Blob> => {
    if (blob.type === 'image/png') {
      return blob;
    }

    const objectUrl = URL.createObjectURL(blob);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = () => reject(new Error('Failed to prepare the selected picture'));
        nextImage.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Failed to prepare the selected picture');
      }

      context.drawImage(image, 0, 0);

      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(result => {
          if (result) {
            resolve(result);
            return;
          }
          reject(new Error('Failed to prepare the selected picture'));
        }, 'image/png');
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const escapeHtml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const dataUrlToBlob = (dataUrl: string): Blob => {
    const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
    if (!match) {
      throw new Error('Selected picture format is invalid');
    }

    const mimeType = match[1] || 'application/octet-stream';
    const isBase64 = Boolean(match[2]);
    const payload = match[3] || '';

    if (isBase64) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return new Blob([bytes], { type: mimeType });
    }

    return new Blob([decodeURIComponent(payload)], { type: mimeType });
  };

  const getImageBlob = async (imageValue: string): Promise<Blob> => {
    if (imageValue.startsWith('data:')) {
      return dataUrlToBlob(imageValue);
    }

    const response = await fetch(imageValue);
    if (!response.ok) {
      throw new Error('Failed to load the selected picture');
    }
    return response.blob();
  };

  const getClipboardImageBlob = async (imageValue: string): Promise<Blob> => {
    const sourceBlob = await getImageBlob(imageValue);
    return blobToPngBlob(sourceBlob);
  };

  const buildNativeShareFile = async (imageValue: string): Promise<string> => {
    const sourceBlob = await getImageBlob(imageValue);
    const imageDataUrl = await blobToDataUrl(sourceBlob);
    const [, base64Payload = ''] = imageDataUrl.split(',', 2);
    const extension = sourceBlob.type.includes('png') ? 'png' : sourceBlob.type.includes('webp') ? 'webp' : 'jpg';
    const fileName = `share/gathering-service-${selectedSunday}.${extension}`;
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64Payload,
      directory: Directory.Cache,
      recursive: true
    });
    return result.uri;
  };

  const saveReportImages = async (nextImages: string[], nextSelectedImage?: string | null) => {
    const normalizedCash = String(Math.max(0, Number(cashOfferingInput || 0)));
    const normalizedOnline = String(Math.max(0, Number(onlineOfferingInput || 0)));
    const previousImages = reportImages;
    const previousSelectedImage = selectedReportImage;

    setReportImages(nextImages);
    setSelectedReportImage(nextSelectedImage === undefined ? (nextImages[0] || null) : nextSelectedImage);
    setIsSavingReportImages(true);

    try {
      await persistSundayOffering(normalizedCash, normalizedOnline, nextImages);
    } catch (error) {
      setReportImages(previousImages);
      setSelectedReportImage(previousSelectedImage);
      throw error;
    } finally {
      setIsSavingReportImages(false);
    }
  };

  const handleReportImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (!files.length) {
      return;
    }

    const invalidFile = files.find(file => !['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type));
    if (invalidFile) {
      showToast('error', 'Invalid image', 'Please upload JPG, PNG, or WEBP pictures only.');
      return;
    }

    try {
      const addedImages = await Promise.all(files.map(async file => {
        const imageDataUrl = await readFileAsDataUrl(file);
        return compressImageForInlineSave(imageDataUrl, {
          maxLength: 680000,
          processingErrorMessage: 'Failed to process report picture.',
          oversizeErrorMessage: 'Report picture is still too large after auto-compression. Please choose a smaller picture and try again.'
        });
      }));
      const nextImages = [...reportImages, ...addedImages];
      await saveReportImages(nextImages, selectedReportImage || addedImages[0] || nextImages[0] || null);
      showToast('success', 'Pictures added', `${addedImages.length} picture${addedImages.length === 1 ? '' : 's'} added to this report.`);
    } catch (error: any) {
      showToast('error', 'Upload Failed', error?.message || 'Could not load the selected pictures.');
    }
  };

  const handleRemoveReportImage = async (imageToRemove: string) => {
    const nextImages = reportImages.filter(image => image !== imageToRemove);
    const nextSelectedImage = selectedReportImage === imageToRemove ? (nextImages[0] || null) : selectedReportImage;
    await saveReportImages(nextImages, nextSelectedImage);
  };

  const openPreviewImage = (imageIndex: number) => {
    setPreviewImageIndex(imageIndex);
  };

  const closePreviewImage = () => {
    setPreviewImageIndex(null);
  };

  const showPreviousPreviewImage = () => {
    setPreviewImageIndex(currentIndex => {
      if (currentIndex === null || reportImages.length === 0) return currentIndex;
      return (currentIndex - 1 + reportImages.length) % reportImages.length;
    });
  };

  const showNextPreviewImage = () => {
    setPreviewImageIndex(currentIndex => {
      if (currentIndex === null || reportImages.length === 0) return currentIndex;
      return (currentIndex + 1) % reportImages.length;
    });
  };

  const copyCampusReportTextOnly = async () => {
    try {
      await navigator.clipboard.writeText(buildCampusReportText());
      setIsCampusReportModalOpen(false);
      showToast('success', 'Copied!', 'Campus shepherd report copied to clipboard.');
    } catch (error) {
      console.error('Failed to copy campus shepherd report text:', error);
      showToast('error', 'Copy Failed', 'Unable to copy the campus shepherd report.');
    }
  };

  const copyCampusReportWithImage = async () => {
    if (!selectedReportImage) {
      await copyCampusReportTextOnly();
      return;
    }

    setIsSharingCampusReport(true);
    try {
      const text = buildCampusReportText();
      const ClipboardItemCtor = (globalThis as any).ClipboardItem;

      if (!navigator.clipboard?.write || !ClipboardItemCtor) {
        await navigator.clipboard.writeText(text);
        setIsCampusReportModalOpen(false);
        showToast('warning', 'Text copied', 'Your browser cannot copy picture + text together. Use Share to WhatsApp for the full report.');
        return;
      }

      const imageBlob = await getClipboardImageBlob(selectedReportImage);
      const imageDataUrl = await blobToDataUrl(imageBlob);
      const html = `<div><img src="${imageDataUrl}" alt="Report image" style="max-width:100%;height:auto;display:block;margin-bottom:12px;" /><div style="white-space:pre-wrap;">${escapeHtml(text).replace(/\n/g, '<br>')}</div></div>`;
      const clipboardPayload: Record<string, Blob> = {
        'text/plain': new Blob([text], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
        'image/png': imageBlob
      };

      await navigator.clipboard.write([new ClipboardItemCtor(clipboardPayload)]);
      setIsCampusReportModalOpen(false);
      showToast('success', 'Copied!', 'Report copied with the selected picture. If WhatsApp does not paste both together, use Share to WhatsApp.');
    } catch (error: any) {
      console.error('Failed to copy campus shepherd report with image:', error);
      if (String(error?.message || '').toLowerCase().includes('not supported')) {
        await copyCampusReportTextOnly();
        showToast('warning', 'Picture copy not supported', 'This device can copy the report text, but not an image to the clipboard. Use Share to WhatsApp for the picture version.');
      } else {
        showToast('error', 'Copy Failed', 'Unable to copy the report with the selected picture.');
      }
    } finally {
      setIsSharingCampusReport(false);
    }
  };

  const shareCampusReport = async () => {
    const text = buildCampusReportText();
    setIsSharingCampusReport(true);

    try {
      if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Share')) {
        const files = selectedReportImage ? [await buildNativeShareFile(selectedReportImage)] : undefined;
        await Share.share({
          title: 'Gathering Service attendance',
          text,
          files,
          dialogTitle: 'Share to WhatsApp'
        });
        setIsCampusReportModalOpen(false);
        return;
      }

      if (!navigator.share) {
        if (selectedReportImage) {
          await copyCampusReportWithImage();
        } else {
          await copyCampusReportTextOnly();
        }
        return;
      }

      if (selectedReportImage) {
        const imageBlob = await getImageBlob(selectedReportImage);
        const extension = imageBlob.type.includes('png') ? 'png' : imageBlob.type.includes('webp') ? 'webp' : 'jpg';
        const reportFile = new File([imageBlob], `gathering-service-${selectedSunday}.${extension}`, { type: imageBlob.type || 'image/jpeg' });

        if (!navigator.canShare || navigator.canShare({ files: [reportFile] })) {
          await navigator.share({
            title: 'Gathering Service attendance',
            text,
            files: [reportFile]
          });
          setIsCampusReportModalOpen(false);
          return;
        }
      }

      await navigator.share({
        title: 'Gathering Service attendance',
        text
      });
      setIsCampusReportModalOpen(false);
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Failed to share campus shepherd report:', error);
        showToast('error', 'Share Failed', error?.message || 'Unable to share the report.');
      }
    } finally {
      setIsSharingCampusReport(false);
    }
  };

  const handlePreviousSunday = () => {
    setSelectedSunday(getPreviousSunday(selectedSunday));
  };

  const handleNextSunday = () => {
    setSelectedSunday(getNextSunday(selectedSunday));
  };

  const canGoNext = selectedSunday < getTodayYYYYMMDD();

  const formatSlashDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    if (Number.isNaN(date.getTime())) return dateStr;
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  };

  const formatZarAmount = (amount: number) => {
    const normalizedAmount = Number.isFinite(amount) ? amount : 0;
    return `R${normalizedAmount.toFixed(2).replace(/\.00$/, '')}`;
  };

  const formatUsdAmount = (amount: number) => {
    const normalizedAmount = Number.isFinite(amount) ? amount : 0;
    const approximateZarPerUsd = 16.88;
    return `$${(normalizedAmount / approximateZarPerUsd).toFixed(2)}`;
  };

  const formatReportCurrency = (amount: number) => `${formatZarAmount(amount)} (${formatUsdAmount(amount)})`;
  const formatCompactReportCurrency = (amount: number) => `${formatZarAmount(amount)}(${formatUsdAmount(amount)})`;
  const formatCount = (count: number) => String(Math.max(0, count)).padStart(2, '0');
  const untrackedCurrencySplit = 'R__ ($__)';

  const weeklyIncomeSummary = useMemo(() => {
    const selectedDate = new Date(selectedSunday + 'T00:00:00');
    const dayOfWeek = selectedDate.getDay();
    const mondayDate = new Date(selectedDate);
    mondayDate.setDate(selectedDate.getDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek));

    const weekDates = getWeeklyTotalsDates(formatDateToYYYYMMDD(mondayDate));
    const weekMeetingRecords = meetingRecords.filter(record =>
      record.date === weekDates.wednesday || record.date === weekDates.thursday
    );

    const bacentaWeekOffering = weekMeetingRecords.reduce(
      (sum, record) => sum + (record.totalOffering ?? ((record.cashOffering || 0) + (record.onlineOffering || 0))),
      0
    );
    const sundayCash = selectedSundayOffering?.cashOffering ?? 0;
    const sundayOnline = selectedSundayOffering?.onlineOffering ?? 0;
    const sundayTotal = selectedSundayOffering?.totalOffering ?? (sundayCash + sundayOnline);

    return {
      bacentaWeekOffering,
      sundayCash,
      sundayOnline,
      totalWeekIncome: bacentaWeekOffering + sundayTotal
    };
  }, [meetingRecords, selectedSunday, selectedSundayOffering]);

  const persistSundayOffering = async (cashValue: string, onlineValue: string, reportImagesOverride?: string[]) => {
    if (!canManageSundayIncome) {
      return;
    }

    const cashAmount = Math.max(0, Number(cashValue || 0));
    const onlineAmount = Math.max(0, Number(onlineValue || 0));

    if (Number.isNaN(cashAmount) || Number.isNaN(onlineAmount)) {
      showToast('warning', 'Invalid amount', 'Please enter a valid amount.');
      return;
    }

    const record: SundayOfferingRecord = {
      id: `sunday_${selectedSunday}`,
      date: selectedSunday,
      cashOffering: cashAmount,
      onlineOffering: onlineAmount,
      totalOffering: cashAmount + onlineAmount,
      reportImages: reportImagesOverride ?? reportImages,
      notes: selectedSundayOffering?.notes || ''
    };

    try {
      await saveSundayOfferingHandler(record);
    } catch (error) {
      throw error;
    }
  };

  const handleOfferingCardClick = (field: 'cash' | 'online') => {
    if (!canManageSundayIncome) return;
    setEditingOfferingField(field);
  };

  const handleOfferingFieldBlur = async () => {
    const normalizedCash = String(Math.max(0, Number(cashOfferingInput || 0)));
    const normalizedOnline = String(Math.max(0, Number(onlineOfferingInput || 0)));

    if (normalizedCash !== cashOfferingInput) {
      setCashOfferingInput(normalizedCash);
    }
    if (normalizedOnline !== onlineOfferingInput) {
      setOnlineOfferingInput(normalizedOnline);
    }

    setEditingOfferingField(null);
    await persistSundayOffering(normalizedCash, normalizedOnline);
  };

  const handleOfferingFieldKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
      return;
    }

    if (event.key === 'Escape') {
      setCashOfferingInput(String(selectedSundayOffering?.cashOffering ?? 0));
      setOnlineOfferingInput(String(selectedSundayOffering?.onlineOffering ?? 0));
      setEditingOfferingField(null);
    }
  };

  // Mobile-friendly member row: icon-only circular tag buttons + active tag chips below name
  const renderMemberRow = (m: Member, idx: number) => {
    const isFirstTimerForSelectedSunday = isMemberFirstTimerOnSunday(m, selectedSunday);

    return (
      <div key={m.id} className="flex items-center gap-2.5 py-2 px-2 rounded-xl transition-colors active:bg-gray-50/80">
        <span className="text-[11px] text-gray-400 w-5 text-right shrink-0 tabular-nums">{idx + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate leading-snug">
            {m.firstName} {m.lastName || ''}
          </p>
          {(m.isNewBeliever || isFirstTimerForSelectedSunday) && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {m.isNewBeliever && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 leading-tight">
                  ✝ New Believer
                </span>
              )}
              {isFirstTimerForSelectedSunday && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200 leading-tight">
                  ★ First Timer
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => toggleNewBeliever(m)}
            disabled={togglingNewBeliever.has(m.id)}
            aria-label={m.isNewBeliever ? 'Remove new believer tag' : 'Mark as new believer'}
            className={`w-8 h-8 flex items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-150 disabled:opacity-40 active:scale-90 touch-manipulation ${
              m.isNewBeliever
                ? 'bg-blue-500 border-blue-400 text-white shadow-sm shadow-blue-200'
                : 'bg-white border-gray-200 text-gray-300 hover:border-blue-300 hover:text-blue-400'
            }`}
          >
            {togglingNewBeliever.has(m.id) ? '·' : '✝'}
          </button>
          <button
            onClick={() => toggleFirstTimer(m)}
            disabled={togglingFirstTimer.has(m.id)}
            aria-label={
              isLeadershipPosition(m) && !isFirstTimerForSelectedSunday
                ? 'Leadership roles cannot be marked as first timers'
                : isFirstTimerForSelectedSunday ? 'Remove first timer tag' : 'Mark as first timer'
            }
            title={
              isLeadershipPosition(m) && !isFirstTimerForSelectedSunday
                ? 'Leadership roles cannot be marked as first timers'
                : isFirstTimerForSelectedSunday ? 'Remove first timer tag' : 'Mark as first timer'
            }
            className={`w-8 h-8 flex items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-150 disabled:opacity-40 active:scale-90 touch-manipulation ${
              isFirstTimerForSelectedSunday
                ? 'bg-orange-500 border-orange-400 text-white shadow-sm shadow-orange-200'
                : isLeadershipPosition(m)
                  ? 'bg-gray-100 border-gray-200 text-gray-300'
                  : 'bg-white border-gray-200 text-gray-300 hover:border-orange-300 hover:text-orange-400'
            }`}
          >
            {togglingFirstTimer.has(m.id) ? '·' : '★'}
          </button>
        </div>
      </div>
    );
  };

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
            <div className="grid w-full max-w-sm mx-auto gap-3 sm:flex sm:max-w-none sm:items-center sm:justify-center">
              <button
                onClick={copyAttendanceText}
                className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-slate-600 px-4 py-3 text-center text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-slate-700 sm:min-h-[48px] sm:w-auto sm:px-4 sm:py-2"
                title={selectedMinistry ? `Copy ${selectedMinistry} attendance as text` : "Copy attendance as text"}
              >
                <ClipboardIcon className="w-4 h-4" />
                <span className="leading-tight">{selectedMinistry ? `Copy ${selectedMinistry}` : 'Copy Attendance'}</span>
              </button>
              <button
                onClick={copyFirstTimersText}
                disabled={totalPresentFirstTimers === 0}
                className={`inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-center text-sm font-medium transition-all duration-200 sm:min-h-[48px] sm:w-auto sm:px-4 sm:py-2 ${
                  totalPresentFirstTimers > 0
                    ? 'bg-orange-600 text-white shadow-sm hover:bg-orange-700'
                    : 'cursor-not-allowed bg-gray-200 text-gray-500 shadow-none'
                }`}
                title={totalPresentFirstTimers > 0 ? 'Copy first timers with contacts' : 'No first timers to copy'}
              >
                <ClipboardIcon className="w-4 h-4" />
                <span className="leading-tight">Copy First Timers</span>
              </button>
              {isAdmin && !selectedMinistry && (
                <button
                  onClick={() => setIsCampusReportModalOpen(true)}
                  className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-center text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-amber-700 sm:min-h-[48px] sm:w-auto sm:px-4 sm:py-2"
                  title="Choose how to copy or share the campus shepherd report"
                >
                  <ClipboardIcon className="w-4 h-4" />
                  <span className="leading-tight">Copy Campus Shepherd report</span>
                </button>
              )}
            </div>

            {canManageSundayIncome && !selectedMinistry && (
              <div className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="bg-gray-50/80 px-3.5 py-3.5 sm:px-4 sm:py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0 lg:max-w-xl">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                        <TrendingUpIcon className="h-3 w-3" />
                        Sunday Income
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-gray-900 sm:text-base">
                        Record this Sunday&apos;s offering
                      </h3>
                      <p className="mt-1 text-xs sm:text-sm text-gray-600">
                        Tap `Cash` or `Online` to edit. `Total` updates automatically for {formatCompactDate(selectedSunday)}.
                      </p>
                    </div>

                    <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-3 lg:max-w-[500px]">
                      <button
                        type="button"
                        onClick={() => handleOfferingCardClick('cash')}
                        className={`rounded-lg border px-3 py-2.5 text-left transition-all duration-200 ${
                          editingOfferingField === 'cash'
                            ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/60'
                        }`}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Cash</p>
                        {editingOfferingField === 'cash' ? (
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={cashOfferingInput}
                            onChange={(e) => setCashOfferingInput(e.target.value)}
                            onBlur={handleOfferingFieldBlur}
                            onKeyDown={handleOfferingFieldKeyDown}
                            autoFocus
                            className="mt-1.5 w-full border-0 bg-transparent p-0 text-xl font-bold text-gray-900 outline-none"
                          />
                        ) : (
                          <p className="mt-1.5 text-xl font-bold text-gray-900">R{parsedCashOffering.toFixed(2)}</p>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOfferingCardClick('online')}
                        className={`rounded-lg border px-3 py-2.5 text-left transition-all duration-200 ${
                          editingOfferingField === 'online'
                            ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/60'
                        }`}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Online</p>
                        {editingOfferingField === 'online' ? (
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={onlineOfferingInput}
                            onChange={(e) => setOnlineOfferingInput(e.target.value)}
                            onBlur={handleOfferingFieldBlur}
                            onKeyDown={handleOfferingFieldKeyDown}
                            autoFocus
                            className="mt-1.5 w-full border-0 bg-transparent p-0 text-xl font-bold text-gray-900 outline-none"
                          />
                        ) : (
                          <p className="mt-1.5 text-xl font-bold text-gray-900">R{parsedOnlineOffering.toFixed(2)}</p>
                        )}
                      </button>

                      <div className="rounded-lg border border-emerald-200 bg-emerald-600 px-3 py-2.5 text-left">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-100">Total</p>
                        <p className="mt-1.5 text-xl font-bold text-white">R{totalSundayOffering.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {canManageSundayIncome && !selectedMinistry && (
              <div className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="bg-gray-50/80 px-3.5 py-3.5 sm:px-4 sm:py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 lg:max-w-xl">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                        Report Pictures
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-gray-900 sm:text-base">
                        Attach pictures for this Sunday report
                      </h3>
                      <p className="mt-1 text-xs sm:text-sm text-gray-600">
                        Upload as many pictures as you need. When you copy the report, you can choose one picture or continue with no picture.
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <input
                        ref={reportImageInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        multiple
                        onChange={handleReportImageFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => reportImageInputRef.current?.click()}
                        disabled={isSavingReportImages}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSavingReportImages ? 'Saving...' : 'Upload Pictures'}
                      </button>
                    </div>
                  </div>

                  {reportImages.length > 0 ? (
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {reportImages.map((image, index) => {
                        const isSelected = selectedReportImage === image;
                        return (
                          <div
                            key={`${image}_${index}`}
                            className={`relative overflow-hidden rounded-xl border-2 ${isSelected ? 'border-amber-500 ring-2 ring-amber-200' : 'border-gray-200'} bg-white`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedReportImage(image)}
                              className="block w-full text-left"
                              title="Choose this picture for the report"
                            >
                              <img src={image} alt={`Report ${index + 1}`} className="h-32 w-full object-cover" />
                              <div className="px-3 py-2 text-xs font-medium text-gray-700">
                                {isSelected ? 'Selected for report' : `Picture ${index + 1}`}
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => openPreviewImage(index)}
                              className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-gray-700 shadow-sm"
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRemoveReportImage(image)}
                              disabled={isSavingReportImages}
                              className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">
                      No report pictures uploaded for this Sunday yet.
                    </div>
                  )}
                </div>
              </div>
            )}
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
                          <div className="mt-2 space-y-0.5">
                            {group.mainMembers.map((m, idx) => renderMemberRow(m, idx))}
                          </div>
                        </div>
                      {/* Linked Bacentas under Bacenta Leader */}
                      {group.linkedBacentaGroups && group.linkedBacentaGroups.map(lg => (
                        <div key={lg.bacenta.id} className="mb-4">
                          <h4 className="font-medium text-gray-900 flex items-center">
                            <span className="mr-2 text-lg">❤</span>
                            {lg.bacenta.name}
                          </h4>
                          <div className="mt-2 space-y-0.5">
                            {lg.members.map((m, idx) => renderMemberRow(m, idx))}
                          </div>
                        </div>
                      ))}
                      {/* Red Bacenta Groups */}
                      {group.fellowshipGroups.map(fg => (
                        <div key={fg.fellowshipLeader.id} className="mb-4 last:mb-0">
                          <h4 className="font-medium text-gray-900 flex items-center">
                            <span className="mr-2 text-lg">❤️</span>
                            Red Bacenta: {fg.fellowshipLeader.firstName} {fg.fellowshipLeader.lastName || ''} ({fg.bacenta.name})
                          </h4>
                          <div className="mt-2 space-y-0.5">
                            {fg.members.map((m, idx) => renderMemberRow(m, idx))}
                          </div>
                          {/* Linked bacentas under Red Bacenta */}
                          {fg.linkedBacentaGroups && fg.linkedBacentaGroups.map(lg => (
                            <div key={lg.bacenta.id} className="mt-3">
                              <h5 className="font-medium text-gray-800 flex items-center">
                                <span className="mr-2 text-base">❤</span>
                                {lg.bacenta.name}
                              </h5>
                              <div className="mt-1 space-y-0.5">
                                {lg.members.map((m, idx) => renderMemberRow(m, idx))}
                              </div>
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
                        <div className="space-y-0.5">
                          {groupedAttendance.leftoverGroup.members.map((m, idx) => renderMemberRow(m, idx))}
                        </div>
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
                      {canManageSundayIncome && (
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Sunday Cash</p>
                            <p className="mt-1 text-xl font-bold text-emerald-900">R{(selectedSundayOffering?.cashOffering ?? 0).toFixed(2)}</p>
                          </div>
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Sunday Online</p>
                            <p className="mt-1 text-xl font-bold text-amber-900">R{(selectedSundayOffering?.onlineOffering ?? 0).toFixed(2)}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-center">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-300">Sunday Offering</p>
                            <p className="mt-1 text-xl font-bold text-white">R{(selectedSundayOffering?.totalOffering ?? 0).toFixed(2)}</p>
                          </div>
                        </div>
                      )}
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

        {previewImageIndex !== null && reportImages[previewImageIndex] && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
            <div className="relative flex max-h-[92vh] w-full max-w-5xl items-center justify-center">
              {reportImages.length > 1 && (
                <button
                  type="button"
                  onClick={showPreviousPreviewImage}
                  className="absolute left-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25"
                  title="Previous picture"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
              )}

              <div className="overflow-hidden rounded-2xl bg-white/5 p-2 backdrop-blur-sm">
                <img
                  src={reportImages[previewImageIndex]}
                  alt={`Report preview ${previewImageIndex + 1}`}
                  className="max-h-[82vh] max-w-full rounded-xl object-contain"
                />
              </div>

              {reportImages.length > 1 && (
                <button
                  type="button"
                  onClick={showNextPreviewImage}
                  className="absolute right-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25"
                  title="Next picture"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              )}

              <button
                type="button"
                onClick={closePreviewImage}
                className="absolute right-2 top-2 inline-flex min-h-[40px] items-center justify-center rounded-full bg-black/60 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-black/75"
              >
                Close
              </button>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
                {previewImageIndex + 1} / {reportImages.length}
              </div>
            </div>
          </div>
        )}

        {isCampusReportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
              <div className="border-b border-gray-200 px-5 py-4">
                <h3 className="text-lg font-semibold text-gray-900">Campus Shepherd Report</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Choose whether to copy the report with no picture, or select one picture for the report. Use Share to WhatsApp for the most reliable picture + data result on mobile.
                </p>
              </div>

              <div className="px-5 py-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setSelectedReportImage(null)}
                    className={`rounded-xl border-2 px-4 py-5 text-left transition-all ${selectedReportImage === null ? 'border-slate-500 bg-slate-50 ring-2 ring-slate-200' : 'border-gray-200 bg-white hover:border-slate-300'}`}
                  >
                    <div className="text-sm font-semibold text-gray-900">No picture</div>
                    <div className="mt-1 text-xs text-gray-500">Copy or share the report text only.</div>
                  </button>

                  {reportImages.map((image, index) => {
                    const isSelected = selectedReportImage === image;
                    return (
                      <button
                        key={`${image}_modal_${index}`}
                        type="button"
                        onClick={() => setSelectedReportImage(image)}
                        className={`overflow-hidden rounded-xl border-2 text-left transition-all ${isSelected ? 'border-amber-500 ring-2 ring-amber-200' : 'border-gray-200 hover:border-amber-300'}`}
                      >
                        <img src={image} alt={`Selected report option ${index + 1}`} className="h-32 w-full object-cover" />
                        <div className="px-3 py-2">
                          <div className="text-sm font-semibold text-gray-900">Picture {index + 1}</div>
                          <div className="mt-1 text-xs text-gray-500">{isSelected ? 'Selected for the report' : 'Tap to use this picture'}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {reportImages.length === 0 && (
                  <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                    No pictures uploaded yet. Upload pictures in the Report Pictures section if you want the report to go out with an image.
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsCampusReportModalOpen(false)}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void copyCampusReportTextOnly()}
                  disabled={isSharingCampusReport}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Copy No Picture
                </button>
                <button
                  type="button"
                  onClick={() => void copyCampusReportWithImage()}
                  disabled={isSharingCampusReport || !selectedReportImage}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSharingCampusReport ? 'Working...' : 'Copy With Selected Picture'}
                </button>
                <button
                  type="button"
                  onClick={() => void shareCampusReport()}
                  disabled={isSharingCampusReport}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSharingCampusReport ? 'Working...' : 'Share to WhatsApp'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyAttendanceView;
