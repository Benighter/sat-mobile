
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  loading = false,
  className = '',
  ...props
}) => {
  const baseStyles = "font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-colors duration-150 ease-in-out inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation";

  const variantStyles = {
    primary: "bg-slate-600 hover:bg-slate-700 dark:bg-slate-500 dark:hover:bg-slate-600 text-white focus:ring-slate-500 shadow-sm",
    secondary: "bg-gray-100 hover:bg-gray-200 dark:bg-dark-600 dark:hover:bg-dark-500 text-gray-800 dark:text-dark-100 focus:ring-gray-400 dark:focus:ring-dark-400 border border-gray-300 dark:border-dark-600",
    danger: "bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white focus:ring-red-500 shadow-sm",
    success: "bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 text-white focus:ring-green-500 shadow-sm",
    ghost: "bg-transparent hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-800 dark:text-dark-100 focus:ring-gray-400 dark:focus:ring-dark-400 border border-gray-400 dark:border-dark-500",
  };

  const sizeStyles = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-2.5 text-sm sm:text-base",
    lg: "px-6 py-3 text-base sm:text-lg",
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {!loading && leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
      {!loading && rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
};

export default Button;
