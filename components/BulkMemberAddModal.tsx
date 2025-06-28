import React, { useState, useEffect } from 'react';
import { useAppData } from '../hooks/useAppData';
import { SmartTextParser, ParsedMemberData, ParseResult } from '../utils/smartTextParser';
import { formatDateToYYYYMMDD } from '../utils/dateUtils';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input from './ui/Input';
import { ClipboardIcon, CheckCircleIcon, AlertTriangleIcon as ExclamationTriangleIcon, XCircleIcon } from 'lucide-react';

interface BulkMemberAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  bacentaId?: string; // If provided, members will be added to this bacenta
  bacentaName?: string; // For display purposes
}

const BulkMemberAddModal: React.FC<BulkMemberAddModalProps> = ({ 
  isOpen, 
  onClose, 
  bacentaId,
  bacentaName 
}) => {
  const { addMultipleMembersHandler, bacentas } = useAppData();
  const [pastedText, setPastedText] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedBacentaId, setSelectedBacentaId] = useState(bacentaId || '');
  const [joinedDate, setJoinedDate] = useState(formatDateToYYYYMMDD(new Date()));
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'input' | 'preview' | 'processing' | 'complete'>('input');
  const [addedCount, setAddedCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setPastedText('');
      setParseResult(null);
      setSelectedBacentaId(bacentaId || (bacentas.length > 0 ? bacentas[0].id : ''));
      setJoinedDate(formatDateToYYYYMMDD(new Date()));
      setStep('input');
      setAddedCount(0);
      setErrors([]);
      setIsProcessing(false);
    }
  }, [isOpen, bacentaId, bacentas]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPastedText(text);
    
    // Auto-parse as user types (with debouncing in real implementation)
    if (text.trim().length > 0) {
      const result = SmartTextParser.parseText(text);
      setParseResult(result);
    } else {
      setParseResult(null);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setPastedText(text);
      if (text.trim().length > 0) {
        const result = SmartTextParser.parseText(text);
        setParseResult(result);
      }
    } catch (error) {
      console.error('Failed to read clipboard:', error);
      // Fallback: user can manually paste
    }
  };

  const handlePreview = () => {
    if (parseResult && parseResult.members.length > 0) {
      setStep('preview');
    }
  };

  const handleAddMembers = async () => {
    if (!parseResult || !selectedBacentaId) return;

    setIsProcessing(true);
    setStep('processing');

    try {
      const membersData = parseResult.members.map(parsedMember =>
        SmartTextParser.convertToMember(parsedMember, selectedBacentaId, joinedDate)
      );

      const result = await addMultipleMembersHandler(membersData);

      setAddedCount(result.successful.length);
      setErrors(result.failed.map(f => `Failed to add ${f.data.firstName} ${f.data.lastName}: ${f.error}`));
    } catch (error) {
      setAddedCount(0);
      setErrors([`Bulk operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setIsProcessing(false);
      setStep('complete');
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) return <CheckCircleIcon className="w-4 h-4 text-green-600" />;
    if (confidence >= 0.6) return <ExclamationTriangleIcon className="w-4 h-4 text-yellow-600" />;
    return <XCircleIcon className="w-4 h-4 text-red-600" />;
  };

  const selectedBacenta = bacentas.find(b => b.id === selectedBacentaId);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Add Multiple Members" 
      size="xl"
    >
      <div className="space-y-6">
        {/* Step 1: Input */}
        {step === 'input' && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <ClipboardIcon className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-blue-800 mb-1">Smart Paste Feature</h4>
                  <p className="text-sm text-blue-700">
                    Paste member information and we'll automatically detect names and phone numbers.
                    Supports numbered lists, various formats, and ignores irrelevant symbols.
                    Each line should contain one member's information.
                  </p>
                  <p className="text-xs text-blue-600 mt-2">
                    Examples:<br/>
                    • "John Smith 0821234567 123 Main Street"<br/>
                    • "Jane Doe +27823456789"<br/>
                    • "Bennet Nkolele 0834567890 456 Oak Avenue"<br/>
                    • "Mary Johnson +27821234567 789 Pine Road, Cape Town"
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Member Information
                  </label>
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handlePasteFromClipboard}
                      leftIcon={<ClipboardIcon className="w-4 h-4" />}
                    >
                      Paste from Clipboard
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const sampleData = `1. Tlaki - +27 81 872 6246
2. Sphokuhle - +27 60 122 7828
3. Abigail - +27 84 769 5228
4. Lindokuhle - +27 67 009 8496
5. Ntalo - +27 60 513 7069`;
                        setPastedText(sampleData);
                        const result = SmartTextParser.parseText(sampleData);
                        setParseResult(result);
                      }}
                    >
                      Try Sample Data
                    </Button>
                  </div>
                </div>
                <textarea
                  value={pastedText}
                  onChange={handleTextChange}
                  placeholder="Paste member information here, one member per line..."
                  className="w-full h-40 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bacenta
                  </label>
                  {bacentaId ? (
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{bacentaName}</span>
                        <span className="text-xs text-gray-500 bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                          Current Bacenta
                        </span>
                      </div>
                    </div>
                  ) : (
                    <select
                      value={selectedBacentaId}
                      onChange={(e) => setSelectedBacentaId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select Bacenta</option>
                      {bacentas.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <Input
                  label="Joined Date"
                  type="date"
                  value={joinedDate}
                  onChange={(e) => setJoinedDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Parse Results Summary */}
            {parseResult && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h4 className="font-medium text-gray-800 mb-2">Parsing Results</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Lines:</span>
                    <span className="ml-2 font-medium">{parseResult.totalLines}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Members Found:</span>
                    <span className="ml-2 font-medium text-green-600">{parseResult.successfullyParsed}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Errors:</span>
                    <span className="ml-2 font-medium text-red-600">{parseResult.errors.length}</span>
                  </div>
                </div>
                {parseResult.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-red-600 mb-1">Parsing Errors:</p>
                    <ul className="text-xs text-red-600 space-y-1">
                      {parseResult.errors.slice(0, 3).map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                      {parseResult.errors.length > 3 && (
                        <li>• ... and {parseResult.errors.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handlePreview}
                disabled={!parseResult || parseResult.members.length === 0 || !selectedBacentaId}
              >
                Preview Members ({parseResult?.members.length || 0})
              </Button>
              {(!parseResult || parseResult.members.length === 0) && pastedText.trim().length > 0 && (
                <p className="text-sm text-red-600 mt-2">
                  No valid member data detected. Please check the format and try again.
                </p>
              )}
              {!selectedBacentaId && (
                <p className="text-sm text-red-600 mt-2">
                  Please select a Bacenta before proceeding.
                </p>
              )}
            </div>
          </>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && parseResult && (
          <>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h4 className="font-medium text-green-800 mb-1">
                Ready to Add {parseResult.members.length} Members
              </h4>
              <p className="text-sm text-green-700">
                Review the parsed information below. Members will be added to{' '}
                <strong>{selectedBacenta?.name}</strong> with joined date{' '}
                <strong>{new Date(joinedDate).toLocaleDateString()}</strong>.
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-3">
              {parseResult.members.map((member, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h5 className="font-medium text-gray-800">
                          {member.firstName} {member.lastName}
                        </h5>
                        {getConfidenceIcon(member.confidence)}
                        <span className={`text-xs font-medium ${getConfidenceColor(member.confidence)}`}>
                          {Math.round(member.confidence * 100)}% confidence
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">Phone:</span>
                          <span className="ml-2">{member.phoneNumber || 'Not detected'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Address:</span>
                          <span className="ml-2">{member.buildingAddress || 'Not detected'}</span>
                        </div>
                      </div>
                      {member.issues.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-yellow-600 mb-1">Issues:</p>
                          <ul className="text-xs text-yellow-600">
                            {member.issues.map((issue, i) => (
                              <li key={i}>• {issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    <strong>Original:</strong> {member.rawText}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-3">
              <Button type="button" variant="secondary" onClick={() => setStep('input')}>
                Back to Edit
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleAddMembers}
              >
                Add All Members
              </Button>
            </div>
          </>
        )}

        {/* Step 3: Processing */}
        {step === 'processing' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h4 className="font-medium text-gray-800 mb-2">Adding Members...</h4>
            <p className="text-sm text-gray-600">Please wait while we add the members to your bacenta.</p>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && (
          <>
            <div className={`border rounded-xl p-4 ${errors.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
              <h4 className={`font-medium mb-1 ${errors.length > 0 ? 'text-yellow-800' : 'text-green-800'}`}>
                {errors.length > 0 ? 'Partially Complete' : 'Successfully Added!'}
              </h4>
              <p className={`text-sm ${errors.length > 0 ? 'text-yellow-700' : 'text-green-700'}`}>
                {addedCount} member{addedCount !== 1 ? 's' : ''} added successfully
                {errors.length > 0 && ` (${errors.length} failed)`}.
              </p>
            </div>

            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h5 className="font-medium text-red-800 mb-2">Errors:</h5>
                <ul className="text-sm text-red-700 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Button type="button" variant="secondary" onClick={() => setStep('input')}>
                Add More Members
              </Button>
              <Button type="button" variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default BulkMemberAddModal;
