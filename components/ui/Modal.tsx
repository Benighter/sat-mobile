
import React, { useEffect } from 'react';
import { XMarkIcon } from '../icons';

// Utility function to detect navbar height
const detectNavbarHeight = (): number => {
  // Try multiple common navbar selectors
  const selectors = [
    'nav',
    '.navbar',
    '[role="navigation"]',
    '.nav-header',
    '.app-header',
    '.top-nav',
    'header nav',
    'header'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector) as HTMLElement;
    if (element && element.offsetHeight > 0) {
      return element.offsetHeight;
    }
  }

  // Fallback: check for any fixed positioned elements at the top
  const fixedElements = Array.from(document.querySelectorAll('*')).filter(el => {
    const style = window.getComputedStyle(el as Element);
    return style.position === 'fixed' &&
           (style.top === '0px' || style.top === '0') &&
           (el as HTMLElement).offsetHeight > 0 &&
           (el as HTMLElement).offsetHeight < 200; // Reasonable navbar height
  });

  if (fixedElements.length > 0) {
    return Math.max(...fixedElements.map(el => (el as HTMLElement).offsetHeight));
  }

  return 0;
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
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

    // Calculate and set navbar height as CSS custom property
    const updateNavbarHeight = () => {
      const navbarHeight = detectNavbarHeight();

      // Set CSS custom properties for dynamic calculations
      document.documentElement.style.setProperty('--navbar-height', `${navbarHeight}px`);

      // Force recalculation of dependent properties
      const availableHeight = `calc(100vh - ${navbarHeight}px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`;
      const availableHeightDvh = `calc(100dvh - ${navbarHeight}px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`;

      document.documentElement.style.setProperty('--available-height', availableHeight);
      document.documentElement.style.setProperty('--available-height-dvh', availableHeightDvh);

      console.log(`Modal: Detected navbar height: ${navbarHeight}px`);
    };

    // Set navbar height immediately and on resize
    updateNavbarHeight();

    // Also update after a small delay to ensure DOM is fully rendered
    setTimeout(updateNavbarHeight, 100);

    // Create debounced version for resize events
    let resizeTimeout: NodeJS.Timeout;
    const debouncedUpdate = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateNavbarHeight, 150);
    };

    window.addEventListener('resize', debouncedUpdate);
    window.addEventListener('orientationchange', debouncedUpdate);

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

      // Always allow touch events on input elements, regardless of location
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

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
      document.removeEventListener('resize', debouncedUpdate);
      document.removeEventListener('orientationchange', debouncedUpdate);
      clearTimeout(resizeTimeout);

      // Restore scroll position
      window.scrollTo(0, scrollY);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm sm:max-w-md',
    md: 'max-w-md sm:max-w-lg',
    lg: 'max-w-lg sm:max-w-xl',
    xl: 'max-w-xl sm:max-w-2xl lg:max-w-4xl',
    full: 'max-w-full h-full rounded-none',
  };

  return (
    <div
      className="fixed modal-backdrop z-[10000]"
      style={{
        top: 'calc(var(--navbar-height, 0px) + env(safe-area-inset-top, 0px))',
        left: 'env(safe-area-inset-left, 0px)',
        right: 'env(safe-area-inset-right, 0px)',
        bottom: 'env(safe-area-inset-bottom, 0px)',
        height: 'calc(100vh - var(--navbar-height, 0px) - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
        minHeight: 'calc(100dvh - var(--navbar-height, 0px) - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(0.5rem, 2vw, 1rem)',
        overflow: 'auto',
        touchAction: 'pan-y',
        overscrollBehavior: 'contain'
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
          maxHeight: 'calc(100dvh - var(--navbar-height, 0px) - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)',
          minHeight: 'auto',
          maxWidth: 'min(90vw, 100%)',
          margin: 'auto'
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
