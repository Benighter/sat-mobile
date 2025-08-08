
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';

import MembersTableView from './MembersTableView';
import { LoadingSpinnerIcon, UsersIcon } from '../icons';
import Button from '../ui/Button';
import BulkMemberAddModal from './BulkMemberAddModal';

interface MemberListViewProps {
  bacentaFilter: string | null;
}

const MemberListView: React.FC<MemberListViewProps> = ({ bacentaFilter }) => {
  const {
    members,
    isLoading,

    bacentas,
    openMemberForm,
  } = useAppContext();

  const [roleFilter, setRoleFilter] = useState<'all' | 'Bacenta Leader' | 'Fellowship Leader' | 'Member'>('all');

  const filteredMembers = useMemo(() => {
    // Define role priority for sorting (lower number = higher priority)
    const getRolePriority = (role: string | undefined) => {
      switch (role) {
        case 'Bacenta Leader': return 1;
        case 'Fellowship Leader': return 2;
        case 'Member': return 3;
        default: return 4; // For any undefined roles
      }
    };

    return members
      .filter(member => {
        // Filter by bacenta
        if (bacentaFilter && member.bacentaId !== bacentaFilter) {
          return false;
        }

        // Filter by role
        if (roleFilter !== 'all' && (member.role || 'Member') !== roleFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        // First sort by role priority (Bacenta Leaders first, then Fellowship Leaders, then Members)
        const rolePriorityA = getRolePriority(a.role);
        const rolePriorityB = getRolePriority(b.role);

        if (rolePriorityA !== rolePriorityB) {
          return rolePriorityA - rolePriorityB;
        }

        // Then sort by last name, then first name within the same role
        return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
      });
  }, [members, bacentaFilter, bacentas, roleFilter]);

  if (isLoading && !members.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <LoadingSpinnerIcon className="w-10 h-10 text-blue-500" />
        <p className="mt-2 text-gray-500">Loading members...</p>
      </div>
    );
  }


  // Welcome UI state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [showBulkTip, setShowBulkTip] = useState(false);

  useEffect(() => {
    if (bacentaFilter) {
      try {
        const shouldShow = localStorage.getItem('church_connect_show_bulk_tip_once') === 'true';
        if (shouldShow) {
          setShowBulkTip(true);
          localStorage.removeItem('church_connect_show_bulk_tip_once');
        }
      } catch {}
    }
  }, [bacentaFilter]);

  const currentBacenta = bacentaFilter ? bacentas.find(b => b.id === bacentaFilter) : null;

  return (
    <div className="animate-fade-in">
      {/* Enhanced Empty State / Welcome UI for new bacentas */}
      {filteredMembers.length === 0 && !isLoading && (
        <div className="glass p-8 sm:p-12 rounded-2xl shadow-2xl animate-fade-in">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mb-2">
              <UsersIcon className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold gradient-text">No Members Yet</h3>
            {bacentaFilter ? (
              <p className="text-gray-600 max-w-xl">
                {currentBacenta ? `${currentBacenta.name} is brand new. Let’s add your first members.` : 'This Bacenta is new. Let’s add your first members.'}
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-gray-600">Ready to build your community?</p>
                <p className="text-sm text-gray-500">Add your first member using the floating action button</p>
              </div>
            )}

            {bacentaFilter && (
              <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mt-2">
                <Button
                  variant="primary"
                  onClick={() => openMemberForm()}
                  className="w-full sm:w-auto px-5 py-3"
                >
                  Add Members
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setIsBulkModalOpen(true)}
                  className="w-full sm:w-auto px-5 py-3"
                >
                  Bulk Add Members
                </Button>
              </div>
            )}

            {showBulkTip && (
              <div className="mt-4 w-full max-w-2xl bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4 text-sm shadow-sm">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">💡</div>
                  <div className="text-left">
                    <p className="font-medium">Bulk add tip</p>
                    <p>Bulk add allows you to add multiple members at once by pasting a list of names, one per line</p>
                  </div>
                  <button
                    onClick={() => setShowBulkTip(false)}
                    className="ml-auto text-blue-700 hover:text-blue-900"
                    aria-label="Dismiss info"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Member List - Table View Only */}
      <div className="animate-fade-in">
        <MembersTableView bacentaFilter={bacentaFilter} />
      </div>

      {/* Bulk Add Modal mounted locally so it opens within this context */}
      {bacentaFilter && (
        <BulkMemberAddModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          bacentaId={bacentaFilter}
          bacentaName={currentBacenta?.name}
        />
      )}
    </div>
  );
};

export default MemberListView;
