import React, { useState, useRef, useEffect, useCallback } from 'react';
import { EllipsisVerticalIcon } from '../icons';
import {
  getViewportSize,
  calculateMobileDropdownPosition,
  enhanceDropdownScrolling,
  createScrollIndicators,
  updateScrollIndicators,
  debounce
} from '../../utils/viewportUtils';

interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean; // For delete/remove actions
}

interface DropdownProps {
  items: DropdownItem[];
  trigger?: React.ReactNode;
  align?: 'left' | 'right';
  position?: 'above' | 'below';
  disabled?: boolean;
}

const Dropdown: React.FC<DropdownProps> = ({
  items,
  trigger,
  align = 'right',
  position = 'below',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    maxHeight: number;
    positioning: 'fixed' | 'absolute';
  } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorsRef = useRef<{ top: HTMLElement; bottom: HTMLElement } | null>(null);

  // Calculate dropdown position based on viewport
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !isOpen) return;

    const estimatedHeight = items.length * 40 + 16; // Rough estimate
    const estimatedWidth = 240; // w-60 = 15rem = 240px

    const position = calculateMobileDropdownPosition(
      triggerRef.current,
      estimatedWidth,
      estimatedHeight
    );

    setDropdownPosition(position);
  }, [items.length, isOpen]);

  // Enhanced scroll handling for mobile
  const setupMobileScrolling = useCallback(() => {
    if (!menuRef.current) return () => { };

    const viewport = getViewportSize();
    if (!viewport.isMobile) return () => { };

    // Add mobile scroll enhancements
    const cleanup = enhanceDropdownScrolling(menuRef.current);

    // Create scroll indicators
    const indicators = createScrollIndicators();
    scrollIndicatorsRef.current = indicators;

    // Add indicators to menu
    menuRef.current.prepend(indicators.top);
    menuRef.current.append(indicators.bottom);

    // Setup scroll listener
    const handleScroll = debounce(() => {
      if (menuRef.current && scrollIndicatorsRef.current) {
        updateScrollIndicators(
          menuRef.current,
          scrollIndicatorsRef.current.top,
          scrollIndicatorsRef.current.bottom
        );
      }
    }, 16);

    menuRef.current.addEventListener('scroll', handleScroll);

    // Initial indicator update
    setTimeout(() => handleScroll(), 100);

    return () => {
      cleanup();
      if (menuRef.current) {
        menuRef.current.removeEventListener('scroll', handleScroll);
      }
      if (scrollIndicatorsRef.current) {
        scrollIndicatorsRef.current.top.remove();
        scrollIndicatorsRef.current.bottom.remove();
      }
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      calculatePosition();

      // Setup mobile scrolling
      const cleanupScrolling = setupMobileScrolling();

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        cleanupScrolling();
      };
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, calculatePosition, setupMobileScrolling]);

  // Handle window resize and scroll
  useEffect(() => {
    const handleUpdate = () => {
      if (isOpen) {
        calculatePosition();
      }
    };

    const debouncedUpdate = debounce(handleUpdate, 16); // ~60fps

    window.addEventListener('resize', debouncedUpdate);
    window.addEventListener('scroll', debouncedUpdate, { capture: true }); // Capture scroll on any element

    return () => {
      window.removeEventListener('resize', debouncedUpdate);
      window.removeEventListener('scroll', debouncedUpdate, { capture: true });
    };
  }, [isOpen, calculatePosition]);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleItemClick = (item: DropdownItem) => {
    if (!item.disabled) {
      item.onClick();
      setIsOpen(false);
    }
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const defaultTrigger = (
    <button
      type="button"
      className={`p-1 rounded-md transition-colors touch-manipulation ${disabled
        ? 'text-gray-300 cursor-not-allowed'
        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        }`}
      disabled={disabled}
    >
      <EllipsisVerticalIcon className="w-4 h-4" />
    </button>
  );

  const viewport = getViewportSize();
  const isMobile = viewport.isMobile;

  // Mobile dropdown styles
  const mobileDropdownClasses = isMobile
    ? 'mobile-dropdown-menu mobile-dropdown-content'
    : '';

  const dropdownStyles = dropdownPosition ? {
    position: dropdownPosition.positioning,
    top: `${dropdownPosition.top}px`,
    left: `${dropdownPosition.left}px`,
    maxHeight: `${dropdownPosition.maxHeight}px`,
    width: isMobile ? (viewport.isSmallMobile ? 'calc(100vw - 1rem)' : 'calc(100vw - 2rem)') : '15rem',
    scrollbarWidth: 'thin' as const, // For Firefox
  } : {};

  return (
    <>
      <div className="relative inline-block" ref={dropdownRef}>
        {/* Trigger */}
        <div
          ref={triggerRef}
          onClick={handleToggle}
          className="cursor-pointer"
        >
          {trigger || defaultTrigger}
        </div>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            ref={menuRef}
            className={`bg-white dark:bg-dark-800 rounded-md shadow-lg border border-gray-300 dark:border-dark-600 py-1 z-50 overflow-y-auto ${mobileDropdownClasses} ${!dropdownPosition && align === 'right' ? 'absolute right-0' : ''
              } ${!dropdownPosition && align === 'left' ? 'absolute left-0' : ''
              } ${!dropdownPosition && position === 'above' ? 'bottom-full mb-1' : 'top-full mt-1'
              }`}
            style={dropdownStyles}
          >
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                disabled={item.disabled}
                className={`w-full px-4 py-2 text-left text-sm flex items-center space-x-2 transition-colors touch-manipulation whitespace-nowrap mobile-dropdown-item ${item.disabled
                  ? 'text-gray-400 dark:text-dark-500 cursor-not-allowed'
                  : item.destructive
                    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300'
                    : 'text-gray-800 dark:text-dark-100 hover:bg-gray-100 dark:hover:bg-dark-700'
                  }`}
              >
                {item.icon && (
                  <span className="flex-shrink-0 w-4 h-4">
                    {item.icon}
                  </span>
                )}
                <span className="truncate">{item.label}</span>
              </button>
            ))}

            {items.length === 0 && (
              <div className="px-4 py-2 text-sm text-gray-500 italic">
                No actions available
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile backdrop */}
      {isOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/20 mobile-dropdown-backdrop z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default Dropdown;
