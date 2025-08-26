// Firebase-enabled App Context
import React, { createContext, useState, useEffect, useCallback, ReactNode, useMemo, useRef } from 'react';
import { collection, getDocs, onSnapshot, query as fsQuery, where as fsWhere } from 'firebase/firestore';
import { db } from '../firebase.config';
import { Member, AttendanceRecord, Bacenta, TabOption, AttendanceStatus, NewBeliever, SundayConfirmation, ConfirmationStatus, Guest, MemberDeletionRequest, OutreachBacenta, OutreachMember, PrayerRecord, PrayerStatus, MeetingRecord, TitheRecord, CrossTenantAccessLink, CrossTenantPermission } from '../types';
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
  outreachBacentasFirebaseService,
  outreachMembersFirebaseService,
  prayerFirebaseService,
  meetingRecordsFirebaseService,
  titheFirebaseService,
  FirebaseUser
} from '../services/firebaseService';
import { crossTenantService } from '../services/crossTenantService';
import { dataMigrationService } from '../utils/dataMigration';
import { userService } from '../services/userService';
import { setNotificationContext } from '../services/notificationService';
import {
  memberOperationsWithNotifications,
  newBelieverOperationsWithNotifications,
  confirmationOperationsWithNotifications,
  setNotificationIntegrationContext
} from '../services/notificationIntegration';
import { setEnhancedNotificationContext } from '../services/enhancedNotificationIntegration';
import { getMinistryAggregatedData, setupMinistryDataListeners } from '../services/ministryDataService';
import {
  ministryMembersService,
  ministryAttendanceService,
  ministryNewBelieversService
} from '../services/ministryFirebaseService';

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
  meetingRecords: MeetingRecord[];
  titheRecords: TitheRecord[];

  // UI State
  currentTab: TabOption;
  isLoading: boolean;
  error: string | null;
  displayedSundays: string[];
  displayedDate: Date;

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
  // Context flags
  isMinistryContext: boolean;
  activeMinistryName?: string;

  // Data Operations
  fetchInitialData: () => Promise<void>;
  addMemberHandler: (memberData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>) => Promise<string>;
  addMultipleMembersHandler: (membersData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>[]) => Promise<{ successful: Member[], failed: { data: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>, error: string }[] }>;
  updateMemberHandler: (memberData: Member) => Promise<void>;
  deleteMemberHandler: (memberId: string) => Promise<void>;
  transferMemberToConstituencyHandler: (memberId: string, targetConstituencyId: string) => Promise<void>;

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

  // Meeting Record Operations
  saveMeetingRecordHandler: (record: MeetingRecord) => Promise<void>;
  updateMeetingRecordHandler: (record: MeetingRecord) => Promise<void>;
  deleteMeetingRecordHandler: (id: string) => Promise<void>;
  getMeetingRecordHandler: (bacentaId: string, date: string) => Promise<MeetingRecord | null>;

  // Tithe Operations
  markTitheHandler: (memberId: string, paid: boolean, amount: number) => Promise<void>;

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
  cleanupDuplicateGuests: () => Promise<void>;

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

  // Cross-tenant switching (admin-to-admin access links)
  accessibleChurchLinks: CrossTenantAccessLink[];
  refreshAccessibleChurchLinks: () => Promise<void>;
  switchToExternalChurch: (link: CrossTenantAccessLink) => Promise<void>;
  switchBackToOwnChurch: () => Promise<void>;
  currentExternalPermission: CrossTenantPermission | null;

  // Outreach data/state
  outreachBacentas: OutreachBacenta[];
  outreachMembers: OutreachMember[];
  allOutreachMembers: OutreachMember[];
  outreachMonth: string;
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
  const [meetingRecords, setMeetingRecords] = useState<MeetingRecord[]>([]);
  const [titheRecords, setTitheRecords] = useState<TitheRecord[]>([]);

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

  // Optimistic update tracking to prevent listener conflicts
  const optimisticUpdatesRef = useRef<Set<string>>(new Set());
  const optimisticTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  
  // Derived flags
  const isMinistryContext = useMemo(() => {
    const ministryId = userProfile?.contexts?.ministryChurchId;
    // Also check if current church ID looks like a ministry church
    const currentChurchIdFromUtils = firebaseUtils.getCurrentChurchId();
    const isMinistryChurch = currentChurchIdFromUtils?.includes('ministry') || currentChurchId?.includes('ministry');

    const result = Boolean(
      (currentChurchId && ministryId && currentChurchId === ministryId) ||
      (currentChurchIdFromUtils && ministryId && currentChurchIdFromUtils === ministryId) ||
      (isMinistryChurch && userProfile?.preferences?.ministryName)
    );

    console.log('🔍 [Debug] Ministry context calculation:', {
      currentChurchId,
      currentChurchIdFromUtils,
      ministryId,
      isMinistryChurch,
      hasMinistryName: !!userProfile?.preferences?.ministryName,
      isMinistryContext: result,
      userProfile: userProfile ? 'loaded' : 'null'
    });
    return result;
  }, [currentChurchId, userProfile]);
  const activeMinistryName = useMemo(() => {
    const ministryName = (userProfile?.preferences?.ministryName as string) || '';
    console.log('🔍 [Debug] Active ministry name:', ministryName, 'from userProfile:', userProfile);
    return ministryName;
  }, [userProfile]);

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
  // Cross-tenant state
  const [accessibleChurchLinks, setAccessibleChurchLinks] = useState<CrossTenantAccessLink[]>([]);
  const [currentExternalPermission, setCurrentExternalPermission] = useState<CrossTenantPermission | null>(null);

  // Memoized computed values
  const displayedSundays = useMemo(() => {
    return getSundaysOfMonth(displayedDate.getFullYear(), displayedDate.getMonth());
  }, [displayedDate]);

  // Real-time listener: keep cross-tenant access links in sync for current user
  useEffect(() => {
    if (!user?.uid) return;
    const q = fsQuery(collection(db, 'crossTenantAccessLinks'), fsWhere('viewerUid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      try {
        let items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any[];
        items = items.filter(i => !(i as any).revoked);
        items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setAccessibleChurchLinks(items as any);
      } catch (e) {
        console.warn('crossTenantAccessLinks onSnapshot parse failed', e);
      }
    }, (err) => {
      console.warn('crossTenantAccessLinks onSnapshot error', err);
    });
    return () => unsub();
  }, [user?.uid]);

  // Current month in YYYY-MM
  const getCurrentMonth = useCallback(() => {
    const y = displayedDate.getFullYear();
    const m = String(displayedDate.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
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
              // Load cross-tenant accessible links for this admin
              try {
                const links = await crossTenantService.getAccessibleChurchLinks(user.uid);
                setAccessibleChurchLinks(links);
              } catch (e) {
                console.warn('Failed to load accessible church links (initial)', e);
              }

              // Set up notification context if we have church context
              const churchId = firebaseUtils.getCurrentChurchId();
              setCurrentChurchId(churchId);
              // SAFEGUARD: If active context isn't set yet or mismatched, align to the user's profile church immediately
              try {
                const targetChurchId = profile?.churchId || null;
                const ctxId = firebaseUtils.getCurrentChurchId();
                if (targetChurchId && targetChurchId !== ctxId) {
                  console.log('[AuthSync] Setting church context from profile', { targetChurchId, ctxId });
                  firebaseUtils.setChurchContext(targetChurchId);
                  setCurrentChurchId(targetChurchId);
                }
              } catch {}
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
            setAccessibleChurchLinks([]);
            setCurrentExternalPermission(null);
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

  // Ensure church context stays aligned with the loaded profile (prevents data flicker for invited leaders)
  useEffect(() => {
    try {
      const profileChurchId = userProfile?.churchId || null;
      const ctxChurchId = firebaseUtils.getCurrentChurchId();
      // If we have a profile with a church but context is missing/mismatched, fix it and reattach listeners
      if (profileChurchId && profileChurchId !== ctxChurchId) {
        console.log('[ContextSync] Aligning church context with profile', { profileChurchId, ctxChurchId });
        firebaseUtils.setChurchContext(profileChurchId);
        setCurrentChurchId(profileChurchId);
    // Listener setup will react to currentChurchId change via existing effect
      }
    } catch (e) {
      // noop
    }
  }, [userProfile?.churchId]);

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
      // If we are in ministry context, temporarily target the default church for read listeners
      const originalChurchId = firebaseUtils.getCurrentChurchId();
  if (isMinistryContext) {
        const defaultChurchId = userProfile?.contexts?.defaultChurchId || userProfile?.churchId;
        if (defaultChurchId && originalChurchId !== defaultChurchId) {
          firebaseUtils.setChurchContext(defaultChurchId);
        }
      }
      // In ministry mode with specific ministry, use cross-church aggregation
      console.log('🔍 [Debug] Listener setup check:', {
        isMinistryContext,
        activeMinistryName,
        trimmedMinistryName: (activeMinistryName || '').trim(),
        willUseMinistryListeners: isMinistryContext && (activeMinistryName || '').trim() !== ''
      });

      if (isMinistryContext && (activeMinistryName || '').trim() !== '') {
        console.log('🔄 Setting up ministry data listeners for:', activeMinistryName);
        const unsubscribeMinistryData = setupMinistryDataListeners(activeMinistryName, (data) => {
          console.log('📊 Ministry listener data received:', {
            members: data.members.length,
            bacentas: data.bacentas.length,
            attendance: data.attendanceRecords.length,
            newBelievers: data.newBelievers.length,
            confirmations: data.sundayConfirmations.length,
            guests: data.guests.length,
            sourceChurches: data.sourceChurches.length
          });

          setMembers(data.members);
          setBacentas(data.bacentas);

          // Smart merge for attendance records to preserve optimistic updates
          setAttendanceRecords(prev => {
            // Get optimistically updated records
            const optimisticRecords = prev.filter(record =>
              optimisticUpdatesRef.current.has(record.id)
            );

            // Get new records that aren't optimistically updated
            const newRecords = data.attendanceRecords.filter(record =>
              !optimisticUpdatesRef.current.has(record.id)
            );

            // Combine optimistic and new records
            const combined = [...optimisticRecords, ...newRecords];

            console.log('🔄 Smart attendance merge:', {
              optimistic: optimisticRecords.length,
              new: newRecords.length,
              total: combined.length,
              optimisticIds: Array.from(optimisticUpdatesRef.current)
            });

            return combined;
          });

          setNewBelievers(data.newBelievers);
          setSundayConfirmations(data.sundayConfirmations);
          setGuests(data.guests);
        }, optimisticUpdatesRef, userProfile?.churchId);
        unsubscribers.push(unsubscribeMinistryData);

        // Even in ministry mode, listen to deletion requests tied to the current (active) church context
        const unsubscribeDeletionRequests = memberDeletionRequestService.onSnapshot((requests) => {
          setMemberDeletionRequests(requests);
        });
        unsubscribers.push(unsubscribeDeletionRequests);
      } else {
        // Normal mode or ministry mode without specific ministry
        const unsubscribeMembers = membersFirebaseService.onSnapshot((members) => {
          if (isMinistryContext) {
            // If ministry mode but no explicit ministry selected, limit to those with any ministry
            setMembers(members.filter(m => (m.ministry || '').trim() !== ''));
          } else {
            setMembers(members);
          }
        });
        unsubscribers.push(unsubscribeMembers);
        // Listen to bacentas (always; in ministry mode reads from default church due to switch above)
        const unsubscribeBacentas = bacentasFirebaseService.onSnapshot((bacentas) => {
          setBacentas(bacentas);
        });
        unsubscribers.push(unsubscribeBacentas);

        // Listen to outreach bacentas (always)
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

        // Listen to new believers (filter by ministry in ministry mode)
        const unsubscribeNewBelievers = isMinistryContext && (activeMinistryName || '').trim() !== ''
          ? newBelieversFirebaseService.onSnapshotByMinistry(activeMinistryName, (items) => setNewBelievers(items))
          : newBelieversFirebaseService.onSnapshot((items) => {
              if (isMinistryContext) {
                setNewBelievers(items.filter(n => (n.ministry || '').trim() !== ''));
              } else {
                setNewBelievers(items);
              }
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

        // Listen to member deletion requests (for leader/admin UIs relying on context)
        const unsubscribeDeletionRequests = memberDeletionRequestService.onSnapshot((requests) => {
          setMemberDeletionRequests(requests);
        });
        unsubscribers.push(unsubscribeDeletionRequests);

        // Tithe listener for current month
        const month = getCurrentMonth();
        const unsubTithes = titheFirebaseService.onSnapshotByMonth(month, (items) => {
          setTitheRecords(items);
        });
        unsubscribers.push(unsubTithes);

        // Persist cleanup
        listenersCleanupRef.current = () => {
          unsubscribers.forEach((u) => {
            try { u(); } catch {}
          });
        console.log('[Listeners] Cleaned up listeners for church', firebaseUtils.getCurrentChurchId());
        };
      }
    } catch (error: any) {
      setError(error.message);
    }
  }, [isImpersonating, isMinistryContext, activeMinistryName, outreachMonth, userProfile, displayedDate]);

  // React when church or context changes to (re)attach listeners
  useEffect(() => {
    console.log('🔄 [Debug] Listener effect triggered:', {
      isReady: firebaseUtils.isReady(),
      currentChurchId,
      isMinistryContext,
      activeMinistryName
    });
    if (firebaseUtils.isReady()) {
      setupDataListeners();
    }
    // Cleanup on dependency change or unmount
    return () => {
      if (listenersCleanupRef.current) {
        try { listenersCleanupRef.current(); } catch {}
      }
    };
  }, [currentChurchId, isMinistryContext, activeMinistryName, setupDataListeners]);

  // Fetch initial data (for manual refresh)
  const fetchInitialData = useCallback(async () => {
    if (!isImpersonating && !firebaseUtils.isReady()) return;
    if (!firebaseUtils.getCurrentChurchId()) return;
    console.log('[fetchInitialData] church=', firebaseUtils.getCurrentChurchId(), 'impersonating?', isImpersonating, 'ready?', firebaseUtils.isReady());

    try {
      setIsLoading(true);
      setError(null);

      // If in ministry context, temporarily read from default church for initial fetch
      const originalChurchId = firebaseUtils.getCurrentChurchId();
      let switchedForReads = false;
      if (isMinistryContext) {
        const defaultChurchId = userProfile?.contexts?.defaultChurchId || userProfile?.churchId;
        if (defaultChurchId && originalChurchId !== defaultChurchId) {
          firebaseUtils.setChurchContext(defaultChurchId);
          switchedForReads = true;
        }
      }

      // Use ministry data service for cross-church aggregation in ministry mode (like SuperAdmin)
      console.log('🔍 [Debug] Ministry context check:', {
        isMinistryContext,
        activeMinistryName,
        trimmedMinistryName: (activeMinistryName || '').trim(),
        userProfile,
        currentChurchId
      });

      if (isMinistryContext && (activeMinistryName || '').trim() !== '') {
        console.log('🔄 [Ministry Mode] Fetching cross-church data like SuperAdmin for:', activeMinistryName);
        try {
          const ministryData = await getMinistryAggregatedData(activeMinistryName, userProfile?.churchId);

          setMembers(ministryData.members);
          setBacentas(ministryData.bacentas);
          setAttendanceRecords(ministryData.attendanceRecords);
          setNewBelievers(ministryData.newBelievers);
          setSundayConfirmations(ministryData.sundayConfirmations);
          setGuests(ministryData.guests);

          // Still fetch prayer data from current church
          const prayerData = await prayerFirebaseService.getAll();
          setPrayerRecords(prayerData);

          console.log('✅ [Ministry Mode] Cross-church data loaded (SuperAdmin style):', {
            members: ministryData.members.length,
            bacentas: ministryData.bacentas.length,
            attendance: ministryData.attendanceRecords.length,
            newBelievers: ministryData.newBelievers.length,
            confirmations: ministryData.sundayConfirmations.length,
            guests: ministryData.guests.length,
            sourceChurches: ministryData.sourceChurches.length
          });
        } catch (error) {
          console.error('❌ [Ministry Mode] Failed to fetch cross-church data:', error);
          // Fallback to normal data fetching
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
        }
      } else {
        // Normal mode - fetch from current church only
        const [membersData, bacentasData, attendanceData, newBelieversData, confirmationsData, prayerData, meetingData] = await Promise.all([
          membersFirebaseService.getAll(),
          bacentasFirebaseService.getAll(),
          attendanceFirebaseService.getAll(),
          newBelieversFirebaseService.getAll(),
          confirmationFirebaseService.getAll(),
          prayerFirebaseService.getAll(),
          meetingRecordsFirebaseService.getAll()
        ]);

        setMembers(membersData);
        setBacentas(bacentasData);
        setAttendanceRecords(attendanceData);
        setNewBelievers(newBelieversData);
        setSundayConfirmations(confirmationsData);
        setPrayerRecords(prayerData);
        setMeetingRecords(meetingData);
      }

      // Restore original context after reads
      if (switchedForReads) {
        firebaseUtils.setChurchContext(originalChurchId);
      }

      // Data is already set above in the ministry/normal mode blocks
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

  // Guard: block writes when impersonating in read-only external context
  const ensureCanWrite = useCallback(() => {
    if (isImpersonating && currentExternalPermission === 'read-only') {
      showToast('warning', 'Read-only access', 'You cannot make changes in this church.');
      return false;
    }
    return true;
  }, [isImpersonating, currentExternalPermission, showToast]);

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
    if (!ensureCanWrite()) throw new Error('Read-only access');
    try {
      setIsLoading(true);
      // In ministry context, auto-tag to selected ministry and allow no bacenta
      const payload: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'> = isMinistryContext
        ? {
            ...memberData,
            ministry: memberData.ministry || activeMinistryName || memberData.ministry,
            bacentaId: memberData.bacentaId || ''
          }
        : memberData;
      // Use ministry service for bidirectional sync in ministry mode
      const newMemberId = isMinistryContext
        ? await ministryMembersService.add(payload, userProfile)
        : await memberOperationsWithNotifications.add(payload);

      showToast('success', isMinistryContext
        ? 'Member added successfully (synced to source church)'
        : 'Member added successfully');
      return newMemberId;
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to add member', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast, isMinistryContext, activeMinistryName]);

  const addMultipleMembersHandler = useCallback(async (membersData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>[]) => {
    if (!ensureCanWrite()) throw new Error('Read-only access');
    const successful: Member[] = [];
    const failed: { data: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>, error: string }[] = [];

    try {
      setIsLoading(true);

      for (const memberData of membersData) {
        try {
          const payload: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'> = isMinistryContext
            ? {
                ...memberData,
                ministry: memberData.ministry || activeMinistryName || memberData.ministry,
                bacentaId: memberData.bacentaId || ''
              }
            : memberData;
          const memberId = await memberOperationsWithNotifications.add(payload);
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
  }, [showToast, isMinistryContext, activeMinistryName]);

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
  if (!ensureCanWrite()) throw new Error('Read-only access');
    try {
      setIsLoading(true);
      const original = members.find(m => m.id === memberData.id);

      // Use ministry service for bidirectional sync in ministry mode
      if (isMinistryContext) {
        // Calculate the updates (difference between original and new)
        const updates: Partial<Member> = {};
        Object.keys(memberData).forEach(key => {
          const typedKey = key as keyof Member;
          if (original && memberData[typedKey] !== original[typedKey]) {
            (updates as any)[typedKey] = memberData[typedKey];
          }
        });

        await ministryMembersService.update(memberData.id, updates, userProfile);
        showToast('success', 'Member updated successfully (synced to source church)');
      } else {
        await memberOperationsWithNotifications.update(memberData.id, memberData, original || undefined);
        showToast('success', 'Member updated successfully');
      }
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to update member', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast, members]);

  const deleteMemberHandler = useCallback(async (memberId: string) => {
  if (!ensureCanWrite()) throw new Error('Read-only access');
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

      // Use ministry service for bidirectional sync in ministry mode
      const memberName = `${memberToDelete.firstName} ${memberToDelete.lastName || ''}`.trim();

      if (isMinistryContext) {
        await ministryMembersService.delete(memberId, userProfile);
        showToast('success', 'Member removed from ministry (preserved in source church)');
      } else {
        await memberOperationsWithNotifications.delete(memberId, memberName);
        showToast('success', 'Member deleted successfully');
      }

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
  if (!ensureCanWrite()) throw new Error('Read-only access');
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
  if (!ensureCanWrite()) throw new Error('Read-only access');
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
  if (!ensureCanWrite()) throw new Error('Read-only access');
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
  if (!ensureCanWrite()) throw new Error('Read-only access');
    try {
      setIsLoading(true);
      // Use ministry service for bidirectional sync in ministry mode
      if (isMinistryContext) {
        await ministryNewBelieversService.add(newBelieverData, userProfile);
        showToast('success', 'New believer added successfully (synced to source church)');
      } else {
        await newBelieverOperationsWithNotifications.add(newBelieverData);
        showToast('success', 'New believer added successfully');
      }
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to add new believer', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const addMultipleNewBelieversHandler = useCallback(async (newBelieversData: Omit<NewBeliever, 'id' | 'createdDate' | 'lastUpdated'>[]) => {
  if (!ensureCanWrite()) throw new Error('Read-only access');
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
  if (!ensureCanWrite()) throw new Error('Read-only access');
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
  if (!ensureCanWrite()) throw new Error('Read-only access');
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
  if (!ensureCanWrite()) throw new Error('Read-only access');
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
  if (!ensureCanWrite()) throw new Error('Read-only access');
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
  if (!ensureCanWrite()) throw new Error('Read-only access');
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

  // Helper function to find or create guest with deduplication
  const findOrCreateGuest = useCallback(async (guestData: Omit<Guest, 'id' | 'createdDate' | 'lastUpdated' | 'createdBy'>): Promise<string> => {
    // Check for existing guest with same name in same bacenta to prevent duplicates
    const existingGuest = guests.find(g =>
      g.bacentaId === guestData.bacentaId &&
      g.firstName.toLowerCase().trim() === guestData.firstName.toLowerCase().trim() &&
      (g.lastName || '').toLowerCase().trim() === (guestData.lastName || '').toLowerCase().trim()
    );

    if (existingGuest) {
      console.log(`Using existing guest: ${existingGuest.firstName} ${existingGuest.lastName || ''} (ID: ${existingGuest.id})`);
      return existingGuest.id;
    } else {
      // Create new guest
      const now = new Date().toISOString();
      const fullGuest: Omit<Guest, 'id'> = {
        ...guestData,
        createdDate: now,
        lastUpdated: now,
        createdBy: userProfile?.uid || 'system'
      } as any;
      const guestId = await guestFirebaseService.add(fullGuest as any);
      console.log(`Created new guest: ${guestData.firstName} ${guestData.lastName || ''} (ID: ${guestId})`);
      return guestId;
    }
  }, [guests, userProfile]);

  // Helper function to clean up duplicate guests
  const cleanupDuplicateGuests = useCallback(async () => {
    try {
      console.log('🧹 Starting duplicate guest cleanup...');

      // Group guests by bacenta and name combination
      const guestGroups = new Map<string, Guest[]>();

      guests.forEach(guest => {
        const key = `${guest.bacentaId}_${guest.firstName.toLowerCase().trim()}_${(guest.lastName || '').toLowerCase().trim()}`;
        if (!guestGroups.has(key)) {
          guestGroups.set(key, []);
        }
        guestGroups.get(key)!.push(guest);
      });

      // Find and process duplicate groups
      let duplicatesFound = 0;
      let duplicatesRemoved = 0;

      for (const [key, guestGroup] of guestGroups) {
        if (guestGroup.length > 1) {
          duplicatesFound += guestGroup.length - 1;
          console.log(`Found ${guestGroup.length} duplicates for: ${key}`);

          // Keep the oldest guest (first created) and remove the rest
          const sortedGuests = guestGroup.sort((a, b) =>
            new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime()
          );
          const keepGuest = sortedGuests[0];
          const duplicatesToRemove = sortedGuests.slice(1);

          console.log(`Keeping guest ${keepGuest.id}, removing ${duplicatesToRemove.length} duplicates`);

          // Remove duplicate guests and their confirmations
          for (const duplicate of duplicatesToRemove) {
            try {
              // Remove any confirmations for this duplicate guest
              const duplicateConfirmations = sundayConfirmations.filter(c => c.guestId === duplicate.id);
              for (const confirmation of duplicateConfirmations) {
                await confirmationFirebaseService.delete(confirmation.id);
                console.log(`Removed confirmation ${confirmation.id} for duplicate guest ${duplicate.id}`);
              }

              // Remove the duplicate guest
              await guestFirebaseService.delete(duplicate.id);
              duplicatesRemoved++;
              console.log(`Removed duplicate guest ${duplicate.id}: ${duplicate.firstName} ${duplicate.lastName || ''}`);
            } catch (error) {
              console.error(`Failed to remove duplicate guest ${duplicate.id}:`, error);
            }
          }
        }
      }

      if (duplicatesFound > 0) {
        showToast('success', 'Duplicate Cleanup Complete', `Removed ${duplicatesRemoved} duplicate guests`);
        console.log(`🧹 Cleanup complete: Found ${duplicatesFound} duplicates, removed ${duplicatesRemoved}`);
      } else {
        console.log('🧹 No duplicate guests found');
      }

    } catch (error) {
      console.error('Failed to cleanup duplicate guests:', error);
      showToast('error', 'Cleanup Failed', 'Failed to remove duplicate guests');
    }
  }, [guests, sundayConfirmations, showToast]);

  const addOutreachMemberHandler = useCallback(async (data: Omit<OutreachMember, 'id' | 'createdDate' | 'lastUpdated'>): Promise<string> => {
  if (!ensureCanWrite()) throw new Error('Read-only access');
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
        const guestId = await findOrCreateGuest(guestPayload);

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
  }, [findOrCreateGuest, showToast, userProfile]);

  const updateOutreachMemberHandler = useCallback(async (id: string, updates: Partial<OutreachMember>) => {
  if (!ensureCanWrite()) throw new Error('Read-only access');
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
                guestId = await findOrCreateGuest(guestPayload);
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
  }, [findOrCreateGuest, showToast, outreachMembers, userProfile]);

  const deleteOutreachMemberHandler = useCallback(async (id: string) => {
  if (!ensureCanWrite()) throw new Error('Read-only access');
    try {
      setIsLoading(true);
      const { hasAdminPrivileges } = await import('../utils/permissionUtils');

      // If not admin, do NOT delete now — create a deletion request for admin approval
      if (!hasAdminPrivileges(userProfile)) {
        const om = outreachMembers.find(o => o.id === id);
        if (!om) throw new Error('Outreach member not found');

        const hasPending = await memberDeletionRequestService.hasPendingRequest(id);
        if (hasPending) {
          showToast('warning', 'Request Already Exists', `A deletion request for ${om.name} is already pending admin approval.`);
          return;
        }

        await memberDeletionRequestService.create({
          memberId: id,
          memberName: om.name,
          requestedBy: userProfile?.uid,
          requestedByName: `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim(),
          reason: 'Outreach deletion requested by leader',
          churchId: userProfile?.churchId || '',
          // custom flag so approval knows to delete outreach entity
          target: 'outreach'
        } as any);

  // Keep behavior consistent with member deletion requests: no immediate "deleted" notifications
  showToast('success', 'Deletion Request Submitted', `Your request to delete ${om.name} has been submitted for admin approval.`);
        return;
      }

      // Admin path: proceed to delete now with all cleanups
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
  }, [showToast, outreachMembers, sundayConfirmations, deleteMemberHandler, members, userProfile]);

  const convertOutreachMemberToPermanentHandler = useCallback(async (outreachMemberId: string) => {
  if (!ensureCanWrite()) throw new Error('Read-only access');
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

      // Notify linked admins that the leader converted someone to member
      try {
        const { createNotificationHelpers } = await import('../services/notificationService');
        const leaderName = userProfile?.displayName || `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || 'Unknown Leader';
        await createNotificationHelpers.memberConverted(leaderName, om.name, 'outreach');
      } catch (notifyErr) {
        console.warn('⚠️ Failed to send conversion notification:', notifyErr);
      }

      showToast('success', 'Converted to permanent member');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to convert outreach member', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [outreachMembers, sundayConfirmations, showToast]);

  // Meeting Record handlers
  const saveMeetingRecordHandler = useCallback(async (record: MeetingRecord) => {
  if (!ensureCanWrite()) throw new Error('Read-only access');
    try {
      setIsLoading(true);
      await meetingRecordsFirebaseService.addOrUpdate(record);

      // Update local state
      setMeetingRecords(prev => {
        const existingIndex = prev.findIndex(r => r.id === record.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = record;
          return updated;
        } else {
          return [record, ...prev];
        }
      });

      showToast('success', 'Meeting record saved successfully');

      // Notify admins: meeting record added
      try {
        const { createNotificationHelpers } = await import('../services/notificationService');
        const leaderName = userProfile?.displayName || `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || 'Unknown Leader';
        const bacentaName = bacentas.find(b => b.id === record.bacentaId)?.name || 'Unknown Bacenta';
        const totals = {
          attendance: (record.presentMemberIds?.length || 0) + (record.firstTimers || 0),
          firstTimers: record.firstTimers || 0,
          converts: record.converts || 0,
          cash: record.cashOffering || 0,
          online: record.onlineOffering || 0,
          offering: record.totalOffering ?? ((record.cashOffering || 0) + (record.onlineOffering || 0))
        };
        await createNotificationHelpers.meetingRecordAdded(leaderName, bacentaName, record.date, totals);
      } catch (notifyErr) {
        console.warn('⚠️ Failed to send meeting added notification:', notifyErr);
      }
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to save meeting record', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast, userProfile, bacentas]);

  const updateMeetingRecordHandler = useCallback(async (record: MeetingRecord) => {
  if (!ensureCanWrite()) throw new Error('Read-only access');
    try {
      setIsLoading(true);
      const original = meetingRecords.find(r => r.id === record.id);
      await meetingRecordsFirebaseService.addOrUpdate(record);

      // Update local state
      setMeetingRecords(prev =>
        prev.map(r => r.id === record.id ? record : r)
      );

      showToast('success', 'Meeting record updated successfully');

      // Notify admins: meeting record updated
      try {
        const { createNotificationHelpers } = await import('../services/notificationService');
        const leaderName = userProfile?.displayName || `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || 'Unknown Leader';
        const bacentaName = bacentas.find(b => b.id === record.bacentaId)?.name || 'Unknown Bacenta';

        // Compute simple change summary
        const changes: string[] = [];
        if (original) {
          const len = (a?: any[]) => (Array.isArray(a) ? a.length : 0);
          if (len(original.presentMemberIds) !== len(record.presentMemberIds)) changes.push('Attendance');
          if ((original.firstTimers || 0) !== (record.firstTimers || 0)) changes.push('First Timers');
          if ((original.converts || 0) !== (record.converts || 0)) changes.push('Converts');
          if ((original.cashOffering || 0) !== (record.cashOffering || 0)) changes.push('Cash Offering');
          if ((original.onlineOffering || 0) !== (record.onlineOffering || 0)) changes.push('Online Offering');
          if ((original.totalOffering || 0) !== (record.totalOffering || 0)) changes.push('Total Offering');
          if ((original.messagePreached || '') !== (record.messagePreached || '')) changes.push('Message');
          if ((original.discussionLedBy || '') !== (record.discussionLedBy || '')) changes.push('Discussion');
          if (len(original.guests) !== len(record.guests)) changes.push('Guests');
          if ((original.meetingImage || '') !== (record.meetingImage || '')) changes.push('Image');
        }

        const totals = {
          attendance: (record.presentMemberIds?.length || 0) + (record.firstTimers || 0),
          firstTimers: record.firstTimers || 0,
          converts: record.converts || 0,
          cash: record.cashOffering || 0,
          online: record.onlineOffering || 0,
          offering: record.totalOffering ?? ((record.cashOffering || 0) + (record.onlineOffering || 0))
        };
        await createNotificationHelpers.meetingRecordUpdated(leaderName, bacentaName, record.date, changes, totals);
      } catch (notifyErr) {
        console.warn('⚠️ Failed to send meeting updated notification:', notifyErr);
      }
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to update meeting record', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast, meetingRecords, userProfile, bacentas]);

  const deleteMeetingRecordHandler = useCallback(async (id: string) => {
  if (!ensureCanWrite()) throw new Error('Read-only access');
    try {
      setIsLoading(true);
      const original = meetingRecords.find(r => r.id === id) || null;
      await meetingRecordsFirebaseService.delete(id);

      // Update local state
      setMeetingRecords(prev => prev.filter(r => r.id !== id));

      showToast('success', 'Meeting record deleted successfully');

      // Notify admins: meeting record deleted
      try {
        const { createNotificationHelpers } = await import('../services/notificationService');
        const leaderName = userProfile?.displayName || `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || 'Unknown Leader';

        // Derive bacentaId and date if not available
        let bacentaId = original?.bacentaId || '';
        let date = original?.date || '';
        if (!bacentaId || !date) {
          const idx = id.lastIndexOf('_');
          if (idx > 0) {
            bacentaId = id.substring(0, idx);
            date = id.substring(idx + 1);
          }
        }
        const bacentaName = bacentas.find(b => b.id === bacentaId)?.name || 'Unknown Bacenta';
        await createNotificationHelpers.meetingRecordDeleted(leaderName, bacentaName, date || '');
      } catch (notifyErr) {
        console.warn('⚠️ Failed to send meeting deleted notification:', notifyErr);
      }
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to delete meeting record', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast, meetingRecords, userProfile, bacentas]);

  const getMeetingRecordHandler = useCallback(async (bacentaId: string, date: string): Promise<MeetingRecord | null> => {
    try {
      return await meetingRecordsFirebaseService.getByBacentaAndDate(bacentaId, date);
    } catch (error: any) {
      console.error('Failed to get meeting record:', error.message);
      return null;
    }
  }, []);

  // Tithe handlers
  const markTitheHandler = useCallback(async (memberId: string, paid: boolean, amount: number) => {
  if (!ensureCanWrite()) throw new Error('Read-only access');
    try {
      // Only allow saving for the current calendar month
      const now = new Date();
      if (now.getFullYear() !== displayedDate.getFullYear() || now.getMonth() !== displayedDate.getMonth()) {
        showToast('warning', 'Past month is locked', 'You can only edit the current month. Use arrows to change month to current.');
        return;
      }
      const y = displayedDate.getFullYear();
      const m = String(displayedDate.getMonth() + 1).padStart(2, '0');
      const month = `${y}-${m}`;

      await titheFirebaseService.addOrUpdate({
        memberId,
        month,
        paid,
        amount: Math.max(0, Number(amount) || 0)
      });

      // Optimistic local update
      const id = `${memberId}_${month}`;
      setTitheRecords(prev => {
        const next = [...prev];
        const idx = next.findIndex(t => t.id === id);
        const rec: TitheRecord = { id, memberId, month, paid, amount: Math.max(0, Number(amount) || 0), lastUpdated: new Date().toISOString() };
        if (idx >= 0) next[idx] = rec; else next.push(rec);
        return next;
      });

      showToast('success', 'Tithe updated');
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to update tithe', error.message);
      throw error;
    }
  }, [displayedDate, showToast]);

  // Attendance handlers
  const markAttendanceHandler = useCallback(async (memberId: string, date: string, status: AttendanceStatus) => {
  if (!ensureCanWrite()) throw new Error('Read-only access');
    try {
      const recordId = `${memberId}_${date}`;
      const record: AttendanceRecord = {
        id: recordId,
        memberId,
        date,
        status
      };

      console.log('📝 Marking attendance:', recordId, status);

      // Enhanced optimistic update with conflict prevention
      const applyOptimisticUpdate = () => {
        // Mark this record as optimistically updated
        optimisticUpdatesRef.current.add(recordId);

        // Clear any existing timeout for this record
        const existingTimeout = optimisticTimeoutsRef.current.get(recordId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        // Update local state immediately
        setAttendanceRecords(prev => {
          const filtered = prev.filter(a => a.id !== recordId);
          return [...filtered, record];
        });

        // Set timeout to clear optimistic flag (prevents permanent blocking)
        const timeout = setTimeout(() => {
          optimisticUpdatesRef.current.delete(recordId);
          optimisticTimeoutsRef.current.delete(recordId);
        }, 3000); // 3 second safety timeout

        optimisticTimeoutsRef.current.set(recordId, timeout);
      };

      // Apply optimistic update immediately
      applyOptimisticUpdate();

      try {
        // Use ministry service for bidirectional sync in ministry mode
        if (isMinistryContext) {
          console.log(`🔄 [Ministry Mode] Marking attendance with bidirectional sync`);
          await ministryAttendanceService.addOrUpdate(record, userProfile, members);
          showToast('success', 'Attendance marked successfully');
        } else {
          await attendanceFirebaseService.addOrUpdate(record);
          showToast('success', 'Attendance marked successfully');
        }

        // Clear optimistic flag after successful sync
        setTimeout(() => {
          optimisticUpdatesRef.current.delete(recordId);
          const timeout = optimisticTimeoutsRef.current.get(recordId);
          if (timeout) {
            clearTimeout(timeout);
            optimisticTimeoutsRef.current.delete(recordId);
          }
        }, 500); // Allow listeners to settle

      } catch (syncError) {
        // Revert optimistic update on error
        console.error('Failed to sync attendance, reverting optimistic update:', syncError);
        optimisticUpdatesRef.current.delete(recordId);
        const timeout = optimisticTimeoutsRef.current.get(recordId);
        if (timeout) {
          clearTimeout(timeout);
          optimisticTimeoutsRef.current.delete(recordId);
        }
        setAttendanceRecords(prev => prev.filter(a => a.id !== recordId));
        throw syncError;
      }
    } catch (error: any) {
      console.error('❌ Failed to mark attendance:', error);
      setError(error.message);
      showToast('error', 'Failed to mark attendance', error.message);
      throw error;
    }
  }, [showToast, isMinistryContext, userProfile, members]);

  const markNewBelieverAttendanceHandler = useCallback(async (newBelieverId: string, date: string, status: AttendanceStatus) => {
  if (!ensureCanWrite()) throw new Error('Read-only access');
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
  if (!ensureCanWrite()) throw new Error('Read-only access');
    try {
      const recordId = `${memberId}_${date}`;
      console.log('🗑️ Clearing attendance record:', recordId);

      // Store original record for potential rollback
      const originalRecord = attendanceRecords.find(a => a.id === recordId);

      // Enhanced optimistic update with conflict prevention
      const applyOptimisticClear = () => {
        // Mark this record as optimistically updated
        optimisticUpdatesRef.current.add(recordId);

        // Clear any existing timeout for this record
        const existingTimeout = optimisticTimeoutsRef.current.get(recordId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        // Remove from local state immediately
        setAttendanceRecords(prev => prev.filter(a => a.id !== recordId));

        // Set timeout to clear optimistic flag (prevents permanent blocking)
        const timeout = setTimeout(() => {
          optimisticUpdatesRef.current.delete(recordId);
          optimisticTimeoutsRef.current.delete(recordId);
        }, 3000); // 3 second safety timeout

        optimisticTimeoutsRef.current.set(recordId, timeout);
      };

      // Apply optimistic update immediately
      applyOptimisticClear();

      try {
        // Use ministry service for bidirectional sync in ministry mode
        if (isMinistryContext) {
          // In ministry mode, we need to clear attendance from both ministry church and source church
          const member = members.find(m => m.id === memberId);
          const sourceChurchId = (member as any)?.sourceChurchId;

          // Clear from ministry church
          await attendanceFirebaseService.delete(recordId);

          // Clear from source church if different from current context
          if (sourceChurchId && sourceChurchId !== currentChurchId) {
            console.log(`🔄 [Ministry Mode] Clearing attendance from source church: ${sourceChurchId}`);
            await ministryAttendanceService.clearFromSourceChurch(recordId, sourceChurchId, userProfile?.uid || '');
          }

          showToast('success', 'Attendance cleared successfully');
        } else {
          await attendanceFirebaseService.delete(recordId);
          showToast('success', 'Attendance cleared successfully');
        }

        // Clear optimistic flag after successful sync
        setTimeout(() => {
          optimisticUpdatesRef.current.delete(recordId);
          const timeout = optimisticTimeoutsRef.current.get(recordId);
          if (timeout) {
            clearTimeout(timeout);
            optimisticTimeoutsRef.current.delete(recordId);
          }
        }, 500); // Allow listeners to settle

      } catch (syncError) {
        // Revert optimistic update on error
        console.error('Failed to clear attendance, reverting optimistic update:', syncError);
        optimisticUpdatesRef.current.delete(recordId);
        const timeout = optimisticTimeoutsRef.current.get(recordId);
        if (timeout) {
          clearTimeout(timeout);
          optimisticTimeoutsRef.current.delete(recordId);
        }
        if (originalRecord) {
          setAttendanceRecords(prev => [...prev, originalRecord]);
        }
        throw syncError;
      }
    } catch (error: any) {
      console.error('❌ Failed to clear attendance:', error);
      setError(error.message);
      showToast('error', 'Failed to clear attendance', error.message);
      throw error;
    }
  }, [showToast, isMinistryContext, userProfile, members]);

  // Transfer member to constituency handler
  const transferMemberToConstituencyHandler = useCallback(async (memberId: string, targetConstituencyId: string) => {
  if (!ensureCanWrite()) throw new Error('Read-only access');
    try {
      setIsLoading(true);

      if (!isMinistryContext) {
        throw new Error('Member transfer is only available in ministry mode');
      }

      // Find the member to get their name for the toast
      const member = members.find(m => m.id === memberId);
      const memberName = member ? `${member.firstName} ${member.lastName || ''}`.trim() : 'Member';

      console.log(`🔄 [Transfer] Transferring ${memberName} to constituency ${targetConstituencyId}`);

      // Use ministry service to transfer the member
      await ministryMembersService.transferToConstituency(memberId, targetConstituencyId, userProfile);

      showToast('success', 'Member Transferred Successfully',
        `${memberName} has been transferred to the selected constituency and will now appear in both ministry mode and normal mode.`);

    } catch (error: any) {
      console.error('❌ Failed to transfer member:', error);
      setError(error.message);
      showToast('error', 'Failed to Transfer Member', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast, isMinistryContext, userProfile, members]);

  // Prayer handlers
  const markPrayerHandler = useCallback(async (memberId: string, date: string, status: PrayerStatus) => {
  if (!ensureCanWrite()) throw new Error('Read-only access');
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
  if (!ensureCanWrite()) throw new Error('Read-only access');
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
  if (!ensureCanWrite()) throw new Error('Read-only access');
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
  if (!ensureCanWrite()) throw new Error('Read-only access');
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
    if (isImpersonating && currentExternalPermission === 'read-only') {
      // Do not perform data cleanup when viewing external church in read-only mode
      console.log('🔒 Skipping orphaned confirmation cleanup in read-only external context');
      return 0;
    }
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
  if (!ensureCanWrite()) throw new Error('Read-only access');
    try {
      setIsLoading(true);

      // Use helper function to find or create guest with deduplication
      const existingGuest = guests.find(g =>
        g.bacentaId === guestData.bacentaId &&
        g.firstName.toLowerCase().trim() === guestData.firstName.toLowerCase().trim() &&
        (g.lastName || '').toLowerCase().trim() === (guestData.lastName || '').toLowerCase().trim()
      );
      const guestId = await findOrCreateGuest(guestData);

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

      const guestName = `${guestData.firstName} ${guestData.lastName || ''}`.trim();
      if (existingGuest) {
        showToast('success', `${guestName} confirmed for upcoming Sunday (existing guest)`);
      } else {
        showToast('success', `${guestName} added and confirmed for upcoming Sunday`);
      }
    } catch (error: any) {
      setError(error.message);
      showToast('error', 'Failed to add guest', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [findOrCreateGuest, guests, showToast, userProfile]);

  const updateGuestHandler = useCallback(async (guestData: Guest) => {
  if (!ensureCanWrite()) throw new Error('Read-only access');
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
  if (!ensureCanWrite()) throw new Error('Read-only access');
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
  if (!ensureCanWrite()) throw new Error('Read-only access');
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
  if (!ensureCanWrite()) throw new Error('Read-only access');
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
  if (!ensureCanWrite()) throw new Error('Read-only access');
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

      // Notify linked admins that the leader converted a guest to member
      try {
        const { createNotificationHelpers } = await import('../services/notificationService');
        const leaderName = userProfile?.displayName || `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || 'Unknown Leader';
        const personName = `${guest.firstName} ${guest.lastName || ''}`.trim();
        await createNotificationHelpers.memberConverted(leaderName, personName, 'guest');
      } catch (notifyErr) {
        console.warn('⚠️ Failed to send conversion notification (guest):', notifyErr);
      }

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
  if (!ensureCanWrite()) throw new Error('Read-only access');
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
  if (!ensureCanWrite()) throw new Error('Read-only access');
    try {
      if (!userProfile?.uid) {
        throw new Error('User not authenticated');
      }

      // Ensure only admins can approve
      const { hasAdminPrivileges } = await import('../utils/permissionUtils');
      if (!hasAdminPrivileges(userProfile)) {
        throw new Error('Only administrators can approve deletion requests');
      }

      // Find the request
      let request = memberDeletionRequests.find(r => r.id === requestId);
      if (!request) {
        // Fallback: fetch directly in case local state is stale
        const fetched = await memberDeletionRequestService.getById(requestId);
        request = fetched || undefined;
      }
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

      // Decide which collection the target belongs to
      const outreachExists = outreachMembers.some(o => o.id === request.memberId);
      const memberExists = members.some(m => m.id === request.memberId);
      const isOutreach = outreachExists || (request as any).target === 'outreach';

      if (isOutreach && outreachExists) {
        // Use the outreach delete handler (admin path will cascade properly)
        await deleteOutreachMemberHandler(request.memberId);
      } else if (memberExists) {
        // Regular member deletion
        await deleteMemberHandler(request.memberId);
      } else {
        // Target no longer exists (likely deleted earlier); treat as approved without further action
        console.warn('Approve requested for non-existent target; marking approved without deletion', request.memberId);
      }

      showToast('success', 'Request Approved',
        `Deletion request for ${request.memberName} has been approved and the member has been deleted.`);
    } catch (error: any) {
      console.error('❌ Failed to approve deletion request:', error);
      setError(error.message);
      showToast('error', 'Failed to approve deletion request', error.message);
      throw error;
    }
  }, [memberDeletionRequests, userProfile, showToast, deleteMemberHandler, deleteOutreachMemberHandler, outreachMembers, members]);

  const rejectDeletionRequestHandler = useCallback(async (requestId: string, adminNotes?: string) => {
  if (!ensureCanWrite()) throw new Error('Read-only access');
    try {
      if (!userProfile?.uid) {
        throw new Error('User not authenticated');
      }

      // Ensure only admins can reject
      const { hasAdminPrivileges } = await import('../utils/permissionUtils');
      if (!hasAdminPrivileges(userProfile)) {
        throw new Error('Only administrators can reject deletion requests');
      }

      // Find the request
      let request = memberDeletionRequests.find(r => r.id === requestId);
      if (!request) {
        const fetched = await memberDeletionRequestService.getById(requestId);
        request = fetched || undefined;
      }
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

  // Ministry mode now uses direct Firestore queries like SuperAdmin - no sync needed

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
  // Reset any external permission (from cross-tenant link) when doing direct impersonation
  setCurrentExternalPermission(null);
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
    // Eager fallback: immediately run a raw fetch once to populate cards even if rules delay/block listeners
    try { await forceImpersonatedDataReloadRef.current?.(); } catch (e) {
      console.warn('Immediate impersonation fallback fetch failed', e);
    }
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
      let permissionDenied = false;
      const col = async (name: string) => {
        try {
          const snap = await getDocs(collection(db, 'churches', cid, name));
          return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e: any) {
          console.warn('[Impersonation Raw Fetch] Failed', name, e);
          if (e?.code === 'permission-denied') permissionDenied = true;
          return [];
        }
      };
  const [m,b,a,nb,confA,confLegacy,gu,pr,me,ti] = await Promise.all([
        col('members'),
        col('bacentas'),
        col('attendance'),
        col('newBelievers'),
        // Primary confirmations collection name
        col('confirmations'),
        // Legacy confirmations collection name (merge if present)
        col('sundayConfirmations'),
        col('guests'),
        // Additional data for full dashboard parity
        col('prayers'),
        col('meetings'),
        col('tithes')
      ]);
      const confirmations = [...confA, ...confLegacy];
  // Filter out soft-deleted members: include if isActive !== false and not explicitly isDeleted
  const activeMembers = (m as any[]).filter((mm: any) => mm && mm.isActive !== false && mm.isDeleted !== true);
  setMembers(activeMembers as any);
      setBacentas(b as any);
      setAttendanceRecords(a as any);
      setNewBelievers(nb as any);
      setSundayConfirmations(confirmations as any);
      setGuests(gu as any);
      // Set prayer and meetings directly
      setPrayerRecords(pr as any);
      setMeetingRecords(me as any);
      // Filter tithes to current month to match normal listener behavior
      try {
        const month = getCurrentMonth();
        const tForMonth = (ti as any[]).filter((t: any) => t && t.month === month);
        setTitheRecords(tForMonth as any);
      } catch {}
  console.log('[Impersonation Raw Fetch] Counts', { membersRaw: m.length, membersActive: activeMembers.length, bacentas: b.length, attendance: a.length, newBelievers: nb.length, confirmations: confirmations.length, guests: gu.length, prayers: pr.length, meetings: me.length, tithes: (ti as any[]).length });
      if (permissionDenied) {
        showToast('error', 'Access blocked', 'Your account lacks read access to this constituency. Check Firestore rules or use an access link with permission.');
      }
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

  // Cross-tenant helpers ----------------------------------------------------
  const refreshAccessibleChurchLinks = useCallback(async () => {
    try {
      if (!user?.uid) return;
      const links = await crossTenantService.getAccessibleChurchLinks(user.uid);
      setAccessibleChurchLinks(links);
    } catch (e) {
      console.warn('refreshAccessibleChurchLinks failed', e);
    }
  }, [user?.uid]);

  const switchToExternalChurch = useCallback(async (link: CrossTenantAccessLink) => {
    // Reuse impersonation plumbing to pivot context and fetch data
    await startImpersonation(link.ownerUid, link.ownerChurchId);
    setCurrentExternalPermission(link.permission || 'read-only');
    showToast('info', 'Switched Context', `Viewing ${link.ownerChurchName || 'External Church'} (${link.permission})`);
  }, [startImpersonation, showToast]);

  const switchBackToOwnChurch = useCallback(async () => {
    await stopImpersonation();
    setCurrentExternalPermission(null);
  }, [stopImpersonation]);

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
    meetingRecords,
  titheRecords,

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
  isMinistryContext,
  activeMinistryName,

    // Data Operations
    fetchInitialData,
    addMemberHandler,
    addMultipleMembersHandler,
    updateMemberHandler,
    deleteMemberHandler,
    transferMemberToConstituencyHandler,

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

    // Meeting Record Operations
    saveMeetingRecordHandler,
    updateMeetingRecordHandler,
    deleteMeetingRecordHandler,
    getMeetingRecordHandler,

  // Tithe Operations
  markTitheHandler,

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
    cleanupDuplicateGuests,

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
  // Cross-tenant switching
  accessibleChurchLinks,
  refreshAccessibleChurchLinks,
  switchToExternalChurch,
  switchBackToOwnChurch,
  currentExternalPermission,
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
