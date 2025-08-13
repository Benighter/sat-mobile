import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedImage: string) => void;
  onCancel: () => void;
  aspectRatio?: number; // width/height ratio, undefined for free crop
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

const ImageCropper: React.FC<ImageCropperProps> = ({
  image,
  onCropComplete,
  onCancel,
  aspectRatio
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [cropArea, setCropArea] = useState<CropArea>({ x: 50, y: 50, width: 200, height: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  // Initialize crop area when image loads
  useEffect(() => {
    if (imageLoaded && imageRef.current && containerRef.current) {
      const img = imageRef.current;
      const container = containerRef.current;
      
      // Calculate initial image size to fit container
      const containerWidth = container.clientWidth - 40; // padding
      const containerHeight = container.clientHeight - 120; // space for controls
      
      const imgAspectRatio = img.naturalWidth / img.naturalHeight;
      const containerAspectRatio = containerWidth / containerHeight;
      
      let displayWidth, displayHeight;
      
      if (imgAspectRatio > containerAspectRatio) {
        displayWidth = containerWidth;
        displayHeight = containerWidth / imgAspectRatio;
      } else {
        displayHeight = containerHeight;
        displayWidth = containerHeight * imgAspectRatio;
      }
      
      setImageSize({ width: displayWidth, height: displayHeight });
      setImagePosition({ 
        x: (containerWidth - displayWidth) / 2 + 20,
        y: (containerHeight - displayHeight) / 2 + 60
      });
      
      // Set initial crop area
      const cropSize = Math.min(displayWidth, displayHeight) * 0.6;
      const cropWidth = aspectRatio ? cropSize : cropSize;
      const cropHeight = aspectRatio ? cropSize / aspectRatio : cropSize;
      
      setCropArea({
        x: (containerWidth - cropWidth) / 2 + 20,
        y: (containerHeight - cropHeight) / 2 + 60,
        width: cropWidth,
        height: cropHeight
      });
    }
  }, [imageLoaded, aspectRatio]);

  const getEventPosition = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent, action: 'drag' | 'resize') => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pos = getEventPosition(e);
    setDragStart({
      x: pos.x - rect.left,
      y: pos.y - rect.top
    });

    if (action === 'drag') {
      setIsDragging(true);
    } else {
      setIsResizing(true);
    }
  }, []);

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging && !isResizing) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pos = getEventPosition(e);
    const currentX = pos.x - rect.left;
    const currentY = pos.y - rect.top;
    const deltaX = currentX - dragStart.x;
    const deltaY = currentY - dragStart.y;
    
    if (isDragging) {
      setCropArea(prev => ({
        ...prev,
        x: Math.max(imagePosition.x, Math.min(imagePosition.x + imageSize.width - prev.width, prev.x + deltaX)),
        y: Math.max(imagePosition.y, Math.min(imagePosition.y + imageSize.height - prev.height, prev.y + deltaY))
      }));
    } else if (isResizing) {
      setCropArea(prev => {
        let newWidth = Math.max(50, prev.width + deltaX);
        let newHeight = aspectRatio ? newWidth / aspectRatio : Math.max(50, prev.height + deltaY);
        
        // Ensure crop area stays within image bounds
        newWidth = Math.min(newWidth, imagePosition.x + imageSize.width - prev.x);
        newHeight = Math.min(newHeight, imagePosition.y + imageSize.height - prev.y);
        
        if (aspectRatio) {
          newHeight = newWidth / aspectRatio;
        }
        
        return {
          ...prev,
          width: newWidth,
          height: newHeight
        };
      });
    }
    
    setDragStart({ x: currentX, y: currentY });
  }, [isDragging, isResizing, dragStart, imagePosition, imageSize, aspectRatio]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  const handleZoom = (direction: 'in' | 'out') => {
    const newZoom = direction === 'in' ? Math.min(zoom * 1.2, 3) : Math.max(zoom / 1.2, 0.5);
    setZoom(newZoom);
    
    setImageSize(prev => ({
      width: prev.width * (newZoom / zoom),
      height: prev.height * (newZoom / zoom)
    }));
  };

  const cropImage = useCallback(() => {
    if (!imageRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;
    
    if (!ctx) return;
    
    // Calculate the crop area relative to the original image
    const scaleX = img.naturalWidth / imageSize.width;
    const scaleY = img.naturalHeight / imageSize.height;
    
    const cropX = (cropArea.x - imagePosition.x) * scaleX;
    const cropY = (cropArea.y - imagePosition.y) * scaleY;
    const cropWidth = cropArea.width * scaleX;
    const cropHeight = cropArea.height * scaleY;
    
    // Set canvas size to crop area size
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    
    // Draw the cropped image
    ctx.drawImage(
      img,
      cropX, cropY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );
    
    // Convert to base64
    const croppedImage = canvas.toDataURL('image/jpeg', 0.9);
    onCropComplete(croppedImage);
  }, [cropArea, imagePosition, imageSize, onCropComplete]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 z-50 flex flex-col max-h-screen">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-xl border-b border-white/10 flex-shrink-0">
        <div className="flex items-center justify-between p-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">Crop Your Image</h3>
            <p className="text-gray-300 text-sm">
              {aspectRatio ? `${aspectRatio.toFixed(2)}:1 aspect ratio` : 'Free crop mode'}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleZoom('out')}
              className="p-3 hover:bg-white/10 rounded-xl transition-all duration-200 text-gray-300 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleZoom('in')}
              className="p-3 hover:bg-white/10 rounded-xl transition-all duration-200 text-gray-300 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button
              onClick={onCancel}
              className="p-3 hover:bg-white/10 rounded-xl transition-all duration-200 text-gray-300 hover:text-white"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Crop Area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden touch-none bg-gradient-to-br from-gray-800/50 to-gray-900/50"
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        <img
          ref={imageRef}
          src={image}
          alt="Crop preview"
          className="absolute select-none"
          style={{
            left: imagePosition.x,
            top: imagePosition.y,
            width: imageSize.width,
            height: imageSize.height,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left'
          }}
          onLoad={() => setImageLoaded(true)}
          draggable={false}
        />
        
        {/* Crop overlay */}
        {imageLoaded && (
          <>
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/60 pointer-events-none" />

            {/* Crop area */}
            <div
              className="absolute border-2 border-blue-400 cursor-move touch-none shadow-lg"
              style={{
                left: cropArea.x,
                top: cropArea.y,
                width: cropArea.width,
                height: cropArea.height,
                backgroundColor: 'transparent',
                boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.3), 0 0 20px rgba(59, 130, 246, 0.2)'
              }}
              onMouseDown={(e) => handlePointerDown(e, 'drag')}
              onTouchStart={(e) => handlePointerDown(e, 'drag')}
            >
              {/* Corner resize handle */}
              <div
                className="absolute -bottom-3 -right-3 w-6 h-6 bg-blue-500 border-2 border-white cursor-se-resize rounded-full touch-none flex items-center justify-center shadow-lg hover:bg-blue-400 transition-all duration-200 hover:scale-110"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handlePointerDown(e, 'resize');
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  handlePointerDown(e, 'resize');
                }}
              >
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z"/>
                </svg>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white/5 backdrop-blur-xl border-t border-white/10 flex-shrink-0">
        <div className="p-6">
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
            <button
              onClick={onCancel}
              className="flex-1 sm:flex-none px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all duration-200 font-medium border border-white/20 hover:border-white/30"
            >
              Cancel
            </button>
            <button
              onClick={cropImage}
              className="flex-1 sm:flex-none px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center space-x-2"
            >
              <Check className="w-5 h-5" />
              <span>Apply Crop</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hidden canvas for cropping */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default ImageCropper;
