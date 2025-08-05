import React, { useState } from 'react';
import { useAppContext } from '../../../contexts/FirebaseAppContext';
import { exportToExcel, ExcelExportOptions } from '../../../utils/excelExport';
import { exportToAdvancedExcel, AdvancedExcelExportOptions, getAdvancedExportPreview } from '../../../utils/advancedExcelExport';
import {
  selectDirectory,
  canSelectDirectory,
  getDirectoryDescription,
  DirectoryHandle
} from '../../../utils/fileSystemUtils';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import {
  DocumentArrowDownIcon,
  CalendarIcon,
  ChartBarIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckIcon,
  FolderIcon
} from '../../icons/index';

interface ExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ExcelExportModal: React.FC<ExcelExportModalProps> = ({ isOpen, onClose }) => {
  const { members, bacentas, attendanceRecords, showToast } = useAppContext();
  const [isExporting, setIsExporting] = useState(false);

  // Export options state
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includePersonalInfo, setIncludePersonalInfo] = useState(true);
  const [selectedBacentas, setSelectedBacentas] = useState<string[]>([]);
  const [useAdvancedExport, setUseAdvancedExport] = useState(true);
  const [theme, setTheme] = useState<'professional' | 'colorful' | 'minimal'>('professional');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1), // 3 months ago
    endDate: new Date()
  });

  // Directory selection state
  const [selectedDirectory, setSelectedDirectory] = useState<DirectoryHandle | null>(null);
  const [isSelectingDirectory, setIsSelectingDirectory] = useState(false);

  const handleBacentaToggle = (bacentaId: string) => {
    setSelectedBacentas(prev => 
      prev.includes(bacentaId) 
        ? prev.filter(id => id !== bacentaId)
        : [...prev, bacentaId]
    );
  };

  const handleSelectAllBacentas = () => {
    if (selectedBacentas.length === bacentas.length) {
      setSelectedBacentas([]);
    } else {
      setSelectedBacentas(bacentas.map(b => b.id));
    }
  };

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

  const handleExport = async () => {
    setIsExporting(true);

    try {
      let result: { success: boolean; path?: string; error?: string };

      if (useAdvancedExport) {
        const advancedOptions: AdvancedExcelExportOptions = {
          includeCharts,
          dateRange,
          selectedBacentas,
          includePersonalInfo,
          theme,
          directory: selectedDirectory
        };

        result = await exportToAdvancedExcel({
          members,
          bacentas,
          attendanceRecords,
          options: advancedOptions
        });
      } else {
        const exportOptions: ExcelExportOptions = {
          includeCharts,
          dateRange,
          selectedBacentas,
          includePersonalInfo,
          directory: selectedDirectory
        };

        result = await exportToExcel({
          members,
          bacentas,
          attendanceRecords,
          options: exportOptions
        });
      }

      if (result.success) {
        const locationText = result.path ? ` to ${result.path}` : '';
        const exportType = useAdvancedExport ? 'Advanced Excel report' : 'Excel report';
        showToast('success', 'Export Successful', `${exportType} has been saved${locationText}!`);
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

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const getExportPreview = () => {
    if (useAdvancedExport) {
      const advancedOptions: AdvancedExcelExportOptions = {
        includeCharts,
        dateRange,
        selectedBacentas,
        includePersonalInfo,
        theme
      };

      return getAdvancedExportPreview({
        members,
        bacentas,
        attendanceRecords,
        options: advancedOptions
      });
    } else {
      const targetBacentas = selectedBacentas.length > 0
        ? bacentas.filter(b => selectedBacentas.includes(b.id))
        : bacentas;

      return {
        totalTabs: 4 + targetBacentas.length,
        bacentaCount: targetBacentas.length,
        memberCount: members.length,
        dateRangeDays: Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)),
        servicesCount: 0,
        features: ['Basic Excel export with standard formatting']
      };
    }
  };

  const preview = getExportPreview();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Excel Report">
      <div className="space-y-6">
        {/* Export Preview */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="font-semibold text-blue-800 mb-2 flex items-center">
            <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
            Export Preview
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm text-blue-700">
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
          {useAdvancedExport && preview.features && (
            <div className="mt-3">
              <h5 className="font-medium text-blue-800 mb-2">Advanced Features:</h5>
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

        {/* Export Type Selection */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-800">Export Type</h4>
          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="exportType"
                checked={useAdvancedExport}
                onChange={() => setUseAdvancedExport(true)}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <div>
                <span className="font-medium text-gray-900">Advanced Export</span>
                <p className="text-sm text-gray-600">Professional formatting, colors, charts, and advanced analytics</p>
              </div>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="exportType"
                checked={!useAdvancedExport}
                onChange={() => setUseAdvancedExport(false)}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <div>
                <span className="font-medium text-gray-900">Basic Export</span>
                <p className="text-sm text-gray-600">Simple Excel format with basic data</p>
              </div>
            </label>
          </div>
        </div>

        {/* Theme Selection (only for advanced export) */}
        {useAdvancedExport && (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Theme</h4>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col items-center space-y-2 cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  value="professional"
                  checked={theme === 'professional'}
                  onChange={(e) => setTheme(e.target.value as 'professional' | 'colorful' | 'minimal')}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <div className="text-center">
                  <div className="w-12 h-8 bg-gradient-to-r from-blue-800 to-blue-600 rounded mb-1"></div>
                  <span className="text-sm font-medium">Professional</span>
                  <p className="text-xs text-gray-600">Corporate blue theme</p>
                </div>
              </label>
              <label className="flex flex-col items-center space-y-2 cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  value="colorful"
                  checked={theme === 'colorful'}
                  onChange={(e) => setTheme(e.target.value as 'professional' | 'colorful' | 'minimal')}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <div className="text-center">
                  <div className="w-12 h-8 bg-gradient-to-r from-purple-600 to-teal-500 rounded mb-1"></div>
                  <span className="text-sm font-medium">Colorful</span>
                  <p className="text-xs text-gray-600">Vibrant colors</p>
                </div>
              </label>
              <label className="flex flex-col items-center space-y-2 cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  value="minimal"
                  checked={theme === 'minimal'}
                  onChange={(e) => setTheme(e.target.value as 'professional' | 'colorful' | 'minimal')}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <div className="text-center">
                  <div className="w-12 h-8 bg-gradient-to-r from-gray-800 to-gray-600 rounded mb-1"></div>
                  <span className="text-sm font-medium">Minimal</span>
                  <p className="text-xs text-gray-600">Clean black & white</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Date Range Selection */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-800 flex items-center">
            <CalendarIcon className="w-5 h-5 mr-2" />
            Date Range
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={formatDate(dateRange.startDate)}
                onChange={(e) => setDateRange(prev => ({ 
                  ...prev, 
                  startDate: new Date(e.target.value) 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={formatDate(dateRange.endDate)}
                onChange={(e) => setDateRange(prev => ({ 
                  ...prev, 
                  endDate: new Date(e.target.value) 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Bacenta Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-800">
              Select Bacentas
            </h4>
            <Button
              onClick={handleSelectAllBacentas}
              variant="secondary"
              size="sm"
              className="text-sm"
            >
              {selectedBacentas.length === bacentas.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          
          <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2">
            {bacentas.length === 0 ? (
              <p className="text-gray-500 text-sm">No bacentas available</p>
            ) : (
              bacentas.map(bacenta => (
                <label key={bacenta.id} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedBacentas.includes(bacenta.id)}
                    onChange={() => handleBacentaToggle(bacenta.id)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{bacenta.name}</span>
                  <span className="text-xs text-gray-500">
                    ({members.filter(m => m.bacentaId === bacenta.id).length} members)
                  </span>
                </label>
              ))
            )}
          </div>
          
          {selectedBacentas.length === 0 && bacentas.length > 0 && (
            <p className="text-sm text-amber-600">
              No bacentas selected. All bacentas will be included in the export.
            </p>
          )}
        </div>

        {/* Export Options */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-800">Export Options</h4>
          
          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCharts}
                onChange={(e) => setIncludeCharts(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <ChartBarIcon className="w-5 h-5 text-gray-600" />
              <div>
                <span className="text-sm font-medium text-gray-700">Include Charts & Graphs</span>
                <p className="text-xs text-gray-500">Add visual charts to the Excel report</p>
              </div>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includePersonalInfo}
                onChange={(e) => setIncludePersonalInfo(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              {includePersonalInfo ? (
                <EyeIcon className="w-5 h-5 text-gray-600" />
              ) : (
                <EyeSlashIcon className="w-5 h-5 text-gray-600" />
              )}
              <div>
                <span className="text-sm font-medium text-gray-700">Include Personal Information</span>
                <p className="text-xs text-gray-500">Include phone numbers and addresses</p>
              </div>
            </label>
          </div>
        </div>

        {/* Directory Selection */}
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
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
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
                <span>{useAdvancedExport ? 'Creating Advanced Report...' : 'Exporting...'}</span>
              </>
            ) : (
              <>
                <DocumentArrowDownIcon className="w-4 h-4" />
                <span>{useAdvancedExport ? 'Create Advanced Excel Report' : 'Export Basic Excel'}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ExcelExportModal;
