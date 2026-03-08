import React, { ReactNode, useState, useRef, useCallback } from 'react';
import { motion, PanInfo, useAnimation } from 'framer-motion';
import { useNavigation } from '../../hooks/useNavigation';

interface GestureWrapperProps {
  children: ReactNode;
  className?: string;
}

const GestureWrapper: React.FC<GestureWrapperProps> = ({ children, className = '' }) => {
  const { requestBack, canNavigateBack } = useNavigation();
  const controls = useAnimation();
  const [isAnimating, setIsAnimating] = useState(false);

  // Track whether current pointer sequence should trigger navigation gestures
  const allowGestureRef = useRef(false);

  const EDGE_THRESHOLD = 24; // px from left edge to start gesture

  // Helper function to reset position smoothly
  const resetPosition = useCallback(async () => {
    try {
      await controls.start({
        x: 0,
        opacity: 1,
        transition: { duration: 0.18, ease: 'easeOut' }
      });
    } catch {
      controls.set({ x: 0, opacity: 1 });
    }
  }, [controls]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const x = e.clientX;
    // Only allow gesture if touch/mouse starts near left edge and not on an interactive text input
    const target = e.target as Element;
    const onInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('input, textarea, select, [contenteditable="true"]'));
    allowGestureRef.current = x <= EDGE_THRESHOLD && !onInput;
  }, []);

  const handlePanEnd = useCallback(async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!allowGestureRef.current) {
      await resetPosition();
      return;
    }
    if (isAnimating) return;

    const { offset, velocity } = info;
    const swipeThreshold = 72;
    const velocityThreshold = 450;

    // Don't handle gestures if the target is an input element
    const target = event.target as Element;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.closest('input, textarea, select'))) {
      await resetPosition();
      return;
    }

    const isValidSwipe = (offset.x > swipeThreshold || velocity.x > velocityThreshold) &&
                        Math.abs(offset.y) < Math.abs(offset.x);

    if (isValidSwipe) {
      if (canNavigateBack()) {
        setIsAnimating(true);

        try {
          await controls.start({
            x: Math.min(window.innerWidth * 0.22, 120),
            opacity: 0.9,
            transition: { duration: 0.16, ease: 'easeOut' }
          });

          const didNavigate = requestBack();

          if (didNavigate) {
            controls.set({ x: -18, opacity: 0.96 });
            await controls.start({
              x: 0,
              opacity: 1,
              transition: { duration: 0.18, ease: 'easeOut' }
            });
          } else {
            await resetPosition();
          }
        } catch (error) {
          console.error('Navigation animation error:', error);
          await resetPosition();
        } finally {
          setIsAnimating(false);
        }
      } else {
        await resetPosition();
      }
    } else {
      await resetPosition();
    }
  }, [isAnimating, canNavigateBack, controls, requestBack, resetPosition]);

  const handlePan = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!allowGestureRef.current) return; // Not an edge gesture
    if (isAnimating) return;

    const { offset } = info;

    const target = event.target as Element;
    if (target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.closest('input, textarea, select') ||
      target.closest('[data-scrollable]') ||
      target.closest('.overflow-y-auto') ||
      target.closest('.overflow-auto')
    )) {
      return;
    }

    const isHorizontalSwipe = Math.abs(offset.y) < Math.abs(offset.x) * 0.4;
    const canShowPreview = canNavigateBack();

    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }

    if (offset.x > 24 && canShowPreview && isHorizontalSwipe) {
      const maxDrag = window.innerWidth * 0.24;
      const dragDistance = Math.min(offset.x, maxDrag);
      const resistance = 1 - (dragDistance / maxDrag) * 0.12;

      controls.set({
        x: dragDistance,
        opacity: resistance
      });
    }
  }, [isAnimating, canNavigateBack, controls]);

  return (
    <motion.div
      className={`${className} relative`}
      animate={controls}
      onPan={handlePan}
      onPanEnd={handlePanEnd}
      onPointerDown={handlePointerDown}
      drag={false}
      style={{
        touchAction: 'pan-y',
      }}
    >
      {children}
    </motion.div>
  );
};

export default GestureWrapper;
