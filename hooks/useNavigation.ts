import { useEffect, useCallback } from 'react';
import { useAppData } from './useAppData';
import { TabKeys } from '../types';

export const useNavigation = () => {
  const {
    currentTab,
    changeTab,
    navigationHistory,
    navigateBack,
    canNavigateBack,
    addToNavigationHistory
  } = useAppData();

  // Handle browser/hardware back button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault();
      navigateBack();
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

  // Handle hardware back button on Android
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Android back button (keyCode 4) or Escape key
      if (event.keyCode === 4 || event.key === 'Escape') {
        event.preventDefault();
        navigateBack();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigateBack]);

  return {
    navigateBack,
    canNavigateBack,
    addToNavigationHistory,
    navigationHistory
  };
};
