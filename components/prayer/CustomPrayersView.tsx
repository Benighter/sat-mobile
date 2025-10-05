import React, { useState, useMemo } from 'react';
import { CustomPrayer, CustomPrayerCategory, CustomPrayerRecord } from '../../types';
import { formatPrayerTime, getActiveDaysString, calculatePrayerDuration } from '../../utils/customPrayerUtils';
import CustomPrayerFormModal from './CustomPrayerFormModal';
import { PlusIcon, EditIcon, TrashIcon, ChevronDownIcon, ChevronRightIcon, ChevronLeftIcon, CheckIcon } from '../icons';

interface CustomPrayersViewProps {
  prayers: CustomPrayer[];
  records: CustomPrayerRecord[];
  memberId: string;
  memberName: string;
  onSave: (prayer: Omit<CustomPrayer, 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => Promise<void>;
  onDelete: (prayerId: string) => Promise<void>;
  onMarkAttendance: (customPrayerId: string, memberId: string, date: string, status: 'Prayed' | 'Missed') => Promise<void>;
  canEdit: boolean; // Whether the current user can edit (own prayers or admin)
}

const CustomPrayersView: React.FC<CustomPrayersViewProps> = ({
  prayers,
  records,
  memberId,
  memberName,
  onSave,
  onDelete,
  onMarkAttendance,
  canEdit
}) => {
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPrayer, setEditingPrayer] = useState<CustomPrayer | null>(null);
  const [deletingPrayerId, setDeletingPrayerId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<CustomPrayerCategory>>(
    new Set(['Personal', 'All-night Vigil', 'Quiet Time', 'Other'])
  );

  // Current month state
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Get today's date
  const today = new Date().toISOString().slice(0, 10);

  // Get month start and end dates
  const monthStart = useMemo(() => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    return date.toISOString().slice(0, 10);
  }, [currentMonth]);

