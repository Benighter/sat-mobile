import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../../contexts/FirebaseAppContext';
import { hasAdminPrivileges } from '../../../utils/permissionUtils';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import {
  ExclamationTriangleIcon,
  TrashIcon,
  UsersIcon,
  CheckIcon,
  InformationCircleIcon
} from '../../icons';

interface SelectiveDataClearingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BacentaDataSummary {
  id: string;
  name: string;
  memberCount: number;
  attendanceCount: number;
  newBelieverCount: number;
}

const SelectiveDataClearingModal: React.FC<SelectiveDataClearingModalProps> = ({
  isOpen,
  onClose
}) => {
  const { bacentas, members, attendanceRecords, newBelievers, showConfirmation, deleteBacentaHandler, deleteMemberHandler, deleteNewBelieverHandler, showToast, userProfile } = useAppContext();
  const [selectedBacentas, setSelectedBacentas] = useState<Set<string>>(new Set());
  const [includeUnassigned, setIncludeUnassigned] = useState(false);

  // Check if current user is admin - extra security layer
  const isAdmin = hasAdminPrivileges(userProfile);

  // If not admin, don't render the modal
  if (!isAdmin) {
    return null;
  }

  // Calculate data summary for each bacenta
  const bacentaDataSummary = useMemo((): BacentaDataSummary[] => {
    return bacentas.map(bacenta => {
      const bacentaMembers = members.filter(m => m.bacentaId === bacenta.id);
      const memberIds = bacentaMembers.map(m => m.id);
      const bacentaAttendance = attendanceRecords.filter(a => a.memberId && memberIds.includes(a.memberId));
      // Note: NewBeliever type doesn't have bacentaId property, so we can't filter by bacenta
      const bacentaNewBelievers: never[] = [];

      return {
        id: bacenta.id,
        name: bacenta.name,
        memberCount: bacentaMembers.length,
        attendanceCount: bacentaAttendance.length,
        newBelieverCount: bacentaNewBelievers.length
      };
    });
  }, [bacentas, members, attendanceRecords, newBelievers]);

  // Calculate unassigned data
  const unassignedData = useMemo(() => {
    const unassignedMembers = members.filter(m => !m.bacentaId || m.bacentaId === '');
    const unassignedMemberIds = unassignedMembers.map(m => m.id);
    const unassignedAttendance = attendanceRecords.filter(a => a.memberId && unassignedMemberIds.includes(a.memberId));
    // Note: NewBeliever type doesn't have bacentaId property, so all new believers are considered "unassigned"
    const unassignedNewBelievers = newBelievers;

    return {
      memberCount: unassignedMembers.length,
      attendanceCount: unassignedAttendance.length,
      newBelieverCount: unassignedNewBelievers.length
    };
  }, [members, attendanceRecords, newBelievers]);

  // Calculate totals for selected items
  const selectedTotals = useMemo(() => {
    let totalMembers = 0;
    let totalAttendance = 0;
    let totalNewBelievers = 0;

    selectedBacentas.forEach(bacentaId => {
      const summary = bacentaDataSummary.find(b => b.id === bacentaId);
      if (summary) {
        totalMembers += summary.memberCount;
        totalAttendance += summary.attendanceCount;
        totalNewBelievers += summary.newBelieverCount;
      }
    });

    if (includeUnassigned) {
      totalMembers += unassignedData.memberCount;
      totalAttendance += unassignedData.attendanceCount;
      totalNewBelievers += unassignedData.newBelieverCount;
    }

    return { totalMembers, totalAttendance, totalNewBelievers };
  }, [selectedBacentas, includeUnassigned, bacentaDataSummary, unassignedData]);

  const handleBacentaToggle = (bacentaId: string) => {
    const newSelected = new Set(selectedBacentas);
    if (newSelected.has(bacentaId)) {
      newSelected.delete(bacentaId);
    } else {
      newSelected.add(bacentaId);
    }
    setSelectedBacentas(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedBacentas.size === bacentas.length) {
      setSelectedBacentas(new Set());
    } else {
      setSelectedBacentas(new Set(bacentas.map(b => b.id)));
    }
  };

  const handleClearSelected = () => {
    if (selectedBacentas.size === 0 && !includeUnassigned) {
      return;
    }

    const selectedBacentaNames = Array.from(selectedBacentas)
      .map(id => bacentaDataSummary.find(b => b.id === id)?.name)
      .filter(Boolean);

    const clearSelectedData = async () => {
      try {
        const selectedBacentaIds = Array.from(selectedBacentas);

        // Get members to delete (from selected bacentas or unassigned)
        const membersToDelete = members.filter(member => {
          if (includeUnassigned && (!member.bacentaId || member.bacentaId === '')) return true;
          return selectedBacentaIds.includes(member.bacentaId);
        });

        // Get new believers to delete (from selected bacentas or unassigned)
        // Note: NewBeliever type doesn't have bacentaId property, so we only include unassigned if requested
        const newBelieversToDelete = newBelievers.filter(() => {
          // Since NewBeliever doesn't have bacentaId, we can only delete all new believers when includeUnassigned is true
          return includeUnassigned;
        });

        // Delete all members first (this will also delete their attendance records)
        for (const member of membersToDelete) {
          await deleteMemberHandler(member.id);
        }

        // Delete all new believers
        for (const newBeliever of newBelieversToDelete) {
          await deleteNewBelieverHandler(newBeliever.id);
        }

        // Delete the bacentas themselves
        for (const bacentaId of selectedBacentaIds) {
          await deleteBacentaHandler(bacentaId);
        }

        showToast('success', 'Data cleared successfully',
          `Cleared data from ${selectedBacentaNames.length} bacenta${selectedBacentaNames.length !== 1 ? 's' : ''}${includeUnassigned ? ' and unassigned data' : ''}`);

        onClose();
      } catch (error: any) {
        showToast('error', 'Failed to clear data', error.message);
      }
    };

    showConfirmation('clearSelectedData', {
      selectedBacentas: Array.from(selectedBacentas),
      selectedBacentaNames,
      includeUnassigned,
      ...selectedTotals
    }, clearSelectedData);
  };

  const handleClose = () => {
    setSelectedBacentas(new Set());
    setIncludeUnassigned(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg" title="Selective Data Clearing">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Selective Data Clearing</h3>
            <p className="text-sm text-gray-600">Choose specific bacentas to clear data from</p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <InformationCircleIcon className="w-5 h-5 text-amber-600 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">What will be cleared:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>All members assigned to selected bacentas</li>
                <li>All attendance records for those members</li>
                <li>All new believers assigned to selected bacentas</li>
                <li>The bacentas themselves will also be deleted</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Selection Controls */}
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-md font-medium text-gray-900">Select Bacentas to Clear</h4>
          <Button
            onClick={handleSelectAll}
            variant="secondary"
            size="sm"
            className="text-sm"
          >
            {selectedBacentas.size === bacentas.length ? 'Deselect All' : 'Select All'}
          </Button>
        </div>

        {/* Bacentas List */}
        <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
          {bacentaDataSummary.map((bacenta) => (
            <div
              key={bacenta.id}
              className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                selectedBacentas.has(bacenta.id)
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleBacentaToggle(bacenta.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selectedBacentas.has(bacenta.id)
                      ? 'border-red-500 bg-red-500'
                      : 'border-gray-300'
                  }`}>
                    {selectedBacentas.has(bacenta.id) && (
                      <CheckIcon className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-900">{bacenta.name}</h5>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span className="flex items-center space-x-1">
                        <UsersIcon className="w-4 h-4" />
                        <span>{bacenta.memberCount} members</span>
                      </span>
                      <span>{bacenta.attendanceCount} attendance records</span>
                      <span>{bacenta.newBelieverCount} new believers</span>
                    </div>
                  </div>
                </div>
                <TrashIcon className={`w-5 h-5 ${
                  selectedBacentas.has(bacenta.id) ? 'text-red-500' : 'text-gray-400'
                }`} />
              </div>
            </div>
          ))}

          {/* Unassigned Data Option */}
          {(unassignedData.memberCount > 0 || unassignedData.attendanceCount > 0 || unassignedData.newBelieverCount > 0) && (
            <div
              className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                includeUnassigned
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setIncludeUnassigned(!includeUnassigned)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    includeUnassigned
                      ? 'border-red-500 bg-red-500'
                      : 'border-gray-300'
                  }`}>
                    {includeUnassigned && (
                      <CheckIcon className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-900">Unassigned Data</h5>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span className="flex items-center space-x-1">
                        <UsersIcon className="w-4 h-4" />
                        <span>{unassignedData.memberCount} members</span>
                      </span>
                      <span>{unassignedData.attendanceCount} attendance records</span>
                      <span>{unassignedData.newBelieverCount} new believers</span>
                    </div>
                  </div>
                </div>
                <TrashIcon className={`w-5 h-5 ${
                  includeUnassigned ? 'text-red-500' : 'text-gray-400'
                }`} />
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        {(selectedBacentas.size > 0 || includeUnassigned) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h5 className="font-medium text-red-800 mb-2">Data to be cleared:</h5>
            <div className="grid grid-cols-3 gap-4 text-sm text-red-700">
              <div className="text-center">
                <div className="font-semibold text-lg">{selectedTotals.totalMembers}</div>
                <div>Members</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg">{selectedTotals.totalAttendance}</div>
                <div>Attendance Records</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg">{selectedTotals.totalNewBelievers}</div>
                <div>New Believers</div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3">
          <Button
            onClick={handleClose}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            onClick={handleClearSelected}
            variant="danger"
            disabled={selectedBacentas.size === 0 && !includeUnassigned}
            className="flex items-center space-x-2"
          >
            <TrashIcon className="w-4 h-4" />
            <span>Clear Selected Data</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SelectiveDataClearingModal;
