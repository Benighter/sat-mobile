import React, { useState } from 'react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import ExcelExportModal from '../modals/data/ExcelExportModal';
import PowerPointExportModal from '../modals/data/PowerPointExportModal';
import {
  DocumentArrowDownIcon
} from '../icons';

interface DataManagementProps {
  isOpen: boolean;
  onClose: () => void;
}

const DataManagement: React.FC<DataManagementProps> = ({ isOpen, onClose }) => {
  const [isExcelExportOpen, setIsExcelExportOpen] = useState(false);
  const [isPowerPointExportOpen, setIsPowerPointExportOpen] = useState(false);

  return (
    <>
      <Modal
        isOpen={isOpen && !isExcelExportOpen && !isPowerPointExportOpen}
        onClose={onClose}
        title="Data Management"
      >
        <div className="space-y-6">
          {/* Excel Export */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Excel Reports</h3>

            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h4 className="font-medium text-green-800 mb-2">📊 Hierarchy Excel Report</h4>
              <p className="text-sm text-green-700 mb-3">
                Generate a single Excel sheet showing all active (non-frozen) members in hierarchy (Green Bacentas, Red Bacentas,
                assistants and members), colour-coded with full attendance history and a clear legend.
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
	            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
	              <h4 className="font-medium text-purple-800 mb-2">📽 Hierarchy PowerPoint Report</h4>
	              <p className="text-sm text-purple-700 mb-3">
	                Generate a PowerPoint presentation with slides grouped by Green Bacentas, Red Bacentas,
	                assistants and members, showing member cards with space for photos.
	              </p>
	              <Button
	                onClick={() => setIsPowerPointExportOpen(true)}
	                variant="secondary"
	                className="flex items-center space-x-2 border-purple-300 text-purple-800 hover:bg-purple-100"
	              >
	                <DocumentArrowDownIcon className="w-5 h-5" />
	                <span>Create PowerPoint Report</span>
	              </Button>
	            </div>

          </div>
        </div>
      </Modal>

      {/* Excel Export Modal (separate so Data Management is hidden while exporting) */}
      <ExcelExportModal
        isOpen={isOpen && isExcelExportOpen}
        onClose={() => setIsExcelExportOpen(false)}
      />
	      {/* PowerPoint Export Modal (separate so Data Management is hidden while exporting) */}
	      <PowerPointExportModal
	        isOpen={isOpen && isPowerPointExportOpen}
	        onClose={() => setIsPowerPointExportOpen(false)}
	      />

    </>
  );
};

export default DataManagement;
