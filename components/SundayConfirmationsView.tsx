import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import {
  getUpcomingSunday,
  getNextSunday,
  getPreviousSunday,
  formatFullDate,
  getTodayYYYYMMDD
} from '../utils/dateUtils';
import { hasAdminPrivileges } from '../utils/permissionUtils';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardIcon,
  CheckIcon,
  EditIcon,
  UserPlusIcon,
  UserIcon,
  MinusIcon
} from './icons';
import { Member, Bacenta, Guest } from '../types';
import Dropdown from './ui/Dropdown';
import GuestFormModal from './GuestFormModal';
import GuestConversionModal from './GuestConversionModal';

interface BacentaConfirmation {
  bacenta: Bacenta;
  confirmedMembers: Member[];
  confirmedGuests: Guest[];
  total: number;
}



const SundayConfirmationsView: React.FC = () => {
  const {
    members,
    bacentas,
    sundayConfirmations,
    guests,
    showToast,
    user,
    userProfile,
    isLoading,
    removeConfirmationHandler,
    convertGuestToMemberHandler
  } = useAppContext();

  const [selectedSunday, setSelectedSunday] = useState<string>(getUpcomingSunday());
  const [confirmationTarget, setConfirmationTarget] = useState<number>(members.length);
  const [isEditingTarget, setIsEditingTarget] = useState<boolean>(false);
  const [targetInputValue, setTargetInputValue] = useState<string>(members.length.toString());

  // Guest management state
  const [isGuestModalOpen, setIsGuestModalOpen] = useState<boolean>(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);

  // Guest conversion state
  const [isConversionModalOpen, setIsConversionModalOpen] = useState<boolean>(false);
  const [convertingGuest, setConvertingGuest] = useState<Guest | null>(null);

  // Check if current user is admin
  const isAdmin = hasAdminPrivileges(userProfile);

  // Load target from Firebase on component mount and when selectedSunday changes
  // Everyone can VIEW targets, only admins can EDIT them
  useEffect(() => {
    const loadTarget = async () => {
      if (!user) return;

      try {
        const { db } = await import('../firebase.config');
        const { doc, getDoc } = await import('firebase/firestore');
        const { firebaseUtils } = await import('../services/firebaseService');

        // Get the current church ID (same for admin and leaders in the same church)
        const churchId = firebaseUtils.getCurrentChurchId();
        if (!churchId) {
          throw new Error('No church context available');
        }

        // Use proper church-scoped path
        const targetDocRef = doc(db, `churches/${churchId}/sundayTargets`, selectedSunday);
        const targetDoc = await getDoc(targetDocRef);

        if (targetDoc.exists() && targetDoc.data().target) {
          const target = targetDoc.data().target;
          setConfirmationTarget(target);
          setTargetInputValue(target.toString());
        } else {
          // Default to total member count if no target is set
          const defaultTarget = members.length;
          setConfirmationTarget(defaultTarget);
          setTargetInputValue(defaultTarget.toString());
        }
      } catch (error) {
        console.error('Error loading confirmation target:', error);
        // Fallback to member count
        const defaultTarget = members.length;
        setConfirmationTarget(defaultTarget);
        setTargetInputValue(defaultTarget.toString());
      }
    };

    loadTarget();
  }, [selectedSunday, members.length, user]);

  // Save target to Firebase (admin only)
  const saveTarget = async (newTarget: number) => {
    if (!user) return;

    try {
      const { db } = await import('../firebase.config');
      const { doc, setDoc } = await import('firebase/firestore');
      const { firebaseUtils } = await import('../services/firebaseService');

      // Get the current church ID (same for admin and leaders in the same church)
      const churchId = firebaseUtils.getCurrentChurchId();
      if (!churchId) {
        throw new Error('No church context available');
      }

      // Use proper church-scoped path
      const targetDocRef = doc(db, `churches/${churchId}/sundayTargets`, selectedSunday);
      await setDoc(targetDocRef, {
        target: newTarget,
        date: selectedSunday,
        updatedAt: new Date().toISOString(),
        userId: user.uid,
        setByAdmin: userProfile?.role === 'admin'
      });
      showToast('success', 'Target Updated', `Confirmation target set to ${newTarget}`);
    } catch (error) {
      console.error('Error saving confirmation target:', error);
      showToast('error', 'Error', 'Failed to save confirmation target');
    }
  };

  // Handle target editing (admin only)
  const handleTargetEdit = () => {
    if (!isAdmin) {
      showToast('error', 'Access Denied', 'Only administrators can modify confirmation targets');
      return;
    }
    setIsEditingTarget(true);
  };

  const handleTargetSave = () => {
    if (!isAdmin) {
      showToast('error', 'Access Denied', 'Only administrators can modify confirmation targets');
      return;
    }

    const newTarget = parseInt(targetInputValue);
    if (isNaN(newTarget) || newTarget < 0) {
      showToast('error', 'Invalid Target', 'Please enter a valid number');
      return;
    }

    setConfirmationTarget(newTarget);
    setIsEditingTarget(false);
    saveTarget(newTarget);
  };

  const handleTargetCancel = () => {
    setTargetInputValue(confirmationTarget.toString());
    setIsEditingTarget(false);
  };

  // Guest management handlers
  const handleAddGuest = () => {
    setEditingGuest(null);
    setIsGuestModalOpen(true);
  };

  const handleEditGuest = (guest: Guest) => {
    setEditingGuest(guest);
    setIsGuestModalOpen(true);
  };

  const handleCloseGuestModal = () => {
    setIsGuestModalOpen(false);
    setEditingGuest(null);
  };

  // Confirmation management handlers
  const handleRemoveConfirmation = async (confirmationId: string, name: string) => {
    try {
      await removeConfirmationHandler(confirmationId);
      showToast('success', 'Confirmation Removed', `${name}'s confirmation has been removed`);
    } catch (error) {
      console.error('Failed to remove confirmation:', error);
    }
  };

  // Guest conversion handlers
  const handleConvertGuestToMember = (guest: Guest) => {
    setConvertingGuest(guest);
    setIsConversionModalOpen(true);
  };

  const handleConfirmConversion = async () => {
    if (!convertingGuest) return;

    const guestName = `${convertingGuest.firstName} ${convertingGuest.lastName || ''}`.trim();

    try {
      await convertGuestToMemberHandler(convertingGuest.id);
      setIsConversionModalOpen(false);
      setConvertingGuest(null);
      showToast('success', 'Member Converted', `${guestName} has been converted to a member`);
    } catch (error) {
      console.error('Failed to convert guest to member:', error);
      // Don't close modal on error so user can try again
    }
  };

  const handleCloseConversionModal = () => {
    setIsConversionModalOpen(false);
    setConvertingGuest(null);
  };



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
        confirmedGuests: [],
        total: 0
      });
    });

    // Add a special entry for unassigned members
    bacentaConfirmationMap.set('unassigned', {
      bacenta: { id: 'unassigned', name: 'Unassigned Members' },
      confirmedMembers: [],
      confirmedGuests: [],
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

    // Group confirmed guests by their assigned bacenta
    const confirmedGuests = guests.filter(guest => {
      const guestConfirmation = sundayConfirmations.find(
        conf => conf.guestId === guest.id && conf.date === selectedSunday && conf.status === 'Confirmed'
      );
      return !!guestConfirmation;
    });

    confirmedGuests.forEach(guest => {
      const bacentaId = guest.bacentaId || 'unassigned';
      const confirmation = bacentaConfirmationMap.get(bacentaId);
      if (confirmation) {
        confirmation.confirmedGuests.push(guest);
        confirmation.total++;
      }
    });

    // Convert to array and filter out bacentas with no confirmations
    const confirmationList = Array.from(bacentaConfirmationMap.values())
      .filter(confirmation => confirmation.total > 0)
      .sort((a, b) => a.bacenta.name.localeCompare(b.bacenta.name));

    const grandTotal = confirmationList.reduce((sum, confirmation) => sum + confirmation.total, 0);

    return { confirmationList, grandTotal };
  }, [selectedSunday, sundayConfirmations, members, bacentas, guests]);

  // Copy confirmation data as formatted text
  const copyConfirmationText = async () => {
    try {
      const dateText = formatFullDate(selectedSunday);
      const progressPercentage = Math.round((confirmationData.grandTotal / confirmationTarget) * 100);

      let text = `Sunday Service Confirmations - ${dateText}\n\n`;
      text += `Total Confirmed: ${confirmationData.grandTotal} of ${confirmationTarget} (${progressPercentage}%)\n`;
      text += `Active Bacentas: ${confirmationData.confirmationList.length}\n\n`;

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
          {/* Clean Neutral Header */}
          <div className="bg-gray-50 border-b border-gray-200 pt-8 pb-8 px-6 text-center">
            {/* Title Section */}
            <div className="mb-6">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <CheckIcon className="w-6 h-6 text-gray-600" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Sunday Confirmations</h1>
              <p className="text-gray-600 text-sm">Members confirmed for Sunday service</p>
            </div>

            {/* Clean Date Navigation */}
            <div className="flex items-center justify-center space-x-4 mb-6">
              <button
                onClick={handlePreviousSunday}
                className="flex items-center justify-center w-10 h-10 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors duration-200 shadow-sm"
                title="Previous Sunday"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>

              <div className="text-center px-4 min-w-0 flex-shrink-0">
                <div className="text-lg font-semibold text-gray-900 whitespace-nowrap">{formatFullDate(selectedSunday)}</div>
                <div className="text-sm text-gray-500 whitespace-nowrap">
                  {selectedSunday === getUpcomingSunday() ? 'Upcoming Sunday' : 'Selected Sunday'}
                </div>
              </div>

              <button
                onClick={handleNextSunday}
                disabled={!canGoNext}
                className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors duration-200 shadow-sm ${
                  canGoNext
                    ? 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700'
                    : 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'
                }`}
                title="Next Sunday"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Clean Statistics with Target */}
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="w-full max-w-md mx-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Progress to Target</span>
                  <span className="text-sm font-medium text-gray-900">
                    {Math.round((confirmationData.grandTotal / confirmationTarget) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gray-900 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min((confirmationData.grandTotal / confirmationTarget) * 100, 100)}%`
                    }}
                  ></div>
                </div>
              </div>

              {/* Statistics and Target */}
              <div className="flex flex-col lg:flex-row items-center justify-center space-y-6 lg:space-y-0 lg:space-x-12">
                {/* Statistics */}
                <div className="flex items-center justify-center space-x-12 text-gray-900">
                  <div className="text-center min-w-0">
                    <div className="text-3xl font-bold leading-none mb-2">{confirmationData.grandTotal}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Confirmed</div>
                  </div>
                  <div className="text-center min-w-0">
                    <div className="text-3xl font-bold leading-none mb-2">{confirmationData.confirmationList.length}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Bacentas</div>
                  </div>
                  <div className="text-center min-w-0">
                    <div className="h-12 flex items-center justify-center">
                      {isEditingTarget ? (
                        <div className="flex items-center justify-center space-x-2">
                          <input
                            type="number"
                            value={targetInputValue}
                            onChange={(e) => setTargetInputValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleTargetSave();
                              if (e.key === 'Escape') handleTargetCancel();
                            }}
                            className="w-20 px-2 py-1 text-center border border-gray-300 rounded text-lg font-bold focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                            min="0"
                            autoFocus
                          />
                          <button
                            onClick={handleTargetSave}
                            className="flex items-center justify-center w-8 h-8 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                            title="Save target"
                          >
                            <CheckIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleTargetCancel}
                            className="flex items-center justify-center w-8 h-8 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors text-lg font-bold"
                            title="Cancel"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center space-x-1">
                          <div className="text-3xl font-bold leading-none">{confirmationTarget}</div>
                          {isAdmin ? (
                            <button
                              onClick={handleTargetEdit}
                              className="flex items-center justify-center w-6 h-6 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors ml-1"
                              title="Edit target (Admin only)"
                            >
                              <EditIcon className="w-3 h-3" />
                            </button>
                          ) : (
                            <div
                              className="flex items-center justify-center w-6 h-6 text-gray-300 cursor-not-allowed ml-1"
                              title="Only administrators can modify targets"
                            >
                              <EditIcon className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Target</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-center space-x-3">
                  <button
                    onClick={handleAddGuest}
                    className="flex items-center justify-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
                  >
                    <UserPlusIcon className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">Add Guest</span>
                  </button>

                  <button
                    onClick={copyConfirmationText}
                    className="flex items-center justify-center px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors text-gray-700 shadow-sm"
                  >
                    <ClipboardIcon className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">Copy Confirmations</span>
                  </button>
                </div>
              </div>
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

                        {/* Clean Members and Guests List */}
                        <div className="space-y-2">
                          {/* Members */}
                          {sortedMembers.map((member, index) => {
                            const confirmationId = `${member.id}_${selectedSunday}`;
                            const memberName = `${member.firstName} ${member.lastName || ''}`;

                            return (
                              <div key={`member-${member.id}`} className="flex items-start justify-between">
                                <div className="flex items-start flex-1">
                                  <span className="text-gray-500 text-sm font-medium w-6 pt-0.5">
                                    {index + 1}.
                                  </span>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-gray-900">
                                      {memberName}
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

                                {/* Actions Dropdown */}
                                <Dropdown
                                  items={[
                                    {
                                      id: 'remove',
                                      label: 'Remove Confirmation',
                                      icon: <MinusIcon className="w-4 h-4" />,
                                      onClick: () => handleRemoveConfirmation(confirmationId, memberName),
                                      destructive: true
                                    }
                                  ]}
                                  align="right"
                                />
                              </div>
                            );
                          })}

                          {/* Guests */}
                          {confirmation.confirmedGuests.map((guest, index) => {
                            const confirmationId = `guest_${guest.id}_${selectedSunday}`;
                            const guestName = `${guest.firstName} ${guest.lastName || ''}`;
                            const guestIndex = sortedMembers.length + index + 1;

                            return (
                              <div key={`guest-${guest.id}`} className="flex items-start justify-between">
                                <div className="flex items-start flex-1">
                                  <span className="text-gray-500 text-sm font-medium w-6 pt-0.5">
                                    {guestIndex}.
                                  </span>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-gray-900">
                                      {guestName}
                                    </span>
                                    <span className="inline-flex items-center text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">
                                      <UserPlusIcon className="w-3 h-3 mr-1" />
                                      Guest
                                    </span>
                                    {guest.roomNumber && (
                                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                        Room {guest.roomNumber}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Actions Dropdown */}
                                <Dropdown
                                  items={[
                                    {
                                      id: 'convert',
                                      label: 'Convert to Member',
                                      icon: <UserIcon className="w-4 h-4" />,
                                      onClick: () => handleConvertGuestToMember(guest)
                                    },
                                    {
                                      id: 'edit',
                                      label: 'Edit Guest',
                                      icon: <EditIcon className="w-4 h-4" />,
                                      onClick: () => handleEditGuest(guest)
                                    },
                                    {
                                      id: 'remove',
                                      label: 'Remove Confirmation',
                                      icon: <MinusIcon className="w-4 h-4" />,
                                      onClick: () => handleRemoveConfirmation(confirmationId, guestName),
                                      destructive: true
                                    }
                                  ]}
                                  align="right"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Clean Summary Section */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900 mb-1">
                      {confirmationData.grandTotal} <span className="text-lg font-normal text-gray-500">of {confirmationTarget}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Total confirmations • {Math.round((confirmationData.grandTotal / confirmationTarget) * 100)}% of target
                    </p>

                    {/* Clean progress bar */}
                    <div className="w-full max-w-xs mx-auto bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-gray-900 h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min((confirmationData.grandTotal / confirmationTarget) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Guest Form Modal */}
      <GuestFormModal
        isOpen={isGuestModalOpen}
        onClose={handleCloseGuestModal}
        editingGuest={editingGuest}
      />

      {/* Guest Conversion Modal */}
      <GuestConversionModal
        isOpen={isConversionModalOpen}
        onClose={handleCloseConversionModal}
        onConfirm={handleConfirmConversion}
        guest={convertingGuest}
        bacenta={convertingGuest ? bacentas.find(b => b.id === convertingGuest.bacentaId) || null : null}
        isLoading={isLoading}
      />
    </div>
  );
};

export default SundayConfirmationsView;
