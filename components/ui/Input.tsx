
import React from 'react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
  onChange?: (value: string) => void;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  iconType?: 'search' | 'currency' | 'custom';
}

const Input: React.FC<InputProps> = ({
  label,
  id,
  error,
  onChange,
  className = '',
  wrapperClassName = '',
  leftIcon,
  rightIcon,
  iconType = 'custom',
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const hasIcon = !!(leftIcon || rightIcon);

  // Determine padding classes based on icons
  const getPaddingClasses = () => {
    // Build padding symmetrically to keep centered text truly centered when icons exist
    let leftPadding = 'pl-3';
    let rightPadding = 'pr-3';

    if (leftIcon) {
      switch (iconType) {
        case 'search':
          leftPadding = 'pl-10 sm:pl-12 search-input';
          // symmetric right padding when only left icon
          rightPadding = 'pr-10 sm:pr-12';
          break;
        case 'currency':
          leftPadding = 'pl-8 sm:pl-10 currency-input';
          rightPadding = 'pr-8 sm:pr-10';
          break;
        default:
          leftPadding = 'pl-10 sm:pl-12 input-with-left-icon';
          rightPadding = 'pr-10 sm:pr-12';
      }
    }

    if (rightIcon) {
      // when right icon exists, ensure sufficient right padding regardless
      rightPadding = 'pr-12 sm:pr-14 input-with-right-icon';
      // if no left icon, keep default left padding as is
      if (!leftIcon) {
        leftPadding = 'pl-3';
      }
    }

    return `${leftPadding} ${rightPadding}`.trim();
  };
  return (
    <div className={`mb-3 sm:mb-4 ${wrapperClassName}`}>
      {label && <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-dark-200 mb-1 sm:mb-2">{label}</label>}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          className={`w-full ${getPaddingClasses()} ${hasIcon ? 'text-center' : ''} py-2.5 sm:py-2 border ${error ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-dark-600'} rounded-lg shadow-sm focus:outline-none focus:ring-2 ${error ? 'focus:ring-red-500 dark:focus:ring-red-400' : 'focus:ring-blue-500 dark:focus:ring-blue-400'} focus:border-transparent transition-colors text-base sm:text-sm bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 placeholder-gray-500 dark:placeholder-dark-400 ${className}`}
          onChange={(e) => onChange?.(e.target.value)}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};

export default Input;
