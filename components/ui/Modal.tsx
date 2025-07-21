
import React, { useEffect } from 'react';
import { XMarkIcon } from '../icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const preventBackgroundScroll = (e: TouchEvent) => {
      // Allow scrolling within the modal content, but prevent background scroll
      const target = e.target as Element;
      const modalContent = document.querySelector('[data-modal-content]');

      if (modalContent && !modalContent.contains(target)) {
        e.preventDefault();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.classList.add('modal-open');

      // Add touch event listener for mobile
      document.addEventListener('touchmove', preventBackgroundScroll, { passive: false });
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.removeEventListener('touchmove', preventBackgroundScroll);
      document.body.classList.remove('modal-open');
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    full: 'max-w-full h-full rounded-none',
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-[9999] modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        paddingTop: '100px', // Account for header height
        paddingBottom: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`bg-white rounded-lg sm:rounded-xl shadow-xl w-full ${sizeClasses[size]} flex flex-col relative modal-content`}
        style={{
          zIndex: 10000,
          maxHeight: 'calc(100vh - 140px)', // Ensure modal doesn't exceed viewport
          minHeight: '200px'
        }}
        data-modal-content
      >
        <div className="flex items-center justify-between p-3 sm:p-4 border-b">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate pr-2">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 flex-shrink-0"
            aria-label="Close modal"
          >
            <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
        <div
          className="p-3 sm:p-4 overflow-y-auto flex-1 modal-scrollable"
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
