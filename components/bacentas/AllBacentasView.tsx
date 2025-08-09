
import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import Input from '../ui/Input';
import { SearchIcon, PlusIcon, ChevronRightIcon } from '../icons';
import { TabKeys } from '../../types';

const AllBacentasView: React.FC = () => {
  const { bacentas, switchTab, addBacentaHandler, showToast } = useAppContext();
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');

  const filtered = useMemo(() => {
    const list = query.trim()
      ? bacentas.filter(b => b.name.toLowerCase().includes(query.toLowerCase()))
      : bacentas;
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [bacentas, query]);

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
                      className="px-4 bg-white border-gray-300 focus:ring-blue-600 text-base py-3"
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
                      } catch {}
                    }}
                    disabled={!newName.trim()}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center min-w-[60px]"
                    title="Add Bacenta"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bacentas Grid - Clean Design Without Icons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map(b => (
          <div key={b.id} className="group relative">
            <div className="absolute -inset-0.5 z-0 bg-gradient-to-r from-blue-200 to-purple-200 dark:from-blue-800 dark:to-purple-800 rounded-2xl opacity-0 group-hover:opacity-100 transition duration-300 blur-sm pointer-events-none"></div>
            <button
              className="relative z-10 w-full bg-white dark:bg-white p-6 rounded-2xl border border-gray-200 dark:border-gray-300 shadow-md hover:shadow-xl text-left transition-all duration-300 group-hover:scale-[1.02]"
              onClick={() => switchTab({ id: TabKeys.BACENTA_OUTREACH, name: `${b.name} Outreach`, data: { bacentaId: b.id } })}
            >
              <div className="space-y-4">
                {/* Bacenta Name - Clean Typography */}
                <div>
                  <h3 className="font-bold text-xl text-slate-900 transition-colors duration-200 truncate" title={b.name}>
                    {b.name}
                  </h3>
                  <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>

                {/* Description */}
                <p className="text-gray-600 dark:text-dark-300 text-sm leading-relaxed">
                  Open outreach management for this building
                </p>

                {/* Action Indicator */}
                <div className="flex items-center text-xs text-blue-600 font-medium opacity-100">
                  <span>Click to manage</span>
                  <ChevronRightIcon className="w-4 h-4 ml-1" />
                </div>
              </div>
            </button>
          </div>
        ))}

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

