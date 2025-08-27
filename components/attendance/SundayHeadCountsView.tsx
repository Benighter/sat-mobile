import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { getCurrentOrMostRecentSunday } from '../../utils/dateUtils';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '../icons';

// Redesigned to match the dashboard StatCard (like the "All Members" card)
const SundayHeadCountsView: React.FC = () => {
  const { displayedSundays } = useAppContext();

  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    if (!displayedSundays || displayedSundays.length === 0) {
      setSelected('');
      return;
    }
    const current = getCurrentOrMostRecentSunday();
    const idx = displayedSundays.findIndex(d => d === current);
    setSelected(idx >= 0 ? displayedSundays[idx] : displayedSundays[displayedSundays.length - 1]);
  }, [displayedSundays]);

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

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        {/* Card style mirrors Dashboard StatCard (accent: indigo) */}
        <div className="p-4 sm:p-5 md:p-6 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 border-l-4 border-l-indigo-400 dark:border-l-indigo-500 rounded-lg desktop:rounded-xl shadow-sm">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wide">Sunday Head counts</p>
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
        </div>
      </div>
    </div>
  );
};

export default SundayHeadCountsView;
