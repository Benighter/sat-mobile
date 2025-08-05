import React from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  error?: string;
  options?: SelectOption[];
  wrapperClassName?: string;
  children?: React.ReactNode;
  onChange?: (value: string) => void;
}

const Select: React.FC<SelectProps> = ({
  label,
  id,
  error,
  options,
  children,
  onChange,
  className = '',
  wrapperClassName = '',
  ...props
}) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  
  return (
    <div className={`mb-3 sm:mb-4 ${wrapperClassName}`}>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-gray-800 dark:text-dark-100 mb-1 sm:mb-2">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full px-3 py-2.5 sm:py-2 border ${
          error ? 'border-red-500 dark:border-red-400' : 'border-gray-400 dark:border-dark-500'
        } rounded-lg shadow-sm focus:outline-none focus:ring-2 ${
          error ? 'focus:ring-red-500 dark:focus:ring-red-400' : 'focus:ring-slate-500 dark:focus:ring-slate-400'
        } focus:border-transparent transition-colors text-base sm:text-sm bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 ${className}`}
        onChange={(e) => onChange?.(e.target.value)}
        {...props}
      >
        {options ? (
          options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))
        ) : (
          children
        )}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default Select;
