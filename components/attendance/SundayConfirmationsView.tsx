import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import {
  getUpcomingSunday,
  getNextSunday,
  getPreviousSunday,
  formatCompactDate,
  getTodayYYYYMMDD
} from '../../utils/dateUtils';
import { hasAdminPrivileges } from '../../utils/permissionUtils';
import { db } from '../../firebase.config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firebaseUtils } from '../../services/firebaseService';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardIcon,
  CheckIcon,
  EditIcon,
  UserPlusIcon,
  UserIcon,
  MinusIcon
} from '../icons';
import { Member, Bacenta, Guest } from '../../types';
import Dropdown from '../ui/Dropdown';
import GuestFormModal from '../modals/forms/GuestFormModal';
import GuestConversionModal from '../new-believers/GuestConversionModal';
import CopyConfirmationsModal from '../modals/confirmations/CopyConfirmationsModal';

// Grouping model aligned to WeeklyAttendanceView
interface LinkedBacentaGroup {
  bacenta: Bacenta | { id: string; name: string };
  members: Member[];
  guests?: Guest[];
  total: number; // members + guests
}

interface FellowshipGroup {
  fellowshipLeader: Member; // role: Fellowship Leader
  bacenta: Bacenta | { id: string; name: string };
  members: Member[];
  guests: Guest[];
  linkedBacentaGroups: LinkedBacentaGroup[];
  total: number;
}

