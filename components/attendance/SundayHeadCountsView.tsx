import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { getCurrentOrMostRecentSunday } from '../../utils/dateUtils';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '../icons';

// Minimal v1: date-only navigator for Sundays in the selected month
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
    <div className="p-3 sm:p-4 md:p-5">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-xl shadow-sm p-4 sm:p-5">
          <div className="mb-3">
            <div className="flex items-center justify-center gap-3">
              <span className="inline-flex items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 p-2">
                <CalendarIcon className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-dark-100">
                Sunday Head counts
              </h2>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              className="px-3 py-2 rounded-md bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-200 disabled:opacity-40"
              onClick={goPrev}
              disabled={index <= 0}
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>

            <div className="flex-1 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-dark-100">
                {selected ? formattedSelected : 'No Sundays'}
              </div>
              <p className="text-sm text-gray-600 dark:text-dark-300 mt-1">Date only for now • more features coming</p>
            </div>

            <button
              type="button"
              className="px-3 py-2 rounded-md bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-200 disabled:opacity-40"
              onClick={goNext}
              disabled={index < 0 || index >= displayedSundays.length - 1}
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
