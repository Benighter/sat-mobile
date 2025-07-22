import React, { useState, useRef } from 'react';
import { Camera, X, User, Upload, Crop } from 'lucide-react';
import ImageCropper from './ImageCropper';
import ImageCropperWithPresets from './ImageCropperWithPresets';

interface ImageUploadProps {
  value?: string; // Base64 string
  onChange: (base64: string | null) => void;
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
  cropPresets = true
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
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
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
      alert('Please select a valid image file');
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

export default ImageUpload;
