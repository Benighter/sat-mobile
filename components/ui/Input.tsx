
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
      {label && <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">{label}</label>}
      <input
        id={inputId}
        className={`w-full px-3 py-2.5 sm:py-2 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-lg shadow-sm focus:outline-none focus:ring-2 ${error ? 'focus:ring-red-500' : 'focus:ring-blue-500'} focus:border-transparent transition-colors text-base sm:text-sm ${className}`}
        onChange={(e) => onChange?.(e.target.value)}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default Input;
