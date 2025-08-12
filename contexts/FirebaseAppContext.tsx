// Firebase-enabled App Context
import React, { createContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase.config';
import { Member, AttendanceRecord, Bacenta, TabOption, AttendanceStatus, NewBeliever, SundayConfirmation, ConfirmationStatus, Guest, MemberDeletionRequest, OutreachBacenta, OutreachMember, PrayerRecord, PrayerStatus } from '../types';
import { FIXED_TABS, DEFAULT_TAB_ID } from '../constants';
import { sessionStateStorage } from '../utils/localStorage';
import { getSundaysOfMonth } from '../utils/dateUtils';
import {
  membersFirebaseService,
  bacentasFirebaseService,
  attendanceFirebaseService,
  newBelieversFirebaseService,
  confirmationFirebaseService,
  guestFirebaseService,
  memberDeletionRequestService,
  authService,
  firebaseUtils,
  FirebaseUser,
  outreachBacentasFirebaseService,
  outreachMembersFirebaseService,
  prayerFirebaseService
} from '../services/firebaseService';
import { dataMigrationService } from '../utils/dataMigration';
import { userService } from '../services/userService';
import { setNotificationContext } from '../services/notificationService';
import {
  memberOperationsWithNotifications,
  newBelieverOperationsWithNotifications,
  guestOperationsWithNotifications,
  confirmationOperationsWithNotifications,
  setNotificationIntegrationContext
} from '../services/notificationIntegration';
import { setEnhancedNotificationContext } from '../services/enhancedNotificationIntegration';

interface AppContextType {
  // Data
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  prayerRecords: PrayerRecord[];
  bacentas: Bacenta[];
  newBelievers: NewBeliever[];
  sundayConfirmations: SundayConfirmation[];
  guests: Guest[];
  memberDeletionRequests: MemberDeletionRequest[];

  // UI State
  currentTab: TabOption;
  isLoading: boolean;
  error: string | null;
  displayedSundays: string[];
  // Outreach Data
  outreachBacentas: OutreachBacenta[];
  outreachMembers: OutreachMember[]; // filtered by selected outreachMonth
  allOutreachMembers: OutreachMember[]; // all outreach members across all time periods
  outreachMonth: string; // YYYY-MM

  // Outreach Operations
  addOutreachBacentaHandler: (data: Omit<OutreachBacenta, 'id'>) => Promise<string>;
  updateOutreachBacentaHandler: (data: OutreachBacenta) => Promise<void>;
  deleteOutreachBacentaHandler: (id: string) => Promise<void>;

  addOutreachMemberHandler: (data: Omit<OutreachMember, 'id' | 'createdDate' | 'lastUpdated'>) => Promise<string>;
  updateOutreachMemberHandler: (id: string, updates: Partial<OutreachMember>) => Promise<void>;
  deleteOutreachMemberHandler: (id: string) => Promise<void>;
  convertOutreachMemberToPermanentHandler: (outreachMemberId: string) => Promise<void>;
  addMultipleOutreachMembersHandler: (items: Omit<OutreachMember, 'id' | 'createdDate' | 'lastUpdated'>[]) => Promise<{ successful: OutreachMember[]; failed: { data: Omit<OutreachMember, 'id' | 'createdDate' | 'lastUpdated'>; error: string }[] }>;

  setOutreachMonth: (yyyymm: string) => void;

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
    type: 'deleteMember' | 'deleteBacenta' | 'deleteNewBeliever' | 'clearData' | 'clearSelectedData' | 'createDeletionRequest' | 'clearAllNewBelievers' | null;
    data: any;
    onConfirm: () => void;
  };
  showConfirmation: (type: 'deleteMember' | 'deleteBacenta' | 'deleteNewBeliever' | 'clearData' | 'clearSelectedData' | 'createDeletionRequest' | 'clearAllNewBelievers', data: any, onConfirm: () => void) => void;
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
  currentChurchId: string | null;
  isOnline: boolean;
  needsMigration: boolean;

  // Data Operations
  fetchInitialData: () => Promise<void>;
  addMemberHandler: (memberData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>) => Promise<string>;
  addMultipleMembersHandler: (membersData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>[]) => Promise<{ successful: Member[], failed: { data: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>, error: string }[] }>;
  updateMemberHandler: (memberData: Member) => Promise<void>;
  deleteMemberHandler: (memberId: string) => Promise<void>;

  // Bacenta Operations
  addBacentaHandler: (bacentaData: Omit<Bacenta, 'id'>) => Promise<string>;
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

  // Prayer Operations
  markPrayerHandler: (memberId: string, date: string, status: PrayerStatus) => Promise<void>;
  clearPrayerHandler: (memberId: string, date: string) => Promise<void>;

  // Confirmation Operations
  markConfirmationHandler: (memberId: string, date: string, status: ConfirmationStatus) => Promise<void>;
  removeConfirmationHandler: (confirmationId: string) => Promise<void>;
  cleanupOrphanedConfirmations: () => Promise<number>;

  // Guest Operations
  addGuestHandler: (guestData: Omit<Guest, 'id' | 'createdDate' | 'lastUpdated' | 'createdBy'>) => Promise<void>;
  updateGuestHandler: (guestData: Guest) => Promise<void>;
  deleteGuestHandler: (guestId: string) => Promise<void>;
  markGuestConfirmationHandler: (guestId: string, date: string, status: ConfirmationStatus) => Promise<void>;
  removeGuestConfirmationHandler: (guestId: string, date: string) => Promise<void>;
  convertGuestToMemberHandler: (guestId: string) => Promise<void>;

  // Member Deletion Request Operations
  createDeletionRequestHandler: (memberId: string, reason?: string) => Promise<void>;
  approveDeletionRequestHandler: (requestId: string) => Promise<void>;
  rejectDeletionRequestHandler: (requestId: string, adminNotes?: string) => Promise<void>;

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
  navigateBack: () => boolean;
  canNavigateBack: () => boolean;
  resetToDashboard: () => void;
  navigationStack: TabOption[];
  applyHistoryNavigation: (target: TabOption) => void;
  // Deprecated: kept for compatibility
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
  // Impersonation (Super Admin view-as)
  isImpersonating: boolean;
  impersonatedAdminId: string | null;
  startImpersonation: (adminUserId: string, churchId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  // Force data reload while impersonating (raw fetch bypassing listeners)
  forceImpersonatedDataReload?: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const FirebaseAppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Core data state
  const [members, setMembers] = useState<Member[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [prayerRecords, setPrayerRecords] = useState<PrayerRecord[]>([]);
  const [bacentas, setBacentas] = useState<Bacenta[]>([]);
  const [newBelievers, setNewBelievers] = useState<NewBeliever[]>([]);
  const [sundayConfirmations, setSundayConfirmations] = useState<SundayConfirmation[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [memberDeletionRequests, setMemberDeletionRequests] = useState<MemberDeletionRequest[]>([]);

  // UI state
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
  // Outreach state
  const [outreachBacentas, setOutreachBacentas] = useState<OutreachBacenta[]>([]);
  const [outreachMembers, setOutreachMembers] = useState<OutreachMember[]>([]);
  const [allOutreachMembers, setAllOutreachMembers] = useState<OutreachMember[]>([]);
  const [outreachMonth, setOutreachMonthState] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });


  // Confirmation modal
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
  type: 'deleteMember' | 'deleteBacenta' | 'deleteNewBeliever' | 'clearData' | 'clearSelectedData' | 'createDeletionRequest' | 'clearAllNewBelievers' | null;
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
  const [currentChurchId, setCurrentChurchId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [needsMigration, setNeedsMigration] = useState<boolean>(false);

  // Navigation state (stack of previously visited tabs)
  const [navigationStack, setNavigationStack] = useState<TabOption[]>(() => sessionStateStorage.loadNavStack());
  const [currentTab, setCurrentTab] = useState<TabOption>(() => sessionStateStorage.loadCurrentTab() || (FIXED_TABS.find(t => t.id === DEFAULT_TAB_ID) || FIXED_TABS[0]));
  const isNavigatingBack = React.useRef(false);
  const prevTabRef = React.useRef<TabOption | null>(null);
  // Impersonation state
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedAdminId, setImpersonatedAdminId] = useState<string | null>(null);
  const originalChurchContextRef = React.useRef<string | null>(null);
  const originalUserProfileRef = React.useRef<any | null>(null);

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

              // Set up notification context if we have church context
              const churchId = firebaseUtils.getCurrentChurchId();
              setCurrentChurchId(churchId);
              if (profile && churchId) {
                setNotificationContext(profile, churchId);
                setNotificationIntegrationContext(profile, churchId);
                setEnhancedNotificationContext(profile, churchId);
              }

              // Check if Firebase is ready (has church context) and set up data listeners
              if (firebaseUtils.isReady()) {
                setupDataListeners();
              } else {
                // Clear data until church context is available
                setMembers([]);
                setBacentas([]);
                setAttendanceRecords([]);
                setNewBelievers([]);
                setSundayConfirmations([]);
                setGuests([]);
              }
            } catch (error) {
              console.error('Failed to load user profile:', error);
              setUserProfile(null);
            }
          } else {
            // User not authenticated, clear data
            setUserProfile(null);
            setCurrentChurchId(null);
            setNotificationContext(null, null);
            setNotificationIntegrationContext(null, null);
            setEnhancedNotificationContext(null, null);
            setMembers([]);
            setBacentas([]);
            setAttendanceRecords([]);
            setNewBelievers([]);
            setSundayConfirmations([]);
            setGuests([]);
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
  const listenersCleanupRef = React.useRef<(() => void) | null>(null);

  const setupDataListeners = useCallback(() => {
    // During Super Admin impersonation we intentionally allow listeners even if no signed-in firebase user
    if (!isImpersonating && !firebaseUtils.isReady()) return;
    if (!firebaseUtils.getCurrentChurchId()) return;
    console.log('[Listeners] Setting up data listeners for church', firebaseUtils.getCurrentChurchId(), 'impersonating?', isImpersonating, 'ready?', firebaseUtils.isReady());

    // Clean any previous listeners first
    if (listenersCleanupRef.current) {
      try { listenersCleanupRef.current(); } catch {}
      listenersCleanupRef.current = null;
    }

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

      // Listen to outreach bacentas
      const unsubscribeOutreachBacentas = outreachBacentasFirebaseService.onSnapshot((items) => {
        setOutreachBacentas(items);
      });
      unsubscribers.push(unsubscribeOutreachBacentas);

      // Listen to ALL outreach members (for overall totals)
      const unsubscribeAllOutreachMembers = outreachMembersFirebaseService.onSnapshot((items) => {
        setAllOutreachMembers(items);
      });
      unsubscribers.push(unsubscribeAllOutreachMembers);

      // Listen to attendance
      const unsubscribeAttendance = attendanceFirebaseService.onSnapshot((records) => {
        setAttendanceRecords(records);
      });
      unsubscribers.push(unsubscribeAttendance);

      // Listen to prayer
      const unsubscribePrayer = prayerFirebaseService.onSnapshot((records) => {
        setPrayerRecords(records);
      });
      unsubscribers.push(unsubscribePrayer);

      // Listen to new believers
      const unsubscribeNewBelievers = newBelieversFirebaseService.onSnapshot((newBelievers) => {
        setNewBelievers(newBelievers);
      });
      unsubscribers.push(unsubscribeNewBelievers);
      // Listen to outreach members for current outreachMonth
      const subscribeOutreachMembers = () => outreachMembersFirebaseService.onSnapshotByMonth(
        outreachMonth,
        (items) => setOutreachMembers(items)
      );
      let unsubscribeOutreachMembers = subscribeOutreachMembers();
      unsubscribers.push(() => unsubscribeOutreachMembers());

      // Re-subscribe when outreachMonth changes
      const monthObserver = () => {
        unsubscribeOutreachMembers();
        unsubscribeOutreachMembers = subscribeOutreachMembers();
      };
      // Using a simple effect on outreachMonth outside this scope would be cleaner, but keep here with event
      const monthKey = 'outreachMonthChange';
      const handler = () => monthObserver();
      window.addEventListener(monthKey, handler);
      unsubscribers.push(() => window.removeEventListener(monthKey, handler));


      // Listen to confirmations
      const unsubscribeConfirmations = confirmationFirebaseService.onSnapshot((confirmations) => {
        setSundayConfirmations(confirmations);
      });
      unsubscribers.push(unsubscribeConfirmations);

      // Listen to guests
      const unsubscribeGuests = guestFirebaseService.onSnapshot((guests) => {
        setGuests(guests);
      });
      unsubscribers.push(unsubscribeGuests);


      // Listen to member deletion requests

      // Re-subscribe outreach members when outreachMonth changes
      // Cleanup previous outreach members listener if month changes

      const unsubscribeDeletionRequests = memberDeletionRequestService.onSnapshot((requests) => {
        setMemberDeletionRequests(requests);
      });
      unsubscribers.push(unsubscribeDeletionRequests);

    } catch (error: any) {
      setError(error.message);
    }

    // Store cleanup
    listenersCleanupRef.current = () => {
      unsubscribers.forEach(unsub => {
        try { unsub(); } catch {}
      });
    console.log('[Listeners] Cleaned up listeners for church', firebaseUtils.getCurrentChurchId());
    };
  }, [isImpersonating]);

  // Re-establish listeners when church context changes (impersonation or restore)
  useEffect(() => {
    if (firebaseUtils.isReady()) {
      setupDataListeners();
    }
    return () => {
      // only cleanup on unmount; next effect run handles previous cleanup
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChurchId]);

  // Fetch initial data (for manual refresh)
  const fetchInitialData = useCallback(async () => {
    if (!isImpersonating && !firebaseUtils.isReady()) return;
    if (!firebaseUtils.getCurrentChurchId()) return;
    console.log('[fetchInitialData] church=', firebaseUtils.getCurrentChurchId(), 'impersonating?', isImpersonating, 'ready?', firebaseUtils.isReady());

    try {
      setIsLoading(true);
      setError(null);

      const [membersData, bacentasData, attendanceData, newBelieversData, confirmationsData, prayerData] = await Promise.all([
        membersFirebaseService.getAll(),
        bacentasFirebaseService.getAll(),
        attendanceFirebaseService.getAll(),
        newBelieversFirebaseService.getAll(),
        confirmationFirebaseService.getAll(),
        prayerFirebaseService.getAll()
      ]);

      setMembers(membersData);
      setBacentas(bacentasData);
      setAttendanceRecords(attendanceData);
      setNewBelievers(newBelieversData);
      setSundayConfirmations(confirmationsData);
      setPrayerRecords(prayerData);
      console.log('[fetchInitialData] loaded counts', {
        members: membersData.length,
        bacentas: bacentasData.length,
        attendance: attendanceData.length,
        newBelievers: newBelieversData.length,
        confirmations: confirmationsData.length,
        prayers: prayerData.length
      });
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
  const showConfirmation = useCallback((type: 'deleteMember' | 'deleteBacenta' | 'deleteNewBeliever' | 'clearData' | 'clearSelectedData' | 'createDeletionRequest' | 'clearAllNewBelievers', data: any, onConfirm: () => void) => {
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
  const addMemberHandler = useCallback(async (memberData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>): Promise<string> => {
    try {
      setIsLoading(true);
      const newMemberId = await memberOperationsWithNotifications.add(memberData);
      showToast('success', 'Member added successfully');
      return newMemberId;
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
          const memberId = await memberOperationsWithNotifications.add(memberData);
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

  // Add: bulk outreach members handler
  const addMultipleOutreachMembersHandler = useCallback(async (items: Omit<OutreachMember, 'id' | 'createdDate' | 'lastUpdated'>[]) => {
    try {
      setIsLoading(true);
      const successful: OutreachMember[] = [] as any;
      const failed: { data: Omit<OutreachMember, 'id' | 'createdDate' | 'lastUpdated'>; error: string }[] = [];

      for (const data of items) {
        try {
          await outreachMembersFirebaseService.add(data);
          successful.push({ ...data, id: 'temp', createdDate: '', lastUpdated: '' } as any);
        } catch (e: any) {
          failed.push({ data, error: e?.message || 'Unknown error' });
        }
      }

      if (failed.length === 0) {
        showToast('success', `Added ${successful.length} outreach member${successful.length === 1 ? '' : 's'}`);
      } else if (successful.length > 0) {
        showToast('warning', 'Partial success', `${successful.length} added, ${failed.length} failed`);
      } else {
        showToast('error', 'Bulk add failed');
      }

      return { successful, failed };
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

      // Find the member to check their role
      const memberToDelete = members.find(m => m.id === memberId);
      if (!memberToDelete) {
        throw new Error('Member not found');
      }

      // Check if current user has permission to delete this member
      const { canDeleteMemberWithRole } = await import('../utils/permissionUtils');
      if (!canDeleteMemberWithRole(userProfile, memberToDelete.role)) {
        throw new Error('You do not have permission to delete leaders. Only original administrators can delete Bacenta Leaders and Fellowship Leaders.');
      }

      // Clean up confirmation records for this member
      const memberConfirmations = sundayConfirmations.filter(conf => conf.memberId === memberId);
      for (const confirmation of memberConfirmations) {
        try {
          await confirmationFirebaseService.delete(confirmation.id);
          console.log('✅ Cleaned up confirmation record:', confirmation.id);
        } catch (confirmationError) {
          console.warn('⚠️ Failed to clean up confirmation record:', confirmation.id, confirmationError);
          // Don't fail the entire operation if confirmation cleanup fails
        }
      }

      // Use notification-enabled delete operation
      const memberName = `${memberToDelete.firstName} ${memberToDelete.lastName || ''}`.trim();
      await memberOperationsWithNotifications.delete(memberId, memberName);

      // Unconvert behavior: If this member was the conversion target for any outreach member,
      // clear the conversion link so the outreach record remains as not converted
      try {
    const linkedOutreachMembers = outreachMembers.filter(om => om.convertedMemberId === memberId || om.bornAgainMemberId === memberId);
    for (const om of linkedOutreachMembers) {
          await outreachMembersFirebaseService.update(om.id, {
      // Clear both possible links if pointing at the deleted member
      convertedMemberId: om.convertedMemberId === memberId ? '' : (om.convertedMemberId || ''),
      bornAgainMemberId: om.bornAgainMemberId === memberId ? '' : (om.bornAgainMemberId || ''),
            lastUpdated: new Date().toISOString(),
          });
          console.log('🧹 Cleared outreach conversion link due to member deletion:', { outreachMemberId: om.id, memberId });
        }
      } catch (syncError) {
        console.warn('⚠️ Failed to clear outreach conversion links after member deletion:', syncError);
      }

      showToast('success', 'Member deleted successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to delete member', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast, members, userProfile, sundayConfirmations, outreachMembers]);

  // Bacenta handlers
  const addBacentaHandler = useCallback(async (bacentaData: Omit<Bacenta, 'id'>) => {
    try {
      setIsLoading(true);
      const newId = await bacentasFirebaseService.add(bacentaData);
      showToast('success', 'Bacenta added successfully');
      return newId;
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
      await newBelieverOperationsWithNotifications.add(newBelieverData);
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
          const newBelieverId = await newBelieverOperationsWithNotifications.add(newBelieverData);
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

  // Outreach handlers
  const setOutreachMonth = useCallback((yyyymm: string) => {
    setOutreachMonthState(yyyymm);
    // notify listeners (setupDataListeners) to resubscribe
    window.dispatchEvent(new CustomEvent('outreachMonthChange'));
  }, []);


  const addOutreachBacentaHandler = useCallback(async (data: Omit<OutreachBacenta, 'id'>) => {
    try {
      setIsLoading(true);
      const id = await outreachBacentasFirebaseService.add(data);
      showToast('success', 'Outreach Bacenta added');
      return id;
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to add outreach bacenta', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const updateOutreachBacentaHandler = useCallback(async (data: OutreachBacenta) => {
    try {
      setIsLoading(true);
      await outreachBacentasFirebaseService.update(data.id, data);
      showToast('success', 'Outreach Bacenta updated');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to update outreach bacenta', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const deleteOutreachBacentaHandler = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      await outreachBacentasFirebaseService.delete(id);
      showToast('success', 'Outreach Bacenta deleted');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to delete outreach bacenta', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const addOutreachMemberHandler = useCallback(async (data: Omit<OutreachMember, 'id' | 'createdDate' | 'lastUpdated'>): Promise<string> => {
    try {
      setIsLoading(true);
      const outreachMemberId = await outreachMembersFirebaseService.add(data);

      // If Coming is Yes, auto-copy to confirmations under same bacenta for upcoming Sunday
      if (data.comingStatus) {
        const { getUpcomingSunday } = await import('../utils/dateUtils');
        const upcomingSunday = getUpcomingSunday();

        // create a lightweight guest record to track confirmation separate from members
        const guestPayload: Omit<Guest, 'id' | 'createdDate' | 'lastUpdated' | 'createdBy'> = {
          firstName: data.name,
          lastName: '',
          bacentaId: data.bacentaId,
          phoneNumber: (data.phoneNumbers && data.phoneNumbers[0]) || ''
        };
        const guestId = await guestFirebaseService.add(guestPayload as any); // createdBy is auto in service

        // Save link back to outreach member for possible conversion flow
  await outreachMembersFirebaseService.update(outreachMemberId, { guestId });

        const recordId = `guest_${guestId}_${upcomingSunday}`;
        const record: SundayConfirmation = {
          id: recordId,
          guestId,
          date: upcomingSunday,
          status: 'Confirmed',
          confirmationTimestamp: new Date().toISOString(),
          confirmedBy: userProfile?.uid
        };
        await confirmationFirebaseService.addOrUpdate(record);
      }

      showToast('success', 'Outreach member added');
  return outreachMemberId;
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to add outreach member', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast, userProfile]);

  const updateOutreachMemberHandler = useCallback(async (id: string, updates: Partial<OutreachMember>) => {
    try {
      setIsLoading(true);

      // Find existing state to compute deltas
      const existing = outreachMembers.find(o => o.id === id);

      // Apply primary update
      await outreachMembersFirebaseService.update(id, updates);

      // If comingStatus changed, sync confirmations accordingly (bidirectional)
      if (existing && typeof updates.comingStatus === 'boolean' && existing.comingStatus !== updates.comingStatus) {
        const { getUpcomingSunday } = await import('../utils/dateUtils');
        const upcomingSunday = getUpcomingSunday();

        if (updates.comingStatus === false) {
          // If newly marked not coming, remove confirmation for member/guest
          try {
            if (existing.convertedMemberId) {
              await confirmationOperationsWithNotifications.remove(existing.convertedMemberId, upcomingSunday);
              console.log('🗑️ Removed member confirmation due to outreach toggle', { memberId: existing.convertedMemberId, upcomingSunday });
            } else if (existing.guestId) {
              const recordId = `guest_${existing.guestId}_${upcomingSunday}`;
              await confirmationFirebaseService.delete(recordId);
              console.log('🗑️ Removed guest confirmation due to outreach toggle', { recordId });
            }
            // Default reason if not supplied
            if (!('notComingReason' in updates) || !updates.notComingReason) {
              await outreachMembersFirebaseService.update(id, {
                notComingReason: `Removed by ${userProfile?.displayName || userProfile?.firstName || 'Admin'}`
              });
            }
          } catch (syncError) {
            console.warn('⚠️ Failed to remove confirmation during outreach toggle:', syncError);
          }
        } else if (updates.comingStatus === true) {
          // If newly marked coming, create/ensure confirmation
          try {
            if (existing.convertedMemberId) {
              const recordId = `${existing.convertedMemberId}_${upcomingSunday}`;
              const record: SundayConfirmation = {
                id: recordId,
                memberId: existing.convertedMemberId,
                date: upcomingSunday,
                status: 'Confirmed',
                confirmationTimestamp: new Date().toISOString(),
                confirmedBy: userProfile?.uid
              };
              await confirmationFirebaseService.addOrUpdate(record);
              console.log('✅ Ensured member confirmation due to outreach toggle', { recordId });
            } else {
              // Ensure we have a guest and confirm
              let guestId = existing.guestId;
              if (!guestId) {
                const guestPayload: Omit<Guest, 'id' | 'createdDate' | 'lastUpdated' | 'createdBy'> = {
                  firstName: existing.name,
                  lastName: '',
                  bacentaId: existing.bacentaId,
                  roomNumber: existing.roomNumber,
                  phoneNumber: existing.phoneNumbers?.[0]
                };
                guestId = await guestFirebaseService.add(guestPayload as any);
                await outreachMembersFirebaseService.update(id, { guestId });
              }
              const recordId = `guest_${guestId}_${upcomingSunday}`;
              const record: SundayConfirmation = {
                id: recordId,
                guestId,
                date: upcomingSunday,
                status: 'Confirmed',
                confirmationTimestamp: new Date().toISOString(),
                confirmedBy: userProfile?.uid
              };
              await confirmationFirebaseService.addOrUpdate(record);
              console.log('✅ Ensured guest confirmation due to outreach toggle', { recordId });
            }

            // Clear reason if switching back to coming
            await outreachMembersFirebaseService.update(id, { notComingReason: undefined });
          } catch (syncError) {
            console.warn('⚠️ Failed to add confirmation during outreach toggle:', syncError);
          }
        }
      }

      showToast('success', 'Outreach member updated');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to update outreach member', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast, outreachMembers, userProfile]);

  const deleteOutreachMemberHandler = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      // Find the outreach member to determine cascading actions
      const om = outreachMembers.find(o => o.id === id);

      // If there is a linked guest, clean up their confirmations and guest record
      if (om?.guestId) {
        try {
          const guestConfs = sundayConfirmations.filter(conf => conf.guestId === om.guestId);
          for (const conf of guestConfs) {
            await confirmationFirebaseService.delete(conf.id);
          }
          await guestFirebaseService.delete(om.guestId);
        } catch (guestErr) {
          console.warn('Failed to cleanup guest during outreach deletion', guestErr);
        }
      }

      // If a born again member was created from outreach and this person was NOT converted,
      // also remove them from Sons of God per requirement
      if (om?.bornAgainMemberId && !om?.convertedMemberId) {
        // Only delete the linked born-again member if it still exists
        const linkedExists = members.some(m => m.id === om.bornAgainMemberId);
        if (linkedExists) {
          try {
            await deleteMemberHandler(om.bornAgainMemberId);
          } catch (delErr) {
            console.warn('Failed to delete linked born-again member during outreach deletion', delErr);
          }
        }
      }

      await outreachMembersFirebaseService.delete(id);
      showToast('success', 'Outreach member deleted');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to delete outreach member', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast, outreachMembers, sundayConfirmations, deleteMemberHandler, members]);

  const convertOutreachMemberToPermanentHandler = useCallback(async (outreachMemberId: string) => {
    try {
      setIsLoading(true);
      const om = outreachMembers.find(o => o.id === outreachMemberId);
      if (!om) throw new Error('Outreach member not found');

      let newMemberId: string | undefined = om.bornAgainMemberId;

      // If we have a bornAgainMemberId but the actual member is missing (deleted earlier), recreate
      const existing = newMemberId ? members.find(m => m.id === newMemberId) : undefined;
      if (newMemberId && !existing) {
        newMemberId = undefined; // force recreation below
      }

      if (!newMemberId) {
        // Create a new born-again member now that they are converted
        const memberData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'> = {
          firstName: om.name.trim(),
          lastName: '',
          phoneNumber: (om.phoneNumbers && om.phoneNumbers[0]) || '',
          buildingAddress: '',
          roomNumber: om.roomNumber || '',
          bornAgainStatus: true,
          outreachOrigin: true,
          bacentaId: om.bacentaId,
          linkedBacentaIds: [],
          bacentaLeaderId: '',
          role: 'Member'
        };
        newMemberId = await membersFirebaseService.add(memberData);
        await outreachMembersFirebaseService.update(outreachMemberId, { bornAgainMemberId: newMemberId });
      } else {
        // Ensure the existing born-again member is assigned and up to date
        await membersFirebaseService.update(newMemberId, {
          bacentaId: om.bacentaId,
          roomNumber: om.roomNumber || undefined,
          phoneNumber: (om.phoneNumbers && om.phoneNumbers[0]) || undefined,
          bornAgainStatus: true,
          outreachOrigin: true,
          role: 'Member'
        });
      }

      // If there is a linked guest, transfer confirmations
      if (om.guestId && newMemberId) {
        const guestConfirmations = sundayConfirmations.filter(conf => conf.guestId === om.guestId);
        for (const confirmation of guestConfirmations) {
          const memberConfirmation: SundayConfirmation = {
            id: `${newMemberId}_${confirmation.date}`,
            memberId: newMemberId,
            date: confirmation.date,
            status: confirmation.status,
            confirmationTimestamp: confirmation.confirmationTimestamp,
            confirmedBy: confirmation.confirmedBy
          };
          await confirmationFirebaseService.addOrUpdate(memberConfirmation);
          await confirmationFirebaseService.delete(confirmation.id);
        }
        await guestFirebaseService.delete(om.guestId);
      }

      // Mark outreach member as converted
      await outreachMembersFirebaseService.update(outreachMemberId, { convertedMemberId: newMemberId });

      showToast('success', 'Converted to permanent member');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to convert outreach member', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [outreachMembers, sundayConfirmations, showToast]);


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

  // Prayer handlers
  const markPrayerHandler = useCallback(async (memberId: string, date: string, status: PrayerStatus) => {
    try {
      const recordId = `${memberId}_${date}`;
      const record: PrayerRecord = { id: recordId, memberId, date, status };
      await prayerFirebaseService.addOrUpdate(record);
      showToast('success', 'Prayer marked successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to mark prayer', error.message);
      throw error;
    }
  }, [showToast]);

  const clearPrayerHandler = useCallback(async (memberId: string, date: string) => {
    try {
      const recordId = `${memberId}_${date}`;
      await prayerFirebaseService.delete(recordId);
      showToast('success', 'Prayer cleared successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to clear prayer', error.message);
      throw error;
    }
  }, [showToast]);

  // Confirmation handlers
  const markConfirmationHandler = useCallback(async (memberId: string, date: string, status: ConfirmationStatus) => {
    try {
      const recordId = `${memberId}_${date}`;
      const record: SundayConfirmation = {
        id: recordId,
        memberId,
        date,
        status,
        confirmationTimestamp: new Date().toISOString()
      };

      console.log('✅ Marking confirmation:', recordId, status);
      await confirmationOperationsWithNotifications.addOrUpdate(record);

      // Sync outreach members linked via convertedMemberId
      try {
        const linked = outreachMembers.filter(om => om.convertedMemberId === memberId);
        for (const om of linked) {
          await outreachMembersFirebaseService.update(om.id, {
            comingStatus: status === 'Confirmed',
            notComingReason: status === 'Confirmed' ? undefined : `Removed by ${userProfile?.displayName || userProfile?.firstName || 'Admin'}`,
            lastUpdated: new Date().toISOString()
          });
          console.log('🔗 Synced outreach via convertedMemberId:', { outreachMemberId: om.id, status });
        }
      } catch (syncError) {
        console.warn('⚠️ Failed to sync outreach after confirmation change:', syncError);
      }

      showToast('success', status === 'Confirmed' ? 'Attendance confirmed!' : 'Confirmation removed');
    } catch (error: any) {
      console.error('❌ Failed to mark confirmation:', error);
      setError(error.message);
      showToast('error', 'Failed to update confirmation', error.message);
      throw error;
    }
  }, [showToast, outreachMembers, userProfile]);

  // Remove confirmation handler
  const removeConfirmationHandler = useCallback(async (confirmationId: string) => {
    try {
      if (!userProfile?.uid) {
        throw new Error('User not authenticated');
      }

      // Parse the confirmation ID to extract memberId and date
      const parts = confirmationId.split('_');
      if (parts.length >= 2) {
        const memberId = parts[0];
        const date = parts[1];

        // Use notification-enabled remove operation
        await confirmationOperationsWithNotifications.remove(memberId, date);

        // Sync with outreach: find any outreach members for this member and mark as not coming
        const member = members.find(m => m.id === memberId);
        if (member) {
          const relatedOutreachMembers = outreachMembers.filter(om =>
            om.convertedMemberId === memberId && om.comingStatus === true
          );

          for (const outreachMember of relatedOutreachMembers) {
            try {
              await outreachMembersFirebaseService.update(outreachMember.id, {
                comingStatus: false,
                notComingReason: `Removed by ${userProfile.displayName || userProfile.firstName || 'Admin'}`,
                lastUpdated: new Date().toISOString()
              });
              console.log('✅ Synced outreach member status:', outreachMember.id);
            } catch (syncError) {
              console.warn('⚠️ Failed to sync outreach member:', outreachMember.id, syncError);
            }
          }
        }
      } else {
        // Fallback to direct service call for non-standard IDs
        await confirmationFirebaseService.remove(confirmationId, userProfile.uid);
      }

      showToast('success', 'Confirmation removed successfully');
    } catch (error: any) {
      console.error('❌ Failed to remove confirmation:', error);
      setError(error.message);
      showToast('error', 'Failed to remove confirmation', error.message);
      throw error;
    }
  }, [showToast, userProfile, members, outreachMembers]);

  // Clean up orphaned confirmation records
  const cleanupOrphanedConfirmations = useCallback(async () => {
    try {
      console.log('🧹 Starting cleanup of orphaned confirmation records...');
      let cleanedCount = 0;

      const orphanedConfirmations = sundayConfirmations.filter(confirmation => {
        if (confirmation.memberId) {
          // Check if member still exists
          return !members.some(member => member.id === confirmation.memberId);
        } else if (confirmation.guestId) {
          // Check if guest still exists
          return !guests.some(guest => guest.id === confirmation.guestId);
        }
        return false; // Invalid confirmation record
      });

      for (const orphanedConfirmation of orphanedConfirmations) {
        try {
          await confirmationFirebaseService.delete(orphanedConfirmation.id);
          cleanedCount++;
          console.log('✅ Cleaned up orphaned confirmation:', orphanedConfirmation.id);
        } catch (error) {
          console.warn('⚠️ Failed to clean up orphaned confirmation:', orphanedConfirmation.id, error);
        }
      }

      if (cleanedCount > 0) {
        console.log(`✅ Cleanup completed: ${cleanedCount} orphaned confirmation records removed`);
        showToast('success', 'Data Cleanup', `Cleaned up ${cleanedCount} orphaned confirmation records`);
      } else {
        console.log('✅ No orphaned confirmation records found');
      }

      return cleanedCount;
    } catch (error: any) {
      console.error('❌ Failed to cleanup orphaned confirmations:', error);
      showToast('error', 'Cleanup failed', error.message);
      throw error;
    }
  }, [sundayConfirmations, members, guests, showToast]);

  // Guest handlers
  const addGuestHandler = useCallback(async (guestData: Omit<Guest, 'id' | 'createdDate' | 'lastUpdated' | 'createdBy'>) => {
    try {
      setIsLoading(true);

      // Add the guest to the database
      const guestId = await guestOperationsWithNotifications.add(guestData);

      // Auto-confirm the guest for the upcoming Sunday
      const { getUpcomingSunday } = await import('../utils/dateUtils');
      const upcomingSunday = getUpcomingSunday();

      // Create confirmation record directly
      const recordId = `guest_${guestId}_${upcomingSunday}`;
      const record: SundayConfirmation = {
        id: recordId,
        guestId,
        date: upcomingSunday,
        status: 'Confirmed',
        confirmationTimestamp: new Date().toISOString(),
        confirmedBy: userProfile?.uid
      };

      await confirmationFirebaseService.addOrUpdate(record);
      showToast('success', 'Guest added and confirmed for upcoming Sunday');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to add guest', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast, userProfile]);

  const updateGuestHandler = useCallback(async (guestData: Guest) => {
    try {
      setIsLoading(true);
      await guestFirebaseService.update(guestData.id, guestData);
      showToast('success', 'Guest updated successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to update guest', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const deleteGuestHandler = useCallback(async (guestId: string) => {
    try {
      setIsLoading(true);

      // Clean up confirmation records for this guest
      const guestConfirmations = sundayConfirmations.filter(conf => conf.guestId === guestId);
      for (const confirmation of guestConfirmations) {
        try {
          await confirmationFirebaseService.delete(confirmation.id);
          console.log('✅ Cleaned up guest confirmation record:', confirmation.id);
        } catch (confirmationError) {
          console.warn('⚠️ Failed to clean up guest confirmation record:', confirmation.id, confirmationError);
          // Don't fail the entire operation if confirmation cleanup fails
        }
      }

      await guestFirebaseService.delete(guestId);
      showToast('success', 'Guest deleted successfully');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to delete guest', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast, sundayConfirmations]);

  const markGuestConfirmationHandler = useCallback(async (guestId: string, date: string, status: ConfirmationStatus) => {
    try {
      const recordId = `guest_${guestId}_${date}`;
      const record: SundayConfirmation = {
        id: recordId,
        guestId,
        date,
        status,
        confirmationTimestamp: new Date().toISOString(),
        confirmedBy: userProfile?.uid
      };

      console.log('✅ Marking guest confirmation:', recordId, status);
      await confirmationFirebaseService.addOrUpdate(record);

      // Sync outreach: update any outreach member linked to this guest
      try {
        const linked = outreachMembers.filter(om => om.guestId === guestId);
        for (const om of linked) {
          await outreachMembersFirebaseService.update(om.id, {
            comingStatus: status === 'Confirmed',
            notComingReason: status === 'Confirmed' ? undefined : `Removed by ${userProfile?.displayName || userProfile?.firstName || 'Admin'}`,
            lastUpdated: new Date().toISOString()
          });
          console.log('🔗 Synced outreach via guestId:', { outreachMemberId: om.id, status });
        }
      } catch (syncError) {
        console.warn('⚠️ Failed to sync outreach after guest confirmation change:', syncError);
      }

      showToast('success', status === 'Confirmed' ? 'Guest attendance confirmed!' : 'Guest confirmation removed');
    } catch (error: any) {
      console.error('❌ Failed to mark guest confirmation:', error);
      setError(error.message);
      showToast('error', 'Failed to update guest confirmation', error.message);
      throw error;
    }
  }, [showToast, userProfile]);

  const removeGuestConfirmationHandler = useCallback(async (guestId: string, date: string) => {
    try {
      const recordId = `guest_${guestId}_${date}`;
      console.log('✅ Removing guest confirmation:', recordId);
      await confirmationFirebaseService.delete(recordId);

      // Sync outreach: mark linked outreach member as not coming
      try {
        const linked = outreachMembers.filter(om => om.guestId === guestId && om.comingStatus === true);
        for (const om of linked) {
          await outreachMembersFirebaseService.update(om.id, {
            comingStatus: false,
            notComingReason: `Removed by ${userProfile?.displayName || userProfile?.firstName || 'Admin'}`,
            lastUpdated: new Date().toISOString()
          });
          console.log('✅ Synced outreach after removing guest confirmation:', { outreachMemberId: om.id });
        }
      } catch (syncError) {
        console.warn('⚠️ Failed to sync outreach after removing guest confirmation:', syncError);
      }

      showToast('success', 'Guest Confirmation Removed', 'Guest confirmation has been removed');
    } catch (error: any) {
      console.error('❌ Failed to remove guest confirmation:', error);
      showToast('error', 'Error', `Failed to remove guest confirmation: ${error.message}`);
      throw error;
    }
  }, [showToast, outreachMembers, userProfile]);

  const convertGuestToMemberHandler = useCallback(async (guestId: string) => {
    let newMemberId: string | null = null;
    let createdConfirmations: string[] = [];

    try {
      setIsLoading(true);

      // Get the guest data
      const guest = guests.find(g => g.id === guestId);
      if (!guest) {
        throw new Error('Guest not found');
      }

      // Validate guest data
      if (!guest.firstName.trim()) {
        throw new Error('Guest must have a first name');
      }
      if (!guest.bacentaId) {
        throw new Error('Guest must be assigned to a Bacenta');
      }

      // Check if a member with the same name already exists in the same Bacenta
      const existingMember = members.find(m =>
        m.firstName.toLowerCase().trim() === guest.firstName.toLowerCase().trim() &&
        (m.lastName || '').toLowerCase().trim() === (guest.lastName || '').toLowerCase().trim() &&
        m.bacentaId === guest.bacentaId
      );

      if (existingMember) {
        throw new Error(`A member named "${guest.firstName} ${guest.lastName || ''}" already exists in ${bacentas.find(b => b.id === guest.bacentaId)?.name || 'this Bacenta'}`);
      }

      // Validate that the Bacenta still exists
      const bacenta = bacentas.find(b => b.id === guest.bacentaId);
      if (!bacenta) {
        throw new Error('The assigned Bacenta no longer exists. Please edit the guest and assign them to a valid Bacenta before converting.');
      }

      // Create member data from guest data
      const memberData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'> = {
        firstName: guest.firstName.trim(),
        lastName: guest.lastName?.trim() || '',
        phoneNumber: guest.phoneNumber?.trim() || '',
        buildingAddress: guest.roomNumber?.trim() || '', // Use room number as building address
        roomNumber: guest.roomNumber?.trim() || '',
        profilePicture: '',
        bornAgainStatus: false, // Default to false
        bacentaId: guest.bacentaId,
        bacentaLeaderId: '',
        role: 'Member' as const
      };

      console.log('🔄 Converting guest to member:', guest.firstName, guest.lastName);

      // Step 1: Add the new member and get the member ID
      newMemberId = await membersFirebaseService.add(memberData);
      console.log('✅ Member created with ID:', newMemberId);

      // Step 2: Transfer Sunday confirmations from guest to member
      const guestConfirmations = sundayConfirmations.filter(conf => conf.guestId === guestId);
      console.log('🔄 Transferring', guestConfirmations.length, 'confirmations');

      for (const confirmation of guestConfirmations) {
        try {
          // Create new confirmation record for the member
          const memberConfirmationRecord: SundayConfirmation = {
            id: `${newMemberId}_${confirmation.date}`,
            memberId: newMemberId,
            date: confirmation.date,
            status: confirmation.status,
            confirmationTimestamp: confirmation.confirmationTimestamp,
            confirmedBy: confirmation.confirmedBy
          };

          await confirmationFirebaseService.addOrUpdate(memberConfirmationRecord);
          createdConfirmations.push(memberConfirmationRecord.id);
          console.log('✅ Transferred confirmation for date:', confirmation.date);

          // Remove the guest confirmation
          await confirmationFirebaseService.delete(confirmation.id);
          console.log('✅ Removed guest confirmation for date:', confirmation.date);
        } catch (confirmationError: any) {
          console.error('❌ Failed to transfer confirmation for date:', confirmation.date, confirmationError);
          throw new Error(`Failed to transfer confirmation for ${confirmation.date}: ${confirmationError.message}`);
        }
      }

      // Step 3: Delete the guest record
      await guestFirebaseService.delete(guestId);
      console.log('✅ Guest record deleted');

      showToast('success', 'Guest converted to member successfully');
    } catch (error: any) {
      console.error('❌ Failed to convert guest to member:', error);

      // Rollback: Clean up any created data
      if (newMemberId) {
        try {
          console.log('🔄 Rolling back: Deleting created member');
          await membersFirebaseService.delete(newMemberId);

          // Also clean up any confirmations that were created
          for (const confirmationId of createdConfirmations) {
            try {
              await confirmationFirebaseService.delete(confirmationId);
            } catch (cleanupError) {
              console.error('❌ Failed to cleanup confirmation during rollback:', confirmationId, cleanupError);
            }
          }
          console.log('✅ Rollback completed');
        } catch (rollbackError: any) {
          console.error('❌ Failed to rollback member creation:', rollbackError);
          // Don't throw rollback errors, just log them
        }
      }

      setError(error.message);
      showToast('error', 'Failed to convert guest to member', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [guests, sundayConfirmations, members, bacentas, showToast]);

  // Member Deletion Request handlers
  const createDeletionRequestHandler = useCallback(async (memberId: string, reason?: string) => {
    try {
      if (!userProfile?.uid) {
        throw new Error('User not authenticated');
      }

      // Find the member to get their name
      const member = members.find(m => m.id === memberId);
      if (!member) {
        throw new Error('Member not found');
      }

      // Check if there's already a pending request for this member
      const hasPending = await memberDeletionRequestService.hasPendingRequest(memberId);
      if (hasPending) {
        throw new Error('A deletion request for this member is already pending');
      }

      await memberDeletionRequestService.create({
        memberId,
        memberName: `${member.firstName} ${member.lastName || ''}`.trim(),
        requestedBy: userProfile.uid,
        requestedByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim(),
        requestedAt: new Date().toISOString(),
        status: 'pending',
        reason: reason || '',
        churchId: userProfile.churchId || ''
      });

      showToast('success', 'Deletion Request Submitted',
        `Your request to delete ${member.firstName} ${member.lastName || ''} has been submitted for admin approval.`);
    } catch (error: any) {
      console.error('❌ Failed to create deletion request:', error);
      setError(error.message);
      showToast('error', 'Failed to create deletion request', error.message);
      throw error;
    }
  }, [members, userProfile, showToast]);

  const approveDeletionRequestHandler = useCallback(async (requestId: string) => {
    try {
      if (!userProfile?.uid) {
        throw new Error('User not authenticated');
      }

      // Find the request
      const request = memberDeletionRequests.find(r => r.id === requestId);
      if (!request) {
        throw new Error('Deletion request not found');
      }

      // Update the request status
      await memberDeletionRequestService.update(requestId, {
        status: 'approved',
        reviewedBy: userProfile.uid,
        reviewedByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim(),
        reviewedAt: new Date().toISOString()
      });

      // Delete the actual member
      await deleteMemberHandler(request.memberId);

      showToast('success', 'Request Approved',
        `Deletion request for ${request.memberName} has been approved and the member has been deleted.`);
    } catch (error: any) {
      console.error('❌ Failed to approve deletion request:', error);
      setError(error.message);
      showToast('error', 'Failed to approve deletion request', error.message);
      throw error;
    }
  }, [memberDeletionRequests, userProfile, showToast, deleteMemberHandler]);

  const rejectDeletionRequestHandler = useCallback(async (requestId: string, adminNotes?: string) => {
    try {
      if (!userProfile?.uid) {
        throw new Error('User not authenticated');
      }

      // Find the request
      const request = memberDeletionRequests.find(r => r.id === requestId);
      if (!request) {
        throw new Error('Deletion request not found');
      }

      await memberDeletionRequestService.update(requestId, {
        status: 'rejected',
        reviewedBy: userProfile.uid,
        reviewedByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim(),
        reviewedAt: new Date().toISOString(),
        adminNotes: adminNotes || 'Request rejected by administrator'
      });

      showToast('success', 'Request Rejected',
        `Deletion request for ${request.memberName} has been rejected.`);
    } catch (error: any) {
      console.error('❌ Failed to reject deletion request:', error);
      setError(error.message);
      showToast('error', 'Failed to reject deletion request', error.message);
      throw error;
    }
  }, [memberDeletionRequests, userProfile, showToast]);

  // Cleanup old deletion requests (run periodically)
  const cleanupOldDeletionRequests = useCallback(async () => {
    try {
      await memberDeletionRequestService.cleanupOldRequests();
      const expiredCount = await memberDeletionRequestService.handleExpiredRequests();

      if (expiredCount > 0) {
        console.log(`✅ ${expiredCount} expired deletion requests auto-rejected`);
      }

      console.log('✅ Old deletion requests cleaned up');
    } catch (error: any) {
      console.error('❌ Failed to cleanup old deletion requests:', error);
      // Don't show toast for cleanup errors as this runs in background
    }
  }, []);

  // Set up periodic cleanup of old deletion requests
  useEffect(() => {
    if (!firebaseUtils.isReady()) return;

    // Run cleanup immediately
    cleanupOldDeletionRequests();

    // Set up periodic cleanup (every 24 hours)
    const cleanupInterval = setInterval(() => {
      cleanupOldDeletionRequests();
    }, 24 * 60 * 60 * 1000); // 24 hours
    return () => clearInterval(cleanupInterval);
  }, [cleanupOldDeletionRequests]);

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

  // Persist navigation state to sessionStorage whenever it changes
  useEffect(() => {
    sessionStateStorage.saveNavStack(navigationStack);
    sessionStateStorage.saveCurrentTab(currentTab);
  }, [navigationStack, currentTab]);

  // Navigation handlers
  const switchTab = useCallback((tab: TabOption) => {
    // Avoid pushing if navigating to the same tab with same data
    const isSame = currentTab.id === tab.id && JSON.stringify(currentTab.data || null) === JSON.stringify(tab.data || null);
    if (!isSame) {
      // Push current tab onto stack
      setNavigationStack(prev => [...prev, currentTab]);
      prevTabRef.current = currentTab;
    }
    isNavigatingBack.current = false;
    setCurrentTab(tab);
    // Push state to browser history for back/forward integration
    try {
      window.history.pushState({ tab }, '', window.location.href);
    } catch {}
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

  // Deprecated helper kept for compatibility
  const addToNavigationHistory = useCallback((tabId: string, data?: any) => {
    // Push a synthetic tab onto the stack (best-effort)
    setNavigationStack(prev => [...prev, { id: tabId, name: tabId, data }]);
  }, []);

  const navigateBack = useCallback(() => {
    if (navigationStack.length > 0) {
      const next = navigationStack[navigationStack.length - 1];
      isNavigatingBack.current = true;
      setNavigationStack(prev => prev.slice(0, -1));
      prevTabRef.current = currentTab;
      setCurrentTab(next);
      return true;
    }
    // If no stack but not on dashboard, go to dashboard
    if (currentTab.id !== DEFAULT_TAB_ID) {
      isNavigatingBack.current = true;
      prevTabRef.current = currentTab;
      setCurrentTab(FIXED_TABS.find(t => t.id === DEFAULT_TAB_ID) || currentTab);
      return true;
    }
    return false;
  }, [navigationStack, currentTab]);

  const resetToDashboard = useCallback(() => {
    setNavigationStack([]);
    setCurrentTab(FIXED_TABS.find(t => t.id === DEFAULT_TAB_ID) || currentTab);
  }, [currentTab]);

  const canNavigateBack = useCallback(() => {
    // Show back button on all non-dashboard screens
    return currentTab.id !== DEFAULT_TAB_ID;
  }, [currentTab.id]);

  // Apply browser history navigation (back/forward) to our in-app stack
  const applyHistoryNavigation = useCallback((target: TabOption) => {
    const top = navigationStack[navigationStack.length - 1] || null;
    const isBackToTop = top && top.id === target.id && JSON.stringify(top.data || null) === JSON.stringify(target.data || null);

    if (isBackToTop) {
      // Standard back: pop one
      setNavigationStack(prev => prev.slice(0, -1));
      prevTabRef.current = currentTab;
      setCurrentTab(top);
      return;
    }

    // If target exists somewhere in stack, pop until it is on top
    const idx = navigationStack.findIndex(t => t.id === target.id && JSON.stringify(t.data || null) === JSON.stringify(target.data || null));
    if (idx !== -1) {
      setNavigationStack(prev => prev.slice(0, idx));
      prevTabRef.current = currentTab;
      setCurrentTab(target);
      return;
    }

    // Likely a forward navigation: push previous current onto stack and go to target
    prevTabRef.current = currentTab;
    setNavigationStack(prev => [...prev, currentTab]);
    setCurrentTab(target);
  }, [navigationStack, currentTab]);

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
        let profile = await userService.getUserProfile(user.uid);
        // If profile has churchId but churchName might be outdated, fetch church doc
        if (profile?.churchId) {
          try {
            const churchDoc = await userService.getChurch(profile.churchId);
            if (churchDoc && churchDoc.name && churchDoc.name !== profile.churchName) {
              profile = { ...profile, churchName: churchDoc.name } as any;
            }
          } catch (e) {
            console.warn('Unable to sync constituency name from church doc', e);
          }
        }
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

  // One-time cleanup of orphaned confirmation records after initial data load
  useEffect(() => {
    if (members.length > 0 && guests.length >= 0 && sundayConfirmations.length > 0) {
      // Run cleanup once after initial data is loaded
      const runInitialCleanup = async () => {
        try {
          console.log('🧹 Running initial cleanup of orphaned confirmation records...');
          const cleanedCount = await cleanupOrphanedConfirmations();
          if (cleanedCount > 0) {
            console.log(`✅ Initial cleanup completed: ${cleanedCount} orphaned records removed`);
          }
        } catch (error) {
          console.warn('⚠️ Initial cleanup failed:', error);
        }
      };

      // Run cleanup after a short delay to ensure all data is loaded
      const timeout = setTimeout(runInitialCleanup, 2000);
      return () => clearTimeout(timeout);
    }
  }, [members.length, guests.length, sundayConfirmations.length, cleanupOrphanedConfirmations]);

  // Auto-refresh user profile when constituency (churchName) updates via Super Admin dashboard
  useEffect(() => {
  const handler = () => {
      try {
        if (!user) return;
        // Always refresh if current user is admin being updated or a leader potentially affected
        refreshUserProfile();
      } catch (err) {
        console.warn('Failed handling constituencyUpdated event', err);
      }
    };
    window.addEventListener('constituencyUpdated', handler as EventListener);
    return () => window.removeEventListener('constituencyUpdated', handler as EventListener);
  }, [user, refreshUserProfile]);

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

  // Impersonation handlers ---------------------------------------------------
  const startImpersonation = useCallback(async (adminUserId: string, churchId: string) => {
    // Ensure church doc exists (avoid queries against non-existent path causing confusion)
  // (Optional) could create church doc if missing; skipped since helper not available
    if (isImpersonating && impersonatedAdminId === adminUserId && currentChurchId === churchId) return;
    originalChurchContextRef.current = currentChurchId; // store original church
    originalUserProfileRef.current = userProfile; // store original profile
    setIsImpersonating(true);
    setImpersonatedAdminId(adminUserId);
    setCurrentChurchId(churchId);
    firebaseUtils.setChurchContext(churchId);
    // Load the impersonated admin profile (for name, churchName, etc.)
    try {
      const impersonatedProfile = await userService.getUserProfile(adminUserId);
      if (impersonatedProfile) {
        setUserProfile(impersonatedProfile);
        // Reconfigure notification contexts to mimic that admin (best-effort; they may depend on auth rules)
        try {
          setNotificationContext(impersonatedProfile, churchId);
          setNotificationIntegrationContext(impersonatedProfile, churchId);
          setEnhancedNotificationContext(impersonatedProfile, churchId);
        } catch (e) {
          console.warn('Failed to set notification context for impersonation', e);
        }
      }
    } catch (e) {
      console.warn('Unable to fetch impersonated admin profile', e);
    }
    // Reset nav to dashboard for fresh admin view
    const dashboardTab = FIXED_TABS.find(t => t.id === 'dashboard') || { id: 'dashboard', name: 'Dashboard' } as TabOption;
    setCurrentTab(dashboardTab);
    setNavigationStack([]);
    // Clear existing data so listeners reload in new context
    setMembers([]); setBacentas([]); setAttendanceRecords([]); setNewBelievers([]); setSundayConfirmations([]); setGuests([]); setMemberDeletionRequests([]);
    // Trigger manual fetch (listeners will also attach via effect on currentChurchId)
    try { await fetchInitialData(); } catch (e) { console.warn('Impersonation data load failed', e); }
    // Schedule fallback raw fetch if nothing loaded (e.g. due to auth rules) after short delay
    setTimeout(() => {
      if (isImpersonating && firebaseUtils.getCurrentChurchId() === churchId && members.length === 0 && bacentas.length === 0) {
        console.log('[Impersonation] Primary listeners returned no data, invoking raw fallback fetch');
        (async () => { await forceImpersonatedDataReloadRef.current?.(); })();
      }
    }, 1200);
    showToast('info', 'Impersonation', 'Viewing as selected admin');
  }, [isImpersonating, impersonatedAdminId, currentChurchId, userProfile, fetchInitialData, showToast, members.length, bacentas.length]);

  const stopImpersonation = useCallback(async () => {
    if (!isImpersonating) return;
    const restoreChurch = originalChurchContextRef.current;
    const restoreProfile = originalUserProfileRef.current;
    setIsImpersonating(false);
    setImpersonatedAdminId(null);
    if (restoreChurch) {
      setCurrentChurchId(restoreChurch);
      firebaseUtils.setChurchContext(restoreChurch);
    } else {
      firebaseUtils.setChurchContext(null);
    }
    if (restoreProfile) {
      setUserProfile(restoreProfile);
      try {
        setNotificationContext(restoreProfile, restoreChurch || null);
        setNotificationIntegrationContext(restoreProfile, restoreChurch || null);
        setEnhancedNotificationContext(restoreProfile, restoreChurch || null);
      } catch (e) { console.warn('Failed to restore notification context after impersonation', e); }
    }
    setMembers([]); setBacentas([]); setAttendanceRecords([]); setNewBelievers([]); setSundayConfirmations([]); setGuests([]); setMemberDeletionRequests([]);
    try { await fetchInitialData(); } catch (e) { console.warn('Restore after impersonation failed', e); }
    showToast('info', 'Impersonation ended', 'Returned to Super Admin');
  }, [isImpersonating, fetchInitialData, showToast]);

  // Raw fallback fetch (no service abstractions) for impersonation mode
  const forceImpersonatedDataReloadRef = React.useRef<(() => Promise<void>) | null>(null);
  forceImpersonatedDataReloadRef.current = async () => {
    const cid = firebaseUtils.getCurrentChurchId();
    if (!cid || !isImpersonating) return;
    try {
      setIsLoading(true);
      console.log('[Impersonation Raw Fetch] Fetching all collections for church', cid);
      const col = async (name: string) => {
        try { const snap = await getDocs(collection(db, 'churches', cid, name)); return snap.docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) { console.warn('[Impersonation Raw Fetch] Failed', name, e); return []; }
      };
      const [m,b,a,nb,cfg,gu] = await Promise.all([
        col('members'), col('bacentas'), col('attendance'), col('newBelievers'), col('sundayConfirmations'), col('guests')
      ]);
      setMembers(m as any); setBacentas(b as any); setAttendanceRecords(a as any); setNewBelievers(nb as any); setSundayConfirmations(cfg as any); setGuests(gu as any);
      console.log('[Impersonation Raw Fetch] Counts', { members: m.length, bacentas: b.length, attendance: a.length, newBelievers: nb.length, confirmations: cfg.length, guests: gu.length });
      if (m.length === 0 && b.length === 0) {
        showToast('warning', 'No Data Found', 'Target admin church has no records or access is blocked');
      } else {
        showToast('success', 'Data Loaded', 'Impersonated data loaded via fallback');
      }
    } catch (e:any) {
      console.warn('[Impersonation Raw Fetch] Error', e);
      showToast('error', 'Raw fetch failed', e.message || String(e));
    } finally {
      setIsLoading(false);
    }
  };

  // Context value
  const contextValue: AppContextType = {
    // Data
    members,
    attendanceRecords,
  prayerRecords,
    bacentas,
    newBelievers,
    sundayConfirmations,
    guests,
    memberDeletionRequests,

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
    currentChurchId,
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

  // Prayer Operations
  markPrayerHandler,
  clearPrayerHandler,

    // Confirmation Operations
    markConfirmationHandler,
    removeConfirmationHandler,
    cleanupOrphanedConfirmations,

    // Guest Operations
    addGuestHandler,
    updateGuestHandler,
    deleteGuestHandler,
    markGuestConfirmationHandler,
    removeGuestConfirmationHandler,
    convertGuestToMemberHandler,

    // Member Deletion Request Operations
    createDeletionRequestHandler,
    approveDeletionRequestHandler,
    rejectDeletionRequestHandler,

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
    resetToDashboard,
    navigationStack,
    applyHistoryNavigation,
    addToNavigationHistory,

    // Utility
    showToast,
    removeToast,
    exportData,
    importData,

    // Firebase-specific operations
    triggerMigration,
    toggleOfflineMode,
    refreshUserProfile,

    // Outreach
    outreachBacentas,
    outreachMembers,
    allOutreachMembers,
    outreachMonth,
    addOutreachBacentaHandler,
    updateOutreachBacentaHandler,
    deleteOutreachBacentaHandler,
    addOutreachMemberHandler,
    updateOutreachMemberHandler,
    deleteOutreachMemberHandler,
    convertOutreachMemberToPermanentHandler,
    addMultipleOutreachMembersHandler,
    setOutreachMonth,
  // Impersonation
  isImpersonating,
  impersonatedAdminId,
  startImpersonation,
  stopImpersonation,
  forceImpersonatedDataReload: () => forceImpersonatedDataReloadRef.current ? forceImpersonatedDataReloadRef.current() : Promise.resolve(),
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
