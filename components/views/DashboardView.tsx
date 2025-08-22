
import React, { memo, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
// import { hasAdminPrivileges } from '../../utils/permissionUtils';
import { PeopleIcon, AttendanceIcon, CalendarIcon, ChartBarIcon, PrayerIcon, CurrencyDollarIcon } from '../icons';
import { getMonthName, getCurrentOrMostRecentSunday, formatFullDate, getUpcomingSunday, getCurrentMeetingWeek, getMeetingWeekRange } from '../../utils/dateUtils';
import { db } from '../../firebase.config';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseUtils } from '../../services/firebaseService';
import { TabKeys } from '../../types';
import { dashboardLayoutStorage } from '../../utils/localStorage';
import { hasAdminPrivileges } from '../../utils/permissionUtils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: React.ReactNode;
  onClick?: () => void;
  accentColor?: string;
}

const StatCard: React.FC<StatCardProps> = memo(({ title, value, icon, description, onClick, accentColor = 'slate' }) => {
  const getAccentClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          border: 'border-l-4 border-l-blue-400 dark:border-l-blue-500',
          icon: 'text-blue-500 dark:text-blue-400',
          hover: 'hover:border-blue-300 dark:hover:border-blue-600'
        };
      case 'emerald':
        return {
          border: 'border-l-4 border-l-emerald-400 dark:border-l-emerald-500',
          icon: 'text-emerald-500 dark:text-emerald-400',
          hover: 'hover:border-emerald-300 dark:hover:border-emerald-600'
        };
      case 'amber':
        return {
          border: 'border-l-4 border-l-amber-400 dark:border-l-amber-500',
          icon: 'text-amber-500 dark:text-amber-400',
          hover: 'hover:border-amber-300 dark:hover:border-amber-600'
        };
      case 'rose':
        return {
          border: 'border-l-4 border-l-rose-400 dark:border-l-rose-500',
          icon: 'text-rose-500 dark:text-rose-400',
          hover: 'hover:border-rose-300 dark:hover:border-rose-600'
        };
      case 'indigo':
        return {
          border: 'border-l-4 border-l-indigo-400 dark:border-l-indigo-500',
          icon: 'text-indigo-500 dark:text-indigo-400',
          hover: 'hover:border-indigo-300 dark:hover:border-indigo-600'
        };
      default:
        return {
          border: 'border-l-4 border-l-slate-300 dark:border-l-slate-600',
          icon: 'text-slate-500 dark:text-slate-400',
          hover: 'hover:border-slate-400 dark:hover:border-slate-500'
        };
    }
  };

  const accents = getAccentClasses(accentColor);

  return (
    <div
  className={`p-4 sm:p-5 md:p-6 desktop:p-5 desktop-lg:p-6 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 ${accents.border} rounded-lg desktop:rounded-xl shadow-sm hover:shadow-md desktop:hover:shadow-lg relative h-[120px] sm:h-[140px] desktop:h-[160px] desktop-lg:h-[180px] flex flex-col justify-between transition-all duration-200 desktop-card-hover overflow-hidden ${
        onClick ? `cursor-pointer ${accents.hover}` : ''
      }`}
      onClick={onClick}
    >
      {/* Header with title and icon */}
      <div className="flex items-start justify-between mb-3 desktop:mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm desktop:text-xs desktop-lg:text-sm font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wide truncate">{title}</p>
        </div>
        <div className={`${accents.icon} ml-3 flex-shrink-0`}>
          <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 desktop:w-6 desktop:h-6 desktop-lg:w-7 desktop-lg:h-7">
            {icon}
          </div>
        </div>
      </div>

      {/* Value section */}
      <div className="flex-1 flex flex-col justify-center min-h-0">
        <div className="flex items-center space-x-3 mb-1 sm:mb-4">
          <p className="text-2xl sm:text-3xl md:text-4xl desktop:text-3xl desktop-lg:text-4xl font-bold text-gray-900 dark:text-dark-100 truncate flex-shrink-0">{value}</p>
          {title === "Attendance Rate" && (
            <div className="flex-1 max-w-12 sm:max-w-16 desktop:max-w-14 desktop-lg:max-w-16 h-2 bg-gray-200 dark:bg-dark-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${typeof value === 'string' ? parseInt(value) : 0}%` }}
              ></div>
            </div>
          )}
        </div>
      </div>

      {/* Description section */}
      <div className="mt-3 sm:mt-3 desktop:mt-2 desktop-lg:mt-3 min-h-0">
        {description && (
          <p className="text-xs sm:text-sm desktop:text-xs desktop-lg:text-sm text-gray-600 dark:text-dark-300 font-medium break-words overflow-wrap-anywhere leading-snug line-clamp-2">
            {description}
          </p>
        )}
      </div>
    </div>
  );
});


