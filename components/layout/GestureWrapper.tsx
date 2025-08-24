import React, { ReactNode, useState, useRef, useCallback } from 'react';
import { motion, PanInfo, useAnimation } from 'framer-motion';
import { useNavigation } from '../../hooks/useNavigation';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import ConfirmationModal from '../modals/confirmations/ConfirmationModal';

interface GestureWrapperProps {
  children: ReactNode;
  className?: string;
}

const GestureWrapper: React.FC<GestureWrapperProps> = ({ children, className = '' }) => {
  const { navigateBack, canNavigateBack } = useNavigation();
  const { currentTab } = useAppContext();
  const controls = useAnimation();
  const [isAnimating, setIsAnimating] = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const exitPromptTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle dashboard exit confirmation
  const handleDashboardExit = useCallback(() => {
    if (showExitPrompt) {
      // Second swipe - actually exit the app
      if (window.history.length > 1) {
        window.history.back();
      } else {
        // Try to close the app (works in some mobile environments)
        if ('app' in window && typeof (window as any).app.exitApp === 'function') {
          (window as any).app.exitApp();
        } else {
          // Fallback: show confirmation modal before attempting to close
          setShowExitConfirm(true);
        }
      }
      setShowExitPrompt(false);
    } else {
      // First swipe - show exit prompt
      setShowExitPrompt(true);

      // Clear any existing timeout
      if (exitPromptTimeoutRef.current) {
        clearTimeout(exitPromptTimeoutRef.current);
      }

      // Hide prompt after 3 seconds if no second swipe
      exitPromptTimeoutRef.current = setTimeout(() => {
        setShowExitPrompt(false);
      }, 3000);
    }
  }, [showExitPrompt]);

  // Track whether current pointer sequence should trigger navigation gestures
  const allowGestureRef = useRef(false);

  const EDGE_THRESHOLD = 48; // px from left edge to start gesture

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const x = e.clientX;
    // Only allow gesture if touch/mouse starts near left edge and not on an interactive text input
    const target = e.target as Element;
    const onInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('input, textarea, select, [contenteditable="true"]'));
    allowGestureRef.current = x <= EDGE_THRESHOLD && !onInput;
  }, []);

  const handlePanEnd = useCallback(async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!allowGestureRef.current) {
      // Always reset position if we were moving but not allowed gesture
      await resetPosition();
      return;
    }
    // Prevent handling if already animating
    if (isAnimating) return;

    const { offset, velocity } = info;
    const swipeThreshold = 100; // Minimum distance for swipe
    const velocityThreshold = 500; // Minimum velocity for swipe

    // Don't handle gestures if the target is an input element
    const target = event.target as Element;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.closest('input, textarea, select'))) {
      await resetPosition();
      return;
    }

    // Check if this is a valid right swipe
    const isValidSwipe = (offset.x > swipeThreshold || velocity.x > velocityThreshold) &&
                        Math.abs(offset.y) < Math.abs(offset.x); // More horizontal than vertical

    if (isValidSwipe) {
      if (canNavigateBack()) {
        // Regular back navigation
        setIsAnimating(true);

        try {
          // Animate slide out to the right
          await controls.start({
            x: window.innerWidth,
            opacity: 0,
            transition: { duration: 0.3, ease: 'easeOut' }
          });

          const didNavigate = navigateBack();

          if (didNavigate) {
            // Reset position for next screen
            controls.set({ x: -window.innerWidth, opacity: 0 });
            await controls.start({
              x: 0,
              opacity: 1,
              transition: { duration: 0.3, ease: 'easeOut' }
            });
          } else {
            // Navigation failed, snap back
            await resetPosition();
          }
        } catch (error) {
          console.error('Navigation animation error:', error);
          await resetPosition();
        } finally {
          setIsAnimating(false);
        }
      } else if (currentTab.id === 'dashboard') {
        // Dashboard exit confirmation
        handleDashboardExit();
        await resetPosition();
      } else {
        // Can't navigate back, snap back to original position
        await resetPosition();
      }
    } else {
      // Not a valid swipe, snap back to original position
      await resetPosition();
    }
  }, [isAnimating, canNavigateBack, navigateBack, currentTab.id, handleDashboardExit, controls]);

  // Helper function to reset position smoothly
  const resetPosition = useCallback(async () => {
    try {
      await controls.start({
        x: 0,
        opacity: 1,
        transition: { duration: 0.3, ease: 'easeOut' }
      });
    } catch (error) {
      // Fallback: set position directly if animation fails
      controls.set({ x: 0, opacity: 1 });
    }
  }, [controls]);

  const handlePan = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!allowGestureRef.current) return; // Not an edge gesture
    // Don't handle pan if already animating
    if (isAnimating) return;

    const { offset } = info;

    // Don't handle gestures if the target is an input element or scrollable content
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

    // Only allow right swipe and ensure it's primarily horizontal
    const isHorizontalSwipe = Math.abs(offset.y) < Math.abs(offset.x) * 0.5;
    const canShowPreview = canNavigateBack() || currentTab.id === 'dashboard';

    // If user is selecting text (there is an active selection length > 0) abort gesture adjustments
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }

    if (offset.x > 50 && canShowPreview && isHorizontalSwipe) {
      // Limit the drag distance and add resistance
      const maxDrag = window.innerWidth * 0.3;
      const dragDistance = Math.min(offset.x, maxDrag);
      const resistance = 1 - (dragDistance / maxDrag) * 0.3;

      controls.set({
        x: dragDistance,
        opacity: resistance
      });
    }
  }, [isAnimating, canNavigateBack, currentTab.id, controls]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (exitPromptTimeoutRef.current) {
        clearTimeout(exitPromptTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <motion.div
        className={`${className} relative`}
        animate={controls}
        onPan={handlePan}
        onPanEnd={handlePanEnd}
        onPointerDown={handlePointerDown}
        drag={false} // Disable automatic drag, we handle it manually
        style={{
          touchAction: 'auto', // Allow natural scrolling behavior
        }}
      >
        {children}
      </motion.div>

      {/* Exit Prompt for Dashboard */}
      {showExitPrompt && currentTab.id === 'dashboard' && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-4 left-4 right-4 z-50 bg-red-500 dark:bg-red-600 text-white p-4 rounded-lg shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Swipe again to exit</p>
              <p className="text-sm opacity-90">Or wait 3 seconds to cancel</p>
            </div>
            <button
              onClick={() => setShowExitPrompt(false)}
              className="text-white/80 hover:text-white text-xl font-bold"
            >
              ×
            </button>
          </div>
        </motion.div>
      )}

      {/* Exit confirmation modal for fallback environments */}
      {showExitConfirm && (
        <ConfirmationModal
          isOpen={showExitConfirm}
          title="Exit App"
          message="Are you sure you want to exit the app?"
          confirmText="Exit"
          type="danger"
          onClose={() => setShowExitConfirm(false)}
          onConfirm={async () => {
            try {
              window.close();
            } finally {
              setShowExitConfirm(false);
            }
          }}
        />
      )}
    </>
  );
};

export default GestureWrapper;
