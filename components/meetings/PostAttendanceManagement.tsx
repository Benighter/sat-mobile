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
  TrashIcon
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

        return {
          id: `attendee-${index}`,
          firstName: existingMember?.firstName || firstName || '',
          lastName: existingMember?.lastName || lastName || '',
          fullName: attendeeName,
          phoneNumber: existingMember?.phoneNumber || '',
          address: existingMember?.buildingAddress || '',
          isMember: !!existingMember,
          memberId: existingMember?.id,
          isBornAgain: false,
          isFirstTimer: firstTimerAttendees.includes(attendeeName),
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
          setAttendeeDetails(prev =>
            prev.map(a => a.id === attendeeId ? { ...a, isBornAgain: true } : a)
          );
          showToast('success', `${attendee.fullName} marked as born again`);
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Attendee Management
          </h1>
          <p className="text-sm text-gray-500">
            Click on any name to edit details or use the actions menu
          </p>
        </div>

        {/* Summary Stats - Simple and Clean */}
        {(firstTimerAttendees.length > 0 || convertAttendees.length > 0 || testimonyAttendees.length > 0) && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
            <div className="text-center">
              <div className="text-sm font-medium text-green-800 mb-2">✓ Actions Completed</div>
              <div className="flex justify-center space-x-6 text-xs text-green-700">
                {firstTimerAttendees.length > 0 && (
                  <span>{firstTimerAttendees.length} First Timers</span>
                )}
                {convertAttendees.length > 0 && (
                  <span>{convertAttendees.length} Converts</span>
                )}
                {testimonyAttendees.length > 0 && (
                  <span>{testimonyAttendees.length} Testimonies</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Attendees List - Clean and Minimal */}
        <div className="space-y-3 mb-8">
          {attendeeDetails.map((attendee, index) => (
            <div
              key={attendee.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                {/* Left - Avatar and Name */}
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                    attendee.isMember ? 'bg-green-500' : 'bg-orange-500'
                  }`}>
                    {attendee.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>

                  <div>
                    <button
                      onClick={() => handleAttendeeClick(attendee)}
                      className="text-left hover:text-blue-600 transition-colors"
                    >
                      <div className="font-medium text-gray-900">{attendee.fullName}</div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          attendee.isMember
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {attendee.isMember ? 'Member' : 'Guest'}
                        </span>
                        {attendee.phoneNumber && (
                          <span className="text-xs text-gray-500">{attendee.phoneNumber}</span>
                        )}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Right - Categories and Actions */}
                <div className="flex items-center space-x-3">
                  {/* Categories */}
                  <div className="flex space-x-1">
                    {attendee.isFirstTimer && (
                      <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">First Timer</span>
                    )}
                    {attendee.isConvert && (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">Convert</span>
                    )}
                    {testimonyAttendees.includes(attendee.fullName) && (
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">Testimony</span>
                    )}
                  </div>

                  {/* Action Button */}
                  {getActionButtons(attendee)}
                </div>
              </div>
            </div>
          ))}
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