  const monthEnd = useMemo(() => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    return date.toISOString().slice(0, 10);
  }, [currentMonth]);

  // Get all records for the current month
  const monthRecords = useMemo(() => {
    const map = new Map<string, CustomPrayerRecord[]>();
    records.forEach(r => {
      if (r.date >= monthStart && r.date <= monthEnd) {
        const existing = map.get(r.customPrayerId) || [];
        existing.push(r);
        map.set(r.customPrayerId, existing);
      }
    });
    return map;
  }, [records, monthStart, monthEnd]);

  // Get today's records
  const todayRecords = useMemo(() => {
    const map = new Map<string, CustomPrayerRecord>();
    records.forEach(r => {
      if (r.date === today) {
        map.set(r.customPrayerId, r);
      }
    });
    return map;
  }, [records, today]);

  // Calculate monthly stats per category
  const categoryStats = useMemo(() => {
    const stats: Record<CustomPrayerCategory, { total: number; completed: number; hours: number }> = {
      'Personal': { total: 0, completed: 0, hours: 0 },
      'All-night Vigil': { total: 0, completed: 0, hours: 0 },
      'Quiet Time': { total: 0, completed: 0, hours: 0 },
      'Other': { total: 0, completed: 0, hours: 0 }
    };

    prayers.filter(p => p.isActive).forEach(prayer => {
      const category = prayer.category || 'Other';
      const prayerRecords = monthRecords.get(prayer.id) || [];
      const completedCount = prayerRecords.filter(r => r.status === 'Prayed').length;
      const duration = calculatePrayerDuration(prayer.startTime, prayer.endTime);

      stats[category].total += prayerRecords.length;
      stats[category].completed += completedCount;
      stats[category].hours += completedCount * duration;
    });

    return stats;
  }, [prayers, monthRecords]);

  // Group prayers by category
  const prayersByCategory = useMemo(() => {
    const grouped: Record<CustomPrayerCategory, CustomPrayer[]> = {
      'Personal': [],
      'All-night Vigil': [],
      'Quiet Time': [],
      'Other': []
    };

    prayers.filter(p => p.isActive).forEach(prayer => {
      const category = prayer.category || 'Other';
      grouped[category].push(prayer);
    });

    return grouped;
  }, [prayers]);

  const inactivePrayers = useMemo(() => prayers.filter(p => !p.isActive), [prayers]);

  const toggleCategory = (category: CustomPrayerCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    // Reset all categories to collapsed when changing months
    setExpandedCategories(new Set());
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    // Reset all categories to collapsed when changing months
    setExpandedCategories(new Set());
  };

  const goToCurrentMonth = () => {
    setCurrentMonth(new Date());
    setExpandedCategories(new Set(['Personal', 'All-night Vigil', 'Quiet Time', 'Other']));
  };

  const isCurrentMonth = currentMonth.getMonth() === new Date().getMonth() &&
                         currentMonth.getFullYear() === new Date().getFullYear();

  const handleAddNew = () => {
    setEditingPrayer(null);
    setIsFormModalOpen(true);
  };

  const handleEdit = (prayer: CustomPrayer) => {
    setEditingPrayer(prayer);
    setIsFormModalOpen(true);
  };

  const handleTogglePrayer = async (prayer: CustomPrayer) => {
    if (!canEdit) return;

    const existingRecord = todayRecords.get(prayer.id);
    const newStatus: 'Prayed' | 'Missed' = existingRecord?.status === 'Prayed' ? 'Missed' : 'Prayed';

    try {
      await onMarkAttendance(prayer.id, memberId, today, newStatus);
    } catch (error) {
      console.error('Failed to mark prayer:', error);
    }
  };

  const handleDelete = async (prayerId: string) => {
    if (!window.confirm('Are you sure you want to delete this custom prayer? This action cannot be undone.')) {
      return;
    }

    setDeletingPrayerId(prayerId);
    try {
      await onDelete(prayerId);
    } catch (error) {
      console.error('Failed to delete prayer:', error);
    } finally {
      setDeletingPrayerId(null);
    }
  };

  const renderPrayerCard = (prayer: CustomPrayer) => {
    const categoryDisplay = prayer.category === 'Other' && prayer.customCategory
      ? prayer.customCategory
      : prayer.category;

    const record = todayRecords.get(prayer.id);
    const isPrayed = record?.status === 'Prayed';
    const duration = calculatePrayerDuration(prayer.startTime, prayer.endTime);

    // Monthly stats for this prayer
    const prayerMonthRecords = monthRecords.get(prayer.id) || [];
    const monthlyCompleted = prayerMonthRecords.filter(r => r.status === 'Prayed').length;
    const monthlyTotal = prayerMonthRecords.length;

    return (
      <div
        key={prayer.id}
        className={`bg-white rounded-lg p-3 transition-all ${
          !prayer.isActive ? 'opacity-60' : isPrayed ? 'bg-green-50' : ''
        }`}
      >
        <div className="flex items-start space-x-3">
          {/* Checkbox */}
          {prayer.isActive && (
            <button
              onClick={() => handleTogglePrayer(prayer)}
              disabled={!canEdit}
              className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                isPrayed
                  ? 'bg-green-500 border-green-500'
                  : 'border-gray-300 hover:border-green-400'
              } ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {isPrayed && <CheckIcon className="w-3.5 h-3.5 text-white" />}
            </button>
          )}

          <div className="flex-1 min-w-0">
            {/* Prayer Name */}
            <div className="flex items-center justify-between mb-1">
              <h3 className={`text-sm font-semibold truncate ${isPrayed ? 'text-green-900' : 'text-gray-900'}`}>
                {prayer.name}
              </h3>
              {isPrayed && (
                <span className="ml-2 px-1.5 py-0.5 bg-green-500 text-white text-xs rounded font-medium flex-shrink-0">
                  ✓
                </span>
              )}
            </div>

            {/* Category Badge */}
            <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded mb-1.5">
              {categoryDisplay}
            </span>

            {/* Time */}
            <div className="flex items-center text-xs text-gray-600 mb-1">
              <svg className="w-3 h-3 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{formatPrayerTime(prayer.startTime, prayer.endTime)}</span>
              <span className="mx-1.5 text-gray-400">•</span>
              <span>{duration.toFixed(1)}h</span>
            </div>

            {/* Active Days */}
            <div className="text-xs text-gray-500 mb-2">
              {getActiveDaysString(prayer.days)}
            </div>

            {/* Monthly Progress */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-500">This month</span>
              <span className="text-xs font-semibold text-blue-600">
                {monthlyCompleted}/{monthlyTotal} completed
              </span>
            </div>
          </div>

          {/* Actions */}
          {canEdit && (
            <div className="flex items-center space-x-2 ml-4">
              <button
                onClick={() => handleEdit(prayer)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit prayer"
              >
                <EditIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleDelete(prayer.id)}
                disabled={deletingPrayerId === prayer.id}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                title="Delete prayer"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Month Navigation Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Previous month"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>

          <div className="text-center flex-1">
            <h2 className="text-xl font-bold">
              {currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </h2>
            <p className="text-xs text-blue-100 mt-0.5">
              {memberName}'s Prayer Schedule
            </p>
          </div>

          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Next month"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>

        {!isCurrentMonth && (
          <button
            onClick={goToCurrentMonth}
            className="w-full py-1.5 px-3 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
          >
            Jump to Current Month
          </button>
        )}
      </div>

      {/* Category-based Prayer Organization */}
      {Object.keys(prayersByCategory).some(cat => prayersByCategory[cat as CustomPrayerCategory].length > 0) && (
        <div className="space-y-3">
          {(['Personal', 'All-night Vigil', 'Quiet Time', 'Other'] as CustomPrayerCategory[]).map(category => {
            const categoryPrayers = prayersByCategory[category];
            if (categoryPrayers.length === 0) return null;

            const isExpanded = expandedCategories.has(category);

            const stats = categoryStats[category];

            return (
              <div key={category} className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    {isExpanded ? (
                      <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRightIcon className="w-4 h-4 text-gray-500" />
                    )}
                    <h3 className="text-base font-bold text-gray-900">{category}</h3>
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-blue-700 bg-blue-100 rounded-full">
                      {categoryPrayers.length}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-0.5">This Month</div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-green-600">
                        {stats.completed}/{stats.total}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-sm font-semibold text-blue-600">
                        {stats.hours.toFixed(1)}h
                      </span>
                    </div>
                  </div>
                </button>

                {/* Category Content */}
                <div
                  className={`transition-all duration-300 ease-in-out ${
                    isExpanded ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'
                  } overflow-hidden`}
                >
                  <div className="p-3 space-y-2 bg-gray-50">
                    {categoryPrayers.map(renderPrayerCard)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inactive Prayers */}
      {inactivePrayers.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-500 mb-3">
            Inactive Prayers ({inactivePrayers.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inactivePrayers.map(renderPrayerCard)}
          </div>
        </div>
      )}

      {/* Empty State */}
      {prayers.length === 0 && (
        <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border-2 border-dashed border-blue-200">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No custom prayers yet</h3>
          <p className="text-sm text-gray-600 mb-6 max-w-sm mx-auto">
            {canEdit
              ? 'Create personalized prayer schedules to track your spiritual journey.'
              : 'This member has not created any custom prayers yet.'}
          </p>
          {canEdit && (
            <button
              onClick={handleAddNew}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Create Your First Prayer
            </button>
          )}
        </div>
      )}

      {/* Floating Action Button (when prayers exist) */}
      {canEdit && prayers.length > 0 && (
        <button
          onClick={handleAddNew}
          className="fixed bottom-8 right-8 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all duration-200 transform hover:scale-110 z-50 flex items-center justify-center group"
          title="Add new prayer"
        >
          <PlusIcon className="w-6 h-6 group-hover:rotate-90 transition-transform duration-200" />
        </button>
      )}

      {/* Form Modal */}
      <CustomPrayerFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingPrayer(null);
        }}
        onSave={onSave}
        prayer={editingPrayer}
        memberId={memberId}
      />
    </div>
  );
};

export default CustomPrayersView;

