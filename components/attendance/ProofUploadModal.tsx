import React, { useRef, useState } from 'react';
import { CloudArrowUpIcon, DocumentTextIcon, XMarkIcon } from '../icons';
import { ProofAttachment } from '../../types';

interface ProofUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (proofs: ProofAttachment[]) => Promise<void>;
  existingProofs: ProofAttachment[];
  type: 'offering' | 'tithe' | 'cash-offering' | 'cash-tithe';
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file (before compression)
const MAX_IMAGE_DIMENSION = 1920; // max width or height in pixels
const JPEG_QUALITY = 0.82; // compression quality (high for document readability)
const MAX_PDF_SIZE = 500 * 1024; // 500KB max for PDFs (stored as-is)
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ACCEPTED_PDF_TYPES = ['application/pdf'];
const ALL_ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_PDF_TYPES];
const ACCEPT_STRING = 'image/jpeg,image/jpg,image/png,image/webp,application/pdf';

const ProofUploadModal: React.FC<ProofUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  existingProofs,
  type,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stagedFiles, setStagedFiles] = useState<ProofAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = type === 'offering' ? 'Online Offering' : type === 'tithe' ? 'Online Tithe' : type === 'cash-offering' ? 'Cash Offering Deposit' : 'Cash Tithe Deposit';
  const accentColor = (type === 'offering' || type === 'cash-offering') ? 'emerald' : 'blue';

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });

  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          if (width > height) {
            height = Math.round(height * (MAX_IMAGE_DIMENSION / width));
            width = MAX_IMAGE_DIMENSION;
          } else {
            width = Math.round(width * (MAX_IMAGE_DIMENSION / height));
            height = MAX_IMAGE_DIMENSION;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Failed to load ${file.name}`)); };
      img.src = url;
    });

  const processFiles = async (files: File[]) => {
    setError(null);
    const newAttachments: ProofAttachment[] = [];

    for (const file of files) {
      if (!ALL_ACCEPTED_TYPES.includes(file.type)) {
        setError(`"${file.name}" is not a supported file type. Use JPG, PNG, WEBP, or PDF.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size is 5MB.`);
        return;
      }

      const isPdf = ACCEPTED_PDF_TYPES.includes(file.type);

      if (isPdf) {
        if (file.size > MAX_PDF_SIZE) {
          setError(`"${file.name}" is too large (${(file.size / 1024).toFixed(0)}KB). PDF max is 500KB.`);
          return;
        }
        const data = await readFileAsDataUrl(file);
        newAttachments.push({
          data,
          name: file.name,
          type: 'pdf',
          uploadedAt: new Date().toISOString(),
        });
      } else {
        const data = await compressImage(file);
        newAttachments.push({
          data,
          name: file.name,
          type: 'image',
          uploadedAt: new Date().toISOString(),
        });
      }
    }

    setStagedFiles(prev => [...prev, ...newAttachments]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length) await processFiles(files);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) await processFiles(files);
  };

  const handleRemoveStaged = (index: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!stagedFiles.length) return;
    setIsUploading(true);
    setError(null);
    try {
      const merged = [...existingProofs, ...stagedFiles];
      await onUpload(merged);
      setStagedFiles([]);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setStagedFiles([]);
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  const borderColor = accentColor === 'emerald' ? 'border-emerald-200' : 'border-blue-200';
  const bgLight = accentColor === 'emerald' ? 'bg-emerald-50' : 'bg-blue-50';
  const textAccent = accentColor === 'emerald' ? 'text-emerald-700' : 'text-blue-700';
  const bgAccent = accentColor === 'emerald' ? 'bg-emerald-600' : 'bg-blue-600';
  const bgAccentHover = accentColor === 'emerald' ? 'hover:bg-emerald-700' : 'hover:bg-blue-700';
  const ringAccent = accentColor === 'emerald' ? 'focus:ring-emerald-500' : 'focus:ring-blue-500';
  const dragBorder = accentColor === 'emerald' ? 'border-emerald-400' : 'border-blue-400';
  const dragBg = accentColor === 'emerald' ? 'bg-emerald-50' : 'bg-blue-50';

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        style={{ maxHeight: 'calc(100dvh - 3rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Upload {label} Proof</h3>
            <p className="text-xs text-gray-500 mt-0.5">Attach proof of payment (images or PDF)</p>
          </div>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ overscrollBehavior: 'contain' }}>
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onClick={() => fileInputRef.current?.click()}
            className={`relative cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 text-center transition-all duration-200 ${
              isDragging
                ? `${dragBorder} ${dragBg}`
                : 'border-gray-300 hover:border-gray-400 bg-gray-50/50 hover:bg-gray-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_STRING}
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <CloudArrowUpIcon className={`w-10 h-10 mx-auto mb-3 ${isDragging ? textAccent : 'text-gray-400'}`} />
            <p className="text-sm font-medium text-gray-700">
              Tap to select or drag files here
            </p>
            <p className="text-xs text-gray-500 mt-1">
              JPG, PNG, WEBP, or PDF — max 2MB each
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Staged files */}
          {stagedFiles.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Ready to upload ({stagedFiles.length})
              </p>
              <div className="space-y-2">
                {stagedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className={`flex items-center gap-3 rounded-xl border ${borderColor} ${bgLight} px-3 py-2.5`}
                  >
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                      file.type === 'pdf' ? 'bg-red-100' : `${bgLight}`
                    }`}>
                      {file.type === 'pdf' ? (
                        <DocumentTextIcon className="w-5 h-5 text-red-600" />
                      ) : (
                        <img src={file.data} alt={file.name} className="w-10 h-10 rounded-lg object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">{file.type === 'pdf' ? 'PDF Document' : 'Image'}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveStaged(index)}
                      disabled={isUploading}
                      className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/80 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Existing proofs preview */}
          {existingProofs.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Already uploaded ({existingProofs.length})
              </p>
              <div className="space-y-2">
                {existingProofs.map((proof, index) => (
                  <div
                    key={`existing-${index}`}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5"
                  >
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                      proof.type === 'pdf' ? 'bg-red-50' : 'bg-gray-100'
                    }`}>
                      {proof.type === 'pdf' ? (
                        <DocumentTextIcon className="w-5 h-5 text-red-500" />
                      ) : (
                        <img src={proof.data} alt={proof.name} className="w-10 h-10 rounded-lg object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{proof.name}</p>
                      <p className="text-xs text-gray-400">{proof.type === 'pdf' ? 'PDF' : 'Image'}</p>
                    </div>
                    <span className="text-[10px] font-medium text-gray-400 flex-shrink-0">Saved</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={isUploading || stagedFiles.length === 0}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold text-white ${bgAccent} ${bgAccentHover} ${ringAccent} focus:ring-2 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isUploading ? 'Uploading...' : `Upload ${stagedFiles.length || ''} File${stagedFiles.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProofUploadModal;
