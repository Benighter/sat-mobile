import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { getCurrentOrMostRecentSunday } from '../../utils/dateUtils';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, PeopleIcon, ArrowLeftIcon, ArrowRightIcon, StarIcon, CameraIcon } from '../icons';
import { TabKeys } from '../../types';
import { headCountService } from '../../services/firebaseService';

// Redesigned to match the dashboard StatCard (like the "All Members" card)
const SundayHeadCountsView: React.FC = () => {
  const { displayedSundays, currentTab, switchTab } = useAppContext();

  const [selected, setSelected] = useState<string>('');
  const [activeSection, setActiveSection] = useState<
    'right' | 'left' | 'airport' | 'media' | 'overflow' | null
  >(null);

  // Totals per section for the selected date
  const [counts, setCounts] = useState<Record<'right' | 'left' | 'airport' | 'media' | 'overflow', number>>({
    right: 0,
    left: 0,
    airport: 0,
    media: 0,
    overflow: 0,
  });

  useEffect(() => {
    if (!displayedSundays || displayedSundays.length === 0) {
      setSelected('');
      return;
    }
    const current = getCurrentOrMostRecentSunday();
    const idx = displayedSundays.findIndex(d => d === current);
    setSelected(idx >= 0 ? displayedSundays[idx] : displayedSundays[displayedSundays.length - 1]);
  }, [displayedSundays]);

  // Pick section from tab context if provided
  useEffect(() => {
    const section = (currentTab?.data?.section as typeof activeSection) || null;
    if (section) setActiveSection(section);
    // If the tab carried a date, use it
    if (currentTab?.data?.date && typeof currentTab.data.date === 'string') {
      setSelected(currentTab.data.date);
    }
  }, [currentTab?.data]);

  // Subscribe to totals for each section for the selected date
  useEffect(() => {
    if (!selected) return;
    const sections: Array<'right' | 'left' | 'airport' | 'media' | 'overflow'> = ['right', 'left', 'airport', 'media', 'overflow'];
    const unsubs = sections.map((sec) =>
      headCountService.onValue(selected, sec, (rec) => {
        // Mother card should show the average of 1st/2nd/3rd counts (rounded), not the sum.
        // Always divide by 3 as requested; treat missing as 0.
        const c1 = Number(rec?.count1 ?? 0) || 0;
        const c2 = Number(rec?.count2 ?? 0) || 0;
        const c3 = Number(rec?.count3 ?? 0) || 0;
        const avg = Math.round((c1 + c2 + c3) / 3);
        setCounts((prev) => ({ ...prev, [sec]: avg }));
      })
    );
    return () => {
      unsubs.forEach((u) => u && u());
    };
  }, [selected]);

  const index = useMemo(() => (selected ? displayedSundays.indexOf(selected) : -1), [selected, displayedSundays]);

  const goPrev = () => {
    if (index > 0) setSelected(displayedSundays[index - 1]);
  };
  const goNext = () => {
    if (index >= 0 && index < displayedSundays.length - 1) setSelected(displayedSundays[index + 1]);
  };

  const formattedSelected = useMemo(() => {
    if (!selected) return '';
    const d = new Date(selected + 'T00:00:00');
    // Show Day Month Year (no weekday), e.g., "25 August 2025"
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  }, [selected]);

  const total = counts.right + counts.left + counts.airport + counts.media + counts.overflow;

  const sections: Array<{
    id: 'right' | 'left' | 'airport' | 'media' | 'overflow';
    title: string;
    color: string; // border-l color
    icon: React.ReactNode;
    hint?: string;
  }> = [
    { id: 'right', title: 'Right', color: 'border-l-blue-400 dark:border-l-blue-500', icon: <ArrowRightIcon className="w-6 h-6" /> },
    { id: 'left', title: 'Left', color: 'border-l-indigo-400 dark:border-l-indigo-500', icon: <ArrowLeftIcon className="w-6 h-6" /> },
    { id: 'airport', title: 'Airport Stars', color: 'border-l-amber-400 dark:border-l-amber-500', icon: <StarIcon className="w-6 h-6" /> },
    { id: 'media', title: 'Media', color: 'border-l-purple-400 dark:border-l-purple-500', icon: <CameraIcon className="w-6 h-6" /> },
    { id: 'overflow', title: 'Overflow', color: 'border-l-teal-400 dark:border-l-teal-500', icon: <PeopleIcon className="w-6 h-6" /> },
  ];

  const openSection = (id: 'right' | 'left' | 'airport' | 'media' | 'overflow') => {
    // Navigate to a dedicated section tab with context
    switchTab({ id: TabKeys.SUNDAY_HEAD_COUNT_SECTION, name: 'Head Count Section', data: { section: id, date: selected } });
  };

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Card style mirrors Dashboard StatCard (accent: indigo) */}
        <div className="p-4 sm:p-5 md:p-6 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 border-l-4 border-l-indigo-400 dark:border-l-indigo-500 rounded-lg desktop:rounded-xl shadow-sm">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wide">Sunday Head counts</p>
              <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-dark-700 dark:text-indigo-300 dark:border-dark-600">
                <PeopleIcon className="w-3.5 h-3.5" />
                Total: <span className="font-semibold tabular-nums">{total}</span>
              </span>
            </div>
            <div className="text-indigo-500 dark:text-indigo-400 ml-3 flex-shrink-0">
              <div className="w-6 h-6 sm:w-7 sm:h-7">
                <CalendarIcon className="w-full h-full" />
              </div>
            </div>
          </div>

          {/* Value + Navigation */}
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <button
              type="button"
              className="px-3 py-2 rounded-md bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-200 disabled:opacity-40"
              onClick={goPrev}
              disabled={index <= 0}
              aria-label="Previous Sunday"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>

            <div className="text-center">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-dark-100">
                {selected ? formattedSelected : 'No Sundays'}
              </div>
              <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-dark-300">Date only for now • more features coming</p>
            </div>

            <button
              type="button"
              className="px-3 py-2 rounded-md bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-200 disabled:opacity-40"
              onClick={goNext}
              disabled={index < 0 || index >= displayedSundays.length - 1}
              aria-label="Next Sunday"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Sections grid */
          // Totals now centered on the card rather than top-right
          }
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => openSection(s.id)}
                className={`group p-4 sm:p-5 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 ${s.color} border-l-4 rounded-lg shadow-sm hover:shadow-md transition-all text-left relative overflow-hidden`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wide">Section</p>
                    <p className="mt-0.5 text-lg sm:text-xl font-bold text-gray-900 dark:text-dark-100">{s.title}</p>
                  </div>
                  <div className="text-indigo-500 dark:text-indigo-400">
                    {s.icon}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-center">
                  <div className="min-w-[64px] text-center px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-dark-700 text-gray-800 dark:text-dark-100 border border-gray-200 dark:border-dark-600 shadow-sm text-base sm:text-lg font-semibold tabular-nums">
                    {counts[s.id]}
                  </div>
                </div>
                <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-dark-300 text-center">Tap to open section</p>
              </button>
            ))}
          </div>

          {/* Section content is now a separate tab; inline context panel removed */}
        </div>
      </div>
    </div>
  );
};

export default SundayHeadCountsView;