const DashboardView: React.FC = memo(() => {
  const { members, attendanceRecords, newBelievers, displayedSundays, displayedDate, sundayConfirmations, guests, switchTab, user, userProfile, currentChurchId, allOutreachMembers, bacentas, prayerRecords, meetingRecords, isMinistryContext, titheRecords } = useAppContext(); // Use displayedSundays

  const activeMembers = useMemo(() => {
    const filtered = members.filter(m => !m.frozen);
    console.log('🔍 [Dashboard] Member count calculation:', {
      totalMembers: members.length,
      activeMembers: filtered.length,
      frozenMembers: members.filter(m => m.frozen).length,
      isMinistryContext,
      nativeMembers: members.filter(m => m.isNativeMinistryMember).length,
      memberSample: members.slice(0, 3).map(m => ({
        name: `${m.firstName} ${m.lastName}`,
        frozen: m.frozen,
        isNative: m.isNativeMinistryMember,
        ministry: m.ministry
      }))
    });
    return filtered.length;
  }, [members, isMinistryContext]);
  
  // Filter out orphaned outreach members whose bacentaId doesn't exist anymore
  const validOutreachMembers = useMemo(() => {
    const validBacentaIds = new Set(bacentas.map(b => b.id));
    return allOutreachMembers.filter(m => validBacentaIds.has(m.bacentaId));
  }, [allOutreachMembers, bacentas]);
  
  const totalOutreachMembers = validOutreachMembers.length;
  const [confirmationTarget, setConfirmationTarget] = useState<number>(0);
  const [isLoadingTarget, setIsLoadingTarget] = useState<boolean>(true);

  // Check if current user is admin
  // const isAdmin = hasAdminPrivileges(userProfile);

  // Load target from Firebase for upcoming Sunday
  useEffect(() => {
    const loadTarget = async () => {
      if (!user) {
        setIsLoadingTarget(false);
        return;
      }

      setIsLoadingTarget(true);
      try {
        const upcomingSunday = getUpcomingSunday();

        // Get the current church ID (same for admin and leaders in the same church)
        const churchId = firebaseUtils.getCurrentChurchId();
        if (!churchId) {
          console.warn('No church context available yet for dashboard, will retry when available');
          setIsLoadingTarget(false);
          return;
        }

        // Validate inputs before making Firestore request
        if (!upcomingSunday || upcomingSunday.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(upcomingSunday)) {
          console.error('Invalid upcomingSunday format:', upcomingSunday);
          setIsLoadingTarget(false);
          return;
        }

        // Use proper church-scoped path
        const targetDocRef = doc(db, `churches/${churchId}/sundayTargets`, upcomingSunday);
        const targetDoc = await getDoc(targetDocRef);

        if (targetDoc.exists() && targetDoc.data().target) {
          const target = targetDoc.data().target;
          setConfirmationTarget(target);
        } else {
          // Default to total member count if no target is set
          // Only use activeMembers if we actually have members loaded
          const defaultTarget = activeMembers > 0 ? activeMembers : 0;
          setConfirmationTarget(defaultTarget);
        }
      } catch (error: any) {
          console.error('Error loading confirmation target for dashboard:', {
          error: error.message,
          code: error.code,
          stack: error.stack,
          churchId: firebaseUtils.getCurrentChurchId()
        });

        // Check if it's an offline error
  // const isOffline = error?.code === 'unavailable' || error?.message?.includes('offline') || error?.message?.includes('network') || error?.message?.includes('backend');

  // Fallback to member count, but only if we have members loaded
  const defaultTarget = activeMembers > 0 ? activeMembers : 0;
        setConfirmationTarget(defaultTarget);
      } finally {
        setIsLoadingTarget(false);
      }
    };

    // Only load target if we have user
    if (user) {
      loadTarget();
    }
  }, [user, activeMembers, currentChurchId]); // Depend on activeMembers for consistency

  const currentMonthAttendancePercentage = () => {
    if (!displayedSundays.length || !members.length) return 0;

    let totalPossibleAttendances = members.length * displayedSundays.length;
    let actualPresents = 0;

    displayedSundays.forEach(sunday => {
      members.forEach(member => {
        const record = attendanceRecords.find(ar => ar.memberId === member.id && ar.date === sunday);
        if (record && record.status === 'Present') {
          actualPresents++;
        }
      });
    });

    return totalPossibleAttendances > 0 ? Math.round((actualPresents / totalPossibleAttendances) * 100) : 0;
  };

  // Calculate current week's attendance
  const getCurrentWeekAttendance = () => {
    const currentSunday = getCurrentOrMostRecentSunday();

    // Get all attendance records for the current Sunday
    const sundayRecords = attendanceRecords.filter(
      record => record.date === currentSunday && record.status === 'Present'
    );

    // Get present member IDs and new believer IDs
    const presentMemberIds = sundayRecords
      .filter(record => record.memberId)
      .map(record => record.memberId!);

    const presentNewBelieverIds = sundayRecords
      .filter(record => record.newBelieverId)
      .map(record => record.newBelieverId!);

    // Filter to only include members and new believers that actually exist
    // This prevents counting orphaned attendance records for deleted members
    const presentMembers = members.filter(member => presentMemberIds.includes(member.id));
    const presentNewBelievers = newBelievers.filter(nb => presentNewBelieverIds.includes(nb.id));

    const totalPresent = presentMembers.length + presentNewBelievers.length;

    return {
      total: totalPresent,
      date: currentSunday,
      formattedDate: formatFullDate(currentSunday)
    };
  };

  // Calculate upcoming Sunday confirmations
  const getUpcomingSundayConfirmations = () => {
    const upcomingSunday = getUpcomingSunday();

    // Get all confirmation records for the upcoming Sunday
    const confirmationRecords = sundayConfirmations.filter(
      record => record.date === upcomingSunday && record.status === 'Confirmed'
    );

    // Count only confirmations for existing members and guests
    let confirmedCount = 0;

    confirmationRecords.forEach(record => {
      if (record.memberId) {
        // Check if member still exists
        const memberExists = members.some(member => member.id === record.memberId);
        if (memberExists) {
          confirmedCount++;
        }
      } else if (record.guestId) {
        // Check if guest still exists
        const guestExists = guests.some(guest => guest.id === record.guestId);
        if (guestExists) {
          confirmedCount++;
        }
      }
    });

    return {
      total: confirmedCount,
      date: upcomingSunday,
      formattedDate: formatFullDate(upcomingSunday)
    };
  };

  const weeklyAttendance = getCurrentWeekAttendance();
  const upcomingConfirmations = getUpcomingSundayConfirmations();

  // Calculate current week's bacenta meeting attendance and income (Wed + Thu)
  const getCurrentWeekBacentaMeetingAttendance = () => {
    const currentWeekWednesday = getCurrentMeetingWeek();
    const meetingDates = getMeetingWeekRange(currentWeekWednesday);

    let totalAttendance = 0;
    let totalIncome = 0;

    meetingDates.forEach(date => {
      const dayMeetingRecords = meetingRecords.filter(record => record.date === date);
      dayMeetingRecords.forEach(record => {
        // Attendance: presentMemberIds + firstTimers (fallbacks for legacy data)
        const presentCount = Array.isArray(record.presentMemberIds) ? record.presentMemberIds.length : (Array.isArray((record as any).attendees) ? (record as any).attendees.length : 0);
        const firstTimers = typeof record.firstTimers === 'number' ? record.firstTimers : (Array.isArray(record.guests) ? record.guests.length : 0);
        totalAttendance += (presentCount + firstTimers);

        // Income: prefer totalOffering, else cash + online
        const offering = typeof record.totalOffering === 'number' && !isNaN(record.totalOffering)
          ? record.totalOffering
          : ((record.cashOffering || 0) + (record.onlineOffering || 0));
        totalIncome += offering;
      });
    });

    return {
      total: totalAttendance,
      dates: meetingDates,
      formattedWeek: `${formatFullDate(meetingDates[0]).split(',')[0]} - ${formatFullDate(meetingDates[1]).split(',')[0]}`,
      totalIncome
    };
  };

  const bacentaMeetingAttendance = getCurrentWeekBacentaMeetingAttendance();
  const isAdmin = hasAdminPrivileges(userProfile);
  const formatZAR = useCallback((n: number) => {
    try {
      return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 2 }).format(n);
    } catch {
      return `R${(n || 0).toFixed(2)}`;
    }
  }, []);

  // Overall prayer totals (all-time)
  const overallPrayerMarks = useMemo(() => {
    return prayerRecords.reduce((acc, r) => acc + (r.status === 'Prayed' ? 1 : 0), 0);
  }, [prayerRecords]);

  const overallPrayerHours = useMemo(() => {
    // Each 'Prayed' mark corresponds to a 2-hour session currently
    return overallPrayerMarks * 2;
  }, [overallPrayerMarks]);



  const monthName = getMonthName(displayedDate.getMonth());
  const year = displayedDate.getFullYear();

  // Tithe card counts: paid vs total (active members) for the selected month
  const paidTithesCount = useMemo(() => {
    if (!titheRecords?.length || !members?.length) return 0;
    const activeIds = new Set(members.filter(m => !m.frozen).map(m => m.id));
    return titheRecords.reduce((acc, r) => acc + (r.paid && activeIds.has(r.memberId) ? 1 : 0), 0);
  }, [titheRecords, members]);

  // Personal card rearranging (excluding Total Members)
  type CardId = 'confirmations' | 'attendanceRate' | 'weeklyAttendance' | 'outreach' | 'bacentaMeetings' | 'ministries' | 'prayerOverall' | 'tithe';
  const baseDefaultOrder: CardId[] = [
    'confirmations',
    'attendanceRate',
    'weeklyAttendance',
    'outreach',
    'bacentaMeetings',
    'ministries',
    'prayerOverall',
    // Admin-only: automatically add Tithe card to default order for admins
    ...(isAdmin ? (['tithe'] as CardId[]) : [])
  ];
  const defaultOrder: CardId[] = isMinistryContext
    ? (baseDefaultOrder.filter((id) => id !== 'ministries') as CardId[])
    : baseDefaultOrder;
  const [cardOrder, setCardOrder] = useState<CardId[]>(() => defaultOrder);
  const [rearrangeMode, setRearrangeMode] = useState<boolean>(false);
  const dragItemId = useRef<CardId | null>(null);

  // Load/save personal order using user ID to keep it per-user and local only
  useEffect(() => {
    const uid = user?.uid ?? null;
    const loaded = dashboardLayoutStorage.loadOrder(uid, defaultOrder) as CardId[];
    // In ministry mode, ensure 'ministries' card is removed from any previously saved layout
    let sanitized = isMinistryContext ? (loaded.filter((id) => id !== 'ministries') as CardId[]) : loaded;
    // If not admin, ensure 'tithe' is not shown
    if (!isAdmin) {
      sanitized = sanitized.filter((id) => id !== 'tithe') as CardId[];
    } else {
      // If admin and tithe not present, append it to the end
      if (!sanitized.includes('tithe')) {
        sanitized = [...sanitized, 'tithe'] as CardId[];
      }
    }
    setCardOrder(sanitized);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, isMinistryContext, isAdmin]);

  const persistOrder = useCallback((next: CardId[]) => {
    const uid = user?.uid ?? null;
    let sanitized = isMinistryContext ? (next.filter((id) => id !== 'ministries') as CardId[]) : next;
    // Ensure admin-only tithe card is not stored for non-admins
    if (!isAdmin) {
      sanitized = sanitized.filter((id) => id !== 'tithe') as CardId[];
    }
    setCardOrder(sanitized);
    dashboardLayoutStorage.saveOrder(uid, sanitized);
  }, [user?.uid, isMinistryContext, isAdmin]);

  const onDragStart = useCallback((e: React.DragEvent, id: CardId) => {
    dragItemId.current = id;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!rearrangeMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, [rearrangeMode]);

  const onDrop = useCallback((e: React.DragEvent, targetId: CardId) => {
    e.preventDefault();
    if (!rearrangeMode) return;
    const sourceId = dragItemId.current;
    dragItemId.current = null;
    if (!sourceId || sourceId === targetId) return;
    const current = [...cardOrder];
    const fromIndex = current.indexOf(sourceId);
    const toIndex = current.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    current.splice(fromIndex, 1);
    current.splice(toIndex, 0, sourceId);
    persistOrder(current);
  }, [cardOrder, persistOrder, rearrangeMode]);

  const moveCard = useCallback((id: CardId, direction: -1 | 1) => {
    const idx = cardOrder.indexOf(id);
    if (idx === -1) return;
    const newIndex = idx + direction;
    if (newIndex < 0 || newIndex >= cardOrder.length) return;
    const arr = [...cardOrder];
    const [item] = arr.splice(idx, 1);
    arr.splice(newIndex, 0, item);
    persistOrder(arr);
  }, [cardOrder, persistOrder]);

  const renderCardById = (id: CardId) => {
    switch (id) {
      case 'tithe': {
        if (!isAdmin) return null;
        return (
          <StatCard
            key={id}
            title="Tithe"
            value={`${paidTithesCount}/${activeMembers}`}
            icon={<CurrencyDollarIcon className="w-full h-full" />}
            accentColor="emerald"
            description={`For ${monthName}`}
            onClick={() => !rearrangeMode && switchTab({ id: 'all_members', name: 'Tithe', data: { isTithe: true } })}
          />
        );
      }
      case 'confirmations':
        return (
          <EnhancedConfirmationCard
            key={id}
            title="Sunday Confirmations"
            confirmedCount={upcomingConfirmations.total}
            totalMembers={confirmationTarget}
            isLoadingTarget={isLoadingTarget}
            date={upcomingConfirmations.date}
            onClick={() => !rearrangeMode && switchTab({ id: 'sunday_confirmations', name: 'Sunday Confirmations' })}
          />
        );
      case 'attendanceRate':
        return (
          <StatCard
            key={id}
            title="Attendance Rate"
            value={`${currentMonthAttendancePercentage()}%`}
            icon={<AttendanceIcon className="w-full h-full" />}
            accentColor="emerald"
            description={`For ${monthName}`}
            onClick={() => !rearrangeMode && switchTab({ id: 'attendance_analytics', name: 'Attendance Analytics' })}
          />
        );
      case 'weeklyAttendance':
        return (
          <StatCard
            key={id}
            title="Weekly Attendance"
            value={weeklyAttendance.total}
            icon={<CalendarIcon className="w-full h-full" />}
            accentColor="amber"
            description={`For ${formatFullDate(weeklyAttendance.date).split(',')[0]}`}
            onClick={() => !rearrangeMode && switchTab({ id: 'weekly_attendance', name: 'Weekly Attendance' })}
          />
        );
      case 'outreach':
        return (
          <StatCard
            key={id}
            title="Outreach"
            value={totalOutreachMembers}
            icon={<ChartBarIcon className="w-full h-full" />}
            accentColor="rose"
            description="Community outreach programs"
            onClick={() => !rearrangeMode && switchTab({ id: TabKeys.OUTREACH, name: 'Outreach' })}
          />
        );
      case 'bacentaMeetings':
        return (
          <StatCard
            key={id}
            title="Bacenta Meetings"
            value={bacentaMeetingAttendance.total}
            icon={<CalendarIcon className="w-full h-full" />}
            accentColor="blue"
            description={isAdmin ? (
              <>
                <span>{`For ${bacentaMeetingAttendance.formattedWeek}`}</span>
                <br />
                <span>{`Income: ${formatZAR(bacentaMeetingAttendance.totalIncome)}`}</span>
              </>
            ) : (
              <> {`For ${bacentaMeetingAttendance.formattedWeek}`} </>
            )}
            onClick={() => !rearrangeMode && switchTab({ id: TabKeys.BACENTA_MEETINGS, name: 'Bacenta Meetings' })}
          />
        );
      case 'ministries': {
        if (isMinistryContext) return null; // Hide in ministry mode
        const ministriesCount = members.filter(m => !!m.ministry && m.ministry.trim() !== '').length;
        return (
          <StatCard
            key={id}
            title="Ministries"
            value={ministriesCount}
            icon={<PeopleIcon className="w-full h-full" />}
            accentColor="indigo"
            description={ministriesCount === 1 ? '1 member in a ministry' : `${ministriesCount} members in ministries`}
            onClick={() => !rearrangeMode && switchTab({ id: TabKeys.MINISTRIES, name: 'Ministries' })}
          />
        );
      }
  case 'prayerOverall':
        return (
          <StatCard
            key={id}
            title="Prayer (Overall)"
            value={`${overallPrayerHours} h`}
    icon={<PrayerIcon className="w-full h-full" />}
            accentColor="indigo"
            description={`All-time prayers marked • ${overallPrayerMarks}`}
            onClick={() => !rearrangeMode && switchTab({ id: TabKeys.PRAYER, name: 'Prayer' })}
          />
        );
      default:
        return null;
    }
  };

  const DraggableWrap: React.FC<{ id: CardId; children: React.ReactNode }> = ({ id, children }) => (
    <div
      draggable={rearrangeMode}
      onDragStart={(e) => onDragStart(e, id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, id)}
      className={rearrangeMode ? 'relative ring-1 ring-dashed ring-slate-300 dark:ring-dark-600 rounded-lg' : undefined}
      aria-grabbed={rearrangeMode ? undefined : false}
    >
      {rearrangeMode && (
        <div className="absolute top-2 right-2 flex items-center gap-2">
          <button
            type="button"
            className="text-[10px] sm:text-xs bg-white dark:bg-dark-800 text-slate-700 dark:text-dark-200 border border-slate-300 dark:border-dark-600 rounded px-2 py-0.5 shadow-sm"
            onClick={() => moveCard(id, -1)}
            title="Move left"
          >
            ←
          </button>
          <button
            type="button"
            className="text-[10px] sm:text-xs bg-white dark:bg-dark-800 text-slate-700 dark:text-dark-200 border border-slate-300 dark:border-dark-600 rounded px-2 py-0.5 shadow-sm"
            onClick={() => moveCard(id, 1)}
            title="Move right"
          >
            →
          </button>
          <span className="text-[10px] sm:text-xs bg-slate-100 dark:bg-dark-700 text-slate-600 dark:text-dark-200 px-2 py-0.5 rounded-md select-none">
            Drag
          </span>
        </div>
      )}
      {children}
    </div>
  );

  return (
    <div className="dashboard-container space-y-4 sm:space-y-5 md:space-y-6 desktop:space-y-4 desktop-lg:space-y-6">
      {/* Clean, Professional Header with subtle accent */}
      <div className="text-center mb-3 sm:mb-4 md:mb-5 desktop:mb-4 desktop-lg:mb-6">
        <h2 className="text-2xl sm:text-3xl md:text-4xl desktop:text-3xl desktop-lg:text-4xl font-bold text-gray-900 dark:text-dark-100 mb-2">
          Dashboard
        </h2>
        <div className="flex items-center justify-center space-x-3 text-gray-600 dark:text-dark-300">
          <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full"></div>
          <p className="text-sm sm:text-base md:text-lg desktop:text-base desktop-lg:text-lg font-medium">{monthName} {year}</p>
          <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full"></div>
        </div>
        <div className="w-12 sm:w-16 md:w-20 desktop:w-16 desktop-lg:w-20 h-0.5 bg-gradient-to-r from-slate-300 via-slate-400 to-slate-300 dark:from-slate-600 dark:via-slate-500 dark:to-slate-600 rounded-full mx-auto mt-2 sm:mt-3 desktop:mt-2 desktop-lg:mt-3"></div>

        {/* Rearrange toggle */}
        <div className="mt-3 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setRearrangeMode((v) => !v)}
            className={`text-xs sm:text-sm px-3 py-1.5 rounded-md border transition-colors ${rearrangeMode ? 'bg-slate-800 text-white border-slate-700' : 'bg-white dark:bg-dark-800 text-slate-700 dark:text-dark-200 border-slate-300 dark:border-dark-600'}`}
            title="Rearrange dashboard cards (personal)"
          >
            {rearrangeMode ? 'Done rearranging' : 'Rearrange cards'}
          </button>
        </div>
      </div>

  {/* No modal for Tithe; clicking card routes to All Members tab */}

      {/* Stats Grid - Enhanced responsive layout with improved desktop scaling */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 desktop:grid-cols-auto-fit-280 desktop-lg:grid-cols-auto-fit-300 desktop-xl:grid-cols-auto-fit-320 ultra-wide:grid-cols-auto-fit-350 gap-4 sm:gap-5 md:gap-6 desktop:gap-5 desktop-lg:gap-6 ultra-wide:gap-8">
        {/* Fixed first card (not draggable) */}
        <StatCard
          title="Total Members"
          value={activeMembers}
          icon={<PeopleIcon className="w-full h-full" />}
          accentColor="blue"
          onClick={() => switchTab({ id: 'all_members', name: 'All Members' })}
        />

        {/* Draggable personal cards */}
        {cardOrder.map((id) => (
          <DraggableWrap key={id} id={id}>
            {renderCardById(id)}
          </DraggableWrap>
        ))}
      </div>


    </div>
  );
});

