import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { NewBelieverTextParser, NewBelieverParseResult } from '../../utils/newBelieverTextParser';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { ClipboardIcon, CheckCircleIcon, AlertTriangleIcon as ExclamationTriangleIcon, XCircleIcon } from 'lucide-react';

interface BulkNewBelieverAddModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BulkNewBelieverAddModal: React.FC<BulkNewBelieverAddModalProps> = ({ 
  isOpen, 
  onClose
}) => {
  const { addMultipleNewBelieversHandler } = useAppContext();
  const [pastedText, setPastedText] = useState('');
  const [parseResult, setParseResult] = useState<NewBelieverParseResult | null>(null);
  const [step, setStep] = useState<'input' | 'preview' | 'processing' | 'complete'>('input');
  const [addedCount, setAddedCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setPastedText('');
      setParseResult(null);
      setStep('input');
      setAddedCount(0);
      setErrors([]);
    }
  }, [isOpen]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPastedText(text);
    
    // Auto-parse as user types
    if (text.trim().length > 0) {
      const result = NewBelieverTextParser.parseText(text);
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
        const result = NewBelieverTextParser.parseText(text);
        setParseResult(result);
      }
    } catch (error) {
      console.error('Failed to read clipboard:', error);
      // Fallback: user can manually paste
    }
  };

  const handlePreview = () => {
    if (parseResult && parseResult.newBelievers.length > 0) {
      setStep('preview');
    }
  };

  const handleAddNewBelievers = async () => {
    if (!parseResult) return;

    setStep('processing');

    try {
      const newBelieversData = parseResult.newBelievers.map(parsedNewBeliever => 
        NewBelieverTextParser.convertToNewBeliever(parsedNewBeliever)
      );

      const result = await addMultipleNewBelieversHandler(newBelieversData);

      setAddedCount(result.successful.length);
      setErrors(result.failed.map(f => `Failed to add ${f.data.name} ${f.data.surname}: ${f.error}`));
    } catch (error) {
      setAddedCount(0);
      setErrors([`Bulk operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
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

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Add Multiple New Believers" 
      size="xl"
    >
      <div className="space-y-6">
        {/* Step 1: Input */}
        {step === 'input' && (
          <>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 text-sm">🌱</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-green-800 mb-1">Smart Paste for New Believers</h4>
                  <p className="text-sm text-green-700">
                    Paste new believer information and we'll automatically detect names and contact information.
                    Each line should contain one new believer's information.
                  </p>
                  <p className="text-xs text-green-600 mt-2">
                    Examples:<br/>
                    • "1. John Smith - +27 81 872 6246"<br/>
                    • "2. Mary Jane - john@email.com"<br/>
                    • "3. Peter Parker - +27 60 122 7828"<br/>
                    • "4. Sarah Wilson"
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    New Believer Information
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handlePasteFromClipboard}
                    leftIcon={<ClipboardIcon className="w-4 h-4" />}
                  >
                    Paste from Clipboard
                  </Button>
                </div>
                <textarea
                  value={pastedText}
                  onChange={handleTextChange}
                  placeholder="Paste new believer information here, one person per line..."
                  className="w-full h-40 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Parse Results Preview */}
            {parseResult && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">
                    Detected: {parseResult.successfullyParsed} of {parseResult.totalLines} entries
                  </h4>
                  {parseResult.successfullyParsed > 0 && (
                    <Button onClick={handlePreview} variant="primary" size="sm">
                      Review & Add
                    </Button>
                  )}
                </div>

                {parseResult.errors.length > 0 && (
                  <div className="mb-3">
                    <h5 className="text-sm font-medium text-red-600 mb-1">Parsing Issues:</h5>
                    <ul className="text-xs text-red-500 space-y-1">
                      {parseResult.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {parseResult.newBelievers.slice(0, 5).map((believer, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                      <div className="flex items-center space-x-2">
                        {getConfidenceIcon(believer.confidence)}
                        <span className="font-medium">{believer.name} {believer.surname}</span>
                        {believer.contact && <span className="text-gray-500">• {believer.contact}</span>}
                      </div>
                      <span className={`text-xs ${getConfidenceColor(believer.confidence)}`}>
                        {Math.round(believer.confidence * 100)}% confident
                      </span>
                    </div>
                  ))}
                  {parseResult.newBelievers.length > 5 && (
                    <div className="text-center text-sm text-gray-500 py-2">
                      ... and {parseResult.newBelievers.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && parseResult && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 className="font-medium text-blue-800 mb-2">Review New Believers</h4>
              <p className="text-sm text-blue-700">
                Review the detected information below. You can go back to make changes or proceed to add all new believers.
              </p>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {parseResult.newBelievers.map((believer, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2 mb-2">
                      {getConfidenceIcon(believer.confidence)}
                      <span className="font-medium text-gray-900">
                        {believer.name} {believer.surname}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${getConfidenceColor(believer.confidence)}`}>
                        {Math.round(believer.confidence * 100)}% confident
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Contact:</span>
                      <span className="ml-2 text-gray-900">{believer.contact || 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Original:</span>
                      <span className="ml-2 text-gray-500 italic">{believer.rawText}</span>
                    </div>
                  </div>

                  {believer.issues.length > 0 && (
                    <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                      <h6 className="text-xs font-medium text-yellow-800">Potential Issues:</h6>
                      <ul className="text-xs text-yellow-700 mt-1">
                        {believer.issues.map((issue, issueIndex) => (
                          <li key={issueIndex}>• {issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4">
              <Button onClick={() => setStep('input')} variant="secondary">
                Back to Edit
              </Button>
              <Button onClick={handleAddNewBelievers} variant="primary">
                Add {parseResult.newBelievers.length} New Believers
              </Button>
            </div>
          </>
        )}

        {/* Step 3: Processing */}
        {step === 'processing' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <h4 className="font-medium text-gray-900 mb-2">Adding New Believers...</h4>
            <p className="text-sm text-gray-600">Please wait while we process your entries.</p>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && (
          <>
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircleIcon className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Bulk Add Complete!</h4>
              <p className="text-sm text-gray-600">
                {addedCount > 0 && `Successfully added ${addedCount} new believers.`}
                {errors.length > 0 && ` ${errors.length} entries failed.`}
              </p>
            </div>

            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h5 className="font-medium text-red-800 mb-2">Failed Entries:</h5>
                <ul className="text-sm text-red-700 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-center pt-4">
              <Button onClick={onClose} variant="primary">
                Close
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default BulkNewBelieverAddModal;