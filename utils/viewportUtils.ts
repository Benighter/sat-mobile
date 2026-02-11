/**
 * Viewport detection utilities for responsive dropdown behavior
 */

export interface ViewportSize {
  width: number;
  height: number;
  isMobile: boolean;
  isSmallMobile: boolean;
  availableHeight: number;
}

/**
 * Get current viewport dimensions and mobile detection
 */
export const getViewportSize = (): ViewportSize => {
  const width = window.innerWidth;
  const height = window.innerHeight;

  return {
    width,
    height,
    isMobile: width <= 414, // iPhone 11 and similar
    isSmallMobile: width <= 375, // iPhone SE and smaller
    availableHeight: height - 100, // Account for headers and safe areas
  };
};

/**
 * Calculate optimal dropdown position for mobile devices
 */
export const calculateMobileDropdownPosition = (
  triggerElement: HTMLElement,
  dropdownWidth: number,
  dropdownHeight: number
): { top: number; left: number; maxHeight: number; positioning: 'fixed' | 'absolute' } => {
  // Unified positioning logic for both mobile and desktop
  // We use 'fixed' positioning to escape any overflow:hidden containers

  const viewport = getViewportSize();
  const triggerRect = triggerElement.getBoundingClientRect();
  const safeMargin = 8;
  const headerHeight = viewport.isMobile ? 60 : 0;

  let top: number;
  let left: number;
  let maxHeight: number;

  if (viewport.isMobile) {
    // Mobile specific logic
    const mobileMargin = viewport.isSmallMobile ? 8 : 16;
    maxHeight = viewport.height - headerHeight - mobileMargin * 2;

    if (viewport.isSmallMobile) {
      // Center dropdown on very small screens
      top = headerHeight + mobileMargin;
      left = mobileMargin;
    } else {
      // Position below trigger but constrain to viewport
      const preferredTop = triggerRect.bottom + 8;
      const wouldOverflow = preferredTop + dropdownHeight > viewport.height - mobileMargin;

      if (wouldOverflow) {
        // Position above trigger if it would overflow below
        top = Math.max(mobileMargin, triggerRect.top - dropdownHeight - 8);
      } else {
        top = preferredTop;
      }

      // Horizontal positioning
      left = Math.max(mobileMargin, Math.min(
        triggerRect.right - dropdownWidth,
        viewport.width - dropdownWidth - mobileMargin
      ));
    }
  } else {
    // Desktop logic - use fixed positioning relative to viewport
    // This solves the issue of menus being cut off by overflow:hidden parents

    // Default: bottom-right aligned to trigger
    const preferredTop = triggerRect.bottom + 4;
    const preferredLeft = triggerRect.right - dropdownWidth;

    // Check vertical overflow
    const spaceBelow = viewport.height - preferredTop - safeMargin;
    const spaceAbove = triggerRect.top - safeMargin;

    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      // Position above if better fit
      top = triggerRect.top - dropdownHeight - 4;
      maxHeight = Math.min(dropdownHeight, spaceAbove);
    } else {
      // Position below
      top = preferredTop;
      maxHeight = Math.min(dropdownHeight, spaceBelow);
    }

    // Check horizontal overflow
    if (preferredLeft < safeMargin) {
      // If goes off-screen left, align to left of trigger or viewport left
      left = Math.max(safeMargin, triggerRect.left);
    } else {
      left = preferredLeft;
    }
  }

  return {
    top,
    left,
    maxHeight,
    positioning: 'fixed'
  };
};

/**
 * Check if dropdown content needs scrolling
 */
export const needsScrolling = (contentHeight: number, maxHeight: number): boolean => {
  return contentHeight > maxHeight;
};

/**
 * Calculate scroll indicators visibility
 */
export const getScrollIndicators = (element: HTMLElement) => {
  if (!element) return { showTop: false, showBottom: false };

  const { scrollTop, scrollHeight, clientHeight } = element;
  const threshold = 10; // Pixels threshold for showing indicators

  return {
    showTop: scrollTop > threshold,
    showBottom: scrollTop < scrollHeight - clientHeight - threshold
  };
};

/**
 * Add touch scroll enhancements to dropdown element
 */
export const enhanceDropdownScrolling = (element: HTMLElement): (() => void) => {
  if (!element) return () => { };

  const viewport = getViewportSize();
  if (!viewport.isMobile) return () => { };

  // Add CSS classes for mobile optimization
  element.classList.add('mobile-dropdown-container', 'smooth-scroll');

  // Prevent scroll chaining
  const handleTouchMove = (e: TouchEvent) => {
    const { scrollTop, scrollHeight, clientHeight } = element;
    const isAtTop = scrollTop === 0;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight;

    // Prevent overscroll bounce
    if ((isAtTop && e.touches[0].clientY > e.touches[0].clientY) ||
      (isAtBottom && e.touches[0].clientY < e.touches[0].clientY)) {
      e.preventDefault();
    }
  };

  element.addEventListener('touchmove', handleTouchMove, { passive: false });

  // Cleanup function
  return () => {
    element.removeEventListener('touchmove', handleTouchMove);
    element.classList.remove('mobile-dropdown-container', 'smooth-scroll');
  };
};

/**
 * Create scroll indicator elements
 */
export const createScrollIndicators = (): { top: HTMLElement; bottom: HTMLElement } => {
  const topIndicator = document.createElement('div');
  topIndicator.className = 'mobile-dropdown-scroll-indicator top';
  topIndicator.style.display = 'none';

  const bottomIndicator = document.createElement('div');
  bottomIndicator.className = 'mobile-dropdown-scroll-indicator bottom';
  bottomIndicator.style.display = 'none';

  return { top: topIndicator, bottom: bottomIndicator };
};

/**
 * Update scroll indicators based on scroll position
 */
export const updateScrollIndicators = (
  scrollContainer: HTMLElement,
  topIndicator: HTMLElement,
  bottomIndicator: HTMLElement
) => {
  const { showTop, showBottom } = getScrollIndicators(scrollContainer);

  topIndicator.style.display = showTop ? 'block' : 'none';
  bottomIndicator.style.display = showBottom ? 'block' : 'none';
};

/**
 * Debounce function for scroll events
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};