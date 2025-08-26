import React, { useState, useMemo } from 'react';
import { getLatestMeetingDay, formatDateToYYYYMMDD, getWednesdayOfWeek, getMeetingWeekDates } from '../../utils/dateUtils';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, BuildingOfficeIcon, CheckCircleIcon, ClipboardIcon } from '../icons';
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

  const dateObj = new Date(currentDate + 'T00:00:00');
  const dayName = dateObj.getDay() === 3 ? 'Wednesday' : 'Thursday';
  // Friendly full date without weekday to avoid duplication like "Thursday · Thursday, Aug ..."
  const fullDateNoWeekday = dateObj.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="w-full max-w-md mx-auto flex items-center justify-between gap-2 bg-white rounded-full px-3 py-2 border border-gray-200 shadow-sm relative z-20 pointer-events-auto text-gray-800">
      <button
        type="button"
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 pointer-events-auto relative z-30"
        onClick={handlePrevious}
        aria-label="Previous meeting date"
      >
        <ChevronLeftIcon className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-2 px-1 sm:px-2 mx-auto text-center">
        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
          <CalendarIcon className="w-3.5 h-3.5 text-gray-700" />
        </div>
        <span className="font-semibold tracking-wide text-gray-800 text-sm sm:text-base whitespace-normal">
          {dayName} · {fullDateNoWeekday}
        </span>
      </div>
      <button
        type="button"
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 pointer-events-auto relative z-30"
        onClick={handleNext}
        aria-label="Next meeting date"
      >
        <ChevronRightIcon className="w-5 h-5" />
      </button>
    </div>
  );
};

