
import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Member, AttendanceRecord, Bacenta, TabOption, AttendanceStatus, TabKeys } from '../types'; // Bacenta instead of CongregationGroup
import { MemberService, AttendanceService, BacentaService, initializeDataIfNeeded } from '../services/dataService'; // BacentaService
import { FIXED_TABS, CONSECUTIVE_ABSENCE_THRESHOLD, DEFAULT_TAB_ID } from '../constants'; // CONGREGATION_GROUPS removed
import { getSundaysOfMonth, formatDateToYYYYMMDD } from '../utils/dateUtils';
import {
  membersStorage,
  bacentasStorage,
  attendanceStorage,
  appStateStorage,
  backupStorage
} from '../utils/localStorage';

interface AppContextType {
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  bacentas: Bacenta[]; // Renamed from congregations
  currentTab: TabOption;
  isLoading: boolean;
  error: string | null;
  displayedSundays: string[]; // Renamed from sundaysThisMonth
  displayedDate: Date; // For month navigation
  criticalMemberIds: string[];
  isMemberFormOpen: boolean;
  editingMember: Member | null;
  isBacentaFormOpen: boolean; // New state for Bacenta form
  editingBacenta: Bacenta | null; // New state for Bacenta form
  isBacentaDrawerOpen: boolean; // New state for Bacenta drawer
  confirmationModal: {
    isOpen: boolean;
    type: 'deleteMember' | 'deleteBacenta' | 'clearData' | null;
    data: any;
    onConfirm: () => void;
  };
  toasts: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
  }>;
  fetchInitialData: () => Promise<void>;
  addMemberHandler: (memberData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>) => Promise<void>;
  updateMemberHandler: (memberData: Member) => Promise<void>;
  deleteMemberHandler: (memberId: string) => Promise<void>;
  markAttendanceHandler: (memberId: string, date: string, status: AttendanceStatus) => Promise<void>;
  changeTab: (tabId: string) => void;
  openMemberForm: (member: Member | null) => void;
  closeMemberForm: () => void;
  refreshData: () => Promise<void>;
  addBacentaHandler: (name: string) => Promise<Bacenta | null>; // New handler
  updateBacentaHandler: (bacenta: Bacenta) => Promise<void>; // New handler
  deleteBacentaHandler: (bacentaId: string) => Promise<void>; // New handler
  openBacentaForm: (bacenta: Bacenta | null) => void; // New function
  closeBacentaForm: () => void; // New function
  openBacentaDrawer: () => void; // New function for Bacenta drawer
  closeBacentaDrawer: () => void; // New function for Bacenta drawer
  navigateToPreviousMonth: () => void; // For month navigation
  navigateToNextMonth: () => void; // For month navigation
  exportData: () => string; // Export all data as JSON
  importData: (jsonData: string) => Promise<boolean>; // Import data from JSON
  getStorageInfo: () => { used: number; available: number; percentage: number };
  showConfirmation: (type: 'deleteMember' | 'deleteBacenta' | 'clearData', data: any, onConfirm: () => void) => void;
  hideConfirmation: () => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize state from localStorage
  const [members, setMembers] = useState<Member[]>(() => membersStorage.load());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => attendanceStorage.load());
  const [bacentas, setBacentas] = useState<Bacenta[]>(() => bacentasStorage.load());
  const [currentTab, setCurrentTab] = useState<TabOption>(() => {
    const savedTab = appStateStorage.loadCurrentTab();
    return savedTab || FIXED_TABS.find(t => t.id === DEFAULT_TAB_ID) || FIXED_TABS[0];
  });
  const [isLoading, setIsLoading] = useState<boolean>(false); // Start as false since we load from localStorage
  const [error, setError] = useState<string | null>(null);

  const [displayedDate, setDisplayedDate] = useState<Date>(() => appStateStorage.loadDisplayedDate());
  const [displayedSundays, setDisplayedSundays] = useState<string[]>([]);
  const [criticalMemberIds, setCriticalMemberIds] = useState<string[]>([]);
  
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const [isBacentaFormOpen, setIsBacentaFormOpen] = useState(false);
  const [editingBacenta, setEditingBacenta] = useState<Bacenta | null>(null);
  const [isBacentaDrawerOpen, setIsBacentaDrawerOpen] = useState(false);

  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    type: 'deleteMember' | 'deleteBacenta' | 'clearData' | null;
    data: any;
    onConfirm: () => void;
  }>({
    isOpen: false,
    type: null,
    data: null,
    onConfirm: () => {}
  });

  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
  }>>([]);


  const calculateCriticalMembers = useCallback((mems: Member[], attRecs: AttendanceRecord[], sundays: string[]) => {
    if (!sundays.length) return [];
    
    const criticalIds: string[] = [];
    const sortedSundays = [...sundays].sort((a,b) => new Date(a).getTime() - new Date(b).getTime());

    mems.forEach(member => {
      let consecutiveAbsences = 0;
      let maxConsecutiveAbsences = 0;
      
      // Check from the most recent Sunday in the displayedSundays list
      for (const sundayDate of sortedSundays.slice().reverse()) {
        const record = attRecs.find(ar => ar.memberId === member.id && ar.date === sundayDate);
        if (record && record.status === 'Absent') {
          consecutiveAbsences++;
        } else if (record && record.status === 'Present') {
          break; // Streak broken by presence
        } else {
           // No record for this Sunday, can't determine absence for sure for the streak from this point
           // For simplicity, we'll consider no record as breaking the *consecutive* absence streak for *this specific calculation*
           // A more robust system might require records for all Sundays or handle this differently.
           break; 
        }
        if (consecutiveAbsences >= CONSECUTIVE_ABSENCE_THRESHOLD) {
          maxConsecutiveAbsences = consecutiveAbsences;
          break;
        }
      }

      if (maxConsecutiveAbsences >= CONSECUTIVE_ABSENCE_THRESHOLD) {
        criticalIds.push(member.id);
      }
    });
    return criticalIds;
  }, []);

  const loadData = useCallback(async (targetDate: Date = displayedDate) => {
    setIsLoading(true);
    setError(null);
    try {
      await initializeDataIfNeeded();
      const [fetchedMembers, fetchedAttendance, fetchedBacentas] = await Promise.all([
        MemberService.getMembers(),
        AttendanceService.getAttendance(),
        BacentaService.getBacentas(),
      ]);
      setMembers(fetchedMembers);
      setAttendanceRecords(fetchedAttendance);
      setBacentas(fetchedBacentas);

      const sundays = getSundaysOfMonth(targetDate.getFullYear(), targetDate.getMonth());
      setDisplayedSundays(sundays);
      
      const criticalIds = calculateCriticalMembers(fetchedMembers, fetchedAttendance, sundays);
      setCriticalMemberIds(criticalIds);

    } catch (e) {
      console.error("Failed to load data:", e);
      setError("Failed to load data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [calculateCriticalMembers, displayedDate]); // Add displayedDate to dependency if it's used to determine targetDate

  const fetchInitialData = () => loadData(new Date()); // Load current month initially
  const refreshData = () => loadData(displayedDate); // Refresh based on currently displayed date


  useEffect(() => {
    // This effect recalculates sundays and critical members when displayedDate changes
    const sundays = getSundaysOfMonth(displayedDate.getFullYear(), displayedDate.getMonth());
    setDisplayedSundays(sundays);
    const criticalIds = calculateCriticalMembers(members, attendanceRecords, sundays);
    setCriticalMemberIds(criticalIds);
  }, [displayedDate, members, attendanceRecords, calculateCriticalMembers]);


  const addMemberHandler = async (memberData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>) => {
    setIsLoading(true);
    try {
      const newMember = await MemberService.addMember(memberData);
      const updatedMembers = [...members, newMember];
      setMembers(updatedMembers);
      membersStorage.save(updatedMembers); // Save to localStorage

      // Show success toast
      const bacentaName = memberData.bacentaId ? bacentas.find(b => b.id === memberData.bacentaId)?.name : null;
      const message = bacentaName
        ? `${newMember.name} has been added to ${bacentaName}!`
        : `${newMember.name} has been added successfully!`;
      showToast('success', 'Member Added!', message);
    } catch (e) {
      setError("Failed to add member.");
      showToast('error', 'Failed to Add Member', 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateMemberHandler = async (memberData: Member) => {
    setIsLoading(true);
    try {
      const updatedMember = await MemberService.updateMember(memberData);
      const updatedMembers = members.map(m => m.id === updatedMember.id ? updatedMember : m);
      setMembers(updatedMembers);
      membersStorage.save(updatedMembers); // Save to localStorage
    } catch (e) {
      setError("Failed to update member.");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMemberHandler = async (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    showConfirmation('deleteMember', { member }, async () => {
      setIsLoading(true);
      try {
        await MemberService.deleteMember(memberId);
        const updatedMembers = members.filter(m => m.id !== memberId);
        const updatedAttendance = attendanceRecords.filter(ar => ar.memberId !== memberId);
        setMembers(updatedMembers);
        setAttendanceRecords(updatedAttendance);
        membersStorage.save(updatedMembers); // Save to localStorage
        attendanceStorage.save(updatedAttendance); // Save to localStorage
      } catch (e) {
        setError("Failed to delete member.");
      } finally {
        setIsLoading(false);
      }
    });
  };

  const markAttendanceHandler = async (memberId: string, date: string, status: AttendanceStatus) => {
    try {
      const updatedRecord = await AttendanceService.markAttendance(memberId, date, status);
      const updatedRecords = (() => {
        const existingIndex = attendanceRecords.findIndex(ar => ar.id === updatedRecord.id);
        if (existingIndex > -1) {
          const newRecords = [...attendanceRecords];
          newRecords[existingIndex] = updatedRecord;
          return newRecords;
        }
        return [...attendanceRecords, updatedRecord];
      })();
      setAttendanceRecords(updatedRecords);
      attendanceStorage.save(updatedRecords); // Save to localStorage
      // Critical members will be recalculated by the useEffect due to attendanceRecords change
    } catch (e) {
      setError("Failed to mark attendance.");
    }
  };

  const changeTab = (tabId: string) => {
    const allTabs = [...FIXED_TABS, ...bacentas.map(b => ({ id: b.id, name: b.name }))];
    const newTab = allTabs.find(t => t.id === tabId) || FIXED_TABS[0];
    setCurrentTab(newTab);
    appStateStorage.saveCurrentTab(newTab); // Save to localStorage
  };
  
  const openMemberForm = (member: Member | null) => {
    setEditingMember(member);
    setIsMemberFormOpen(true);
  };

  const closeMemberForm = () => {
    setEditingMember(null);
    setIsMemberFormOpen(false);
  };

  // Bacenta Handlers
  const addBacentaHandler = async (name: string): Promise<Bacenta | null> => {
    setIsLoading(true);
    try {
      const newBacenta = await BacentaService.addBacenta(name);
      const updatedBacentas = [...bacentas, newBacenta];
      setBacentas(updatedBacentas);
      bacentasStorage.save(updatedBacentas); // Save to localStorage

      // Automatically navigate to the new bacenta
      const newTab = { id: newBacenta.id, name: newBacenta.name };
      setCurrentTab(newTab);
      appStateStorage.saveCurrentTab(newTab);

      // Show success toast
      showToast('success', 'Bacenta Created!', `Welcome to "${name}"! You can now start adding members to this Bacenta.`);

      return newBacenta;
    } catch (e) {
      setError("Failed to add Bacenta.");
      showToast('error', 'Failed to Create Bacenta', 'Please try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const updateBacentaHandler = async (bacentaData: Bacenta) => {
    setIsLoading(true);
    try {
      const updatedBacenta = await BacentaService.updateBacenta(bacentaData);
      const updatedBacentas = bacentas.map(b => b.id === updatedBacenta.id ? updatedBacenta : b);
      setBacentas(updatedBacentas);
      bacentasStorage.save(updatedBacentas); // Save to localStorage
    } catch (e) {
      setError("Failed to update Bacenta.");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteBacentaHandler = async (bacentaId: string) => {
    const bacenta = bacentas.find(b => b.id === bacentaId);
    if (!bacenta) return;

    const memberCount = members.filter(m => m.bacentaId === bacentaId).length;

    showConfirmation('deleteBacenta', { bacenta, memberCount }, async () => {
      setIsLoading(true);
      try {
        await BacentaService.deleteBacenta(bacentaId);
        const updatedBacentas = bacentas.filter(b => b.id !== bacentaId);
        const updatedMembers = members.map(m =>
          m.bacentaId === bacentaId ? { ...m, bacentaId: '', lastUpdated: new Date().toISOString() } : m
        );
        setBacentas(updatedBacentas);
        setMembers(updatedMembers);
        bacentasStorage.save(updatedBacentas); // Save to localStorage
        membersStorage.save(updatedMembers); // Save to localStorage
        if (currentTab.id === bacentaId) {
          changeTab(TabKeys.ALL_CONGREGATIONS);
        }
      } catch (e) {
        setError("Failed to delete Bacenta.");
      } finally {
        setIsLoading(false);
      }
    });
  };

  const openBacentaForm = (bacenta: Bacenta | null) => {
    setEditingBacenta(bacenta);
    setIsBacentaFormOpen(true);
  };

  const closeBacentaForm = () => {
    setEditingBacenta(null);
    setIsBacentaFormOpen(false);
  };

  // Bacenta Drawer Handlers
  const openBacentaDrawer = () => {
    setIsBacentaDrawerOpen(true);
  };

  const closeBacentaDrawer = () => {
    setIsBacentaDrawerOpen(false);
  };

  // Month Navigation Handlers
  const navigateToPreviousMonth = () => {
    setDisplayedDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setMonth(newDate.getMonth() - 1);
      appStateStorage.saveDisplayedDate(newDate); // Save to localStorage
      return newDate;
    });
  };

  const navigateToNextMonth = () => {
    setDisplayedDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setMonth(newDate.getMonth() + 1);
      appStateStorage.saveDisplayedDate(newDate); // Save to localStorage
      return newDate;
    });
  };

  // Backup and Restore Functions
  const exportData = (): string => {
    return backupStorage.export();
  };

  const importData = async (jsonData: string): Promise<boolean> => {
    try {
      const success = backupStorage.import(jsonData);
      if (success) {
        // Reload data from localStorage after import
        const importedMembers = membersStorage.load();
        const importedBacentas = bacentasStorage.load();
        const importedAttendance = attendanceStorage.load();
        const importedTab = appStateStorage.loadCurrentTab();
        const importedDate = appStateStorage.loadDisplayedDate();

        setMembers(importedMembers);
        setBacentas(importedBacentas);
        setAttendanceRecords(importedAttendance);
        if (importedTab) setCurrentTab(importedTab);
        setDisplayedDate(importedDate);

        // Recalculate derived data
        const sundays = getSundaysOfMonth(importedDate.getFullYear(), importedDate.getMonth());
        setDisplayedSundays(sundays);
        const criticalIds = calculateCriticalMembers(importedMembers, importedAttendance, sundays);
        setCriticalMemberIds(criticalIds);

        return true;
      }
      return false;
    } catch (error) {
      console.error('Import failed:', error);
      setError('Failed to import data. Please check the file format.');
      return false;
    }
  };

  const getStorageInfo = () => {
    return {
      used: 0, // Will be calculated by the storage utility
      available: 5 * 1024 * 1024, // 5MB typical localStorage limit
      percentage: 0
    };
  };

  // Confirmation Modal Functions
  const showConfirmation = (type: 'deleteMember' | 'deleteBacenta' | 'clearData', data: any, onConfirm: () => void) => {
    setConfirmationModal({
      isOpen: true,
      type,
      data,
      onConfirm
    });
  };

  const hideConfirmation = () => {
    setConfirmationModal({
      isOpen: false,
      type: null,
      data: null,
      onConfirm: () => {}
    });
  };

  // Toast Functions
  const showToast = (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => {
    const id = Date.now().toString();
    const newToast = { id, type, title, message };
    setToasts(prev => [...prev, newToast]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  };

  return (
    <AppContext.Provider value={{
      members, attendanceRecords, bacentas, currentTab, isLoading, error,
      displayedSundays, displayedDate, criticalMemberIds,
      isMemberFormOpen, editingMember, isBacentaFormOpen, editingBacenta, isBacentaDrawerOpen,
      confirmationModal, toasts,
      fetchInitialData, addMemberHandler, updateMemberHandler, deleteMemberHandler, markAttendanceHandler, changeTab,
      openMemberForm, closeMemberForm, refreshData,
      addBacentaHandler, updateBacentaHandler, deleteBacentaHandler, openBacentaForm, closeBacentaForm,
      openBacentaDrawer, closeBacentaDrawer,
      navigateToPreviousMonth, navigateToNextMonth,
      exportData, importData, getStorageInfo, showConfirmation, hideConfirmation, showToast
    }}>
      {children}
    </AppContext.Provider>
  );
};

export default AppContext;
