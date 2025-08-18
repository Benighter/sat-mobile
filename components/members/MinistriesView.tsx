import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { MINISTRY_OPTIONS } from '../../constants';
import { Member } from '../../types';
import { ClipboardIcon, UserIcon } from '../icons';

const MinistriesView: React.FC = () => {
  const { members, switchTab } = useAppContext();
  const [selectedMinistry, setSelectedMinistry] = useState<string>(''); // '' means all ministries

  const membersWithMinistry = useMemo(() => members.filter(m => !!m.ministry && m.ministry.trim() !== ''), [members]);

  const filtered = useMemo(() => {
    if (!selectedMinistry) return membersWithMinistry;
    return membersWithMinistry.filter(m => (m.ministry || '').toLowerCase() === selectedMinistry.toLowerCase());
  }, [membersWithMinistry, selectedMinistry]);

  const totalCount = filtered.filter(m => !m.frozen).length;

  const handleCopyMembers = () => {
    switchTab({
      id: 'copy_members',
      name: 'Copy Members',
      data: {
        ministryOnly: true,
        ministryName: selectedMinistry || null,
        // Defaults for copy views
        searchTerm: '',
        roleFilter: 'all',
        showFrozen: false
      }
    });
  };

  const handleCopyAbsentees = () => {
    switchTab({
      id: 'copy_absentees',
      name: 'Copy Absentees',
      data: {
        ministryOnly: true,
        ministryName: selectedMinistry || null,
        searchTerm: '',
        roleFilter: 'all',
        showFrozen: false
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Ministries</h1>
          <p className="text-sm text-gray-600">View members serving in ministries and filter by ministry.</p>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <div className="w-full sm:w-72">
            <select
              value={selectedMinistry}
              onChange={(e) => setSelectedMinistry(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white text-gray-900 text-center cursor-pointer"
            >
              <option value="">All Ministries</option>
              {MINISTRY_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="text-sm text-gray-700">
            {selectedMinistry ? (
              <span>
                {selectedMinistry}: {totalCount} member{totalCount !== 1 ? 's' : ''}
              </span>
            ) : (
              <span>
                All ministries: {totalCount} member{totalCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Copy buttons */}
        <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={handleCopyMembers}
            disabled={totalCount === 0}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg shadow-sm text-sm"
            title="Copy ministry members"
          >
            <ClipboardIcon className="w-4 h-4" />
            <span>Copy Members ({totalCount})</span>
          </button>
          <button
            onClick={handleCopyAbsentees}
            disabled={totalCount === 0}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg shadow-sm text-sm"
            title="Copy absentees for ministry"
          >
            <ClipboardIcon className="w-4 h-4" />
            <span>Copy Absentees</span>
          </button>
        </div>
      </div>

      {/* Simple list for now (name and ministry) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-gray-500">No members found for this selection.</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filtered.map((m: Member, idx: number) => (
              <li key={m.id} className={`flex items-center gap-3 px-4 py-3 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden ${m.bornAgainStatus ? 'bg-green-100 ring-2 ring-green-300' : 'bg-gray-100'}`}>
                  {m.profilePicture ? (
                    <img src={m.profilePicture} alt={m.firstName} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-4 h-4 text-gray-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900 truncate">{m.firstName} {m.lastName || ''}</span>
                    {m.frozen && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 border border-sky-200">Frozen</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 truncate">{m.ministry || '-'}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MinistriesView;
