import React, { useEffect, useState } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { ClipboardIcon, CheckCircleIcon, AlertTriangleIcon as ExclamationTriangleIcon, XCircleIcon } from 'lucide-react';
import { OutreachTextParser, OutreachParseResult } from '../../utils/outreachTextParser';
import { sonsOfGodFirebaseService, outreachMembersFirebaseService } from '../../services/firebaseService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bacentaId: string; // outreach bacenta id
  weekStart?: string; // YYYY-MM-DD (optional, defaults to today)
  bacentaName?: string;
}

const BulkOutreachAddModal: React.FC<Props> = ({ isOpen, onClose, bacentaId, bacentaName, weekStart }) => {
  const { addMultipleOutreachMembersHandler } = useAppContext();
  const [pastedText, setPastedText] = useState('');
  const [parseResult, setParseResult] = useState<OutreachParseResult | null>(null);
  const [step, setStep] = useState<'input' | 'preview' | 'processing' | 'complete'>('input');
  const [addedCount, setAddedCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  
  interface EditableContact {
    original: OutreachParseResult['contacts'][number];
    current: { name: string; phoneNumber?: string; roomNumber?: string; bornAgain?: boolean };
    isEditing: boolean;
    modified: boolean;
    errors: Partial<Record<'name' | 'phoneNumber' | 'roomNumber', string>>;
  }
  const [editableContacts, setEditableContacts] = useState<EditableContact[]>([]);

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
    if (parseResult) {
      setEditableContacts(parseResult.contacts.map(c => ({
        original: c,
        current: { name: c.name || '', phoneNumber: c.phoneNumber || '', roomNumber: c.roomNumber || '', bornAgain: false },
        isEditing: false,
        modified: false,
        errors: {}
      })));
    }
  };

  const handleAdd = async () => {
    if (!parseResult) return;
    setStep('processing');
    try {
      // Use provided weekStart or default to today's date
      const outreachDate = weekStart || new Date().toISOString().slice(0, 10);

      const hasBornAgain = editableContacts.some(ec => ec.current.bornAgain);
      if (hasBornAgain) {
        let success = 0; const errs: string[] = [];
        for (let i=0;i<parseResult.contacts.length;i++) {
          const c = parseResult.contacts[i];
          try {
            let sonOfGodId: string | undefined;
            if (editableContacts[i].current.bornAgain) {
              try {
                sonOfGodId = await sonsOfGodFirebaseService.add({
                  name: c.name || '',
                  phoneNumber: c.phoneNumber || undefined,
                  roomNumber: c.roomNumber || undefined,
                  outreachDate: outreachDate,
                  bacentaId,
                  notes: '',
                  integrated: false
                } as any);
              } catch (e:any) {
                console.warn('SonOfGod creation failed', e);
              }
            }
            const outreachPayload = OutreachTextParser.convertToOutreachMember(c, bacentaId, outreachDate) as any;
            if (sonOfGodId) outreachPayload.sonOfGodId = sonOfGodId;
            await outreachMembersFirebaseService.add(outreachPayload);
            success++;
          } catch (e:any) {
            errs.push(`Failed to add ${c.name || 'contact'}: ${e.message || 'Unknown error'}`);
          }
        }
        setAddedCount(success);
        setErrors(errs);
      } else {
        const payload = parseResult.contacts.map(c => OutreachTextParser.convertToOutreachMember(c, bacentaId, outreachDate));
        const result = await addMultipleOutreachMembersHandler(payload);
        setAddedCount(result.successful.length);
        setErrors(result.failed.map(f => `Failed to add ${f.data.name}: ${f.error}`));
      }
    } finally {
      setStep('complete');
    }
  };

  const getConfidenceColor = (c: number) => (c >= 0.8 ? 'text-green-600' : c >= 0.6 ? 'text-yellow-600' : 'text-red-600');
  const getConfidenceIcon = (c: number) => (c >= 0.8 ? <CheckCircleIcon className="w-4 h-4 text-green-600"/> : c >= 0.6 ? <ExclamationTriangleIcon className="w-4 h-4 text-yellow-600"/> : <XCircleIcon className="w-4 h-4 text-red-600"/>);

  // Validation helpers
  const phoneRegex = /^\+?\d{8,15}$/;
  const validate = (c: EditableContact['current']) => {
    const errs: EditableContact['errors'] = {};
    if (!c.name.trim()) errs.name = 'Name required';
    const phone = (c.phoneNumber || '').replace(/[\s-]/g,'');
    if (phone && !phoneRegex.test(phone)) errs.phoneNumber = 'Invalid phone';
    if (c.roomNumber && c.roomNumber.length > 10) errs.roomNumber = 'Too long';
    return errs;
  };
  const beginEdit = (i: number) => setEditableContacts(prev => prev.map((ec,idx)=> idx===i ? { ...ec, isEditing: true }: ec));
  const cancelEdit = (i: number) => setEditableContacts(prev => prev.map((ec,idx)=> idx===i ? { ...ec, current: { name: ec.original.name || '', phoneNumber: ec.original.phoneNumber || '', roomNumber: ec.original.roomNumber || '' }, errors: {}, modified: false, isEditing:false }: ec));
  const updateField = (i: number, field: keyof EditableContact['current'], value: any) => setEditableContacts(prev => prev.map((ec,idx)=> {
    if (idx!==i) return ec;
    const current = { ...ec.current, [field]: value };
    const errors = validate(current);
    const modified = (
      current.name !== (ec.original.name || '') ||
      (current.phoneNumber||'') !== (ec.original.phoneNumber||'') ||
      (current.roomNumber||'') !== (ec.original.roomNumber||'') ||
      (!!current.bornAgain)
    );
    return { ...ec, current, errors, modified };
  }));
  const saveEdit = (i: number) => setEditableContacts(prev => prev.map((ec,idx)=> idx===i ? { ...ec, isEditing:false }: ec));
  const removeEntry = (i: number) => setEditableContacts(prev => prev.filter((_,idx)=> idx!==i));

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
              <h4 className="font-medium text-green-800 mb-1">Ready to Add {editableContacts.length} Contact{editableContacts.length!==1?'s':''}</h4>
              <p className="text-sm text-green-700">They will be added to {bacentaName || 'selected bacenta'} for week starting {new Date(weekStart).toLocaleDateString()}.</p>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-3">
              {editableContacts.map((ec,i)=>{
                const c = ec.original;
                return (
                  <div key={i} className={`border rounded-lg p-4 ${ec.modified? 'border-blue-400 ring-1 ring-blue-300' : 'border-gray-200'}`}>
                    <div className="flex items-center space-x-2 mb-2">
                      {ec.isEditing ? (
                        <input value={ec.current.name} onChange={e=>updateField(i,'name',e.target.value)} placeholder="Name" className="px-2 py-1 border rounded w-40" />
                      ) : (
                        <h5 className="font-medium text-gray-800">{ec.current.name}</h5>
                      )}
                      {getConfidenceIcon(c.confidence)}
                      <span className={`text-xs font-medium ${getConfidenceColor(c.confidence)}`}>{Math.round(c.confidence*100)}% confidence</span>
                      {ec.modified && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Edited</span>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Phone:</span>
                        {ec.isEditing ? (
                          <input value={ec.current.phoneNumber} onChange={e=>updateField(i,'phoneNumber', e.target.value)} placeholder="Phone" className="ml-2 px-2 py-1 border rounded w-40" />
                        ) : (<span className="ml-2">{ec.current.phoneNumber || '—'}</span>)}
                        {ec.errors.phoneNumber && <span className="block text-xs text-red-600">{ec.errors.phoneNumber}</span>}
                      </div>
                      <div>
                        <span className="text-gray-600">Room:</span>
                        {ec.isEditing ? (
                          <input value={ec.current.roomNumber} onChange={e=>updateField(i,'roomNumber', e.target.value)} placeholder="Room" className="ml-2 px-2 py-1 border rounded w-24" />
                        ) : (<span className="ml-2">{ec.current.roomNumber || '—'}</span>)}
                        {ec.errors.roomNumber && <span className="block text-xs text-red-600">{ec.errors.roomNumber}</span>}
                      </div>
                      <div className="truncate text-gray-500" title={c.rawText}><span className="text-gray-600">Original:</span> <span className="ml-1">{c.rawText}</span></div>
                    </div>
                    {c.issues.length > 0 && !ec.isEditing && (
                      <div className="mt-2 text-xs text-yellow-700">Issues: {c.issues.join(', ')}</div>
                    )}
                    <div className="flex space-x-2 mt-3">
                      {!ec.isEditing && <Button type="button" size="xs" variant="secondary" onClick={()=>beginEdit(i)}>Edit</Button>}
                      {ec.isEditing && (
                        <>
                          <Button type="button" size="xs" variant="primary" onClick={()=>saveEdit(i)} disabled={Object.keys(ec.errors).length>0}>Save</Button>
                          <Button type="button" size="xs" variant="secondary" onClick={()=>cancelEdit(i)}>Cancel</Button>
                        </>
                      )}
                      <Button type="button" size="xs" variant="danger" onClick={()=>removeEntry(i)}>Remove</Button>
                    </div>
                    {ec.errors.name && <p className="text-xs text-red-600 mt-1">{ec.errors.name}</p>}
                    <div className="mt-2 flex items-center space-x-2">
                      <label className="flex items-center text-xs text-gray-700 space-x-1">
                        <input type="checkbox" checked={!!ec.current.bornAgain} onChange={e=>updateField(i,'bornAgain', e.target.checked)} />
                        <span>Born Again (Sons of God)</span>
                      </label>
                      {ec.current.bornAgain && <span className="text-[10px] text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">Will create Son of God</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end space-x-3">
              <Button type="button" variant="secondary" onClick={() => setStep('input')}>Back</Button>
              <Button type="button" variant="primary" onClick={async()=>{
                const validated = editableContacts.map(ec=> ({ ...ec, errors: validate(ec.current) }));
                const hasErrors = validated.some(v=> Object.keys(v.errors).length>0);
                if (hasErrors) { setEditableContacts(validated); return; }
                // apply modifications back to parseResult for payload conversion
                if (parseResult) {
                  parseResult.contacts = validated.map(v => ({ ...v.original, name: v.current.name, phoneNumber: v.current.phoneNumber, roomNumber: v.current.roomNumber }));
                }
                await handleAdd();
              }}>Add All ({editableContacts.length})</Button>
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
