import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { Member } from '../../types';
import { ArrowLeftIcon, ClipboardIcon, ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from '../icons';
import Button from '../ui/Button';
import { useNavigation } from '../../hooks/useNavigation';
import { formatDisplayDate, getSundaysOfMonth, getMonthName, formatDateToYYYYMMDD, getCurrentOrMostRecentSunday } from '../../utils/dateUtils';

interface CopyOptions {
  includeNames: boolean;
  includeSurnames: boolean;
  includePhones: boolean;
}

const CopyAbsenteesView: React.FC = () => {
  const { 
    members, 
    bacentas, 
    attendanceRecords,
    showToast,
    currentTab 
  } = useAppContext();

  // All data fields are now always included by default (UI selectors removed)
  const options: CopyOptions = {
    includeNames: true,
    includeSurnames: true,
    includePhones: true
  };
  const [isCopying, setIsCopying] = useState(false);
  const { navigateBack } = useNavigation();
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentOrMostRecentSunday());
  const [displayedDate, setDisplayedDate] = useState(new Date());

  // Get the current bacenta filter from navigation context
  const bacentaFilter = currentTab.data?.bacentaFilter || null;
  const searchTerm = currentTab.data?.searchTerm || '';
  const roleFilter = currentTab.data?.roleFilter || 'all';
  const ministryOnly: boolean = currentTab.data?.ministryOnly === true;
  const ministryName: string | null = currentTab.data?.ministryName || null;

  // Get bacenta name if filtering by bacenta
  const getBacentaName = (bacentaId: string) => {
    if (!bacentaId) return null;
    const bacenta = bacentas.find(b => b.id === bacentaId);
    return bacenta?.name || 'Unknown Bacenta';
  };

  const currentBacentaName = bacentaFilter ? getBacentaName(bacentaFilter) : null;

  // Unified back handled by global header BackButton and gestures
  const handleBack = () => navigateBack();

  // Get displayed month's Sundays (only past and current Sundays)
  const currentMonthSundays = useMemo(() => {
    const allSundays = getSundaysOfMonth(displayedDate.getFullYear(), displayedDate.getMonth());
    const today = formatDateToYYYYMMDD(new Date());

    // Only show Sundays that have already occurred (not future dates)
    return allSundays.filter(sunday => sunday <= today);
  }, [displayedDate]);

  // Navigation handlers for month
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

  // Filter members based on current context (same logic as MembersTableView)
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
      .filter(member => !member.frozen) // exclude frozen from any copying context
      .filter(member => {
        // Filter by bacenta if specified
        if (bacentaFilter && member.bacentaId !== bacentaFilter) {
          return false;
        }

        // Filter by ministry if requested
        if (ministryOnly) {
          if (!(member.ministry && member.ministry.trim() !== '')) return false;
          if (ministryName && (member.ministry || '').toLowerCase() !== ministryName.toLowerCase()) return false;
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
        const lastNameA = a.lastName || '';
        const lastNameB = b.lastName || '';
        return lastNameA.localeCompare(lastNameB) || a.firstName.localeCompare(b.firstName);
      });
  }, [members, bacentaFilter, searchTerm, roleFilter, ministryOnly, ministryName]);

  // Get absentee members for the selected date
  const absenteeMembers = useMemo(() => {
    // Get attendance records for the selected date
    const dateAttendanceRecords = attendanceRecords.filter(record => 
      record.date === selectedDate && record.memberId // Only member records, not new believers
    );

    // Get member IDs who were present
    const presentMemberIds = dateAttendanceRecords
      .filter(record => record.status === 'Present')
      .map(record => record.memberId!);

    // Get member IDs who were explicitly marked absent
    const explicitlyAbsentMemberIds = dateAttendanceRecords
      .filter(record => record.status === 'Absent')
      .map(record => record.memberId!);

    // A member is absent if:
    // 1. They have no attendance record for this date, OR
    // 2. They are explicitly marked as absent
    return filteredMembers.filter(member => {
      if (member.frozen) return false; // exclude frozen from absentees
      const hasAttendanceRecord = dateAttendanceRecords.some(record => record.memberId === member.id);
      const isPresent = presentMemberIds.includes(member.id);
      const isExplicitlyAbsent = explicitlyAbsentMemberIds.includes(member.id);
      
      return !isPresent && (isExplicitlyAbsent || !hasAttendanceRecord);
    });
  }, [filteredMembers, attendanceRecords, selectedDate]);

  // If no members available, show a message
  if (members.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-6">
        <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4 mb-6">
            <button
              onClick={handleBack}
              className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-sm transition-colors"
              title="Go back"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Copy Absentees</h1>
              <p className="text-sm text-gray-600">No members available</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-500">No members found to check for absentees.</p>
            <Button
              variant="primary"
              onClick={handleBack}
              className="mt-4"
            >
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Always include all member types since we removed the member type filter
  const getFilteredAbsenteesByType = () => {
    return absenteeMembers; // Include all absentees regardless of role
  };

  // Generate the text to copy (always grouped by bacenta)
  const generateCopyText = () => {
    const absenteesToProcess = getFilteredAbsenteesByType();
    const lines: string[] = [];

    // Always group absentees by bacenta
    const absenteesByBacenta = absenteesToProcess.reduce((acc, member) => {
      const bacentaId = member.bacentaId || 'unassigned';
      if (!acc[bacentaId]) {
        acc[bacentaId] = [];
      }
      acc[bacentaId].push(member);
      return acc;
    }, {} as Record<string, Member[]>);

    // Sort bacentas alphabetically
    const sortedBacentaIds = Object.keys(absenteesByBacenta).sort((a, b) => {
      const nameA = a === 'unassigned' ? 'Unassigned Members' : (getBacentaName(a) || 'Unknown Bacenta');
      const nameB = b === 'unassigned' ? 'Unassigned Members' : (getBacentaName(b) || 'Unknown Bacenta');
      return nameA.localeCompare(nameB);
    });

    let globalCounter = 1;

    sortedBacentaIds.forEach((bacentaId, bacentaIndex) => {
      const bacentaAbsentees = absenteesByBacenta[bacentaId];
      const bacentaName = bacentaId === 'unassigned' ? 'Unassigned Members' : (getBacentaName(bacentaId) || 'Unknown Bacenta');

      // Add bacenta header
      lines.push(`${bacentaName} Bacenta`);

      // Process absentees in this bacenta
      bacentaAbsentees.forEach((member) => {
        const parts: string[] = [];

        // Always add numbering (default behavior)
        parts.push(`${globalCounter}.`);

        if (options.includeNames && member.firstName) {
          parts.push(member.firstName.trim());
        }

        if (options.includeSurnames && member.lastName && member.lastName.trim()) {
          parts.push(member.lastName.trim());
        }

        if (options.includePhones && member.phoneNumber && member.phoneNumber !== '-' && member.phoneNumber.trim()) {
          parts.push(member.phoneNumber.trim());
        }

        const line = parts.join(' ');
        if (line.trim()) {
          lines.push(line);
          globalCounter++;
        }
      });

      // Add empty line between bacentas (except for the last one)
      if (bacentaIndex < sortedBacentaIds.length - 1) {
        lines.push('');
      }
    });

    return lines.join('\n');
  };

  // Handle copy to clipboard
  const handleCopy = async () => {
    setIsCopying(true);
    
    try {
      const textToCopy = generateCopyText();
      
      if (!textToCopy.trim()) {
        showToast('warning', 'No Data', 'No absentee data to copy with current settings.');
        setIsCopying(false);
        return;
      }

      await navigator.clipboard.writeText(textToCopy);
      
      const filteredCount = getFilteredAbsenteesByType().length;
      showToast('success', 'Copied!', `${filteredCount} absentee${filteredCount !== 1 ? 's' : ''} copied to clipboard.`);
      
      // Navigate back to the previous view
      handleBack();
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      showToast('error', 'Copy Failed', 'Failed to copy to clipboard. Please try again.');
    } finally {
      setIsCopying(false);
    }
  };

  // Preview text
  const previewText = generateCopyText();
  const previewLines = previewText.split('\n').slice(0, 10);
  const hasMoreLines = previewText.split('\n').length > 10;
  const absenteeCount = getFilteredAbsenteesByType().length;

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Back Button */}
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={handleBack}
            className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-sm transition-colors"
            title="Go back"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Copy Absentees</h1>
            <p className="text-sm text-gray-600">
              {ministryOnly ? (ministryName ? `${ministryName} Ministry` : 'All Ministries') : (currentBacentaName ? `${currentBacentaName} Bacenta` : 'All Members')} • {formatDisplayDate(selectedDate)} • {absenteeCount} absentee{absenteeCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Date Selection Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Date</h3>
          
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={navigateToPreviousMonth}
              className="flex items-center justify-center w-10 h-10 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors duration-200 shadow-sm"
              aria-label="Previous month"
              title="Previous month"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            
            <div className="text-center">
              <h4 className="text-lg font-semibold text-gray-900">
                {getMonthName(displayedDate.getMonth())} {displayedDate.getFullYear()}
              </h4>
            </div>
            
            <button
              onClick={navigateToNextMonth}
              className="flex items-center justify-center w-10 h-10 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors duration-200 shadow-sm"
              aria-label="Next month"
              title="Next month"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Sunday Selection */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {currentMonthSundays.map((sunday) => (
              <button
                key={sunday}
                onClick={() => setSelectedDate(sunday)}
                className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                  selectedDate === sunday
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center space-x-1">
                  <CalendarIcon className="w-4 h-4" />
                  <span>{formatDisplayDate(sunday)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {/* Preview Panel (Data fields & format option cards removed) */}
          <div className="space-y-6">
            {/* Preview Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
              {previewText ? (
                <>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-80 overflow-y-auto">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                      {previewLines.join('\n')}
                      {hasMoreLines && '\n...'}
                    </pre>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    {absenteeCount} absentee{absenteeCount !== 1 ? 's' : ''} will be copied for {formatDisplayDate(selectedDate)}
                    {hasMoreLines && ` (showing first 10 lines)`}
                  </p>
                </>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                  <p className="text-gray-500">No absentees to preview with current settings</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                variant="primary"
                onClick={handleCopy}
                disabled={isCopying || !previewText.trim()}
                className="w-full flex items-center justify-center space-x-2 py-3"
                size="lg"
              >
                {isCopying ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Copying...</span>
                  </>
                ) : (
                  <>
                    <ClipboardIcon className="w-5 h-5" />
                    <span>Copy to Clipboard</span>
                  </>
                )}
              </Button>

              <Button
                variant="secondary"
                onClick={handleBack}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CopyAbsenteesView;
