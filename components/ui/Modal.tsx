
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
    const originalBodyStyle = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      height: document.body.style.height
    };

    const originalHtmlStyle = {
      overflow: document.documentElement.style.overflow,
      position: document.documentElement.style.position
    };

    // Get current scroll position
    const scrollY = window.scrollY;

    // Apply aggressive scroll prevention to both html and body
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.position = 'fixed';

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.classList.add('modal-open');

    // Handle ESC key
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Simple approach: prevent all background scrolling, allow modal scrolling
    const preventBackgroundScroll = (e: Event) => {
      const target = e.target as Element;
      const modalContent = document.querySelector('[data-modal-content]');

      // If the event is NOT within the modal content, prevent it
      if (!modalContent || !modalContent.contains(target)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // If within modal content, allow the event but stop propagation to prevent background effects
      e.stopPropagation();
    };

    // Add event listeners with simpler approach
    document.addEventListener('wheel', preventBackgroundScroll, { passive: false, capture: true });
    document.addEventListener('touchmove', preventBackgroundScroll, { passive: false, capture: true });
    document.addEventListener('scroll', preventBackgroundScroll, { passive: false, capture: true });
    document.addEventListener('keydown', handleEsc);

    // Prevent scroll on window
    window.addEventListener('scroll', preventBackgroundScroll, { passive: false });

    // Cleanup function
    return () => {
      // Restore original html styles
      document.documentElement.style.overflow = originalHtmlStyle.overflow;
      document.documentElement.style.position = originalHtmlStyle.position;

      // Restore original body styles
      document.body.style.overflow = originalBodyStyle.overflow;
      document.body.style.position = originalBodyStyle.position;
      document.body.style.top = originalBodyStyle.top;
      document.body.style.width = originalBodyStyle.width;
      document.body.style.height = originalBodyStyle.height;
      document.body.classList.remove('modal-open');

      // Remove event listeners
      document.removeEventListener('wheel', preventBackgroundScroll, { capture: true });
      document.removeEventListener('touchmove', preventBackgroundScroll, { capture: true });
      document.removeEventListener('scroll', preventBackgroundScroll, { capture: true });
      document.removeEventListener('keydown', handleEsc);
      window.removeEventListener('scroll', preventBackgroundScroll);

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
            touchAction: 'pan-y',
            WebkitOverflowScrolling: 'touch'
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
