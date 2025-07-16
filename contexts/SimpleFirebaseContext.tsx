// Simple Firebase Context without Authentication
import React, { createContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { Member, AttendanceRecord, Bacenta, TabOption, AttendanceStatus, TabKeys, NavigationHistoryItem, NewBeliever } from '../types';
import { FIXED_TABS, DEFAULT_TAB_ID } from '../constants';
import { getSundaysOfMonth, formatDateToYYYYMMDD } from '../utils/dateUtils';

// Simple Firebase services without authentication
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase.config';

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
  
  // Confirmation Modal
  confirmationModal: {
    isOpen: boolean;
    type: 'deleteMember' | 'deleteBacenta' | 'deleteNewBeliever' | 'clearData' | 'clearSelectedData' | null;
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
  clearAttendanceHandler: (memberId: string, date: string) => Promise<void>;
  markNewBelieverAttendanceHandler: (newBelieverId: string, date: string, status: AttendanceStatus) => Promise<void>;
  clearNewBelieverAttendanceHandler: (newBelieverId: string, date: string) => Promise<void>;
  
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
  switchTab: (tabId: string) => void;
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
  showConfirmation: (type: 'deleteMember' | 'deleteBacenta' | 'deleteNewBeliever' | 'clearData' | 'clearSelectedData', data: any, onConfirm: () => void) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const SimpleFirebaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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
  
  // Navigation state
  const [navigationHistory, setNavigationHistory] = useState<NavigationHistoryItem[]>([]);
  const isNavigatingBack = React.useRef(false);
  
  // Memoized computed values
  const displayedSundays = useMemo(() => {
    return getSundaysOfMonth(displayedDate.getFullYear(), displayedDate.getMonth());
  }, [displayedDate]);
  

  
  // Initialize Firebase listeners
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoading(true);
        console.log('🔥 Initializing Firebase without authentication...');
        
        // Set up real-time listeners for all collections
        const unsubscribers: (() => void)[] = [];
        
        // Listen to members
        const membersQuery = query(collection(db, 'members'), orderBy('lastName'));
        const unsubscribeMembers = onSnapshot(membersQuery, (snapshot) => {
          const membersData = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          })) as Member[];
          setMembers(membersData);
          console.log('📊 Members updated:', membersData.length);
        });
        unsubscribers.push(unsubscribeMembers);
        
        // Listen to bacentas
        const bacentasQuery = query(collection(db, 'bacentas'), orderBy('name'));
        const unsubscribeBacentas = onSnapshot(bacentasQuery, (snapshot) => {
          const bacentasData = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          })) as Bacenta[];
          setBacentas(bacentasData);
          console.log('🏠 Bacentas updated:', bacentasData.length);
        });
        unsubscribers.push(unsubscribeBacentas);
        
        // Listen to new believers
        const newBelieversQuery = query(collection(db, 'newBelievers'), orderBy('joinedDate', 'desc'));
        const unsubscribeNewBelievers = onSnapshot(newBelieversQuery, (snapshot) => {
          const newBelieversData = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          })) as NewBeliever[];
          setNewBelievers(newBelieversData);
          console.log('✨ New Believers updated:', newBelieversData.length);
        });
        unsubscribers.push(unsubscribeNewBelievers);
        
        // Listen to attendance
        const attendanceQuery = query(collection(db, 'attendance'), orderBy('date', 'desc'));
        const unsubscribeAttendance = onSnapshot(attendanceQuery, (snapshot) => {
          const attendanceData = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          })) as AttendanceRecord[];
          setAttendanceRecords(attendanceData);
          console.log('📅 Attendance updated:', attendanceData.length);
        });
        unsubscribers.push(unsubscribeAttendance);
        
        setIsLoading(false);
        // Removed Firebase connection success toast - connection should be silent
        
        // Cleanup function
        return () => {
          unsubscribers.forEach(unsubscribe => unsubscribe());
        };
      } catch (error: any) {
        setError(error.message);
        setIsLoading(false);
        showToast('error', 'Failed to connect to Firebase', error.message);
        console.error('❌ Firebase initialization failed:', error);
      }
    };
    
    initializeApp();
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

  // Confirmation modal functions
  const showConfirmation = useCallback((type: 'deleteMember' | 'deleteBacenta' | 'deleteNewBeliever' | 'clearData' | 'clearSelectedData', data: any, onConfirm: () => void) => {
    setConfirmationModal({
      isOpen: true,
      type,
      data,
      onConfirm
    });
  }, []);

  // Fetch initial data (for manual refresh)
  const fetchInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [membersSnapshot, bacentasSnapshot, attendanceSnapshot, newBelieversSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'members'), orderBy('lastName'))),
        getDocs(query(collection(db, 'bacentas'), orderBy('name'))),
        getDocs(query(collection(db, 'attendance'), orderBy('date', 'desc'))),
        getDocs(query(collection(db, 'newBelievers'), orderBy('joinedDate', 'desc')))
      ]);

      setMembers(membersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Member[]);
      setBacentas(bacentasSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Bacenta[]);
      setAttendanceRecords(attendanceSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as AttendanceRecord[]);
      setNewBelievers(newBelieversSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as NewBeliever[]);


    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to fetch data', error.message);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Member handlers
  const addMemberHandler = useCallback(async (memberData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>) => {
    try {
      const docRef = await addDoc(collection(db, 'members'), {
        ...memberData,
        role: memberData.role || 'Member', // Ensure role is set, defaulting to Member
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
      showToast('success', 'Member added successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to add member', error.message);
      throw error;
    }
  }, [showToast]);

  const addMultipleMembersHandler = useCallback(async (membersData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>[]) => {
    const successful: Member[] = [];
    const failed: { data: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>, error: string }[] = [];

    try {
      const batch = writeBatch(db);
      const membersRef = collection(db, 'members');

      membersData.forEach((memberData) => {
        const docRef = doc(membersRef);
        batch.set(docRef, {
          ...memberData,
          role: memberData.role || 'Member', // Ensure role is set, defaulting to Member
          createdDate: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        });
        successful.push({ ...memberData, role: memberData.role || 'Member', id: docRef.id, createdDate: new Date().toISOString(), lastUpdated: new Date().toISOString() });
      });

      await batch.commit();

      if (successful.length > 0) {
        showToast('success', `${successful.length} members added successfully`);
      }

      return { successful, failed };
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to add members', error.message);
      throw error;
    }
  }, [showToast]);

  const updateMemberHandler = useCallback(async (memberData: Member) => {
    try {
      await updateDoc(doc(db, 'members', memberData.id), {
        ...memberData,
        lastUpdated: new Date().toISOString()
      });
      showToast('success', 'Member updated successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to update member', error.message);
      throw error;
    }
  }, [showToast]);

  const deleteMemberHandler = useCallback(async (memberId: string) => {
    try {
      await deleteDoc(doc(db, 'members', memberId));
      showToast('success', 'Member deleted successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to delete member', error.message);
      throw error;
    }
  }, [showToast]);

  // Bacenta handlers
  const addBacentaHandler = useCallback(async (bacentaData: Omit<Bacenta, 'id'>) => {
    try {
      await addDoc(collection(db, 'bacentas'), {
        ...bacentaData,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
      showToast('success', 'Bacenta added successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to add bacenta', error.message);
      throw error;
    }
  }, [showToast]);

  const updateBacentaHandler = useCallback(async (bacentaData: Bacenta) => {
    try {
      await updateDoc(doc(db, 'bacentas', bacentaData.id), {
        ...bacentaData,
        lastUpdated: new Date().toISOString()
      });
      showToast('success', 'Bacenta updated successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to update bacenta', error.message);
      throw error;
    }
  }, [showToast]);

  const deleteBacentaHandler = useCallback(async (bacentaId: string) => {
    try {
      await deleteDoc(doc(db, 'bacentas', bacentaId));
      showToast('success', 'Bacenta deleted successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to delete bacenta', error.message);
      throw error;
    }
  }, [showToast]);

  // New Believer handlers
  const addNewBelieverHandler = useCallback(async (newBelieverData: Omit<NewBeliever, 'id' | 'createdDate' | 'lastUpdated'>) => {
    try {
      await addDoc(collection(db, 'newBelievers'), {
        ...newBelieverData,
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
      showToast('success', 'New believer added successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to add new believer', error.message);
      throw error;
    }
  }, [showToast]);

  const updateNewBelieverHandler = useCallback(async (newBelieverData: NewBeliever) => {
    try {
      await updateDoc(doc(db, 'newBelievers', newBelieverData.id), {
        ...newBelieverData,
        lastUpdated: new Date().toISOString()
      });
      showToast('success', 'New believer updated successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to update new believer', error.message);
      throw error;
    }
  }, [showToast]);

  const deleteNewBelieverHandler = useCallback(async (newBelieverId: string) => {
    try {
      await deleteDoc(doc(db, 'newBelievers', newBelieverId));
      showToast('success', 'New believer deleted successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to delete new believer', error.message);
      throw error;
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

      // Use setDoc with specific document ID instead of addDoc
      const docRef = doc(db, 'attendance', recordId);
      await setDoc(docRef, record, { merge: true });
      console.log('✅ Attendance marked:', recordId, status);
      showToast('success', 'Attendance marked successfully');
    } catch (error: any) {
      console.error('❌ Mark attendance error:', error);
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

      // Use setDoc with specific document ID instead of addDoc
      const docRef = doc(db, 'attendance', recordId);
      await setDoc(docRef, record, { merge: true });
      console.log('✅ New believer attendance marked:', recordId, status);
      showToast('success', 'New believer attendance marked successfully');
    } catch (error: any) {
      console.error('❌ Mark new believer attendance error:', error);
      setError(error.message);
      showToast('error', 'Failed to mark new believer attendance', error.message);
      throw error;
    }
  }, [showToast]);

  const clearAttendanceHandler = useCallback(async (memberId: string, date: string) => {
    try {
      const recordId = `${memberId}_${date}`;
      const docRef = doc(db, 'attendance', recordId);
      await deleteDoc(docRef);
      console.log('✅ Attendance cleared:', recordId);
      showToast('success', 'Attendance cleared successfully');
    } catch (error: any) {
      console.error('❌ Clear attendance error:', error);
      setError(error.message);
      showToast('error', 'Failed to clear attendance', error.message);
      throw error;
    }
  }, [showToast]);

  const clearNewBelieverAttendanceHandler = useCallback(async (newBelieverId: string, date: string) => {
    try {
      const recordId = `${newBelieverId}_${date}`;
      const docRef = doc(db, 'attendance', recordId);
      await deleteDoc(docRef);
      console.log('✅ New believer attendance cleared:', recordId);
      showToast('success', 'New believer attendance cleared successfully');
    } catch (error: any) {
      console.error('❌ Clear new believer attendance error:', error);
      setError(error.message);
      showToast('error', 'Failed to clear new believer attendance', error.message);
      throw error;
    }
  }, [showToast]);

  // UI handlers (same as before)
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
  const switchTab = useCallback((tabId: string) => {
    const allTabs = [...FIXED_TABS, ...bacentas.map(b => ({ id: b.id, name: b.name }))];
    const newTab = allTabs.find(t => t.id === tabId) || FIXED_TABS[0];

    if (!isNavigatingBack.current) {
      setNavigationHistory(prev => [
        ...prev.slice(-9),
        { tabId: currentTab.id, timestamp: Date.now(), data: undefined }
      ]);
    }
    isNavigatingBack.current = false;
    setCurrentTab(newTab);
  }, [currentTab, bacentas]);

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
      ...prev.slice(-9),
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

  // Data export/import
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
      showToast('info', 'Import not supported in Firebase mode', 'Use the migration tools instead');
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

    // Confirmation Modal
    confirmationModal,

    // Toasts
    toasts,

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
    clearAttendanceHandler,
    clearNewBelieverAttendanceHandler,

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
    showConfirmation
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
    throw new Error('useAppContext must be used within a SimpleFirebaseProvider');
  }
  return context;
};

export default AppContext;
