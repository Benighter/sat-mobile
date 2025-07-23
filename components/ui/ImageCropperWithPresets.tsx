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
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 z-50 flex flex-col max-h-screen">
      {/* Header */}
      <div className="relative bg-white/5 backdrop-blur-xl border-b border-white/10 flex-shrink-0">
        <div className="flex items-center justify-between p-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">Choose Crop Style</h3>
            <p className="text-gray-300 text-sm">Select the perfect aspect ratio for your image</p>
          </div>
          <button
            onClick={onCancel}
            className="p-3 hover:bg-white/10 rounded-xl transition-all duration-200 text-gray-300 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="p-6 max-w-2xl mx-auto">
          {/* Preview Image */}
          <div className="relative mb-8">
            <div className="relative overflow-hidden rounded-2xl shadow-2xl">
              <img
                src={image}
                alt="Preview"
                className="w-full h-48 sm:h-56 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            </div>
            <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
              <div className="bg-white/10 backdrop-blur-xl rounded-full px-4 py-2 border border-white/20">
                <span className="text-white text-sm font-medium">Original Image</span>
              </div>
            </div>
          </div>

          {/* Aspect Ratio Presets Grid */}
          <div className="space-y-4">
            <h4 className="text-white text-lg font-semibold mb-6 text-center">Select your preferred crop style</h4>
            <div className="grid gap-3">
              {aspectRatioPresets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handlePresetSelect(preset)}
                  className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 transform hover:scale-[1.02] ${
                    selectedPreset.name === preset.name
                      ? 'border-blue-400 bg-gradient-to-r from-blue-500/20 to-purple-500/20 shadow-lg shadow-blue-500/25'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center p-5">
                    <div className={`flex-shrink-0 p-3 rounded-xl mr-4 transition-colors ${
                      selectedPreset.name === preset.name
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-white/10 text-gray-300 group-hover:text-white'
                    }`}>
                      {preset.icon}
                    </div>
                    <div className="flex-1 text-left">
                      <div className={`font-semibold text-lg mb-1 transition-colors ${
                        selectedPreset.name === preset.name ? 'text-white' : 'text-gray-200 group-hover:text-white'
                      }`}>
                        {preset.name}
                      </div>
                      <div className={`text-sm transition-colors ${
                        selectedPreset.name === preset.name ? 'text-blue-200' : 'text-gray-400 group-hover:text-gray-300'
                      }`}>
                        {preset.description}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {selectedPreset.name === preset.name ? (
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-6 h-6 border-2 border-gray-400 rounded-full group-hover:border-gray-300 transition-colors"></div>
                      )}
                    </div>
                  </div>

                  {/* Selection indicator */}
                  {selectedPreset.name === preset.name && (
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 pointer-events-none"></div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
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
              onClick={() => setShowCropper(true)}
              className="flex-1 sm:flex-none px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Continue with {selectedPreset.name}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropperWithPresets;
