import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { Member } from '../types';
import Table from './ui/Table';
import { formatDisplayDate, getSundaysOfMonth, getMonthName, formatDateToYYYYMMDD } from '../utils/dateUtils';
import { UserIcon, EditIcon, TrashIcon, PhoneIcon, HomeIcon, CalendarIcon, WarningIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Input from './ui/Input';

interface MembersTableViewProps {
  bacentaFilter?: string | null;
}

const MembersTableView: React.FC<MembersTableViewProps> = ({ bacentaFilter }) => {
  const {
    members,
    bacentas,
    criticalMemberIds,
    openMemberForm,
    deleteMemberHandler,
    attendanceRecords,
    markAttendanceHandler,
    clearAttendanceHandler,
    isLoading
  } = useAppContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [displayedDate, setDisplayedDate] = useState(new Date());

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

  // Get attendance status for a member on a specific date
  const getAttendanceStatus = (memberId: string, date: string) => {
    const record = attendanceRecords.find(ar => ar.memberId === memberId && ar.date === date);
    return record?.status;
  };

  // Check if a date is editable (not in future, not in past months)
  const isDateEditable = (dateString: string) => {
    const today = new Date();
    const todayStr = formatDateToYYYYMMDD(today);
    const targetDate = new Date(dateString + 'T00:00:00'); // Parse as local date
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const targetMonth = targetDate.getMonth();
    const targetYear = targetDate.getFullYear();

    // Don't allow editing past months
    if (targetYear < currentYear || (targetYear === currentYear && targetMonth < currentMonth)) {
      return false;
    }

    // Don't allow editing future Sundays (compare date strings to avoid timezone issues)
    if (dateString > todayStr) {
      return false;
    }

    return true;
  };

  // Handle attendance toggle with three states: empty -> Present -> Absent -> empty
  const handleAttendanceToggle = async (memberId: string, date: string) => {
    if (!isDateEditable(date)) {
      return; // Don't allow editing
    }

    const currentStatus = getAttendanceStatus(memberId, date);
    console.log('🔄 Toggle attendance:', memberId, date, 'Current:', currentStatus);

    // Three-state cycle: empty -> Present -> Absent -> empty
    if (!currentStatus) {
      // Empty state: mark as Present
      console.log('➡️ Empty -> Present');
      await markAttendanceHandler(memberId, date, 'Present');
    } else if (currentStatus === 'Present') {
      // Present state: mark as Absent
      console.log('➡️ Present -> Absent');
      await markAttendanceHandler(memberId, date, 'Absent');
    } else if (currentStatus === 'Absent') {
      // Absent state: clear/remove the record (back to empty)
      console.log('➡️ Absent -> Empty');
      await clearAttendanceHandler(memberId, date);
    }
  };

  // Filter and search members
  const filteredMembers = useMemo(() => {
    return members
      .filter(member => {
        // Filter by bacenta if specified
        if (bacentaFilter && member.bacentaId !== bacentaFilter) {
          return false;
        }
        
        // Filter by search term
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          return (
            member.firstName.toLowerCase().includes(searchLower) ||
            member.lastName.toLowerCase().includes(searchLower) ||
            member.phoneNumber.includes(searchTerm) ||
            member.buildingAddress.toLowerCase().includes(searchLower)
          );
        }
        
        return true;
      })
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  }, [members, bacentaFilter, searchTerm]);

  // Get bacenta name by ID
  const getBacentaName = (bacentaId: string) => {
    if (!bacentaId) return 'Unassigned';
    const bacenta = bacentas.find(b => b.id === bacentaId);
    return bacenta?.name || 'Unknown';
  };

  // Define table columns with attendance
  const columns = useMemo(() => {
    const baseColumns = [
      {
        key: 'name',
        header: 'Name',
        width: '200px',
        render: (member: Member) => (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">
                {member.firstName} {member.lastName}
              </div>
              {criticalMemberIds.includes(member.id) && (
                <Badge variant="danger" size="sm" className="mt-1">
                  <WarningIcon className="w-3 h-3 mr-1" />
                  Critical
                </Badge>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'phoneNumber',
        header: 'Phone',
        width: '140px',
        render: (member: Member) => (
          <div className="flex items-center space-x-2">
            <PhoneIcon className="w-4 h-4 text-gray-400" />
            <span className="text-sm">{member.phoneNumber || '-'}</span>
          </div>
        ),
      },
      {
        key: 'buildingAddress',
        header: 'Address',
        width: '180px',
        render: (member: Member) => (
          <div className="flex items-center space-x-2">
            <HomeIcon className="w-4 h-4 text-gray-400" />
            <span className="truncate text-sm" title={member.buildingAddress}>
              {member.buildingAddress || '-'}
            </span>
          </div>
        ),
      },
      {
        key: 'bacentaId',
        header: 'Bacenta',
        width: '120px',
        render: (member: Member) => (
          <Badge variant="secondary" size="sm">
            {getBacentaName(member.bacentaId)}
          </Badge>
        ),
      },
      {
        key: 'bornAgainStatus',
        header: 'Born Again',
        width: '100px',
        align: 'center' as const,
        render: (member: Member) => (
          <Badge
            variant={member.bornAgainStatus ? 'success' : 'warning'}
            size="sm"
          >
            {member.bornAgainStatus ? 'Yes' : 'No'}
          </Badge>
        ),
      },
      {
        key: 'joinedDate',
        header: 'Joined',
        width: '100px',
        render: (member: Member) => (
          <div className="text-sm">
            {member.joinedDate ? formatDisplayDate(member.joinedDate) : '-'}
          </div>
        ),
      },
    ];

    // Add attendance columns for each Sunday
    const attendanceColumns = currentMonthSundays.map((sundayDate) => {
      const isEditable = isDateEditable(sundayDate);
      const today = new Date();
      const todayStr = formatDateToYYYYMMDD(today);
      const targetDate = new Date(sundayDate + 'T00:00:00'); // Parse as local date
      const isFuture = sundayDate > todayStr;
      const isPastMonth = targetDate.getFullYear() < today.getFullYear() ||
                        (targetDate.getFullYear() === today.getFullYear() && targetDate.getMonth() < today.getMonth());

      return {
        key: `attendance_${sundayDate}`,
        header: (
          <div className="flex flex-col items-center space-y-1">
            <span className={`text-xs ${!isEditable ? 'text-gray-400' : 'text-gray-700'}`}>
              {formatDisplayDate(sundayDate)}
            </span>
            {false && !isEditable && (
              <div className="flex items-center justify-center">
                {isFuture ? (
                  <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            )}
          </div>
        ),
        width: '80px',
        align: 'center' as const,
        render: (member: Member) => {
        const status = getAttendanceStatus(member.id, sundayDate);
        const isPresent = status === 'Present';
        const isEditable = isDateEditable(sundayDate);
        const today = new Date();
        const todayStr = formatDateToYYYYMMDD(today);
        const targetDate = new Date(sundayDate + 'T00:00:00'); // Parse as local date
        const isFuture = sundayDate > todayStr;
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
              {false && !isEditable && isFuture && (
                <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              )}
              {false && !isEditable && isPastMonth && (
                <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </div>
        );
        },
      };
    });

    // Add actions column
    const actionsColumn = {
      key: 'actions',
      header: 'Actions',
      width: '80px',
      align: 'center' as const,
      render: (member: Member) => (
        <div className="flex items-center justify-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openMemberForm(member);
            }}
            className="p-1 hover:bg-blue-100"
            title="Edit member"
          >
            <EditIcon className="w-3 h-3 text-blue-600" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              deleteMemberHandler(member.id);
            }}
            className="p-1 hover:bg-red-100"
            title="Delete member"
          >
            <TrashIcon className="w-3 h-3 text-red-600" />
          </Button>
        </div>
      ),
    };

    return [...baseColumns, ...attendanceColumns, actionsColumn];
  }, [currentMonthSundays, criticalMemberIds, attendanceRecords, getBacentaName, openMemberForm, deleteMemberHandler, getAttendanceStatus, handleAttendanceToggle]);

  // Get displayed month name
  const currentMonthName = getMonthName(displayedDate.getMonth());
  const currentYear = displayedDate.getFullYear();

  return (
    <div className="space-y-6">
      {/* Header with month navigation and search */}
      <div className="glass p-4 rounded-2xl shadow-lg">
        <div className="flex flex-col space-y-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">
                Attendance for {currentMonthName} {currentYear}
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={navigateToPreviousMonth}
                className="group flex items-center space-x-2 px-3 py-2 glass hover:bg-white/20 rounded-xl transition-all duration-200 hover:scale-105"
                aria-label="Previous month"
              >
                <ChevronLeftIcon className="w-4 h-4 text-gray-600 group-hover:-translate-x-1 transition-transform" />
                <span className="hidden sm:inline text-sm font-medium text-gray-700">Previous</span>
              </button>
              <button
                onClick={navigateToNextMonth}
                className="group flex items-center space-x-2 px-3 py-2 glass hover:bg-white/20 rounded-xl transition-all duration-200 hover:scale-105"
                aria-label="Next month"
              >
                <span className="hidden sm:inline text-sm font-medium text-gray-700">Next</span>
                <ChevronRightIcon className="w-4 h-4 text-gray-600 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Search and Info */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
            <div className="flex flex-col space-y-2">
              <p className="text-sm text-gray-600">
                {currentMonthSundays.length} Sunday{currentMonthSundays.length !== 1 ? 's' : ''} in {currentMonthName}
              </p>
              {/* Smart editing status */}
              <div className="flex items-center space-x-4 text-xs">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-green-500 rounded border"></div>
                  <span className="text-gray-600">Editable</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-blue-50 border border-blue-200 rounded"></div>
                  <span className="text-gray-600">Future</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-gray-200 border border-gray-300 rounded"></div>
                    {/* <svg className="w-2 h-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg> */}

                  <span className="text-gray-600">Past Month</span>
                </div>
              </div>
            </div>
            <div className="w-full sm:w-64">
              <Input
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-0 bg-white/50 focus:bg-white/80 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Members Attendance Table */}
      <div className="glass rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <Table
            data={filteredMembers}
            columns={columns}
            loading={isLoading}
            emptyMessage={
              bacentaFilter
                ? "No members found in this bacenta"
                : searchTerm
                  ? "No members match your search"
                  : "No members added yet"
            }
            onRowClick={(member) => openMemberForm(member)}
            className="min-w-full"
          />
        </div>
      </div>

      {/* Summary */}
      {filteredMembers.length > 0 && (
        <div className="glass p-4 rounded-2xl shadow-lg">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-gray-900">Total Members</div>
              <div className="text-2xl font-bold text-blue-600">{filteredMembers.length}</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">Critical Alerts</div>
              <div className="text-2xl font-bold text-red-600">
                {criticalMemberIds.filter(id => filteredMembers.some(m => m.id === id)).length}
              </div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">Sundays This Month</div>
              <div className="text-2xl font-bold text-green-600">{currentMonthSundays.length}</div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default MembersTableView;
