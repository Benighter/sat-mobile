
import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import Input from '../ui/Input';
import Badge from '../ui/Badge';
import { SearchIcon, PlusIcon, ChevronRightIcon, PeopleIcon } from '../icons';
import { TabKeys } from '../../types';

const AllBacentasView: React.FC = () => {
  const { bacentas, allOutreachMembers, outreachBacentas, switchTab, addBacentaHandler, showToast, showFrozenBacentas, setShowFrozenBacentas } = useAppContext();
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');

  // Calculate outreach statistics for each bacenta
  const bacentaStats = useMemo(() => {
    const stats = new Map();

    // Build a mapping from outreach bacenta ID -> regular bacenta ID by matching names
    const outreachIdToRegularId = new Map<string, string>();
    outreachBacentas.forEach(ob => {
      const matchingRegular = bacentas.find(b => b.name === ob.name);
      if (matchingRegular) {
        outreachIdToRegularId.set(ob.id, matchingRegular.id);
      }
    });

    // Group outreach members by their corresponding regular bacenta ID
    const membersByBacenta: Record<string, typeof allOutreachMembers> = {};
    allOutreachMembers.forEach(member => {
      const regularId = outreachIdToRegularId.get(member.bacentaId) || member.bacentaId;
      if (!membersByBacenta[regularId]) membersByBacenta[regularId] = [];
      membersByBacenta[regularId].push(member);
    });

    // Calculate stats for each bacenta
    bacentas.forEach(bacenta => {
      const members = membersByBacenta[bacenta.id] || [];
      const total = members.length;
      const coming = members.filter(m => m.comingStatus).length;
      const converted = members.filter(m => !!m.convertedMemberId).length;

      stats.set(bacenta.id, {
        total,
        coming,
        converted,
        comingRate: total ? Math.round((coming / total) * 100) : 0,
        conversionRate: total ? Math.round((converted / total) * 100) : 0
      });
    });

    return stats;
  }, [bacentas, allOutreachMembers, outreachBacentas]);

  const filtered = useMemo(() => {
    // Filter out frozen bacentas by default unless showFrozenBacentas is true
    const visibleBacentas = bacentas.filter(b => showFrozenBacentas ? true : !b.frozen);

    const list = query.trim()
      ? visibleBacentas.filter(b => b.name.toLowerCase().includes(query.toLowerCase()))
      : visibleBacentas;
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [bacentas, query, showFrozenBacentas]);

  return (
    <div className="space-y-8">
      {/* Header Section - Redesigned */}
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl blur opacity-20"></div>
        <div className="relative bg-white/95 dark:bg-dark-800/95 p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-dark-600 backdrop-blur-sm">
          <div className="text-center space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 dark:text-white">
                All Bacentas
              </h2>
              <p className="text-base sm:text-lg text-gray-600 dark:text-dark-300 max-w-xl mx-auto">
                Browse and manage existing buildings like VDS, Amani, and more
              </p>
            </div>

            {/* Search and Add Controls */}
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Search Input */}
                <div className="lg:col-span-2">
                  <div className="relative">
                    <Input
                      id="bacenta-search"
                      placeholder="Search bacentas..."
                      value={query}
                      onChange={(v) => setQuery(v)}
                      wrapperClassName="mb-0"
                      className="bg-white border-gray-300 focus:ring-blue-600 text-base py-3"
                      leftIcon={<SearchIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
                      iconType="search"
                    />
                  </div>
                </div>

                {/* Add Bacenta */}
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Add new bacenta..."
                    value={newName}
                    onChange={(v) => setNewName(v)}
                    wrapperClassName="mb-0 flex-1"
                    className="bg-white border-gray-300 focus:ring-green-600 text-base py-3"
                  />
                  <button
                    onClick={async () => {
                      const name = newName.trim();
                      if (!name) return;
                      try {
                        await addBacentaHandler({ name });
                        setNewName('');
                        showToast('success', 'Bacenta added successfully');
                      } catch { }
                    }}
                    disabled={!newName.trim()}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center min-w-[60px]"
                    title="Add Bacenta"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Show Frozen Toggle */}
              <div className="flex justify-center">
                <label className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg shadow-sm cursor-pointer select-none hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={showFrozenBacentas}
                    onChange={(e) => setShowFrozenBacentas(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Show frozen bacentas ({bacentas.filter(b => b.frozen).length})
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bacentas Grid - Enhanced with Outreach Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map(b => {
          const stats = bacentaStats.get(b.id) || { total: 0, coming: 0, converted: 0, comingRate: 0, conversionRate: 0 };

          return (
            <div key={b.id} className="group relative">
              <div className="absolute -inset-0.5 z-0 bg-gradient-to-r from-blue-200 to-purple-200 dark:from-blue-800 dark:to-purple-800 rounded-2xl opacity-0 group-hover:opacity-100 transition duration-300 blur-sm pointer-events-none"></div>
              <button
                className="relative z-10 w-full bg-white dark:bg-white p-6 rounded-2xl border border-gray-200 dark:border-gray-300 shadow-md hover:shadow-xl text-left transition-all duration-300 group-hover:scale-[1.02]"
                onClick={() => switchTab({ id: TabKeys.BACENTA_OUTREACH, name: `${b.name} Outreach`, data: { bacentaId: b.id } })}
              >
                <div className="space-y-4">
                  {/* Header with outreach count */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-lg">
                          <PeopleIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                          <div className="text-2xl font-bold text-slate-900">
                            {stats.total}
                          </div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">
                            {stats.total === 1 ? 'Person Outreached' : 'People Outreached'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-lg text-slate-900 transition-colors duration-200 truncate" title={b.name}>
                          {b.name}
                        </h3>
                        {b.frozen && (
                          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200" title="Frozen – excluded from counts">
                            Frozen
                          </span>
                        )}
                      </div>
                      <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                  </div>

                  {/* Outreach Statistics */}
                  {stats.total > 0 ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge color="green" className="font-medium text-xs">
                          {stats.coming} coming ({stats.comingRate}%)
                        </Badge>
                        <Badge color="purple" className="font-medium text-xs">
                          {stats.converted} converted ({stats.conversionRate}%)
                        </Badge>
                      </div>
                      <p className="text-gray-600 text-sm">
                        {stats.coming} people coming to church • {stats.converted} converted members
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Badge color="gray" className="font-medium text-xs">
                        No outreach data yet
                      </Badge>
                      <p className="text-gray-600 text-sm">
                        Start outreach activities for this building
                      </p>
                    </div>
                  )}

                  {/* Action Indicator */}
                  <div className="flex items-center text-xs text-blue-600 font-medium pt-2 border-t border-gray-100">
                    <span>Click to manage</span>
                    <ChevronRightIcon className="w-4 h-4 ml-1" />
                  </div>
                </div>
              </button>
            </div>
          );
        })}

        {/* Empty State */}
        {filtered.length === 0 && (
          <div className="col-span-full">
            <div className="text-center py-16 space-y-4">
              <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-dark-700 dark:to-dark-600 flex items-center justify-center">
                <SearchIcon className="w-12 h-12 text-gray-400 dark:text-dark-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {query ? 'No matching bacentas' : 'No bacentas found'}
                </h3>
                <p className="text-gray-600 dark:text-dark-300">
                  {query
                    ? `No bacentas match "${query}". Try a different search term.`
                    : 'Add your first bacenta to get started with outreach management.'
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllBacentasView;