interface BacentaLeaderGroup {
  bacentaLeader: Member; // role: Bacenta Leader
  bacenta: Bacenta | { id: string; name: string };
  mainMembers: Member[]; // confirmed members in leader bacenta (excluding fellowship leaders)
  guests: Guest[]; // confirmed guests in leader bacenta
  fellowshipGroups: FellowshipGroup[];
  linkedBacentaGroups: LinkedBacentaGroup[];
  total: number; // sum of all contained items
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
    currentChurchId,
    isLoading,
    removeConfirmationHandler,
    removeGuestConfirmationHandler,
    convertGuestToMemberHandler
  } = useAppContext();

  const [selectedSunday, setSelectedSunday] = useState<string>(getUpcomingSunday());
  const [confirmationTarget, setConfirmationTarget] = useState<number>(0);
  const [isEditingTarget, setIsEditingTarget] = useState<boolean>(false);
  const [targetInputValue, setTargetInputValue] = useState<string>('0');
  const [isLoadingTarget, setIsLoadingTarget] = useState<boolean>(true);

  // Guest management state
  const [isGuestModalOpen, setIsGuestModalOpen] = useState<boolean>(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);

  // Guest conversion state
  const [isConversionModalOpen, setIsConversionModalOpen] = useState<boolean>(false);
  const [convertingGuest, setConvertingGuest] = useState<Guest | null>(null);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState<boolean>(false);

  // Check if current user is admin
  const isAdmin = hasAdminPrivileges(userProfile);

  // Load target from Firebase on component mount and when selectedSunday changes
  // Everyone can VIEW targets, only admins can EDIT them
  useEffect(() => {
    const loadTarget = async () => {
      if (!user) {
        setIsLoadingTarget(false);
        return;
      }

      setIsLoadingTarget(true);
      try {

        // Get the current church ID (same for admin and leaders in the same church)
        const churchId = firebaseUtils.getCurrentChurchId();
        if (!churchId) {
          console.warn('No church context available yet, will retry when available');
          setIsLoadingTarget(false);
          return;
        }

        // Validate inputs before making Firestore request
        if (!selectedSunday || selectedSunday.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(selectedSunday)) {
          console.error('Invalid selectedSunday format:', selectedSunday);
          setIsLoadingTarget(false);
          return;
        }

        console.log('Loading target for:', { churchId, selectedSunday });

        // Use proper church-scoped path
        const targetDocRef = doc(db, `churches/${churchId}/sundayTargets`, selectedSunday);
        const targetDoc = await getDoc(targetDocRef);

        if (targetDoc.exists() && targetDoc.data().target) {
          const target = targetDoc.data().target;
          setConfirmationTarget(target);
          setTargetInputValue(target.toString());
        } else {
          // Default to total member count if no target is set
          // Only use members.length if we actually have members loaded
          const defaultTarget = members.length > 0 ? members.length : 0;
          setConfirmationTarget(defaultTarget);
          setTargetInputValue(defaultTarget.toString());
        }
      } catch (error: any) {
        console.error('Error loading confirmation target:', {
          error: error.message,
          code: error.code,
          stack: error.stack,
          churchId: firebaseUtils.getCurrentChurchId(),
          selectedSunday
        });
        // Fallback to member count, but only if we have members loaded
        const defaultTarget = members.length > 0 ? members.length : 0;
        setConfirmationTarget(defaultTarget);
        setTargetInputValue(defaultTarget.toString());
      } finally {
        setIsLoadingTarget(false);
      }
    };

    // Only load target if we have user and either members are loaded or we're not using them as fallback
    if (user) {
      loadTarget();
    }
  }, [selectedSunday, user, members.length, currentChurchId]); // Added members.length and currentChurchId as dependencies

  // Save target to Firebase (admin only)
  const saveTarget = async (newTarget: number) => {
    if (!user) return;

    try {

      // Get the current church ID (same for admin and leaders in the same church)
      const churchId = firebaseUtils.getCurrentChurchId();
      if (!churchId) {
        throw new Error('No church context available');
      }

      // Validate inputs before making Firestore request
      if (!selectedSunday || selectedSunday.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(selectedSunday)) {
        throw new Error(`Invalid selectedSunday format: ${selectedSunday}`);
      }

      if (typeof newTarget !== 'number' || newTarget < 0 || !Number.isInteger(newTarget)) {
        throw new Error(`Invalid target value: ${newTarget}`);
      }

      console.log('Saving target:', { churchId, selectedSunday, newTarget });

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
    } catch (error: any) {
      console.error('Error saving confirmation target:', {
        error: error.message,
        code: error.code,
        stack: error.stack,
        churchId: firebaseUtils.getCurrentChurchId(),
        selectedSunday,
        newTarget
      });
      showToast('error', 'Error', `Failed to save confirmation target: ${error.message}`);
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

  const handleRemoveGuestConfirmation = async (guestId: string, name: string) => {
    try {
      await removeGuestConfirmationHandler(guestId, selectedSunday);
      showToast('success', 'Guest Confirmation Removed', `${name}'s confirmation has been removed`);
    } catch (error) {
      console.error('Failed to remove guest confirmation:', error);
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

  // Copy modal handlers
  const openCopyModal = () => setIsCopyModalOpen(true);
  const closeCopyModal = () => setIsCopyModalOpen(false);



  // Calculate grouped confirmation data (structure matches WeeklyAttendance)
  const confirmationData = useMemo(() => {
    // All confirmed records this Sunday
    const sundayRecords = sundayConfirmations.filter(
      r => r.date === selectedSunday && r.status === 'Confirmed'
    );

    // Confirmed members (excluding frozen)
    const confirmedMemberIds = new Set(
      sundayRecords.filter(r => r.memberId).map(r => r.memberId as string)
    );
    const confirmedMembers = members.filter(m => !m.frozen && confirmedMemberIds.has(m.id));

    // Confirmed guests
    const confirmedGuestIds = new Set(
      sundayRecords.filter(r => r.guestId).map(r => r.guestId as string)
    );
    const confirmedGuests = guests.filter(g => confirmedGuestIds.has(g.id));

    // Lookups
    const bacentaMap = new Map<string, Bacenta>();
    bacentas.forEach(b => bacentaMap.set(b.id, b));

    const membersByBacenta = new Map<string, Member[]>();
    confirmedMembers.forEach(m => {
      const key = m.bacentaId || 'unassigned';
      if (!membersByBacenta.has(key)) membersByBacenta.set(key, []);
      membersByBacenta.get(key)!.push(m);
    });

    const guestsByBacenta = new Map<string, Guest[]>();
    confirmedGuests.forEach(g => {
      const key = g.bacentaId || 'unassigned';
      if (!guestsByBacenta.has(key)) guestsByBacenta.set(key, []);

      // Check for duplicates before adding - deduplicate by name within the same bacenta
      const existingGuests = guestsByBacenta.get(key)!;
      const isDuplicate = existingGuests.some(existing =>
        existing.firstName.toLowerCase().trim() === g.firstName.toLowerCase().trim() &&
        (existing.lastName || '').toLowerCase().trim() === (g.lastName || '').toLowerCase().trim()
      );

      if (!isDuplicate) {
        guestsByBacenta.get(key)!.push(g);
      } else {
        console.log(`Skipping duplicate guest in display: ${g.firstName} ${g.lastName || ''} (ID: ${g.id})`);
      }
    });

    // Include all bacenta leaders (like WeeklyAttendance) to keep structure, then filter empty groups
    const allBacentaLeaders = members.filter(m => m.role === 'Bacenta Leader');

    const groups: BacentaLeaderGroup[] = allBacentaLeaders.map(leader => {
      const leaderBacenta = leader.bacentaId
        ? bacentaMap.get(leader.bacentaId) || { id: leader.bacentaId, name: 'Unknown Bacenta' }
        : { id: 'unassigned', name: 'Unassigned' };

      const allInLeaderBacenta = membersByBacenta.get(leader.bacentaId) || [];
      const mainMembers = allInLeaderBacenta.filter(m => m.role !== 'Fellowship Leader');
      const mainGuests = guestsByBacenta.get(leader.bacentaId || 'unassigned') || [];

      // Fellowship leaders under this bacenta leader
      const fellowshipLeaders = members.filter(m => m.role === 'Fellowship Leader' && m.bacentaLeaderId === leader.id);
      const fellowshipGroups: FellowshipGroup[] = fellowshipLeaders.map(fl => {
        const flBacenta = fl.bacentaId
          ? bacentaMap.get(fl.bacentaId) || { id: fl.bacentaId, name: 'Unknown Bacenta' }
          : { id: 'unassigned', name: 'Unassigned' };
        const membersInFellowship = membersByBacenta.get(fl.bacentaId) || [];
        const guestsInFellowship = guestsByBacenta.get(fl.bacentaId || 'unassigned') || [];

        // Linked bacentas for fellowship leader
        const linkedGroups: LinkedBacentaGroup[] = (fl.linkedBacentaIds || [])
          .filter(id => id && id !== fl.bacentaId)
          .map(id => {
            const b = bacentaMap.get(id) || { id, name: 'Unknown Bacenta' };
            const membersInLinked = (membersByBacenta.get(id) || []).filter(m => m.id !== fl.id);
            const guestsInLinked = guestsByBacenta.get(id) || [];
            const total = membersInLinked.length + guestsInLinked.length;
            return { bacenta: b, members: membersInLinked, guests: guestsInLinked, total };
          })
          .filter(g => g.total > 0)
          .sort((a, b) => a.bacenta.name.localeCompare(b.bacenta.name));

        const total = membersInFellowship.length + guestsInFellowship.length + linkedGroups.reduce((s, g) => s + g.total, 0);
        return {
          fellowshipLeader: fl,
          bacenta: flBacenta,
          members: membersInFellowship.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '') || a.firstName.localeCompare(b.firstName)),
          guests: guestsInFellowship,
          linkedBacentaGroups: linkedGroups,
          total
        };
      }).sort((a, b) => a.bacenta.name.localeCompare(b.bacenta.name));

      // Linked bacentas for bacenta leader
      const linkedBacentaGroups: LinkedBacentaGroup[] = (leader.linkedBacentaIds || [])
        .filter(id => id && id !== leader.bacentaId)
        .map(id => {
          const b = bacentaMap.get(id) || { id, name: 'Unknown Bacenta' };
          const membersInLinked = (membersByBacenta.get(id) || []).filter(m => m.id !== leader.id);
          const guestsInLinked = guestsByBacenta.get(id) || [];
          const total = membersInLinked.length + guestsInLinked.length;
          return { bacenta: b, members: membersInLinked, guests: guestsInLinked, total };
        })
        .filter(g => g.total > 0)
        .sort((a, b) => a.bacenta.name.localeCompare(b.bacenta.name));

      const total = mainMembers.length + mainGuests.length
        + fellowshipGroups.reduce((s, g) => s + g.total, 0)
        + linkedBacentaGroups.reduce((s, g) => s + g.total, 0);

      return {
        bacentaLeader: leader,
        bacenta: leaderBacenta,
        mainMembers: mainMembers.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '') || a.firstName.localeCompare(b.firstName)),
        guests: mainGuests,
        fellowshipGroups,
        linkedBacentaGroups,
        total
      };
    })
    .filter(g => g.total > 0)
    .sort((a, b) => a.bacenta.name.localeCompare(b.bacenta.name));

    const grandTotal = groups.reduce((sum, g) => sum + g.total, 0);

    return { groups, grandTotal };
  }, [selectedSunday, sundayConfirmations, members, bacentas, guests]);

  // Copy handled via CopyConfirmationsModal

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
        {/* Professional Container */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Professional Header */}
          <div className="bg-white border-b border-gray-200 pt-8 pb-8 px-6 text-center">
            {/* Title Section */}
            <div className="mb-6">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                  <CheckIcon className="w-6 h-6 text-slate-600" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Sunday Confirmations</h1>
              <p className="text-gray-600 text-sm">Members confirmed for Sunday service</p>
            </div>

            {/* Professional Date Navigation - Optimized for Full Date Display */}
            <div className="flex items-center justify-center mb-6 px-2 sm:px-4">
              <div className="flex items-center w-full max-w-sm sm:max-w-md lg:max-w-lg">
                <button
                  onClick={handlePreviousSunday}
                  className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 text-gray-700 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md flex-shrink-0"
                  title="Previous Sunday"
                >
                  <ChevronLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                <div className="text-center flex-1 min-w-0 mx-3 sm:mx-4">
                  <div className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 leading-tight">
                    {formatCompactDate(selectedSunday)}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-0.5">
                    {selectedSunday === getUpcomingSunday() ? 'Upcoming Sunday' : 'Selected Sunday'}
                  </div>
                </div>

                <button
                  onClick={handleNextSunday}
                  disabled={!canGoNext}
                  className={`flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl transition-all duration-200 shadow-sm flex-shrink-0 ${
                    canGoNext
                      ? 'bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 text-gray-700 hover:shadow-md'
                      : 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  title="Next Sunday"
                >
                  <ChevronRightIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

            {/* Professional Statistics with Target */}
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="w-full max-w-md mx-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Progress to Target</span>
                  <span className="text-sm font-medium text-gray-900">
                    {isLoadingTarget ? '...' : `${Math.round((confirmationData.grandTotal / (confirmationTarget || 1)) * 100)}%`}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-slate-600 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: isLoadingTarget ? '0%' : `${Math.min((confirmationData.grandTotal / (confirmationTarget || 1)) * 100, 100)}%`
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
                    <div className="text-3xl font-bold leading-none mb-2">{confirmationData.groups.length}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Bacentas</div>
                  </div>
                  <div className="text-center min-w-0">
                    <div className="h-12 flex items-center justify-center">
                      {isEditingTarget ? (
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            value={targetInputValue}
                            onChange={(e) => setTargetInputValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleTargetSave();
                              if (e.key === 'Escape') handleTargetCancel();
                            }}
                            className="w-14 px-1 py-0.5 text-center border border-gray-300 bg-white text-gray-900 rounded text-2xl font-bold focus:ring-1 focus:ring-slate-500 focus:border-transparent transition-all duration-200"
                            min="0"
                            autoFocus
                          />
                          <button
                            onClick={handleTargetSave}
                            className="flex items-center justify-center w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded-full transition-all duration-200 shadow-sm"
                            title="Save target"
                          >
                            <CheckIcon className="w-3 h-3" />
                          </button>
                          <button
                            onClick={handleTargetCancel}
                            className="flex items-center justify-center w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all duration-200 shadow-sm"
                            title="Cancel"
                          >
                            <span className="text-xs font-bold leading-none">×</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center space-x-1">
                          {isLoadingTarget ? (
                            <div className="text-3xl font-bold leading-none text-gray-400">...</div>
                          ) : (
                            <div className="text-3xl font-bold leading-none">{confirmationTarget}</div>
                          )}
                          {isAdmin ? (
                            <button
                              onClick={handleTargetEdit}
                              disabled={isLoadingTarget}
                              className="flex items-center justify-center w-6 h-6 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200 ml-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="flex items-center justify-center px-5 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-all duration-200 shadow-sm"
                  >
                    <UserPlusIcon className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">Add Guest</span>
                  </button>

                  <button
                    onClick={openCopyModal}
                    className="flex items-center justify-center px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-all duration-200 text-gray-700 shadow-sm"
                  >
                    <ClipboardIcon className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">Copy Confirmations</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Confirmation Content aligned to Weekly Attendance structure */}
          <div className="p-6">
            {confirmationData.groups.length === 0 ? (
              <div className="text-center py-12">
                <CheckIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No Confirmations Yet</h3>
                <p className="text-gray-500 text-sm mb-6">
                  No members have confirmed attendance for this Sunday.
                </p>
                <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200 max-w-md mx-auto">
                  <p className="text-emerald-700 text-sm">
                    Members can confirm their attendance by clicking the confirmation button
                    in the Members table or their individual member cards.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Grouped Confirmation List (same structure as Weekly Attendance) */}
                <div className="space-y-10">
                  {confirmationData.groups.map(group => (
                    <div key={group.bacentaLeader.id} className="border border-gray-200 rounded-xl p-4 shadow-sm">
                      {/* Bacenta Leader Section */}
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                          <span className="mr-2 text-xl">💚</span>
                          Bacenta leader: {group.bacentaLeader.firstName} {group.bacentaLeader.lastName || ''} ({group.bacenta.name})
                        </h3>
                        <ol className="mt-2 space-y-1 list-decimal pl-6">
                          {group.mainMembers.map(m => {
                            const confirmationId = `${m.id}_${selectedSunday}`;
                            const memberName = `${m.firstName} ${m.lastName || ''}`;
                            return (
                              <li key={m.id} className="text-gray-800">
                                <span className="inline-flex w-full items-center justify-between">
                                  <span>{memberName}</span>
                                  <Dropdown
                                    items={[{
                                      id: 'remove',
                                      label: 'Remove Confirmation',
                                      icon: <MinusIcon className="w-4 h-4" />,
                                      onClick: () => handleRemoveConfirmation(confirmationId, memberName),
                                      destructive: true
                                    }]}
                                    align="right"
                                    position="above"
                                  />
                                </span>
                              </li>
                            );
                          })}
                        </ol>
                        {group.guests.length > 0 && (
                          <div className="mt-3">
                            <h5 className="text-sm font-semibold text-blue-600">Guests</h5>
                            <ol className="mt-1 space-y-1 list-decimal pl-6">
                              {group.guests.map((guest) => {
                                const guestName = `${guest.firstName} ${guest.lastName || ''}`;
                                return (
                                  <li key={guest.id} className="text-gray-800">
                                    <span className="inline-flex w-full items-center justify-between">
                                      <span>{guestName} <span className="text-xs text-blue-500">(Guest)</span></span>
                                      <Dropdown
                                        items={[
                                          { id: 'convert', label: 'Convert to Member', icon: <UserIcon className="w-4 h-4" />, onClick: () => handleConvertGuestToMember(guest) },
                                          { id: 'edit', label: 'Edit Guest', icon: <EditIcon className="w-4 h-4" />, onClick: () => handleEditGuest(guest) },
                                          { id: 'remove', label: 'Remove Confirmation', icon: <MinusIcon className="w-4 h-4" />, onClick: () => handleRemoveGuestConfirmation(guest.id, guestName), destructive: true },
                                        ]}
                                        align="right"
                                        position="above"
                                      />
                                    </span>
                                  </li>
                                );
                              })}
                            </ol>
                          </div>
                        )}
                      </div>

                      {/* Linked Bacentas under Bacenta Leader */}
                      {group.linkedBacentaGroups && group.linkedBacentaGroups.map(lg => (
                        <div key={lg.bacenta.id} className="mb-4">
                          <h4 className="font-medium text-gray-900 flex items-center">
                            <span className="mr-2 text-lg">❤</span>
                            {lg.bacenta.name}
                          </h4>
                          <ol className="mt-2 space-y-1 list-decimal pl-6">
                            {lg.members.map(m => {
                              const confirmationId = `${m.id}_${selectedSunday}`;
                              const memberName = `${m.firstName} ${m.lastName || ''}`;
                              return (
                                <li key={m.id} className="text-gray-800">
                                  <span className="inline-flex w-full items-center justify-between">
                                    <span>{memberName}</span>
                                    <Dropdown
                                      items={[{ id: 'remove', label: 'Remove Confirmation', icon: <MinusIcon className="w-4 h-4" />, onClick: () => handleRemoveConfirmation(confirmationId, memberName), destructive: true }]}
                                      align="right"
                                      position="above"
                                    />
                                  </span>
                                </li>
                              );
                            })}
                            {(lg.guests || []).map(g => {
                              const guestName = `${g.firstName} ${g.lastName || ''}`;
                              return (
                                <li key={g.id} className="text-gray-800">
                                  <span className="inline-flex w-full items-center justify-between">
                                    <span>{guestName} <span className="text-xs text-blue-500">(Guest)</span></span>
                                    <Dropdown
                                      items={[
                                        { id: 'convert', label: 'Convert to Member', icon: <UserIcon className="w-4 h-4" />, onClick: () => handleConvertGuestToMember(g) },
                                        { id: 'edit', label: 'Edit Guest', icon: <EditIcon className="w-4 h-4" />, onClick: () => handleEditGuest(g) },
                                        { id: 'remove', label: 'Remove Confirmation', icon: <MinusIcon className="w-4 h-4" />, onClick: () => handleRemoveGuestConfirmation(g.id, guestName), destructive: true },
                                      ]}
                                      align="right"
                                      position="above"
                                    />
                                  </span>
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      ))}

                      {/* Fellowship Leader Groups */}
                      {group.fellowshipGroups.map(fg => (
                        <div key={fg.fellowshipLeader.id} className="mb-4 last:mb-0">
                          <h4 className="font-medium text-gray-900 flex items-center">
                            <span className="mr-2 text-lg">❤️</span>
                            Fellowship leader: {fg.fellowshipLeader.firstName} {fg.fellowshipLeader.lastName || ''} ({fg.bacenta.name})
                          </h4>
                          <ol className="mt-2 space-y-1 list-decimal pl-6">
                            {fg.members.map(m => {
                              const confirmationId = `${m.id}_${selectedSunday}`;
                              const memberName = `${m.firstName} ${m.lastName || ''}`;
                              return (
                                <li key={m.id} className="text-gray-800">
                                  <span className="inline-flex w-full items-center justify-between">
                                    <span>{memberName}</span>
                                    <Dropdown
                                      items={[{ id: 'remove', label: 'Remove Confirmation', icon: <MinusIcon className="w-4 h-4" />, onClick: () => handleRemoveConfirmation(confirmationId, memberName), destructive: true }]}
                                      align="right"
                                      position="above"
                                    />
                                  </span>
                                </li>
                              );
                            })}
                            {fg.guests.map(g => {
                              const guestName = `${g.firstName} ${g.lastName || ''}`;
                              return (
                                <li key={g.id} className="text-gray-800">
                                  <span className="inline-flex w-full items-center justify-between">
                                    <span>{guestName} <span className="text-xs text-blue-500">(Guest)</span></span>
                                    <Dropdown
                                      items={[
                                        { id: 'convert', label: 'Convert to Member', icon: <UserIcon className="w-4 h-4" />, onClick: () => handleConvertGuestToMember(g) },
                                        { id: 'edit', label: 'Edit Guest', icon: <EditIcon className="w-4 h-4" />, onClick: () => handleEditGuest(g) },
                                        { id: 'remove', label: 'Remove Confirmation', icon: <MinusIcon className="w-4 h-4" />, onClick: () => handleRemoveGuestConfirmation(g.id, guestName), destructive: true },
                                      ]}
                                      align="right"
                                      position="above"
                                    />
                                  </span>
                                </li>
                              );
                            })}
                          </ol>
                          {/* Linked bacentas under Fellowship Leader */}
                          {fg.linkedBacentaGroups && fg.linkedBacentaGroups.map(lg => (
                            <div key={lg.bacenta.id} className="mt-3">
                              <h5 className="font-medium text-gray-800 flex items-center">
                                <span className="mr-2 text-base">❤</span>
                                {lg.bacenta.name}
                              </h5>
                              <ol className="mt-1 space-y-1 list-decimal pl-6">
                                {lg.members.map(m => {
                                  const confirmationId = `${m.id}_${selectedSunday}`;
                                  const memberName = `${m.firstName} ${m.lastName || ''}`;
                                  return (
                                    <li key={m.id} className="text-gray-800">
                                      <div className="flex items-center justify-between">
                                        <span>{memberName}</span>
                                        <Dropdown
                                          items={[{ id: 'remove', label: 'Remove Confirmation', icon: <MinusIcon className="w-4 h-4" />, onClick: () => handleRemoveConfirmation(confirmationId, memberName), destructive: true }]}
                                          align="right"
                                          position="above"
                                        />
                                      </div>
                                    </li>
                                  );
                                })}
                                {(lg.guests || []).map(g => {
                                  const guestName = `${g.firstName} ${g.lastName || ''}`;
                                  return (
                                    <li key={g.id} className="text-gray-800">
                                      <div className="flex items-center justify-between">
                                        <span>{guestName} <span className="text-xs text-blue-500">(Guest)</span></span>
                                        <Dropdown
                                          items={[
                                            { id: 'convert', label: 'Convert to Member', icon: <UserIcon className="w-4 h-4" />, onClick: () => handleConvertGuestToMember(g) },
                                            { id: 'edit', label: 'Edit Guest', icon: <EditIcon className="w-4 h-4" />, onClick: () => handleEditGuest(g) },
                                            { id: 'remove', label: 'Remove Confirmation', icon: <MinusIcon className="w-4 h-4" />, onClick: () => handleRemoveGuestConfirmation(g.id, guestName), destructive: true },
                                          ]}
                                          align="right"
                                          position="above"
                                        />
                                      </div>
                                    </li>
                                  );
                                })}
                              </ol>
                            </div>
                          ))}
                        </div>
                      ))}

                      <div className="mt-4 text-sm font-semibold text-gray-700">Total: {group.total}</div>
                    </div>
                  ))}
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

      {/* Copy Confirmations Modal */}
      <CopyConfirmationsModal
        isOpen={isCopyModalOpen}
        onClose={closeCopyModal}
        selectedSunday={selectedSunday}
        groups={confirmationData.groups as any}
      />
    </div>
  );
};

export default SundayConfirmationsView;
