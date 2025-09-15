/**
 * Mobile Dropdown Responsiveness Test
 * 
 * This test file provides functionality to verify that dropdown components
 * work correctly on mobile devices with different screen sizes.
 * 
 * Test cases:
 * 1. iPhone 11 (414x896px)
 * 2. iPhone SE (375x667px)  
 * 3. iPhone 12/13/14 (390x844px)
 * 4. Samsung Galaxy S21 (360x800px)
 * 5. iPad Mini (768x1024px)
 */

import { getViewportSize, calculateMobileDropdownPosition } from '../utils/viewportUtils';

// Test viewport sizes
const TEST_VIEWPORTS = {
  'iPhone SE': { width: 375, height: 667 },
  'iPhone 11': { width: 414, height: 896 },
  'iPhone 12/13/14': { width: 390, height: 844 },
  'Galaxy S21': { width: 360, height: 800 },
  'iPad Mini': { width: 768, height: 1024 }
};

/**
 * Mock window dimensions for testing
 */
function mockWindowSize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
}

/**
 * Create a mock trigger element for testing
 */
function createMockTriggerElement(x: number, y: number, width: number, height: number): HTMLElement {
  const element = document.createElement('button');
  element.getBoundingClientRect = () => ({
    x,
    y,
    width,
    height,
    top: y,
    right: x + width,
    bottom: y + height,
    left: x,
    toJSON: () => {}
  });
  return element;
}

/**
 * Test viewport detection for different screen sizes
 */
export function testViewportDetection() {
  console.log('Testing viewport detection...');
  
  Object.entries(TEST_VIEWPORTS).forEach(([device, { width, height }]) => {
    mockWindowSize(width, height);
    const viewport = getViewportSize();
    
    console.log(`${device}:`, {
      detected: viewport,
      expected: {
        width,
        height,
        isMobile: width <= 414,
        isSmallMobile: width <= 375,
        availableHeight: height - 100
      },
      correct: viewport.width === width && 
               viewport.height === height &&
               viewport.isMobile === (width <= 414) &&
               viewport.isSmallMobile === (width <= 375)
    });
  });
}

/**
 * Test dropdown positioning for different screen sizes
 */
export function testDropdownPositioning() {
  console.log('Testing dropdown positioning...');
  
  Object.entries(TEST_VIEWPORTS).forEach(([device, { width, height }]) => {
    mockWindowSize(width, height);
    
    // Test different trigger positions
    const triggerPositions = [
      { name: 'top-right', x: width - 100, y: 50, width: 80, height: 40 },
      { name: 'center', x: width / 2 - 40, y: height / 2 - 20, width: 80, height: 40 },
      { name: 'bottom-left', x: 20, y: height - 100, width: 80, height: 40 }
    ];
    
    triggerPositions.forEach(({ name, x, y, width: triggerWidth, height: triggerHeight }) => {
      const mockTrigger = createMockTriggerElement(x, y, triggerWidth, triggerHeight);
      const position = calculateMobileDropdownPosition(mockTrigger, 300, 400);
      
      console.log(`${device} - ${name}:`, {
        triggerRect: { x, y, width: triggerWidth, height: triggerHeight },
        calculatedPosition: position,
        withinBounds: {
          left: position.left >= 0,
          top: position.top >= 0,
          right: position.left + 300 <= width,
          bottom: position.top + Math.min(400, position.maxHeight) <= height
        }
      });
    });
  });
}

/**
 * Test CSS classes are applied correctly on mobile devices
 */
export function testMobileCSSClasses() {
  console.log('Testing mobile CSS classes...');
  
  // Create test dropdown element
  const dropdownElement = document.createElement('div');
  dropdownElement.className = 'test-dropdown';
  document.body.appendChild(dropdownElement);
  
  Object.entries(TEST_VIEWPORTS).forEach(([device, { width, height }]) => {
    mockWindowSize(width, height);
    const viewport = getViewportSize();
    
    // Apply mobile classes based on viewport
    if (viewport.isMobile) {
      dropdownElement.classList.add('mobile-dropdown-menu', 'mobile-dropdown-content');
      if (viewport.isSmallMobile) {
        dropdownElement.classList.add('small-mobile');
      }
    } else {
      dropdownElement.classList.remove('mobile-dropdown-menu', 'mobile-dropdown-content', 'small-mobile');
    }
    
    const hasCorrectClasses = viewport.isMobile 
      ? dropdownElement.classList.contains('mobile-dropdown-menu')
      : !dropdownElement.classList.contains('mobile-dropdown-menu');
    
    console.log(`${device}:`, {
      viewport,
      classes: Array.from(dropdownElement.classList),
      correct: hasCorrectClasses
    });
  });
  
  // Cleanup
  document.body.removeChild(dropdownElement);
}

