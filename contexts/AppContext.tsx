
import React, { createContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { Member, AttendanceRecord, Bacenta, TabOption, AttendanceStatus, TabKeys, NavigationHistoryItem, NewBeliever } from '../types'; // Bacenta instead of CongregationGroup
import { MemberService, AttendanceService, BacentaService, NewBelieverService, initializeDataIfNeeded } from '../services/dataService'; // BacentaService
import { FIXED_TABS, CONSECUTIVE_ABSENCE_THRESHOLD, DEFAULT_TAB_ID } from '../constants'; // CONGREGATION_GROUPS removed
import { getSundaysOfMonth, formatDateToYYYYMMDD } from '../utils/dateUtils';
import {
  membersStorage,
  bacentasStorage,
  attendanceStorage,
  newBelieversStorage,
  appStateStorage,
  backupStorage
} from '../utils/localStorage';

interface AppContextType {
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  bacentas: Bacenta[]; // Renamed from congregations
  newBelievers: NewBeliever[];
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
  isNewBelieverFormOpen: boolean; // New state for New Believer form
  editingNewBeliever: NewBeliever | null; // New state for New Believer form
  confirmationModal: {
    isOpen: boolean;
    type: 'deleteMember' | 'deleteBacenta' | 'deleteNewBeliever' | 'clearData' | null;
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
  addMultipleMembersHandler: (membersData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>[]) => Promise<{ successful: Member[], failed: { data: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>, error: string }[] }>;
  updateMemberHandler: (memberData: Member) => Promise<void>;
  deleteMemberHandler: (memberId: string) => Promise<void>;
  markAttendanceHandler: (memberId: string, date: string, status: AttendanceStatus) => Promise<void>;
  markNewBelieverAttendanceHandler: (newBelieverId: string, date: string, status: AttendanceStatus) => Promise<void>;
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
  addNewBelieverHandler: (newBelieverData: Omit<NewBeliever, 'id' | 'createdDate' | 'lastUpdated'>) => Promise<void>; // New handler
  updateNewBelieverHandler: (newBeliever: NewBeliever) => Promise<void>; // New handler
  deleteNewBelieverHandler: (newBelieverId: string) => Promise<void>; // New handler
  openNewBelieverForm: (newBeliever: NewBeliever | null) => void; // New function
  closeNewBelieverForm: () => void; // New function
  navigateToPreviousMonth: () => void; // For month navigation
  navigateToNextMonth: () => void; // For month navigation
  exportData: () => string; // Export all data as JSON
  importData: (jsonData: string) => Promise<boolean>; // Import data from JSON
  getStorageInfo: () => { used: number; available: number; percentage: number };
  showConfirmation: (type: 'deleteMember' | 'deleteBacenta' | 'deleteNewBeliever' | 'clearData', data: any, onConfirm: () => void) => void;
  hideConfirmation: () => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
  // Navigation functions
  navigationHistory: NavigationHistoryItem[];
  navigateBack: () => boolean;
  canNavigateBack: () => boolean;
  addToNavigationHistory: (tabId: string, data?: any) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize state from localStorage
  const [members, setMembers] = useState<Member[]>(() => membersStorage.load());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => attendanceStorage.load());
  const [bacentas, setBacentas] = useState<Bacenta[]>(() => bacentasStorage.load());
  const [newBelievers, setNewBelievers] = useState<NewBeliever[]>(() => newBelieversStorage.load());
  const [currentTab, setCurrentTab] = useState<TabOption>(() => {
    const savedTab = appStateStorage.loadCurrentTab();
    return savedTab || FIXED_TABS.find(t => t.id === DEFAULT_TAB_ID) || FIXED_TABS[0];
  });
  const [isLoading, setIsLoading] = useState<boolean>(false); // Start as false since we load from localStorage
  const [error, setError] = useState<string | null>(null);

  const [displayedDate, setDisplayedDate] = useState<Date>(() => appStateStorage.loadDisplayedDate());

  // Memoize displayed sundays calculation
  const displayedSundays = useMemo(() => {
    return getSundaysOfMonth(displayedDate.getFullYear(), displayedDate.getMonth());
  }, [displayedDate]);
  
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const [isBacentaFormOpen, setIsBacentaFormOpen] = useState(false);
  const [editingBacenta, setEditingBacenta] = useState<Bacenta | null>(null);
  const [isBacentaDrawerOpen, setIsBacentaDrawerOpen] = useState(false);

  const [isNewBelieverFormOpen, setIsNewBelieverFormOpen] = useState(false);
  const [editingNewBeliever, setEditingNewBeliever] = useState<NewBeliever | null>(null);

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

  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
  }>>([]);

  // Navigation state
  const [navigationHistory, setNavigationHistory] = useState<NavigationHistoryItem[]>([]);
  const isNavigatingBack = React.useRef(false);


  // Memoize critical members calculation for performance
  const criticalMemberIds = useMemo(() => {
    if (!displayedSundays.length || !members.length) return [];

    const criticalIds: string[] = [];
    const sortedSundays = [...displayedSundays].sort((a,b) => new Date(a).getTime() - new Date(b).getTime());

    members.forEach(member => {
      let consecutiveAbsences = 0;
      let maxConsecutiveAbsences = 0;

      // Check from the most recent Sunday in the displayedSundays list
      for (const sundayDate of sortedSundays.slice().reverse()) {
        const record = attendanceRecords.find(ar => ar.memberId === member.id && ar.date === sundayDate);
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
  }, [members, attendanceRecords, displayedSundays]);

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

    } catch (e) {
      console.error("Failed to load data:", e);
      setError("Failed to load data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [displayedDate]);

  const fetchInitialData = useCallback(() => loadData(new Date()), [loadData]); // Load current month initially
  const refreshData = useCallback(() => loadData(displayedDate), [loadData, displayedDate]); // Refresh based on currently displayed date

  // Track tab changes for navigation history
  useEffect(() => {
    if (currentTab.id && !isNavigatingBack.current) {
      // Don't add duplicate consecutive entries
      const lastEntry = navigationHistory[navigationHistory.length - 1];
      if (!lastEntry || lastEntry.tabId !== currentTab.id) {
        const newItem: NavigationHistoryItem = {
          tabId: currentTab.id,
          timestamp: Date.now()
        };
        setNavigationHistory(prev => {
          const newHistory = [...prev, newItem];
          // Keep history size manageable
          return newHistory.length > 10 ? newHistory.slice(-10) : newHistory;
        });
      }
    }
  }, [currentTab.id]); // Removed navigationHistory dependency to prevent infinite loop


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
        ? `${newMember.firstName} ${newMember.lastName} has been added to ${bacentaName}!`
        : `${newMember.firstName} ${newMember.lastName} has been added successfully!`;
      showToast('success', 'Member Added!', message);
    } catch (e) {
      setError("Failed to add member.");
      showToast('error', 'Failed to Add Member', 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const addMultipleMembersHandler = async (membersData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>[]) => {
    setIsLoading(true);
    try {
      const result = await MemberService.addMultipleMembers(membersData);

      if (result.successful.length > 0) {
        const updatedMembers = [...members, ...result.successful];
        setMembers(updatedMembers);
        membersStorage.save(updatedMembers);

        // Show success toast
        const bacentaName = membersData[0]?.bacentaId ? bacentas.find(b => b.id === membersData[0].bacentaId)?.name : null;
        const message = bacentaName
          ? `${result.successful.length} member${result.successful.length !== 1 ? 's' : ''} added to ${bacentaName}!`
          : `${result.successful.length} member${result.successful.length !== 1 ? 's' : ''} added successfully!`;

        if (result.failed.length > 0) {
          showToast('warning', 'Partially Complete', `${result.successful.length} added, ${result.failed.length} failed.`);
        } else {
          showToast('success', 'Members Added!', message);
        }
      }

      return result;
    } catch (e) {
      setError("Failed to add members.");
      showToast('error', 'Failed to Add Members', 'Please try again.');
      return { successful: [], failed: membersData.map(data => ({ data, error: 'Unknown error' })) };
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

  const markNewBelieverAttendanceHandler = async (newBelieverId: string, date: string, status: AttendanceStatus) => {
    try {
      const updatedRecord = await AttendanceService.markNewBelieverAttendance(newBelieverId, date, status);
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
    } catch (e) {
      setError("Failed to mark new believer attendance.");
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

  // New Believer Handlers
  const addNewBelieverHandler = async (newBelieverData: Omit<NewBeliever, 'id' | 'createdDate' | 'lastUpdated'>) => {
    setIsLoading(true);
    try {
      const newBeliever = await NewBelieverService.addNewBeliever(newBelieverData);
      const updatedNewBelievers = [...newBelievers, newBeliever];
      setNewBelievers(updatedNewBelievers);
      newBelieversStorage.save(updatedNewBelievers); // Save to localStorage

      // Show success toast
      showToast('success', 'New Believer Added!', `${newBeliever.name} has been added successfully!`);
    } catch (e) {
      setError("Failed to add new believer.");
      showToast('error', 'Failed to Add New Believer', 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateNewBelieverHandler = async (newBelieverData: NewBeliever) => {
    setIsLoading(true);
    try {
      const updatedNewBeliever = await NewBelieverService.updateNewBeliever(newBelieverData);
      const updatedNewBelievers = newBelievers.map(nb => nb.id === updatedNewBeliever.id ? updatedNewBeliever : nb);
      setNewBelievers(updatedNewBelievers);
      newBelieversStorage.save(updatedNewBelievers); // Save to localStorage
      showToast('success', 'New Believer Updated!', `${updatedNewBeliever.name} has been updated successfully!`);
    } catch (e) {
      setError("Failed to update new believer.");
      showToast('error', 'Failed to Update New Believer', 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteNewBelieverHandler = async (newBelieverId: string) => {
    setIsLoading(true);
    try {
      await NewBelieverService.deleteNewBeliever(newBelieverId);
      const updatedNewBelievers = newBelievers.filter(nb => nb.id !== newBelieverId);
      setNewBelievers(updatedNewBelievers);
      newBelieversStorage.save(updatedNewBelievers); // Save to localStorage
      showToast('success', 'New Believer Deleted', 'The new believer has been removed successfully.');
    } catch (e) {
      setError("Failed to delete new believer.");
      showToast('error', 'Failed to Delete New Believer', 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const openNewBelieverForm = (newBeliever: NewBeliever | null) => {
    setEditingNewBeliever(newBeliever);
    setIsNewBelieverFormOpen(true);
  };

  const closeNewBelieverForm = () => {
    setEditingNewBeliever(null);
    setIsNewBelieverFormOpen(false);
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
        const importedNewBelievers = newBelieversStorage.load();
        const importedTab = appStateStorage.loadCurrentTab();
        const importedDate = appStateStorage.loadDisplayedDate();

        setMembers(importedMembers);
        setBacentas(importedBacentas);
        setAttendanceRecords(importedAttendance);
        setNewBelievers(importedNewBelievers);
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
  const showConfirmation = (type: 'deleteMember' | 'deleteBacenta' | 'deleteNewBeliever' | 'clearData', data: any, onConfirm: () => void) => {
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

  // Navigation Functions
  const addToNavigationHistory = useCallback((tabId: string, data?: any) => {
    // This function is now handled by useEffect to avoid circular dependencies
    // Keeping it for API compatibility
  }, []);

  const navigateBack = useCallback(() => {
    if (navigationHistory.length <= 1) {
      // If no history, go to dashboard if not already there
      if (currentTab.id !== TabKeys.DASHBOARD) {
        isNavigatingBack.current = true;
        changeTab(TabKeys.DASHBOARD);
        return true;
      }
      // If already on dashboard with no history, don't allow back navigation
      // This prevents the app from closing
      return false;
    }

    // Remove current item and go to previous
    const newHistory = [...navigationHistory];
    newHistory.pop();
    const previousItem = newHistory[newHistory.length - 1];

    if (previousItem) {
      isNavigatingBack.current = true;
      setNavigationHistory(newHistory);
      changeTab(previousItem.tabId);
      return true;
    }

    // Fallback to dashboard if no valid previous item
    if (currentTab.id !== TabKeys.DASHBOARD) {
      isNavigatingBack.current = true;
      changeTab(TabKeys.DASHBOARD);
      return true;
    }

    return false;
  }, [navigationHistory, changeTab, currentTab.id]);

  const canNavigateBack = useCallback(() => {
    // Can navigate back if there's history or if not on dashboard
    return navigationHistory.length > 1 || currentTab.id !== TabKeys.DASHBOARD;
  }, [navigationHistory, currentTab.id]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    members, attendanceRecords, bacentas, newBelievers, currentTab, isLoading, error,
    displayedSundays, displayedDate, criticalMemberIds,
    isMemberFormOpen, editingMember, isBacentaFormOpen, editingBacenta, isBacentaDrawerOpen,
    isNewBelieverFormOpen, editingNewBeliever,
    confirmationModal, toasts,
    fetchInitialData, addMemberHandler, addMultipleMembersHandler, updateMemberHandler, deleteMemberHandler, markAttendanceHandler, markNewBelieverAttendanceHandler, changeTab,
    openMemberForm, closeMemberForm, refreshData,
    addBacentaHandler, updateBacentaHandler, deleteBacentaHandler, openBacentaForm, closeBacentaForm,
    openBacentaDrawer, closeBacentaDrawer,
    addNewBelieverHandler, updateNewBelieverHandler, deleteNewBelieverHandler, openNewBelieverForm, closeNewBelieverForm,
    navigateToPreviousMonth, navigateToNextMonth,
    exportData, importData, getStorageInfo, showConfirmation, hideConfirmation, showToast,
    navigationHistory, navigateBack, canNavigateBack, addToNavigationHistory
  }), [
    members, attendanceRecords, bacentas, newBelievers, currentTab, isLoading, error,
    displayedSundays, displayedDate, criticalMemberIds,
    isMemberFormOpen, editingMember, isBacentaFormOpen, editingBacenta, isBacentaDrawerOpen,
    isNewBelieverFormOpen, editingNewBeliever,
    confirmationModal, toasts,
    fetchInitialData, addMemberHandler, addMultipleMembersHandler, updateMemberHandler, deleteMemberHandler, markAttendanceHandler, markNewBelieverAttendanceHandler, changeTab,
    openMemberForm, closeMemberForm, refreshData,
    addBacentaHandler, updateBacentaHandler, deleteBacentaHandler, openBacentaForm, closeBacentaForm,
    openBacentaDrawer, closeBacentaDrawer,
    addNewBelieverHandler, updateNewBelieverHandler, deleteNewBelieverHandler, openNewBelieverForm, closeNewBelieverForm,
    navigateToPreviousMonth, navigateToNextMonth,
    exportData, importData, getStorageInfo, showConfirmation, hideConfirmation, showToast,
    navigationHistory, navigateBack, canNavigateBack, addToNavigationHistory
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export default AppContext;
