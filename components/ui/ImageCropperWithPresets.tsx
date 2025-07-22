import React, { useState } from 'react';
import { Square, Smartphone, Monitor, User } from 'lucide-react';
import ImageCropper from './ImageCropper';

interface ImageCropperWithPresetsProps {
  image: string;
  onCropComplete: (croppedImage: string) => void;
  onCancel: () => void;
}

interface AspectRatioPreset {
  name: string;
  ratio: number | undefined;
  icon: React.ReactNode;
  description: string;
}

const aspectRatioPresets: AspectRatioPreset[] = [
  {
    name: 'Free',
    ratio: undefined,
    icon: <Square className="w-5 h-5" />,
    description: 'Any size'
  },
  {
    name: 'Square',
    ratio: 1,
    icon: <Square className="w-5 h-5" />,
    description: '1:1 - Perfect for profiles'
  },
  {
    name: 'Portrait',
    ratio: 3/4,
    icon: <Smartphone className="w-5 h-5" />,
    description: '3:4 - Mobile friendly'
  },
  {
    name: 'Landscape',
    ratio: 16/9,
    icon: <Monitor className="w-5 h-5" />,
    description: '16:9 - Widescreen'
  },
  {
    name: 'Profile',
    ratio: 4/5,
    icon: <User className="w-5 h-5" />,
    description: '4:5 - Social media'
  }
];

const ImageCropperWithPresets: React.FC<ImageCropperWithPresetsProps> = ({
  image,
  onCropComplete,
  onCancel
}) => {
  const [selectedPreset, setSelectedPreset] = useState<AspectRatioPreset>(aspectRatioPresets[1]); // Default to square
  const [showCropper, setShowCropper] = useState(false);

  const handlePresetSelect = (preset: AspectRatioPreset) => {
    setSelectedPreset(preset);
    setShowCropper(true);
  };

  const handleCropComplete = (croppedImage: string) => {
    onCropComplete(croppedImage);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
  };

  if (showCropper) {
    return (
      <ImageCropper
        image={image}
        aspectRatio={selectedPreset.ratio}
        onCropComplete={handleCropComplete}
        onCancel={handleCropCancel}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-900 text-white">
        <h3 className="text-lg font-semibold">Choose Crop Style</h3>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Preview Image */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <img
            src={image}
            alt="Preview"
            className="w-full h-64 object-cover rounded-lg mb-6"
          />
          
          {/* Aspect Ratio Presets */}
          <div className="space-y-3">
            <h4 className="text-white text-sm font-medium mb-3">Select crop style:</h4>
            {aspectRatioPresets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handlePresetSelect(preset)}
                className={`w-full p-4 rounded-lg border-2 transition-all duration-200 flex items-center space-x-3 ${
                  selectedPreset.name === preset.name
                    ? 'border-blue-500 bg-blue-500 bg-opacity-20 text-blue-300'
                    : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500 hover:bg-gray-700'
                }`}
              >
                <div className="flex-shrink-0">
                  {preset.icon}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">{preset.name}</div>
                  <div className="text-sm opacity-75">{preset.description}</div>
                </div>
                <div className="flex-shrink-0">
                  {selectedPreset.name === preset.name && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-4 bg-gray-900">
        <div className="text-gray-400 text-sm">
          Choose a crop style that fits your needs
        </div>
        <div className="flex space-x-3">
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => setShowCropper(true)}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropperWithPresets;
