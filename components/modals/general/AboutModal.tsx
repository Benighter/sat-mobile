import React from 'react';
import { Mail, Github, Linkedin, Globe, Heart } from 'lucide-react';
import Modal from '../../ui/Modal';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title="About This App">
      <div className="relative">
        <div className="flex flex-col items-center text-center px-6 py-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center">
              <Heart className="w-10 h-10 text-indigo-600" />
            </div>
          </div>

          <h3 className="text-lg font-semibold text-gray-900">SAT Mobile - Church Management Made Simple</h3>
          <p className="text-sm text-gray-600 mt-2 max-w-prose">
            A simple, focused church attendance tracker to help leaders manage members, track attendance, and follow-up new believers — built to be clear and practical.
          </p>

          <div className="w-full max-w-2xl mt-6 bg-gray-50 rounded-lg border border-gray-100 p-5 text-left">
            <h4 className="font-medium text-gray-800 mb-3">Key Features</h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-600 text-sm">
              <li className="flex items-start gap-2"><span className="mt-1 w-2 h-2 rounded-full bg-indigo-600 shrink-0" /> Member registration & management</li>
              <li className="flex items-start gap-2"><span className="mt-1 w-2 h-2 rounded-full bg-indigo-600 shrink-0" /> Sunday service attendance</li>
              <li className="flex items-start gap-2"><span className="mt-1 w-2 h-2 rounded-full bg-indigo-600 shrink-0" /> Bacenta (small group) organization</li>
              <li className="flex items-start gap-2"><span className="mt-1 w-2 h-2 rounded-full bg-indigo-600 shrink-0" /> New believer follow-up</li>
              <li className="flex items-start gap-2"><span className="mt-1 w-2 h-2 rounded-full bg-indigo-600 shrink-0" /> Analytics & reporting tools</li>
            </ul>
          </div>

          <div className="w-full max-w-2xl mt-6 border-t pt-6">
            <div className="flex flex-col items-center mb-4">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-700 font-semibold text-2xl">BN</div>
            </div>
            <h4 className="text-base font-semibold text-gray-900 text-center">Created by Bennet Nkolele</h4>
            <p className="text-sm text-gray-600 text-center mt-1 mb-4">Full-stack developer & church technology enthusiast</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a href="mailto:bennet.nkolele1998@gmail.com" className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition text-left">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#F5F3FF' }}>
                  <Mail className="w-5 h-5 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">Email</p>
                  <p className="text-xs text-gray-500 truncate">bennet.nkolele1998@gmail.com</p>
                </div>
              </a>

              <a href="https://github.com/Benighter" className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition text-left">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#F3F4F6' }}>
                  <Github className="w-5 h-5 text-gray-800" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">GitHub</p>
                  <p className="text-xs text-gray-500 truncate">github.com/Benighter</p>
                </div>
              </a>

              <a href="https://www.linkedin.com/in/bennet-nkolele-321285249/" className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition text-left">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#EEF2FF' }}>
                  <Linkedin className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">LinkedIn</p>
                  <p className="text-xs text-gray-500 truncate">Professional profile</p>
                </div>
              </a>

              <a href="https://react-personal-portfolio-alpha.vercel.app/" className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition text-left">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#ECFDF5' }}>
                  <Globe className="w-5 h-5 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">Portfolio</p>
                  <p className="text-xs text-gray-500 truncate">View my work</p>
                </div>
              </a>
            </div>

            <div className="mt-6 text-center">
              <Heart className="w-6 h-6 text-indigo-600 mx-auto mb-2" />
              <p className="text-sm text-gray-700 font-medium">Thank you for using SAT Mobile</p>
              <p className="text-xs text-gray-500 mt-1">Built to serve the church community with clarity and care.</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AboutModal;