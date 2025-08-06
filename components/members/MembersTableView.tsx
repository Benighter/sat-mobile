import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { Member, ConfirmationStatus, MemberDeletionRequest } from '../../types';
import { formatDisplayDate, getSundaysOfMonth, getMonthName, formatDateToYYYYMMDD, getUpcomingSunday } from '../../utils/dateUtils';
import { isDateEditable } from '../../utils/attendanceUtils';
import { canDeleteMemberWithRole, hasAdminPrivileges } from '../../utils/permissionUtils';
import { SmartTextParser } from '../../utils/smartTextParser';
import { memberDeletionRequestService } from '../../services/firebaseService';
import { UserIcon, TrashIcon, PhoneIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, EllipsisVerticalIcon, CheckIcon, ClockIcon } from '../icons';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ConfirmationMarker from '../common/ConfirmationMarker';

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
    isLoading,
    userProfile,
    showConfirmation,
    showToast
  } = useAppContext();

  // Get user preference for editing previous Sundays
  const allowEditPreviousSundays = userProfile?.preferences?.allowEditPreviousSundays ?? false;

  const [searchTerm, setSearchTerm] = useState('');
  const [displayedDate, setDisplayedDate] = useState(new Date());
  const [roleFilter, setRoleFilter] = useState<'all' | 'Bacenta Leader' | 'Fellowship Leader' | 'Member'>('all');

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
        return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
      });
  }, [members, bacentaFilter, searchTerm, roleFilter]);



  // Define fixed columns (numbering and name)
  const fixedColumns = useMemo(() => [
    {
      key: 'number',
      header: '#',
      width: '50px',
      render: (member: Member, index: number) => (
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
        width: '140px',
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
      const today = new Date();
      const todayStr = formatDateToYYYYMMDD(today);
      const targetDate = new Date(sundayDate + 'T00:00:00');
      const isPastMonth = targetDate.getFullYear() < today.getFullYear() ||
                        (targetDate.getFullYear() === today.getFullYear() && targetDate.getMonth() < today.getMonth());

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
        const todayStr = formatDateToYYYYMMDD(today);
        const targetDate = new Date(sundayDate + 'T00:00:00');
        const isPastMonth = targetDate.getFullYear() < today.getFullYear() ||
                          (targetDate.getFullYear() === today.getFullYear() && targetDate.getMonth() < today.getMonth());

        return (
          <div className="flex justify-center">
            <div
              className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                !isEditable
                  ? isPastMonth
                    ? 'bg-gray-200 border-gray-300 cursor-not-allowed opacity-60'
                    : 'bg-blue-50 border-blue-200 cursor-not-allowed opacity-60'
                  : isPresent
                  ? 'bg-green-500 border-green-500 text-white hover:bg-green-600 cursor-pointer'
                  : status === 'Absent'
                  ? 'bg-red-500 border-red-500 text-white hover:bg-red-600 cursor-pointer'
                  : 'bg-gray-100 border-gray-300 text-gray-400 hover:bg-gray-200 cursor-pointer'
              }`}
              onClick={isEditable ? (e) => {
                e.stopPropagation();
                handleAttendanceToggle(member.id, sundayDate);
              } : undefined}
              title={
                !isEditable
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
          />
        );
      },
    };

    return [...baseScrollableColumns, ...attendanceColumns, actionsColumn];
  }, [currentMonthSundays, attendanceRecords, sundayConfirmations, deleteMemberHandler, getAttendanceStatus, getConfirmationStatus, handleAttendanceToggle, upcomingSunday, markConfirmationHandler]);

  // Get displayed month name
  const currentMonthName = getMonthName(displayedDate.getMonth());
  const currentYear = displayedDate.getFullYear();

  return (
    <div className="space-y-3 desktop:space-y-4">
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
            <span>{filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Role Statistics */}
          <div className="flex items-center justify-center space-x-8 text-sm mb-4">
            <div className="flex items-center justify-center space-x-2 min-w-0">
              <span className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></span>
              <span className="text-gray-700 font-medium whitespace-nowrap">
                {filteredMembers.filter(m => (m.role || 'Member') === 'Bacenta Leader').length} BL
              </span>
            </div>
            <div className="flex items-center justify-center space-x-2 min-w-0">
              <span className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0"></span>
              <span className="text-gray-700 font-medium whitespace-nowrap">
                {filteredMembers.filter(m => (m.role || 'Member') === 'Fellowship Leader').length} FL
              </span>
            </div>
            <div className="flex items-center justify-center space-x-2 min-w-0">
              <span className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></span>
              <span className="text-gray-700 font-medium whitespace-nowrap">
                {filteredMembers.filter(m => (m.role || 'Member') === 'Member').length} M
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

          {/* Search and Filter */}
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
          </div>
        </div>
      </div>

      {/* Members Attendance Table with Fixed Name Column */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">
              {bacentaFilter
                ? "No members found in this bacenta"
                : searchTerm
                  ? "No members match your search"
                  : "No members added yet"}
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
                {filteredMembers.map((member, rowIndex) => (
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
                      const value = member[column.key as keyof Member];
                      return (
                        <td
                          key={colIndex}
                          className={`px-3 py-3 text-sm ${
                            column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'
                          }`}
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
  getConfirmationStatus: (memberId: string, date: string) => ConfirmationStatus;
  markConfirmationHandler: (memberId: string, date: string, status: ConfirmationStatus) => void;
  deleteMemberHandler: (memberId: string) => void;
  showConfirmation: (type: string, data: any, callback: () => void) => void;
  userProfile: any;
  members: Member[];
  showToast: (type: string, title: string, message: string) => void;
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
  showToast
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Actions Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 rounded-md hover:bg-gray-100 transition-colors duration-200"
        title="Member actions"
      >
        <EllipsisVerticalIcon className="w-4 h-4 text-gray-600" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {/* Sunday Confirmation Action */}
          <button
            onClick={handleConfirmationToggle}
            className={`w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-3 ${
              isConfirmed ? 'text-green-700' : 'text-gray-700'
            }`}
          >
            {isConfirmed ? (
              <CheckIcon className="w-4 h-4 text-green-600" />
            ) : (
              <ClockIcon className="w-4 h-4 text-gray-500" />
            )}
            <div className="flex-1">
              <div className="text-sm font-medium">
                {isConfirmed ? 'Unconfirm' : 'Confirm'} for Sunday
              </div>
              <div className="text-xs text-gray-500">
                {formatDisplayDate(upcomingSunday)}
              </div>
            </div>
          </button>

          {/* Divider */}
          <div className="border-t border-gray-100 my-1"></div>

          {/* Remove Action */}
          {canDelete ? (
            <button
              onClick={handleRemove}
              className="w-full px-3 py-2 text-left hover:bg-red-50 transition-colors duration-200 flex items-center space-x-3 text-red-700"
            >
              <TrashIcon className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium">Remove Member</span>
            </button>
          ) : (
            <div
              className="w-full px-3 py-2 flex items-center space-x-3 text-gray-400 cursor-not-allowed"
              title={member.role === 'Bacenta Leader' || member.role === 'Fellowship Leader'
                ? "You cannot delete leaders. Only original administrators can delete Bacenta Leaders and Fellowship Leaders."
                : "You do not have permission to delete this member"
              }
            >
              <TrashIcon className="w-4 h-4 text-gray-400" />
              <span className="text-sm">Remove Member</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MembersTableView;
