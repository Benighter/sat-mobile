import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { Member, ConfirmationStatus } from '../../types';
import { formatDisplayDate, getSundaysOfMonth, getMonthName, getUpcomingSunday } from '../../utils/dateUtils';
import { isDateEditable } from '../../utils/attendanceUtils';
import { canDeleteMemberWithRole, hasAdminPrivileges } from '../../utils/permissionUtils';
import { SmartTextParser } from '../../utils/smartTextParser';
import { memberDeletionRequestService } from '../../services/firebaseService';
import { UserIcon, TrashIcon, PhoneIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, EllipsisVerticalIcon, CheckIcon, ClockIcon, ClipboardIcon } from '../icons';
// Removed unused UI imports

interface MembersTableViewProps {
  bacentaFilter?: string | null;
}

const MembersTableView: React.FC<MembersTableViewProps> = ({ bacentaFilter }) => {
  const {
    members,
    bacentas,
    sundayConfirmations,
    openMemberForm,
    deleteMemberHandler,
    attendanceRecords,
    markAttendanceHandler,
    clearAttendanceHandler,
    markConfirmationHandler,
  updateMemberHandler,
    isLoading,
    userProfile,
    showConfirmation,
    showToast,
    switchTab
  } = useAppContext();

  // Get user preference for editing previous Sundays
  const allowEditPreviousSundays = userProfile?.preferences?.allowEditPreviousSundays ?? false;

  const [searchTerm, setSearchTerm] = useState('');
  const [displayedDate, setDisplayedDate] = useState(new Date());
  const [roleFilter, setRoleFilter] = useState<'all' | 'Bacenta Leader' | 'Fellowship Leader' | 'Member'>('all');
  const [showFrozen, setShowFrozen] = useState(true);

  // Get upcoming Sunday for confirmation
  const upcomingSunday = useMemo(() => getUpcomingSunday(), []);

  // Get displayed month's Sundays
  const currentMonthSundays = useMemo(() => {
    return getSundaysOfMonth(displayedDate.getFullYear(), displayedDate.getMonth());
  }, [displayedDate]);

  // Month navigation
  const navigateToPreviousMonth = () => {
    setDisplayedDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  };

  const navigateToNextMonth = () => {
    setDisplayedDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  };

  const handlePhoneClick = async (phoneNumber: string) => {
    await SmartTextParser.copyPhoneToClipboard(phoneNumber, showToast);
  };

  // Get attendance status for a member on a specific date
  const getAttendanceStatus = (memberId: string, date: string) => {
    const record = attendanceRecords.find(ar => ar.memberId === memberId && ar.date === date);
    return record?.status;
  };

  // Get confirmation status for a member on a specific date
  const getConfirmationStatus = (memberId: string, date: string) => {
    const record = sundayConfirmations.find(cr => cr.memberId === memberId && cr.date === date);
    return record?.status;
  };

  // Handle attendance toggle with three states: empty -> Present -> Absent -> empty
  const handleAttendanceToggle = async (memberId: string, date: string) => {
    if (!isDateEditable(date, allowEditPreviousSundays)) {
      return; // Don't allow editing
    }

    const currentStatus = getAttendanceStatus(memberId, date);

    // Three-state cycle: empty -> Present -> Absent -> empty
    if (!currentStatus) {
      await markAttendanceHandler(memberId, date, 'Present');
    } else if (currentStatus === 'Present') {
      await markAttendanceHandler(memberId, date, 'Absent');
    } else if (currentStatus === 'Absent') {
      await clearAttendanceHandler(memberId, date);
    }
  };

  // Filter and search members
  const filteredMembers = useMemo(() => {
    const getRolePriority = (role: string | undefined) => {
      switch (role) {
        case 'Bacenta Leader': return 1;
        case 'Fellowship Leader': return 2;
        case 'Member': return 3;
        default: return 4;
      }
    };

    return members
      .filter(member => {
        // Filter by bacenta if specified
        if (bacentaFilter && member.bacentaId !== bacentaFilter) {
          return false;
        }

        // Filter by role
        if (roleFilter !== 'all' && (member.role || 'Member') !== roleFilter) {
          return false;
        }

        // Filter by search term
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          return (
            member.firstName.toLowerCase().includes(searchLower) ||
            (member.lastName || '').toLowerCase().includes(searchLower) ||
            member.phoneNumber.includes(searchTerm) ||
            member.buildingAddress.toLowerCase().includes(searchLower)
          );
        }

        return true;
      })
      .sort((a, b) => {
        // First sort by role priority
        const rolePriorityA = getRolePriority(a.role);
        const rolePriorityB = getRolePriority(b.role);

        if (rolePriorityA !== rolePriorityB) {
          return rolePriorityA - rolePriorityB;
        }

  // Then sort by last name, then first name within the same role
  return (a.lastName || '').localeCompare(b.lastName || '') || a.firstName.localeCompare(b.firstName);
      });
  }, [members, bacentaFilter, searchTerm, roleFilter]);

  // Apply frozen visibility toggle to the filtered list
  const displayMembers = useMemo(() => {
    return filteredMembers.filter(m => (showFrozen ? true : !m.frozen));
  }, [filteredMembers, showFrozen]);



  // Define fixed columns (numbering and name)
  const fixedColumns = useMemo(() => [
    {
      key: 'number',
      header: '#',
      width: '50px',
  render: (_member: Member, index: number) => (
        <div className="flex items-center justify-center">
          <span className="text-sm font-medium text-gray-600">
            {index + 1}
          </span>
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      width: '140px',
      render: (member: Member) => {
        const roleConfig = {
          'Bacenta Leader': { icon: '💚' },
          'Fellowship Leader': { icon: '❤️' },
          'Member': { icon: '👤' }
        };
        const roleIcon = roleConfig[member.role || 'Member'].icon;

        return (
          <div
            className="flex items-center space-x-2 cursor-pointer hover:bg-blue-50 rounded-lg p-1 -m-1 transition-colors duration-200"
            onClick={(e) => {
              e.stopPropagation();
              openMemberForm(member);
            }}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${
              member.bornAgainStatus
                ? 'bg-gradient-to-br from-green-100 to-green-200 ring-2 ring-green-300'
                : 'bg-gradient-to-br from-gray-100 to-gray-200'
            }`}>
              {member.profilePicture ? (
                <img
                  src={member.profilePicture}
                  alt={member.firstName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon className={`w-3 h-3 ${member.bornAgainStatus ? 'text-green-600' : 'text-gray-600'}`} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1">
                <span className={`font-semibold text-sm truncate ${
                  member.bornAgainStatus ? 'text-green-900' : 'text-gray-900'
                }`}>
                  {member.firstName}
                </span>
                <span className="text-xs flex-shrink-0" title={member.role || 'Member'}>
                  {roleIcon}
                </span>
                {member.bornAgainStatus && (
                  <span className="text-xs text-green-600 flex-shrink-0" title="Born Again">
                    ⭐
                  </span>
                )}
                {member.frozen && (
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 border border-sky-200" title="Frozen – excluded from counts and absentees">Frozen</span>
                )}
              </div>
            </div>
          </div>
        );
      },
    }
  ], [openMemberForm]);

  // Define scrollable columns (phone, role, born again, attendance dates, remove)
  const scrollableColumns = useMemo(() => {
    // Base scrollable columns (role and born again status now integrated into name column)
    const baseScrollableColumns = [
      {
        key: 'phoneNumber',
        header: 'Phone',
        width: '120px',
  align: 'left' as const,
        render: (member: Member) => (
          <div
            className={`flex items-center space-x-2 ${
              member.phoneNumber && member.phoneNumber.trim() !== '' && member.phoneNumber !== '-'
                ? 'cursor-pointer hover:bg-blue-50 rounded px-1 py-1 transition-colors'
                : ''
            }`}
            onClick={() => member.phoneNumber && member.phoneNumber !== '-' && handlePhoneClick(member.phoneNumber)}
          >
            <PhoneIcon className="w-4 h-4 text-gray-400" />
            <span className="text-sm">{member.phoneNumber || '-'}</span>
          </div>
        ),
      },

    ];

    // Add attendance columns for each Sunday
    const attendanceColumns = currentMonthSundays.map((sundayDate) => {
      const isEditable = isDateEditable(sundayDate, allowEditPreviousSundays);

      return {
        key: `attendance_${sundayDate}`,
        header: (
          <div className="flex flex-col items-center space-y-1">
            <span className={`text-xs ${!isEditable ? 'text-gray-400' : 'text-gray-700'}`}>
              {formatDisplayDate(sundayDate)}
            </span>
          </div>
        ),
        width: '80px',
        align: 'center' as const,
        render: (member: Member) => {
        const status = getAttendanceStatus(member.id, sundayDate);
        const isPresent = status === 'Present';
        const isEditable = isDateEditable(sundayDate, allowEditPreviousSundays);
        const today = new Date();
        const targetDate = new Date(sundayDate + 'T00:00:00');
        const isPastMonth = targetDate.getFullYear() < today.getFullYear() ||
                          (targetDate.getFullYear() === today.getFullYear() && targetDate.getMonth() < today.getMonth());

        return (
          <div className="flex justify-center">
            <div
              className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                member.frozen
                  ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed opacity-60'
                  : !isEditable
                  ? isPastMonth
                    ? 'bg-gray-200 border-gray-300 cursor-not-allowed opacity-60'
                    : 'bg-blue-50 border-blue-200 cursor-not-allowed opacity-60'
                  : isPresent
                  ? 'bg-green-500 border-green-500 text-white hover:bg-green-600 cursor-pointer'
                  : status === 'Absent'
                  ? 'bg-red-500 border-red-500 text-white hover:bg-red-600 cursor-pointer'
                  : 'bg-gray-100 border-gray-300 text-gray-400 hover:bg-gray-200 cursor-pointer'
              }`}
              onClick={isEditable && !member.frozen ? (e) => {
                e.stopPropagation();
                handleAttendanceToggle(member.id, sundayDate);
              } : undefined}
              title={
                member.frozen
                  ? 'Frozen member – attendance disabled'
                  : !isEditable
                  ? isPastMonth
                    ? `Past month - cannot edit ${formatDisplayDate(sundayDate)}`
                    : `Future date - cannot edit ${formatDisplayDate(sundayDate)}`
                  : `Click to ${!status ? 'mark present' : status === 'Present' ? 'mark absent' : 'clear attendance'} for ${formatDisplayDate(sundayDate)}`
              }
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
        },
      };
    });

    // Add actions dropdown column
    const actionsColumn = {
      key: 'actions',
      header: 'Actions',
      width: '80px',
      align: 'center' as const,
      render: (member: Member) => {
        return (
          <MemberActionsDropdown
            member={member}
            upcomingSunday={upcomingSunday}
            getConfirmationStatus={getConfirmationStatus}
            markConfirmationHandler={markConfirmationHandler}
            deleteMemberHandler={deleteMemberHandler}
            showConfirmation={showConfirmation}
            userProfile={userProfile}
            members={members}
            showToast={showToast}
            updateMemberHandler={updateMemberHandler}
          />
        );
      },
    };

    return [...baseScrollableColumns, ...attendanceColumns, actionsColumn];
  }, [currentMonthSundays, attendanceRecords, sundayConfirmations, deleteMemberHandler, getAttendanceStatus, getConfirmationStatus, handleAttendanceToggle, upcomingSunday, markConfirmationHandler]);

  // Get displayed month name
  const currentMonthName = getMonthName(displayedDate.getMonth());
  const currentYear = displayedDate.getFullYear();

  // Get bacenta name if filtering by bacenta
  const getBacentaName = (bacentaId: string) => {
    if (!bacentaId) return null;
    const bacenta = bacentas.find(b => b.id === bacentaId);
    return bacenta?.name || 'Unknown Bacenta';
  };

  const currentBacentaName = bacentaFilter ? getBacentaName(bacentaFilter) : null;

  return (
    <div className="space-y-3 desktop:space-y-4">
      {/* Bacenta Name Header - Only show when filtering by bacenta */}
      {currentBacentaName && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg desktop:rounded-xl shadow-sm border border-blue-200 p-3 desktop:p-4">
          <div className="text-center">
            <h1 className="text-lg desktop:text-xl desktop-lg:text-2xl font-bold text-blue-900">
              {currentBacentaName}
            </h1>
            <p className="text-sm desktop:text-base text-blue-700 font-medium">
              Bacenta
            </p>
          </div>
        </div>
      )}

      {/* Clean Header */}
      <div className="bg-white rounded-lg desktop:rounded-xl shadow-sm desktop:shadow-md border border-gray-200 p-4 desktop:p-5 desktop-lg:p-6">
        <div className="text-center">
          {/* Title */}
          <div className="flex items-center justify-center space-x-2 mb-3">
            <CalendarIcon className="w-5 h-5 desktop:w-6 desktop:h-6 text-blue-600" />
            <h2 className="text-xl desktop:text-2xl desktop-lg:text-3xl font-semibold text-gray-900">
              Attendance for {currentMonthName} {currentYear}
            </h2>
          </div>
          
          {/* Summary */}
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 mb-3">
            <span>{currentMonthSundays.length} Sunday{currentMonthSundays.length !== 1 ? 's' : ''} in {currentMonthName}</span>
            <span>•</span>
            <span>{filteredMembers.filter(m => !m.frozen).length} active member{filteredMembers.filter(m => !m.frozen).length !== 1 ? 's' : ''}</span>
          </div>

          {/* Role Statistics */}
          <div className="flex items-center justify-center space-x-8 text-sm mb-4">
            <div className="flex items-center justify-center space-x-2 min-w-0">
              <span className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></span>
              <span className="text-gray-700 font-medium whitespace-nowrap">
                {filteredMembers.filter(m => !m.frozen && (m.role || 'Member') === 'Bacenta Leader').length} BL
              </span>
            </div>
            <div className="flex items-center justify-center space-x-2 min-w-0">
              <span className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0"></span>
              <span className="text-gray-700 font-medium whitespace-nowrap">
                {filteredMembers.filter(m => !m.frozen && (m.role || 'Member') === 'Fellowship Leader').length} FL
              </span>
            </div>
            <div className="flex items-center justify-center space-x-2 min-w-0">
              <span className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></span>
              <span className="text-gray-700 font-medium whitespace-nowrap">
                {filteredMembers.filter(m => !m.frozen && (m.role || 'Member') === 'Member').length} M
              </span>
            </div>
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

          {/* Search, Filter, Frozen Toggle, and Copy */}
          <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3 sm:items-end justify-center">
            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-3 sm:py-2 border border-gray-300 dark:border-dark-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors text-base sm:text-sm bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 placeholder-gray-500 dark:placeholder-dark-400 text-center"
              />
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
            {/* Show/Hide Frozen Toggle */}
            <div className="w-full sm:w-auto flex items-center justify-center">
              <label className="inline-flex items-center space-x-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg shadow-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-blue-600"
                  checked={showFrozen}
                  onChange={(e) => setShowFrozen(e.target.checked)}
                />
                <span className="text-sm text-gray-700">Show Frozen</span>
              </label>
            </div>
            <div className="w-full sm:w-auto flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <button
                onClick={() => {
                  // Navigate to Copy Members page with current context
                  switchTab({
                    id: 'copy_members',
                    name: 'Copy Members',
                    data: {
                      bacentaFilter,
                      searchTerm,
                      roleFilter,
                      showFrozen
                    }
                  });
                }}
                disabled={displayMembers.length === 0}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-3 sm:py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg shadow-sm transition-colors text-base sm:text-sm font-medium"
                title={`Copy ${displayMembers.length} member${displayMembers.length !== 1 ? 's' : ''} information to clipboard`}
              >
                <ClipboardIcon className="w-4 h-4" />
                <span>Copy Members ({displayMembers.length})</span>
              </button>

              <button
                onClick={() => {
                  // Navigate to Copy Absentees page with current context
                  switchTab({
                    id: 'copy_absentees',
                    name: 'Copy Absentees',
                    data: {
                      bacentaFilter,
                      searchTerm,
                      roleFilter,
                      showFrozen
                    }
                  });
                }}
                disabled={displayMembers.length === 0}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-3 sm:py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg shadow-sm transition-colors text-base sm:text-sm font-medium"
                title="Copy absentee information for selected dates"
              >
                <ClipboardIcon className="w-4 h-4" />
                <span>Copy Absentees</span>
              </button>
            </div>
          </div>
        </div>
      </div>

  {/* Members Attendance Table with Fixed Name Column */}
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-visible">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading...</div>
          </div>
  ) : displayMembers.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">
              {bacentaFilter
                ? "No members found in this bacenta"
                : searchTerm
                  ? "No members match your search"
                  : showFrozen
                    ? "No members added yet"
                    : "No active (unfrozen) members to show"}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto desktop:overflow-x-visible desktop-table-container">
            <table className="min-w-full border-collapse desktop-table desktop:w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 desktop:from-gray-50 desktop:to-gray-50 border-b border-gray-200 desktop:border-gray-300">
                  {/* Fixed Headers (Number and Name) */}
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
                  {/* Scrollable Headers */}
                  {scrollableColumns.map((column, index) => {
                    const alignment = (column as any).align as 'left' | 'center' | 'right' | undefined;
                    const thClass = `px-3 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider ${
                      alignment === 'center' ? 'text-center' : alignment === 'right' ? 'text-right' : 'text-left'
                    }`;
                    return (
                      <th
                        key={index}
                        className={thClass}
                        style={{
                          width: column.width,
                          minWidth: column.width || '80px'
                        }}
                      >
                        <div className="truncate">{column.header}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {displayMembers.map((member, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={`
                      ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}
                      hover:bg-blue-50/50 transition-colors duration-200
                    `}
                  >
                    {/* Fixed Cells (Number and Name) */}
                    {fixedColumns.map((column, colIndex) => (
                      <td
                        key={column.key}
                        className={`sticky z-10 px-3 py-3 text-sm ${
                          column.key === 'number' ? 'text-center' : 'text-left'
                        } ${colIndex === fixedColumns.length - 1 ? 'border-r border-gray-200' : ''}`}
                        style={{
                          left: colIndex === 0 ? '0px' : '50px',
                          width: column.width,
                          minWidth: column.width,
                          backgroundColor: rowIndex % 2 === 0 ? 'white' : 'rgb(249 250 251)',
                          boxShadow: colIndex === fixedColumns.length - 1 ? '2px 0 4px rgba(0, 0, 0, 0.1)' : 'none'
                        }}
                      >
                        {column.render(member, rowIndex)}
                      </td>
                    ))}
                    {/* Scrollable Cells */}
                    {scrollableColumns.map((column, colIndex) => {
                      const alignment = (column as any).align as 'left' | 'center' | 'right' | undefined;
                      const value = member[column.key as keyof Member];
                      return (
                        <td
                          key={colIndex}
                          className={`px-3 py-3 text-sm ${alignment === 'center' ? 'text-center' : alignment === 'right' ? 'text-right' : 'text-left'}`}
                          style={{
                            width: column.width,
                            minWidth: column.width || '80px'
                          }}
                        >
                          {column.render ? column.render(member) : value}
                        </td>
                      );
                    })}
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

// Member Actions Dropdown Component
interface MemberActionsDropdownProps {
  member: Member;
  upcomingSunday: string;
  getConfirmationStatus: (memberId: string, date: string) => ConfirmationStatus | undefined;
  markConfirmationHandler: (memberId: string, date: string, status: ConfirmationStatus) => void;
  deleteMemberHandler: (memberId: string) => void;
  showConfirmation: (
    type: 'deleteMember' | 'createDeletionRequest' | 'deleteBacenta' | 'deleteNewBeliever' | 'clearData' | 'clearSelectedData' | 'clearAllNewBelievers',
    data: any,
    onConfirm: () => void
  ) => void;
  userProfile: any;
  members: Member[];
  showToast: (type: 'error' | 'success' | 'warning' | 'info', title: string, message?: string) => void;
  updateMemberHandler: (member: Member) => Promise<void>;
}

const MemberActionsDropdown: React.FC<MemberActionsDropdownProps> = ({
  member,
  upcomingSunday,
  getConfirmationStatus,
  markConfirmationHandler,
  deleteMemberHandler,
  showConfirmation,
  userProfile,
  members,
  showToast,
  updateMemberHandler
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<'above' | 'below'>('above');
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);

  const updatePosition = () => {
    const btn = buttonRef.current?.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const menuW = 288; // w-72
    const gap = 8;
    if (!btn) return;
    const estimatedH = 260; // rough height
    let nextPlacement: 'above' | 'below' = 'above';
    const spaceAbove = btn.top;
    const spaceBelow = viewportH - btn.bottom;
    if (spaceAbove >= estimatedH) nextPlacement = 'above';
    else if (spaceBelow >= estimatedH) nextPlacement = 'below';
    else nextPlacement = spaceAbove > spaceBelow ? 'above' : 'below';
    setPlacement(nextPlacement);
    const top = nextPlacement === 'above' ? Math.max(8, btn.top - estimatedH - gap) : Math.min(viewportH - 8, btn.bottom + gap);
    const left = Math.min(Math.max(8, btn.right - menuW), viewportW - menuW - 8);
    setMenuCoords({ top, left });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideButton = dropdownRef.current?.contains(target);
      const clickedInsideMenu = menuRef.current?.contains(target);
      if (!clickedInsideButton && !clickedInsideMenu) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const confirmationStatus = getConfirmationStatus(member.id, upcomingSunday);
  const isConfirmed = confirmationStatus === 'Confirmed';
  const canDelete = canDeleteMemberWithRole(userProfile, member.role);

  const handleConfirmationToggle = () => {
    const newStatus: ConfirmationStatus = isConfirmed ? 'Not Confirmed' : 'Confirmed';
    markConfirmationHandler(member.id, upcomingSunday, newStatus);
    setIsOpen(false);
  };

  const handleRemove = async () => {
    setIsOpen(false);

    const isAdmin = hasAdminPrivileges(userProfile);

    if (isAdmin) {
      // Admins can delete directly
      showConfirmation(
        'deleteMember',
        { member },
        () => deleteMemberHandler(member.id)
      );
    } else {
      // Leaders must create deletion requests
      try {
        // Check if there's already a pending request for this member
        const hasPending = await memberDeletionRequestService.hasPendingRequest(member.id);

        if (hasPending) {
          showToast('warning', 'Request Already Exists',
            `A deletion request for ${member.firstName} ${member.lastName || ''} is already pending admin approval.`);
          return;
        }

        // Verify member still exists and hasn't been modified
        const currentMember = members.find(m => m.id === member.id);
        if (!currentMember) {
          showToast('error', 'Member Not Found',
            'This member no longer exists and cannot be deleted.');
          return;
        }

        // Check if member details have changed significantly
        if (currentMember.firstName !== member.firstName ||
            currentMember.lastName !== member.lastName ||
            currentMember.role !== member.role) {
          showToast('warning', 'Member Details Changed',
            'This member\'s details have been updated. Please refresh and try again.');
          return;
        }

        // Show confirmation dialog explaining the approval process
        showConfirmation(
          'createDeletionRequest',
          { member },
          async () => {
            try {
              await memberDeletionRequestService.create({
                memberId: member.id,
                memberName: `${member.firstName} ${member.lastName || ''}`.trim(),
                requestedBy: userProfile?.uid || '',
                requestedByName: `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim(),
                requestedAt: new Date().toISOString(),
                status: 'pending',
                reason: '', // Could be enhanced to ask for reason
                churchId: userProfile?.churchId || ''
              });

              showToast('success', 'Deletion Request Submitted',
                `Your request to delete ${member.firstName} ${member.lastName || ''} has been submitted for admin approval.`);
            } catch (error: any) {
              console.error('Error creating deletion request:', error);
              showToast('error', 'Request Failed',
                'Failed to submit deletion request. Please try again.');
            }
          }
        );
      } catch (error: any) {
        console.error('Error checking pending requests:', error);
        showToast('error', 'Error', 'Failed to check existing requests. Please try again.');
      }
    }
  };

  const handleToggleFreeze = async () => {
    try {
      await updateMemberHandler({ ...member, frozen: !member.frozen, lastUpdated: new Date().toISOString() });
      showToast('success', member.frozen ? 'Unfrozen' : 'Frozen', `${member.firstName} ${member.lastName || ''} ${member.frozen ? 'is now active' : 'has been frozen'}`);
    } catch (e:any) {
      showToast('error', 'Failed', 'Could not update freeze status');
    } finally {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Actions Button */}
      <button
        ref={buttonRef}
    onClick={(e) => {
          e.stopPropagation();
          const next = !isOpen;
          setIsOpen(next);
          if (next) {
            // Compute smart placement on open
      requestAnimationFrame(() => updatePosition());
          }
        }}
        className={`p-1.5 rounded-md transition-colors duration-200 ${isOpen ? 'bg-gray-100 ring-1 ring-gray-200' : 'hover:bg-gray-100'}`}
        title="Member actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <EllipsisVerticalIcon className="w-4 h-4 text-gray-600" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && menuCoords && createPortal(
        <div
          ref={menuRef}
          className="fixed w-72 bg-white rounded-xl shadow-xl border border-gray-100 ring-1 ring-black/5 overflow-visible z-[1000]"
          style={{ top: menuCoords.top, left: menuCoords.left }}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${member.bornAgainStatus ? 'bg-green-100 ring-2 ring-green-300' : 'bg-gray-100'}`}>
                <UserIcon className={`w-4 h-4 ${member.bornAgainStatus ? 'text-green-700' : 'text-gray-500'}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900 truncate">{`${member.firstName} ${member.lastName || ''}`.trim()}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                    {(member.role || 'Member') === 'Bacenta Leader' ? '💚 BL' : (member.role || 'Member') === 'Fellowship Leader' ? '❤️ FL' : '👤 M'}
                  </span>
                  {member.frozen && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200" title="Frozen – excluded from counts and absentees">Frozen</span>
                  )}
                </div>
                {member.phoneNumber && member.phoneNumber !== '-' && (
                  <div className="text-xs text-gray-500 truncate">{member.phoneNumber}</div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-1 relative">
            {/* Freeze/Unfreeze */}
            <button
              onClick={handleToggleFreeze}
              className="w-full px-3 py-2.5 text-left hover:bg-gray-50 rounded-lg transition-colors duration-150 flex items-start gap-3 text-gray-700"
            >
              <span className="mt-0.5">❄️</span>
              <div className="flex-1">
                <div className="text-sm font-medium">{member.frozen ? 'Unfreeze' : 'Freeze'}</div>
                <div className="text-xs text-gray-500">{member.frozen ? 'Include in counts again' : 'Exclude from totals and absentees'}</div>
              </div>
            </button>

            {/* Confirm/Unconfirm for Sunday */}
            <button
              onClick={handleConfirmationToggle}
              className={`w-full px-3 py-2.5 text-left hover:bg-gray-50 rounded-lg transition-colors duration-150 flex items-start gap-3 ${isConfirmed ? 'text-green-700' : 'text-gray-700'}`}
            >
              {isConfirmed ? (
                <CheckIcon className="w-4 h-4 mt-0.5 text-green-600" />
              ) : (
                <ClockIcon className="w-4 h-4 mt-0.5 text-gray-500" />
              )}
              <div className="flex-1">
                <div className="text-sm font-medium">{isConfirmed ? 'Unconfirm for Sunday' : 'Confirm for Sunday'}</div>
                <div className="text-xs text-gray-500">{formatDisplayDate(upcomingSunday)}</div>
              </div>
            </button>

            {/* Danger zone */}
            <div className="my-1 border-t border-gray-100"></div>
            {canDelete ? (
              <button
                onClick={handleRemove}
                className="w-full px-3 py-2.5 text-left hover:bg-red-50 rounded-lg transition-colors duration-150 flex items-start gap-3 text-red-700"
              >
                <TrashIcon className="w-4 h-4 mt-0.5 text-red-600" />
                <div className="text-sm font-medium">Remove Member</div>
              </button>
            ) : (
              <div
                className="w-full px-3 py-2.5 flex items-start gap-3 text-gray-400 cursor-not-allowed"
                title={member.role === 'Bacenta Leader' || member.role === 'Fellowship Leader'
                  ? 'You cannot delete leaders. Only original administrators can delete Bacenta Leaders and Fellowship Leaders.'
                  : 'You do not have permission to delete this member'
                }
              >
                <TrashIcon className="w-4 h-4 mt-0.5 text-gray-400" />
                <div className="text-sm">Remove Member</div>
              </div>
            )}

            {/* Pointer arrow (auto positions based on placement) */}
            {placement === 'above' ? (
              <div className="pointer-events-none absolute -bottom-2 right-4 h-3 w-3 bg-white rotate-45 border-b border-r border-gray-100 ring-1 ring-black/5"></div>
            ) : (
              <div className="pointer-events-none absolute -top-2 right-4 h-3 w-3 bg-white rotate-45 border-t border-l border-gray-100 ring-1 ring-black/5"></div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MembersTableView;
