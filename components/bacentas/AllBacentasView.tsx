
import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import Input from '../ui/Input';
import { GroupIcon, SearchIcon, BuildingOfficeIcon, PlusIcon } from '../icons';
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
    <div className="space-y-6">
      {/* Header */}
      <div className="glass p-4 rounded-2xl shadow-sm max-w-5xl mx-auto">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex items-center gap-2">
            <BuildingOfficeIcon className="w-5 h-5 text-slate-600" />
            <h2 className="text-xl sm:text-2xl font-bold">All Bacentas (Buildings)</h2>
          </div>
          <p className="text-sm text-gray-600">Browse existing buildings like VDS, Amani, etc.</p>
          <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-2xl">
            <div className="flex-1">
              <Input
                placeholder="Search bacentas..."
                value={query}
                onChange={(v) => setQuery(v)}
                className="bg-white/70"
              />
            </div>
            <div className="flex-1 sm:flex-none sm:w-80 flex items-center gap-2">
              <Input
                placeholder="Add bacenta (building)"
                value={newName}
                onChange={(v) => setNewName(v)}
              />
              <button
                onClick={async () => {
                  const name = newName.trim();
                  if (!name) return;
                  try {
                    await addBacentaHandler({ name });
                    setNewName('');
                    showToast('success', 'Bacenta added');
                  } catch {}
                }}
                className="px-3 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white inline-flex items-center"
                title="Add Bacenta"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(b => (
          <button
            key={b.id}
            className="rounded-2xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 p-4 shadow-sm text-left hover:shadow-md transition"
            onClick={() => switchTab({ id: TabKeys.BACENTA_OUTREACH, name: `${b.name} Outreach`, data: { bacentaId: b.id } })}
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold truncate" title={b.name}>{b.name}</div>
              <GroupIcon className="w-4 h-4 text-gray-500" />
            </div>
            <p className="mt-3 text-sm text-gray-600">Open outreach for this building</p>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-gray-500 py-10">
            <SearchIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            No bacentas found
          </div>
        )}
      </div>
    </div>
  );
};

export default AllBacentasView;

