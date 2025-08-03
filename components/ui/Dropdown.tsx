import React, { useState, useRef, useEffect } from 'react';
import { EllipsisVerticalIcon } from '../icons';

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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

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

  const defaultTrigger = (
    <button
      type="button"
      className={`p-1 rounded-md transition-colors ${
        disabled 
          ? 'text-gray-300 cursor-not-allowed' 
          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
      }`}
      disabled={disabled}
    >
      <EllipsisVerticalIcon className="w-4 h-4" />
    </button>
  );

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Trigger */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="cursor-pointer"
      >
        {trigger || defaultTrigger}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute z-50 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${
            position === 'above' ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              disabled={item.disabled}
              className={`w-full px-4 py-2 text-left text-sm flex items-center space-x-2 transition-colors ${
                item.disabled
                  ? 'text-gray-400 cursor-not-allowed'
                  : item.destructive
                  ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.icon && (
                <span className="flex-shrink-0 w-4 h-4">
                  {item.icon}
                </span>
              )}
              <span>{item.label}</span>
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
  );
};

export default Dropdown;
