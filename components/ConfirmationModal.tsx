import React from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { ExclamationTriangleIcon, TrashIcon, XMarkIcon } from './icons';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  icon?: React.ReactNode;
  details?: string[];
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
  icon,
  details
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
          titleColor: 'text-red-800',
          messageColor: 'text-red-700',
          confirmVariant: 'danger' as const,
        };
      case 'warning':
        return {
          iconBg: 'bg-yellow-100',
          iconColor: 'text-yellow-600',
          titleColor: 'text-yellow-800',
          messageColor: 'text-yellow-700',
          confirmVariant: 'primary' as const,
        };
      case 'info':
        return {
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-600',
          titleColor: 'text-blue-800',
          messageColor: 'text-blue-700',
          confirmVariant: 'primary' as const,
        };
      default:
        return {
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
          titleColor: 'text-red-800',
          messageColor: 'text-red-700',
          confirmVariant: 'danger' as const,
        };
    }
  };

  const styles = getTypeStyles();
  const defaultIcon = type === 'danger' ? <TrashIcon className="w-6 h-6" /> : <ExclamationTriangleIcon className="w-6 h-6" />;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="text-center">
        {/* Icon */}
        <div className={`mx-auto flex items-center justify-center w-16 h-16 ${styles.iconBg} rounded-full mb-6 animate-scale-in`}>
          <div className={styles.iconColor}>
            {icon || defaultIcon}
          </div>
        </div>

        {/* Title */}
        <h3 className={`text-2xl font-bold ${styles.titleColor} mb-4 animate-fade-in`}>
          {title}
        </h3>

        {/* Message */}
        <p className={`text-lg ${styles.messageColor} mb-6 leading-relaxed animate-fade-in`} style={{ animationDelay: '0.1s' }}>
          {message}
        </p>

        {/* Details */}
        {details && details.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <h4 className="font-semibold text-gray-800 mb-2">This action will:</h4>
            <ul className="space-y-1">
              {details.map((detail, index) => (
                <li key={index} className="flex items-start space-x-2 text-sm text-gray-700">
                  <span className="text-gray-400 mt-1">•</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warning Notice */}
        {type === 'danger' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center space-x-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
              <p className="text-sm font-medium text-red-800">
                This action cannot be undone
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <Button
            onClick={onClose}
            variant="secondary"
            size="lg"
            className="flex items-center justify-center space-x-2 min-w-32"
          >
            <XMarkIcon className="w-5 h-5" />
            <span>{cancelText}</span>
          </Button>
          
          <Button
            onClick={handleConfirm}
            variant={styles.confirmVariant}
            size="lg"
            className="flex items-center justify-center space-x-2 min-w-32"
          >
            {type === 'danger' && <TrashIcon className="w-5 h-5" />}
            <span>{confirmText}</span>
          </Button>
        </div>

        {/* Keyboard Shortcut Hint */}
        <div className="mt-6 text-xs text-gray-500 animate-fade-in" style={{ animationDelay: '0.5s' }}>
          Press <kbd className="px-2 py-1 bg-gray-100 rounded text-gray-700 font-mono">Esc</kbd> to cancel
        </div>
      </div>
    </Modal>
  );
};

// Specific confirmation modals for common use cases
export const DeleteMemberModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  memberName: string;
}> = ({ isOpen, onClose, onConfirm, memberName }) => (
  <ConfirmationModal
    isOpen={isOpen}
    onClose={onClose}
    onConfirm={onConfirm}
    title="Delete Member"
    message={`Are you sure you want to delete ${memberName}?`}
    confirmText="Delete Member"
    cancelText="Keep Member"
    type="danger"
    details={[
      "All attendance records for this member will be permanently deleted",
      "This member will be removed from their assigned Bacenta",
      "This action cannot be undone"
    ]}
  />
);

export const DeleteBacentaModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  bacentaName: string;
  memberCount: number;
}> = ({ isOpen, onClose, onConfirm, bacentaName, memberCount }) => (
  <ConfirmationModal
    isOpen={isOpen}
    onClose={onClose}
    onConfirm={onConfirm}
    title="Delete Bacenta"
    message={`Are you sure you want to delete "${bacentaName}"?`}
    confirmText="Delete Bacenta"
    cancelText="Keep Bacenta"
    type="danger"
    details={[
      `${memberCount} member(s) will be unassigned from this Bacenta`,
      "All Bacenta-specific data will be permanently deleted",
      "Members will remain in the system but without Bacenta assignment",
      "This action cannot be undone"
    ]}
  />
);

export const DeleteNewBelieverModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  newBelieverName: string;
}> = ({ isOpen, onClose, onConfirm, newBelieverName }) => (
  <ConfirmationModal
    isOpen={isOpen}
    onClose={onClose}
    onConfirm={onConfirm}
    title="Delete New Believer"
    message={`Are you sure you want to delete ${newBelieverName}?`}
    confirmText="Delete"
    cancelText="Cancel"
    type="danger"
    details={[
      "This will permanently remove this new believer from your records",
      "This action cannot be undone"
    ]}
  />
);

export const ClearSelectedDataModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedBacentaNames: string[];
  totalMembers: number;
  totalAttendance: number;
  totalNewBelievers: number;
  includeUnassigned: boolean;
}> = ({ isOpen, onClose, onConfirm, selectedBacentaNames, totalMembers, totalAttendance, totalNewBelievers, includeUnassigned }) => (
  <ConfirmationModal
    isOpen={isOpen}
    onClose={onClose}
    onConfirm={onConfirm}
    title="Clear Selected Bacenta Data"
    message={`This will permanently delete data from ${selectedBacentaNames.length} selected bacenta${selectedBacentaNames.length !== 1 ? 's' : ''}${includeUnassigned ? ' and unassigned data' : ''}!`}
    confirmText="Delete Selected Data"
    cancelText="Keep Data"
    type="danger"
    details={[
      `${selectedBacentaNames.length} bacenta${selectedBacentaNames.length !== 1 ? 's' : ''} will be permanently deleted: ${selectedBacentaNames.join(', ')}`,
      `${totalMembers} member${totalMembers !== 1 ? 's' : ''} will be permanently deleted`,
      `${totalAttendance} attendance record${totalAttendance !== 1 ? 's' : ''} will be permanently deleted`,
      `${totalNewBelievers} new believer${totalNewBelievers !== 1 ? 's' : ''} will be permanently deleted`,
      ...(includeUnassigned ? ["All unassigned members and new believers will also be deleted"] : []),
      "This action cannot be undone"
    ]}
  />
);

export const ClearAllDataModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  totalMembers: number;
  totalBacentas: number;
  totalAttendance: number;
}> = ({ isOpen, onClose, onConfirm, totalMembers, totalBacentas, totalAttendance }) => (
  <ConfirmationModal
    isOpen={isOpen}
    onClose={onClose}
    onConfirm={onConfirm}
    title="Clear All Data"
    message="This will permanently delete ALL your church data!"
    confirmText="Delete Everything"
    cancelText="Keep My Data"
    type="danger"
    details={[
      `${totalMembers} members will be permanently deleted`,
      `${totalBacentas} Bacentas will be permanently deleted`,
      `${totalAttendance} attendance records will be permanently deleted`,
      "All app settings and preferences will be reset",
      "This action cannot be undone - consider exporting your data first"
    ]}
  />
);

export default ConfirmationModal;
