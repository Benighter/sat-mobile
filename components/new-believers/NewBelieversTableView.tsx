import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { Member } from '../../types';
import { SmartTextParser } from '../../utils/smartTextParser';
import { UserIcon, PhoneIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from '../icons';
import { formatDisplayDate } from '../../utils/dateUtils';

interface Column {
  key: string;
  header: React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render: (m: Member, index?: number) => React.ReactNode;
}

const NewBelieversTableView: React.FC = () => {
  const {
    members,
    bacentas,
    attendanceRecords,
    openMemberForm,
    isLoading,
  displayedSundays,
    navigateToPreviousMonth,
    navigateToNextMonth,
    showToast
  } = useAppContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'Bacenta Leader' | 'Fellowship Leader' | 'Member'>('all');
  const [bacentaFilter, setBacentaFilter] = useState('');
  const [originFilter, setOriginFilter] = useState<'all' | 'outreach'>('all');

  const handleContactClick = async (contact: string) => {
    await SmartTextParser.copyPhoneToClipboard(contact, showToast);
  };

  // Bacenta options for filter
  const bacentaOptions = useMemo(() => {
    return [...bacentas].sort((a, b) => a.name.localeCompare(b.name));
  }, [bacentas]);

  // Filter and sort born again members
  const filteredMembers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return members
      .filter(m => m.bornAgainStatus)
      .filter(m => {
        if (roleFilter !== 'all' && (m.role || 'Member') !== roleFilter) return false;
    if (originFilter === 'outreach' && !m.outreachOrigin) return false;
        if (bacentaFilter === '__unassigned__') {
          if (m.bacentaId) return false;
        } else if (bacentaFilter && m.bacentaId !== bacentaFilter) return false;
        if (!search) return true;
        return (
          m.firstName.toLowerCase().includes(search) ||
          (m.phoneNumber || '').includes(searchTerm) ||
          (m.buildingAddress || '').toLowerCase().includes(search)
        );
      })
      .sort((a, b) => a.firstName.localeCompare(b.firstName));
  }, [members, roleFilter, bacentaFilter, originFilter, searchTerm]);

  const getAttendanceStatus = (memberId: string, date: string) => {
    const record = attendanceRecords.find(ar => ar.memberId === memberId && ar.date === date);
    return record?.status;
  };

  // Fixed columns: number and name
  const fixedColumns: Column[] = useMemo(() => [
    {
      key: 'number',
      header: '#',
      width: '50px',
      render: (_m: Member, index?: number) => (
        <div className="flex items-center justify-center">
          <span className="text-sm font-medium text-gray-600">{(index ?? 0) + 1}</span>
        </div>
      )
    },
    {
      key: 'name',
      header: 'Name',
  width: '110px',
      render: (m: Member) => (
        <div
          className="flex items-center space-x-2 cursor-pointer hover:bg-blue-50 rounded-lg p-1 -m-1 transition-colors duration-200"
          onClick={(e) => { e.stopPropagation(); openMemberForm(m); }}
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 bg-gradient-to-br ${m.outreachOrigin ? 'from-orange-100 to-orange-200 ring-2 ring-orange-300' : 'from-green-100 to-green-200 ring-2 ring-green-300'}`}>
            <UserIcon className={`w-3 h-3 ${m.outreachOrigin ? 'text-orange-700' : 'text-green-700'}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-sm truncate text-gray-900">{m.firstName}</span>
                  {m.outreachOrigin && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-800 border border-orange-200">
                      Outreach
                    </span>
                  )}
                </div>
                {m.ministry && m.ministry.trim() !== '' && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">{m.ministry}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    }
  ], [openMemberForm]);

  // Scrollable columns: contact, residence, attendance per Sunday, actions
  const scrollableColumns: Column[] = useMemo(() => {
    const base: Column[] = [
      {
        key: 'phoneNumber',
        header: 'Phone',
        width: '140px',
        align: 'left' as const,
        render: (m: Member) => (
          <div
            className={`flex items-center space-x-2 ${m.phoneNumber ? 'cursor-pointer hover:bg-blue-50 rounded px-1 py-1 transition-colors' : ''}`}
            onClick={() => m.phoneNumber && handleContactClick(m.phoneNumber)}
          >
            <PhoneIcon className="w-4 h-4 text-gray-400" />
            <span className="text-sm">{m.phoneNumber || '-'}</span>
          </div>
        )
      },
    ];

    const attendanceCols: Column[] = displayedSundays.map((date) => ({
      key: `attendance_${date}`,
      header: (
        <div className="flex flex-col items-center space-y-1">
          <span className="text-xs text-gray-700">{formatDisplayDate(date)}</span>
        </div>
      ),
      width: '90px',
      align: 'center' as const,
      render: (m: Member) => {
        const status = getAttendanceStatus(m.id, date);
        const isPresent = status === 'Present';
        return (
          <div className="flex justify-center">
            <div
              className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all duration-200 cursor-not-allowed ${
                isPresent
                  ? 'bg-green-500 border-green-500 text-white'
                  : status === 'Absent'
                  ? 'bg-red-500 border-red-500 text-white'
                  : 'bg-gray-100 border-gray-300 text-gray-400'
              }`}
              title={status ? `Attendance: ${status}` : 'No attendance recorded'}
            >
              {isPresent && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {status === 'Absent' && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </div>
        );
      }
    }));

    return [...base, ...attendanceCols];
  }, [displayedSundays, attendanceRecords]);

  // We don't display month/year in the header for this view
  

  return (
    <div className="space-y-3 desktop:space-y-4">
      {/* Clean Header */}
      <div className="bg-white rounded-lg desktop:rounded-xl shadow-sm desktop:shadow-md border border-gray-200 p-4 desktop:p-5 desktop-lg:p-6">
        <div className="text-center">
          {/* Title (no month/year) */}
          <div className="flex items-center justify-center space-x-2 mb-3">
            <CalendarIcon className="w-5 h-5 desktop:w-6 desktop:h-6 text-blue-600" />
            <h2 className="text-xl desktop:text-2xl desktop-lg:text-3xl font-semibold text-gray-900">Born Again (Sons of God)</h2>
          </div>

          {/* Summary */}
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 mb-3">
            <span>{displayedSundays.length} Sunday{displayedSundays.length !== 1 ? 's' : ''}</span>
            <span>•</span>
            <span>{filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center space-x-4 mb-4">
            <button
              onClick={navigateToPreviousMonth}
              className="flex items-center justify-center w-10 h-10 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors duration-200 shadow-sm"
              aria-label="Previous month"
              title="Previous month"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <button
              onClick={navigateToNextMonth}
              className="flex items-center justify-center w-10 h-10 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors duration-200 shadow-sm"
              aria-label="Next month"
              title="Next month"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3 sm:items-end justify-center">
            <div className="w-full sm:w-64">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search born again..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-2 border border-gray-300 dark:border-dark-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors text-base sm:text-sm bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 placeholder-gray-500 dark:placeholder-dark-400 text-center search-input"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as 'all' | 'Bacenta Leader' | 'Fellowship Leader' | 'Member')}
                className="w-full px-3 py-3 sm:py-2 border border-gray-300 dark:border-dark-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors text-base sm:text-sm bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 text-center cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="Bacenta Leader">💚 Bacenta Leaders</option>
                <option value="Fellowship Leader">❤️ Fellowship Leaders</option>
                <option value="Member">👤 Members</option>
              </select>
            </div>
            <div className="w-full sm:w-56">
              <select
                value={bacentaFilter}
                onChange={(e) => setBacentaFilter(e.target.value)}
                className="w-full px-3 py-3 sm:py-2 border border-gray-300 dark:border-dark-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors text-base sm:text-sm bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 text-center cursor-pointer"
              >
                <option value="">All Bacentas</option>
                <option value="">—</option>
                <option value="__unassigned__">Unassigned</option>
                {bacentaOptions.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-40">
              <select
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value as 'all' | 'outreach')}
                className="w-full px-3 py-3 sm:py-2 border border-gray-300 dark:border-dark-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors text-base sm:text-sm bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 text-center cursor-pointer"
              >
                <option value="all">All Origins</option>
                <option value="outreach">🟧 Outreach</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky table like Members */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">
              {searchTerm || roleFilter !== 'all' || bacentaFilter
                ? 'No born again members match your filters'
                : 'No born again members yet'}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto desktop:overflow-x-visible desktop-table-container">
            <table className="min-w-full border-collapse desktop-table desktop:w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 desktop:from-gray-50 desktop:to-gray-50 border-b border-gray-200 desktop:border-gray-300">
                  {fixedColumns.map((column, index) => (
                    <th
                      key={column.key}
                      className={`sticky z-20 px-3 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider ${
                        column.key === 'number' ? 'text-center' : 'text-left'
                      } ${index === fixedColumns.length - 1 ? 'border-r border-gray-200' : ''}`}
                      style={{
                        left: index === 0 ? '0px' : '50px',
                        width: column.width,
                        minWidth: column.width,
                        background: 'linear-gradient(to right, rgb(249 250 251), rgb(243 244 246))',
                        boxShadow: index === fixedColumns.length - 1 ? '2px 0 4px rgba(0, 0, 0, 0.1)' : 'none'
                      }}
                    >
                      <div className="truncate">{column.header}</div>
                    </th>
                  ))}
                  {scrollableColumns.map((column, index) => (
                    <th
                      key={index}
                      className={`px-3 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider ${
                        column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                      style={{
                        width: column.width,
                        minWidth: column.width || '80px'
                      }}
                    >
                      <div className="truncate">{column.header}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredMembers.map((m, rowIndex) => (
                  <tr key={m.id} className={`${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-blue-50/50 transition-colors duration-200`}>
                    {fixedColumns.map((column, colIndex) => (
                      <td
                        key={column.key}
                        className={`sticky z-10 px-3 py-3 text-sm ${column.key === 'number' ? 'text-center' : 'text-left'} ${colIndex === fixedColumns.length - 1 ? 'border-r border-gray-200' : ''}`}
                        style={{
                          left: colIndex === 0 ? '0px' : '50px',
                          width: column.width,
                          minWidth: column.width,
                          backgroundColor: rowIndex % 2 === 0 ? 'white' : 'rgb(249 250 251)',
                          boxShadow: colIndex === fixedColumns.length - 1 ? '2px 0 4px rgba(0, 0, 0, 0.1)' : 'none'
                        }}
                      >
                        {column.render(m, rowIndex)}
                      </td>
                    ))}
                    {scrollableColumns.map((column, colIndex) => (
                      <td
                        key={colIndex}
                        className={`px-3 py-3 text-sm ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'}`}
                        style={{ width: column.width, minWidth: column.width || '80px' }}
                      >
                        {column.render ? column.render(m) : (m as any)[column.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default NewBelieversTableView;
