import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { OutreachMember } from '../../types';
import Button from '../ui/Button';
import ConfirmationModal from '../modals/confirmations/ConfirmationModal';
// removed inline form components after switching to modal
import Badge from '../ui/Badge';
import { PlusIcon, CheckIcon, ExclamationTriangleIcon, TrashIcon, UserIcon, PhoneIcon, XMarkIcon, FilterIcon, ClipboardIcon } from '../icons';
import Input from '../ui/Input';
import BulkOutreachAddModal from './BulkOutreachAddModal';
import AddOutreachMemberModal from './AddOutreachMemberModal';
import EditOutreachMemberModal from './EditOutreachMemberModal';
import { getUpcomingSunday } from '../../utils/dateUtils';

interface BacentaOutreachViewProps {
  bacentaId: string;
}

const BacentaOutreachView: React.FC<BacentaOutreachViewProps> = ({ bacentaId }) => {
  const {
    bacentas,
    allOutreachMembers,
    updateOutreachMemberHandler,
    deleteOutreachMemberHandler,
    convertOutreachMemberToPermanentHandler,
    showToast
  } = useAppContext();

  // replaced inline form with modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingMember, setEditingMember] = useState<OutreachMember | null>(null);

  const bacenta = bacentas.find(b => b.id === bacentaId);

  // Get all outreach members for this bacenta (no week filtering)
  const allMembers = useMemo(() => {
    return allOutreachMembers.filter(m => m.bacentaId === bacentaId);
  }, [allOutreachMembers, bacentaId]);

  const currentSunday = getUpcomingSunday();

  const isComingThisWeek = (member: OutreachMember) => {
    return !!(member.comingStatus && member.comingStatusSunday === currentSunday);
  };

  // removed old handleAdd - handled in modal

  const handleToggleComing = async (member: OutreachMember) => {
    const currentlyComing = isComingThisWeek(member);
    const newComingStatus = !currentlyComing;

    try {
      await updateOutreachMemberHandler(member.id, {
        comingStatus: newComingStatus,
        comingStatusSunday: currentSunday,
        notComingReason: newComingStatus ? undefined : 'Changed to not coming',
      });
      showToast('success', 'Status updated');
    } catch (error) {
      showToast('error', 'Failed to update status');
    }
  };

  const handleConvert = async (member: OutreachMember) => {
    if (member.convertedMemberId) return;
    try {
      await convertOutreachMemberToPermanentHandler(member.id);
      showToast('success', 'Member converted successfully');
    } catch (error) {
      showToast('error', 'Failed to convert member');
    }
  };

  const [pendingDelete, setPendingDelete] = useState<OutreachMember | null>(null);
  const handleDelete = (member: OutreachMember) => {
    setPendingDelete(member);
  };
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteOutreachMemberHandler(pendingDelete.id);
      showToast('success', 'Member deleted');
    } catch (error) {
      showToast('error', 'Failed to delete member');
    } finally {
      setPendingDelete(null);
    }
  };

  // Filtering state
  const [search, setSearch] = useState('');
  const [showSonsOfGod, setShowSonsOfGod] = useState(false);
  const [showComingOnly, setShowComingOnly] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allMembers.filter(m => {
      if (showSonsOfGod && !m.sonOfGodId) return false;
      if (showComingOnly && !isComingThisWeek(m)) return false;
      if (!term) return true;
      const haystack = [
        m.name,
        m.roomNumber || '',
        (m.phoneNumbers||[]).join(' '),
        m.notComingReason || ''
      ].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [allMembers, search, showSonsOfGod, showComingOnly]);

  // Copy phone number to clipboard
  const handleCopyPhone = async (phoneNumber: string) => {
    try {
      // Try modern clipboard API first, fallback to legacy method
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(phoneNumber);
      } else {
        // Fallback for environments where clipboard API is not available
        const textarea = document.createElement('textarea');
        textarea.value = phoneNumber;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      showToast('success', 'Copied!', `${phoneNumber} copied to clipboard.`);
    } catch (error) {
      console.error('Failed to copy phone number:', error);
      showToast('error', 'Copy Failed', 'Failed to copy phone number to clipboard.');
    }
  };

  // Copy functionality
  const handleCopyOutreachMembers = async () => {
    setIsCopying(true);

    try {
      if (filteredMembers.length === 0) {
        showToast('warning', 'No Data', 'No outreach members to copy with current filters.');
        setIsCopying(false);
        return;
      }

      const lines: string[] = [];

      filteredMembers.forEach((member, index) => {
        const parts: string[] = [];

        // Add number
        parts.push(`${index + 1}.`);

        // Add name
        if (member.name) {
          parts.push(member.name.trim());
        }

        // Add room number
        if (member.roomNumber && member.roomNumber.trim()) {
          parts.push(`Room ${member.roomNumber.trim()}`);
        }

        // Add phone number
        if (member.phoneNumbers && member.phoneNumbers.length > 0 && member.phoneNumbers[0].trim()) {
          parts.push(member.phoneNumbers[0].trim());
        }

        const line = parts.join(' ');
        if (line.trim()) {
          lines.push(line);
        }
      });

      const textToCopy = lines.join('\n');

      if (!textToCopy.trim()) {
        showToast('warning', 'No Data', 'No outreach member data to copy.');
        setIsCopying(false);
        return;
      }

      // Try modern clipboard API first, fallback to legacy method
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Fallback for environments where clipboard API is not available
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      showToast('success', 'Copied!', `${filteredMembers.length} outreach member${filteredMembers.length !== 1 ? 's' : ''} copied to clipboard.`);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      showToast('error', 'Copy Failed', 'Failed to copy to clipboard. Please try again.');
    } finally {
      setIsCopying(false);
    }
  };

  if (!bacenta) {
    return <div className="p-8 text-center text-gray-500">Bacenta not found</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col items-center text-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-rose-500 to-amber-500 bg-clip-text text-transparent">
            {bacenta.name} Outreach
          </h2>
          <p className="text-sm text-gray-500 dark:text-dark-300 mt-1">All outreach members for this building</p>
        </div>
      </div>

      {/* Add member button/form */}
      <div className="flex justify-center gap-3 flex-wrap">
        <Button
          onClick={() => setShowAddModal(true)}
          leftIcon={<PlusIcon className="w-4 h-4" />}
          className="bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white border-0 shadow-lg"
        >
          Add Outreach Member
        </Button>
        <Button
          onClick={() => setShowBulkModal(true)}
          variant="secondary"
        >
          Bulk Add
        </Button>
        <Button
          onClick={handleCopyOutreachMembers}
          leftIcon={<ClipboardIcon className="w-4 h-4" />}
          variant="secondary"
          disabled={isCopying || filteredMembers.length === 0}
        >
          {isCopying ? 'Copying...' : 'Copy List'}
        </Button>
      </div>

      {/* Members table with filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span>Outreach Members</span>
              <span className="text-sm font-normal text-gray-500">{filteredMembers.length} / {allMembers.length}</span>
            </h3>
            <div className="text-xs text-gray-500">All time outreach contacts</div>
          </div>
          {/* Filter Bar */}
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
            <div className="flex-1 flex items-center gap-2">
              <div className="relative w-full">
                <Input
                  value={search}
                  onChange={setSearch}
                  placeholder="Search name, room, phone, reason..."
                  aria-label="Search outreach members"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSonsOfGod(s => !s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${showSonsOfGod ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-white hover:bg-gray-100 border-gray-300 text-gray-600'}`}
              >
                Sons of God
              </button>
              <button
                type="button"
                onClick={() => setShowComingOnly(s => !s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${showComingOnly ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white hover:bg-gray-100 border-gray-300 text-gray-600'}`}
              >
                Coming
              </button>
              {(showSonsOfGod || showComingOnly || search) && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setShowSonsOfGod(false); setShowComingOnly(false); }}
                  className="px-3 py-1.5 rounded-full text-sm font-medium border bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-300"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {allMembers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <UserIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">No outreach members yet</p>
            <p className="text-sm">Add some members using the button above!</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <FilterIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No matches for current filters</p>
            <p className="text-xs mt-1">Adjust or clear filters to see members.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {/* Sticky number column */}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12 sticky left-0 z-20 bg-gray-50">#</th>
                  {/* Sticky name column with smaller width */}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px] w-[140px] sticky left-12 z-20 bg-gray-50">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMembers.map((member, index) => (
                  <tr key={member.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-blue-50/50 transition-colors duration-200`}>
                    {/* Sticky number cell */}
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center w-12 sticky left-0 z-10 bg-white">
                      {index + 1}
                    </td>
                    {/* Sticky name cell with reduced footprint */}
                    <td className="px-4 py-4 whitespace-nowrap min-w-[120px] w-[140px] sticky left-12 z-10 bg-white">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-7 w-7">
                          <div className="h-7 w-7 rounded-full bg-gradient-to-r from-rose-400 to-amber-400 flex items-center justify-center">
                            <span className="text-xs font-medium text-white">
                              {member.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-3 min-w-0">
                          <button
                            className="text-left text-sm font-medium text-blue-600 hover:underline truncate"
                            title="Edit outreach member"
                            onClick={() => setEditingMember(member)}
                          >
                            {member.name.split(' ')[0]}
                          </button>
                          {member.convertedMemberId && (
                            <div className="text-xs text-purple-600 font-medium">✓ Converted</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {member.phoneNumbers?.[0] ? (
                        <div className="flex items-center text-sm text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                             onClick={() => handleCopyPhone(member.phoneNumbers![0])}
                             title="Click to copy phone number">
                          <PhoneIcon className="w-4 h-4 mr-2 text-gray-400" />
                          {member.phoneNumbers[0]}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {member.roomNumber || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <Badge color={isComingThisWeek(member) ? 'green' : 'red'} size="sm">
                        {isComingThisWeek(member) ? 'Coming' : 'Not Coming'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                      <div
                        className="truncate"
                        title={member.comingStatusSunday === currentSunday && member.notComingReason ? member.notComingReason : ''}
                      >
                        {member.comingStatusSunday === currentSunday && member.notComingReason && !isComingThisWeek(member)
                          ? member.notComingReason
                          : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleComing(member)}
                          title={isComingThisWeek(member) ? 'Mark as not coming' : 'Mark as coming'}
                          className="p-1.5"
                        >
                          {isComingThisWeek(member)
                            ? <ExclamationTriangleIcon className="w-4 h-4 text-orange-500" />
                            : <CheckIcon className="w-4 h-4 text-green-500" />}
                        </Button>

                        {!member.convertedMemberId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleConvert(member)}
                            title="Convert to permanent member"
                            className="p-1.5"
                          >
                            <UserIcon className="w-4 h-4 text-blue-500" />
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(member)}
                          title="Delete member"
                          className="p-1.5"
                        >
                          <TrashIcon className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <BulkOutreachAddModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        bacentaId={bacentaId}
        bacentaName={bacenta?.name}
      />
      <AddOutreachMemberModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        bacentaId={bacentaId}
        bacentaName={bacenta?.name}
      />
      <EditOutreachMemberModal
        isOpen={!!editingMember}
        onClose={() => setEditingMember(null)}
        member={editingMember}
        bacentaName={bacenta?.name}
      />
      {/* Delete confirmation */}
      <ConfirmationModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Outreach Member"
        message={pendingDelete ? `Remove ${pendingDelete.name} from this week's outreach list?` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
};

export default BacentaOutreachView;
