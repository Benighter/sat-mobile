import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { Member } from '../../types';

const AssignmentManagementView: React.FC = () => {
  const { 
    members, 
    assignAssistantOrAdminToLeaderHandler, 
    unassignAssistantOrAdminHandler,
    showToast 
  } = useAppContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'Assistant' | 'Admin'>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  // Get all leaders (Green and Red Bacentas)
  const leaders = useMemo(() => {
    return members.filter(m => 
      m.role === 'Bacenta Leader' || m.role === 'Fellowship Leader'
    ).sort((a, b) => {
      // Sort Green Bacentas first, then Red Bacentas
      if (a.role === 'Bacenta Leader' && b.role !== 'Bacenta Leader') return -1;
      if (a.role !== 'Bacenta Leader' && b.role === 'Bacenta Leader') return 1;
      return `${a.firstName} ${a.lastName || ''}`.localeCompare(`${b.firstName} ${b.lastName || ''}`);
    });
  }, [members]);

  // Get all Assistants and Admins
  const assistantsAndAdmins = useMemo(() => {
    let filtered = members.filter(m => m.role === 'Assistant' || m.role === 'Admin');

    // Apply role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(m => m.role === roleFilter);
    }

    // Apply assignment filter
    if (assignmentFilter === 'assigned') {
      filtered = filtered.filter(m => m.assignedLeaderId);
    } else if (assignmentFilter === 'unassigned') {
      filtered = filtered.filter(m => !m.assignedLeaderId);
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(m => {
        const fullName = `${m.firstName} ${m.lastName || ''}`.toLowerCase();
        return fullName.includes(term);
      });
    }

    // Sort by role (Assistant first), then by name
    return filtered.sort((a, b) => {
      if (a.role === 'Assistant' && b.role !== 'Assistant') return -1;
      if (a.role !== 'Assistant' && b.role === 'Assistant') return 1;
      return `${a.firstName} ${a.lastName || ''}`.localeCompare(`${b.firstName} ${b.lastName || ''}`);
    });
  }, [members, roleFilter, assignmentFilter, searchTerm]);

  const handleAssign = async (assistantOrAdminId: string, leaderId: string) => {
    try {
      setIsAssigning(true);
      await assignAssistantOrAdminToLeaderHandler(assistantOrAdminId, leaderId);
      setSelectedMember(null);
    } catch (error) {
      console.error('Failed to assign:', error);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassign = async (assistantOrAdminId: string) => {
    try {
      setIsAssigning(true);
      await unassignAssistantOrAdminHandler(assistantOrAdminId);
    } catch (error) {
      console.error('Failed to unassign:', error);
    } finally {
      setIsAssigning(false);
    }
  };

  const getLeaderName = (leaderId: string | undefined) => {
    if (!leaderId) return null;
    const leader = members.find(m => m.id === leaderId);
    if (!leader) return 'Unknown Leader';
    return `${leader.firstName} ${leader.lastName || ''}`;
  };

  const getLeaderRole = (leaderId: string | undefined) => {
    if (!leaderId) return null;
    const leader = members.find(m => m.id === leaderId);
    return leader?.role;
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-dark-800">
      {/* Header */}
      <div className="bg-white dark:bg-dark-700 border-b border-gray-200 dark:border-dark-600 p-3 sm:p-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-dark-100 mb-3 sm:mb-4">
          Assignment Management
        </h1>

        {/* Filters */}
        <div className="space-y-2 sm:space-y-3">
          {/* Search */}
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 placeholder-gray-400 dark:placeholder-dark-400"
          />

          {/* Filter Row */}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | 'Assistant' | 'Admin')}
              className="w-full px-2 sm:px-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100"
            >
              <option value="all">All Roles</option>
              <option value="Assistant">🤝 Assistants</option>
              <option value="Admin">⚙️ Admins</option>
            </select>

            <select
              value={assignmentFilter}
              onChange={(e) => setAssignmentFilter(e.target.value as 'all' | 'assigned' | 'unassigned')}
              className="w-full px-2 sm:px-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100"
            >
              <option value="all">All Status</option>
              <option value="assigned">✓ Assigned</option>
              <option value="unassigned">○ Unassigned</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-dark-300">
            <span className="text-gray-500 dark:text-dark-400">Total:</span>
            <span className="font-bold text-gray-900 dark:text-dark-100">{assistantsAndAdmins.length}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-dark-300">
            <span className="text-gray-500 dark:text-dark-400">Assigned:</span>
            <span className="font-bold text-green-600 dark:text-green-400">{assistantsAndAdmins.filter(m => m.assignedLeaderId).length}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-dark-300">
            <span className="text-gray-500 dark:text-dark-400">Unassigned:</span>
            <span className="font-bold text-orange-600 dark:text-orange-400">{assistantsAndAdmins.filter(m => !m.assignedLeaderId).length}</span>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {assistantsAndAdmins.length === 0 ? (
          <div className="text-center py-12 text-sm sm:text-base text-gray-500 dark:text-dark-400">
            No {roleFilter !== 'all' ? roleFilter + 's' : 'Assistants or Admins'} found
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {assistantsAndAdmins.map(member => {
              const assignedLeaderName = getLeaderName(member.assignedLeaderId);
              const assignedLeaderRole = getLeaderRole(member.assignedLeaderId);
              const isExpanded = selectedMember?.id === member.id;

              return (
                <div
                  key={member.id}
                  className="bg-white dark:bg-dark-700 rounded-lg border border-gray-200 dark:border-dark-600 overflow-hidden shadow-sm"
                >
                  {/* Member Info */}
                  <div className="p-3 sm:p-4">
                    {/* Top Row: Icon, Name, and Role Badge */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-dark-600 dark:to-dark-700">
                        <span className="text-base">
                          {member.role === 'Assistant' ? '🤝' : '⚙️'}
                        </span>
                      </div>
                      <h3 className="font-semibold text-base sm:text-lg text-gray-900 dark:text-dark-100 flex-shrink min-w-0">
                        {member.firstName} {member.lastName || ''}
                      </h3>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap flex-shrink-0 ${
                        member.role === 'Assistant'
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200'
                          : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-200'
                      }`}>
                        {member.role}
                      </span>
                    </div>

                    {/* Assignment Status */}
                    <div className="mb-3 pl-10">
                      {assignedLeaderName ? (
                        <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-dark-300 flex-wrap">
                          <span className="text-gray-500 dark:text-dark-400">Assigned to:</span>
                          <div className="flex items-center gap-1 font-medium text-gray-900 dark:text-dark-100">
                            <span className="text-base">{assignedLeaderRole === 'Bacenta Leader' ? '💚' : '❤️'}</span>
                            <span>{assignedLeaderName}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 dark:text-dark-400 italic">
                          Not assigned to any leader
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 flex-wrap pl-10">
                      {member.assignedLeaderId && (
                        <button
                          onClick={() => handleUnassign(member.id)}
                          disabled={isAssigning}
                          className="px-3 py-1.5 text-xs sm:text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          Unassign
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedMember(isExpanded ? null : member)}
                        className="px-3 py-1.5 text-xs sm:text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors whitespace-nowrap"
                      >
                        {isExpanded ? 'Cancel' : member.assignedLeaderId ? 'Reassign' : 'Assign to Leader'}
                      </button>
                    </div>
                  </div>

                  {/* Assignment Dropdown */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-dark-600 p-4 bg-gray-50 dark:bg-dark-800">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-dark-200 mb-3">
                        Select a leader to assign:
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {leaders.map(leader => (
                          <button
                            key={leader.id}
                            onClick={() => handleAssign(member.id, leader.id)}
                            disabled={isAssigning || leader.id === member.assignedLeaderId}
                            className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                              leader.id === member.assignedLeaderId
                                ? 'bg-gray-100 dark:bg-dark-700 border-gray-300 dark:border-dark-600 opacity-50 cursor-not-allowed'
                                : 'bg-white dark:bg-dark-700 border-gray-200 dark:border-dark-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-500'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">
                                {leader.role === 'Bacenta Leader' ? '💚' : '❤️'}
                              </span>
                              <div>
                                <div className="font-medium text-gray-900 dark:text-dark-100">
                                  {leader.firstName} {leader.lastName || ''}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-dark-400">
                                  {leader.role === 'Bacenta Leader' ? 'Green Bacenta' : 'Red Bacenta'}
                                </div>
                              </div>
                              {leader.id === member.assignedLeaderId && (
                                <span className="ml-auto text-xs text-gray-500 dark:text-dark-400">
                                  (Current)
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignmentManagementView;

