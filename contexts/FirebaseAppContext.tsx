// Firebase-enabled App Context
import React, { createContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { Member, AttendanceRecord, Bacenta, TabOption, AttendanceStatus, TabKeys, NavigationHistoryItem, NewBeliever } from '../types';
import { FIXED_TABS, DEFAULT_TAB_ID } from '../constants';
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
import { userService } from '../services/userService';
import { inviteService } from '../services/inviteService';

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

  
  // Modal States
  isMemberFormOpen: boolean;
  editingMember: Member | null;
  isBacentaFormOpen: boolean;
  editingBacenta: Bacenta | null;
  isBacentaDrawerOpen: boolean;
  isNewBelieverFormOpen: boolean;
  editingNewBeliever: NewBeliever | null;
  isHierarchyModalOpen: boolean;
  hierarchyBacentaLeader: Member | null;

  // Confirmation Modal
  confirmationModal: {
    isOpen: boolean;
    type: 'deleteMember' | 'deleteBacenta' | 'deleteNewBeliever' | 'clearData' | 'clearSelectedData' | null;
    data: any;
    onConfirm: () => void;
  };
  showConfirmation: (type: 'deleteMember' | 'deleteBacenta' | 'deleteNewBeliever' | 'clearData' | 'clearSelectedData', data: any, onConfirm: () => void) => void;
  closeConfirmation: () => void;
  
  // Toasts
  toasts: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
  }>;
  
  // Firebase-specific
  user: FirebaseUser | null;
  userProfile: any;
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
  addMultipleNewBelieversHandler: (newBelieversData: Omit<NewBeliever, 'id' | 'createdDate' | 'lastUpdated'>[]) => Promise<{ successful: NewBeliever[], failed: { data: Omit<NewBeliever, 'id' | 'createdDate' | 'lastUpdated'>, error: string }[] }>;
  updateNewBelieverHandler: (newBelieverData: NewBeliever) => Promise<void>;
  deleteNewBelieverHandler: (newBelieverId: string) => Promise<void>;
  
  // Attendance Operations
  markAttendanceHandler: (memberId: string, date: string, status: AttendanceStatus) => Promise<void>;
  markNewBelieverAttendanceHandler: (newBelieverId: string, date: string, status: AttendanceStatus) => Promise<void>;
  clearAttendanceHandler: (memberId: string, date: string) => Promise<void>;
  
  // UI Handlers
  openMemberForm: (member?: Member) => void;
  closeMemberForm: () => void;
  openBacentaForm: (bacenta?: Bacenta) => void;
  closeBacentaForm: () => void;
  openBacentaDrawer: () => void;
  closeBacentaDrawer: () => void;
  openNewBelieverForm: (newBeliever?: NewBeliever) => void;
  closeNewBelieverForm: () => void;
  openHierarchyModal: (bacentaLeader: Member) => void;
  closeHierarchyModal: () => void;

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
  refreshUserProfile: () => Promise<void>;
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
  const [isHierarchyModalOpen, setIsHierarchyModalOpen] = useState(false);
  const [hierarchyBacentaLeader, setHierarchyBacentaLeader] = useState<Member | null>(null);

  // Confirmation modal
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    type: 'deleteMember' | 'deleteBacenta' | 'deleteNewBeliever' | 'clearData' | 'clearSelectedData' | null;
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
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [needsMigration, setNeedsMigration] = useState<boolean>(false);
  
  // Navigation state
  const [navigationHistory, setNavigationHistory] = useState<NavigationHistoryItem[]>([]);
  const isNavigatingBack = React.useRef(false);
  
  // Memoized computed values
  const displayedSundays = useMemo(() => {
    return getSundaysOfMonth(displayedDate.getFullYear(), displayedDate.getMonth());
  }, [displayedDate]);
  

  
  // Initialize Firebase listeners and check for migration
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoading(true);
        
        // Check if migration is needed
        const hasMigrationData = dataMigrationService.hasLocalStorageData();
        setNeedsMigration(hasMigrationData);
        
        // Listen to auth state changes
        const unsubscribeAuth = authService.onAuthStateChanged(async (user) => {
          setUser(user);
          if (user) {
            // User is authenticated, load profile first
            try {
              const profile = await userService.getUserProfile(user.uid);
              setUserProfile(profile);

              // Check if Firebase is ready (has church context) and set up data listeners
              if (firebaseUtils.isReady()) {
                setupDataListeners();
              } else {
                console.log('⏳ User authenticated but no church context yet. Waiting for church assignment...');
                // Clear data until church context is available
                setMembers([]);
                setBacentas([]);
                setAttendanceRecords([]);
                setNewBelievers([]);
              }
            } catch (error) {
              console.error('Failed to load user profile:', error);
              setUserProfile(null);
            }
          } else {
            // User not authenticated, clear data
            setUserProfile(null);
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
    // Generate unique ID using timestamp + random number to avoid duplicates
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Clear any existing toasts and show only the new one
    setToasts([{ id, type, title, message }]);

    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  }, []);
  
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Confirmation modal functions
  const showConfirmation = useCallback((type: 'deleteMember' | 'deleteBacenta' | 'deleteNewBeliever' | 'clearData' | 'clearSelectedData', data: any, onConfirm: () => void) => {
    setConfirmationModal({
      isOpen: true,
      type,
      data,
      onConfirm
    });
  }, []);

  const closeConfirmation = useCallback(() => {
    setConfirmationModal({
      isOpen: false,
      type: null,
      data: null,
      onConfirm: () => {}
    });
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

  const addMultipleNewBelieversHandler = useCallback(async (newBelieversData: Omit<NewBeliever, 'id' | 'createdDate' | 'lastUpdated'>[]) => {
    const successful: NewBeliever[] = [];
    const failed: { data: Omit<NewBeliever, 'id' | 'createdDate' | 'lastUpdated'>, error: string }[] = [];

    try {
      setIsLoading(true);

      for (const newBelieverData of newBelieversData) {
        try {
          const newBelieverId = await newBelieversFirebaseService.add(newBelieverData);
          successful.push({ ...newBelieverData, id: newBelieverId, createdDate: new Date().toISOString(), lastUpdated: new Date().toISOString() });
        } catch (error: any) {
          failed.push({ data: newBelieverData, error: error.message });
        }
      }

      if (successful.length > 0) {
        showToast('success', `${successful.length} new believers added successfully`);
      }
      if (failed.length > 0) {
        showToast('warning', `${failed.length} new believers failed to add`);
      }

      return { successful, failed };
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to add new believers', error.message);
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

      console.log('📝 Marking attendance:', recordId, status);
      await attendanceFirebaseService.addOrUpdate(record);
      showToast('success', 'Attendance marked successfully');
    } catch (error: any) {
      console.error('❌ Failed to mark attendance:', error);
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

  const clearAttendanceHandler = useCallback(async (memberId: string, date: string) => {
    try {
      const recordId = `${memberId}_${date}`;
      console.log('🗑️ Clearing attendance record:', recordId);
      await attendanceFirebaseService.delete(recordId);
      showToast('success', 'Attendance cleared successfully');
    } catch (error: any) {
      console.error('❌ Failed to clear attendance:', error);
      setError(error.message);
      showToast('error', 'Failed to clear attendance', error.message);
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

  const openHierarchyModal = useCallback((bacentaLeader: Member) => {
    setHierarchyBacentaLeader(bacentaLeader);
    setIsHierarchyModalOpen(true);
  }, []);

  const closeHierarchyModal = useCallback(() => {
    setHierarchyBacentaLeader(null);
    setIsHierarchyModalOpen(false);
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

  const refreshUserProfile = useCallback(async () => {
    try {
      if (user) {
        // Refresh both the auth context and user profile
        await authService.refreshCurrentUser();
        const profile = await userService.getUserProfile(user.uid);
        setUserProfile(profile);

        // After refreshing profile, check if we now have church context and can set up data listeners
        if (firebaseUtils.isReady() && members.length === 0 && bacentas.length === 0) {
          console.log('✅ Church context now available, setting up data listeners...');
          setupDataListeners();
        }
      }
    } catch (error: any) {
      console.error('Failed to refresh user profile:', error);
    }
  }, [user, members.length, bacentas.length]);

  // Effect to handle delayed church context availability for Google users
  useEffect(() => {
    if (user && userProfile && !firebaseUtils.isReady() && members.length === 0) {
      console.log('🔄 User has profile but no church context, attempting refresh...');

      // Single attempt to refresh user profile after a short delay
      const timeout = setTimeout(async () => {
        try {
          await refreshUserProfile();
        } catch (error) {
          console.error('Failed to refresh church context:', error);
        }
      }, 1000);

      return () => clearTimeout(timeout);
    }
  }, [user, userProfile, members.length, refreshUserProfile]);

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

    // Modal States
    isMemberFormOpen,
    editingMember,
    isBacentaFormOpen,
    editingBacenta,
    isBacentaDrawerOpen,
    isNewBelieverFormOpen,
    editingNewBeliever,
    isHierarchyModalOpen,
    hierarchyBacentaLeader,

    // Confirmation Modal
    confirmationModal,
    showConfirmation,
    closeConfirmation,

    // Toasts
    toasts,

    // Firebase-specific
    user,
    userProfile,
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
    addMultipleNewBelieversHandler,
    updateNewBelieverHandler,
    deleteNewBelieverHandler,

    // Attendance Operations
    markAttendanceHandler,
    markNewBelieverAttendanceHandler,
    clearAttendanceHandler,

    // UI Handlers
    openMemberForm,
    closeMemberForm,
    openBacentaForm,
    closeBacentaForm,
    openBacentaDrawer,
    closeBacentaDrawer,
    openNewBelieverForm,
    closeNewBelieverForm,
    openHierarchyModal,
    closeHierarchyModal,

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
    toggleOfflineMode,
    refreshUserProfile
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
