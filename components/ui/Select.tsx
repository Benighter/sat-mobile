import React from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  wrapperClassName?: string;
}

const Select: React.FC<SelectProps> = ({ 
  label, 
  id, 
  error, 
  options, 
  className = '', 
  wrapperClassName = '', 
  ...props 
}) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  
  return (
    <div className={`mb-3 sm:mb-4 ${wrapperClassName}`}>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full px-3 py-2.5 sm:py-2 border ${
          error ? 'border-red-500' : 'border-gray-300'
        } rounded-lg shadow-sm focus:outline-none focus:ring-2 ${
          error ? 'focus:ring-red-500' : 'focus:ring-blue-500'
        } focus:border-transparent transition-colors text-base sm:text-sm bg-white ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default Select;
