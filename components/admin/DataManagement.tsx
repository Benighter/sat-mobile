import React, { useState } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { storageInfo } from '../../utils/localStorage';
import { hasAdminPrivileges } from '../../utils/permissionUtils';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import ExcelExportModal from '../modals/data/ExcelExportModal';
import SelectiveDataClearingModal from '../modals/data/SelectiveDataClearingModal';
import {
  TrashIcon,
  ExclamationTriangleIcon,
  DocumentArrowDownIcon,
  FilterIcon
} from '../icons';

interface DataManagementProps {
  isOpen: boolean;
  onClose: () => void;
}

const DataManagement: React.FC<DataManagementProps> = ({ isOpen, onClose }) => {
  const { bacentas, members, attendanceRecords, showConfirmation, showToast, userProfile } = useAppContext();
  const [isExcelExportOpen, setIsExcelExportOpen] = useState(false);
  const [isSelectiveDataClearingOpen, setIsSelectiveDataClearingOpen] = useState(false);

  // Check if current user is admin
  const isAdmin = hasAdminPrivileges(userProfile);

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
        showToast('error', 'Failed to clear data', 'Please try again.');
      }
    });
  };





  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Data Management">
      <div className="space-y-6">
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


        {/* Danger Zone - Admin Only */}
        {isAdmin && (
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h3>

            {/* Selective Data Clearing */}
            {bacentas.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                <div className="flex items-start space-x-3">
                  <FilterIcon className="w-5 h-5 text-orange-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-orange-800">Clear Specific Bacenta Data</p>
                    <p className="text-sm text-orange-700 mb-3">
                      Choose specific bacentas to clear data from. This will delete the selected bacentas,
                      their members, attendance records, and new believers.
                    </p>
                    <Button
                      onClick={() => setIsSelectiveDataClearingOpen(true)}
                      variant="secondary"
                      size="sm"
                      className="flex items-center space-x-2 border-orange-300 text-orange-700 hover:bg-orange-100"
                    >
                      <FilterIcon className="w-4 h-4" />
                      <span>Select Bacentas to Clear</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Clear All Data */}
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
        )}
      </div>

      {/* Excel Export Modal */}
      <ExcelExportModal
        isOpen={isExcelExportOpen}
        onClose={() => setIsExcelExportOpen(false)}
      />

      {/* Selective Data Clearing Modal */}
      <SelectiveDataClearingModal
        isOpen={isSelectiveDataClearingOpen}
        onClose={() => setIsSelectiveDataClearingOpen(false)}
      />
    </Modal>
  );
};

export default DataManagement;
