import React, { useState } from 'react';
import { useAppContext } from '../../../contexts/FirebaseAppContext';
import { exportHierarchyExcel, getHierarchyExportPreview } from '../../../utils/hierarchyExcelExport';
import {
  selectDirectory,
  canSelectDirectory,
  getDirectoryDescription,
  DirectoryHandle
} from '../../../utils/fileSystemUtils';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { formatDateDayMonthYear } from '../../../utils/dateUtils';
import {
  DocumentArrowDownIcon,
  CheckIcon,
  FolderIcon,
  CalendarIcon
} from '../../icons/index';

interface ExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ExcelExportModal: React.FC<ExcelExportModalProps> = ({ isOpen, onClose }) => {
  const {
    members,
    bacentas,
    attendanceRecords,
    showToast,
    userProfile,
    isMinistryContext,
    activeMinistryName
  } = useAppContext();
  const [isExporting, setIsExporting] = useState(false);
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>({
    startDate: '',
    endDate: ''
  });

  // Directory selection state
  const [selectedDirectory, setSelectedDirectory] = useState<DirectoryHandle | null>(null);
  const [isSelectingDirectory, setIsSelectingDirectory] = useState(false);

  const handleSelectDirectory = async () => {
    setIsSelectingDirectory(true);
    try {
      const directory = await selectDirectory();
      setSelectedDirectory(directory);
    } catch (error) {
      console.error('Directory selection failed:', error);
      showToast('error', 'Directory Selection Failed', 'Could not select directory. Using default download location.');
    } finally {
      setIsSelectingDirectory(false);
    }
  };

  const getConstituencyName = () => {
    const churchName = (userProfile?.churchName as string) || undefined;
    if (isMinistryContext) {
      return (activeMinistryName as string) || churchName;
    }
    return churchName;
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const constituencyName = getConstituencyName();
      const result = await exportHierarchyExcel({
        members,
        bacentas,
        attendanceRecords,
        options: {
          directory: selectedDirectory,
          startDate: dateRange.startDate || undefined,
          endDate: dateRange.endDate || undefined,
          constituencyName,
          isMinistryContext,
          ministryName: activeMinistryName || undefined
        }
      });

      if (result.success) {
        const locationText = result.path ? ` to ${result.path}` : '';
        showToast('success', 'Export Successful', `Hierarchy Excel report has been saved${locationText}!`);
        onClose();
      } else {
        showToast('error', 'Export Failed', result.error || 'Failed to generate Excel report. Please try again.');
      }
    } catch (error: any) {
      console.error('Export failed:', error);
      showToast('error', 'Export Failed', error.message || 'Failed to generate Excel report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const getExportPreview = () => {
    const constituencyName = getConstituencyName();
    return getHierarchyExportPreview({
      members,
      bacentas,
      attendanceRecords,
      options: {
        directory: selectedDirectory,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
        constituencyName,
        isMinistryContext,
        ministryName: activeMinistryName || undefined
      }
    });
  };

  const preview = getExportPreview();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Excel Report">
      <div className="space-y-6 max-h-[75vh] overflow-y-auto">
        {/* Export Preview */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
            <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
            Export Preview
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-blue-700">
            <div>
              <span className="font-medium">Total Tabs:</span> {preview.totalTabs}
            </div>
            <div>
              <span className="font-medium">Bacentas:</span> {preview.bacentaCount}
            </div>
            <div>
              <span className="font-medium">Members:</span> {preview.memberCount}
            </div>
            <div>
              <span className="font-medium">Date Range:</span> {preview.dateRangeDays} days
            </div>
            {preview.servicesCount && (
              <div>
                <span className="font-medium">Services:</span> {preview.servicesCount}
              </div>
            )}
          </div>
          {preview.features && preview.features.length > 0 && (
            <div className="mt-4">
              <h5 className="font-medium text-blue-800 mb-2">Features</h5>
              <ul className="text-xs text-blue-600 space-y-1">
                {preview.features.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <CheckIcon className="w-3 h-3 mr-1 text-green-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Date Range */}
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-800 flex items-center">
            <CalendarIcon className="w-5 h-5 mr-2 text-gray-700" />
            Date Range
          </h4>
          <p className="text-xs text-gray-500">
            By default, the report uses all available attendance dates
            {preview.firstDate && preview.lastDate && (
              <>
                {" "}
                (from {formatDateDayMonthYear(preview.firstDate)} to {formatDateDayMonthYear(preview.lastDate)})
              </>
            )}
            . Select a start and/or end date below to limit the export.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={e => {
                  const value = e.target.value;
                  setDateRange(prev => {
                    const adjustedEnd = prev.endDate && prev.endDate < value ? value : prev.endDate;
                    return {
                      startDate: value,
                      endDate: adjustedEnd
                    };
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={e => {
                  const value = e.target.value;
                  setDateRange(prev => {
                    const adjustedStart = prev.startDate && prev.startDate > value ? value : prev.startDate;
                    return {
                      startDate: adjustedStart,
                      endDate: value
                    };
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
        </div>

        {/* Save Location */}
        {canSelectDirectory() && (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Save Location</h4>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center space-x-3">
                  <FolderIcon className="w-5 h-5 text-gray-600" />
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      {selectedDirectory ? 'Custom Location' : 'Default Location'}
                    </span>
                    <p className="text-xs text-gray-500">
                      {getDirectoryDescription(selectedDirectory)}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleSelectDirectory}
                  variant="secondary"
                  disabled={isSelectingDirectory || isExporting}
                  className="text-xs px-3 py-1"
                >
                  {isSelectingDirectory ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                      Selecting...
                    </>
                  ) : (
                    'Choose Folder'
                  )}
                </Button>
              </div>

              <p className="text-xs text-gray-500">
                {selectedDirectory
                  ? 'Files will be saved to your selected folder.'
                  : 'Files will be saved to your default downloads folder.'
                }
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-gray-200 gap-3">
          <p className="text-xs text-gray-500 mt-2 sm:mt-0">
            Exports a single, clean hierarchy report for all active (non-frozen) members.
          </p>
          <div className="flex justify-end space-x-3">
            <Button
              onClick={onClose}
              variant="secondary"
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              variant="primary"
              disabled={isExporting}
              className="flex items-center space-x-2"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <DocumentArrowDownIcon className="w-4 h-4" />
                  <span>Export Excel Report</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ExcelExportModal;