const BacentaMeetingsView: React.FC = () => {
  const { bacentas, members, meetingRecords, currentTab, showToast, userProfile } = useAppContext();
  const isAdmin = (userProfile?.role === 'admin');

  // Initialize with the latest meeting day (Wed/Thu). If it's Fri–Tue, we want last Thursday.
  const [currentDate, setCurrentDate] = useState<string>(() => {
    return getLatestMeetingDay();
  });

  // State for meeting details view
  const [selectedBacentaId, setSelectedBacentaId] = useState<string | null>(null);
  const [selectedMeetingRecord, setSelectedMeetingRecord] = useState<any>(null);

  // Ensure browser back returns from detail to this list instead of jumping tabs
  React.useEffect(() => {
    const handlePop = (e: PopStateEvent) => {
      const state = (e.state as any) || {};
      // Only handle our view states; leave others to global nav
      if (state.view === 'bacenta-meeting-detail' || state.view === 'bacenta-meeting-list') {
        if (state.view === 'bacenta-meeting-list') {
          setSelectedBacentaId(null);
          setSelectedMeetingRecord(null);
        }
        // do not preventDefault/pop propagation here; just sync local UI
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

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

  // Aggregate "so far" totals for this meeting week.
  // On Wednesday: include only Wednesday records. On Thursday: include Wednesday + Thursday records.
  const weekSoFar = useMemo(() => {
    const weekWed = getWednesdayOfWeek(currentDate);
    const { wednesday, thursday } = getMeetingWeekDates(weekWed);
    const includeDates = currentDayName === 'Wednesday' ? [wednesday] : [wednesday, thursday];

    let held = 0;
    let attendance = 0;
    let cash = 0;
    let online = 0;
    let offering = 0;
    let firstTimers = 0;
    let converts = 0;

    // Only count one record per bacenta per date (records are unique by id anyway)
    for (const rec of meetingRecords) {
      if (!includeDates.includes(rec.date)) continue;
      held += 1;
      const ft = (rec.firstTimers ?? (Array.isArray(rec.guests) ? rec.guests.length : 0)) as number;
      const present = Array.isArray(rec.presentMemberIds) ? rec.presentMemberIds.length : 0;
      attendance += present + ft;
      const c = typeof rec.cashOffering === 'number' ? rec.cashOffering : 0;
      const o = typeof rec.onlineOffering === 'number' ? rec.onlineOffering : 0;
      cash += c; online += o;
      const tot = typeof rec.totalOffering === 'number' ? rec.totalOffering : (c + o);
      offering += tot;
      firstTimers += ft;
      converts += (typeof rec.converts === 'number' ? rec.converts : 0);
    }

    return { held, attendance, offering, firstTimers, converts, cash, online, wednesday, thursday };
  }, [meetingRecords, currentDate, currentDayName]);

  // Get member count for each bacenta
  const getMemberCount = (bacentaId: string) => {
    return members.filter(m => m.bacentaId === bacentaId && !m.frozen).length;
  };

  // Check if meeting record exists for bacenta and date
  const getMeetingRecord = (bacentaId: string, date: string) => {
    const meetingId = `${bacentaId}_${date}`;
    return meetingRecords.find(record => record.id === meetingId);
  };

  // Build a cross-Wed/Thu copyable summary
  const copyWeekSummary = async () => {
    try {
      // Determine the Wednesday/Thursday dates for the week of the currently selected date
      const weekWed = getWednesdayOfWeek(currentDate);
      const { wednesday, thursday } = getMeetingWeekDates(weekWed);

      // Helper to find leader for a bacenta
      const getLeaderName = (bacentaId: string, fallback?: string) => {
        const bacentaMembers = members.filter(m => m.bacentaId === bacentaId && !m.frozen);
        const leader = bacentaMembers.find(m => m.role === 'Bacenta Leader') || bacentaMembers.find(m => m.role === 'Fellowship Leader');
        if (leader) return `${leader.firstName} ${leader.lastName || ''}`.trim();
        return fallback || 'Unknown';
      };

      // Partition bacentas by scheduled day and sort by name for stable output
      const wedBacentas = bacentas
        .filter(b => b.meetingDay === 'Wednesday')
        .sort((a, b) => a.name.localeCompare(b.name));
      const thuBacentas = bacentas
        .filter(b => b.meetingDay === 'Thursday')
        .sort((a, b) => a.name.localeCompare(b.name));

      let lines: string[] = [];
      let idx = 1;
      let totalMeetingsRecorded = 0;
      const totalPossibleMeetings = wedBacentas.length + thuBacentas.length;
  let overallOffering = 0;
  let overallCash = 0;
  let overallOnline = 0;
      let overallFirstTimers = 0;
      let overallNewBelievers = 0;

  const WHITE_FLOWER = '💮';
      const fmt = (ds: string) => new Date(ds + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      const title = `Bacenta Meetings Summary  •  ${fmt(wednesday)} & ${fmt(thursday)}`;

      const divider = (label?: string) => {
        const bar = '════════════════════════════════';
        return label ? `${bar}\n${label}\n${bar}` : bar;
      };

      const addDaySection = (label: string) => {
        lines.push(divider(label));
      };

      const appendBacentaLine = (bacenta: any, date: string) => {
        const record = getMeetingRecord(bacenta.id, date);
        const leaderName = getLeaderName(bacenta.id, record?.bacentaLeaderName);
        if (!record) {
          lines.push(`${idx}) ${leaderName} (${bacenta.name}) — X (no record)`);
          lines.push('');
          idx++;
          return;
        }
        // compute metrics with safe fallbacks
  const firstTimers = (record.firstTimers ?? record.guests?.length ?? 0) as number;
  const attendance = (record.presentMemberIds?.length || 0) + firstTimers;
  const cash = (typeof record.cashOffering === 'number' ? record.cashOffering : 0);
  const online = (typeof record.onlineOffering === 'number' ? record.onlineOffering : 0);
  const offering = (record.totalOffering ?? (cash + online)) as number;
        const converts = (record.converts || 0) as number;

  overallOffering += offering;
  overallCash += cash;
  overallOnline += online;
        overallFirstTimers += firstTimers;
        overallNewBelievers += converts;
        totalMeetingsRecorded += 1;

  lines.push(`${idx}) ${WHITE_FLOWER} ${leaderName} (${bacenta.name})`);
  lines.push(`   • Attendance: ${attendance}`);
  lines.push(`   • Offering: R${offering.toFixed(2)}`);
  lines.push(`   • First Timers: ${firstTimers}`);
  lines.push(`   • New Believers: ${converts}`);
  lines.push('');
        idx++;
      };

      // Wednesday section
  // Header
  lines.push(title);
  lines.push('');

  addDaySection('Wednesday');
      if (wedBacentas.length === 0) {
        lines.push('— No bacentas scheduled');
      } else {
        wedBacentas.forEach(b => appendBacentaLine(b, wednesday));
      }

      // Spacer
  lines.push('');

  // Thursday section
  addDaySection('Thursday');
      if (thuBacentas.length === 0) {
        lines.push('— No bacentas scheduled');
      } else {
        thuBacentas.forEach(b => appendBacentaLine(b, thursday));
      }

      // Spacer
      lines.push('');

      // Leaders that have a bacenta section with X marking if their scheduled day record missing
      const leadersList: string[] = [];
      const allWeekBacentas = [...wedBacentas, ...thuBacentas];
      allWeekBacentas
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((b, i) => {
          const scheduledDate = b.meetingDay === 'Wednesday' ? wednesday : thursday;
          const rec = getMeetingRecord(b.id, scheduledDate);
          const leaderName = getLeaderName(b.id);
          leadersList.push(`${i + 1}. ${rec ? WHITE_FLOWER + ' ' : ''}${leaderName} (${b.name})${rec ? '' : ' — X'}`);
        });
      if (leadersList.length > 0) {
        lines.push(divider('Leaders that have a bacenta'));
        lines.push(...leadersList);
        lines.push('');
      }

      // Totals
  lines.push(divider('Totals'));
  lines.push(`Meetings recorded: ${totalMeetingsRecorded}/${totalPossibleMeetings}`);
  lines.push(`• Online: R${overallOnline.toFixed(2)}`);
  lines.push(`• Cash: R${overallCash.toFixed(2)}`);
  lines.push(`• Offering (Overall): R${overallOffering.toFixed(2)}`);
  lines.push(`• First Timers: ${overallFirstTimers}`);
  lines.push(`• New Believers: ${overallNewBelievers}`);

      const text = lines.join('\n');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showToast('success', 'Copied', 'Wed & Thu bacenta summary copied to clipboard');
    } catch (err) {
      console.error('Copy summary failed', err);
      showToast('error', 'Copy failed', (err as any)?.message || 'Failed to copy summary');
    }
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
          // Manage locally to avoid global nav jumping tabs
          try {
            window.history.pushState(
              { tab: currentTab, view: 'bacenta-meeting-list', date: currentDate },
              '',
              window.location.href
            );
          } catch {}
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

            {/* Copy Summary Button */}
            <div className="flex items-center justify-center mt-2">
              <button
                type="button"
                onClick={copyWeekSummary}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-200 bg-white text-blue-700 hover:bg-blue-50 shadow-sm"
                aria-label="Copy Wed/Thu summary"
              >
                <ClipboardIcon className="w-4 h-4" />
                <span>Copy Wed & Thu summary</span>
              </button>
            </div>

            {/* Weekly summary (so far). Visible for Wed/Thu regardless of scheduled bacentas list. */}
            <div className="mt-6">
              <div className="text-center text-sm text-gray-600 mb-3">
                {currentDayName === 'Wednesday' ? (
                  <span>Totals for Wednesday (so far)</span>
                ) : (
                  <span>Totals for Wed & Thu (so far)</span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 max-w-5xl mx-auto">
                <div className="rounded-xl border border-blue-200 bg-white shadow-sm px-4 py-4 text-center">
                  <div className="text-xs text-blue-700 uppercase tracking-wider">Bacentas held</div>
                  <div className="text-2xl font-extrabold text-blue-900 mt-1">{weekSoFar.held}</div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-white shadow-sm px-4 py-4 text-center">
                  <div className="text-xs text-emerald-700 uppercase tracking-wider">Attendance</div>
                  <div className="text-2xl font-extrabold text-emerald-900 mt-1">{weekSoFar.attendance}</div>
                </div>

                {isAdmin && (
                  <div className="rounded-xl border border-amber-200 bg-white shadow-sm px-4 py-4 text-center">
                    <div className="text-xs text-amber-700 uppercase tracking-wider">Offering so far</div>
                    <div className="text-xl sm:text-2xl font-extrabold text-amber-900 mt-1">R{weekSoFar.offering.toFixed(2)}</div>
                    <div className="text-[10px] text-amber-700/80 mt-0.5">Online R{weekSoFar.online.toFixed(2)} · Cash R{weekSoFar.cash.toFixed(2)}</div>
                  </div>
                )}

                <div className="rounded-xl border border-indigo-200 bg-white shadow-sm px-4 py-4 text-center">
                  <div className="text-xs text-indigo-700 uppercase tracking-wider">First timers</div>
                  <div className="text-2xl font-extrabold text-indigo-900 mt-1">{weekSoFar.firstTimers}</div>
                </div>

                <div className="rounded-xl border border-fuchsia-200 bg-white shadow-sm px-4 py-4 text-center">
                  <div className="text-xs text-fuchsia-700 uppercase tracking-wider">New believers</div>
                  <div className="text-2xl font-extrabold text-fuchsia-900 mt-1">{weekSoFar.converts}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bacentas Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bacentasForCurrentDay.map((bacenta) => {
              const memberCount = getMemberCount(bacenta.id);
              const existingMeetingRecord: any = getMeetingRecord(bacenta.id, currentDate);
              const hasExistingRecord = !!existingMeetingRecord;
              const totals = hasExistingRecord ? {
                attendance: (existingMeetingRecord.presentMemberIds?.length || 0) + (existingMeetingRecord.firstTimers || 0),
                offering: (existingMeetingRecord.totalOffering ?? ((existingMeetingRecord.cashOffering || 0) + (existingMeetingRecord.onlineOffering || 0))),
                converts: existingMeetingRecord.converts || 0,
                firstTimers: existingMeetingRecord.firstTimers || 0,
                testimonies: existingMeetingRecord.testimonies || 0,
              } : null;

              return (
                <button
                  key={bacenta.id}
                  onClick={() => {
                    try {
                      const state = (window.history.state as any) || {};
                      const detailState = { tab: currentTab, view: 'bacenta-meeting-detail', bacentaId: bacenta.id, date: currentDate };
                      // If we're already in the meetings view, replace the state to avoid growing the stack
                      if (state.view === 'bacenta-meeting-detail' || state.view === 'bacenta-meeting-list') {
                        window.history.replaceState(detailState, '', window.location.href);
                      } else {
                        window.history.pushState(detailState, '', window.location.href);
                      }
                    } catch {}
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
                            {hasExistingRecord
                              ? <>Total: <span className="font-semibold">{String(totals!.attendance).padStart(2, '0')}</span> · Offering: <span className="font-semibold">R{(totals!.offering || 0).toFixed(2)}</span></>
                              : <>{memberCount} member{memberCount !== 1 ? 's' : ''}</>}
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
