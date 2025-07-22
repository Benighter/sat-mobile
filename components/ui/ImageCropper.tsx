import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Check, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-900 text-white">
        <h3 className="text-lg font-semibold">Crop Image</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleZoom('out')}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleZoom('in')}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Crop Area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden touch-none"
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
            <div className="absolute inset-0 bg-black bg-opacity-50 pointer-events-none" />
            
            {/* Crop area */}
            <div
              className="absolute border-2 border-white cursor-move touch-none"
              style={{
                left: cropArea.x,
                top: cropArea.y,
                width: cropArea.width,
                height: cropArea.height,
                backgroundColor: 'transparent'
              }}
              onMouseDown={(e) => handlePointerDown(e, 'drag')}
              onTouchStart={(e) => handlePointerDown(e, 'drag')}
            >
              {/* Corner resize handle */}
              <div
                className="absolute -bottom-2 -right-2 w-8 h-8 bg-white border-2 border-blue-500 cursor-se-resize rounded-full touch-none flex items-center justify-center"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handlePointerDown(e, 'resize');
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  handlePointerDown(e, 'resize');
                }}
              >
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-4 bg-gray-900">
        <div className="text-white text-sm">
          {aspectRatio ? `Aspect Ratio: ${aspectRatio.toFixed(2)}:1` : 'Free Crop'}
        </div>
        <div className="flex space-x-3">
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={cropImage}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Check className="w-4 h-4" />
            <span>Apply Crop</span>
          </button>
        </div>
      </div>

      {/* Hidden canvas for cropping */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default ImageCropper;
