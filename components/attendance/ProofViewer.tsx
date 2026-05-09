import React, { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ArrowDownTrayIcon, DocumentTextIcon, EyeIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '../icons';
import { ProofAttachment } from '../../types';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface ProofViewerProps {
  proofs: ProofAttachment[];
  type: 'offering' | 'tithe' | 'cash-offering' | 'cash-tithe';
  sundayDate: string;
  onRemove?: (index: number) => void;
}

interface PdfCanvasReviewProps {
  source: string;
  fileName: string;
  onDownload: () => void;
  onOpen: () => void;
}

const PdfCanvasReview: React.FC<PdfCanvasReviewProps> = ({ source, fileName, onDownload, onOpen }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => setContainerWidth(container.clientWidth);
    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const loadingTask = getDocument({ url: source });

    setIsLoading(true);
    setError(null);
    setPdfDocument(null);
    setPageNumber(1);
    setPageCount(0);

    loadingTask.promise
      .then((loadedDocument) => {
        if (isCancelled) {
          loadedDocument.destroy();
          return;
        }

        setPdfDocument(loadedDocument);
        setPageCount(loadedDocument.numPages);
      })
      .catch(() => {
        if (!isCancelled) {
          setError('Could not load this PDF for in-app review.');
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
      loadingTask.destroy();
    };
  }, [source]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!pdfDocument || !canvas || containerWidth <= 0) return;

    let isCancelled = false;

    const renderPage = async () => {
      renderTaskRef.current?.cancel();
      setIsRendering(true);

      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (isCancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.min(Math.max(containerWidth - 32, 280), 980);
        const pageScale = availableWidth / baseViewport.width;
        const viewport = page.getViewport({ scale: pageScale });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        const canvasContext = canvas.getContext('2d');
        if (!canvasContext) return;

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        canvasContext.setTransform(1, 0, 0, 1, 0, 0);
        canvasContext.clearRect(0, 0, canvas.width, canvas.height);

        const renderTask = page.render({
          canvas,
          viewport,
          transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
        });

        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException' && !isCancelled) {
          setError('Could not render this PDF page.');
        }
      } finally {
        if (!isCancelled) {
          renderTaskRef.current = null;
          setIsRendering(false);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [pdfDocument, pageNumber, containerWidth]);

  useEffect(() => () => {
    pdfDocument?.destroy();
  }, [pdfDocument]);

  const goToPreviousPage = () => setPageNumber(current => Math.max(1, current - 1));
  const goToNextPage = () => setPageNumber(current => Math.min(pageCount, current + 1));

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col bg-gray-100">
      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-gray-200 bg-white px-3 py-2">
        <button
          onClick={goToPreviousPage}
          disabled={!pdfDocument || pageNumber <= 1}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Page
        </button>
        <span className="min-w-[84px] text-center text-xs font-semibold text-gray-600">
          {pageCount ? `${pageNumber} / ${pageCount}` : 'Loading'}
        </span>
        <button
          onClick={goToNextPage}
          disabled={!pdfDocument || pageNumber >= pageCount}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Page
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-4">
        <div className="mx-auto flex min-h-full w-full max-w-5xl items-center justify-center">
          {error ? (
            <div className="flex max-w-sm flex-col items-center rounded-xl border border-red-100 bg-white px-6 py-8 text-center shadow-sm">
              <DocumentTextIcon className="mb-4 h-12 w-12 text-red-400" />
              <p className="text-sm font-semibold text-gray-800">{error}</p>
              <p className="mt-1 text-xs text-gray-500">Open it in the browser or download it to review {fileName}.</p>
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={onOpen}
                  className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800"
                >
                  Open PDF
                </button>
                <button
                  onClick={onDownload}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Download
                </button>
              </div>
            </div>
          ) : (
            <div className="relative flex w-full justify-center">
              {(isLoading || isRendering) && (
                <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-gray-900/80 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
                  {isLoading ? 'Loading PDF...' : 'Rendering page...'}
                </div>
              )}
              <canvas ref={canvasRef} className="max-w-full rounded-lg bg-white shadow-lg" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ProofViewer: React.FC<ProofViewerProps> = ({ proofs, type, sundayDate, onRemove }) => {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const accentColor = (type === 'offering' || type === 'cash-offering') ? 'emerald' : 'blue';
  const borderColor = accentColor === 'emerald' ? 'border-emerald-200' : 'border-blue-200';
  const bgLight = accentColor === 'emerald' ? 'bg-emerald-50/60' : 'bg-blue-50/60';
  const badgeBg = accentColor === 'emerald' ? 'bg-emerald-100' : 'bg-blue-100';
  const badgeText = accentColor === 'emerald' ? 'text-emerald-700' : 'text-blue-700';
  const label = type === 'offering' ? 'Online Offering' : type === 'tithe' ? 'Online Tithe' : type === 'cash-offering' ? 'Cash Offering' : 'Cash Tithe';

  const getProofSource = (proof: ProofAttachment): string => proof.url || proof.data || '';
  const reviewableIndexes = proofs
    .map((proof, index) => ({ proof, index }))
    .filter(({ proof }) => Boolean(getProofSource(proof)));
  const previewPosition = previewIndex === null
    ? -1
    : reviewableIndexes.findIndex(({ index }) => index === previewIndex);

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

  const openProofInNewTab = (proof: ProofAttachment) => {
    const source = getProofSource(proof);
    if (!source) return;

    const newWindow = window.open(source, '_blank', 'noopener,noreferrer');
    if (newWindow) {
      newWindow.opener = null;
    }
  };

  const openPreview = (index: number) => setPreviewIndex(index);
  const closePreview = () => setPreviewIndex(null);

  const showPrevious = () => {
    if (previewPosition === -1 || reviewableIndexes.length === 0) return;
    const previousPosition = (previewPosition - 1 + reviewableIndexes.length) % reviewableIndexes.length;
    setPreviewIndex(reviewableIndexes[previousPosition].index);
  };

  const showNext = () => {
    if (previewPosition === -1 || reviewableIndexes.length === 0) return;
    const nextPosition = (previewPosition + 1) % reviewableIndexes.length;
    setPreviewIndex(reviewableIndexes[nextPosition].index);
  };

  const currentPreview = previewIndex !== null ? proofs[previewIndex] : null;
  const currentPreviewSource = currentPreview ? getProofSource(currentPreview) : '';

  useEffect(() => {
    if (previewIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePreview();
        return;
      }

      if (reviewableIndexes.length <= 1) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showPrevious();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        showNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewIndex, previewPosition, reviewableIndexes.length]);

  if (!proofs.length) return null;

  return (
    <>
      <div className="space-y-2">
        {proofs.map((proof, index) => {
          const proofSource = getProofSource(proof);
          const isReviewable = Boolean(proofSource);
          const reviewLabel = proof.type === 'pdf' ? 'Review' : 'Preview';

          return (
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
                    <img src={proofSource} alt={proof.name} className="w-10 h-10 rounded-lg object-cover" />
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
                {isReviewable && (
                  <button
                    onClick={() => openPreview(index)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-gray-600 hover:bg-white/80 hover:text-gray-900 transition-colors"
                    title={proof.type === 'pdf' ? 'Review PDF' : 'Preview image'}
                  >
                    <EyeIcon className="w-3.5 h-3.5" />
                    {reviewLabel}
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
          );
        })}
      </div>

      {previewIndex !== null && currentPreview && currentPreviewSource && (
        <div
          className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/90 p-2 sm:p-4"
          onClick={closePreview}
        >
          <button
            onClick={(e) => { e.stopPropagation(); closePreview(); }}
            className="absolute top-4 right-4 z-10 rounded-full bg-white/20 p-2 text-white backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>

          {reviewableIndexes.length > 1 && (
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

          {currentPreview.type === 'pdf' ? (
            <div
              className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-red-100 bg-red-50">
                    <DocumentTextIcon className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{currentPreview.name}</p>
                    <p className="text-xs text-gray-500">{previewPosition + 1} / {reviewableIndexes.length}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openProofInNewTab(currentPreview)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-white hover:text-gray-900"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => downloadProof(currentPreview)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-white hover:text-gray-900"
                  >
                    <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                    Download
                  </button>
                  <button
                    onClick={closePreview}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white hover:text-gray-700"
                    title="Close"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <PdfCanvasReview
                source={currentPreviewSource}
                fileName={currentPreview.name}
                onDownload={() => downloadProof(currentPreview)}
                onOpen={() => openProofInNewTab(currentPreview)}
              />
            </div>
          ) : (
            <div className="flex max-h-[85vh] max-w-[90vw] flex-col items-center" onClick={(e) => e.stopPropagation()}>
              <img
                src={currentPreviewSource}
                alt={currentPreview.name}
                className="max-h-[80vh] max-w-full rounded-lg object-contain"
              />
              <div className="mt-3 flex items-center gap-3">
                <p className="max-w-[200px] truncate text-sm text-white/80">{currentPreview.name}</p>
                <button
                  onClick={() => downloadProof(currentPreview)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/30"
                >
                  <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                  Download
                </button>
              </div>
              <p className="mt-1 text-xs text-white/50">
                {previewPosition + 1} / {reviewableIndexes.length}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ProofViewer;
