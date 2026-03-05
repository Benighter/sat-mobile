import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftIcon } from '../icons';
import { useNavigation } from '../../hooks/useNavigation';

const SwipeIndicator: React.FC = () => {
  const { canNavigateBack } = useNavigation();
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    // Show swipe hint on first visit
    const hasSeenHint = localStorage.getItem('church_connect_swipe_hint_seen');
    if (!hasSeenHint && canNavigateBack()) {
      setShowHint(true);
      localStorage.setItem('church_connect_swipe_hint_seen', 'true');
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        setShowHint(false);
      }, 3000);
    }
  }, [canNavigateBack]);

  if (!canNavigateBack()) {
    return null;
  }

  return (
    <AnimatePresence>
      {showHint && (
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          className="fixed left-4 top-1/2 transform -translate-y-1/2 z-40 pointer-events-none"
        >
          <div className="glass rounded-xl p-3 flex items-center space-x-2 shadow-lg">
            <motion.div
              animate={{ x: [0, 10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
            </motion.div>
            <span className="text-sm font-medium text-gray-600">
              Swipe right to go back
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SwipeIndicator;
