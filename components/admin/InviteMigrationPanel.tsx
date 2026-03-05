import React, { useState } from 'react';
import { inviteMigrationService, MigrationResult } from '../../services/inviteMigrationService';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import Button from '../ui/Button';
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  RefreshIcon,
  EyeIcon
} from '../icons';

interface InviteMigrationPanelProps {
  onClose?: () => void;
}

const InviteMigrationPanel: React.FC<InviteMigrationPanelProps> = ({ onClose }) => {
  const { refreshAccessibleChurchLinks, showToast } = useAppContext();
  const [isRunning, setIsRunning] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Cross-tenant link migration state
  const [isRunningCrossTenant, setIsRunningCrossTenant] = useState(false);
  const [crossTenantResult, setCrossTenantResult] = useState<MigrationResult | null>(null);
  const [showCrossTenantDetails, setShowCrossTenantDetails] = useState(false);

  // Ministry context migration state
  const [isRunningMinistryContext, setIsRunningMinistryContext] = useState(false);
  const [ministryContextResult, setMinistryContextResult] = useState<MigrationResult | null>(null);
  const [showMinistryContextDetails, setShowMinistryContextDetails] = useState(false);

  const handlePreview = async () => {
    setIsPreviewing(true);
    setResult(null);
    try {
      const previewResult = await inviteMigrationService.previewFixes();
      setResult(previewResult);
      setShowDetails(true);
    } catch (error: any) {
      console.error('Preview failed:', error);
      setResult({
        totalInvitesChecked: 0,
        affectedInvites: 0,
        fixedUsers: 0,
        errors: [error.message],
        details: []
      });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleRunMigration = async () => {
    if (!confirm('Are you sure you want to run this migration? This will update user data for affected accounts.')) {
      return;
    }

    setIsRunning(true);
    setResult(null);
    try {
      const migrationResult = await inviteMigrationService.fixMinistryInvitationData();
      setResult(migrationResult);
      setShowDetails(true);
    } catch (error: any) {
      console.error('Migration failed:', error);
      setResult({
        totalInvitesChecked: 0,
        affectedInvites: 0,
        fixedUsers: 0,
        errors: [error.message],
        details: []
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunCrossTenantMigration = async () => {
    if (!confirm('Are you sure you want to run this migration? This will update cross-tenant access links for ministry mode invites.')) {
      return;
    }

    setIsRunningCrossTenant(true);
    setCrossTenantResult(null);
    try {
      const migrationResult = await inviteMigrationService.fixMinistryModeCrossTenantLinks();
      setCrossTenantResult(migrationResult);
      setShowCrossTenantDetails(true);

      // If any links were fixed, refresh the cross-tenant access links
      if (migrationResult.fixedUsers > 0) {
        console.log('[Migration] Refreshing cross-tenant access links...');
        await refreshAccessibleChurchLinks();
        showToast('success', `Migration complete! Fixed ${migrationResult.fixedUsers} cross-tenant link${migrationResult.fixedUsers !== 1 ? 's' : ''}. Admins who invited these leaders should now be able to see their data. Ask them to refresh their page or log out and log back in.`);
      } else if (migrationResult.affectedInvites === 0 && migrationResult.errors.length === 0) {
        showToast('info', 'No issues found. All cross-tenant links are already correct.');
      } else if (migrationResult.errors.length > 0) {
        showToast('error', 'Migration completed with errors. Check the details below.');
      }
    } catch (error: any) {
      console.error('Cross-tenant migration failed:', error);
      setCrossTenantResult({
        totalInvitesChecked: 0,
        affectedInvites: 0,
        fixedUsers: 0,
        errors: [error.message],
        details: []
      });
      showToast('error', 'Migration failed', error.message);
    } finally {
      setIsRunningCrossTenant(false);
    }
  };

  const handleRunMinistryContextMigration = async () => {
    if (!confirm('Are you sure you want to run this migration? This will update ministry context for invited leaders.')) {
      return;
    }

    setIsRunningMinistryContext(true);
    setMinistryContextResult(null);
    try {
      const migrationResult = await inviteMigrationService.fixMinistryContextForLeaders();
      setMinistryContextResult(migrationResult);
      setShowMinistryContextDetails(true);

      // If any users were fixed, show success message
      if (migrationResult.fixedUsers > 0) {
        showToast('success', `Migration complete! Fixed ${migrationResult.fixedUsers} user${migrationResult.fixedUsers !== 1 ? 's' : ''}. Leaders should now see the correct church data. Ask them to refresh their page or log out and log back in.`);
      } else if (migrationResult.affectedInvites === 0 && migrationResult.errors.length === 0) {
        showToast('info', 'No issues found. All ministry contexts are already correct.');
      } else if (migrationResult.errors.length > 0) {
        showToast('error', 'Migration completed with errors. Check the details below.');
      }
    } catch (error: any) {
      console.error('Ministry context migration failed:', error);
      setMinistryContextResult({
        totalInvitesChecked: 0,
        affectedInvites: 0,
        fixedUsers: 0,
        errors: [error.message],
        details: []
      });
      showToast('error', 'Migration failed', error.message);
    } finally {
      setIsRunningMinistryContext(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto space-y-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Ministry Invitation Data Migration
        </h2>
        <p className="text-sm text-gray-600">
          This tool fixes data inconsistencies from ministry invitations that were accepted before the bug fixes were implemented.
        </p>
      </div>

      {/* Migration 1: Role Change Migration */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          1. Role Change Migration
        </h3>

      {/* Explanation */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-900 mb-2">What This Migration Does</h3>
            <div className="text-sm text-yellow-800 space-y-2">
              <p>
                <strong>The Bug:</strong> Before the recent fix, when a ministry admin invited another admin, 
                if the invited user accepted the invitation while logged into their normal account, 
                the system would update the wrong account (normal instead of ministry).
              </p>
              <p>
                <strong>The Fix:</strong> This migration identifies users whose ministry accounts should have 
                been changed to "leader" but weren't, and applies the correct role change and church synchronization.
              </p>
              <p>
                <strong>What Gets Updated:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>User role: Changed from "admin" to "leader"</li>
                <li>Church ID: Updated to match the inviting admin's church</li>
                <li>Church name: Updated to match the inviting admin's church</li>
                <li>Invitation metadata: Marked as invited admin leader</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3 mb-6">
        <Button
          variant="secondary"
          onClick={handlePreview}
          disabled={isPreviewing || isRunning}
          className="flex items-center space-x-2"
        >
          <EyeIcon className="w-4 h-4" />
          <span>{isPreviewing ? 'Previewing...' : 'Preview Changes'}</span>
        </Button>
        
        <Button
          variant="primary"
          onClick={handleRunMigration}
          disabled={isRunning || isPreviewing}
          className="flex items-center space-x-2"
        >
          <RefreshIcon className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
          <span>{isRunning ? 'Running Migration...' : 'Run Migration'}</span>
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-4">
            {isRunning || result.fixedUsers > 0 ? 'Migration Results' : 'Preview Results'}
          </h3>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-sm text-blue-600 font-medium">Total Invites Checked</div>
              <div className="text-2xl font-bold text-blue-900">{result.totalInvitesChecked}</div>
            </div>
            
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="text-sm text-yellow-600 font-medium">Affected Users</div>
              <div className="text-2xl font-bold text-yellow-900">{result.affectedInvites}</div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-sm text-green-600 font-medium">Fixed Users</div>
              <div className="text-2xl font-bold text-green-900">{result.fixedUsers}</div>
            </div>
          </div>

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <div className="flex items-start space-x-2">
                <XCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-red-900 mb-2">Errors</h4>
                  <ul className="text-sm text-red-800 space-y-1">
                    {result.errors.map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {result.fixedUsers > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <div className="flex items-start space-x-2">
                <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-green-900">Migration Successful!</h4>
                  <p className="text-sm text-green-800">
                    Successfully fixed {result.fixedUsers} user{result.fixedUsers !== 1 ? 's' : ''}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* No Issues Found */}
          {result.affectedInvites === 0 && result.errors.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <div className="flex items-start space-x-2">
                <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-green-900">No Issues Found</h4>
                  <p className="text-sm text-green-800">
                    All invitations have been processed correctly. No data migration needed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Details Toggle */}
          {result.details.length > 0 && (
            <div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium mb-3"
              >
                {showDetails ? '▼' : '▶'} {showDetails ? 'Hide' : 'Show'} Details ({result.details.length} items)
              </button>

              {showDetails && (
                <div className="bg-gray-50 rounded-lg p-3 max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-semibold">Email</th>
                        <th className="text-left p-2 font-semibold">Issue</th>
                        <th className="text-left p-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.details.map((detail, idx) => (
                        <tr key={idx} className="border-t border-gray-200">
                          <td className="p-2">{detail.invitedUserEmail}</td>
                          <td className="p-2 text-gray-600">{detail.issue}</td>
                          <td className="p-2">
                            {detail.fixed ? (
                              <span className="text-green-600 font-medium">✓ Fixed</span>
                            ) : detail.error ? (
                              <span className="text-red-600 font-medium">✗ Error: {detail.error}</span>
                            ) : (
                              <span className="text-yellow-600 font-medium">⚠ Needs Fix</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      </div>

      {/* Migration 2: Cross-Tenant Link Migration */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          2. Cross-Tenant Access Link Migration (Ministry Mode)
        </h3>

        {/* Explanation */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2">What This Migration Does</h3>
              <div className="text-sm text-blue-800 space-y-2">
                <p>
                  <strong>The Bug:</strong> When a ministry admin invited another ministry admin who already had their own data,
                  the system created a cross-tenant access link but used the wrong church ID (regular churchId instead of ministryChurchId).
                  This prevented the inviting admin from seeing the invited leader's ministry church data.
                </p>
                <p>
                  <strong>The Fix:</strong> This migration identifies cross-tenant links that point to the wrong church
                  and updates them to point to the correct ministry church.
                </p>
                <p>
                  <strong>What Gets Updated:</strong>
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Cross-tenant access link: ownerChurchId updated to ministryChurchId</li>
                  <li>Cross-tenant access index: Old index revoked, new index created</li>
                  <li>This allows admins to see their invited leaders' ministry data</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex space-x-3 mb-6">
          <Button
            variant="primary"
            onClick={handleRunCrossTenantMigration}
            disabled={isRunningCrossTenant}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700"
          >
            <RefreshIcon className={`w-4 h-4 ${isRunningCrossTenant ? 'animate-spin' : ''}`} />
            <span>{isRunningCrossTenant ? 'Running Migration...' : 'Run Cross-Tenant Migration'}</span>
          </Button>
        </div>

        {/* Results */}
        {crossTenantResult && (
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Migration Results</h3>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-sm text-blue-600 font-medium">Total Invites Checked</div>
                <div className="text-2xl font-bold text-blue-900">{crossTenantResult.totalInvitesChecked}</div>
              </div>

              <div className="bg-yellow-50 rounded-lg p-3">
                <div className="text-sm text-yellow-600 font-medium">Affected Links</div>
                <div className="text-2xl font-bold text-yellow-900">{crossTenantResult.affectedInvites}</div>
              </div>

              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-sm text-green-600 font-medium">Fixed Links</div>
                <div className="text-2xl font-bold text-green-900">{crossTenantResult.fixedUsers}</div>
              </div>
            </div>

            {/* Errors */}
            {crossTenantResult.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <div className="flex items-start space-x-2">
                  <XCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-900 mb-2">Errors</h4>
                    <ul className="text-sm text-red-800 space-y-1">
                      {crossTenantResult.errors.map((error, idx) => (
                        <li key={idx}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Success Message */}
            {crossTenantResult.fixedUsers > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <div className="flex items-start space-x-2">
                  <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-green-900">Migration Successful!</h4>
                    <p className="text-sm text-green-800 mb-2">
                      Successfully fixed {crossTenantResult.fixedUsers} cross-tenant link{crossTenantResult.fixedUsers !== 1 ? 's' : ''}.
                    </p>
                    <p className="text-sm text-green-800 font-medium">
                      ⚠️ Important: The admins who invited these leaders need to refresh their page or log out and log back in to see the updated data.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* No Issues Found */}
            {crossTenantResult.affectedInvites === 0 && crossTenantResult.errors.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <div className="flex items-start space-x-2">
                  <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-green-900">No Issues Found</h4>
                    <p className="text-sm text-green-800">
                      All cross-tenant links are pointing to the correct churches. No migration needed.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Details Toggle */}
            {crossTenantResult.details.length > 0 && (
              <div>
                <button
                  onClick={() => setShowCrossTenantDetails(!showCrossTenantDetails)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium mb-3"
                >
                  {showCrossTenantDetails ? '▼' : '▶'} {showCrossTenantDetails ? 'Hide' : 'Show'} Details ({crossTenantResult.details.length} items)
                </button>

                {showCrossTenantDetails && (
                  <div className="bg-gray-50 rounded-lg p-3 max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="text-left p-2 font-semibold">Email</th>
                          <th className="text-left p-2 font-semibold">Issue</th>
                          <th className="text-left p-2 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {crossTenantResult.details.map((detail, idx) => (
                          <tr key={idx} className="border-t border-gray-200">
                            <td className="p-2">{detail.invitedUserEmail}</td>
                            <td className="p-2 text-gray-600">{detail.issue}</td>
                            <td className="p-2">
                              {detail.fixed ? (
                                <span className="text-green-600 font-medium">✓ Fixed</span>
                              ) : detail.error ? (
                                <span className="text-red-600 font-medium">✗ Error: {detail.error}</span>
                              ) : (
                                <span className="text-yellow-600 font-medium">⚠ Needs Fix</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Migration 3: Ministry Context Migration */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          3. Ministry Context Migration (For Invited Leaders)
        </h3>

        {/* Explanation */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-purple-900 mb-2">What This Migration Does</h3>
              <div className="text-sm text-purple-800 space-y-2">
                <p>
                  <strong>The Bug:</strong> When a ministry leader accepted an invite from an admin,
                  their regular churchId was updated but their ministry context (contexts.ministryChurchId) was not.
                  This caused leaders to see their OLD church data instead of the admin's church data when in ministry mode.
                </p>
                <p>
                  <strong>The Fix:</strong> This migration updates the ministry context to match the current church
                  so leaders see the correct church data.
                </p>
                <p>
                  <strong>What Gets Updated:</strong>
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>User contexts.ministryChurchId: Updated to match churchId</li>
                  <li>Leaders will now see the correct church data in ministry mode</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex space-x-3 mb-6">
          <Button
            variant="primary"
            onClick={handleRunMinistryContextMigration}
            disabled={isRunningMinistryContext}
            className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700"
          >
            <RefreshIcon className={`w-4 h-4 ${isRunningMinistryContext ? 'animate-spin' : ''}`} />
            <span>{isRunningMinistryContext ? 'Running Migration...' : 'Run Ministry Context Migration'}</span>
          </Button>
        </div>

        {/* Results */}
        {ministryContextResult && (
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Migration Results</h3>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-sm text-blue-600 font-medium">Total Invites Checked</div>
                <div className="text-2xl font-bold text-blue-900">{ministryContextResult.totalInvitesChecked}</div>
              </div>

              <div className="bg-yellow-50 rounded-lg p-3">
                <div className="text-sm text-yellow-600 font-medium">Affected Users</div>
                <div className="text-2xl font-bold text-yellow-900">{ministryContextResult.affectedInvites}</div>
              </div>

              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-sm text-green-600 font-medium">Fixed Users</div>
                <div className="text-2xl font-bold text-green-900">{ministryContextResult.fixedUsers}</div>
              </div>
            </div>

            {/* Errors */}
            {ministryContextResult.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <div className="flex items-start space-x-2">
                  <XCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-900 mb-2">Errors</h4>
                    <ul className="text-sm text-red-800 space-y-1">
                      {ministryContextResult.errors.map((error, idx) => (
                        <li key={idx}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Success Message */}
            {ministryContextResult.fixedUsers > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <div className="flex items-start space-x-2">
                  <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-green-900">Migration Successful!</h4>
                    <p className="text-sm text-green-800 mb-2">
                      Successfully fixed {ministryContextResult.fixedUsers} user{ministryContextResult.fixedUsers !== 1 ? 's' : ''}.
                    </p>
                    <p className="text-sm text-green-800 font-medium">
                      ⚠️ Important: The affected leaders need to refresh their page or log out and log back in to see the correct church data.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* No Issues Found */}
            {ministryContextResult.affectedInvites === 0 && ministryContextResult.errors.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <div className="flex items-start space-x-2">
                  <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-green-900">No Issues Found</h4>
                    <p className="text-sm text-green-800">
                      All ministry contexts are already correct. No migration needed.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Details Toggle */}
            {ministryContextResult.details.length > 0 && (
              <div>
                <button
                  onClick={() => setShowMinistryContextDetails(!showMinistryContextDetails)}
                  className="text-sm text-purple-600 hover:text-purple-800 font-medium mb-3"
                >
                  {showMinistryContextDetails ? '▼' : '▶'} {showMinistryContextDetails ? 'Hide' : 'Show'} Details ({ministryContextResult.details.length} items)
                </button>

                {showMinistryContextDetails && (
                  <div className="bg-gray-50 rounded-lg p-3 max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="text-left p-2 font-semibold">Email</th>
                          <th className="text-left p-2 font-semibold">Issue</th>
                          <th className="text-left p-2 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ministryContextResult.details.map((detail, idx) => (
                          <tr key={idx} className="border-t border-gray-200">
                            <td className="p-2">{detail.invitedUserEmail}</td>
                            <td className="p-2 text-gray-600">{detail.issue}</td>
                            <td className="p-2">
                              {detail.fixed ? (
                                <span className="text-green-600 font-medium">✓ Fixed</span>
                              ) : detail.error ? (
                                <span className="text-red-600 font-medium">✗ Error: {detail.error}</span>
                              ) : (
                                <span className="text-yellow-600 font-medium">⚠ Needs Fix</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Close Button */}
      {onClose && (
        <div className="mt-6 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </div>
  );
};

export default InviteMigrationPanel;

