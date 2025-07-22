import React, { useState } from 'react';
import ImageUpload from './ui/ImageUpload';
import { Camera, Crop, Image as ImageIcon } from 'lucide-react';

const ImageCropperDemo: React.FC = () => {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [memberImage, setMemberImage] = useState<string | null>(null);
  const [freeImage, setFreeImage] = useState<string | null>(null);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Image Cropper Demo</h1>
        <p className="text-gray-600">
          Upload images and crop them with different aspect ratios and styles
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Image with Presets */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Camera className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Profile Image</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Upload with preset crop options (Square, Portrait, etc.)
          </p>
          <div className="flex justify-center">
            <ImageUpload
              value={profileImage}
              onChange={setProfileImage}
              size="lg"
              enableCropping={true}
              cropPresets={true}
            />
          </div>
          <div className="mt-4 text-xs text-gray-500 text-center">
            Includes preset aspect ratios
          </div>
        </div>

        {/* Member Image with Free Crop */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Crop className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Member Image</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Upload with free-form cropping (no presets)
          </p>
          <div className="flex justify-center">
            <ImageUpload
              value={memberImage}
              onChange={setMemberImage}
              size="lg"
              enableCropping={true}
              cropPresets={false}
            />
          </div>
          <div className="mt-4 text-xs text-gray-500 text-center">
            Free-form cropping
          </div>
        </div>

        {/* No Cropping */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <ImageIcon className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Simple Upload</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Upload without cropping functionality
          </p>
          <div className="flex justify-center">
            <ImageUpload
              value={freeImage}
              onChange={setFreeImage}
              size="lg"
              enableCropping={false}
            />
          </div>
          <div className="mt-4 text-xs text-gray-500 text-center">
            No cropping
          </div>
        </div>
      </div>

      {/* Usage Examples */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Examples</h3>
        <div className="space-y-4 text-sm">
          <div className="bg-white p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Profile Image with Presets:</h4>
            <code className="text-gray-600 bg-gray-100 p-2 rounded block">
              {`<ImageUpload
  value={profileImage}
  onChange={setProfileImage}
  enableCropping={true}
  cropPresets={true}
/>`}
            </code>
          </div>
          
          <div className="bg-white p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Free-form Cropping:</h4>
            <code className="text-gray-600 bg-gray-100 p-2 rounded block">
              {`<ImageUpload
  value={memberImage}
  onChange={setMemberImage}
  enableCropping={true}
  cropPresets={false}
/>`}
            </code>
          </div>
          
          <div className="bg-white p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">No Cropping:</h4>
            <code className="text-gray-600 bg-gray-100 p-2 rounded block">
              {`<ImageUpload
  value={image}
  onChange={setImage}
  enableCropping={false}
/>`}
            </code>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="bg-blue-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span>Touch and mouse support</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span>Preset aspect ratios</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span>Free-form cropping</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span>Zoom in/out functionality</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span>Drag to move crop area</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span>Resize crop area</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span>Mobile-friendly interface</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span>High-quality output</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropperDemo;
