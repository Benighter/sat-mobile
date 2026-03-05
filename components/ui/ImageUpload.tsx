import React, { useState, useRef } from 'react';
import { Camera, X, User, Upload, Crop } from 'lucide-react';
import ImageCropper from './ImageCropper';
import ImageCropperWithPresets from './ImageCropperWithPresets';

interface ImageUploadProps {
  value?: string; // Base64 string
  onChange: (base64: string | null) => void;
  onError?: (title: string, message: string) => void; // optional toast handler
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  enableCropping?: boolean; // Enable cropping functionality
  cropPresets?: boolean; // Use preset cropper (default: true)
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  className = '',
  size = 'md',
  enableCropping = true,
  cropPresets = true,
  onError
}) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  };

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      // Validate type and size
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (!validTypes.includes(file.type)) {
        onError?.('Invalid image type', 'Please upload a JPG, PNG, or WEBP image.');
        return;
      }
      if (file.size > maxSize) {
        // Try downscaling large images rather than rejecting outright
        const tryDownscale = async () => {
          try {
            const base64 = await fileToBase64(file);
            const downscaled = await downscaleImage(base64, 1920, 1920, 0.85);
            if (downscaled.length < base64.length && downscaled.length <= maxSize * 1.4) {
              // proceed with downscaled
              if (enableCropping) {
                setSelectedImage(downscaled);
                setShowCropper(true);
              } else {
                onChange(downscaled);
              }
              return;
            }
            onError?.('Image too large', 'Image size must be less than 5MB. Please choose a smaller image.');
          } catch (e) {
            onError?.('Image too large', 'Image size must be less than 5MB. Please choose a smaller image.');
          }
        };
        tryDownscale();
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        if (enableCropping) {
          setSelectedImage(base64);
          setShowCropper(true);
        } else {
          onChange(base64);
        }
      };
      reader.readAsDataURL(file);
    } else {
      onError?.('Invalid file', 'Please select a valid image file.');
    }
  };

  const handleCropComplete = (croppedImage: string) => {
    onChange(croppedImage);
    setShowCropper(false);
    setSelectedImage(null);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setSelectedImage(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemoveImage = () => {
    onChange(null);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const openFullScreen = () => {
    if (value) {
      setIsFullScreen(true);
    }
  };

  return (
    <>
      <div className={`relative ${className}`}>
        <div
          className={`
            ${sizeClasses[size]} 
            relative rounded-2xl border-2 border-dashed border-gray-300 
            hover:border-gray-400 transition-all duration-200 cursor-pointer
            ${isDragging ? 'border-blue-500 bg-blue-50' : ''}
            ${value ? 'border-solid border-gray-200' : ''}
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={value ? openFullScreen : openFileDialog}
        >
          {value ? (
            <>
              <img
                src={value}
                alt="Profile"
                className="w-full h-full object-cover rounded-2xl"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-200 rounded-2xl flex items-center justify-center">
                <div className="flex space-x-2">
                  <Camera className="w-5 h-5 text-white opacity-0 hover:opacity-100 transition-opacity duration-200" />
                  {enableCropping && (
                    <Crop className="w-5 h-5 text-white opacity-0 hover:opacity-100 transition-opacity duration-200" />
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
              <User className="w-8 h-8 mb-2" />
              <Upload className="w-4 h-4" />
            </div>
          )}
        </div>

        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveImage();
            }}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {!value && (
          <button
            type="button"
            onClick={openFileDialog}
            className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg"
          >
            <Camera className="w-4 h-4" />
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* Full Screen Modal */}
      {isFullScreen && value && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-full">
            <img
              src={value}
              alt="Profile Full Screen"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <button
              onClick={() => setIsFullScreen(false)}
              className="absolute top-4 right-4 w-10 h-10 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full flex items-center justify-center transition-all duration-200"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="absolute bottom-4 right-4 flex space-x-2">
              {enableCropping && (
                <button
                  onClick={() => {
                    setIsFullScreen(false);
                    setSelectedImage(value);
                    setShowCropper(true);
                  }}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center space-x-2 transition-colors duration-200"
                >
                  <Crop className="w-4 h-4" />
                  <span>Crop</span>
                </button>
              )}
              <button
                onClick={() => {
                  setIsFullScreen(false);
                  openFileDialog();
                }}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center space-x-2 transition-colors duration-200"
              >
                <Camera className="w-4 h-4" />
                <span>Change</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Cropper Modal */}
      {showCropper && selectedImage && (
        <>
          {cropPresets ? (
            <ImageCropperWithPresets
              image={selectedImage}
              onCropComplete={handleCropComplete}
              onCancel={handleCropCancel}
            />
          ) : (
            <ImageCropper
              image={selectedImage}
              onCropComplete={handleCropComplete}
              onCancel={handleCropCancel}
            />
          )}
        </>
      )}
    </>
  );
};

// Helpers
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const downscaleImage = (base64: string, maxW: number, maxH: number, quality = 0.85): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const ratio = Math.min(maxW / width, maxH / height, 1);
      width = Math.floor(width * ratio);
      height = Math.floor(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas not supported'));
      ctx.drawImage(img, 0, 0, width, height);
      const out = canvas.toDataURL('image/jpeg', quality);
      resolve(out);
    };
    img.onerror = reject;
    img.src = base64;
  });

export default ImageUpload;
