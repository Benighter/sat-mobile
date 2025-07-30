import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { 
  getUpcomingSunday,
  getNextSunday, 
  getPreviousSunday, 
  formatFullDate,
  getTodayYYYYMMDD 
} from '../utils/dateUtils';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  UsersIcon,
  ClipboardIcon,
  CheckIcon
} from './icons';
import { Member, Bacenta } from '../types';

interface BacentaConfirmation {
  bacenta: Bacenta;
  confirmedMembers: Member[];
  total: number;
}

const SundayConfirmationsView: React.FC = () => {
  const {
    members,
    bacentas,
    sundayConfirmations,
    showToast
  } = useAppContext();

  const [selectedSunday, setSelectedSunday] = useState<string>(getUpcomingSunday());

  // Calculate confirmation data for the selected Sunday
  const confirmationData = useMemo(() => {
    // Get all confirmation records for the selected Sunday
    const sundayRecords = sundayConfirmations.filter(
      record => record.date === selectedSunday && record.status === 'Confirmed'
    );

    // Get confirmed member IDs
    const confirmedMemberIds = sundayRecords.map(record => record.memberId);

    // Get confirmed members
    const confirmedMembers = members.filter(member => confirmedMemberIds.includes(member.id));

    // Group by bacenta
    const bacentaConfirmationMap = new Map<string, BacentaConfirmation>();

    // Initialize all bacentas
    bacentas.forEach(bacenta => {
      bacentaConfirmationMap.set(bacenta.id, {
        bacenta,
        confirmedMembers: [],
        total: 0
      });
    });

    // Add a special entry for unassigned members
    bacentaConfirmationMap.set('unassigned', {
      bacenta: { id: 'unassigned', name: 'Unassigned Members' },
      confirmedMembers: [],
      total: 0
    });

    // Group confirmed members by bacenta
    confirmedMembers.forEach(member => {
      const bacentaId = member.bacentaId || 'unassigned';
      const confirmation = bacentaConfirmationMap.get(bacentaId);
      if (confirmation) {
        confirmation.confirmedMembers.push(member);
        confirmation.total++;
      }
    });

    // Convert to array and filter out bacentas with no confirmations
    const confirmationList = Array.from(bacentaConfirmationMap.values())
      .filter(confirmation => confirmation.total > 0)
      .sort((a, b) => a.bacenta.name.localeCompare(b.bacenta.name));

    const grandTotal = confirmationList.reduce((sum, confirmation) => sum + confirmation.total, 0);

    return { confirmationList, grandTotal };
  }, [selectedSunday, sundayConfirmations, members, bacentas]);

  // Copy confirmation data as formatted text
  const copyConfirmationText = async () => {
    try {
      const dateText = formatFullDate(selectedSunday);
      let text = `Sunday Service Confirmations - ${dateText}\n\n`;

      if (confirmationData.confirmationList.length === 0) {
        text += 'No confirmations recorded for this Sunday.';
      } else {
        // Helper function to get role priority for sorting
        const getRolePriority = (role: string | undefined) => {
          switch (role) {
            case 'Bacenta Leader': return 1;
            case 'Fellowship Leader': return 2;
            case 'Member': return 3;
            default: return 4;
          }
        };

        confirmationData.confirmationList.forEach((confirmation, index) => {
          text += `${confirmation.bacenta.name}\n`;
          text += '='.repeat(confirmation.bacenta.name.length) + '\n';

          const sortedMembers = [...confirmation.confirmedMembers].sort((a, b) => {
            const rolePriorityA = getRolePriority(a.role);
            const rolePriorityB = getRolePriority(b.role);

            if (rolePriorityA !== rolePriorityB) {
              return rolePriorityA - rolePriorityB;
            }

            return (a.lastName || '').localeCompare(b.lastName || '') || a.firstName.localeCompare(b.firstName);
          });

          // Add confirmed members with role indicators
          sortedMembers.forEach((member, memberIndex) => {
            let roleIndicator = '';
            if (member.role === 'Bacenta Leader') {
              roleIndicator = ' 💚';
            } else if (member.role === 'Fellowship Leader') {
              roleIndicator = ' ❤️';
            }
            text += `${memberIndex + 1}. ${member.firstName} ${member.lastName || ''}${roleIndicator}\n`;
          });

          text += `Total: ${confirmation.total}\n`;

          // Add spacing between bacentas (except for the last one)
          if (index < confirmationData.confirmationList.length - 1) {
            text += '\n';
          }
        });

        text += `\nGrand Total: ${confirmationData.grandTotal}`;
      }

      await navigator.clipboard.writeText(text);
      showToast('success', 'Copied!', 'Sunday confirmations copied to clipboard');
    } catch (error) {
      console.error('Failed to copy text:', error);
      showToast('error', 'Copy Failed', 'Unable to copy to clipboard');
    }
  };

  // Navigation handlers
  const handlePreviousSunday = () => {
    setSelectedSunday(getPreviousSunday(selectedSunday));
  };

  const handleNextSunday = () => {
    setSelectedSunday(getNextSunday(selectedSunday));
  };

  // Check if we can navigate to next Sunday (don't go too far into future)
  const today = getTodayYYYYMMDD();
  const nextSundayDate = getNextSunday(selectedSunday);
  const canGoNext = nextSundayDate <= getNextSunday(getNextSunday(today)); // Allow up to 2 weeks ahead

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Clean Paper-like Container */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Clean Header */}
          <div className="bg-green-500 pt-8 pb-8 px-6 text-center">
            {/* Title Section */}
            <div className="mb-6">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <CheckIcon className="w-6 h-6 text-white" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Sunday Confirmations</h1>
              <p className="text-green-100 text-sm">Members confirmed for Sunday service</p>
            </div>

            {/* Clean Date Navigation */}
            <div className="flex items-center justify-center space-x-4 mb-6">
              <button
                onClick={handlePreviousSunday}
                className="flex items-center justify-center w-28 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors duration-200"
              >
                <ChevronLeftIcon className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">Previous</span>
              </button>

              <div className="text-center px-4">
                <div className="text-lg font-semibold text-white">{formatFullDate(selectedSunday)}</div>
                <div className="text-sm text-green-100">
                  {selectedSunday === getUpcomingSunday() ? 'Upcoming Sunday' : 'Selected Sunday'}
                </div>
              </div>

              <button
                onClick={handleNextSunday}
                disabled={!canGoNext}
                className={`flex items-center justify-center w-28 py-2 rounded-lg transition-colors duration-200 ${
                  canGoNext
                    ? 'bg-white/20 hover:bg-white/30 text-white'
                    : 'bg-white/10 text-white/50 cursor-not-allowed'
                }`}
              >
                <span className="text-sm font-medium">Next</span>
                <ChevronRightIcon className="w-4 h-4 ml-1" />
              </button>
            </div>

            {/* Clean Statistics and Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
              {/* Statistics */}
              <div className="flex space-x-4 text-white">
                <div className="text-center">
                  <div className="text-2xl font-bold">{confirmationData.grandTotal}</div>
                  <div className="text-xs text-green-100">Confirmed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{confirmationData.confirmationList.length}</div>
                  <div className="text-xs text-green-100">Bacentas</div>
                </div>
              </div>

              {/* Copy Button */}
              <button
                onClick={copyConfirmationText}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors duration-200"
                title="Copy confirmations as text"
              >
                <ClipboardIcon className="w-4 h-4" />
                <span className="text-sm font-medium">Copy Confirmations</span>
              </button>
            </div>
          </div>

          {/* Clean Confirmation Content */}
          <div className="p-6">
            {confirmationData.confirmationList.length === 0 ? (
              <div className="text-center py-12">
                <CheckIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No Confirmations Yet</h3>
                <p className="text-gray-500 text-sm mb-6">
                  No members have confirmed attendance for this Sunday.
                </p>
                <div className="bg-green-50 rounded-lg p-4 border border-green-100 max-w-md mx-auto">
                  <p className="text-green-700 text-sm">
                    Members can confirm their attendance by clicking the confirmation button
                    in the Members table or their individual member cards.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Clean Confirmation List */}
                <div className="divide-y divide-gray-100">
                  {confirmationData.confirmationList.map((confirmation, bacentaIndex) => {
                    // Sort members by role priority
                    const getRolePriority = (role: string | undefined) => {
                      switch (role) {
                        case 'Bacenta Leader': return 1;
                        case 'Fellowship Leader': return 2;
                        case 'Member': return 3;
                        default: return 4;
                      }
                    };

                    const sortedMembers = [...confirmation.confirmedMembers].sort((a, b) => {
                      const rolePriorityA = getRolePriority(a.role);
                      const rolePriorityB = getRolePriority(b.role);

                      if (rolePriorityA !== rolePriorityB) {
                        return rolePriorityA - rolePriorityB;
                      }

                      return (a.lastName || '').localeCompare(b.lastName || '') || a.firstName.localeCompare(b.firstName);
                    });

                    return (
                      <div key={confirmation.bacenta.id} className={`py-4 ${bacentaIndex > 0 ? 'pt-6' : ''}`}>
                        {/* Clean Bacenta Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                              <span className="text-white font-bold">
                                {confirmation.bacenta.name.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">{confirmation.bacenta.name}</h3>
                              <p className="text-sm text-gray-500">Bacenta Community</p>
                            </div>
                          </div>
                          <div className="bg-green-100 text-green-800 px-3 py-1 rounded-lg">
                            <span className="text-lg font-bold">{confirmation.total}</span>
                            <span className="text-sm ml-1">confirmed</span>
                          </div>
                        </div>

                        {/* Clean Members List */}
                        <div className="space-y-2">
                          {sortedMembers.map((member, index) => (
                            <div key={member.id} className="flex items-start">
                              <span className="text-gray-500 text-sm font-medium w-6 pt-0.5">
                                {index + 1}.
                              </span>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-gray-900">
                                  {member.firstName} {member.lastName || ''}
                                </span>
                                {member.role === 'Bacenta Leader' && (
                                  <span className="inline-flex items-center text-xs text-green-700">
                                    <span className="mr-1">💚</span>
                                    <span className="hidden sm:inline">Bacenta Leader</span>
                                  </span>
                                )}
                                {member.role === 'Fellowship Leader' && (
                                  <span className="inline-flex items-center text-xs text-red-700">
                                    <span className="mr-1">❤️</span>
                                    <span className="hidden sm:inline">Fellowship Leader</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Clean Grand Total */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Total Confirmed</h3>
                    <span className="text-2xl font-semibold text-green-600">{confirmationData.grandTotal}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Total confirmations across all bacentas for {formatFullDate(selectedSunday)}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SundayConfirmationsView;
