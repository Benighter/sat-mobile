import React, { useState } from 'react';
import { ArrowDownTrayIcon, DocumentTextIcon, EyeIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '../icons';
import { ProofAttachment } from '../../types';

interface ProofViewerProps {
  proofs: ProofAttachment[];
  type: 'offering' | 'tithe' | 'cash-offering' | 'cash-tithe';
  sundayDate: string;
  onRemove?: (index: number) => void;
}

const ProofViewer: React.FC<ProofViewerProps> = ({ proofs, type, sundayDate, onRemove }) => {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  if (!proofs.length) return null;

  const accentColor = (type === 'offering' || type === 'cash-offering') ? 'emerald' : 'blue';
  const borderColor = accentColor === 'emerald' ? 'border-emerald-200' : 'border-blue-200';
  const bgLight = accentColor === 'emerald' ? 'bg-emerald-50/60' : 'bg-blue-50/60';
  const badgeBg = accentColor === 'emerald' ? 'bg-emerald-100' : 'bg-blue-100';
  const badgeText = accentColor === 'emerald' ? 'text-emerald-700' : 'text-blue-700';
  const label = type === 'offering' ? 'Online Offering' : type === 'tithe' ? 'Online Tithe' : type === 'cash-offering' ? 'Cash Offering' : 'Cash Tithe';

  const getProofSource = (proof: ProofAttachment): string => proof.url || proof.data || '';
  const imageIndexes = proofs
    .map((proof, index) => ({ proof, index }))
    .filter(({ proof }) => proof.type === 'image' && Boolean(getProofSource(proof)));
  const previewPosition = previewIndex === null
    ? -1
    : imageIndexes.findIndex(({ index }) => index === previewIndex);

  const downloadProof = (proof: ProofAttachment) => {
    const source = getProofSource(proof);
    if (!source) return;

    const link = document.createElement('a');
    link.href = source;
    const ext = proof.type === 'pdf' ? 'pdf' : proof.name.split('.').pop() || 'jpg';
    link.download = `${label.toLowerCase()}-proof-${sundayDate}-${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openPreview = (index: number) => setPreviewIndex(index);
  const closePreview = () => setPreviewIndex(null);

  const showPrevious = () => {
    if (previewPosition === -1 || imageIndexes.length === 0) return;
    const previousPosition = (previewPosition - 1 + imageIndexes.length) % imageIndexes.length;
    setPreviewIndex(imageIndexes[previousPosition].index);
  };

  const showNext = () => {
    if (previewPosition === -1 || imageIndexes.length === 0) return;
    const nextPosition = (previewPosition + 1) % imageIndexes.length;
    setPreviewIndex(imageIndexes[nextPosition].index);
  };

  const currentPreview = previewIndex !== null ? proofs[previewIndex] : null;
  const currentPreviewSource = currentPreview ? getProofSource(currentPreview) : '';

  return (
    <>
      <div className="space-y-2">
        {proofs.map((proof, index) => (
          <div
            key={`${proof.storagePath || proof.url || proof.name}-${index}`}
            className={`rounded-xl border ${borderColor} ${bgLight} p-3 transition-all hover:shadow-sm`}
          >
            <div className="flex items-start gap-3">
              {/* Thumbnail */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden ${
                proof.type === 'pdf' ? 'bg-red-50 border border-red-100' : 'bg-gray-100'
              }`}>
                {proof.type === 'pdf' ? (
                  <DocumentTextIcon className="w-5 h-5 text-red-500" />
                ) : (
                  <img src={getProofSource(proof)} alt={proof.name} className="w-10 h-10 rounded-lg object-cover" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate leading-snug">{proof.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${badgeBg} ${badgeText}`}>
                    {proof.type === 'pdf' ? 'PDF' : 'Image'}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(proof.uploadedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions row */}
            <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-gray-200/50">
              {proof.type === 'image' && getProofSource(proof) && (
                <button
                  onClick={() => openPreview(index)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-gray-600 hover:bg-white/80 hover:text-gray-900 transition-colors"
                  title="Preview"
                >
                  <EyeIcon className="w-3.5 h-3.5" />
                  Preview
                </button>
              )}
              <button
                onClick={() => downloadProof(proof)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-gray-600 hover:bg-white/80 hover:text-gray-900 transition-colors"
                title="Download"
              >
                <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                Download
              </button>
              {onRemove && (
                <button
                  onClick={() => onRemove(index)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  title="Remove"
                >
                  <XMarkIcon className="w-3.5 h-3.5" />
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {previewIndex !== null && currentPreview && currentPreview.type === 'image' && currentPreviewSource && (
        <div
          className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/90"
          onClick={closePreview}
        >
          <button
            onClick={(e) => { e.stopPropagation(); closePreview(); }}
            className="absolute top-4 right-4 z-10 rounded-full bg-white/20 p-2 text-white backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>

          {imageIndexes.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); showPrevious(); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/20 p-2 text-white backdrop-blur-sm hover:bg-white/30 transition-colors"
              >
                <ChevronLeftIcon className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); showNext(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/20 p-2 text-white backdrop-blur-sm hover:bg-white/30 transition-colors"
              >
                <ChevronRightIcon className="w-6 h-6" />
              </button>
            </>
          )}

          <div className="max-w-[90vw] max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={currentPreviewSource}
              alt={currentPreview.name}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            <div className="mt-3 flex items-center gap-3">
              <p className="text-sm text-white/80 truncate max-w-[200px]">{currentPreview.name}</p>
              <button
                onClick={() => downloadProof(currentPreview)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-white/30 transition-colors"
              >
                <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                Download
              </button>
            </div>
            <p className="mt-1 text-xs text-white/50">
              {previewPosition + 1} / {imageIndexes.length}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default ProofViewer;
