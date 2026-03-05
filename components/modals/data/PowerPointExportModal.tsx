import React, { useState } from 'react';
import { useAppContext } from '../../../contexts/FirebaseAppContext';
import { exportHierarchyPowerPoint, getHierarchyPowerPointPreview } from '../../../utils/hierarchyPowerPointExport';
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
  CheckIcon,
  FolderIcon
} from '../../icons/index';

interface PowerPointExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PowerPointExportModal: React.FC<PowerPointExportModalProps> = ({ isOpen, onClose }) => {
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
      const result = await exportHierarchyPowerPoint({
        members,
        bacentas,
        attendanceRecords,
        options: {
          directory: selectedDirectory,
          constituencyName,
          isMinistryContext,
          ministryName: activeMinistryName || undefined
        }
      });

      if (result.success) {
        const locationText = result.path ? ` to ${result.path}` : '';
        showToast('success', 'Export Successful', `Hierarchy PowerPoint report has been saved${locationText}!`);
        onClose();
      } else {
        showToast('error', 'Export Failed', result.error || 'Failed to generate PowerPoint report. Please try again.');
      }
    } catch (error: any) {
      console.error('Export failed:', error);
      showToast('error', 'Export Failed', error.message || 'Failed to generate PowerPoint report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const getExportPreview = () => {
    const constituencyName = getConstituencyName();
    return getHierarchyPowerPointPreview({
      members,
      bacentas,
      attendanceRecords,
      options: {
        directory: selectedDirectory,
        constituencyName,
        isMinistryContext,
        ministryName: activeMinistryName || undefined
      }
    });
  };

  const preview = getExportPreview();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export PowerPoint Report">
      <div className="space-y-6 max-h-[75vh] overflow-y-auto">
        {/* Export Preview */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <h4 className="font-semibold text-purple-800 mb-3 flex items-center">
            <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
            Export Preview
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-purple-700">
            <div>
              <span className="font-medium">Members:</span> {preview.memberCount}
            </div>
            <div>
              <span className="font-medium">Estimated Slides:</span> {preview.estimatedSlides}
            </div>
          </div>
          {preview.features && preview.features.length > 0 && (
            <div className="mt-4">
              <h5 className="font-medium text-purple-800 mb-2">Features</h5>
              <ul className="text-xs text-purple-600 space-y-1">
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
                    <p className="text-xs text-gray-500">{getDirectoryDescription(selectedDirectory)}</p>
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
                  : 'Files will be saved to your default downloads folder.'}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-gray-200 gap-3">
          <p className="text-xs text-gray-500 mt-2 sm:mt-0">
            Exports a hierarchy report with member cards and space for photos.
          </p>
          <div className="flex justify-end space-x-3">
            <Button onClick={onClose} variant="secondary" disabled={isExporting}>
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
                  <span>Export PowerPoint Report</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default PowerPointExportModal;

