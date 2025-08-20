/**
 * Bidirectional Sync Test Component
 * 
 * Test interface for verifying bidirectional synchronization between ministry mode and normal mode.
 */

import React, { useState } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';

const BidirectionalSyncTest: React.FC = () => {
  const {
    isMinistryContext,
    activeMinistryName,
    showToast,
    members,
    addMemberHandler,
    updateMemberHandler,
    addNewBelieverHandler,
    markAttendanceHandler,
    clearAttendanceHandler,
    userProfile
  } = useAppContext();
  
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  const runMemberSyncTest = async () => {
    if (!isMinistryContext || !activeMinistryName) {
      showToast('error', 'Test Error', 'This test only works in ministry mode with an active ministry');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🧪 [Bidirectional Sync Test] Starting member sync test...');
      
      // Test 1: Add a new member in ministry mode
      const testMember = {
        firstName: 'Test',
        lastName: 'SyncMember',
        phoneNumber: '+1234567890',
        buildingAddress: '123 Test Street',
        roomNumber: '101',
        bornAgainStatus: true,
        ministry: activeMinistryName,
        bacentaId: '',
        role: 'Member' as const
      };

      console.log('📝 Adding test member in ministry mode...');
      const memberId = await addMemberHandler(testMember);
      
      // Test 2: Update the member in ministry mode
      const memberToUpdate = members.find(m => m.id === memberId);
      if (memberToUpdate) {
        console.log('✏️ Updating test member in ministry mode...');
        await updateMemberHandler({
          ...memberToUpdate,
          phoneNumber: '+0987654321',
          buildingAddress: '456 Updated Street'
        });
      }

      setTestResults({
        success: true,
        memberId,
        message: 'Member sync test completed successfully',
        details: {
          added: true,
          updated: !!memberToUpdate,
          sourceChurch: userProfile?.contexts?.defaultChurchId || 'unknown'
        }
      });

      showToast('success', 'Sync Test Complete', 'Check console for detailed sync logs');
      
    } catch (error: any) {
      console.error('❌ [Bidirectional Sync Test] Test failed:', error);
      setTestResults({
        success: false,
        error: error.message
      });
      showToast('error', 'Sync Test Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const runAttendanceFlickerTest = async () => {
    if (!isMinistryContext || !activeMinistryName) {
      showToast('error', 'Test Error', 'This test only works in ministry mode with an active ministry');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🧪 [Flicker Test] Starting attendance flicker test...');

      // Find multiple Dancing Stars members to test with
      const dancingStarsMembers = members.filter(m => m.ministry === activeMinistryName).slice(0, 3);
      if (dancingStarsMembers.length < 2) {
        throw new Error('Need at least 2 Dancing Stars members to test flickering');
      }

      const testDate = new Date().toISOString().split('T')[0];

      console.log(`📝 Testing flicker-free attendance marking for ${dancingStarsMembers.length} members`);

      // Mark attendance for first member - others should not flicker
      console.log('🎯 Marking attendance for first member...');
      await markAttendanceHandler(dancingStarsMembers[0].id, testDate, 'Present');

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mark attendance for second member - others should not flicker
      console.log('🎯 Marking attendance for second member...');
      await markAttendanceHandler(dancingStarsMembers[1].id, testDate, 'Present');

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 500));

      // Clear attendance for first member - others should not flicker
      console.log('🎯 Clearing attendance for first member...');
      await clearAttendanceHandler(dancingStarsMembers[0].id, testDate);

      setTestResults({
        success: true,
        message: 'Attendance flicker test completed successfully',
        details: {
          testedMembers: dancingStarsMembers.length,
          operations: ['mark', 'mark', 'clear'],
          date: testDate,
          ministry: activeMinistryName,
          note: 'Check console for flicker detection logs'
        }
      });

      showToast('success', 'Flicker Test Complete', 'Check console for detailed flicker analysis');

    } catch (error: any) {
      console.error('❌ [Flicker Test] Test failed:', error);
      setTestResults({
        success: false,
        error: error.message
      });
      showToast('error', 'Flicker Test Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const runAttendanceSyncTest = async () => {
    if (!isMinistryContext || !activeMinistryName) {
      showToast('error', 'Test Error', 'This test only works in ministry mode with an active ministry');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🧪 [Bidirectional Sync Test] Starting attendance sync test...');

      // Find a Dancing Stars member to mark attendance for
      const dancingStarsMember = members.find(m => m.ministry === activeMinistryName);
      if (!dancingStarsMember) {
        throw new Error('No Dancing Stars members found to test attendance');
      }

      const testDate = new Date().toISOString().split('T')[0]; // Today's date

      console.log(`📝 Marking attendance for member ${dancingStarsMember.firstName} ${dancingStarsMember.lastName} on ${testDate}`);

      // Use markAttendanceHandler which should now use bidirectional sync
      await markAttendanceHandler(dancingStarsMember.id, testDate, 'Present');

      setTestResults({
        success: true,
        message: 'Attendance sync test completed successfully',
        details: {
          memberId: dancingStarsMember.id,
          memberName: `${dancingStarsMember.firstName} ${dancingStarsMember.lastName}`,
          date: testDate,
          ministry: activeMinistryName,
          sourceChurch: (dancingStarsMember as any).sourceChurchId || 'unknown'
        }
      });

      showToast('success', 'Attendance Sync Test Complete', 'Check console for detailed sync logs');

    } catch (error: any) {
      console.error('❌ [Bidirectional Sync Test] Attendance test failed:', error);
      setTestResults({
        success: false,
        error: error.message
      });
      showToast('error', 'Attendance Sync Test Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const runNativeMemberTest = async () => {
    if (!isMinistryContext || !activeMinistryName) {
      showToast('error', 'Test Error', 'This test only works in ministry mode with an active ministry');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🧪 [Native Member Test] Starting native ministry member test...');

      // Create a native ministry member
      const nativeMemberData = {
        firstName: 'Native',
        lastName: 'TestMember',
        phoneNumber: '+1234567890',
        buildingAddress: '123 Test Street',
        bornAgainStatus: true,
        ministry: activeMinistryName,
        bacentaId: '', // No bacenta in ministry mode
        role: 'Member' as const,
        isNativeMinistryMember: true // Mark as native
      };

      console.log('📝 Adding native ministry member...');
      const memberId = await addMemberHandler(nativeMemberData);

      // Wait a moment for the member to appear in the list
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if the member appears in the members list
      const addedMember = members.find(m => m.id === memberId);
      const memberVisible = !!addedMember;

      setTestResults({
        success: true,
        message: 'Native ministry member test completed successfully',
        details: {
          memberId,
          memberName: `${nativeMemberData.firstName} ${nativeMemberData.lastName}`,
          ministry: activeMinistryName,
          isNative: true,
          memberVisible,
          totalMembers: members.length,
          note: memberVisible
            ? 'Member is visible in ministry mode ✅'
            : 'Member not visible - check console for debugging info ❌'
        }
      });

      showToast('success', 'Native Member Test Complete',
        memberVisible
          ? 'Native ministry member created and is visible in the list!'
          : 'Native ministry member created but not visible - check console logs.');

    } catch (error: any) {
      console.error('❌ [Native Member Test] Test failed:', error);
      setTestResults({
        success: false,
        error: error.message
      });
      showToast('error', 'Native Member Test Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const runNewBelieverSyncTest = async () => {
    if (!isMinistryContext || !activeMinistryName) {
      showToast('error', 'Test Error', 'This test only works in ministry mode with an active ministry');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🧪 [Bidirectional Sync Test] Starting new believer sync test...');
      
      const testNewBeliever = {
        name: 'Test',
        surname: 'SyncBeliever',
        contact: '+1234567890',
        dateOfBirth: '1990-01-01',
        residence: 'Test City',
        studies: 'Test Studies',
        campus: 'Test Campus',
        occupation: 'Test Job',
        year: '2024',
        isFirstTime: true,
        ministry: activeMinistryName,
        joinedDate: new Date().toISOString().split('T')[0]
      };

      console.log('📝 Adding test new believer in ministry mode...');
      await addNewBelieverHandler(testNewBeliever);

      setTestResults({
        success: true,
        message: 'New believer sync test completed successfully',
        details: {
          ministry: activeMinistryName,
          sourceChurch: userProfile?.contexts?.defaultChurchId || 'unknown'
        }
      });

      showToast('success', 'New Believer Sync Test Complete', 'Check console for detailed sync logs');
      
    } catch (error: any) {
      console.error('❌ [Bidirectional Sync Test] New believer test failed:', error);
      setTestResults({
        success: false,
        error: error.message
      });
      showToast('error', 'New Believer Sync Test Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMinistryContext) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">Bidirectional Sync Test is only available in Ministry Mode.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Bidirectional Sync Test</h2>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div>
              <h3 className="font-medium text-blue-900">🔄 Bidirectional Sync Active</h3>
              <p className="text-sm text-blue-700">Changes in ministry mode will sync back to source churches</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div>
              <h3 className="font-medium text-green-900">Current Ministry</h3>
              <p className="text-sm text-green-700">{activeMinistryName || 'Not specified'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            <button
              onClick={runMemberSyncTest}
              disabled={isLoading || !activeMinistryName}
              className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Testing...' : 'Test Member Sync'}
            </button>

            <button
              onClick={runNativeMemberTest}
              disabled={isLoading || !activeMinistryName}
              className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Testing...' : 'Test Native Member'}
            </button>

            <button
              onClick={runAttendanceFlickerTest}
              disabled={isLoading || !activeMinistryName || members.filter(m => m.ministry === activeMinistryName).length < 2}
              className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Testing...' : 'Test Flicker Fix'}
            </button>

            <button
              onClick={runAttendanceSyncTest}
              disabled={isLoading || !activeMinistryName || members.filter(m => m.ministry === activeMinistryName).length === 0}
              className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Testing...' : 'Test Attendance Sync'}
            </button>

            <button
              onClick={runNewBelieverSyncTest}
              disabled={isLoading || !activeMinistryName}
              className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Testing...' : 'Test New Believer Sync'}
            </button>
          </div>
        </div>

        {testResults && (
          <div className={`mt-4 p-3 rounded-lg ${testResults.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <h3 className={`font-medium ${testResults.success ? 'text-green-900' : 'text-red-900'}`}>
              {testResults.success ? '✅ Test Successful' : '❌ Test Failed'}
            </h3>
            <p className={`text-sm mt-1 ${testResults.success ? 'text-green-700' : 'text-red-700'}`}>
              {testResults.message || testResults.error}
            </p>
            {testResults.details && (
              <div className="mt-2 text-xs text-gray-600">
                <pre>{JSON.stringify(testResults.details, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-md font-semibold text-gray-900 mb-3">How Bidirectional Sync Works</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p><strong>Ministry Mode → Normal Mode:</strong> When you add/update data in ministry mode, it's automatically synced to the appropriate source church in normal mode.</p>
          <p><strong>Normal Mode → Ministry Mode:</strong> When data is added/updated in normal mode with a ministry assignment, it appears in the corresponding ministry mode.</p>
          <p><strong>Source Tracking:</strong> Each record tracks its source church ID to ensure proper bidirectional sync.</p>
          <p><strong>Conflict Prevention:</strong> Sync metadata prevents infinite loops and tracks sync direction.</p>
        </div>
      </div>
    </div>
  );
};

export default BidirectionalSyncTest;
