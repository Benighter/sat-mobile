// Performance optimization utilities

// Debounce function for expensive operations
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function for frequent events
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Memoization for expensive calculations
export function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map();
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// Performance measurement
export class PerformanceMonitor {
  private static measurements: Map<string, number[]> = new Map();

  static start(label: string): void {
    try {
      const markName = `${label}-start`;
      // Clear any existing mark with the same name to prevent conflicts
      performance.clearMarks(markName);
      performance.mark(markName);
    } catch (error) {
      console.warn(`Performance mark creation failed for '${label}':`, error);
    }
  }

  static end(label: string): number {
    try {
      // Check if start mark exists before trying to measure
      const startMarkName = `${label}-start`;
      const existingMarks = performance.getEntriesByName(startMarkName, 'mark');

      if (existingMarks.length === 0) {
        // Silently create the start mark if it doesn't exist
        performance.mark(startMarkName);
      }

      performance.mark(`${label}-end`);
      performance.measure(label, startMarkName, `${label}-end`);

      const measure = performance.getEntriesByName(label, 'measure')[0];
      const duration = measure ? measure.duration : 0;

      // Store measurement
      if (!this.measurements.has(label)) {
        this.measurements.set(label, []);
      }
      this.measurements.get(label)!.push(duration);

      // Clean up marks
      performance.clearMarks(startMarkName);
      performance.clearMarks(`${label}-end`);
      performance.clearMeasures(label);

      return duration;
    } catch (error) {
      console.warn(`Performance measurement failed for '${label}':`, error);
      return 0;
    }
  }

  static getAverageTime(label: string): number {
    const times = this.measurements.get(label) || [];
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  static getReport(): Record<string, { average: number; count: number; total: number }> {
    const report: Record<string, { average: number; count: number; total: number }> = {};
    
    this.measurements.forEach((times, label) => {
      const total = times.reduce((a, b) => a + b, 0);
      report[label] = {
        average: total / times.length,
        count: times.length,
        total
      };
    });
    
    return report;
  }
}

// Intersection Observer for lazy loading
export function createIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options?: IntersectionObserverInit
): IntersectionObserver {
  return new IntersectionObserver(callback, {
    rootMargin: '50px',
    threshold: 0.1,
    ...options
  });
}

// Virtual scrolling helper
export function calculateVisibleItems(
  containerHeight: number,
  itemHeight: number,
  scrollTop: number,
  totalItems: number,
  overscan: number = 5
): { startIndex: number; endIndex: number; visibleItems: number } {
  const visibleItems = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(totalItems - 1, startIndex + visibleItems + overscan * 2);
  
  return { startIndex, endIndex, visibleItems };
}

// Bundle size analyzer (development only)
export function analyzeBundleSize(): void {
  if (process.env.NODE_ENV === 'development') {
    console.group('📦 Bundle Analysis');
    
    // Analyze loaded scripts
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    scripts.forEach(script => {
      const src = (script as HTMLScriptElement).src;
      if (src.includes('chunk') || src.includes('vendor')) {
        console.log(`Script: ${src.split('/').pop()}`);
      }
    });
    
    // Memory usage (if available)
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      console.log(`Memory Usage: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Memory Limit: ${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`);
    }
    
    console.groupEnd();
  }
}

// Preload critical resources
export function preloadCriticalResources(): void {
  // Preload fonts
  const fontLink = document.createElement('link');
  fontLink.rel = 'preload';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap';
  fontLink.as = 'style';
  document.head.appendChild(fontLink);
}

// Optimize images
export function optimizeImage(src: string, width?: number, height?: number): string {
  // For production, you might want to use a service like Cloudinary or ImageKit
  if (width && height) {
    return `${src}?w=${width}&h=${height}&q=80&f=auto`;
  }
  return src;
}

// Service Worker registration for caching
export function registerServiceWorker(): void {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('SW registered: ', registration);
        })
        .catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  }
}
