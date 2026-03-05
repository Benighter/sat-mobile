import { useEffect } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';

export const useNavigation = () => {
  const {
    currentTab,
    navigateBack,
    canNavigateBack,
    applyHistoryNavigation,
    resetToDashboard
  } = useAppContext();

  // Handle browser back/forward: interpret history state and apply to our stack
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault();
      const state = (event.state as any) || {};
      const target = state.tab as any;
      if (target && target.id) {
        applyHistoryNavigation(target);
      } else {
        // No state: if can go back internally, do it; otherwise ensure we're at dashboard
        if (!navigateBack()) {
          resetToDashboard();
        }
      }
    };

    window.addEventListener('popstate', handlePopState);

    // Ensure there is an initial state representing the current tab
    if (!window.history.state || !window.history.state.tab) {
      try {
        window.history.replaceState({ tab: currentTab }, '', window.location.href);
      } catch {}
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [applyHistoryNavigation, navigateBack, resetToDashboard, currentTab]);

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

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('backbutton', handleBackButton, false);
    };
  }, [navigateBack]);

  return {
    navigateBack,
    canNavigateBack,
  };
};
