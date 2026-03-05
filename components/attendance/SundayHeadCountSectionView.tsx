import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { CalendarIcon, PeopleIcon } from '../icons';
import { headCountService } from '../../services/firebaseService';

const titleMap: Record<string, string> = {
  right: 'Right',
  left: 'Left',
  airport: 'Airport Stars',
  media: 'Media',
  overflow: 'Overflow',
};

const SundayHeadCountSectionView: React.FC = () => {
  const { currentTab } = useAppContext();
  const section = (currentTab?.data?.section as string) || '';
  const date = (currentTab?.data?.date as string) || '';

  const sectionTitle = titleMap[section] || 'Section';

  const [counts, setCounts] = useState<{ count1?: number; count2?: number; count3?: number; total?: number }>({});
  const [editing, setEditing] = useState<null | { field: 'count1' | 'count2' | 'count3'; value: string }>(null);
  const [saving, setSaving] = useState(false);

  const formatted = useMemo(() => {
    if (!date) return '';
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  }, [date]);

  // Subscribe to Firestore record for this date+section
  useEffect(() => {
    if (!date || !section) return;
    const unsub = headCountService.onValue(date, section, (rec) => {
      const c1 = Number(rec?.count1 ?? 0) || 0;
      const c2 = Number(rec?.count2 ?? 0) || 0;
      const c3 = Number(rec?.count3 ?? 0) || 0;
      const avg = Math.round((c1 + c2 + c3) / 3);
      setCounts({ count1: c1, count2: c2, count3: c3, total: avg });
    });
    return () => unsub();
  }, [date, section]);

  const openEdit = (field: 'count1' | 'count2' | 'count3') => {
    const currentNum = Number(counts[field] ?? 0) || 0;
    // If no existing value, start with an empty input (not "0").
    setEditing({ field, value: currentNum > 0 ? String(currentNum) : '' });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const raw = editing.value.trim();
    const parsed = Math.max(0, Math.floor(Number(raw || '0')));
    if (saving) return; // prevent double-click spamming
    setSaving(true);
    try {
      // Send all values to minimize reads/writes
      const next = {
        count1: editing.field === 'count1' ? parsed : (counts.count1 ?? 0),
        count2: editing.field === 'count2' ? parsed : (counts.count2 ?? 0),
        count3: editing.field === 'count3' ? parsed : (counts.count3 ?? 0),
      };
      await headCountService.updateCounts(date, section, next);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="p-4 sm:p-5 md:p-6 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 border-l-4 border-l-indigo-400 dark:border-l-indigo-500 rounded-lg desktop:rounded-xl shadow-sm">
          <div className="space-y-2 sm:space-y-3">
            {/* Row 1: small label + Average on the right */}
            <div className="flex items-center justify-between">
              <p className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wide">Head Count Section</p>
              <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-dark-700 dark:text-emerald-300 dark:border-dark-600">
                Average: <span className="font-semibold tabular-nums">{(counts.total ?? 0) || 0}</span>
              </span>
            </div>

            {/* Row 2: prominent title */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-dark-100">{sectionTitle}</h2>
            </div>

            {/* Row 3: meta info badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200 dark:bg-dark-700 dark:text-dark-100 dark:border-dark-600">
                <CalendarIcon className="w-3.5 h-3.5" />
                {formatted || date}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-dark-700 dark:text-indigo-300 dark:border-dark-600">
                <PeopleIcon className="w-3.5 h-3.5" />
                {sectionTitle}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm text-gray-600 dark:text-dark-300">Tap a card below to enter the count. You can update anytime.</p>
          </div>

          {/* Count cards */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {([
              { key: 'count1', title: '1st count' },
              { key: 'count2', title: '2nd count' },
              { key: 'count3', title: '3rd count' },
            ] as const).map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => openEdit(c.key)}
                className="group p-4 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 border-l-4 border-l-indigo-400 dark:border-l-indigo-500 rounded-lg shadow-sm hover:shadow-md transition-all text-left"
              >
                <p className="text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wide">{c.title}</p>
                <div className="mt-2 flex items-center justify-center">
                  <div className="min-w-[64px] text-center px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-dark-700 text-gray-800 dark:text-dark-100 border border-gray-200 dark:border-dark-600 shadow-sm text-base sm:text-lg font-semibold tabular-nums">
                    {counts[c.key] ?? 0}
                  </div>
                </div>
                <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-dark-300 text-center">Tap to edit</p>
              </button>
            ))}
          </div>
        </div>

        {/* Inline lightweight modal for numeric entry */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-sm p-4 sm:p-5 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Enter {editing.field.replace('count','')}{editing.field==='count1'?'st':editing.field==='count2'?'nd':'rd'} count</h3>
              <div className="mt-3">
                <input
                  type="number"
                  inputMode="numeric"
                  className="w-full px-3 py-2 rounded-md bg-white dark:bg-dark-700 border border-gray-300 dark:border-dark-600 text-gray-900 dark:text-dark-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={editing.value}
                  onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                  min={0}
                  placeholder="Enter a number"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-dark-400">Whole numbers only. Negative values will be set to 0.</p>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="px-3 py-2 rounded-md border border-gray-300 dark:border-dark-600 text-gray-700 dark:text-dark-100 bg-white dark:bg-dark-700" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
                <button type="button" className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60" onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SundayHeadCountSectionView;
