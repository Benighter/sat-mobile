
import React, { useEffect } from 'react';
import { XMarkIcon } from '../icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  footer?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md', footer }) => {
  useEffect(() => {
    if (!isOpen) return;

    // Store original styles to restore later
    const originalBodyOverflow = document.body.style.overflow;
    const scrollY = window.scrollY;

    // Simple approach: just prevent body overflow
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');

    // Handle ESC key
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Mobile-friendly approach: only prevent wheel events outside modal
    const preventWheelOutsideModal = (e: WheelEvent) => {
      const target = e.target as Element;
      const modalContent = document.querySelector('[data-modal-content]');

      // If the event is NOT within the modal content, prevent it
      if (!modalContent || !modalContent.contains(target)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Allow all touch events within modal, prevent only outside
    const preventTouchOutsideModal = (e: TouchEvent) => {
      const target = e.target as Element;
      const modalContent = document.querySelector('[data-modal-content]');

      // If the event is NOT within the modal content, prevent it
      if (!modalContent || !modalContent.contains(target)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Add event listeners - be more selective for mobile compatibility
    document.addEventListener('wheel', preventWheelOutsideModal, { passive: false, capture: true });
    document.addEventListener('touchmove', preventTouchOutsideModal, { passive: false, capture: true });
    document.addEventListener('keydown', handleEsc);

    // Only prevent document scroll, not all scroll events
    const preventDocumentScroll = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener('scroll', preventDocumentScroll, { passive: false, capture: true });

    // Cleanup function
    return () => {
      // Restore original body styles
      document.body.style.overflow = originalBodyOverflow;
      document.body.classList.remove('modal-open');

      // Remove event listeners
      document.removeEventListener('wheel', preventWheelOutsideModal, { capture: true });
      document.removeEventListener('touchmove', preventTouchOutsideModal, { capture: true });
      document.removeEventListener('scroll', preventDocumentScroll, { capture: true });
      document.removeEventListener('keydown', handleEsc);

      // Restore scroll position
      window.scrollTo(0, scrollY);
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
        paddingBottom: '20px',
        overflow: 'hidden', // Prevent any scrolling on the backdrop
        touchAction: 'none', // Prevent touch actions
        overscrollBehavior: 'none' // Prevent overscroll
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onWheel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }}
      onTouchMove={(e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }}
      onScroll={(e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }}
    >
      <div
        className={`bg-white rounded-lg sm:rounded-xl shadow-xl w-full ${sizeClasses[size]} flex flex-col relative modal-content overflow-hidden`}
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
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'auto' // Allow all touch actions within modal content
          }}
        >
          {children}
        </div>
        {footer && (
          <div className="p-3 sm:p-4 border-t bg-gray-50/50 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
