import React, { useState, useEffect } from 'react';
import { X, Camera, Crop, Users, Sparkles, ArrowRight } from 'lucide-react';
import Modal from './ui/Modal';

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const features = [
    {
      icon: <Camera className="w-12 h-12 text-blue-500" />,
      title: "Member Profile Pictures",
      description: "You can now add profile pictures when creating or editing member profiles!",
      details: "Upload photos to make your member directory more personal and easier to navigate.",
      gradient: "from-blue-500 to-purple-600"
    },
    {
      icon: <Crop className="w-12 h-12 text-green-500" />,
      title: "Smart Image Cropping",
      description: "Crop and resize images with our new built-in image editor.",
      details: "Choose from preset sizes like square, portrait, or crop freely to get the perfect shot.",
      gradient: "from-green-500 to-teal-600"
    },
    {
      icon: <Users className="w-12 h-12 text-purple-500" />,
      title: "Enhanced Member Management",
      description: "Your member directory is now more visual and organized than ever.",
      details: "Quickly identify members with their photos and enjoy a more intuitive experience.",
      gradient: "from-purple-500 to-pink-600"
    }
  ];

  const handleNext = () => {
    if (currentStep < features.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="relative overflow-hidden">
        {/* Header with gradient background */}
        <div className={`bg-gradient-to-r ${features[currentStep].gradient} p-6 text-white relative`}>
          <div className="absolute top-4 right-4">
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-white bg-opacity-20 rounded-2xl">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">What's New</h2>
              <p className="text-white text-opacity-90">Version 1.1.0</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <div className={`p-4 bg-gradient-to-r ${features[currentStep].gradient} bg-opacity-10 rounded-3xl`}>
                {features[currentStep].icon}
              </div>
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {features[currentStep].title}
            </h3>
            
            <p className="text-gray-600 mb-4">
              {features[currentStep].description}
            </p>
            
            <p className="text-sm text-gray-500">
              {features[currentStep].details}
            </p>
          </div>

          {/* Visual Demo */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-center space-x-4">
              {currentStep === 0 && (
                <div className="flex items-center space-x-3">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg">
                    JD
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                  <div className="w-16 h-16 bg-gray-200 rounded-2xl flex items-center justify-center relative overflow-hidden">
                    <Camera className="w-6 h-6 text-gray-400" />
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 opacity-20"></div>
                  </div>
                  <span className="text-sm text-gray-600">Add photos to member profiles</span>
                </div>
              )}
              
              {currentStep === 1 && (
                <div className="flex items-center space-x-3">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                    <div className="w-12 h-12 border-2 border-dashed border-gray-400 rounded"></div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                  <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center">
                    <Crop className="w-6 h-6 text-green-600" />
                  </div>
                  <span className="text-sm text-gray-600">Crop to perfect size</span>
                </div>
              )}
              
              {currentStep === 2 && (
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center text-white text-xs font-bold">
                      M{i}
                    </div>
                  ))}
                  <div className="col-span-3 text-xs text-gray-600 text-center mt-1">
                    Visual member directory
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Progress indicators */}
          <div className="flex justify-center space-x-2 mb-6">
            {features.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center">
            <button
              onClick={handleSkip}
              className="text-gray-500 hover:text-gray-700 transition-colors text-sm"
            >
              Skip tour
            </button>
            
            <div className="flex space-x-3">
              {currentStep > 0 && (
                <button
                  onClick={handlePrevious}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Previous
                </button>
              )}
              
              <button
                onClick={handleNext}
                className={`px-6 py-2 bg-gradient-to-r ${features[currentStep].gradient} text-white rounded-lg hover:shadow-lg transition-all duration-200 flex items-center space-x-2`}
              >
                <span>{currentStep === features.length - 1 ? 'Get Started' : 'Next'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default WhatsNewModal;
