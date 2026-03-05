import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { Member } from '../../types';

interface LeaderWithTeam {
  leader: Member;
  assistants: Member[];
  admins: Member[];
}

const LeaderHierarchyView: React.FC = () => {
  const { members, bacentas } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyWithTeam, setShowOnlyWithTeam] = useState(false);
  const [expandedLeaders, setExpandedLeaders] = useState<Set<string>>(new Set());

  // Build hierarchy structure
  const hierarchy = useMemo(() => {
    // Get all leaders
    const leaders = members.filter(m => 
      m.role === 'Bacenta Leader' || m.role === 'Fellowship Leader'
    );

    // Build team for each leader
    const leaderTeams: LeaderWithTeam[] = leaders.map(leader => {
      const assistants = members.filter(m => 
        m.role === 'Assistant' && m.assignedLeaderId === leader.id
      );
      const admins = members.filter(m => 
        m.role === 'Admin' && m.assignedLeaderId === leader.id
      );

      return {
        leader,
        assistants,
        admins
      };
    });

    // Apply filters
    let filtered = leaderTeams;

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(team => {
        const leaderName = `${team.leader.firstName} ${team.leader.lastName || ''}`.toLowerCase();
        const assistantNames = team.assistants.map(a => `${a.firstName} ${a.lastName || ''}`.toLowerCase());
        const adminNames = team.admins.map(a => `${a.firstName} ${a.lastName || ''}`.toLowerCase());
        
        return leaderName.includes(term) || 
               assistantNames.some(name => name.includes(term)) ||
               adminNames.some(name => name.includes(term));
      });
    }

    // Filter to show only leaders with team members
    if (showOnlyWithTeam) {
      filtered = filtered.filter(team => team.assistants.length > 0 || team.admins.length > 0);
    }

    // Sort: Green Bacentas first, then Red Bacentas, then by name
    return filtered.sort((a, b) => {
      if (a.leader.role === 'Bacenta Leader' && b.leader.role !== 'Bacenta Leader') return -1;
      if (a.leader.role !== 'Bacenta Leader' && b.leader.role === 'Bacenta Leader') return 1;
      return `${a.leader.firstName} ${a.leader.lastName || ''}`.localeCompare(
        `${b.leader.firstName} ${b.leader.lastName || ''}`
      );
    });
  }, [members, searchTerm, showOnlyWithTeam]);

  const toggleLeader = (leaderId: string) => {
    setExpandedLeaders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leaderId)) {
        newSet.delete(leaderId);
      } else {
        newSet.add(leaderId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedLeaders(new Set(hierarchy.map(team => team.leader.id)));
  };

  const collapseAll = () => {
    setExpandedLeaders(new Set());
  };

  const getBacentaName = (bacentaId: string) => {
    const bacenta = bacentas.find(b => b.id === bacentaId);
    return bacenta?.name || 'Unknown Bacenta';
  };

  const totalLeaders = hierarchy.length;
  const totalAssistants = hierarchy.reduce((sum, team) => sum + team.assistants.length, 0);
  const totalAdmins = hierarchy.reduce((sum, team) => sum + team.admins.length, 0);
  const leadersWithTeam = hierarchy.filter(team => team.assistants.length > 0 || team.admins.length > 0).length;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-dark-800">
      {/* Header */}
      <div className="bg-white dark:bg-dark-700 border-b border-gray-200 dark:border-dark-600 p-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100 mb-4">
          Leadership Hierarchy
        </h1>

        {/* Filters */}
        <div className="space-y-3">
          {/* Search */}
          <input
            type="text"
            placeholder="Search leaders or team members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100"
          />

          {/* Filter Options */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-dark-200 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyWithTeam}
                onChange={(e) => setShowOnlyWithTeam(e.target.checked)}
                className="rounded border-gray-300 dark:border-dark-600 text-blue-600 focus:ring-blue-500"
              />
              <span>Show only leaders with team members</span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="px-3 py-1 text-sm bg-gray-100 dark:bg-dark-600 text-gray-700 dark:text-dark-200 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-500 transition-colors"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-3 py-1 text-sm bg-gray-100 dark:bg-dark-600 text-gray-700 dark:text-dark-200 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-500 transition-colors"
              >
                Collapse All
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
            <div className="text-xs text-green-600 dark:text-green-400 mb-1">Leaders</div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">{totalLeaders}</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">Assistants</div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{totalAssistants}</div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
            <div className="text-xs text-purple-600 dark:text-purple-400 mb-1">Admins</div>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{totalAdmins}</div>
          </div>
          <div className="bg-gray-50 dark:bg-dark-600 rounded-lg p-3">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">With Team</div>
            <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{leadersWithTeam}</div>
          </div>
        </div>
      </div>

      {/* Hierarchy List */}
      <div className="flex-1 overflow-y-auto p-4">
        {hierarchy.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-dark-400">
            No leaders found
          </div>
        ) : (
          <div className="space-y-3">
            {hierarchy.map(team => {
              const isExpanded = expandedLeaders.has(team.leader.id);
              const hasTeam = team.assistants.length > 0 || team.admins.length > 0;

              return (
                <div
                  key={team.leader.id}
                  className="bg-white dark:bg-dark-700 rounded-lg border border-gray-200 dark:border-dark-600 overflow-hidden"
                >
                  {/* Leader Header */}
                  <div
                    onClick={() => hasTeam && toggleLeader(team.leader.id)}
                    className={`p-4 ${hasTeam ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-600' : ''} transition-colors`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {hasTeam && (
                          <div className="text-gray-400 dark:text-dark-400">
                            {isExpanded ? '▼' : '▶'}
                          </div>
                        )}
                        <div className="text-2xl">
                          {team.leader.role === 'Bacenta Leader' ? '💚' : '❤️'}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-dark-100">
                            {team.leader.firstName} {team.leader.lastName || ''}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-dark-400">
                            {team.leader.role === 'Bacenta Leader' ? 'Green Bacenta' : 'Red Bacenta'}
                            {team.leader.bacentaId && ` • ${getBacentaName(team.leader.bacentaId)}`}
                          </div>
                        </div>
                      </div>

                      {hasTeam && (
                        <div className="flex gap-2 items-center">
                          {team.assistants.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                                <span className="text-base">🤝</span>
                              </div>
                              <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 min-w-[1.25rem] text-center">
                                {team.assistants.length}
                              </span>
                            </div>
                          )}
                          {team.admins.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                                <span className="text-base">⚙️</span>
                              </div>
                              <span className="text-sm font-semibold text-purple-700 dark:text-purple-300 min-w-[1.25rem] text-center">
                                {team.admins.length}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Team Members (Expanded) */}
                  {isExpanded && hasTeam && (
                    <div className="border-t border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-800 p-4">
                      <div className="space-y-3">
                        {/* Assistants */}
                        {team.assistants.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase mb-2">
                              Assistants
                            </h4>
                            <div className="space-y-2">
                              {team.assistants.map(assistant => (
                                <div
                                  key={assistant.id}
                                  className="flex items-center gap-2 pl-8 py-2 bg-white dark:bg-dark-700 rounded-lg border border-blue-200 dark:border-blue-800"
                                >
                                  <span className="text-lg">🤝</span>
                                  <span className="text-gray-900 dark:text-dark-100">
                                    {assistant.firstName} {assistant.lastName || ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Admins */}
                        {team.admins.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase mb-2">
                              Admins
                            </h4>
                            <div className="space-y-2">
                              {team.admins.map(admin => (
                                <div
                                  key={admin.id}
                                  className="flex items-center gap-2 pl-8 py-2 bg-white dark:bg-dark-700 rounded-lg border border-purple-200 dark:border-purple-800"
                                >
                                  <span className="text-lg">⚙️</span>
                                  <span className="text-gray-900 dark:text-dark-100">
                                    {admin.firstName} {admin.lastName || ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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

export default LeaderHierarchyView;

