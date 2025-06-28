import { useEffect, useCallback } from 'react';
import { useAppContext } from '../contexts/SimpleFirebaseContext';
import { TabKeys } from '../types';

export const useNavigation = () => {
  const {
    currentTab,
    switchTab,
    navigationHistory,
    navigateBack,
    canNavigateBack,
    addToNavigationHistory
  } = useAppContext();

  // Handle browser/hardware back button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault();
      const didNavigate = navigateBack();

      // If we couldn't navigate back (e.g., on dashboard), push state again to prevent app closure
      if (!didNavigate) {
        window.history.pushState({ page: currentTab.id }, '', window.location.href);
      }
    };

    // Add popstate listener for browser back button
    window.addEventListener('popstate', handlePopState);

    // Push initial state to enable back button handling
    if (window.history.state === null) {
      window.history.pushState({ page: currentTab.id }, '', window.location.href);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigateBack, currentTab.id]);

  // Handle hardware back button on Android and other mobile devices
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Android back button (keyCode 4) or Escape key
      if (event.keyCode === 4 || event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();

        const didNavigate = navigateBack();

        // If we couldn't navigate back, prevent default behavior to avoid app closure
        if (!didNavigate) {
          // Stay on current page instead of closing app
          return false;
        }
      }
    };

    // Handle mobile app back button events
    const handleBackButton = (event: Event) => {
      event.preventDefault();
      const didNavigate = navigateBack();

      if (!didNavigate) {
        // Prevent app closure by stopping the event
        event.stopPropagation();
        return false;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase

    // Listen for mobile back button events
    document.addEventListener('backbutton', handleBackButton, false);
    window.addEventListener('beforeunload', (e) => {
      // Only prevent unload if we can navigate back
      if (canNavigateBack()) {
        e.preventDefault();
        navigateBack();
        return '';
      }
    });

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('backbutton', handleBackButton, false);
    };
  }, [navigateBack, canNavigateBack]);

  return {
    navigateBack,
    canNavigateBack,
    addToNavigationHistory,
    navigationHistory
  };
};