DashboardView.displayName = 'DashboardView';

// Clean Confirmation Card Component
interface EnhancedConfirmationCardProps {
  title: string;
  confirmedCount: number;
  totalMembers: number; // This now represents the target, keeping same name for compatibility
  isLoadingTarget?: boolean;
  date: string;
  onClick: () => void;
}

const EnhancedConfirmationCard: React.FC<EnhancedConfirmationCardProps> = memo(({
  title,
  confirmedCount,
  totalMembers, // This now represents the target
  isLoadingTarget = false,
  date,
  onClick
}) => {
  const percentage = !isLoadingTarget && totalMembers > 0 ? Math.round((confirmedCount / totalMembers) * 100) : 0;
  const radius = 28; // Larger radius for better visibility
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Dynamic color based on percentage
  const getProgressColor = (percent: number) => {
    if (percent >= 90) return 'text-emerald-500 dark:text-emerald-400'; // Excellent - Green
    if (percent >= 75) return 'text-blue-500 dark:text-blue-400';       // Good - Blue
    if (percent >= 50) return 'text-amber-500 dark:text-amber-400';     // Fair - Amber
    if (percent >= 25) return 'text-orange-500 dark:text-orange-400';   // Low - Orange
    return 'text-red-500 dark:text-red-400';                            // Very Low - Red
  };

  const getBorderColor = (percent: number) => {
    if (percent >= 90) return 'border-l-emerald-400 dark:border-l-emerald-500 hover:border-emerald-300 dark:hover:border-emerald-600';
    if (percent >= 75) return 'border-l-blue-400 dark:border-l-blue-500 hover:border-blue-300 dark:hover:border-blue-600';
    if (percent >= 50) return 'border-l-amber-400 dark:border-l-amber-500 hover:border-amber-300 dark:hover:border-amber-600';
    if (percent >= 25) return 'border-l-orange-400 dark:border-l-orange-500 hover:border-orange-300 dark:hover:border-orange-600';
    return 'border-l-red-400 dark:border-l-red-500 hover:border-red-300 dark:hover:border-red-600';
  };

  const progressColor = getProgressColor(percentage);
  const borderColor = getBorderColor(percentage);

  return (
    <div
  className={`p-4 sm:p-5 md:p-6 desktop:p-5 desktop-lg:p-6 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 border-l-4 ${borderColor} rounded-lg desktop:rounded-xl shadow-sm hover:shadow-md desktop:hover:shadow-lg relative h-[120px] sm:h-[140px] desktop:h-[160px] desktop-lg:h-[180px] flex flex-col justify-between cursor-pointer transition-all duration-200 desktop-card-hover overflow-hidden`}
      onClick={onClick}
    >
      {/* Header with title */}
      <div className="flex items-start justify-between mb-3 desktop:mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm desktop:text-xs desktop-lg:text-sm font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wide truncate">{title}</p>
        </div>
      </div>

      {/* Main content with large progress circle */}
      <div className="flex-1 flex items-center justify-between min-h-0">
        {/* Value section */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline space-x-2 mb-1">
            <span className="text-2xl sm:text-3xl md:text-4xl desktop:text-3xl desktop-lg:text-4xl font-bold text-gray-900 dark:text-dark-100 flex-shrink-0">
              {confirmedCount}
            </span>
            <span className="text-sm desktop:text-xs desktop-lg:text-sm text-gray-600 dark:text-dark-300 font-medium truncate">
              of {isLoadingTarget ? '...' : totalMembers}
            </span>
          </div>
          <p className="text-xs sm:text-sm desktop:text-xs desktop-lg:text-sm text-gray-600 dark:text-dark-300 font-medium truncate">
            For {formatFullDate(date).split(',')[0]}
          </p>
        </div>

        {/* Large Progress Ring */}
        <div className="ml-4 flex-shrink-0 relative">
          <div className="relative w-16 h-16 sm:w-18 sm:h-18 group">
            {/* Subtle glow background */}
            <div className={`absolute inset-0 rounded-full opacity-20 ${progressColor.replace('text-', 'bg-')} blur-sm group-hover:opacity-30 transition-opacity duration-300`}></div>

            <svg className="w-full h-full transform -rotate-90 relative z-10" viewBox="0 0 72 72">
              {/* Background circle */}
              <circle
                cx="36"
                cy="36"
                r={radius}
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-gray-200 dark:text-dark-600"
              />
              {/* Progress circle with dynamic color and smooth animation */}
              <circle
                cx="36"
                cy="36"
                r={radius}
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={isLoadingTarget ? circumference : strokeDashoffset}
                className={`${progressColor} transition-all duration-1000 ease-out`}
                strokeLinecap="round"
                style={{
                  filter: 'drop-shadow(0 0 3px currentColor)',
                  transformOrigin: 'center'
                }}
              />
            </svg>

            {/* Center percentage with dynamic color and subtle pulse */}
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <span className={`text-sm sm:text-base font-bold ${progressColor} transition-all duration-500 ${percentage >= 90 ? 'animate-pulse' : ''}`}>
                {isLoadingTarget ? '...' : `${percentage}%`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

EnhancedConfirmationCard.displayName = 'EnhancedConfirmationCard';

export default DashboardView;

// (Intentionally no additional components here)
