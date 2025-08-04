
import React from 'react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
  onChange?: (value: string) => void;
}

const Input: React.FC<InputProps> = ({ label, id, error, onChange, className = '', wrapperClassName = '', ...props }) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return (
    <div className={`mb-3 sm:mb-4 ${wrapperClassName}`}>
      {label && <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-dark-200 mb-1 sm:mb-2">{label}</label>}
      <input
        id={inputId}
        className={`w-full px-3 py-2.5 sm:py-2 border ${error ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-dark-600'} rounded-lg shadow-sm focus:outline-none focus:ring-2 ${error ? 'focus:ring-red-500 dark:focus:ring-red-400' : 'focus:ring-blue-500 dark:focus:ring-blue-400'} focus:border-transparent transition-colors text-base sm:text-sm bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 placeholder-gray-500 dark:placeholder-dark-400 ${className}`}
        onChange={(e) => onChange?.(e.target.value)}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};

export default Input;
