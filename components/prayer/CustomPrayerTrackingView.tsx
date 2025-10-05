import React, { useMemo, useState } from 'react';
import { CustomPrayer, CustomPrayerRecord } from '../../types';
import { calculatePrayerDuration, formatPrayerTime, getActiveDaysString } from '../../utils/customPrayerUtils';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, CheckIcon } from '../icons';

interface CustomPrayerTrackingViewProps {
  prayers: CustomPrayer[];
  records: CustomPrayerRecord[];
  memberId: string;
  memberName: string;
  onMarkAttendance: (customPrayerId: string, memberId: string, date: string, status: 'Prayed' | 'Missed') => Promise<void>;
  canEdit: boolean;
}

const CustomPrayerTrackingView: React.FC<CustomPrayerTrackingViewProps> = ({
  prayers,
  records,
  memberId,
  memberName,
  onMarkAttendance,
  canEdit
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Only show active prayers
  const activePrayers = useMemo(() => prayers.filter(p => p.isActive), [prayers]);

  // Get today's records
  const todayRecords = useMemo(() => {
    const map = new Map<string, CustomPrayerRecord>();
    records.forEach(r => {
      if (r.date === selectedDate) {
        map.set(r.customPrayerId, r);
      }
    });
    return map;
  }, [records, selectedDate]);

  // Calculate today's stats
  const todayStats = useMemo(() => {
    let totalHours = 0;
    let prayedCount = 0;

    activePrayers.forEach(prayer => {
      const record = todayRecords.get(prayer.id);
      if (record && record.status === 'Prayed') {
        prayedCount++;
        totalHours += calculatePrayerDuration(prayer.startTime, prayer.endTime);
      }
    });

    return { totalHours, prayedCount, totalPrayers: activePrayers.length };
  }, [activePrayers, todayRecords]);

  const handleTogglePrayer = async (prayer: CustomPrayer) => {
    if (!canEdit) return;

    const existingRecord = todayRecords.get(prayer.id);
    const newStatus: 'Prayed' | 'Missed' = existingRecord?.status === 'Prayed' ? 'Missed' : 'Prayed';

    try {
      await onMarkAttendance(prayer.id, memberId, selectedDate, newStatus);
    } catch (error) {
      console.error('Failed to mark prayer:', error);
    }
  };

  const goToPreviousDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().slice(0, 10));
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';

    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };



  if (activePrayers.length === 0) {
    return null; // Don't show anything if no prayers
  }

  const isToday = selectedDate === new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Date Navigation Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-5 text-white">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={goToPreviousDay}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Previous day"
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </button>

          <div className="text-center flex-1">
            <div className="flex items-center justify-center space-x-2 mb-1">
              <CalendarIcon className="w-5 h-5" />
              <h3 className="text-lg font-semibold">{formatDate(selectedDate)}</h3>
            </div>
            <p className="text-sm text-blue-100">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </p>
          </div>

          <button
            onClick={goToNextDay}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Next day"
          >
            <ChevronRightIcon className="w-6 h-6" />
          </button>
        </div>

        {!isToday && (
          <button
            onClick={goToToday}
            className="w-full py-2 px-4 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
          >
            Jump to Today
          </button>
        )}
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg p-4 border-2 border-blue-200 shadow-sm">
          <p className="text-xs text-gray-600 font-medium mb-1">Total Prayers</p>
          <p className="text-2xl font-bold text-gray-900">{todayStats.totalPrayers}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border-2 border-green-200 shadow-sm">
          <p className="text-xs text-gray-600 font-medium mb-1">Completed</p>
          <p className="text-2xl font-bold text-green-600">{todayStats.prayedCount}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border-2 border-purple-200 shadow-sm">
          <p className="text-xs text-gray-600 font-medium mb-1">Total Hours</p>
          <p className="text-2xl font-bold text-purple-600">{todayStats.totalHours.toFixed(1)}</p>
        </div>
      </div>

      {/* Prayer Checklist */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-3 border-b border-gray-200">
          <h4 className="font-semibold text-gray-900">Prayer Checklist</h4>
          <p className="text-xs text-gray-600 mt-0.5">Tap to mark as completed</p>
        </div>

        <div className="divide-y divide-gray-100">
          {activePrayers.map(prayer => {
            const record = todayRecords.get(prayer.id);
            const isPrayed = record?.status === 'Prayed';
            const duration = calculatePrayerDuration(prayer.startTime, prayer.endTime);

            return (
              <button
                key={prayer.id}
                onClick={() => handleTogglePrayer(prayer)}
                disabled={!canEdit}
                className={`w-full px-5 py-4 flex items-center space-x-4 transition-all duration-200 ${
                  canEdit ? 'hover:bg-gray-50 active:bg-gray-100 cursor-pointer' : 'cursor-default'
                } ${isPrayed ? 'bg-green-50/50' : ''}`}
              >
                {/* Checkbox */}
                <div className={`flex-shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${
                  isPrayed
                    ? 'bg-green-500 border-green-500 scale-110'
                    : 'border-gray-300 hover:border-green-400'
                }`}>
                  {isPrayed && <CheckIcon className="w-5 h-5 text-white" />}
                </div>

                {/* Prayer Info */}
                <div className="flex-1 text-left">
                  <h5 className={`font-semibold ${isPrayed ? 'text-green-900' : 'text-gray-900'}`}>
                    {prayer.name}
                  </h5>
                  <div className="flex items-center space-x-3 mt-1">
                    <span className="text-xs text-gray-600 flex items-center">
                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatPrayerTime(prayer.startTime, prayer.endTime)}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                      {prayer.category}
                    </span>
                    <span className="text-xs text-gray-500">
                      {duration.toFixed(1)}h
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {getActiveDaysString(prayer.days)}
                  </p>
                </div>

                {/* Status Badge */}
                {isPrayed && (
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                      ✓ Completed
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CustomPrayerTrackingView;

