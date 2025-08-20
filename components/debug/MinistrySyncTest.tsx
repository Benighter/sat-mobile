import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { getMinistryAggregatedData } from '../../services/ministryDataService';

const MinistrySyncTest: React.FC = () => {
  const { isMinistryContext, activeMinistryName, showToast } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const handleDirectDataFetch = async () => {
    if (!activeMinistryName) {
      showToast('error', 'No Ministry Selected', 'Please select a ministry first');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔄 [Test] Fetching cross-church data like SuperAdmin for:', activeMinistryName);
      const result = await getMinistryAggregatedData(activeMinistryName);
      setLastResult({
        success: true,
        members: result.members.length,
        bacentas: result.bacentas.length,
        attendance: result.attendanceRecords.length,
        newBelievers: result.newBelievers.length,
        confirmations: result.sundayConfirmations.length,
        guests: result.guests.length,
        sourceChurches: result.sourceChurches.length
      });
      showToast('success', 'Direct Data Fetch', `Found ${result.members.length} members from ${result.sourceChurches.length} churches`);
    } catch (error: any) {
      showToast('error', 'Direct Data Fetch Failed', error.message || 'Unknown error');
      setLastResult({ success: false, error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshCurrentData = () => {
    showToast('info', 'Data Refresh', 'Ministry mode automatically uses live cross-church data like SuperAdmin');
  };

  if (!isMinistryContext) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">Ministry Sync Test is only available in Ministry Mode.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Ministry Synchronization Test</h2>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
            <div>
              <h3 className="font-medium text-green-900">✅ Direct Firestore Mode</h3>
              <p className="text-sm text-green-700">Using direct cross-church queries like SuperAdmin (no Cloud Functions needed)</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div>
              <h3 className="font-medium text-blue-900">Current Ministry</h3>
              <p className="text-sm text-blue-700">{activeMinistryName || 'Not specified'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={handleDirectDataFetch}
              disabled={isLoading || !activeMinistryName}
              className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Fetching...' : 'Test Direct Data Fetch'}
            </button>

            <button
              onClick={handleRefreshCurrentData}
              disabled={isLoading}
              className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Refresh Current Data
            </button>
          </div>

          {lastResult && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Last Sync Result</h4>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                {JSON.stringify(lastResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-md font-semibold text-gray-900 mb-3">How It Works (SuperAdmin Style)</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p><strong>Direct Firestore Queries:</strong> Ministry mode queries all churches directly, just like SuperAdmin does for admin data.</p>
          <p><strong>Cross-Church Aggregation:</strong> Finds all churches with members of your ministry and aggregates their data in real-time.</p>
          <p><strong>No Cloud Functions:</strong> Uses direct Firestore queries - no deployment needed, no CORS issues.</p>
          <p><strong>Real-time Updates:</strong> Live listeners on all relevant churches provide instant updates when data changes.</p>
        </div>
      </div>
    </div>
  );
};

export default MinistrySyncTest;
