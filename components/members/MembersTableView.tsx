import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { Member, ConfirmationStatus } from '../../types';
import { formatDisplayDate, getMonthName, getUpcomingSunday } from '../../utils/dateUtils';
import { isDateEditable } from '../../utils/attendanceUtils';
import { canDeleteMemberWithRole, hasAdminPrivileges } from '../../utils/permissionUtils';
import { SmartTextParser } from '../../utils/smartTextParser';
import { memberDeletionRequestService } from '../../services/firebaseService';
import { UserIcon, TrashIcon, PhoneIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, EllipsisVerticalIcon, CheckIcon, ClockIcon, ClipboardIcon, ArrowRightIcon, CogIcon, SearchIcon } from '../icons';
import ConstituencyTransferModal from '../modals/ConstituencyTransferModal';
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
    openBacentaForm,
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
    switchTab,
    currentTab,
    isMinistryContext,
    transferMemberToConstituencyHandler,
  titheRecords,
  markTitheHandler,
  // Global month navigation/state from context (unifies month across views)
  displayedDate,
  displayedSundays,
  navigateToPreviousMonth,
  navigateToNextMonth,
  } = useAppContext();

  // Get user preference for editing previous Sundays
  const allowEditPreviousSundays = userProfile?.preferences?.allowEditPreviousSundays ?? false;

  const [searchTerm, setSearchTerm] = useState('');
  // Use global displayedDate from context for consistent month across the app
  const [roleFilter, setRoleFilter] = useState<'all' | 'Bacenta Leader' | 'Fellowship Leader' | 'Member'>('all');
  const [showFrozen, setShowFrozen] = useState(false);
  // Tithe-only UI state
  const [showPaidOnly, setShowPaidOnly] = useState(false);
  // Default to 'paid' so Tithe view shows paid members first
  const [titheSort, setTitheSort] = useState<'none' | 'paid' | 'amount_desc' | 'amount_asc'>('paid');

  // Tithe context flag (passed from Dashboard Tithe card)
  const isTithe = (currentTab?.data as any)?.isTithe === true;

  // Map tithe records by member for quick lookup (current month only, provided by context listener)
  const titheByMember = useMemo(() => {
    const map = new Map<string, { paid: boolean; amount: number; lastUpdated?: string }>();
    for (const r of titheRecords || []) {
      map.set(r.memberId, { paid: !!r.paid, amount: Number(r.amount || 0), lastUpdated: r.lastUpdated });
    }
    return map;
  }, [titheRecords]);

  // Get upcoming Sunday for confirmation
  const upcomingSunday = useMemo(() => getUpcomingSunday(), []);

  // Use context-provided Sundays for the displayed month
  const currentMonthSundays = useMemo(() => displayedSundays, [displayedSundays]);

  // Lock tithe editing when not on the current (real) month
  const isCurrentCalendarMonth = useMemo(() => {
    const now = new Date();
    return now.getFullYear() === displayedDate.getFullYear() && now.getMonth() === displayedDate.getMonth();
  }, [displayedDate]);

  // Month navigation is provided by context

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
    // Optional ministry-only filter passed via current tab data
  const ministryOnly: boolean = (currentTab?.data as any)?.ministryOnly === true;
  const speaksInTonguesOnly: boolean = (currentTab?.data as any)?.speaksInTonguesOnly === true;
  const baptizedOnly: boolean = (currentTab?.data as any)?.baptizedOnly === true;
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
        // Tithe: filter paid only if requested
        if (isTithe && showPaidOnly) {
          const rec = titheByMember.get(member.id);
          if (!rec || !rec.paid) return false;
        }
        // Filter by bacenta if specified
        if (bacentaFilter && member.bacentaId !== bacentaFilter) {
          return false;
        }

        // Filter by ministry if requested
        if (ministryOnly && !(member.ministry && member.ministry.trim() !== '')) {
          return false;
        }

        // Filter by spiritual milestones if requested via nav
        if (speaksInTonguesOnly && member.speaksInTongues !== true) {
          return false;
        }
        if (baptizedOnly && member.baptized !== true) {
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
        // Tithe-specific sorting
        if (isTithe && titheSort !== 'none') {
          const ra = titheByMember.get(a.id);
          const rb = titheByMember.get(b.id);
          if (titheSort === 'paid') {
            const pa = ra?.paid ? 1 : 0;
            const pb = rb?.paid ? 1 : 0;
            if (pa !== pb) return pb - pa; // paid first
          } else {
            const aa = Number(ra?.amount || 0);
            const ab = Number(rb?.amount || 0);
            if (aa !== ab) return titheSort === 'amount_desc' ? ab - aa : aa - ab;
          }
        }

        // Default sort by role then name
        const rolePriorityA = getRolePriority(a.role);
        const rolePriorityB = getRolePriority(b.role);
        if (rolePriorityA !== rolePriorityB) return rolePriorityA - rolePriorityB;
        return (a.lastName || '').localeCompare(b.lastName || '') || a.firstName.localeCompare(b.firstName);
  });
  }, [members, bacentaFilter, searchTerm, roleFilter, isTithe, showPaidOnly, titheSort, titheByMember]);

  // Apply frozen visibility toggle to the filtered list
  const displayMembers = useMemo(() => {
    return filteredMembers.filter(m => (showFrozen ? true : !m.frozen));
  }, [filteredMembers, showFrozen]);

  // Memoized counts for cleaner UI rendering
  const activeCount = useMemo(() => filteredMembers.filter(m => !m.frozen).length, [filteredMembers]);
  const countBL = useMemo(() => filteredMembers.filter(m => !m.frozen && (m.role || 'Member') === 'Bacenta Leader').length, [filteredMembers]);
  const countFL = useMemo(() => filteredMembers.filter(m => !m.frozen && (m.role || 'Member') === 'Fellowship Leader').length, [filteredMembers]);
  const countM = useMemo(() => filteredMembers.filter(m => !m.frozen && (m.role || 'Member') === 'Member').length, [filteredMembers]);

  // Special simple views for Tongues/Baptized navigation
  const speaksInTonguesOnly: boolean = (currentTab?.data as any)?.speaksInTonguesOnly === true;
  const baptizedOnly: boolean = (currentTab?.data as any)?.baptizedOnly === true;
  const isSpecialListView = speaksInTonguesOnly || baptizedOnly;

  // Global stats across active (non-frozen) members
  const allActiveMembers = useMemo(() => members.filter(m => !m.frozen), [members]);
  const baseForStats = useMemo(() => {
    if (bacentaFilter) {
      return allActiveMembers.filter(m => m.bacentaId === bacentaFilter);
    }
    return allActiveMembers;
  }, [allActiveMembers, bacentaFilter]);
  const tonguesYesCount = useMemo(() => baseForStats.filter(m => m.speaksInTongues === true).length, [baseForStats]);
  const tonguesNoCount = useMemo(() => baseForStats.length - tonguesYesCount, [baseForStats, tonguesYesCount]);
  const baptizedYesCount = useMemo(() => baseForStats.filter(m => m.baptized === true).length, [baseForStats]);
  const baptizedNoCount = useMemo(() => baseForStats.length - baptizedYesCount, [baseForStats, baptizedYesCount]);

  if (isSpecialListView) {
  const title = speaksInTonguesOnly ? 'Praying in Tongues' : 'Water Baptized';
    const stats = speaksInTonguesOnly
      ? [
          { label: 'Can pray in tongues', value: tonguesYesCount, color: 'text-emerald-700' },
          { label: "Can't pray in tongues", value: tonguesNoCount, color: 'text-gray-700' },
          { label: 'Total members', value: baseForStats.length, color: 'text-slate-700' },
        ]
      : [
          { label: 'Baptized', value: baptizedYesCount, color: 'text-emerald-700' },
          { label: 'Not baptized', value: baptizedNoCount, color: 'text-gray-700' },
          { label: 'Total members', value: baseForStats.length, color: 'text-slate-700' },
        ];
    const currentBacentaName = bacentaFilter ? (bacentas.find(b => b.id === bacentaFilter)?.name || '') : '';

    return (
      <div className="space-y-5 animate-fade-in">
        {/* Centered header */}
        <div className="text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
          {currentBacentaName && (
            <p className="mt-1 text-sm text-slate-500">Filtered to {currentBacentaName}</p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="glass rounded-xl px-5 py-4 text-center shadow-sm">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">{s.label}</div>
              <div className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Numbered simple list */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {displayMembers.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 text-center">No members found.</div>
          ) : (
            displayMembers.map((member, idx) => (
              <div
                key={member.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors group"
                onClick={() => openMemberForm(member)}
                title="Open member"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold text-gray-900 truncate">
                    {member.firstName} {member.lastName || ''}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {(member.role || 'Member')}{member.ministry ? ` • ${member.ministry}` : ''}
                  </div>
                </div>
                {member.phoneNumber && member.phoneNumber !== '-' && (
                  <button
                    className="ml-auto text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                    onClick={(e) => { e.stopPropagation(); handlePhoneClick(member.phoneNumber); }}
                  >
                    {member.phoneNumber}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }



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
  // Make name column slimmer so other columns are visible
  width: '110px',
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
                <div className="flex-1 min-w-0">
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
                  {member.ministry && member.ministry.trim() !== '' && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{member.ministry}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      },
    }
  ], [openMemberForm, isTithe]);

  // Define scrollable columns (phone, role, born again, attendance dates, remove)
  const scrollableColumns = useMemo(() => {
    // Base scrollable columns (role and born again status now integrated into name column)
    const baseScrollableColumns = isTithe
      ? [
          {
            key: 'tithe_paid',
            header: 'Paid',
            width: '80px',
            align: 'center' as const,
            render: (member: Member) => {
              const rec = titheByMember.get(member.id);
              const checked = !!rec?.paid;
              const amount = Number(rec?.amount || 0);
      return (
                <div className="flex justify-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-emerald-600"
                    checked={checked}
        disabled={!isCurrentCalendarMonth}
                    onChange={(e) => {
                      const nextPaid = e.target.checked;
                      markTitheHandler(member.id, nextPaid, amount);
                    }}
        title={!isCurrentCalendarMonth ? 'Past months are locked' : (checked ? 'Mark as not paid' : 'Mark as paid')}
                  />
                </div>
              );
            }
          },
          {
            key: 'tithe_amount',
            header: 'Amount (ZAR)',
            width: '140px',
            align: 'center' as const,
            render: (member: Member) => {
              const rec = titheByMember.get(member.id);
              const value = rec ? String(rec.amount ?? 0) : '';
      return (
                <div className="flex justify-center">
                  <input
                    key={`tithe_amount_${member.id}_${rec?.amount ?? 0}`}
                    type="text"
                    inputMode="decimal"
                    defaultValue={value ? formatCurrency(Number(value)) : ''}
        disabled={!isCurrentCalendarMonth}
                    onFocus={(e) => {
                      // Show raw number on focus
                      const raw = (rec?.amount ?? 0).toString();
                      e.currentTarget.value = raw === '0' ? '' : raw;
                      e.currentTarget.select();
                    }}
                    onKeyDown={(e) => {
                      const allowed = '0123456789.';
                      if (
                        e.key.length === 1 && !allowed.includes(e.key)
                      ) {
                        e.preventDefault();
                      }
                    }}
                    onBlur={(e) => {
                      const amt = Number(e.currentTarget.value.replace(/[^0-9.]/g, '') || 0);
                      const paid = amt > 0 ? true : (titheByMember.get(member.id)?.paid || false);
                      markTitheHandler(member.id, paid, amt);
                      // Format after saving
                      e.currentTarget.value = amt ? formatCurrency(amt) : '';
                    }}
                    className="w-28 px-2 py-1 border border-gray-300 rounded-md text-sm text-gray-900"
                    placeholder="0.00"
                    title={!isCurrentCalendarMonth ? 'Past months are locked' : (rec?.lastUpdated ? `Last updated: ${new Date(rec.lastUpdated).toLocaleString()}` : 'Enter tithe amount')}
                  />
                </div>
              );
            }
          }
        ]
      : [
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
  const attendanceColumns = isTithe ? [] : currentMonthSundays.map((sundayDate) => {
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
            isMinistryContext={isMinistryContext}
            transferMemberToConstituencyHandler={transferMemberToConstituencyHandler}
          />
        );
      },
    };

    const cols = [...baseScrollableColumns, ...attendanceColumns];
    if (!isTithe) cols.push(actionsColumn);
    return cols;
  }, [currentMonthSundays, attendanceRecords, sundayConfirmations, deleteMemberHandler, getAttendanceStatus, getConfirmationStatus, handleAttendanceToggle, upcomingSunday, markConfirmationHandler, isTithe, titheByMember, markTitheHandler]);

  // Get displayed month name
  const currentMonthName = getMonthName(displayedDate.getMonth());
  const currentYear = displayedDate.getFullYear();

  // Total tithe for displayed members (current month only)
  const totalTithe = useMemo(() => {
    if (!isTithe) return 0;
    return displayMembers.reduce((sum, m) => sum + (titheByMember.get(m.id)?.amount || 0), 0);
  }, [displayMembers, titheByMember, isTithe]);

  const paidCount = useMemo(() => {
    if (!isTithe) return 0;
    return displayMembers.filter(m => titheByMember.get(m.id)?.paid).length;
  }, [displayMembers, titheByMember, isTithe]);

  const formatCurrency = (n: number) => {
    try {
      return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 2 }).format(n);
    } catch {
      return `R${(n || 0).toFixed(2)}`;
    }
  };

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
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg desktop:rounded-xl shadow-sm border border-blue-200 p-3 desktop:p-4 relative">
          {/* Settings Button - Positioned absolutely to not affect centering */}
          <button
            onClick={() => {
              const currentBacenta = bacentas.find(b => b.id === bacentaFilter);
              if (currentBacenta) {
                openBacentaForm(currentBacenta);
              }
            }}
            className="absolute top-3 right-3 desktop:top-4 desktop:right-4 flex items-center justify-center w-8 h-8 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors duration-200 shadow-sm"
            title="Configure Bacenta Settings"
            aria-label="Configure Bacenta Settings"
          >
            <CogIcon className="w-4 h-4" />
          </button>

          {/* Centered Content */}
          <div className="text-center">
            <h1 className="text-lg desktop:text-xl desktop-lg:text-2xl font-bold text-blue-900">
              {currentBacentaName}
            </h1>
            <p className="text-sm desktop:text-base text-blue-700 font-medium">
              Bacenta
            </p>
            {/* Meeting Schedule Display */}
            {(() => {
              const currentBacenta = bacentas.find(b => b.id === bacentaFilter);
              if (currentBacenta && (currentBacenta.meetingDay || currentBacenta.meetingTime)) {
                return (
                  <div className="flex items-center justify-center mt-1 text-xs text-blue-600">
                    <CalendarIcon className="w-3 h-3 mr-1" />
                    <span>
                      {currentBacenta.meetingDay && currentBacenta.meetingTime
                        ? `${currentBacenta.meetingDay} ${currentBacenta.meetingTime}`
                        : currentBacenta.meetingDay
                          ? currentBacenta.meetingDay
                          : currentBacenta.meetingTime
                      }
                    </span>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
      )}

      {/* Clean Header */}
      <div className="bg-white rounded-lg desktop:rounded-xl shadow-sm desktop:shadow-md border border-gray-200 p-4 desktop:p-5 desktop-lg:p-6">
        <div className="text-center">
          {/* Title (centered, no icon) */}
          <h2 className="text-xl desktop:text-2xl desktop-lg:text-3xl font-semibold text-gray-900 mb-3">
            {isTithe ? `Tithe for ${currentMonthName}` : `Attendance for ${currentMonthName} ${currentYear}`}
          </h2>
          
          {/* Summary */}
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 mb-3">
            <span>{currentMonthSundays.length} Sunday{currentMonthSundays.length !== 1 ? 's' : ''} in {currentMonthName}</span>
            <span>•</span>
            <span>{activeCount} active member{activeCount !== 1 ? 's' : ''}</span>
          </div>

          {isTithe && (
            <div className="text-center text-sm text-gray-800 font-semibold mb-2">
              Total Tithe: {formatCurrency(totalTithe)}
              <div className="text-xs text-gray-600 font-normal mt-1">Paid: {paidCount} / {activeCount}</div>
              {!isCurrentCalendarMonth && (
                <div className="mt-1 text-[11px] text-gray-500">Past months are view-only. Navigate to the current month to edit.</div>
              )}
            </div>
          )}

          {/* Role Statistics */}
          <div className="flex items-center justify-center gap-5 text-sm mb-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-200">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full"></span>
              <span className="text-green-800 font-semibold">{countBL}</span>
              <span className="text-green-700 text-xs font-medium">BL</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span>
              <span className="text-red-800 font-semibold">{countFL}</span>
              <span className="text-red-700 text-xs font-medium">FL</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200">
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
              <span className="text-blue-800 font-semibold">{countM}</span>
              <span className="text-blue-700 text-xs font-medium">M</span>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center mb-4">
            <div className="inline-flex items-center bg-white border border-gray-300 rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={navigateToPreviousMonth}
                className="flex items-center justify-center w-10 h-10 hover:bg-gray-50 text-gray-700 transition-colors duration-200 border-r border-gray-300"
                aria-label="Previous month"
                title="Previous month"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <button
                onClick={navigateToNextMonth}
                className="flex items-center justify-center w-10 h-10 hover:bg-gray-50 text-gray-700 transition-colors duration-200"
                aria-label="Next month"
                title="Next month"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search, Filter, Frozen Toggle, and Copy */}
          <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3 sm:items-end justify-center">
            <div className="w-full sm:w-64">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search members..."
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
            {/* Tithe-only: Paid Only toggle and Sort */}
            {isTithe && (
              <>
                <div className="w-full sm:w-auto flex items-center justify-center">
                  <label className="inline-flex items-center space-x-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg shadow-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="form-checkbox h-4 w-4 text-emerald-600"
                      checked={showPaidOnly}
                      onChange={(e) => setShowPaidOnly(e.target.checked)}
                    />
                    <span className="text-sm text-gray-700">Show Paid Only</span>
                  </label>
                </div>
                <div className="w-full sm:w-48">
                  <select
                    value={titheSort}
                    onChange={(e) => setTitheSort(e.target.value as any)}
                    className="w-full px-3 py-3 sm:py-2 border border-gray-300 dark:border-dark-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors text-base sm:text-sm bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 text-center cursor-pointer"
                  >
                    <option value="none">Sort: Default</option>
                    <option value="paid">Sort: Paid first</option>
                    <option value="amount_desc">Sort: Amount (High → Low)</option>
                    <option value="amount_asc">Sort: Amount (Low → High)</option>
                  </select>
                </div>
              </>
            )}
            <div className="w-full sm:w-auto flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              {((currentTab?.data as any)?.isTithe === true) ? null : (
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
                      showFrozen,
                      // pass ministry context if active on this tab
                      ministryOnly: (currentTab?.data as any)?.ministryOnly === true,
                      ministryName: (currentTab?.data as any)?.ministryName || null
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
              )}
              {((currentTab?.data as any)?.isTithe === true) ? null : (
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
                      showFrozen,
                      ministryOnly: (currentTab?.data as any)?.ministryOnly === true,
                      ministryName: (currentTab?.data as any)?.ministryName || null
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
              )}
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
  isMinistryContext: boolean;
  transferMemberToConstituencyHandler: (memberId: string, targetConstituencyId: string) => Promise<void>;
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
  updateMemberHandler,
  isMinistryContext,
  // transferMemberToConstituencyHandler
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
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

            {/* Transfer to Constituency (only for native ministry members) */}
            {isMinistryContext && member.isNativeMinistryMember && (
              <button
                onClick={() => {
                  setIsTransferModalOpen(true);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2.5 text-left hover:bg-blue-50 rounded-lg transition-colors duration-150 flex items-start gap-3 text-blue-700"
              >
                <ArrowRightIcon className="w-4 h-4 mt-0.5 text-blue-600" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Transfer to Constituency</div>
                  <div className="text-xs text-gray-500">Move to a specific constituency</div>
                </div>
              </button>
            )}

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

      {/* Transfer Modal */}
      <ConstituencyTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        member={member}
      />
    </div>
  );
};

export default MembersTableView;
