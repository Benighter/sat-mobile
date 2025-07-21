import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { Member, Bacenta } from '../types';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input from './ui/Input';
import { SearchIcon, PlusIcon, UserIcon, MapPinIcon } from './icons';
import { canAssignBacentaLeaders } from '../utils/permissionUtils';

// Define MinusIcon since it's not in the icons module
const MinusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
  </svg>
);

interface BacentaAssignmentModalProps {
  isOpen: boolean;
  leader: Member | null;
  onClose: () => void;
}

const BacentaAssignmentModal: React.FC<BacentaAssignmentModalProps> = ({ isOpen, leader, onClose }) => {
  const { members, bacentas, updateMemberHandler, showToast, userProfile } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');

  // Check if user can assign bacenta leaders
  const canAssignLeaders = canAssignBacentaLeaders(userProfile);

  // Get the current bacenta assignment for this leader
  const currentBacenta = useMemo(() => {
    if (!leader?.bacentaId) return null;
    return bacentas.find(b => b.id === leader.bacentaId) || null;
  }, [leader, bacentas]);

  // Get available bacentas (those without a leader of the same role)
  const availableBacentas = useMemo(() => {
    if (!leader) return [];
    
    return bacentas.filter(bacenta => {
      // Filter by search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        if (!bacenta.name.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      // Don't show current bacenta in available list
      if (bacenta.id === leader.bacentaId) {
        return false;
      }

      // Check if this bacenta already has a leader of the same role
      const hasLeaderOfSameRole = members.some(member => 
        member.bacentaId === bacenta.id && 
        member.role === leader.role &&
        member.id !== leader.id
      );

      return !hasLeaderOfSameRole;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [bacentas, members, leader, searchTerm]);

  // Assign leader to bacenta
  const handleAssignToBacenta = async (bacenta: Bacenta) => {
    if (!leader) return;

    try {
      const updatedMember = {
        ...leader,
        bacentaId: bacenta.id,
        lastUpdated: new Date().toISOString()
      };
      
      await updateMemberHandler(updatedMember);
      showToast('success', 'Assigned!', `${leader.firstName} ${leader.lastName} assigned to ${bacenta.name}`);
    } catch (error) {
      showToast('error', 'Error', 'Failed to assign leader to bacenta');
    }
  };

  // Remove leader from current bacenta
  const handleRemoveFromBacenta = async () => {
    if (!leader || !currentBacenta) return;

    try {
      const updatedMember = {
        ...leader,
        bacentaId: '',
        lastUpdated: new Date().toISOString()
      };
      
      await updateMemberHandler(updatedMember);
      showToast('success', 'Removed!', `${leader.firstName} ${leader.lastName} removed from ${currentBacenta.name}`);
    } catch (error) {
      showToast('error', 'Error', 'Failed to remove leader from bacenta');
    }
  };

  if (!leader) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bacenta Assignment" size="lg">
      <div className="space-y-6">
        {!canAssignLeaders && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-yellow-800 text-sm">
              <strong>View Only:</strong> You can view bacenta assignments but cannot make changes. Only administrators can assign leaders to bacentas.
            </div>
          </div>
        )}
        {/* Leader Info */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 bg-gradient-to-br ${leader.role === 'Bacenta Leader' ? 'from-green-100 to-green-200' : 'from-red-100 to-red-200'} rounded-xl flex items-center justify-center`}>
              <UserIcon className={`w-6 h-6 ${leader.role === 'Bacenta Leader' ? 'text-green-600' : 'text-red-600'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">
                {leader.firstName} {leader.lastName}
              </h3>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 ${leader.role === 'Bacenta Leader' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} rounded-full text-xs font-medium flex items-center`}>
                  <span className="mr-1">{leader.role === 'Bacenta Leader' ? '💚' : '❤️'}</span>
                  {leader.role}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Current Assignment */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Current Assignment</h4>
          {currentBacenta ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <MapPinIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{currentBacenta.name}</div>
                    <div className="text-sm text-gray-600">Currently assigned</div>
                  </div>
                </div>
                {canAssignLeaders && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFromBacenta}
                    className="text-red-600 hover:bg-red-100 p-2"
                    title="Remove from this bacenta"
                  >
                    <MinusIcon className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-gray-500">Not assigned to any bacenta</div>
            </div>
          )}
        </div>

        {/* Available Bacentas */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">Available Bacentas</h4>
            <div className="text-sm text-gray-500">
              {availableBacentas.length} available
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search bacentas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Available Bacentas List */}
          <div className="max-h-64 overflow-y-auto space-y-2">
            {availableBacentas.length > 0 ? (
              availableBacentas.map((bacenta) => (
                <div key={bacenta.id} className="border border-gray-200 rounded-xl p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                        <MapPinIcon className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{bacenta.name}</div>
                        <div className="text-sm text-gray-500">Available for assignment</div>
                      </div>
                    </div>
                    {canAssignLeaders && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAssignToBacenta(bacenta)}
                        className="text-green-600 hover:bg-green-100 p-2"
                        title="Assign to this bacenta"
                      >
                        <PlusIcon className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'No bacentas match your search' : 'No available bacentas'}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default BacentaAssignmentModal;
