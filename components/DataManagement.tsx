import React, { useState, useRef } from 'react';
import { useAppData } from '../hooks/useAppData';
import { storageInfo, backupStorage } from '../utils/localStorage';
import Button from './ui/Button';
import Modal from './ui/Modal';
import ExcelExportModal from './ExcelExportModal';
import {
  CloudArrowDownIcon,
  CloudArrowUpIcon,
  TrashIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentArrowDownIcon
} from './icons';

interface DataManagementProps {
  isOpen: boolean;
  onClose: () => void;
}

const DataManagement: React.FC<DataManagementProps> = ({ isOpen, onClose }) => {
  const { exportData, importData, members, bacentas, attendanceRecords, showConfirmation } = useAppData();
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');
  const [isExcelExportOpen, setIsExcelExportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      const data = exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `church-connect-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      setImportStatus('error');
      setImportMessage('Failed to export data. Please try again.');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus('idle');
    setImportMessage('');

    try {
      const text = await file.text();
      const success = await importData(text);
      
      if (success) {
        setImportStatus('success');
        setImportMessage('Data imported successfully! Your app has been updated with the imported data.');
      } else {
        setImportStatus('error');
        setImportMessage('Failed to import data. Please check that the file is a valid Church Connect backup.');
      }
    } catch (error) {
      setImportStatus('error');
      setImportMessage('Failed to read the file. Please ensure it\'s a valid JSON backup file.');
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClearData = () => {
    showConfirmation('clearData', {
      totalMembers: members.length,
      totalBacentas: bacentas.length,
      totalAttendance: attendanceRecords.length
    }, () => {
      try {
        storageInfo.clearAll();
        window.location.reload(); // Reload to reset the app state
      } catch (error) {
        console.error('Failed to clear data:', error);
        setImportStatus('error');
        setImportMessage('Failed to clear data. Please try again.');
      }
    });
  };

  const getDataStats = () => {
    const lastBackup = backupStorage.getLastBackupTime();
    const storage = storageInfo.getUsage();
    
    return {
      totalMembers: members.length,
      totalBacentas: bacentas.length,
      totalAttendanceRecords: attendanceRecords.length,
      lastBackup: lastBackup ? lastBackup.toLocaleDateString() : 'Never',
      storageUsed: `${(storage.used / 1024).toFixed(1)} KB`,
      storagePercentage: storage.percentage.toFixed(1)
    };
  };

  const stats = getDataStats();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Data Management">
      <div className="space-y-6">
        {/* Data Statistics */}
        <div className="glass p-4 rounded-xl">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <InformationCircleIcon className="w-5 h-5 mr-2 text-blue-500" />
            Data Overview
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Members</p>
              <p className="font-semibold text-gray-800">{stats.totalMembers}</p>
            </div>
            <div>
              <p className="text-gray-600">Bacentas</p>
              <p className="font-semibold text-gray-800">{stats.totalBacentas}</p>
            </div>
            <div>
              <p className="text-gray-600">Attendance Records</p>
              <p className="font-semibold text-gray-800">{stats.totalAttendanceRecords}</p>
            </div>
            <div>
              <p className="text-gray-600">Last Backup</p>
              <p className="font-semibold text-gray-800">{stats.lastBackup}</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-600">Storage Used</p>
              <p className="font-semibold text-gray-800">{stats.storageUsed} ({stats.storagePercentage}%)</p>
              <div className="w-full h-2 bg-gray-200 rounded-full mt-1">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(parseFloat(stats.storagePercentage), 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Excel Export */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Excel Reports</h3>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <h4 className="font-medium text-green-800 mb-2">📊 Comprehensive Excel Reports</h4>
            <p className="text-sm text-green-700 mb-3">
              Generate detailed Excel reports with multiple tabs for each bacenta, including attendance analytics,
              member directories, and visual charts.
            </p>
            <Button
              onClick={() => setIsExcelExportOpen(true)}
              variant="primary"
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700"
            >
              <DocumentArrowDownIcon className="w-5 h-5" />
              <span>Create Excel Report</span>
            </Button>
          </div>
        </div>

        {/* Import/Export Actions */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Backup & Restore</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button
              onClick={handleExport}
              variant="primary"
              className="flex items-center justify-center space-x-2"
            >
              <CloudArrowDownIcon className="w-5 h-5" />
              <span>Export Data</span>
            </Button>

            <Button
              onClick={handleImportClick}
              variant="secondary"
              disabled={isImporting}
              className="flex items-center justify-center space-x-2"
            >
              <CloudArrowUpIcon className="w-5 h-5" />
              <span>{isImporting ? 'Importing...' : 'Import Data'}</span>
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Import Status */}
          {importStatus !== 'idle' && (
            <div className={`p-4 rounded-xl flex items-start space-x-3 ${
              importStatus === 'success' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              {importStatus === 'success' ? (
                <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5" />
              ) : (
                <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${
                  importStatus === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {importStatus === 'success' ? 'Success!' : 'Error'}
                </p>
                <p className={`text-sm ${
                  importStatus === 'success' ? 'text-green-700' : 'text-red-700'
                }`}>
                  {importMessage}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h3>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-800">Clear All Data</p>
                <p className="text-sm text-red-700 mb-3">
                  This will permanently delete all members, bacentas, and attendance records. 
                  This action cannot be undone.
                </p>
                <Button
                  onClick={handleClearData}
                  variant="danger"
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <TrashIcon className="w-4 h-4" />
                  <span>Clear All Data</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="font-medium text-blue-800 mb-2">How to use:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>Export:</strong> Download all your data as a JSON backup file</li>
            <li>• <strong>Import:</strong> Restore data from a previously exported backup file</li>
            <li>• <strong>Auto-save:</strong> All changes are automatically saved to your browser's local storage</li>
            <li>• <strong>Backup regularly:</strong> Export your data periodically to prevent data loss</li>
          </ul>
        </div>
      </div>

      {/* Excel Export Modal */}
      <ExcelExportModal
        isOpen={isExcelExportOpen}
        onClose={() => setIsExcelExportOpen(false)}
      />
    </Modal>
  );
};

export default DataManagement;
