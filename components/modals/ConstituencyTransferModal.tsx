import React, { useState, useEffect } from 'react';
import { X, Users, ArrowRight, Building2, MapPin, Phone, Mail } from 'lucide-react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { getAvailableConstituencies, Constituency } from '../../services/constituencyService';
import { Member } from '../../types';

interface ConstituencyTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
}

const ConstituencyTransferModal: React.FC<ConstituencyTransferModalProps> = ({
  isOpen,
  onClose,
  member
}) => {
  const { transferMemberToConstituencyHandler, showToast } = useAppContext();
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [selectedConstituencyId, setSelectedConstituencyId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConstituencies, setIsLoadingConstituencies] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConstituencies();
    }
  }, [isOpen]);

  const loadConstituencies = async () => {
    setIsLoadingConstituencies(true);
    try {
      const availableConstituencies = await getAvailableConstituencies();
      setConstituencies(availableConstituencies);
    } catch (error: any) {
      showToast('error', 'Failed to Load Constituencies', error.message);
    } finally {
      setIsLoadingConstituencies(false);
    }
  };

  const handleTransfer = async () => {
    if (!member || !selectedConstituencyId) {
      showToast('error', 'Invalid Selection', 'Please select a constituency');
      return;
    }

    setIsLoading(true);
    try {
      await transferMemberToConstituencyHandler(member.id, selectedConstituencyId);
      onClose();
      setSelectedConstituencyId('');
    } catch (error: any) {
      // Error is already handled in the context
    } finally {
      setIsLoading(false);
    }
  };

  const selectedConstituency = constituencies.find(c => c.id === selectedConstituencyId);

  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-600">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <ArrowRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100">
                Transfer to Constituency
              </h2>
              <p className="text-sm text-gray-600 dark:text-dark-400">
                Transfer {member.firstName} {member.lastName} to a constituency
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-dark-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Member Info */}
          <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-dark-100">
                  {member.firstName} {member.lastName}
                </h3>
                <p className="text-sm text-gray-600 dark:text-dark-400">
                  Native Ministry Member • {member.ministry}
                </p>
                {member.phoneNumber && (
                  <p className="text-sm text-gray-500 dark:text-dark-500">
                    {member.phoneNumber}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Constituency Selection */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300">
              Select Target Constituency
            </label>
            
            {isLoadingConstituencies ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600 dark:text-dark-400">Loading constituencies...</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {constituencies.map((constituency) => (
                  <div
                    key={constituency.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedConstituencyId === constituency.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
                    }`}
                    onClick={() => setSelectedConstituencyId(constituency.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-dark-100">
                          {constituency.name}
                        </h4>
                        {constituency.address && (
                          <div className="flex items-center space-x-1 mt-1">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-600 dark:text-dark-400">
                              {constituency.address}
                            </span>
                          </div>
                        )}
                        {constituency.contactInfo && (
                          <div className="flex items-center space-x-4 mt-1">
                            {constituency.contactInfo.phone && (
                              <div className="flex items-center space-x-1">
                                <Phone className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-600 dark:text-dark-400">
                                  {constituency.contactInfo.phone}
                                </span>
                              </div>
                            )}
                            {constituency.contactInfo.email && (
                              <div className="flex items-center space-x-1">
                                <Mail className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-600 dark:text-dark-400">
                                  {constituency.contactInfo.email}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {selectedConstituencyId === constituency.id && (
                        <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Transfer Preview */}
          {selectedConstituency && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                Transfer Summary
              </h4>
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <p>• {member.firstName} {member.lastName} will be transferred to <strong>{selectedConstituency.name}</strong></p>
                <p>• They will appear in both ministry mode and normal mode</p>
                <p>• Their ministry assignment ({member.ministry}) will be preserved</p>
                <p>• All attendance and prayer records will be synced</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-dark-600">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            disabled={!selectedConstituencyId || isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Transferring...</span>
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                <span>Transfer Member</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConstituencyTransferModal;
