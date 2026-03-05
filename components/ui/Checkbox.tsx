
import React from 'react';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  wrapperClassName?: string;
}

const Checkbox: React.FC<CheckboxProps> = ({ label, id, error, checked, wrapperClassName = '', className='', ...props }) => {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={`mb-4 ${wrapperClassName}`}>
      <div className="flex items-center">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          className={`h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer ${className}`}
          {...props}
        />
        <label htmlFor={inputId} className="ml-2 block text-sm text-gray-900 cursor-pointer">
          {label}
        </label>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default Checkbox;
