import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { Member, PrayerRecord } from '../../types';
import { getTuesdayToSundayRange, getPreviousPrayerWeekAnchor, getNextPrayerWeekAnchor, formatFullDate } from '../../utils/dateUtils';
import { getPrayerSessionInfo } from '../../utils/prayerUtils';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon, XMarkIcon } from '../icons';

const PrayerMemberDetailsView: React.FC = () => {
  const { currentTab, members, prayerRecords } = useAppContext();
  const memberId: string = currentTab?.data?.memberId;
  const member: Member | undefined = members.find(m => m.id === memberId);

  const [anchorDate, setAnchorDate] = useState<string>(getTuesdayToSundayRange()[0]);
  const weekDates = useMemo(() => getTuesdayToSundayRange(anchorDate), [anchorDate]);

  const memberRecords = useMemo(() => prayerRecords.filter(r => r.memberId === memberId), [prayerRecords, memberId]);
  const recordsByDate = useMemo(() => {
    const map = new Map<string, PrayerRecord>();
    for (const r of memberRecords) map.set(r.date, r);
    return map;
  }, [memberRecords]);

  const lifetimeHours = useMemo(() => {
    return memberRecords.reduce((acc, r) => acc + (r.status === 'Prayed' ? getPrayerSessionInfo(r.date).hours : 0), 0);
  }, [memberRecords]);

  // View-only: No toggling or editing here

  if (!member) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center text-gray-600">
        Member not found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">{member.firstName} {member.lastName || ''}</h2>
          </div>
          <div className="text-sm text-gray-600 mb-3">
            Lifetime Prayer Hours: <span className="font-semibold text-gray-800">{lifetimeHours}</span>
          </div>

          {/* Week navigation */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setAnchorDate(getPreviousPrayerWeekAnchor(anchorDate))}
              className="flex items-center justify-center w-10 h-10 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors duration-200 shadow-sm"
              aria-label="Previous week"
              title="Previous week"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <div className="text-sm text-gray-700 font-medium">
              {formatFullDate(weekDates[0])} - {formatFullDate(weekDates[weekDates.length - 1])}
            </div>
            <button
              onClick={() => setAnchorDate(getNextPrayerWeekAnchor(anchorDate))}
              className="flex items-center justify-center w-10 h-10 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors duration-200 shadow-sm"
              aria-label="Next week"
              title="Next week"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Weekly grid */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              {weekDates.map(d => {
                const info = getPrayerSessionInfo(d);
                const dt = new Date(d + 'T00:00:00');
                const wd = dt.toLocaleDateString(undefined, { weekday: 'long' });
                return (
                  <th key={d} className="px-3 py-2 text-center whitespace-nowrap" title={`${formatFullDate(d)} • ${info.start}–${info.end}`}>
                    <div className="flex flex-col items-center leading-tight">
                      <span className="font-medium">{wd}</span>
                      <span className="text-xs text-gray-500">{info.start}–{info.end}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              {weekDates.map(d => {
                const rec = recordsByDate.get(d);
                const status = rec?.status;
                const base = 'w-8 h-8 rounded border-2 flex items-center justify-center mx-auto';
                const classes = status === 'Prayed'
                  ? 'bg-green-500 border-green-500 text-white cursor-default'
                  : status === 'Missed'
                    ? 'bg-red-500 border-red-500 text-white cursor-default'
                    : 'bg-gray-100 border-gray-300 text-gray-400 cursor-default';
                return (
                  <td key={d} className="px-3 py-3 text-center">
                    <div className={`${base} ${classes}`} title={`${formatFullDate(d)} • ${status || 'Unmarked'}`}>
                      {status === 'Prayed' && <CheckIcon className="w-4 h-4" />}
                      {status === 'Missed' && <XMarkIcon className="w-4 h-4" />}
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
        {/* Weekly progress bar */}
        {(() => {
          const prayedCount = weekDates.reduce((acc, d) => acc + (recordsByDate.get(d)?.status === 'Prayed' ? 1 : 0), 0);
          const pct = Math.round((prayedCount / weekDates.length) * 100);
          return (
            <div className="px-3 pb-3">
              <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500" style={{ width: `${pct}%` }} aria-hidden="true"></div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Lifetime summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="text-sm text-gray-700">
          <div className="font-medium mb-2">Summary</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="text-gray-500">Total Days Marked</div>
              <div className="text-gray-900 font-semibold">{memberRecords.length}</div>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="text-gray-500">Prayed Days</div>
              <div className="text-gray-900 font-semibold">{memberRecords.filter(r => r.status === 'Prayed').length}</div>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="text-gray-500">Missed Days</div>
              <div className="text-gray-900 font-semibold">{memberRecords.filter(r => r.status === 'Missed').length}</div>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="text-gray-500">Total Hours</div>
              <div className="text-gray-900 font-semibold">{lifetimeHours}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrayerMemberDetailsView;
