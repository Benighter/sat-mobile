import React, { useState, useMemo } from 'react';
import { getBlob, ref } from 'firebase/storage';
import JSZip from 'jszip';
import { useAppContext } from '../../../contexts/FirebaseAppContext';
import { storage } from '../../../firebase.config';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { formatDateDayMonthYear } from '../../../utils/dateUtils';
import {
  selectDirectory,
  canSelectDirectory,
  getDirectoryDescription,
  DirectoryHandle,
  FileSaveProgress,
  saveFileToDirectory
} from '../../../utils/fileSystemUtils';
import {
  DocumentArrowDownIcon,
  CheckIcon,
  FolderIcon,
  CalendarIcon
} from '../../icons/index';
import { dataUrlToBlob, isDataUrl } from '../../../services/mediaStorageService';

interface ZipExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ZipExportModal: React.FC<ZipExportModalProps> = ({ isOpen, onClose }) => {
  const { sundayOfferingRecords, showToast } = useAppContext();

  // State
  const [selectedSundayId, setSelectedSundayId] = useState<string>('all'); // 'all' or specific YYYY-MM-DD
  const [includeTithes, setIncludeTithes] = useState(true);
  const [includeOfferings, setIncludeOfferings] = useState(true);
  
  const [isExporting, setIsExporting] = useState(false);
  const [saveProgress, setSaveProgress] = useState<FileSaveProgress | null>(null);
  
  const [selectedDirectory, setSelectedDirectory] = useState<DirectoryHandle | null>(null);
  const [isSelectingDirectory, setIsSelectingDirectory] = useState(false);

