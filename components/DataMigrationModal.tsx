// Data Migration Modal Component
import React, { useState, useEffect } from 'react';
import { X, Download, Upload, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { DataMigrationService, MigrationStatus, MigrationResult } from '../utils/dataMigration';

interface DataMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMigrationComplete: () => void;
}

export const DataMigrationModal: React.FC<DataMigrationModalProps> = ({
  isOpen,
  onClose,
  onMigrationComplete
}) => {
  const [migrationService] = useState(() => new DataMigrationService());
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLocalData, setHasLocalData] = useState(false);
  const [localDataSummary, setLocalDataSummary] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      // Check for local data when modal opens
      const hasData = migrationService.hasLocalStorageData();
      const summary = migrationService.getLocalStorageDataSummary();
      setHasLocalData(hasData);
      setLocalDataSummary(summary);
    }
  }, [isOpen, migrationService]);

  const handleBackupData = () => {
    try {
      const backupData = migrationService.backupLocalStorageData();
      const blob = new Blob([backupData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `church-connect-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Backup failed:', error);
    }
  };

  const handleMigration = async () => {
    setIsLoading(true);
    setMigrationStatus(null);
    setMigrationResult(null);

    // Create migration service with progress callback
    const migrationServiceWithProgress = new DataMigrationService((status) => {
      setMigrationStatus(status);
    });

    try {
      const result = await migrationServiceWithProgress.migrateAllData();
      setMigrationResult(result);
      
      if (result.success) {
        // Verify migration
        const verified = await migrationServiceWithProgress.verifyMigration();
        if (verified) {
          onMigrationComplete();
        }
      }
    } catch (error: any) {
      setMigrationResult({
        success: false,
        migratedCounts: { members: 0, bacentas: 0, attendance: 0, newBelievers: 0 },
        errors: [error.message],
        duration: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Data Migration to Firebase</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!hasLocalData ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Local Data Found</h3>
              <p className="text-gray-600">
                Your app is already using Firebase or there's no data to migrate.
              </p>
            </div>
          ) : (
            <>
              {/* Local Data Summary */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Local Data Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium">Members</p>
                    <p className="text-2xl font-bold text-blue-900">{localDataSummary?.members || 0}</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-sm text-green-600 font-medium">Bacentas</p>
                    <p className="text-2xl font-bold text-green-900">{localDataSummary?.bacentas || 0}</p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <p className="text-sm text-purple-600 font-medium">New Believers</p>
                    <p className="text-2xl font-bold text-purple-900">{localDataSummary?.newBelievers || 0}</p>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-lg">
                    <p className="text-sm text-orange-600 font-medium">Attendance</p>
                    <p className="text-2xl font-bold text-orange-900">{localDataSummary?.attendance || 0}</p>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">Important Notes</h4>
                    <ul className="text-sm text-yellow-700 mt-1 list-disc list-inside space-y-1">
                      <li>This will migrate all your local data to Firebase</li>
                      <li>Make sure you have a stable internet connection</li>
                      <li>We recommend backing up your data first</li>
                      <li>The migration process cannot be undone</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Migration Progress */}
              {migrationStatus && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">{migrationStatus.step}</h4>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(migrationStatus.progress / migrationStatus.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {migrationStatus.progress} of {migrationStatus.total} items
                  </p>
                </div>
              )}

              {/* Migration Result */}
              {migrationResult && (
                <div className="mb-6">
                  <div className={`p-4 rounded-lg ${migrationResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-start">
                      {migrationResult.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-3" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3" />
                      )}
                      <div className="flex-1">
                        <h4 className={`text-sm font-medium ${migrationResult.success ? 'text-green-800' : 'text-red-800'}`}>
                          {migrationResult.success ? 'Migration Completed Successfully!' : 'Migration Failed'}
                        </h4>
                        <div className="text-sm mt-2 space-y-1">
                          <p>Members: {migrationResult.migratedCounts.members}</p>
                          <p>Bacentas: {migrationResult.migratedCounts.bacentas}</p>
                          <p>New Believers: {migrationResult.migratedCounts.newBelievers}</p>
                          <p>Attendance Records: {migrationResult.migratedCounts.attendance}</p>
                          <p>Duration: {(migrationResult.duration / 1000).toFixed(1)}s</p>
                        </div>
                        {migrationResult.errors.length > 0 && (
                          <div className="mt-2">
                            <p className="text-sm font-medium text-red-800">Errors:</p>
                            <ul className="text-xs text-red-700 list-disc list-inside">
                              {migrationResult.errors.slice(0, 5).map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                              {migrationResult.errors.length > 5 && (
                                <li>... and {migrationResult.errors.length - 5} more errors</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleBackupData}
                  className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  disabled={isLoading}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Backup Data First
                </button>
                
                <button
                  onClick={handleMigration}
                  disabled={isLoading || (migrationResult?.success === true)}
                  className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  {isLoading ? 'Migrating...' : 'Start Migration'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
