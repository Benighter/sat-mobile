import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import {
  UserIcon,
  UsersIcon,
  EditIcon,
  CheckCircleIcon,
  XCircleIcon,
  EllipsisVerticalIcon,
  ArrowLeftIcon,
  PhoneIcon,
  MapPinIcon,
  HeartIcon,
  StarIcon,
  UserPlusIcon,
  TrashIcon,
  ChatBubbleLeftRightIcon
} from '../icons';
import Button from '../ui/Button';
import AttendeeDetailModal from './AttendeeDetailModal';

interface AttendeeDetails {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phoneNumber: string;
  address: string;
  isMember: boolean;
  memberId?: string;
  isBornAgain: boolean;
  isFirstTimer: boolean;
  isConvert: boolean;
  confirmForService: boolean;
  notes: string;
  meetingDate: string;
  bacentaId: string;
}

interface PostAttendanceManagementProps {
  attendees: string[];
  firstTimerAttendees: string[];
  convertAttendees: string[];
  testimonyAttendees: string[];
  bacentaId: string;
  meetingDate: string;
  onBack: () => void;
  onComplete: () => void;
}

const PostAttendanceManagement: React.FC<PostAttendanceManagementProps> = ({
  attendees,
  firstTimerAttendees,
  convertAttendees,
  testimonyAttendees,
  bacentaId,
  meetingDate,
  onBack,
  onComplete
}) => {
  const { members, addMemberHandler, addNewBelieverHandler, showToast } = useAppContext();
  const [attendeeDetails, setAttendeeDetails] = useState<AttendeeDetails[]>([]);
  const [selectedAttendee, setSelectedAttendee] = useState<AttendeeDetails | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  // Initialize attendee details from the attendance data
  useEffect(() => {
    const initializeAttendees = async () => {
      const details: AttendeeDetails[] = attendees.map((attendeeName, index) => {
        // Enhanced member detection - check multiple variations
        const existingMember = members.find(member => {
          const memberFullName = `${member.firstName} ${member.lastName}`.toLowerCase().trim();
          const attendeeNameLower = attendeeName.toLowerCase().trim();

          // Exact match
          if (memberFullName === attendeeNameLower) return true;

          // Check if attendee name contains member name or vice versa
          const memberParts = memberFullName.split(' ');
          const attendeeParts = attendeeNameLower.split(' ');

          // Check if all member name parts are in attendee name
          const memberInAttendee = memberParts.every(part =>
            attendeeParts.some(attendeePart => attendeePart.includes(part) || part.includes(attendeePart))
          );

          return memberInAttendee;
        });

        const [firstName, ...lastNameParts] = attendeeName.trim().split(' ');
        const lastName = lastNameParts.join(' ');

        const isMember = !!existingMember;
        const isFirstTimer = firstTimerAttendees.includes(attendeeName);

        return {
          id: `attendee-${index}`,
          firstName: existingMember?.firstName || firstName || '',
          lastName: existingMember?.lastName || lastName || '',
          fullName: attendeeName,
          phoneNumber: existingMember?.phoneNumber || '',
          address: existingMember?.buildingAddress || '',
          isMember,
          memberId: existingMember?.id,
          isBornAgain: false,
          isFirstTimer,
          isConvert: convertAttendees.includes(attendeeName),
          confirmForService: false,
          notes: '',
          meetingDate,
          bacentaId
        };
      });

      setAttendeeDetails(details);

      // Automatically add converts as new believers if they're not already members
      if (convertAttendees.length > 0) {
        const newBelieverPromises = convertAttendees.map(async (convertName) => {
          const existingMember = members.find(member => {
            const memberFullName = `${member.firstName} ${member.lastName}`.toLowerCase();
            return memberFullName === convertName.toLowerCase();
          });

          // Only add as new believer if they're not already a member
          if (!existingMember) {
            const [firstName, ...lastNameParts] = convertName.trim().split(' ');
            const lastName = lastNameParts.join(' ');

            try {
              await addNewBelieverHandler({
                firstName: firstName || '',
                lastName: lastName || '',
                phoneNumber: '',
                buildingAddress: '',
                bacentaId: bacentaId,
                createdDate: meetingDate,
                notes: `Converted during meeting on ${meetingDate}`
              });
            } catch (error) {
              console.error(`Failed to add ${convertName} as new believer:`, error);
            }
          }
        });

        await Promise.all(newBelieverPromises);
      }
    };

    initializeAttendees();
  }, [attendees, firstTimerAttendees, convertAttendees, members, meetingDate, bacentaId, addNewBelieverHandler]);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuOpen) {
        setActionMenuOpen(null);
        setMenuPosition(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [actionMenuOpen]);

  const handleAttendeeClick = (attendee: AttendeeDetails) => {
    setSelectedAttendee(attendee);
    setShowDetailModal(true);
  };

  const handleSaveAttendeeDetails = (updatedAttendee: AttendeeDetails) => {
    setAttendeeDetails(prev =>
      prev.map(a => a.id === updatedAttendee.id ? updatedAttendee : a)
    );
    setShowDetailModal(false);
    showToast('success', 'Attendee details updated successfully');
  };

  const handleQuickAction = async (attendeeId: string, action: string) => {
    const attendee = attendeeDetails.find(a => a.id === attendeeId);
    if (!attendee) return;

    setLoading(true);
    try {
      switch (action) {
        case 'mark_born_again':
          // Update local state
          setAttendeeDetails(prev =>
            prev.map(a => a.id === attendeeId ? { ...a, isBornAgain: true, isConvert: true } : a)
          );

          // Add to new believers (sons of God) if not already a member
          if (!attendee.isMember) {
            try {
              await addNewBelieverHandler({
                name: attendee.firstName,
                surname: attendee.lastName || '',
                contact: attendee.phoneNumber || '',
                dateOfBirth: '',
                residence: attendee.address || '',
                studies: '',
                campus: '',
                occupation: '',
                year: '',
                isFirstTime: attendee.isFirstTimer,
                ministry: '',
                joinedDate: meetingDate
              });
              showToast('success', `${attendee.fullName} marked as born again and added to Sons of God!`);
            } catch (error) {
              console.error('Failed to add to new believers:', error);
              showToast('warning', `${attendee.fullName} marked as born again, but failed to add to Sons of God. Please add manually.`);
            }
          } else {
            showToast('success', `${attendee.fullName} marked as born again`);
          }
          break;

        case 'mark_first_timer':
          setAttendeeDetails(prev =>
            prev.map(a => a.id === attendeeId ? { ...a, isFirstTimer: true } : a)
          );
          showToast('success', `${attendee.fullName} marked as first timer`);
          break;

        case 'convert_to_member':
          if (attendee.firstName && attendee.lastName && attendee.phoneNumber) {
            await convertToMember(attendee);
          } else {
            showToast('error', 'Please complete all required fields (name and phone) before converting to member.');
          }
          break;

        case 'mark_testimony':
          // Toggle testimony status
          if (testimonyAttendees.includes(attendee.fullName)) {
            setTestimonyAttendees(prev => prev.filter(name => name !== attendee.fullName));
            showToast('success', `${attendee.fullName} removed from testimonies`);
          } else {
            setTestimonyAttendees(prev => [...prev, attendee.fullName]);
            showToast('success', `${attendee.fullName} marked as gave testimony`);
          }
          break;

        case 'remove':
          setAttendeeDetails(prev => prev.filter(a => a.id !== attendeeId));
          showToast('success', `${attendee.fullName} removed from attendance`);
          break;
      }
    } catch (error) {
      showToast('error', 'Failed to perform action');
    } finally {
      setLoading(false);
      setActionMenuOpen(null);
      setMenuPosition(null);
    }
  };

  const convertToMember = async (attendee: AttendeeDetails) => {
    try {
      await addMemberHandler({
        firstName: attendee.firstName,
        lastName: attendee.lastName,
        phoneNumber: attendee.phoneNumber,
        buildingAddress: attendee.address,
        bacentaId: attendee.bacentaId,
        role: 'Member',
        ministry: '',
        frozen: false,
        notes: `Converted from guest on ${attendee.meetingDate}. ${attendee.notes}`.trim()
      });

      // Update the attendee to reflect they're now a member
      setAttendeeDetails(prev =>
        prev.map(a => a.id === attendee.id ? { ...a, isMember: true } : a)
      );

      showToast('success', `${attendee.fullName} successfully converted to member!`);
    } catch (error) {
      showToast('error', 'Failed to convert to member');
      throw error;
    }
  };



  const handleActionMenuClick = (attendee: AttendeeDetails, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const isMenuOpen = actionMenuOpen === attendee.id;

    if (isMenuOpen) {
      setActionMenuOpen(null);
      setMenuPosition(null);
    } else {
      setActionMenuOpen(attendee.id);
      setMenuPosition({
        top: rect.top - 10, // Position above the button
        left: rect.left - 200 + rect.width // Align to the right of the button
      });
    }
  };

  const getActionButtons = (attendee: AttendeeDetails) => {
    return (
      <button
        onClick={(e) => handleActionMenuClick(attendee, e)}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <EllipsisVerticalIcon className="w-4 h-4 text-gray-400 hover:text-gray-600" />
      </button>
    );
  };

  return (
    <div
      className="min-h-screen bg-gray-50"
      onClick={() => {
        setActionMenuOpen(null);
        setMenuPosition(null);
      }}
    >
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Attendance Summary
          </h1>
          <p className="text-sm text-gray-500">
            Review attendance and manage attendee details
          </p>
        </div>

        {/* Attendance Summary Cards */}
        <div className="mb-8">
          {/* Always show Total Attendees */}
          <div className="grid grid-cols-1 gap-4 mb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-900">{attendeeDetails.length}</div>
              <div className="text-sm text-blue-600">Total Attendees</div>
            </div>
          </div>

          {/* Show spiritual categories only if there are attendees in them */}
          {(firstTimerAttendees.length > 0 || convertAttendees.length > 0 || testimonyAttendees.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {firstTimerAttendees.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-900">{firstTimerAttendees.length}</div>
                  <div className="text-sm text-yellow-600">First Timers</div>
                </div>
              )}
              {convertAttendees.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-900">{convertAttendees.length}</div>
                  <div className="text-sm text-green-600">New Believers</div>
                </div>
              )}
              {testimonyAttendees.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-900">{testimonyAttendees.length}</div>
                  <div className="text-sm text-purple-600">Testimonies</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Numbered Attendance List */}
        <div className="mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <UsersIcon className="w-4 h-4 text-blue-600" />
              </div>
              Attendees ({attendeeDetails.length})
            </h3>
            <div className="space-y-2">
              {attendeeDetails.map((attendee, index) => (
                <div key={attendee.id} className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-500 w-6">{index + 1}.</span>
                    <button
                      onClick={() => handleAttendeeClick(attendee)}
                      className="text-left hover:text-blue-600 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{attendee.fullName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          attendee.isMember
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {attendee.isMember ? 'Member' : 'Guest'}
                        </span>
                      </div>
                      {attendee.phoneNumber && (
                        <span className="text-xs text-gray-500">({attendee.phoneNumber})</span>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center space-x-2">
                    {attendee.isFirstTimer && (
                      <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">First Timer</span>
                    )}
                    {attendee.isBornAgain && (
                      <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">Born Again</span>
                    )}
                    {attendee.isConvert && (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">New Believer</span>
                    )}
                    {testimonyAttendees.includes(attendee.fullName) && (
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">Testimony</span>
                    )}
                    {getActionButtons(attendee)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons - Clean and Simple */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
          <button
            onClick={onBack}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Back
          </button>
          <button
            onClick={onComplete}
            className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            Complete & Return to Meetings
          </button>
        </div>
      </div>

      {/* Floating Action Menu - Clean and Minimal */}
      {actionMenuOpen && menuPosition && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            minWidth: '180px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-1">
            {(() => {
              const attendee = attendeeDetails.find(a => a.id === actionMenuOpen);
              if (!attendee) return null;

              return (
                <>
                  <button
                    onClick={() => {
                      handleAttendeeClick(attendee);
                      setActionMenuOpen(null);
                      setMenuPosition(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <EditIcon className="w-4 h-4 text-gray-500" />
                    <span>Edit Details</span>
                  </button>

                  {!attendee.isBornAgain && (
                    <button
                      onClick={() => handleQuickAction(attendee.id, 'mark_born_again')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <HeartIcon className="w-4 h-4 text-red-500" />
                      <span>Mark as Born Again</span>
                    </button>
                  )}

                  {!attendee.isFirstTimer && (
                    <button
                      onClick={() => handleQuickAction(attendee.id, 'mark_first_timer')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <StarIcon className="w-4 h-4 text-yellow-500" />
                      <span>Mark as First Timer</span>
                    </button>
                  )}

                  {!attendee.isMember && attendee.firstName && attendee.lastName && (
                    <button
                      onClick={() => handleQuickAction(attendee.id, 'convert_to_member')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <UserPlusIcon className="w-4 h-4 text-green-500" />
                      <span>Convert to Member</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleQuickAction(attendee.id, 'mark_testimony')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <ChatBubbleLeftRightIcon className="w-4 h-4 text-blue-500" />
                    <span>
                      {testimonyAttendees.includes(attendee.fullName) ? 'Remove Testimony' : 'Mark Testimony'}
                    </span>
                  </button>

                  <div className="border-t border-gray-100 my-1"></div>

                  <button
                    onClick={() => handleQuickAction(attendee.id, 'remove')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2 text-red-600"
                  >
                    <TrashIcon className="w-4 h-4" />
                    <span>Remove</span>
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Attendee Detail Modal */}
      {showDetailModal && selectedAttendee && (
        <AttendeeDetailModal
          attendee={selectedAttendee}
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          onSave={handleSaveAttendeeDetails}
          onConvertToMember={convertToMember}
        />
      )}
    </div>
  );
};

export default PostAttendanceManagement;
