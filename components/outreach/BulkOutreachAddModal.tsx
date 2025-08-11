import React, { useEffect, useState } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { ClipboardIcon, CheckCircleIcon, AlertTriangleIcon as ExclamationTriangleIcon, XCircleIcon } from 'lucide-react';
import { OutreachTextParser, OutreachParseResult } from '../../utils/outreachTextParser';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bacentaId: string; // outreach bacenta id
  weekStart: string; // YYYY-MM-DD Monday
  bacentaName?: string;
}

const BulkOutreachAddModal: React.FC<Props> = ({ isOpen, onClose, bacentaId, bacentaName, weekStart }) => {
  const { addMultipleOutreachMembersHandler } = useAppContext();
  const [pastedText, setPastedText] = useState('');
  const [parseResult, setParseResult] = useState<OutreachParseResult | null>(null);
  const [step, setStep] = useState<'input' | 'preview' | 'processing' | 'complete'>('input');
  const [addedCount, setAddedCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
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
    if (text.trim()) setParseResult(OutreachTextParser.parseText(text));
    else setParseResult(null);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setPastedText(text);
      if (text.trim()) setParseResult(OutreachTextParser.parseText(text));
    } catch {}
  };

  const handlePreview = () => {
    if (parseResult && parseResult.contacts.length > 0) setStep('preview');
  };

  const handleAdd = async () => {
    if (!parseResult) return;
    setStep('processing');
    try {
      const payload = parseResult.contacts.map(c => OutreachTextParser.convertToOutreachMember(c, bacentaId, weekStart));
      const result = await addMultipleOutreachMembersHandler(payload);
      setAddedCount(result.successful.length);
      setErrors(result.failed.map(f => `Failed to add ${f.data.name}: ${f.error}`));
    } finally {
      setStep('complete');
    }
  };

  const getConfidenceColor = (c: number) => (c >= 0.8 ? 'text-green-600' : c >= 0.6 ? 'text-yellow-600' : 'text-red-600');
  const getConfidenceIcon = (c: number) => (c >= 0.8 ? <CheckCircleIcon className="w-4 h-4 text-green-600"/> : c >= 0.6 ? <ExclamationTriangleIcon className="w-4 h-4 text-yellow-600"/> : <XCircleIcon className="w-4 h-4 text-red-600"/>);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Multiple Outreach Contacts" size="xl">
      <div className="space-y-6">
        {step === 'input' && (
          <>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center"><ClipboardIcon className="w-4 h-4 text-rose-600" /></div>
                <div>
                  <h4 className="font-medium text-rose-800 mb-1">Smart Paste for Outreach</h4>
                  <p className="text-sm text-rose-700">Paste lines like: "814 – Rifuwe – 0678088622" or "Rifuwe – 814 – 0678088622" or "0678088622 – Rifuwe – 814". We'll detect names, phones, and room numbers.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Outreach Contacts</label>
                  <Button type="button" variant="secondary" size="sm" onClick={handlePasteFromClipboard} leftIcon={<ClipboardIcon className="w-4 h-4"/>}>Paste from Clipboard</Button>
                </div>
                <textarea value={pastedText} onChange={handleTextChange} placeholder={`Paste outreach info for ${bacentaName || 'this bacenta'}...`} className="w-full h-40 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none" />
              </div>
            </div>

            {parseResult && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h4 className="font-medium text-gray-800 mb-2">Parsing Results</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><span className="text-gray-600">Total Lines:</span><span className="ml-2 font-medium">{parseResult.totalLines}</span></div>
                  <div><span className="text-gray-600">Contacts Found:</span><span className="ml-2 font-medium text-green-600">{parseResult.successfullyParsed}</span></div>
                  <div><span className="text-gray-600">Errors:</span><span className="ml-2 font-medium text-red-600">{parseResult.errors.length}</span></div>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="button" variant="primary" onClick={handlePreview} disabled={!parseResult || parseResult.contacts.length === 0}>Preview ({parseResult?.contacts.length || 0})</Button>
            </div>
          </>
        )}

        {step === 'preview' && parseResult && (
          <>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h4 className="font-medium text-green-800 mb-1">Ready to Add {parseResult.contacts.length} Contacts</h4>
              <p className="text-sm text-green-700">They will be added to {bacentaName || 'selected bacenta'} for week starting {new Date(weekStart).toLocaleDateString()}.</p>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-3">
              {parseResult.contacts.map((c, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <h5 className="font-medium text-gray-800">{c.name}</h5>
                    {getConfidenceIcon(c.confidence)}
                    <span className={`text-xs font-medium ${getConfidenceColor(c.confidence)}`}>{Math.round(c.confidence*100)}% confidence</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div><span className="text-gray-600">Phone:</span><span className="ml-2">{c.phoneNumber || '—'}</span></div>
                    <div><span className="text-gray-600">Room:</span><span className="ml-2">{c.roomNumber || '—'}</span></div>
                    <div className="truncate text-gray-500" title={c.rawText}><span className="text-gray-600">Original:</span> <span className="ml-1">{c.rawText}</span></div>
                  </div>
                  {c.issues.length > 0 && (
                    <div className="mt-2 text-xs text-yellow-700">Issues: {c.issues.join(', ')}</div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-3">
              <Button type="button" variant="secondary" onClick={() => setStep('input')}>Back</Button>
              <Button type="button" variant="primary" onClick={handleAdd}>Add All</Button>
            </div>
          </>
        )}

        {step === 'processing' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600 mx-auto mb-4"></div>
            <h4 className="font-medium text-gray-800 mb-2">Adding Contacts...</h4>
            <p className="text-sm text-gray-600">Please wait.</p>
          </div>
        )}

        {step === 'complete' && (
          <>
            <div className={`border rounded-xl p-4 ${errors.length ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
              <h4 className={`font-medium mb-1 ${errors.length ? 'text-yellow-800' : 'text-green-800'}`}>{errors.length ? 'Partially Complete' : 'Successfully Added!'}</h4>
              <p className={`text-sm ${errors.length ? 'text-yellow-700' : 'text-green-700'}`}>{addedCount} contact{addedCount !== 1 ? 's' : ''} added{errors.length ? `, ${errors.length} failed` : ''}.</p>
            </div>

            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h5 className="font-medium text-red-800 mb-2">Errors:</h5>
                <ul className="text-sm text-red-700 space-y-1">{errors.map((e, i) => (<li key={i}>• {e}</li>))}</ul>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Button type="button" variant="secondary" onClick={() => setStep('input')}>Add More</Button>
              <Button type="button" variant="primary" onClick={onClose}>Done</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default BulkOutreachAddModal;
