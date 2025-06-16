import React, { useEffect, useState } from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XMarkIcon } from './icons';

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ 
  id, 
  type, 
  title, 
  message, 
  duration = 5000, 
  onClose 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(id);
    }, 300);
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-50 border-green-200',
          iconBg: 'bg-green-100',
          iconColor: 'text-green-600',
          titleColor: 'text-green-800',
          messageColor: 'text-green-700',
          icon: <CheckCircleIcon className="w-5 h-5" />
        };
      case 'error':
        return {
          bg: 'bg-red-50 border-red-200',
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
          titleColor: 'text-red-800',
          messageColor: 'text-red-700',
          icon: <ExclamationTriangleIcon className="w-5 h-5" />
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 border-yellow-200',
          iconBg: 'bg-yellow-100',
          iconColor: 'text-yellow-600',
          titleColor: 'text-yellow-800',
          messageColor: 'text-yellow-700',
          icon: <ExclamationTriangleIcon className="w-5 h-5" />
        };
      case 'info':
        return {
          bg: 'bg-blue-50 border-blue-200',
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-600',
          titleColor: 'text-blue-800',
          messageColor: 'text-blue-700',
          icon: <InformationCircleIcon className="w-5 h-5" />
        };
      default:
        return {
          bg: 'bg-gray-50 border-gray-200',
          iconBg: 'bg-gray-100',
          iconColor: 'text-gray-600',
          titleColor: 'text-gray-800',
          messageColor: 'text-gray-700',
          icon: <InformationCircleIcon className="w-5 h-5" />
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div
      className={`
        fixed top-4 right-4 z-50 max-w-sm w-full
        transform transition-all duration-300 ease-out
        ${isVisible && !isExiting 
          ? 'translate-x-0 opacity-100 scale-100' 
          : 'translate-x-full opacity-0 scale-95'
        }
      `}
    >
      <div className={`
        ${styles.bg} border rounded-xl shadow-lg backdrop-blur-sm
        p-4 relative overflow-hidden
      `}>
        {/* Progress bar for auto-dismiss */}
        {duration > 0 && (
          <div className="absolute bottom-0 left-0 h-1 bg-gray-200 w-full">
            <div 
              className={`h-full transition-all ease-linear ${
                type === 'success' ? 'bg-green-500' :
                type === 'error' ? 'bg-red-500' :
                type === 'warning' ? 'bg-yellow-500' :
                'bg-blue-500'
              }`}
              style={{
                width: '100%',
                animation: `shrink ${duration}ms linear forwards`
              }}
            />
          </div>
        )}

        <div className="flex items-start space-x-3">
          {/* Icon */}
          <div className={`flex-shrink-0 w-8 h-8 ${styles.iconBg} rounded-full flex items-center justify-center`}>
            <div className={styles.iconColor}>
              {styles.icon}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className={`font-semibold ${styles.titleColor} text-sm`}>
              {title}
            </h4>
            {message && (
              <p className={`mt-1 text-sm ${styles.messageColor}`}>
                {message}
              </p>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-1 rounded-full hover:bg-gray-100 transition-colors duration-200"
          >
            <XMarkIcon className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Toast Container Component
interface ToastContainerProps {
  toasts: ToastProps[];
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{
            transform: `translateY(${index * 10}px)`,
            zIndex: 50 - index
          }}
        >
          <Toast {...toast} onClose={onClose} />
        </div>
      ))}
    </div>
  );
};

// Toast Hook
export const useToast = () => {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const addToast = (toast: Omit<ToastProps, 'id' | 'onClose'>) => {
    const id = Date.now().toString();
    const newToast: ToastProps = {
      ...toast,
      id,
      onClose: removeToast
    };
    setToasts(prev => [...prev, newToast]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const success = (title: string, message?: string) => 
    addToast({ type: 'success', title, message });

  const error = (title: string, message?: string) => 
    addToast({ type: 'error', title, message });

  const warning = (title: string, message?: string) => 
    addToast({ type: 'warning', title, message });

  const info = (title: string, message?: string) => 
    addToast({ type: 'info', title, message });

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info
  };
};

export default Toast;
