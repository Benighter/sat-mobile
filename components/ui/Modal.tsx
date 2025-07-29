
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
    // Combined keyboard event handler
    const handleKeydown = (event: KeyboardEvent) => {
      // Handle ESC key
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      // Prevent keyboard scrolling on background
      const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Space'];
      const target = event.target as Element;
      const modalContent = document.querySelector('[data-modal-content]');

      if (scrollKeys.includes(event.key) && modalContent && !modalContent.contains(target)) {
        event.preventDefault();
      }
    };

    // Prevent wheel scrolling on background
    const preventWheelScroll = (e: WheelEvent) => {
      const target = e.target as Element;
      const modalContent = document.querySelector('[data-modal-content]');

      if (modalContent && !modalContent.contains(target)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Prevent touch scrolling on background
    const preventTouchScroll = (e: TouchEvent) => {
      const target = e.target as Element;
      const modalContent = document.querySelector('[data-modal-content]');

      if (modalContent && !modalContent.contains(target)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    if (isOpen) {
      // Apply modal-open class and prevent scrolling
      document.body.classList.add('modal-open');

      // Add event listeners to prevent background scrolling
      document.addEventListener('keydown', handleKeydown, { passive: false });
      document.addEventListener('wheel', preventWheelScroll, { passive: false });
      document.addEventListener('touchmove', preventTouchScroll, { passive: false });

      // Cleanup function
      return () => {
        document.removeEventListener('keydown', handleKeydown);
        document.removeEventListener('wheel', preventWheelScroll);
        document.removeEventListener('touchmove', preventTouchScroll);
        document.body.classList.remove('modal-open');
      };
    }
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
        paddingBottom: '20px',
        overflow: 'hidden' // Prevent any scrolling on the backdrop
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
        onClick={(e) => e.stopPropagation()} // Prevent backdrop click when clicking inside modal
      >
        {title && (
          <div className="flex items-center justify-between p-3 sm:p-4 border-b flex-shrink-0">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate pr-2">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 flex-shrink-0"
              aria-label="Close modal"
            >
              <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        )}
        <div
          className="p-3 sm:p-4 overflow-y-auto flex-1 modal-scrollable"
          style={{
            overscrollBehavior: 'contain' // Prevent scroll chaining to parent
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
