import React, { ReactNode } from 'react';
import { motion, PanInfo, useAnimation } from 'framer-motion';
import { useNavigation } from '../hooks/useNavigation';

interface GestureWrapperProps {
  children: ReactNode;
  className?: string;
}

const GestureWrapper: React.FC<GestureWrapperProps> = ({ children, className = '' }) => {
  const { navigateBack, canNavigateBack } = useNavigation();
  const controls = useAnimation();

  const handlePanEnd = async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    const swipeThreshold = 100; // Minimum distance for swipe
    const velocityThreshold = 500; // Minimum velocity for swipe

    // Right swipe (positive X) - navigate back
    if (
      (offset.x > swipeThreshold || velocity.x > velocityThreshold) &&
      Math.abs(offset.y) < Math.abs(offset.x) && // More horizontal than vertical
      canNavigateBack()
    ) {
      // Animate slide out to the right
      await controls.start({
        x: window.innerWidth,
        opacity: 0,
        transition: { duration: 0.3, ease: 'easeOut' }
      });
      
      navigateBack();
      
      // Reset position after navigation
      controls.set({ x: -window.innerWidth, opacity: 0 });
      controls.start({
        x: 0,
        opacity: 1,
        transition: { duration: 0.3, ease: 'easeOut' }
      });
    } else {
      // Snap back to original position
      controls.start({
        x: 0,
        opacity: 1,
        transition: { duration: 0.3, ease: 'easeOut' }
      });
    }
  };

  const handlePan = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset } = info;
    
    // Only allow right swipe for back navigation
    if (offset.x > 0 && canNavigateBack() && Math.abs(offset.y) < Math.abs(offset.x)) {
      // Limit the drag distance and add resistance
      const maxDrag = window.innerWidth * 0.3;
      const dragDistance = Math.min(offset.x, maxDrag);
      const resistance = 1 - (dragDistance / maxDrag) * 0.3;
      
      controls.set({
        x: dragDistance,
        opacity: resistance
      });
    }
  };

  return (
    <motion.div
      className={`${className} touch-pan-y`}
      animate={controls}
      onPan={handlePan}
      onPanEnd={handlePanEnd}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      style={{
        touchAction: 'pan-y', // Allow vertical scrolling but handle horizontal gestures
      }}
    >
      {children}
    </motion.div>
  );
};

export default GestureWrapper;