  // Find all Sundays with at least one proof attachment
  const sundaysWithProofs = useMemo(() => {
    return (sundayOfferingRecords || [])
      .filter(record => {
        const hasOffering = record.offeringProofs && record.offeringProofs.length > 0;
        const hasTithe = record.titheProofs && record.titheProofs.length > 0;
        const hasCashOffering = record.cashOfferingProofs && record.cashOfferingProofs.length > 0;
        const hasCashTithe = record.cashTitheProofs && record.cashTitheProofs.length > 0;
        return hasOffering || hasTithe || hasCashOffering || hasCashTithe;
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // Sort descending (most recent first)
  }, [sundayOfferingRecords]);

  // Compute files to export based on filters
  const exportPreview = useMemo(() => {
    let recordsToExport = sundaysWithProofs;
    if (selectedSundayId !== 'all') {
      recordsToExport = sundaysWithProofs.filter(r => r.date === selectedSundayId);
    }

    let titheCount = 0;
    let offeringCount = 0;
    const files: { recordDate: string; category: 'Tithe' | 'Offering'; proof: any }[] = [];

    recordsToExport.forEach(record => {
      // Tithes: titheProofs and cashTitheProofs
      if (includeTithes) {
        if (record.titheProofs) {
          record.titheProofs.forEach(p => {
            titheCount++;
            files.push({ recordDate: record.date, category: 'Tithe', proof: p });
          });
        }
        if (record.cashTitheProofs) {
          record.cashTitheProofs.forEach(p => {
            titheCount++;
            files.push({ recordDate: record.date, category: 'Tithe', proof: p });
          });
        }
      }

      // Offerings: offeringProofs and cashOfferingProofs
      if (includeOfferings) {
        if (record.offeringProofs) {
          record.offeringProofs.forEach(p => {
            offeringCount++;
            files.push({ recordDate: record.date, category: 'Offering', proof: p });
          });
        }
        if (record.cashOfferingProofs) {
          record.cashOfferingProofs.forEach(p => {
            offeringCount++;
            files.push({ recordDate: record.date, category: 'Offering', proof: p });
          });
        }
      }
    });

    return {
      titheCount,
      offeringCount,
      totalCount: titheCount + offeringCount,
      files
    };
  }, [sundaysWithProofs, selectedSundayId, includeTithes, includeOfferings]);

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
    if (exportPreview.files.length === 0) {
      showToast('warning', 'No files to export', 'There are no proof of payment files matching your filters.');
      return;
    }

    setIsExporting(true);
    setSaveProgress({
      percent: 0,
      stage: 'preparing',
      message: 'Initializing ZIP builder...'
    });

    try {
      const zip = new JSZip();
      const filesToDownload = exportPreview.files;
      const totalFiles = filesToDownload.length;

      for (let index = 0; index < totalFiles; index++) {
        const item = filesToDownload[index];
        const proof = item.proof;
        
        const fileNum = index + 1;
        const progressPercent = Math.round((index / totalFiles) * 80); // 0% to 80% for downloads
        
        setSaveProgress({
          percent: progressPercent,
          stage: 'saving',
          message: `Downloading ${fileNum}/${totalFiles}: ${proof.name || 'document'}`
        });

        let blobData: Blob | null = null;

        // Handle data URL (legacy or local previews)
        if (proof.data && isDataUrl(proof.data)) {
          try {
            blobData = dataUrlToBlob(proof.data);
          } catch (e) {
            console.error('Failed to convert data URL to blob:', e);
          }
        }

        // Handle standard URL or storagePath
        if (!blobData) {
          const referenceStr = proof.storagePath || proof.url;
          if (referenceStr) {
            try {
              const storageRef = ref(storage, referenceStr);
              blobData = await getBlob(storageRef);
            } catch (e) {
              console.error(`Failed to download ${referenceStr} from Firebase Storage:`, e);
            }
          }
        }

        if (blobData) {
          // Build clean ZIP file path: e.g. "Tithe/2026-05-24/my-tithe-proof.pdf"
          const folderName = item.category; // "Tithe" or "Offering"
          
          // Ensure name is clean and has extension
          const cleanName = proof.name || `${item.category.toLowerCase()}-${fileNum}`;
          
          zip.file(`${folderName}/${item.recordDate}/${cleanName}`, blobData);
        } else {
          console.warn(`Could not fetch data for proof: ${proof.name}`);
        }
      }

      setSaveProgress({
        percent: 85,
        stage: 'saving',
        message: 'Compiling ZIP archive...'
      });

      const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });

      setSaveProgress({
        percent: 95,
        stage: 'saving',
        message: 'Saving ZIP archive to device...'
      });

      // Create a beautiful default name: e.g. "SAT_Proofs_2026-05-24.zip" or "SAT_Proofs_All.zip"
      const suffix = selectedSundayId === 'all' ? 'All' : selectedSundayId;
      const zipName = `SAT_Proofs_${suffix}.zip`;

      const result = await saveFileToDirectory(
        selectedDirectory,
        zipName,
        zipBuffer,
        'application/zip',
        setSaveProgress
      );

      if (result.success) {
        setSaveProgress({
          percent: 100,
          stage: 'completed',
          message: `ZIP archive saved successfully.`
        });
        const locationText = result.path ? ` to ${result.path}` : '';
        showToast('success', 'Export Successful', `ZIP archive has been saved${locationText}!`);
        setTimeout(() => {
          onClose();
          setSaveProgress(null);
        }, 1000);
      } else {
        setSaveProgress(null);
        showToast('error', 'Export Failed', result.error || 'Failed to save ZIP file.');
      }
    } catch (error: any) {
      console.error('ZIP export failed:', error);
      setSaveProgress(null);
      showToast('error', 'Export Failed', error.message || 'An error occurred during export.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Download Proof of Payments">
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
        
        {/* Export Preview Card */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h4 className="font-semibold text-amber-800 mb-3 flex items-center">
            <DocumentArrowDownIcon className="w-5 h-5 mr-2 text-amber-700" />
            Export Summary
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-amber-700">
            <div className="bg-white/50 rounded-lg p-2.5 border border-amber-100/50">
              <span className="font-medium block text-xs uppercase tracking-wider text-amber-600 mb-0.5">Tithe Proofs</span>
              <span className="text-xl font-bold text-amber-800">{exportPreview.titheCount}</span> files
            </div>
            <div className="bg-white/50 rounded-lg p-2.5 border border-amber-100/50">
              <span className="font-medium block text-xs uppercase tracking-wider text-amber-600 mb-0.5">Offering Proofs</span>
              <span className="text-xl font-bold text-amber-800">{exportPreview.offeringCount}</span> files
            </div>
            <div className="bg-white/50 rounded-lg p-2.5 border border-amber-100/50 sm:col-span-1">
              <span className="font-medium block text-xs uppercase tracking-wider text-amber-600 mb-0.5">Total Package Size</span>
              <span className="text-xl font-bold text-amber-800">{exportPreview.totalCount}</span> files
            </div>
          </div>
          {exportPreview.totalCount > 0 && (
            <div className="mt-3 text-xs text-amber-600/80 flex items-start space-x-1">
              <CheckIcon className="w-3.5 h-3.5 mt-0.5 text-green-600 flex-shrink-0" />
              <span>ZIP file will contain structured subfolders: <code>Tithe/[Date]/</code> and <code>Offering/[Date]/</code>.</span>
            </div>
          )}
        </div>

        {/* Progress Bar (Only visible when exporting) */}
        {isExporting && saveProgress && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-emerald-800">Processing export...</span>
              <span className="text-emerald-700 font-bold">{saveProgress.percent}%</span>
            </div>
            <div className="h-2 bg-emerald-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${saveProgress.percent}%` }}
              />
            </div>
            <p className="text-xs text-emerald-700 italic">{saveProgress.message}</p>
          </div>
        )}

        {/* Date Filters */}
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-800 flex items-center text-sm sm:text-base">
            <CalendarIcon className="w-5 h-5 mr-2 text-gray-700" />
            Filter by Day
          </h4>
          <p className="text-xs text-gray-500">
            Choose whether to download proof of payment receipts from all available Sundays or a single specific date.
          </p>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Select Date
              </label>
              <select
                value={selectedSundayId}
                onChange={e => setSelectedSundayId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
              >
                <option value="all">All Available Sundays ({sundaysWithProofs.length} weeks)</option>
                {sundaysWithProofs.map(record => (
                  <option key={record.date} value={record.date}>
                    {formatDateDayMonthYear(record.date)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Category Separation Filter */}
        <div className="space-y-3 pt-3 border-t border-gray-100">
          <h4 className="font-semibold text-gray-800 text-sm sm:text-base">
            Separate Categories
          </h4>
          <p className="text-xs text-gray-500">
            Choose which proof categories to package into the ZIP file.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <label className="flex items-center space-x-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeTithes}
                onChange={e => setIncludeTithes(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              <div className="text-sm">
                <span className="font-semibold text-gray-700">Tithe Proofs</span>
                <span className="block text-xs text-gray-400">Include transfers & cash records</span>
              </div>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer select-none sm:border-l sm:pl-6 sm:border-gray-200">
              <input
                type="checkbox"
                checked={includeOfferings}
                onChange={e => setIncludeOfferings(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              <div className="text-sm">
                <span className="font-semibold text-gray-700">Offering Proofs</span>
                <span className="block text-xs text-gray-400">Include transfers & cash records</span>
              </div>
            </label>
          </div>
        </div>

        {/* Save Location (Capacitor/Directory Selection support) */}
        {canSelectDirectory() && (
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <h4 className="font-semibold text-gray-800 text-sm sm:text-base">Save Location</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center space-x-3">
                  <FolderIcon className="w-5 h-5 text-gray-600" />
                  <div>
                    <span className="text-sm font-semibold text-gray-700">
                      {selectedDirectory ? 'Custom Location' : 'Default Downloads'}
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
                  className="text-xs px-3 py-1 bg-white hover:bg-gray-50 border-gray-300"
                >
                  {isSelectingDirectory ? 'Selecting...' : 'Choose Folder'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-gray-200 gap-3">
          <p className="text-xs text-gray-400 mt-2 sm:mt-0">
            Packages and compiles proof files directly in your browser.
          </p>
          <div className="flex justify-end space-x-3">
            <Button
              onClick={onClose}
              variant="secondary"
              disabled={isExporting}
              className="px-4 py-2 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              variant="primary"
              disabled={isExporting || exportPreview.totalCount === 0}
              className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 border-amber-600 disabled:opacity-50 text-white font-semibold shadow-md transition-all duration-200"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <DocumentArrowDownIcon className="w-4 h-4 mr-1 text-white" />
                  <span>Download ZIP</span>
                </>
              )}
            </Button>
          </div>
        </div>

      </div>
    </Modal>
  );
};

export default ZipExportModal;
