import React from 'react';
import { X, Info, Mail, Github, Linkedin, Globe, User, Heart } from 'lucide-react';
import Modal from './ui/Modal';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="relative overflow-hidden">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white relative">
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
              <Info className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">About This App</h2>
              <p className="text-white text-opacity-90">Church Attendance Tracker</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* App Description */}
          <div className="mb-8">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-gradient-to-r from-blue-500 to-indigo-600 bg-opacity-10 rounded-3xl">
                <Heart className="w-12 h-12 text-blue-600" />
              </div>
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
              SAT Mobile - Church Management Made Simple
            </h3>
            
            <p className="text-gray-600 mb-4 text-center leading-relaxed">
              A comprehensive church attendance tracking system designed to help church leaders 
              manage members, track attendance, and organize church activities efficiently. 
              Built with love for the church community.
            </p>
            
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <h4 className="font-semibold text-gray-800 mb-3">Key Features:</h4>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <span>Member registration and management</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <span>Sunday service attendance tracking</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <span>Bacenta (small group) organization</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <span>New believer follow-up system</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <span>Analytics and reporting tools</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Creator Information */}
          <div className="border-t pt-8">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                  BN
                </div>
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Created by Bennet Nkolele</h4>
              <p className="text-gray-600 mb-6">
                Full-Stack Developer & Church Technology Enthusiast
              </p>
            </div>

            {/* Contact Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a
                href="mailto:bennet.nkolele1998@gmail.com"
                className="flex items-center space-x-3 p-4 rounded-lg bg-red-50 hover:bg-red-100 transition-colors duration-200 group"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Mail className="w-5 h-5 text-red-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-red-700">Email</p>
                  <p className="text-xs text-red-600 truncate">bennet.nkolele1998@gmail.com</p>
                </div>
              </a>

              <a
                href="https://github.com/Benighter"
                className="flex items-center space-x-3 p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200 group"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="w-5 h-5 text-gray-700" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800">GitHub</p>
                  <p className="text-xs text-gray-600 truncate">🧠 github.com/Benighter</p>
                </div>
              </a>

              <a
                href="https://www.linkedin.com/in/bennet-nkolele-321285249/"
                className="flex items-center space-x-3 p-4 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors duration-200 group"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Linkedin className="w-5 h-5 text-blue-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-blue-700">LinkedIn</p>
                  <p className="text-xs text-blue-600 truncate">💼 Professional Profile</p>
                </div>
              </a>

              <a
                href="https://react-personal-portfolio-alpha.vercel.app/"
                className="flex items-center space-x-3 p-4 rounded-lg bg-green-50 hover:bg-green-100 transition-colors duration-200 group"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Globe className="w-5 h-5 text-green-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-green-700">Portfolio</p>
                  <p className="text-xs text-green-600 truncate">🌐 View My Work</p>
                </div>
              </a>
            </div>

            {/* Thank You Message */}
            <div className="mt-8 text-center bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
              <Heart className="w-8 h-8 text-red-500 mx-auto mb-3" />
              <p className="text-gray-700 font-medium mb-2">Thank you for using SAT Mobile!</p>
              <p className="text-sm text-gray-600">
                Built with passion to serve the church community and make church management easier.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AboutModal;