import React, { memo } from 'react';

interface OptimizedLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}

const OptimizedLoader: React.FC<OptimizedLoaderProps> = memo(({ 
  size = 'md', 
  message = 'Loading...', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <div className={`flex flex-col items-center justify-center space-y-3 ${className}`}>
      {/* Optimized spinner - uses CSS transforms instead of SVG animations */}
      <div className={`${sizeClasses[size]} relative`}>
        <div className="absolute inset-0 border-2 border-gray-200 rounded-full"></div>
        <div className="absolute inset-0 border-2 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
      </div>
      
      {message && (
        <p className={`text-gray-600 font-medium ${textSizeClasses[size]}`}>
          {message}
        </p>
      )}
    </div>
  );
});

OptimizedLoader.displayName = 'OptimizedLoader';

export default OptimizedLoader;
