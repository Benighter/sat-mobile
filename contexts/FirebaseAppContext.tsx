// Firebase-enabled App Context
import React, { createContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { Member, AttendanceRecord, Bacenta, TabOption, AttendanceStatus, TabKeys, NavigationHistoryItem, NewBeliever } from '../types';
import { FIXED_TABS, CONSECUTIVE_ABSENCE_THRESHOLD, DEFAULT_TAB_ID } from '../constants';
import { getSundaysOfMonth, formatDateToYYYYMMDD } from '../utils/dateUtils';
import {
  membersFirebaseService,
  bacentasFirebaseService,
  attendanceFirebaseService,
  newBelieversFirebaseService,
  authService,
  firebaseUtils,
  FirebaseUser
} from '../services/firebaseService';
import { dataMigrationService } from '../utils/dataMigration';

interface AppContextType {
  // Data
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  bacentas: Bacenta[];
  newBelievers: NewBeliever[];
  
  // UI State
  currentTab: TabOption;
  isLoading: boolean;
  error: string | null;
  displayedSundays: string[];
  displayedDate: Date;
  criticalMemberIds: string[];
  
  // Modal States
  isMemberFormOpen: boolean;
  editingMember: Member | null;
  isBacentaFormOpen: boolean;
  editingBacenta: Bacenta | null;
  isBacentaDrawerOpen: boolean;
  isNewBelieverFormOpen: boolean;
  editingNewBeliever: NewBeliever | null;
  
  // Confirmation Modal
  confirmationModal: {
    isOpen: boolean;
    type: 'deleteMember' | 'deleteBacenta' | 'deleteNewBeliever' | 'clearData' | null;
    data: any;
    onConfirm: () => void;
  };
  
  // Toasts
  toasts: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
  }>;
  
  // Firebase-specific
  user: FirebaseUser | null;
  isOnline: boolean;
  needsMigration: boolean;
  
  // Data Operations
  fetchInitialData: () => Promise<void>;
  addMemberHandler: (memberData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>) => Promise<void>;
  addMultipleMembersHandler: (membersData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>[]) => Promise<{ successful: Member[], failed: { data: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>, error: string }[] }>;
  updateMemberHandler: (memberData: Member) => Promise<void>;
  deleteMemberHandler: (memberId: string) => Promise<void>;
  
  // Bacenta Operations
  addBacentaHandler: (bacentaData: Omit<Bacenta, 'id'>) => Promise<void>;
  updateBacentaHandler: (bacentaData: Bacenta) => Promise<void>;
  deleteBacentaHandler: (bacentaId: string) => Promise<void>;
  
  // New Believer Operations
  addNewBelieverHandler: (newBelieverData: Omit<NewBeliever, 'id' | 'createdDate' | 'lastUpdated'>) => Promise<void>;
  updateNewBelieverHandler: (newBelieverData: NewBeliever) => Promise<void>;
  deleteNewBelieverHandler: (newBelieverId: string) => Promise<void>;
  
  // Attendance Operations
  markAttendanceHandler: (memberId: string, date: string, status: AttendanceStatus) => Promise<void>;
  markNewBelieverAttendanceHandler: (newBelieverId: string, date: string, status: AttendanceStatus) => Promise<void>;
  
  // UI Handlers
  openMemberForm: (member?: Member) => void;
  closeMemberForm: () => void;
  openBacentaForm: (bacenta?: Bacenta) => void;
  closeBacentaForm: () => void;
  openBacentaDrawer: () => void;
  closeBacentaDrawer: () => void;
  openNewBelieverForm: (newBeliever?: NewBeliever) => void;
  closeNewBelieverForm: () => void;
  
  // Navigation
  switchTab: (tab: TabOption) => void;
  navigateToPreviousMonth: () => void;
  navigateToNextMonth: () => void;
  navigateBack: () => void;
  canNavigateBack: () => boolean;
  addToNavigationHistory: (tabId: string, data?: any) => void;
  
  // Utility
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
  removeToast: (id: string) => void;
  exportData: () => string;
  importData: (jsonData: string) => boolean;
  
  // Firebase-specific operations
  triggerMigration: () => Promise<void>;
  toggleOfflineMode: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const FirebaseAppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Core data state
  const [members, setMembers] = useState<Member[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [bacentas, setBacentas] = useState<Bacenta[]>([]);
  const [newBelievers, setNewBelievers] = useState<NewBeliever[]>([]);
  
  // UI state
  const [currentTab, setCurrentTab] = useState<TabOption>(FIXED_TABS.find(t => t.id === DEFAULT_TAB_ID) || FIXED_TABS[0]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [displayedDate, setDisplayedDate] = useState<Date>(new Date());
  
  // Modal states
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isBacentaFormOpen, setIsBacentaFormOpen] = useState(false);
  const [editingBacenta, setEditingBacenta] = useState<Bacenta | null>(null);
  const [isBacentaDrawerOpen, setIsBacentaDrawerOpen] = useState(false);
  const [isNewBelieverFormOpen, setIsNewBelieverFormOpen] = useState(false);
  const [editingNewBeliever, setEditingNewBeliever] = useState<NewBeliever | null>(null);
  
  // Confirmation modal
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    type: 'deleteMember' | 'deleteBacenta' | 'deleteNewBeliever' | 'clearData' | null;
    data: any;
    onConfirm: () => void;
  }>({
    isOpen: false,
    type: null,
    data: null,
    onConfirm: () => {}
  });
  
  // Toasts
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
  }>>([]);
  
  // Firebase-specific state
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [needsMigration, setNeedsMigration] = useState<boolean>(false);
  
  // Navigation state
  const [navigationHistory, setNavigationHistory] = useState<NavigationHistoryItem[]>([]);
  const isNavigatingBack = React.useRef(false);
  
  // Memoized computed values
  const displayedSundays = useMemo(() => {
    return getSundaysOfMonth(displayedDate.getFullYear(), displayedDate.getMonth());
  }, [displayedDate]);
  
  const criticalMemberIds = useMemo(() => {
    if (!displayedSundays.length || !members.length) return [];

    const criticalIds: string[] = [];
    const sortedSundays = [...displayedSundays].sort((a,b) => new Date(a).getTime() - new Date(b).getTime());

    members.forEach(member => {
      let consecutiveAbsences = 0;
      let maxConsecutiveAbsences = 0;

      // Only consider Sundays that occur after the member's join date
      const memberJoinDate = new Date(member.joinedDate);
      const relevantSundays = sortedSundays.filter(sunday => new Date(sunday) >= memberJoinDate);

      // Skip if member hasn't been around for at least CONSECUTIVE_ABSENCE_THRESHOLD Sundays
      if (relevantSundays.length < CONSECUTIVE_ABSENCE_THRESHOLD) {
        return;
      }

      for (const sunday of relevantSundays) {
        const attendance = attendanceRecords.find(
          record => record.memberId === member.id && record.date === sunday
        );

        if (!attendance || attendance.status === 'Absent') {
          consecutiveAbsences++;
          maxConsecutiveAbsences = Math.max(maxConsecutiveAbsences, consecutiveAbsences);
        } else {
          consecutiveAbsences = 0;
        }
      }

      if (maxConsecutiveAbsences >= CONSECUTIVE_ABSENCE_THRESHOLD) {
        criticalIds.push(member.id);
      }
    });

    return criticalIds;
  }, [members, attendanceRecords, displayedSundays]);
  
  // Initialize Firebase listeners and check for migration
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoading(true);
        
        // Check if migration is needed
        const hasMigrationData = dataMigrationService.hasLocalStorageData();
        setNeedsMigration(hasMigrationData);
        
        // Listen to auth state changes
        const unsubscribeAuth = authService.onAuthStateChanged((user) => {
          setUser(user);
          if (user && firebaseUtils.isReady()) {
            // User is authenticated, set up data listeners
            setupDataListeners();
          } else {
            // User not authenticated, clear data
            setMembers([]);
            setBacentas([]);
            setAttendanceRecords([]);
            setNewBelievers([]);
          }
          setIsLoading(false);
        });
        
        return () => {
          unsubscribeAuth();
        };
      } catch (error: any) {
        setError(error.message);
        setIsLoading(false);
      }
    };
    
    initializeApp();
  }, []);
  
  // Set up real-time data listeners
  const setupDataListeners = useCallback(() => {
    if (!firebaseUtils.isReady()) return;
    
    const unsubscribers: (() => void)[] = [];
    
    try {
      // Listen to members
      const unsubscribeMembers = membersFirebaseService.onSnapshot((members) => {
        setMembers(members);
      });
      unsubscribers.push(unsubscribeMembers);
      
      // Listen to bacentas
      const unsubscribeBacentas = bacentasFirebaseService.onSnapshot((bacentas) => {
        setBacentas(bacentas);
      });
      unsubscribers.push(unsubscribeBacentas);
      
      // Listen to attendance
      const unsubscribeAttendance = attendanceFirebaseService.onSnapshot((records) => {
        setAttendanceRecords(records);
      });
      unsubscribers.push(unsubscribeAttendance);
      
      // Listen to new believers
      const unsubscribeNewBelievers = newBelieversFirebaseService.onSnapshot((newBelievers) => {
        setNewBelievers(newBelievers);
      });
      unsubscribers.push(unsubscribeNewBelievers);
      
    } catch (error: any) {
      setError(error.message);
    }
    
    // Return cleanup function
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, []);
  
  // Fetch initial data (for manual refresh)
  const fetchInitialData = useCallback(async () => {
    if (!firebaseUtils.isReady()) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const [membersData, bacentasData, attendanceData, newBelieversData] = await Promise.all([
        membersFirebaseService.getAll(),
        bacentasFirebaseService.getAll(),
        attendanceFirebaseService.getAll(),
        newBelieversFirebaseService.getAll()
      ]);
      
      setMembers(membersData);
      setBacentas(bacentasData);
      setAttendanceRecords(attendanceData);
      setNewBelievers(newBelieversData);
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to fetch data', error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Toast management
  const showToast = useCallback((type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, title, message }]);
    
    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  }, []);
  
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Member handlers
  const addMemberHandler = useCallback(async (memberData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>) => {
    try {
      setIsLoading(true);
      await membersFirebaseService.add(memberData);
      showToast('success', 'Member added successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to add member', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const addMultipleMembersHandler = useCallback(async (membersData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>[]) => {
    const successful: Member[] = [];
    const failed: { data: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>, error: string }[] = [];

    try {
      setIsLoading(true);

      for (const memberData of membersData) {
        try {
          const memberId = await membersFirebaseService.add(memberData);
          successful.push({ ...memberData, id: memberId, createdDate: new Date().toISOString(), lastUpdated: new Date().toISOString() });
        } catch (error: any) {
          failed.push({ data: memberData, error: error.message });
        }
      }

      if (successful.length > 0) {
        showToast('success', `${successful.length} members added successfully`);
      }
      if (failed.length > 0) {
        showToast('warning', `${failed.length} members failed to add`);
      }

      return { successful, failed };
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to add members', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const updateMemberHandler = useCallback(async (memberData: Member) => {
    try {
      setIsLoading(true);
      await membersFirebaseService.update(memberData.id, memberData);
      showToast('success', 'Member updated successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to update member', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const deleteMemberHandler = useCallback(async (memberId: string) => {
    try {
      setIsLoading(true);
      await membersFirebaseService.delete(memberId);
      showToast('success', 'Member deleted successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to delete member', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Bacenta handlers
  const addBacentaHandler = useCallback(async (bacentaData: Omit<Bacenta, 'id'>) => {
    try {
      setIsLoading(true);
      await bacentasFirebaseService.add(bacentaData);
      showToast('success', 'Bacenta added successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to add bacenta', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const updateBacentaHandler = useCallback(async (bacentaData: Bacenta) => {
    try {
      setIsLoading(true);
      await bacentasFirebaseService.update(bacentaData.id, bacentaData);
      showToast('success', 'Bacenta updated successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to update bacenta', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const deleteBacentaHandler = useCallback(async (bacentaId: string) => {
    try {
      setIsLoading(true);
      await bacentasFirebaseService.delete(bacentaId);
      showToast('success', 'Bacenta deleted successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to delete bacenta', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // New Believer handlers
  const addNewBelieverHandler = useCallback(async (newBelieverData: Omit<NewBeliever, 'id' | 'createdDate' | 'lastUpdated'>) => {
    try {
      setIsLoading(true);
      await newBelieversFirebaseService.add(newBelieverData);
      showToast('success', 'New believer added successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to add new believer', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const updateNewBelieverHandler = useCallback(async (newBelieverData: NewBeliever) => {
    try {
      setIsLoading(true);
      await newBelieversFirebaseService.update(newBelieverData.id, newBelieverData);
      showToast('success', 'New believer updated successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to update new believer', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const deleteNewBelieverHandler = useCallback(async (newBelieverId: string) => {
    try {
      setIsLoading(true);
      await newBelieversFirebaseService.delete(newBelieverId);
      showToast('success', 'New believer deleted successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to delete new believer', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Attendance handlers
  const markAttendanceHandler = useCallback(async (memberId: string, date: string, status: AttendanceStatus) => {
    try {
      const recordId = `${memberId}_${date}`;
      const record: AttendanceRecord = {
        id: recordId,
        memberId,
        date,
        status
      };

      await attendanceFirebaseService.addOrUpdate(record);
      showToast('success', 'Attendance marked successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to mark attendance', error.message);
      throw error;
    }
  }, [showToast]);

  const markNewBelieverAttendanceHandler = useCallback(async (newBelieverId: string, date: string, status: AttendanceStatus) => {
    try {
      const recordId = `${newBelieverId}_${date}`;
      const record: AttendanceRecord = {
        id: recordId,
        newBelieverId,
        date,
        status
      };

      await attendanceFirebaseService.addOrUpdate(record);
      showToast('success', 'New believer attendance marked successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to mark new believer attendance', error.message);
      throw error;
    }
  }, [showToast]);

  // UI handlers
  const openMemberForm = useCallback((member?: Member) => {
    setEditingMember(member || null);
    setIsMemberFormOpen(true);
  }, []);

  const closeMemberForm = useCallback(() => {
    setEditingMember(null);
    setIsMemberFormOpen(false);
  }, []);

  const openBacentaForm = useCallback((bacenta?: Bacenta) => {
    setEditingBacenta(bacenta || null);
    setIsBacentaFormOpen(true);
  }, []);

  const closeBacentaForm = useCallback(() => {
    setEditingBacenta(null);
    setIsBacentaFormOpen(false);
  }, []);

  const openBacentaDrawer = useCallback(() => {
    setIsBacentaDrawerOpen(true);
  }, []);

  const closeBacentaDrawer = useCallback(() => {
    setIsBacentaDrawerOpen(false);
  }, []);

  const openNewBelieverForm = useCallback((newBeliever?: NewBeliever) => {
    setEditingNewBeliever(newBeliever || null);
    setIsNewBelieverFormOpen(true);
  }, []);

  const closeNewBelieverForm = useCallback(() => {
    setEditingNewBeliever(null);
    setIsNewBelieverFormOpen(false);
  }, []);

  // Navigation handlers
  const switchTab = useCallback((tab: TabOption) => {
    if (!isNavigatingBack.current) {
      addToNavigationHistory(currentTab.id);
    }
    isNavigatingBack.current = false;
    setCurrentTab(tab);
  }, [currentTab]);

  const navigateToPreviousMonth = useCallback(() => {
    setDisplayedDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  }, []);

  const navigateToNextMonth = useCallback(() => {
    setDisplayedDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  }, []);

  const addToNavigationHistory = useCallback((tabId: string, data?: any) => {
    setNavigationHistory(prev => [
      ...prev.slice(-9), // Keep last 10 items
      { tabId, timestamp: Date.now(), data }
    ]);
  }, []);

  const navigateBack = useCallback(() => {
    if (navigationHistory.length > 0) {
      const lastItem = navigationHistory[navigationHistory.length - 1];
      const targetTab = FIXED_TABS.find(tab => tab.id === lastItem.tabId);

      if (targetTab) {
        isNavigatingBack.current = true;
        setCurrentTab(targetTab);
        setNavigationHistory(prev => prev.slice(0, -1));
      }
    }
  }, [navigationHistory]);

  const canNavigateBack = useCallback(() => {
    return navigationHistory.length > 0;
  }, [navigationHistory]);

  // Firebase-specific operations
  const triggerMigration = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await dataMigrationService.migrateAllData();

      if (result.success) {
        setNeedsMigration(false);
        showToast('success', 'Migration completed successfully');
        await fetchInitialData(); // Refresh data
      } else {
        showToast('error', 'Migration failed', result.errors.join(', '));
      }
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Migration failed', error.message);
    } finally {
      setIsLoading(false);
    }
  }, [fetchInitialData, showToast]);

  const toggleOfflineMode = useCallback(async () => {
    try {
      if (isOnline) {
        await firebaseUtils.enableOffline();
        setIsOnline(false);
        showToast('info', 'Offline mode enabled');
      } else {
        await firebaseUtils.enableOnline();
        setIsOnline(true);
        showToast('info', 'Online mode enabled');
      }
    } catch (error: any) {
      showToast('error', 'Failed to toggle offline mode', error.message);
    }
  }, [isOnline, showToast]);

  // Data export/import (for backup purposes)
  const exportData = useCallback((): string => {
    try {
      const data = {
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        members,
        bacentas,
        attendanceRecords,
        newBelievers,
        currentTab,
        displayedDate: displayedDate.toISOString()
      };

      return JSON.stringify(data, null, 2);
    } catch (error: any) {
      showToast('error', 'Failed to export data', error.message);
      return '';
    }
  }, [members, bacentas, attendanceRecords, newBelievers, currentTab, displayedDate, showToast]);

  const importData = useCallback((jsonData: string): boolean => {
    try {
      const data = JSON.parse(jsonData);

      // Validate data structure
      if (!data.version || !data.members || !data.bacentas) {
        throw new Error('Invalid data format');
      }

      // Note: This is for display purposes only
      // Actual import should go through Firebase services
      showToast('info', 'Data import requires Firebase migration');
      return false;
    } catch (error: any) {
      showToast('error', 'Failed to import data', error.message);
      return false;
    }
  }, [showToast]);

  // Context value
  const contextValue: AppContextType = {
    // Data
    members,
    attendanceRecords,
    bacentas,
    newBelievers,

    // UI State
    currentTab,
    isLoading,
    error,
    displayedSundays,
    displayedDate,
    criticalMemberIds,

    // Modal States
    isMemberFormOpen,
    editingMember,
    isBacentaFormOpen,
    editingBacenta,
    isBacentaDrawerOpen,
    isNewBelieverFormOpen,
    editingNewBeliever,

    // Confirmation Modal
    confirmationModal,

    // Toasts
    toasts,

    // Firebase-specific
    user,
    isOnline,
    needsMigration,

    // Data Operations
    fetchInitialData,
    addMemberHandler,
    addMultipleMembersHandler,
    updateMemberHandler,
    deleteMemberHandler,

    // Bacenta Operations
    addBacentaHandler,
    updateBacentaHandler,
    deleteBacentaHandler,

    // New Believer Operations
    addNewBelieverHandler,
    updateNewBelieverHandler,
    deleteNewBelieverHandler,

    // Attendance Operations
    markAttendanceHandler,
    markNewBelieverAttendanceHandler,

    // UI Handlers
    openMemberForm,
    closeMemberForm,
    openBacentaForm,
    closeBacentaForm,
    openBacentaDrawer,
    closeBacentaDrawer,
    openNewBelieverForm,
    closeNewBelieverForm,

    // Navigation
    switchTab,
    navigateToPreviousMonth,
    navigateToNextMonth,
    navigateBack,
    canNavigateBack,
    addToNavigationHistory,

    // Utility
    showToast,
    removeToast,
    exportData,
    importData,

    // Firebase-specific operations
    triggerMigration,
    toggleOfflineMode
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

// Hook to use the context
export const useAppContext = () => {
  const context = React.useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within a FirebaseAppProvider');
  }
  return context;
};

export default AppContext;
