import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { getTuesdayToSundayRange, getPreviousPrayerWeekAnchor, getNextPrayerWeekAnchor, formatFullDate } from '../../utils/dateUtils';
import { isDateEditable } from '../../utils/attendanceUtils';
import { CheckIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from '../icons';
import { Member, PrayerStatus } from '../../types';

const PrayerView: React.FC = () => {
  const { members, bacentas, prayerRecords, markPrayerHandler, clearPrayerHandler, userProfile } = useAppContext();
  const [anchorDate, setAnchorDate] = useState<string>(getTuesdayToSundayRange()[0]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [bacentaFilter, setBacentaFilter] = useState<string>(''); // empty => all
  const [roleFilter, setRoleFilter] = useState<'all' | 'Bacenta Leader' | 'Fellowship Leader' | 'Member'>('all');

  const allowEditPreviousSundays = userProfile?.preferences?.allowEditPreviousSundays ?? false;

  const weekDates = useMemo(() => getTuesdayToSundayRange(anchorDate), [anchorDate]);

  const weekday = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString(undefined, { weekday: 'long' });
  };

  const recordsByKey = useMemo(() => {
    const map = new Map<string, PrayerStatus>();
    for (const r of prayerRecords) {
      map.set(`${r.memberId}_${r.date}`, r.status);
    }
    return map;
  }, [prayerRecords]);

  // Helpers matching Members table behavior
  const getRolePriority = (role?: string) => {
    switch (role) {
      case 'Bacenta Leader': return 1;
      case 'Fellowship Leader': return 2;
      case 'Member': return 3;
      default: return 4;
    }
  };

  // Filtered and sorted members
  const filteredMembers = useMemo<Member[]>(() => {
    const searchLower = searchTerm.trim().toLowerCase();
    return members
      .filter(m => {
        // Bacenta filter
        if (bacentaFilter && m.bacentaId !== bacentaFilter) return false;
  // Role filter
  if (roleFilter !== 'all' && (m.role || 'Member') !== roleFilter) return false;
        // Search filter (name, phone, address)
        if (searchLower) {
          return (
            m.firstName.toLowerCase().includes(searchLower) ||
            (m.lastName || '').toLowerCase().includes(searchLower) ||
            (m.phoneNumber || '').includes(searchTerm) ||
            (m.buildingAddress || '').toLowerCase().includes(searchLower)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const pa = getRolePriority(a.role);
        const pb = getRolePriority(b.role);
        if (pa !== pb) return pa - pb;
        const last = (a.lastName || '').localeCompare(b.lastName || '');
        if (last !== 0) return last;
        return a.firstName.localeCompare(b.firstName);
      });
  }, [members, bacentaFilter, searchTerm]);

  const onToggle = async (memberId: string, date: string) => {
    const key = `${memberId}_${date}`;
    const current = recordsByKey.get(key);
    if (!current) {
      await markPrayerHandler(memberId, date, 'Prayed');
    } else if (current === 'Prayed') {
      await markPrayerHandler(memberId, date, 'Missed');
    } else {
      await clearPrayerHandler(memberId, date);
    }
  };

  return (
    <div className="space-y-4">
      {/* Centered, clean header card */}
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-600 p-4">
        <div className="text-center">
          {/* Title */}
          <div className="flex items-center justify-center space-x-2 mb-3">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Prayer (Tue–Sun)</h2>
          </div>

          {/* Week navigation */}
          <div className="flex items-center justify-center space-x-4 mb-3">
            <button
              onClick={() => setAnchorDate(getPreviousPrayerWeekAnchor(anchorDate))}
              className="flex items-center justify-center w-10 h-10 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors duration-200 shadow-sm"
              aria-label="Previous week"
              title="Previous week"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <div className="text-sm text-gray-700 dark:text-dark-300 font-medium">
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

          {/* Summary */}
          <div className="text-sm text-gray-600 mb-4">
            {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}
          </div>

          {/* Search, Bacenta Filter, Role Filter */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-center">
            <div className="sm:w-64 w-full">
              <input
                type="text"
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-3 sm:py-2 border border-gray-300 dark:border-dark-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 placeholder-gray-500 dark:placeholder-dark-400 text-center"
              />
            </div>
            <div className="sm:w-64 w-full">
              <select
                value={bacentaFilter}
                onChange={(e) => setBacentaFilter(e.target.value)}
                className="w-full px-3 py-3 sm:py-2 border border-gray-300 dark:border-dark-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 text-center cursor-pointer"
              >
                <option value="">All Bacentas</option>
                {bacentas.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:w-56 w-full">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="w-full px-3 py-3 sm:py-2 border border-gray-300 dark:border-dark-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 text-center cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="Bacenta Leader">💚 Bacenta Leaders</option>
                <option value="Fellowship Leader">❤️ Fellowship Leaders</option>
                <option value="Member">👤 Members</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              {/* Row number column */}
              <th
                className="px-3 py-2 text-center sticky z-20"
                style={{ left: 0, width: '50px', minWidth: '50px', background: 'linear-gradient(to right, rgb(249 250 251), rgb(243 244 246))' }}
              >
                #
              </th>
              {/* Member column */}
              <th
                className="px-3 py-2 text-left sticky z-20"
                style={{ left: 50, width: '160px', minWidth: '160px', background: 'linear-gradient(to right, rgb(249 250 251), rgb(243 244 246))', boxShadow: '2px 0 4px rgba(0,0,0,0.08)' }}
              >
                Member
              </th>
              {weekDates.map(d => (
                <th key={d} className="px-3 py-2 text-center whitespace-nowrap" title={formatFullDate(d)}>
                  {weekday(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredMembers.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={2 + weekDates.length}>
                  {bacentaFilter || searchTerm ? 'No members match your filter' : 'No members added yet'}
                </td>
              </tr>
            ) : (
              filteredMembers.map((m, rowIndex) => (
                <tr
                  key={m.id}
                  className={`${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-blue-50/50 transition-colors duration-200`}
                >
                  {/* Row number cell */}
                  <td
                    className="px-3 py-2 text-center sticky z-10"
                    style={{ left: 0, width: '50px', minWidth: '50px', backgroundColor: rowIndex % 2 === 0 ? 'white' : 'rgb(249 250 251)' }}
                  >
                    <span className="text-sm font-medium text-gray-600">{rowIndex + 1}</span>
                  </td>
                  {/* Member cell with role badge */}
                  <td
                    className="px-3 py-2 sticky z-10"
                    style={{ left: 50, width: '160px', minWidth: '160px', backgroundColor: rowIndex % 2 === 0 ? 'white' : 'rgb(249 250 251)', boxShadow: '2px 0 4px rgba(0,0,0,0.06)' }}
                  >
                    <div className="flex items-center space-x-1">
                      <span className="font-semibold text-sm text-gray-900 truncate">
                        {m.firstName} {m.lastName || ''}
                      </span>
                      <span className="text-xs" title={m.role || 'Member'}>
                        {m.role === 'Bacenta Leader' ? '💚' : m.role === 'Fellowship Leader' ? '❤️' : '👤'}
                      </span>
                    </div>
                  </td>
                  {weekDates.map(date => {
                  const key = `${m.id}_${date}`;
                  const status = recordsByKey.get(key);
                  const editable = isDateEditable(date, allowEditPreviousSundays);

                  // Compute disabled style (reuse attendance look & feel)
                  const today = new Date();
                  // const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                  const target = new Date(date + 'T00:00:00');
                  const isPastMonth = target.getFullYear() < today.getFullYear() || (target.getFullYear() === today.getFullYear() && target.getMonth() < today.getMonth());

                  const baseClasses = 'w-6 h-6 rounded border-2 flex items-center justify-center transition-all duration-200';
                  const classes = !editable
                    ? (isPastMonth ? 'bg-gray-200 border-gray-300 cursor-not-allowed opacity-60' : 'bg-blue-50 border-blue-200 cursor-not-allowed opacity-60')
                    : status === 'Prayed'
                      ? 'bg-green-500 border-green-500 text-white hover:bg-green-600 cursor-pointer'
                      : status === 'Missed'
                        ? 'bg-red-500 border-red-500 text-white hover:bg-red-600 cursor-pointer'
                        : 'bg-gray-100 border-gray-300 text-gray-400 hover:bg-gray-200 cursor-pointer';

                  const title = !editable
                    ? (isPastMonth
                        ? `Past month - cannot edit ${formatFullDate(date)}`
                        : `Future date - cannot edit ${formatFullDate(date)}`)
                    : `Click to ${!status ? 'mark prayed' : status === 'Prayed' ? 'mark missed' : 'clear'} for ${formatFullDate(date)}`;

                  return (
                      <td key={date} className="px-3 py-2 text-center">
                        <div className="flex justify-center">
                          <div
                            className={`${baseClasses} ${classes}`}
                            onClick={editable ? (e) => { e.stopPropagation(); onToggle(m.id, date); } : undefined}
                            title={title}
                          >
                            {status === 'Prayed' && (
                              <CheckIcon className="w-4 h-4" />
                            )}
                            {status === 'Missed' && (
                              <XMarkIcon className="w-4 h-4" />
                            )}
                          </div>
                        </div>
                      </td>
                  );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PrayerView;
