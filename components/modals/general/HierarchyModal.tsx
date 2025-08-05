import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../../contexts/FirebaseAppContext';
import { Member } from '../../../types';
import { XMarkIcon, UsersIcon, UserIcon, PhoneIcon, MapPinIcon, CheckIcon, PlusIcon } from '../../icons';
import Button from '../../ui/Button';
import Badge from '../../ui/Badge';
import Input from '../../ui/Input';
import { canManageHierarchy } from '../../../utils/permissionUtils';

interface HierarchyModalProps {
  isOpen: boolean;
  bacentaLeader: Member | null;
  onClose: () => void;
}

const HierarchyModal: React.FC<HierarchyModalProps> = ({ isOpen, bacentaLeader, onClose }) => {
  const { members, updateMemberHandler, showToast, bacentas, userProfile } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');

  // Check if user can manage hierarchy
  const canManageHierarchyActions = canManageHierarchy(userProfile);

  // Get all fellowship leaders
  const fellowshipLeaders = useMemo(() => {
    return members.filter(member => member.role === 'Fellowship Leader');
  }, [members]);

  // Get fellowship leaders assigned to this bacenta leader
  const assignedFellowshipLeaders = useMemo(() => {
    if (!bacentaLeader) return [];
    return fellowshipLeaders.filter(leader => leader.bacentaLeaderId === bacentaLeader.id);
  }, [fellowshipLeaders, bacentaLeader]);

  // Get unassigned fellowship leaders
  const unassignedFellowshipLeaders = useMemo(() => {
    return fellowshipLeaders
      .filter(leader => !leader.bacentaLeaderId)
      .filter(leader => {
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          return (
            leader.firstName.toLowerCase().includes(searchLower) ||
            leader.lastName.toLowerCase().includes(searchLower) ||
            leader.phoneNumber.toLowerCase().includes(searchLower)
          );
        }
        return true;
      })
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  }, [fellowshipLeaders, searchTerm]);

  if (!isOpen || !bacentaLeader) return null;

  // Get bacenta name
  const getBacentaName = (bacentaId: string) => {
    if (!bacentaId) return 'Unassigned';
    const bacenta = bacentas.find(b => b.id === bacentaId);
    return bacenta?.name || 'Unknown';
  };

  // Assign fellowship leader to bacenta leader
  const handleAssignFellowshipLeader = async (fellowshipLeader: Member) => {
    try {
      const updatedMember = {
        ...fellowshipLeader,
        bacentaLeaderId: bacentaLeader.id,
        lastUpdated: new Date().toISOString()
      };
      
      await updateMemberHandler(updatedMember);
      showToast('success', 'Assigned!', `${fellowshipLeader.firstName} ${fellowshipLeader.lastName} assigned to ${bacentaLeader.firstName} ${bacentaLeader.lastName}`);
    } catch (error) {
      showToast('error', 'Error', 'Failed to assign fellowship leader');
    }
  };

  // Remove fellowship leader from bacenta leader
  const handleRemoveFellowshipLeader = async (fellowshipLeader: Member) => {
    try {
      const updatedMember = {
        ...fellowshipLeader,
        bacentaLeaderId: '',
        lastUpdated: new Date().toISOString()
      };

      await updateMemberHandler(updatedMember);
      showToast('success', 'Removed!', `${fellowshipLeader.firstName} ${fellowshipLeader.lastName} removed from ${bacentaLeader.firstName} ${bacentaLeader.lastName}`);
    } catch (error) {
      showToast('error', 'Error', 'Failed to remove fellowship leader');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <UsersIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-bold truncate">Leadership Hierarchy</h2>
                <p className="text-green-100 text-sm sm:text-base truncate">
                  {bacentaLeader.firstName} {bacentaLeader.lastName} - {getBacentaName(bacentaLeader.bacentaId)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 flex-shrink-0"
            >
              <XMarkIcon className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-3 sm:p-6 overflow-y-auto max-h-[calc(95vh-120px)] sm:max-h-[calc(90vh-120px)]">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-green-50 border border-green-200 p-3 sm:p-4 rounded-lg sm:rounded-xl text-center">
              <div className="text-lg sm:text-2xl font-bold text-green-600">{assignedFellowshipLeaders.length}</div>
              <div className="text-xs sm:text-sm text-gray-600 leading-tight">Assigned</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 p-3 sm:p-4 rounded-lg sm:rounded-xl text-center">
              <div className="text-lg sm:text-2xl font-bold text-blue-600">{unassignedFellowshipLeaders.length}</div>
              <div className="text-xs sm:text-sm text-gray-600 leading-tight">Available</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 p-3 sm:p-4 rounded-lg sm:rounded-xl text-center">
              <div className="text-lg sm:text-2xl font-bold text-purple-600">{fellowshipLeaders.length}</div>
              <div className="text-xs sm:text-sm text-gray-600 leading-tight">Total</div>
            </div>
          </div>

          {/* Assigned Fellowship Leaders */}
          <div className="mb-4 sm:mb-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center px-1">
              <CheckIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-600" />
              Assigned Fellowship Leaders ({assignedFellowshipLeaders.length})
            </h3>

            {assignedFellowshipLeaders.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 p-4 sm:p-6 rounded-lg sm:rounded-xl text-center">
                <UsersIcon className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-2 sm:mb-3" />
                <p className="text-gray-500 text-sm sm:text-base">No fellowship leaders assigned yet</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {assignedFellowshipLeaders.map((leader) => (
                  <div key={leader.id} className="bg-white border border-gray-200 p-3 sm:p-4 rounded-lg sm:rounded-xl shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start space-x-2 sm:space-x-3 min-w-0 flex-1">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-red-100 to-red-200 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                          <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                            {leader.firstName} {leader.lastName}
                          </div>
                          <div className="space-y-1 text-xs sm:text-sm text-gray-600">
                            <div className="flex items-center space-x-1">
                              <PhoneIcon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                              <span className="truncate">{leader.phoneNumber || 'No phone'}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <MapPinIcon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                              <span className="truncate">{leader.buildingAddress || 'No address'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 flex-shrink-0">
                        <div className="bg-red-100 text-red-700 px-2 py-1 rounded-md text-xs font-medium">
                          ❤️ Fellowship Leader
                        </div>
                        {canManageHierarchyActions && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFellowshipLeader(leader)}
                            className="text-red-600 hover:bg-red-100 p-1.5 sm:p-2"
                            title="Remove from hierarchy"
                          >
                            <XMarkIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available Fellowship Leaders */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center px-1">
                <PlusIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600" />
                Available Fellowship Leaders ({unassignedFellowshipLeaders.length})
              </h3>
              <div className="w-full sm:w-64">
                <Input
                  placeholder="Search fellowship leaders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border border-gray-300 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            {unassignedFellowshipLeaders.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 p-4 sm:p-6 rounded-lg sm:rounded-xl text-center">
                <UsersIcon className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-2 sm:mb-3" />
                <p className="text-gray-500 text-sm sm:text-base">
                  {searchTerm ? 'No fellowship leaders match your search' : 'All fellowship leaders are already assigned'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {unassignedFellowshipLeaders.map((leader) => (
                  <div key={leader.id} className="bg-white border border-gray-200 p-3 sm:p-4 rounded-lg sm:rounded-xl shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start space-x-2 sm:space-x-3 min-w-0 flex-1">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                          <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                            {leader.firstName} {leader.lastName}
                          </div>
                          <div className="space-y-1 text-xs sm:text-sm text-gray-600">
                            <div className="flex items-center space-x-1">
                              <PhoneIcon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                              <span className="truncate">{leader.phoneNumber || 'No phone'}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <MapPinIcon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                              <span className="truncate">{leader.buildingAddress || 'No address'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 flex-shrink-0">
                        <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-medium">
                          ❤️ Available
                        </div>
                        {canManageHierarchyActions && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAssignFellowshipLeader(leader)}
                            className="text-green-600 hover:bg-green-100 p-1.5 sm:p-2"
                            title="Assign to this bacenta leader"
                          >
                            <PlusIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HierarchyModal;
