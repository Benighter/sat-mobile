
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';

import MembersTableView from './MembersTableView';
import { LoadingSpinnerIcon, UsersIcon } from './icons';


interface MemberListViewProps {
  bacentaFilter: string | null; 
}

const MemberListView: React.FC<MemberListViewProps> = ({ bacentaFilter }) => {
  const {
    members,
    isLoading,

    bacentas,
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


  return (
    <div className="animate-fade-in">



      {/* Enhanced Empty State */}
      {filteredMembers.length === 0 && !isLoading && (
        <div className="glass p-12 rounded-2xl text-center shadow-2xl animate-fade-in">
          <div className="w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6 floating">
            <UsersIcon className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-2xl font-bold gradient-text mb-3">No Members Found</h3>
          {!bacentaFilter && (
            <div className="space-y-2">
              <p className="text-gray-600">Ready to build your community?</p>
              <p className="text-sm text-gray-500">Add your first member using the floating action button</p>
            </div>
          )}
          {bacentaFilter && (
            <div className="space-y-2">
              <p className="text-gray-600">This Bacenta is waiting for members</p>
              <p className="text-sm text-gray-500">Add members to get started with attendance tracking</p>
            </div>
          )}
        </div>
      )}

      {/* Member List - Table View Only */}
      <div className="animate-fade-in">
        <MembersTableView bacentaFilter={bacentaFilter} />
      </div>
    </div>
  );
};

export default MemberListView;
