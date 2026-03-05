// Example: How to integrate Custom Prayers into PrayerMemberDetailsView.tsx

import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import CustomPrayersView from './CustomPrayersView';
import CustomPrayerTrackingView from './CustomPrayerTrackingView';
import { calculateTotalCustomHours } from '../../utils/customPrayerUtils';
import { getTuesdayToSundayRange } from '../../utils/dateUtils';

const PrayerMemberDetailsViewWithCustomPrayers: React.FC = () => {
  const {
    currentTab,
    members,
    prayerRecords,
    prayerSchedules,
    customPrayers,
    customPrayerRecords,
    saveCustomPrayerHandler,
    deleteCustomPrayerHandler,
    markCustomPrayerAttendanceHandler,
    userProfile
  } = useAppContext();

  const memberId: string = currentTab?.data?.memberId;
  const member = members.find(m => m.id === memberId);
  
  const [anchorDate, setAnchorDate] = useState<string>(getTuesdayToSundayRange()[0]);
  const [activeTab, setActiveTab] = useState<'church' | 'custom'>('church');
  
  // Filter custom prayers and records for this member
  const memberCustomPrayers = useMemo(
    () => customPrayers.filter(p => p.memberId === memberId),
    [customPrayers, memberId]
  );
  
  const memberCustomRecords = useMemo(
    () => customPrayerRecords.filter(r => r.memberId === memberId),
    [customPrayerRecords, memberId]
  );

  // Check if current user can edit (own profile or admin)
  const canEdit = useMemo(() => {
    if (!userProfile) return false;
    const isOwnProfile = userProfile.uid === memberId;
    const isAdmin = userProfile.role === 'Admin';
    return isOwnProfile || isAdmin;
  }, [userProfile, memberId]);

  // Calculate combined statistics
  const weekDates = useMemo(() => getTuesdayToSundayRange(anchorDate), [anchorDate]);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[weekDates.length - 1];

  const churchPrayerHours = useMemo(() => {
    // Existing church prayer hours calculation
    return prayerRecords
      .filter(r => r.memberId === memberId && r.date >= weekStart && r.date <= weekEnd && r.status === 'Prayed')
      .reduce((total, r) => {
        // Use getPrayerSessionInfo to get hours
        return total + 2; // Simplified - use actual calculation
      }, 0);
  }, [prayerRecords, memberId, weekStart, weekEnd]);

  const customPrayerHours = useMemo(() => {
    return calculateTotalCustomHours(
      memberCustomPrayers,
      memberCustomRecords,
      memberId,
      weekStart,
      weekEnd
    );
  }, [memberCustomPrayers, memberCustomRecords, memberId, weekStart, weekEnd]);

  const totalHours = churchPrayerHours + customPrayerHours;

  if (!member) {
    return <div>Member not found</div>;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header with Member Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900">{member.name}</h1>
        <p className="text-gray-600 mt-1">Prayer Tracking</p>
      </div>

      {/* Combined Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-blue-600 font-medium">Church Prayer Hours</p>
          <p className="text-3xl font-bold text-blue-700">{churchPrayerHours.toFixed(1)}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <p className="text-sm text-purple-600 font-medium">Custom Prayer Hours</p>
          <p className="text-3xl font-bold text-purple-700">{customPrayerHours.toFixed(1)}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <p className="text-sm text-green-600 font-medium">Total Hours</p>
          <p className="text-3xl font-bold text-green-700">{totalHours.toFixed(1)}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('church')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'church'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Church Prayers
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'custom'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Custom Prayers
              {memberCustomPrayers.length > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-600 py-0.5 px-2 rounded-full text-xs">
                  {memberCustomPrayers.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'church' ? (
            <div>
              {/* Existing church prayer tracking UI */}
              <p className="text-gray-600">Church prayer tracking grid goes here...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Custom Prayers Management */}
              <CustomPrayersView
                prayers={memberCustomPrayers}
                memberId={memberId}
                memberName={member.name}
                onSave={saveCustomPrayerHandler}
                onDelete={deleteCustomPrayerHandler}
                canEdit={canEdit}
              />

              {/* Custom Prayer Tracking */}
              {memberCustomPrayers.length > 0 && (
                <div className="mt-8">
                  <CustomPrayerTrackingView
                    prayers={memberCustomPrayers}
                    records={memberCustomRecords}
                    memberId={memberId}
                    memberName={member.name}
                    onMarkAttendance={markCustomPrayerAttendanceHandler}
                    canEdit={canEdit}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lifetime Statistics */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Lifetime Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Church Prayer Hours</p>
            <p className="text-2xl font-bold text-gray-900">
              {/* Calculate lifetime church hours */}
              {prayerRecords
                .filter(r => r.memberId === memberId && r.status === 'Prayed')
                .length * 2} {/* Simplified */}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Custom Prayer Hours</p>
            <p className="text-2xl font-bold text-gray-900">
              {calculateTotalCustomHours(
                memberCustomPrayers,
                memberCustomRecords,
                memberId,
                '2000-01-01', // All time
                '2099-12-31'
              ).toFixed(1)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrayerMemberDetailsViewWithCustomPrayers;

// ============================================
// Alternative: Simpler Integration (No Tabs)
// ============================================

const SimplerIntegration: React.FC = () => {
  const {
    currentTab,
    members,
    customPrayers,
    customPrayerRecords,
    saveCustomPrayerHandler,
    deleteCustomPrayerHandler,
    markCustomPrayerAttendanceHandler,
    userProfile
  } = useAppContext();

  const memberId: string = currentTab?.data?.memberId;
  const member = members.find(m => m.id === memberId);
  
  const memberCustomPrayers = customPrayers.filter(p => p.memberId === memberId);
  const memberCustomRecords = customPrayerRecords.filter(r => r.memberId === memberId);
  
  const canEdit = userProfile?.uid === memberId || userProfile?.role === 'Admin';

  if (!member) return <div>Member not found</div>;

  return (
    <div className="space-y-8 p-6">
      {/* Church Prayer Section (existing) */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Church Prayers</h2>
        {/* Existing church prayer UI */}
      </section>

      {/* Custom Prayers Section (new) */}
      <section>
        <CustomPrayersView
          prayers={memberCustomPrayers}
          memberId={memberId}
          memberName={member.name}
          onSave={saveCustomPrayerHandler}
          onDelete={deleteCustomPrayerHandler}
          canEdit={canEdit}
        />
      </section>

      {/* Custom Prayer Tracking (new) */}
      {memberCustomPrayers.length > 0 && (
        <section>
          <CustomPrayerTrackingView
            prayers={memberCustomPrayers}
            records={memberCustomRecords}
            memberId={memberId}
            memberName={member.name}
            onMarkAttendance={markCustomPrayerAttendanceHandler}
            canEdit={canEdit}
          />
        </section>
      )}
    </div>
  );
};

