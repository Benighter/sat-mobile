import { useState, useEffect } from 'react';

// Current app version - update this when you want to show the modal again
const CURRENT_VERSION = '1.1.0';
const STORAGE_KEY = 'sat_mobile_whats_new_shown';

interface WhatsNewState {
  shouldShow: boolean;
  isOpen: boolean;
  markAsShown: () => void;
  openModal: () => void;
  closeModal: () => void;
}

export const useWhatsNew = (): WhatsNewState => {
  const [shouldShow, setShouldShow] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    checkShouldShowWhatsNew();
  }, []);

  const checkShouldShowWhatsNew = () => {
    try {
      const storedData = localStorage.getItem(STORAGE_KEY);
      
      if (!storedData) {
        // First time user - show the modal
        setShouldShow(true);
        setIsOpen(true);
        return;
      }

      const { version, timestamp } = JSON.parse(storedData);
      
      // Show modal if the current version is different from stored version
      if (version !== CURRENT_VERSION) {
        setShouldShow(true);
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Error checking whats new status:', error);
      // If there's an error reading localStorage, show the modal to be safe
      setShouldShow(true);
      setIsOpen(true);
    }
  };

  const markAsShown = () => {
    try {
      const data = {
        version: CURRENT_VERSION,
        timestamp: new Date().toISOString(),
        shown: true
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setShouldShow(false);
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving whats new status:', error);
      // Even if we can't save to localStorage, close the modal
      setShouldShow(false);
      setIsOpen(false);
    }
  };

  const openModal = () => {
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    markAsShown();
  };

  return {
    shouldShow,
    isOpen,
    markAsShown,
    openModal,
    closeModal
  };
};

// Utility function to manually trigger the "What's New" modal
// Useful for testing or if you want to add a "Show What's New" button somewhere
export const showWhatsNewModal = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    // Reload the page to trigger the modal
    window.location.reload();
  } catch (error) {
    console.error('Error triggering whats new modal:', error);
  }
};

// Utility function to check if user has seen the current version's "What's New"
export const hasSeenCurrentWhatsNew = (): boolean => {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (!storedData) return false;
    
    const { version } = JSON.parse(storedData);
    return version === CURRENT_VERSION;
  } catch (error) {
    console.error('Error checking whats new status:', error);
    return false;
  }
};

// Get the current app version
export const getCurrentVersion = (): string => {
  return CURRENT_VERSION;
};