/**
 * Test touch interaction setup
 */
export function testTouchInteractions() {
  console.log('Testing touch interactions...');
  
  // Create test elements
  const container = document.createElement('div');
  const scrollableContent = document.createElement('div');
  scrollableContent.style.height = '1000px'; // Make it scrollable
  container.appendChild(scrollableContent);
  container.style.height = '300px';
  container.style.overflow = 'auto';
  document.body.appendChild(container);
  
  Object.entries(TEST_VIEWPORTS).forEach(([device, { width, height }]) => {
    mockWindowSize(width, height);
    const viewport = getViewportSize();
    
    if (viewport.isMobile) {
      // Apply mobile touch optimizations
      container.classList.add('mobile-dropdown-container', 'smooth-scroll');
      container.style.webkitOverflowScrolling = 'touch';
      container.style.touchAction = 'auto';
    }
    
    const hasTouchOptimizations = viewport.isMobile
      ? container.classList.contains('mobile-dropdown-container') &&
        container.style.webkitOverflowScrolling === 'touch'
      : true; // Non-mobile devices don't need these optimizations
    
    console.log(`${device}:`, {
      isMobile: viewport.isMobile,
      hasTouchOptimizations,
      classList: Array.from(container.classList),
      styles: {
        webkitOverflowScrolling: container.style.webkitOverflowScrolling,
        touchAction: container.style.touchAction
      }
    });
  });
  
  // Cleanup
  document.body.removeChild(container);
}

/**
 * Run all tests
 */
export function runAllMobileDropdownTests() {
  console.log('Starting Mobile Dropdown Responsiveness Tests...\n');
  
  try {
    testViewportDetection();
    console.log('\n---\n');
    
    testDropdownPositioning();
    console.log('\n---\n');
    
    testMobileCSSClasses();
    console.log('\n---\n');
    
    testTouchInteractions();
    console.log('\n---\n');
    
    console.log('✅ All mobile dropdown tests completed!');
    return true;
  } catch (error) {
    console.error('❌ Mobile dropdown tests failed:', error);
    return false;
  }
}

/**
 * Manual testing helper - simulates different device sizes in the browser
 */
export function simulateDevice(deviceName: keyof typeof TEST_VIEWPORTS) {
  const viewport = TEST_VIEWPORTS[deviceName];
  if (!viewport) {
    console.error(`Device "${deviceName}" not found. Available devices:`, Object.keys(TEST_VIEWPORTS));
    return;
  }
  
  console.log(`Simulating ${deviceName} (${viewport.width}x${viewport.height})`);
  
  // Apply viewport size
  mockWindowSize(viewport.width, viewport.height);
  
  // Trigger resize event to update components
  window.dispatchEvent(new Event('resize'));
  
  // Add visual indicator
  const indicator = document.createElement('div');
  indicator.innerHTML = `📱 ${deviceName} (${viewport.width}x${viewport.height})`;
  indicator.style.position = 'fixed';
  indicator.style.top = '10px';
  indicator.style.left = '10px';
  indicator.style.background = 'rgba(0, 0, 0, 0.8)';
  indicator.style.color = 'white';
  indicator.style.padding = '8px 12px';
  indicator.style.borderRadius = '6px';
  indicator.style.fontSize = '12px';
  indicator.style.zIndex = '10000';
  indicator.style.fontFamily = 'monospace';
  document.body.appendChild(indicator);
  
  // Remove indicator after 3 seconds
  setTimeout(() => {
    if (document.body.contains(indicator)) {
      document.body.removeChild(indicator);
    }
  }, 3000);
}

// Make functions available globally for browser console testing
if (typeof window !== 'undefined') {
  (window as any).mobileDropdownTests = {
    runAllTests: runAllMobileDropdownTests,
    testViewportDetection,
    testDropdownPositioning, 
    testMobileCSSClasses,
    testTouchInteractions,
    simulateDevice,
    TEST_VIEWPORTS
  };
}

export default {
  runAllMobileDropdownTests,
  testViewportDetection,
  testDropdownPositioning,
  testMobileCSSClasses,
  testTouchInteractions,
  simulateDevice,
  TEST_VIEWPORTS
};