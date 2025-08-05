import React from 'react';
import { motion } from 'framer-motion';
import { useNavigation } from '../hooks/useNavigation';
import { ArrowLeftIcon } from './icons';

interface BackButtonProps {
  className?: string;
  showLabel?: boolean;
}

const BackButton: React.FC<BackButtonProps> = ({ className = '', showLabel = false }) => {
  const { navigateBack, canNavigateBack } = useNavigation();

  if (!canNavigateBack()) {
    return null;
  }

  return (
    <motion.button
      onClick={navigateBack}
      className={`flex items-center space-x-2 p-2 rounded-xl glass hover:glass-dark transition-all duration-300 group ${className}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      aria-label="Go back"
      title="Go back"
    >
      <ArrowLeftIcon className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors duration-300" />
      {showLabel && (
        <span className="text-sm font-medium text-gray-600 group-hover:text-white transition-colors duration-300">
          Back
        </span>
      )}
    </motion.button>
  );
};

export default BackButton;
