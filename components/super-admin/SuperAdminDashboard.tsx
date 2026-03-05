import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { collection, getDocs, getDoc, query, where, limit, updateDoc, doc, Timestamp, onSnapshot, addDoc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
// NOTE: Removed getFunctions/httpsCallable usage for member counts due to CORS issues on callable function.
// import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../firebase.config';
import './superadmin.css';
import { useAppContext } from '../../contexts/FirebaseAppContext';

import ConfirmationModal from '../modals/confirmations/ConfirmationModal';
// REMOVED: Ministry access service - ministry app now operates independently
// import { ministryAccessService } from '../../services/ministryAccessService';
import { notificationService, setNotificationContext } from '../../services/notificationService';
import { userService } from '../../services/userService';

import NotificationBadge from '../notifications/NotificationBadge';
import { Member } from '../../types';

interface AdminUserRecord {
  id: string;
  uid?: string;
  email?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  churchId?: string;
  churchName?: string;
  createdAt?: any;
  lastLoginAt?: any;
  isActive?: boolean;
  memberCount?: number; // computed client-side
  isMinistryAccount?: boolean;
  isDeleted?: boolean;
  preferences?: {
    ministryName?: string;
  };
}

interface SuperAdminDashboardProps {
  onSignOut: () => void;
}

// Lightweight badge using existing color utilities
const StatusBadge: React.FC<{ active: boolean }> = ({ active }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-widest uppercase shadow-sm transition-colors
    ${active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'}`}
  >{active ? 'ACTIVE' : 'INACTIVE'}</span>
);

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onSignOut }) => {
  const { isImpersonating, startImpersonation } = useAppContext();
  // Theme toggle: light default, persisted to localStorage
  const [isDark, setIsDark] = useState<boolean>(() => {
    try { return localStorage.getItem('sa-theme') === 'dark'; } catch { return false; }
  });
  const toggleTheme = () => setIsDark(prev => {
    const next = !prev;
    try { localStorage.setItem('sa-theme', next ? 'dark' : 'light'); } catch { }
    return next;
  });
  // Sidebar drawer (tablet/mobile)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);
  const [previewAdmin, setPreviewAdmin] = useState<AdminUserRecord | null>(null);
  const [admins, setAdmins] = useState<AdminUserRecord[]>([]);
  // Leaders state and view toggle
  const [leaders, setLeaders] = useState<AdminUserRecord[]>([]);
  const [viewMode, setViewMode] = useState<'dashboard' | 'admins' | 'leaders' | 'newly_registered' | 'all_members' | 'ministries'>('dashboard');
  const [leadersLoading, setLeadersLoading] = useState(false);
  const [newlyRegistered, setNewlyRegistered] = useState<AdminUserRecord[]>([]);
  const [newlyRegisteredLoading, setNewlyRegisteredLoading] = useState(false);

  // Ministry accounts state
  const [ministryAccounts, setMinistryAccounts] = useState<AdminUserRecord[]>([]);
  const [unassignedMinistries, setUnassignedMinistries] = useState<AdminUserRecord[]>([]);

  // All Members state
  const [allMembers, setAllMembers] = useState<(Member & { constituencyName: string })[]>([]);
  const [allMembersLoading, setAllMembersLoading] = useState(false);
  const [allMembersError, setAllMembersError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number; active: number; inactive: number } | null>(null);
  const [totalMembers, setTotalMembers] = useState<number | null>(null);
  const [memberCountsLoading, setMemberCountsLoading] = useState(false);
  const [editingConstituencyId, setEditingConstituencyId] = useState<string | null>(null);
  const [constituencyInput, setConstituencyInput] = useState('');
  const [savingConstituencyId, setSavingConstituencyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Campus state
  interface CampusRecord { id: string; name: string; isActive?: boolean; createdAt?: any; }
  const [campuses, setCampuses] = useState<CampusRecord[]>([]);
  const [creatingCampus, setCreatingCampus] = useState(false);
  const [newCampusName, setNewCampusName] = useState('');
  const [campusError, setCampusError] = useState<string | null>(null);
  const [showCampusModal, setShowCampusModal] = useState(false);
  const [editingCampus, setEditingCampus] = useState<CampusRecord | null>(null);
  const [editingCampusName, setEditingCampusName] = useState('');
  const [deletingCampus, setDeletingCampus] = useState(false);
  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(null);
  const [pendingDeleteAdmin, setPendingDeleteAdmin] = useState<AdminUserRecord | null>(null);
  const [confirmDeleteCampus, setConfirmDeleteCampus] = useState(false);
  // Promotion flow
  const [pendingPromotion, setPendingPromotion] = useState<AdminUserRecord | null>(null);
  // REMOVED: Ministry access requests - ministry app now operates independently
  // const [accessRequests, setAccessRequests] = useState<any[]>([]);
  // const [accessLoading, setAccessLoading] = useState(false);
  // const [accessError, setAccessError] = useState<string | null>(null);
  const [superAdminNotifications, setSuperAdminNotifications] = useState<any[]>([]);
  // REMOVED: Ministry accounts needing (re)approval fix - no longer needed
  // const [ministryAccountsNeedingApproval, setMinistryAccountsNeedingApproval] = useState<any[]>([]);
  // const [reapproveWorkingUid, setReapproveWorkingUid] = useState<string | null>(null);
  // const [reapproveAllLoading, setReapproveAllLoading] = useState(false);


  const campusAggregates = useMemo(() => {
    if (!campuses.length) return [] as Array<{ campus: CampusRecord; adminCount: number; constituencyCount: number; members: number }>;
    const map: Record<string, { adminIds: Set<string>; churchIds: Set<string>; members: number }> = {};
    admins.forEach(a => {
      const cid = (a as any).campusId; if (!cid) return;
      if (!map[cid]) map[cid] = { adminIds: new Set(), churchIds: new Set(), members: 0 };
      map[cid].adminIds.add(a.id);
      if (a.churchId) {
        if (!map[cid].churchIds.has(a.churchId)) {
          map[cid].churchIds.add(a.churchId);
          if (typeof a.memberCount === 'number') map[cid].members += (a.memberCount || 0);
        }
      }
    });
    return campuses.map(c => ({
      campus: c,
      adminCount: map[c.id]?.adminIds.size || 0,
      constituencyCount: map[c.id]?.churchIds.size || 0,
      members: map[c.id]?.members || 0
    }));
  }, [campuses, admins]);

  // REMOVED: Ministry access requests - ministry app now operates independently
  // const loadAccessRequests = useCallback(async () => {
  //   try {
  //     setAccessLoading(true);
  //     setAccessError(null);
  //     const qReq = query(
  //       collection(db, 'ministryAccessRequests'),
  //       where('status', '==', 'pending'),
  //       limit(200)
  //     );
  //     const snapshot = await getDocs(qReq);
  //     const items = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  //     items.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  //     setAccessRequests(items);
  //   } catch (e: any) {
  //     console.error('Failed to load access requests', e);
  //     setAccessError(e.message || 'Failed to load access requests');
  //   } finally {
  //     setAccessLoading(false);
  //   }
  // }, []);
  // REMOVED: Ministry accounts needing approval - no longer needed
  // const loadMinistryAccountsNeedingApproval = useCallback(async () => {
  //   try {
  //     const q = query(
  //       collection(db, 'users'),
  //       where('isMinistryAccount', '==', true),
  //       limit(500)
  //     );
  //     const snap = await getDocs(q);
  //     const users = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  //     const needing = users.filter(u => {
  //       const status = u?.ministryAccess?.status || 'none';
  //       const ministryName = (u?.preferences?.ministryName || '').trim();
  //       return !!ministryName && status !== 'approved';
  //     });
  //     setMinistryAccountsNeedingApproval(needing);
  //   } catch (e) {
  //     console.error('Failed to load ministry accounts needing approval', e);
  //   }
  // }, []);


  // Comprehensive refresh function that forces loading of all data
  const refreshAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMemberCountsLoading(true);

    try {
      // Fetch all admin users (role == 'admin') – limit high enough for now
      const adminsQuery = query(
        collection(db, 'users'),
        where('role', '==', 'admin'),
        limit(500)
      );
      const snapshot = await getDocs(adminsQuery);
      const data: AdminUserRecord[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)).map(a => ({ ...a, memberCount: (a as any).membersCount }));

      // Client-side sort by createdAt desc to avoid composite index requirement
      const getTime = (val: any): number => {
        if (!val) return 0;
        if (typeof val.toMillis === 'function') return val.toMillis();
        if (typeof val.toDate === 'function') return val.toDate().getTime();
        if (typeof val === 'string') {
          const t = Date.parse(val);
          return isNaN(t) ? 0 : t;
        }
        return 0;
      };

      const filtered = data.filter(a => !(a as any).isDeleted);
      filtered.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
      setAdmins(filtered);

      // Separate ministry accounts (active and unassigned)
      const allMinistryAccounts = data.filter(a => a.isMinistryAccount === true);
      const activeMinistries = allMinistryAccounts.filter(a => !(a as any).isDeleted);
      const deletedMinistries = allMinistryAccounts.filter(a => (a as any).isDeleted === true);

      activeMinistries.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
      deletedMinistries.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));

      setMinistryAccounts(activeMinistries);
      setUnassignedMinistries(deletedMinistries);

      setStats({
        total: filtered.length,
        active: filtered.filter(a => a.isActive !== false).length,
        inactive: filtered.filter(a => a.isActive === false).length
      });

      // Force reload member counts
      await computeMemberCounts(filtered, true); // Force full recount

    } catch (e: any) {
      console.error('Failed to refresh data', e);
      setError(e.message || 'Failed to refresh data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Function to load all members across all constituencies
  const loadAllMembers = useCallback(async () => {
    setAllMembersLoading(true);
    setAllMembersError(null);

    try {
      // Get all unique church IDs from admins
      const uniqueChurchIds = Array.from(new Set(admins.map(a => a.churchId).filter((v): v is string => !!v)));

      if (uniqueChurchIds.length === 0) {
        setAllMembers([]);
        return;
      }

      // Fetch members from all churches in parallel
      const allMembersPromises = uniqueChurchIds.map(async (churchId) => {
        try {
          // Get constituency name from admin record
          const admin = admins.find(a => a.churchId === churchId);
          const constituencyName = admin?.churchName || admin?.displayName || 'Unknown Constituency';

          // Fetch members from this church
          const membersRef = collection(db, 'churches', churchId, 'members');
          const membersQuery = query(membersRef, where('isActive', '==', true));
          const snapshot = await getDocs(membersQuery);

          // Map members with constituency info
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            constituencyName
          } as Member & { constituencyName: string }));
        } catch (error) {
          console.warn(`Failed to fetch members from church ${churchId}:`, error);
          return [];
        }
      });

      // Wait for all promises and flatten results
      const results = await Promise.all(allMembersPromises);
      const allMembersData = results.flat();

      // Sort by constituency name, then by last name, then by first name
      allMembersData.sort((a, b) => {
        const constituencyCompare = a.constituencyName.localeCompare(b.constituencyName);
        if (constituencyCompare !== 0) return constituencyCompare;

        const lastNameCompare = (a.lastName || '').localeCompare(b.lastName || '');
        if (lastNameCompare !== 0) return lastNameCompare;

        return a.firstName.localeCompare(b.firstName);
      });

      setAllMembers(allMembersData);
    } catch (error: any) {
      console.error('Failed to load all members:', error);
      setAllMembersError(error.message || 'Failed to load members');
    } finally {
      setAllMembersLoading(false);
    }
  }, [admins]);

  // Keep the original fetchAdmins for backward compatibility
  const fetchAdmins = refreshAllData;

  const computeMemberCounts = useCallback(async (adminsList: AdminUserRecord[], forceFullRecount: boolean = false) => {
    // Concurrency guard to avoid overlapping recounts which can amplify write attempts
    if ((computeMemberCounts as any)._inFlight) {
      // Skip if a recount is already running; next realtime change will trigger again if needed
      return;
    }
    (computeMemberCounts as any)._inFlight = true;
    setMemberCountsLoading(true);
    try {
      const uniqueChurchIds = Array.from(new Set(adminsList.map(a => a.churchId).filter((v): v is string => !!v)));
      if (uniqueChurchIds.length === 0) {
        setTotalMembers(0);
        return;
      }
      const countsMap: Record<string, number> = {};
      const reconciliationWrites: Promise<any>[] = [];

      for (const cid of uniqueChurchIds) {
        try {
          const churchRef = doc(db, 'churches', cid);
          const churchSnap = await getDoc(churchRef);
          const churchExists = churchSnap.exists();
          const data = churchExists ? churchSnap.data() : undefined;
          let churchCount: number | null = (data && typeof (data as any).membersCount === 'number') ? (data as any).membersCount : null;

          // Derive campusId from church doc if present and not already on admin record
          const campusId = (data as any)?.campusId;
          if (campusId) {
            // update corresponding admins locally (avoid extra write for now)
            adminsList.filter(a => a.churchId === cid && !(a as any).campusId).forEach(a => {
              (a as any).campusId = campusId;
            });
          }

          // If forcing or missing churchCount, recount by reading active members collection
          if (forceFullRecount || churchCount == null) {
            const membersCol = collection(db, 'churches', cid, 'members');
            const snap = await getDocs(membersCol);
            // Count only active members (isActive !== false)
            churchCount = snap.docs.filter(d => (d.data() as any).isActive !== false).length;
            // Write back to church doc if different
            if (!churchExists) {
              // Parent church doc missing but subcollection exists (allowed in Firestore) – create/merge safely
              reconciliationWrites.push(setDoc(churchRef, { membersCount: churchCount, lastUpdated: Timestamp.now() }, { merge: true }));
            } else if ((data as any).membersCount !== churchCount) {
              reconciliationWrites.push(updateDoc(churchRef, { membersCount: churchCount, lastUpdated: Timestamp.now() }));
            }
          }
          countsMap[cid] = churchCount ?? 0;

          // Reconcile admin docs for this church if stale
          adminsList.filter(a => a.churchId === cid).forEach(a => {
            if (a.memberCount !== churchCount) {
              reconciliationWrites.push(updateDoc(doc(db, 'users', a.id), { membersCount: churchCount, lastUpdated: Timestamp.now() }));
            }
          });
        } catch (err) {
          console.warn('Failed deriving count for church', cid, err);
          countsMap[cid] = -1;
        }
      }

      if (reconciliationWrites.length) {
        Promise.allSettled(reconciliationWrites).then(results => {
          const failures = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
          if (failures.length) {
            // Surface richer diagnostics for debugging 400 channel termination issues
            const sample = failures.slice(0, 3).map((f, i) => `#${i + 1}: ${(f.reason && (f.reason.code || f.reason.message)) || f.reason}`);
            console.warn('[SuperAdminDashboard] Some member count reconciliation writes failed', {
              totalWrites: reconciliationWrites.length,
              failed: failures.length,
              sampleReasons: sample
            });
          }
        });
      }

      const total = Object.values(countsMap).filter(v => v >= 0).reduce((s, v) => s + v, 0);
      setTotalMembers(total);
      setAdmins(prev => prev.map(a => {
        if (!a.churchId) return a;
        const updates: any = {};
        if (countsMap[a.churchId] != null) updates.memberCount = countsMap[a.churchId];
        const original = adminsList.find(x => x.id === a.id);
        if (original && (original as any).campusId && !(a as any).campusId) updates.campusId = (original as any).campusId;
        return Object.keys(updates).length ? { ...a, ...updates } : a;
      }));
    } finally {
      setMemberCountsLoading(false);
      (computeMemberCounts as any)._inFlight = false;
    }
  }, []);

  // Per-church live member listeners (track active members directly) -----------------
  const memberListenersRef = useRef<Record<string, () => void>>({});
  const liveCountsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  // REMOVED: Ministry access requests listener - ministry app now operates independently
  // useEffect(() => {
  //   try {
  //     setAccessLoading(true);
  //     const qReq = query(
  //       collection(db, 'ministryAccessRequests'),
  //       where('status', '==', 'pending'),
  //       limit(200)
  //     );
  //     const unsub = onSnapshot(qReq, snap => {
  //       const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  //       items.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  //       setAccessRequests(items);
  //       setAccessLoading(false);
  //     }, err => { setAccessError(err?.message || 'Failed to load access requests'); setAccessLoading(false); });
  //     return () => { try { unsub(); } catch {} };
  //   } catch (e:any) {
  //     setAccessError(e.message || 'Failed to load access requests');
  //     setAccessLoading(false);
  //   }
  // }, []);
  // REMOVED: Ministry accounts needing approval - no longer needed
  // useEffect(() => {
  //   loadMinistryAccountsNeedingApproval();
  // }, [loadMinistryAccountsNeedingApproval]);


  // Load SuperAdmin notifications (realtime)
  useEffect(() => {
    try {
      const qNotifications = query(
        collection(db, 'superAdminNotifications'),
        limit(50)
      );
      const unsub = onSnapshot(qNotifications, snap => {
        const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        // Sort by read status (unread first) then by creation date (newest first)
        items.sort((a, b) => {
          if (a.isRead !== b.isRead) {
            return a.isRead ? 1 : -1; // Unread items first
          }
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        });
        setSuperAdminNotifications(items);
      }, err => {
        console.error('Failed to load superAdmin notifications:', err);
      });
      return () => { try { unsub(); } catch { } };
    } catch (e: any) {
      console.error('Failed to setup superAdmin notifications listener:', e);
    }
  }, []);

  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'superAdminNotifications', notificationId);
      await updateDoc(notificationRef, {
        isRead: true,
        readAt: new Date().toISOString()
      });
    } catch (e: any) {
      console.error('Failed to mark notification as read:', e);
    }
  }, []);
  // REMOVED: Ministry approval functions - ministry app now operates independently
  // const reapproveMinistryUser = useCallback(async (u: any) => {
  //   try {
  //     setReapproveWorkingUid(u.id);
  //     const userRef = doc(db, 'users', u.id);
  //     await updateDoc(userRef, {
  //       'ministryAccess.status': 'approved',
  //       'ministryAccess.approvedAt': new Date().toISOString(),
  //       'ministryAccess.updatedAt': new Date().toISOString(),
  //       'ministryAccess.approvedBy': userProfile?.uid || 'superadmin',
  //       'ministryAccess.approvedByName': userProfile?.displayName || 'SuperAdmin'
  //     } as any);
  //     setMinistryAccountsNeedingApproval(prev => prev.filter(x => x.id !== u.id));
  //   } catch (e) {
  //     console.error('Failed to reapprove ministry user', e);
  //   } finally {
  //     setReapproveWorkingUid(null);
  //   }
  // }, [userProfile?.uid, userProfile?.displayName]);

  // const reapproveAllMinistryUsers = useCallback(async () => {
  //   if (!ministryAccountsNeedingApproval.length) return;
  //   setReapproveAllLoading(true);
  //   try {
  //     for (const u of ministryAccountsNeedingApproval) {
  //       // eslint-disable-next-line no-await-in-loop
  //       await reapproveMinistryUser(u);
  //     }
  //   } catch (e) {
  //     console.error('Failed to reapprove all ministry users', e);
  //   } finally {
  //     setReapproveAllLoading(false);
  //   }
  // }, [ministryAccountsNeedingApproval, reapproveMinistryUser]);

  // const approveAccess = useCallback(async (req: any) => {
  //   try {
  //     await ministryAccessService.approveRequest(req.id, { uid: 'superadmin', name: 'SuperAdmin' });
  //     // Notify requester in their ministry church context if available, else admin's church
  //     const churchId = req.ministryChurchId || req.requesterChurchId || (admins.find(a => a.uid === req.requesterUid)?.churchId) || null;
  //     if (churchId) {
  //       // Scope notifications to that church for delivery
  //       setNotificationContext({} as any, churchId);
  //       await notificationService.createForRecipients([
  //         req.requesterUid
  //       ], 'system_message' as any, 'Ministry access approved', { description: 'Your ministry account has been approved. You can now view cross-church ministry data.' }, undefined, { id: 'superadmin', name: 'SuperAdmin' });
  //     }
  //
  //     // Mark related notification as read
  //     const relatedNotification = superAdminNotifications.find(n => n.requestId === req.id);
  //     if (relatedNotification) {
  //       await markNotificationAsRead(relatedNotification.id);
  //     }
  //   } catch (e:any) {
  //     setAccessError(e.message || 'Failed to approve request');
  //   }
  // }, [admins, superAdminNotifications, markNotificationAsRead]);

  // const rejectAccess = useCallback(async (req: any) => {
  //   try {
  //     await ministryAccessService.rejectRequest(req.id, { uid: 'superadmin', name: 'SuperAdmin' });
  //     const churchId = req.ministryChurchId || req.requesterChurchId || (admins.find(a => a.uid === req.requesterUid)?.churchId) || null;
  //     if (churchId) {
  //       setNotificationContext({} as any, churchId);
  //       await notificationService.createForRecipients([
  //         req.requesterUid
  //       ], 'system_message' as any, 'Ministry access rejected', { description: 'Your ministry access request was rejected. Contact SuperAdmin for details.' }, undefined, { id: 'superadmin', name: 'SuperAdmin' });
  //     }
  //
  //     // Mark related notification as read
  //     const relatedNotification = superAdminNotifications.find(n => n.requestId === req.id);
  //     if (relatedNotification) {
  //       await markNotificationAsRead(relatedNotification.id);
  //     }
  //   } catch (e:any) {
  //     setAccessError(e.message || 'Failed to reject request');
  //   }
  // }, [admins, superAdminNotifications, markNotificationAsRead]);

  // Leaders realtime listener (enabled when viewing leaders)
  useEffect(() => {
    if (viewMode !== 'leaders') return;
    setLeadersLoading(true);
    const qL = query(
      collection(db, 'users'),
      where('role', '==', 'leader'),
      limit(800)
    );
    const unsubL = onSnapshot(qL, snap => {
      try {
        const raw: AdminUserRecord[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const filtered = raw.filter(a => !(a as any).isDeleted);
        const getTime = (val: any): number => {
          if (!val) return 0; if (typeof val.toMillis === 'function') return val.toMillis(); if (typeof val.toDate === 'function') return val.toDate().getTime(); if (typeof val === 'string') { const t = Date.parse(val); return isNaN(t) ? 0 : t; } return 0;
        };
        filtered.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
        setLeaders(filtered);
      } catch (e) {
        console.warn('Leaders snapshot processing failed', e);
      } finally {
        setLeadersLoading(false);
      }
    }, err => { setLeadersLoading(false); setError(err?.message || 'Failed to load leaders'); });
    return () => { try { unsubL(); } catch { } };
  }, [viewMode]);

  // Newly registered users realtime listener (enabled when viewing newly registered)
  useEffect(() => {
    if (viewMode !== 'newly_registered') return;
    setNewlyRegisteredLoading(true);

    // Get users registered in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const qNR = query(
      collection(db, 'users'),
      where('createdAt', '>=', Timestamp.fromDate(thirtyDaysAgo)),
      limit(500)
    );
    const unsubNR = onSnapshot(qNR, snap => {
      try {
        const raw: AdminUserRecord[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const filtered = raw.filter(a => !(a as any).isDeleted);
        const getTime = (val: any): number => {
          if (!val) return 0; if (typeof val.toMillis === 'function') return val.toMillis(); if (typeof val.toDate === 'function') return val.toDate().getTime(); if (typeof val === 'string') { const t = Date.parse(val); return isNaN(t) ? 0 : t; } return 0;
        };
        // Sort by creation date (newest first)
        filtered.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
        setNewlyRegistered(filtered);
      } catch (e) {
        console.warn('Newly registered snapshot processing failed', e);
      } finally {
        setNewlyRegisteredLoading(false);
      }
    }, err => { setNewlyRegisteredLoading(false); setError(err?.message || 'Failed to load newly registered users'); });
    return () => { try { unsubNR(); } catch { } };
  }, [viewMode]);

  // Load campuses (realtime)
  useEffect(() => {
    const qCampuses = query(collection(db, 'campuses'), limit(200));
    const unsub = onSnapshot(qCampuses, snap => {
      const list: CampusRecord[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(c => !(c as any).isDeleted);
      list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'en', { sensitivity: 'base' })); // alphabetical by default
      setCampuses(list);
    });
    return () => unsub();
  }, []);

  // Real-time listener so new member additions reflected automatically via trigger-updated membersCount
  useEffect(() => {
    // Listen to admin user docs (role == 'admin')
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'admin'),
      limit(500)
    );
    const unsub = onSnapshot(q, snap => {
      try {
        const raw: AdminUserRecord[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).map(a => ({ ...a, memberCount: (a as any).membersCount }));
        const filtered = raw.filter(a => !(a as any).isDeleted);
        // Sort same as initial fetch
        const getTime = (val: any): number => {
          if (!val) return 0; if (typeof val.toMillis === 'function') return val.toMillis(); if (typeof val.toDate === 'function') return val.toDate().getTime(); if (typeof val === 'string') { const t = Date.parse(val); return isNaN(t) ? 0 : t; } return 0;
        };
        filtered.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
        setAdmins(filtered);
        setStats({
          total: filtered.length,
          active: filtered.filter(a => a.isActive !== false).length,
          inactive: filtered.filter(a => a.isActive === false).length
        });
        // If every admin has a numeric memberCount, aggregate directly; else run computeMemberCounts (which will reconcile)
        const allHaveCounts = filtered.length > 0 && filtered.every(a => typeof a.memberCount === 'number');
        if (allHaveCounts) {
          setTotalMembers(filtered.reduce((s, a) => s + (a.memberCount || 0), 0));
        } else {
          computeMemberCounts(filtered, false);
        }
      } catch (e) {
        console.warn('Realtime admin snapshot processing failed', e);
      }
    });
    return () => unsub();
  }, [computeMemberCounts]);

  // Live per-church member subcollection listeners (ensures immediate updates even if backend trigger delay)
  useEffect(() => {
    const churchIds = Array.from(new Set(admins.map(a => a.churchId).filter((v): v is string => !!v)));
    const current = memberListenersRef.current;

    // Unsubscribe removed churches
    Object.keys(current).forEach(cid => {
      if (!churchIds.includes(cid)) {
        try { current[cid]!(); } catch { }
        delete current[cid];
        delete liveCountsRef.current[cid];
      }
    });

    // Add listeners for new churches
    churchIds.forEach(cid => {
      if (current[cid]) return;
      try {
        const membersRef = collection(db, 'churches', cid, 'members');
        const qMembers = query(membersRef, where('isActive', '==', true));
        const unsub = onSnapshot(qMembers, snap => {
          liveCountsRef.current[cid] = snap.size;
          setAdmins(prev => prev.map(a => a.churchId === cid ? { ...a, memberCount: snap.size } : a));
          // Recompute total from live counts (fallback to existing memberCount if missing)
          const liveTotal = Object.values(liveCountsRef.current).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
          setTotalMembers(liveTotal);
        });
        current[cid] = unsub;
      } catch (e) {
        console.warn('Failed attaching members listener for church', cid, e);
      }
    });

    return () => {
      // Cleanup all on unmount
      Object.values(memberListenersRef.current).forEach(u => { try { u(); } catch { } });
      memberListenersRef.current = {};
      liveCountsRef.current = {};
    };
  }, [admins]);

  // Row-level updating state
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({});

  const setUpdating = (id: string, val: boolean) => {
    setUpdatingIds(prev => ({ ...prev, [id]: val }));
  };

  const toggleActiveStatus = async (admin: AdminUserRecord) => {
    try {
      setUpdating(admin.id, true);
      // Use secure callable to update both Firestore and Auth, and revoke tokens
      await userService.setUserActiveStatus(admin.id, admin.isActive === false);
      // Optimistic update
      setAdmins(prev => prev.map(a => a.id === admin.id ? { ...a, isActive: admin.isActive === false } : a));
      setStats(prev => prev ? {
        ...prev,
        active: prev.active + (admin.isActive === false ? 1 : -1),
        inactive: prev.inactive + (admin.isActive === false ? -1 : 1)
      } : prev);
    } catch (e: any) {
      setError(e.message || 'Failed to update status');
    } finally {
      setUpdating(admin.id, false);
    }
  };

  const softDeleteAdmin = async (admin: AdminUserRecord) => {
    // Reuse the same state for hard-delete confirmation
    setPendingDeleteAdmin(admin);
  };

  const performDeleteAdmin = async () => {
    // Prefer Cloud Function to remove Auth user and related data with admin privileges
    const admin = pendingDeleteAdmin;
    if (!admin) return;
    try {
      setUpdating(admin.id, true);
      await userService.hardDeleteUser(admin.id);
      setAdmins(prev => prev.filter(a => a.id !== admin.id));
      setStats(prev => prev ? {
        total: Math.max(0, prev.total - 1),
        active: Math.max(0, prev.active - (admin.isActive !== false ? 1 : 0)),
        inactive: Math.max(0, prev.inactive - (admin.isActive === false ? 1 : 0))
      } : prev);
    } catch (e: any) {
      setError(e.message || 'Failed to delete admin');
    } finally {
      setUpdating(admin.id, false);
      setPendingDeleteAdmin(null);
    }
  };

  const startEditConstituency = (admin: AdminUserRecord) => {
    setEditingConstituencyId(admin.id);
    setConstituencyInput(admin.churchName || '');
  };

  const cancelEditConstituency = () => {
    setEditingConstituencyId(null);
    setConstituencyInput('');
  };

  const saveConstituency = async (admin: AdminUserRecord) => {
    if (!constituencyInput.trim()) {
      setError('Constituency name cannot be empty');
      return;
    }
    try {
      setSavingConstituencyId(admin.id);
      const newName = constituencyInput.trim();
      // Primary (fast) update
      await updateDoc(doc(db, 'users', admin.id), {
        churchName: newName,
        lastUpdated: Timestamp.now()
      });
      setAdmins(prev => prev.map(a => a.id === admin.id ? { ...a, churchName: newName } : a));

      // Immediately exit edit mode & clear saving state for snappy UX
      cancelEditConstituency();
      setSavingConstituencyId(null);

      // Fire global event quickly (listeners can refresh)
      try { window.dispatchEvent(new CustomEvent('constituencyUpdated', { detail: { adminId: admin.id, newName } })); } catch { }

      // Background cascade (non-blocking)
      (async () => {
        const adminUid = admin.uid || admin.id;
        try {
          // Update church doc
          if (admin.churchId) {
            try {
              await updateDoc(doc(db, 'churches', admin.churchId), { name: newName, lastUpdated: Timestamp.now() });
            } catch (e) { console.warn('Failed updating church doc', e); }
          }

          const updatedLeaderIds = new Set<string>();
          const leadersByInviteQuery = query(collection(db, 'users'), where('invitedByAdminId', '==', adminUid), where('role', '==', 'leader'));
          const leadersByInviteSnap = await getDocs(leadersByInviteQuery);
          const updatePromises: Promise<any>[] = [];
          leadersByInviteSnap.forEach(l => {
            updatedLeaderIds.add(l.id);
            updatePromises.push(updateDoc(doc(db, 'users', l.id), { churchName: newName, lastUpdated: Timestamp.now() }));
          });

          if (admin.churchId) {
            const leadersByChurchQuery = query(collection(db, 'users'), where('churchId', '==', admin.churchId), where('role', '==', 'leader'));
            const leadersByChurchSnap = await getDocs(leadersByChurchQuery);
            leadersByChurchSnap.forEach(l => {
              if (!updatedLeaderIds.has(l.id)) {
                updatedLeaderIds.add(l.id);
                updatePromises.push(updateDoc(doc(db, 'users', l.id), { churchName: newName, lastUpdated: Timestamp.now() }));
              }
            });
            // Broader propagation to all users of same church
            const allUsersSameChurchQuery = query(collection(db, 'users'), where('churchId', '==', admin.churchId));
            const allSnap = await getDocs(allUsersSameChurchQuery);
            allSnap.forEach(u => {
              if (u.id !== admin.id && !updatedLeaderIds.has(u.id)) {
                updatePromises.push(updateDoc(doc(db, 'users', u.id), { churchName: newName, lastUpdated: Timestamp.now() }));
              }
            });
          }
          if (updatePromises.length) await Promise.allSettled(updatePromises);
          // Fire another event to ensure late subscribers update
          try { window.dispatchEvent(new CustomEvent('constituencyUpdated', { detail: { adminId: admin.id, newName, cascade: true } })); } catch { }
        } catch (cascadeErr) {
          console.warn('Background constituency cascade failed', cascadeErr);
          setError(prev => prev ? prev : 'Some linked accounts may not have updated.');
        }
      })();
    } catch (e: any) {
      setError(e.message || 'Failed to save constituency');
    } finally {
      // saving state already cleared earlier for fast UX; keep as safety if error path skipped
      setSavingConstituencyId(prev => prev === admin.id ? null : prev);
    }
  };

  // Campus creation ----------------------------------------------------------
  const createCampus = async () => {
    if (!newCampusName.trim()) {
      setCampusError('Campus name required');
      return;
    }
    try {
      setCreatingCampus(true);
      setCampusError(null);
      await addDoc(collection(db, 'campuses'), {
        name: newCampusName.trim(),
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      setNewCampusName('');
    } catch (e: any) {
      setCampusError(e.message || 'Failed to create campus');
    } finally {
      setCreatingCampus(false);
    }
  };

  const openEditCampus = (c: CampusRecord) => {
    setEditingCampus(c);
    setEditingCampusName(c.name);
    setCampusError(null);
  };

  const saveCampusEdit = async () => {
    if (!editingCampus) return;
    if (!editingCampusName.trim()) { setCampusError('Name required'); return; }
    try {
      setCreatingCampus(true);
      await updateDoc(doc(db, 'campuses', editingCampus.id), { name: editingCampusName.trim(), updatedAt: Timestamp.now() });
      setEditingCampus(null);
      setEditingCampusName('');
    } catch (e: any) {
      setCampusError(e.message || 'Failed to update campus');
    } finally { setCreatingCampus(false); }
  };

  const deleteCampus = async () => {
    if (!editingCampus) return;
    setConfirmDeleteCampus(true);
    return;
  };

  const performDeleteCampus = async () => {
    if (!editingCampus) return;
    try {
      setDeletingCampus(true);
      // Hard delete campus document from Firestore
      await deleteDoc(doc(db, 'campuses', editingCampus.id));
      // Detach campusId from related users (admins & members) and churches
      (async () => {
        try {
          const usersQ = query(collection(db, 'users'), where('campusId', '==', editingCampus.id));
          const usersSnap = await getDocs(usersQ);
          const updates: Promise<any>[] = [];
          usersSnap.forEach(u => updates.push(updateDoc(doc(db, 'users', u.id), { campusId: null, lastUpdated: Timestamp.now() })));
          const churchesQ = query(collection(db, 'churches'), where('campusId', '==', editingCampus.id));
          const churchesSnap = await getDocs(churchesQ);
          churchesSnap.forEach(ch => updates.push(updateDoc(doc(db, 'churches', ch.id), { campusId: null, lastUpdated: Timestamp.now() })));
          if (updates.length) await Promise.allSettled(updates);
        } catch (e) { console.warn('Campus delete detach failed', e); }
      })();
      // Close modal & selection
      if (selectedCampusId === editingCampus.id) setSelectedCampusId(null);
      setEditingCampus(null);
    } catch (e: any) {
      setCampusError(e.message || 'Failed to delete campus');
    } finally { setDeletingCampus(false); }
  };

  // Assign / move constituency (church) to campus
  const assigningRef = useRef<Record<string, boolean>>({});
  const [, forceRender] = useState(0); // for local transient state display

  const assignCampus = async (admin: AdminUserRecord, campusId: string | null) => {
    if (assigningRef.current[admin.id]) return;
    assigningRef.current[admin.id] = true; forceRender(v => v + 1);
    try {
      const updates: any = { lastUpdated: Timestamp.now(), campusId: campusId || null };
      await updateDoc(doc(db, 'users', admin.id), updates);
      if (admin.churchId) {
        try { await updateDoc(doc(db, 'churches', admin.churchId), { campusId: campusId || null, lastUpdated: Timestamp.now() }); } catch (e) { console.warn('Failed updating church campusId', e); }
        // Background cascade for all users in same church
        (async () => {
          try {
            const qUsers = query(collection(db, 'users'), where('churchId', '==', admin.churchId));
            const snap = await getDocs(qUsers);
            const writePromises: Promise<any>[] = [];
            snap.forEach(u => {
              if (u.id === admin.id) return; // already updated
              writePromises.push(updateDoc(doc(db, 'users', u.id), { campusId: campusId || null, lastUpdated: Timestamp.now() }));
            });
            await Promise.allSettled(writePromises);
          } catch (err) { console.warn('Campus cascade failed', err); }
        })();
      }
      setAdmins(prev => prev.map(a => a.id === admin.id ? { ...a, campusId: campusId || undefined } : a));
    } catch (e: any) {
      setError(e.message || 'Failed to assign campus');
    } finally {
      delete assigningRef.current[admin.id];
      forceRender(v => v + 1);
    }
  };

  // Promote a leader to admin and demote current admin to leader (swap)
  const promoteLeaderToAdmin = async (leader: AdminUserRecord) => {
    try {
      if (updatingIds[leader.id]) return;
      setUpdating(leader.id, true);
      const churchId = (leader as any).churchId || null;
      // Find current admin for this church if any
      let currentAdmin: AdminUserRecord | null = null;
      if (churchId) {
        try {
          const qAdmin = query(
            collection(db, 'users'),
            where('churchId', '==', churchId),
            where('role', '==', 'admin'),
            limit(1)
          );
          const snap = await getDocs(qAdmin);
          if (!snap.empty) currentAdmin = { id: snap.docs[0].id, ...(snap.docs[0].data() as any) } as any;
        } catch (e) { console.warn('Failed to resolve current admin for church', churchId, e); }
      }

      // Demote current admin first (if any)
      if (currentAdmin) {
        try {
          await updateDoc(doc(db, 'users', currentAdmin.id), {
            role: 'leader',
            isInvitedAdminLeader: true,
            invitedByAdminId: leader.uid || leader.id,
            lastUpdated: Timestamp.now()
          });
        } catch (e) { console.warn('Failed demoting current admin', e); }
      }

      // Promote leader
      try {
        await updateDoc(doc(db, 'users', leader.id), {
          role: 'admin',
          isInvitedAdminLeader: false,
          invitedByAdminId: null,
          lastUpdated: Timestamp.now()
        });
      } catch (e: any) {
        setError(e.message || 'Failed to promote leader');
        return;
      }

      // Update adminInvites so the fallback notification lookup (adminInvites.createdBy)
      // also points to the new admin. Also update invitedByAdminId on all leader user docs.
      if (currentAdmin && churchId) {
        try {
          const newAdminUid = leader.uid || leader.id;
          const oldAdminUid = currentAdmin.uid || currentAdmin.id;

          // 1. Update adminInvites.createdBy → new admin
          const invitesSnap = await getDocs(
            query(
              collection(db, 'adminInvites'),
              where('createdBy', '==', oldAdminUid),
              where('churchId', '==', churchId),
              where('status', '==', 'accepted')
            )
          );

          // 2. Update leaders' invitedByAdminId → new admin
          const leadersSnap = await getDocs(
            query(
              collection(db, 'users'),
              where('invitedByAdminId', '==', oldAdminUid),
              where('churchId', '==', churchId)
            )
          );

          if (!invitesSnap.empty || !leadersSnap.empty) {
            const batch = writeBatch(db);
            invitesSnap.docs.forEach(d => {
              batch.update(d.ref, { createdBy: newAdminUid, lastUpdated: Timestamp.now() });
            });
            leadersSnap.docs.forEach(d => {
              batch.update(d.ref, { invitedByAdminId: newAdminUid, lastUpdated: Timestamp.now() });
            });
            await batch.commit();
            console.log(`✅ Updated ${invitesSnap.size} adminInvite(s) and ${leadersSnap.size} leader(s) → new admin ${newAdminUid}`);
          }

          // Re-route existing notifications: change adminId from old admin → new admin
          // so the demoted admin stops seeing notifications in their bell going forward.
          try {
            const notifPath = `churches/${churchId}/notifications`;
            const notifSnap = await getDocs(
              query(collection(db, notifPath), where('adminId', '==', oldAdminUid))
            );
            if (!notifSnap.empty) {
              const chunkSize = 400;
              for (let i = 0; i < notifSnap.docs.length; i += chunkSize) {
                const chunk = notifSnap.docs.slice(i, i + chunkSize);
                const notifBatch = writeBatch(db);
                chunk.forEach(d => notifBatch.update(d.ref, { adminId: newAdminUid, lastUpdated: Timestamp.now() }));
                await notifBatch.commit();
              }
              console.log(`✅ Re-routed ${notifSnap.size} notification(s) from old admin ${oldAdminUid} → new admin ${newAdminUid}`);
            }
          } catch (notifErr) {
            console.warn('Failed to re-route notifications after promotion', notifErr);
          }
        } catch (inviteUpdateErr) {
          console.warn('Failed to update adminInvites/leaders after promotion', inviteUpdateErr);
        }
      }

      // Local optimistic updates
      setLeaders(prev => prev.filter(l => l.id !== leader.id));
      setAdmins(prev => [{ ...leader, role: 'admin' }, ...prev]);
      if (currentAdmin) {
        setAdmins(prev => prev.filter(a => a.id !== currentAdmin!.id));
      }
    } finally {
      setUpdating(leader.id, false);
      setPendingPromotion(null);
    }
  };

  // Filtered admins for search ------------------------------------------------
  const filteredAdmins = useMemo(() => {
    // Show only unassigned constituencies (no campus) in main table
    const base = admins.filter(a => !(a as any).campusId);
    if (!searchQuery.trim()) return base;
    const q = searchQuery.trim().toLowerCase();
    return base.filter(a => [a.churchName, a.displayName, a.email, a.firstName, a.lastName].some(v => v && v.toLowerCase().includes(q)));
  }, [admins, searchQuery]);

  const filteredLeaders = useMemo(() => {
    if (!searchQuery.trim()) return leaders;
    const q = searchQuery.trim().toLowerCase();
    return leaders.filter(a => [a.churchName, a.displayName, a.email, a.firstName, a.lastName].some(v => v && v.toLowerCase().includes(q)));
  }, [leaders, searchQuery]);

  const selectedCampus = useMemo(() => campuses.find(c => c.id === selectedCampusId) || null, [campuses, selectedCampusId]);
  const campusAdmins = useMemo(() => {
    if (!selectedCampus) return [] as AdminUserRecord[];
    return admins.filter(a => (a as any).campusId === selectedCampus.id);
  }, [admins, selectedCampus]);

  // Restore unassigned ministry
  const restoreMinistry = async (ministry: AdminUserRecord) => {
    try {
      setUpdating(ministry.id, true);
      await updateDoc(doc(db, 'users', ministry.id), {
        isDeleted: false,
        isActive: true,
        lastUpdated: Timestamp.now()
      });

      // Move from unassigned to active
      setUnassignedMinistries(prev => prev.filter(m => m.id !== ministry.id));
      setMinistryAccounts(prev => [...prev, { ...ministry, isDeleted: false, isActive: true }]);

      // Also update admins list
      setAdmins(prev => [...prev, { ...ministry, isDeleted: false, isActive: true }]);
    } catch (e: any) {
      setError(e.message || 'Failed to restore ministry');
    } finally {
      setUpdating(ministry.id, false);
    }
  };

  // (Removed legacy read-only constituency detail; full impersonation implemented instead)

  // Helper: avatar initials + colour from name/email
  const avatarProps = (name?: string, email?: string) => {
    const str = name || email || '?';
    const initials = str.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || str[0]?.toUpperCase() || '?';
    const colors = ['#7c3aed', '#0284c7', '#059669', '#b45309', '#be185d', '#0e7490', '#4338ca'];
    const idx = str.charCodeAt(0) % colors.length;
    return { initials, bg: colors[idx] };
  };

  return (
    <div className="sa-root" data-sa-theme={isDark ? 'dark' : 'light'}>
      {/* ── HEADER ── */}
      <header className="sa-header">
        {/* Hamburger — visible on tablet/mobile */}
        {!isImpersonating && (
          <button
            className="sa-hamburger"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        )}
        <button className="sa-logo-btn" onClick={() => { setSelectedCampusId(null); setViewMode('dashboard'); closeSidebar(); }}>
          <div className="sa-logo-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>⛪</div>
          <span className="sa-logo-text">
            <span className="sa-logo-title">SuperAdmin</span>
            <span className="sa-logo-sub">Global Management</span>
          </span>
        </button>

        {isImpersonating && (
          <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.3)', color: '#2dd4bf' }}>
            👁 Viewing Constituency
          </span>
        )}

        <div className="sa-header-spacer" />

        <div className="sa-header-actions">
          <NotificationBadge />
          {/* Dark mode toggle */}
          <button
            className="sa-theme-toggle"
            onClick={toggleTheme}
            title={isDark ? 'Light Mode' : 'Dark Mode'}
            aria-label="Toggle theme"
          >
            <span className="sa-theme-icon sun">☀</span>
            <span className="sa-theme-icon moon">🌙</span>
          </button>
          <button className="sa-hbtn sa-hbtn-gold sa-hbtn-refresh" onClick={refreshAllData} title="Refresh">
            <span className={loading ? 'sa-spin' : ''}>⟳</span>
            <span className="sa-hbtn-label"> Refresh</span>
          </button>
          {!isImpersonating && (
            <button className="sa-hbtn sa-hbtn-gold sa-hbtn-campus" onClick={() => setShowCampusModal(true)}>
              +<span className="sa-hbtn-label"> Campus</span>
            </button>
          )}
          <button className="sa-hbtn sa-hbtn-danger" onClick={onSignOut}>
            <span>⏻</span>
            <span className="sa-hbtn-label"> Sign Out</span>
          </button>
        </div>
      </header>


      {/* ── SIDEBAR OVERLAY (tablet) ── */}
      {
        !isImpersonating && (
          <div
            className={`sa-sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
            onClick={closeSidebar}
          />
        )
      }

      {/* ── SIDEBAR + MAIN ── */}
      <div className="sa-body">
        {/* Sidebar */}
        {!isImpersonating && (
          <aside className={`sa-sidebar ${sidebarOpen ? 'open' : ''}`}>
            <span className="sa-nav-label">Overview</span>
            <button
              className={`sa-nav-btn ${viewMode === 'dashboard' && !selectedCampus ? 'active' : ''}`}
              onClick={() => { setSelectedCampusId(null); setViewMode('dashboard'); closeSidebar(); }}
            >
              <span className="sa-nav-icon">📊</span><span className="label">Dashboard</span>
            </button>

            <span className="sa-nav-label">Manage</span>
            <button
              className={`sa-nav-btn ${viewMode === 'admins' ? 'active' : ''}`}
              onClick={() => { setSelectedCampusId(null); setViewMode('admins'); closeSidebar(); }}
            >
              <span className="sa-nav-icon">🛡</span><span className="label">Admins</span>
              {filteredAdmins.length > 0 && <span className="sa-nav-count">{filteredAdmins.length}</span>}
            </button>
            <button
              className={`sa-nav-btn ${viewMode === 'leaders' ? 'active' : ''}`}
              onClick={() => { setSelectedCampusId(null); setViewMode('leaders'); closeSidebar(); }}
            >
              <span className="sa-nav-icon">👑</span><span className="label">Leaders</span>
              {filteredLeaders.length > 0 && <span className="sa-nav-count">{filteredLeaders.length}</span>}
            </button>
            <button
              className={`sa-nav-btn ${viewMode === 'ministries' ? 'active' : ''}`}
              onClick={() => { setSelectedCampusId(null); setViewMode('ministries'); closeSidebar(); }}
            >
              <span className="sa-nav-icon">⛪</span><span className="label">Ministries</span>
              {ministryAccounts.length > 0 && <span className="sa-nav-count">{ministryAccounts.length}</span>}
            </button>

            <span className="sa-nav-label">Members</span>
            <button
              className={`sa-nav-btn ${viewMode === 'newly_registered' ? 'active' : ''}`}
              onClick={() => { setSelectedCampusId(null); setViewMode('newly_registered'); closeSidebar(); }}
            >
              <span className="sa-nav-icon">🆕</span><span className="label">New Users</span>
              {newlyRegistered.length > 0 && <span className="sa-nav-count">{newlyRegistered.length}</span>}
            </button>
            <button
              className={`sa-nav-btn ${viewMode === 'all_members' ? 'active' : ''}`}
              onClick={() => { setSelectedCampusId(null); setViewMode('all_members'); closeSidebar(); }}
            >
              <span className="sa-nav-icon">👥</span><span className="label">All Members</span>
            </button>

            {campuses.length > 0 && (
              <>
                <span className="sa-nav-label">Campuses</span>
                {campuses.map(c => (
                  <button
                    key={c.id}
                    className={`sa-nav-btn ${selectedCampus?.id === c.id ? 'active' : ''}`}
                    onClick={() => { setSelectedCampusId(c.id); closeSidebar(); }}
                    title={c.name}
                  >
                    <span className="sa-nav-icon">🏫</span>
                    <span className="label">{c.name}</span>
                  </button>
                ))}
              </>
            )}
          </aside>
        )}

        {/* ── MAIN CONTENT ── */}
        <main className="sa-main">

          {/* Error Banner */}
          {error && (
            <div style={{ borderLeft: '3px solid #f43f5e', background: 'rgba(244,63,94,0.08)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#fb7185' }}>{error}</div>
          )}

          {/* ════════════════════════════════════════════════
              CAMPUS DETAIL VIEW
              ════════════════════════════════════════════════ */}
          {selectedCampus && (
            <div>
              <button className="sa-back-btn" onClick={() => setSelectedCampusId(null)}>← Back to Dashboard</button>

              <div className="sa-page-header">
                <div>
                  <div className="sa-page-title">🏫 {selectedCampus.name}</div>
                  <div className="sa-page-sub">Click any constituency row to enter the app as that admin</div>
                </div>
                <button className="sa-btn sa-btn-gold" onClick={() => openEditCampus(selectedCampus)}>✏ Edit Campus</button>
              </div>

              {/* Constituency cards */}
              <div className="sa-constituency-grid">
                {campusAdmins.map((a) => {
                  const av = avatarProps(a.displayName || a.firstName, a.email);
                  return (
                    <div key={a.id} className="sa-constituency-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <div className="sa-avatar" style={{ background: av.bg, width: 40, height: 40, fontSize: 15 }}>{av.initials}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="sa-const-card-name" style={{ fontSize: 13 }}>{a.displayName || a.firstName || '—'}</div>
                          <div className="sa-const-card-email">{a.email || '—'}</div>
                        </div>
                        <span className={`sa-status ${a.isActive !== false ? 'sa-status-active' : 'sa-status-inactive'}`}>
                          {a.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <div className="sa-const-card-stats">
                        <span className="sa-const-card-stat">
                          Constituency: <strong>{a.churchName || 'Unset'}</strong>
                        </span>
                        <span className="sa-const-card-stat">
                          Members: <strong>{a.memberCount ?? (memberCountsLoading ? '…' : '—')}</strong>
                        </span>
                      </div>

                      <div className="sa-const-card-actions">
                        {a.churchId && (
                          <button className="sa-btn sa-btn-teal" onClick={() => startImpersonation((a as any).uid || a.id, a.churchId!)}>
                            👁 Enter App
                          </button>
                        )}
                        <button
                          className={`sa-btn ${a.isActive !== false ? 'sa-toggle-active' : 'sa-toggle-inactive'}`}
                          disabled={updatingIds[a.id]}
                          onClick={() => toggleActiveStatus(a)}
                        >
                          {updatingIds[a.id] ? '…' : (a.isActive !== false ? 'Deactivate' : 'Activate')}
                        </button>
                        <button
                          className="sa-btn sa-btn-rose"
                          disabled={updatingIds[a.id]}
                          onClick={() => softDeleteAdmin(a)}
                        >Delete</button>

                        {/* Campus reassign */}
                        <select
                          className="sa-select"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                          value={(a as any).campusId || ''}
                          onChange={e => assignCampus(a, e.target.value || null)}
                        >
                          <option value="">No Campus</option>
                          {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>

                      {/* Edit constituency name inline */}
                      <div style={{ marginTop: 10 }}>
                        {editingConstituencyId === a.id ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                              autoFocus
                              className="sa-input"
                              style={{ flex: 1, minWidth: 120, fontSize: 12, padding: '5px 10px' }}
                              value={constituencyInput}
                              onChange={e => setConstituencyInput(e.target.value)}
                              placeholder="Constituency name"
                            />
                            <button className="sa-btn sa-btn-teal" disabled={savingConstituencyId === a.id} onClick={() => saveConstituency(a)}>
                              {savingConstituencyId === a.id ? '…' : 'Save'}
                            </button>
                            <button className="sa-btn sa-btn-ghost" onClick={cancelEditConstituency}>Cancel</button>
                          </div>
                        ) : (
                          <div className="sa-inline-edit">
                            <span style={{ fontSize: 11, color: 'var(--sa-text-dim)' }}>
                              {a.churchName ? `"${a.churchName}"` : 'No constituency name set'}
                            </span>
                            <button className="sa-rename-btn" onClick={() => startEditConstituency(a)}>✏ Rename</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {campusAdmins.length === 0 && (
                  <div className="sa-empty" style={{ gridColumn: '1/-1' }}>
                    <span className="sa-empty-icon">🏫</span>
                    No constituencies in this campus yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════
              DASHBOARD VIEW
              ════════════════════════════════════════════════ */}
          {!selectedCampus && viewMode === 'dashboard' && (
            <div>
              <div className="sa-page-header">
                <div>
                  <div className="sa-page-title">Good to see you, <span>SuperAdmin</span></div>
                  <div className="sa-page-sub">Here's a live overview of all constituencies</div>
                </div>
              </div>

              {/* Stat cards */}
              <div className="sa-stats-grid">
                <div className="sa-stat-card">
                  <div className="sa-stat-icon" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}>🏛</div>
                  <div className="sa-stat-label">Constituencies</div>
                  <div className="sa-stat-value">{stats?.total ?? '—'}</div>
                  <div className="sa-stat-desc">Total registered</div>
                  <div className="sa-stat-bar" style={{ background: 'linear-gradient(90deg,transparent,#f59e0b,transparent)' }} />
                </div>

                <div className="sa-stat-card clickable" onClick={() => { setViewMode('all_members'); loadAllMembers(); }}>
                  <div className="sa-stat-icon" style={{ background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.2)' }}>👥</div>
                  <div className="sa-stat-label">Total Members</div>
                  <div className="sa-stat-value" style={{ color: '#5eead4' }}>
                    {totalMembers != null ? totalMembers.toLocaleString() : (memberCountsLoading ? '…' : '—')}
                  </div>
                  <div className="sa-stat-desc" style={{ color: 'var(--sa-teal)' }}>Click to view all →</div>
                  <div className="sa-stat-bar" style={{ background: 'linear-gradient(90deg,transparent,#14b8a6,transparent)' }} />
                </div>

                <div className="sa-stat-card">
                  <div className="sa-stat-icon" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>✅</div>
                  <div className="sa-stat-label">Active</div>
                  <div className="sa-stat-value" style={{ color: '#34d399' }}>{stats?.active ?? '—'}</div>
                  <div className="sa-stat-desc">Operational</div>
                  <div className="sa-stat-bar" style={{ background: 'linear-gradient(90deg,transparent,#10b981,transparent)' }} />
                </div>

                <div className="sa-stat-card">
                  <div className="sa-stat-icon" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)' }}>⚠</div>
                  <div className="sa-stat-label">Inactive</div>
                  <div className="sa-stat-value" style={{ color: '#fb7185' }}>{stats?.inactive ?? '—'}</div>
                  <div className="sa-stat-desc">Need attention</div>
                  <div className="sa-stat-bar" style={{ background: 'linear-gradient(90deg,transparent,#f43f5e,transparent)' }} />
                </div>
              </div>

              {/* Campus cards */}
              {campusAggregates.length > 0 && (
                <>
                  <div className="sa-section-title">
                    🏫 Campuses
                    <span className="sa-section-badge">{campusAggregates.length}</span>
                  </div>
                  <div className="sa-campus-grid">
                    {campusAggregates.map(({ campus, adminCount, constituencyCount, members }) => (
                      <div
                        key={campus.id}
                        className="sa-campus-card"
                        onClick={() => setSelectedCampusId(campus.id)}
                      >
                        <div className="sa-campus-top">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏫</div>
                            <div className="sa-campus-name">{campus.name}</div>
                          </div>
                          <span className={`sa-status ${campus.isActive === false ? 'sa-status-inactive' : 'sa-status-active'}`} style={{ fontSize: 10 }}>
                            {campus.isActive === false ? 'Inactive' : 'Active'}
                          </span>
                        </div>
                        <div className="sa-campus-stats">
                          <div className="sa-campus-stat-row">
                            <span>Admins</span><span>{adminCount}</span>
                          </div>
                          <div className="sa-campus-stat-row">
                            <span>Constituencies</span><span>{constituencyCount}</span>
                          </div>
                          <div className="sa-campus-stat-row">
                            <span>Members</span>
                            <span style={{ color: 'var(--sa-teal)', fontWeight: 700 }}>{members}</span>
                          </div>
                        </div>
                        <div className="sa-campus-edit">
                          <button
                            className="sa-btn sa-btn-gold"
                            style={{ fontSize: 11 }}
                            onClick={e => { e.stopPropagation(); openEditCampus(campus); }}
                          >✏ Edit</button>
                        </div>
                      </div>
                    ))}
                    {/* New campus CTA */}
                    <div
                      className="sa-campus-card"
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', border: '1px dashed rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.03)' }}
                      onClick={() => setShowCampusModal(true)}
                    >
                      <span style={{ fontSize: 28, opacity: 0.4 }}>＋</span>
                      <span style={{ fontSize: 12, color: 'var(--sa-text-dim)' }}>Add Campus</span>
                    </div>
                  </div>
                </>
              )}

              {/* Quick-link action cards */}
              <div className="sa-section-title" style={{ marginTop: 8 }}>Quick Access</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
                {[
                  { icon: '🛡', label: 'Admins', count: admins.length, view: 'admins' as const },
                  { icon: '👑', label: 'Leaders', count: leaders.length, view: 'leaders' as const },
                  { icon: '⛪', label: 'Ministries', count: ministryAccounts.length, view: 'ministries' as const },
                  { icon: '🆕', label: 'New Users', count: newlyRegistered.length, view: 'newly_registered' as const },
                ].map(item => (
                  <button
                    key={item.view}
                    onClick={() => { setViewMode(item.view); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                      background: 'var(--sa-surface)', border: '1px solid var(--sa-border)',
                      color: 'var(--sa-text)', textAlign: 'left', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--sa-border)')}
                  >
                    <span style={{ fontSize: 22 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{item.label}</div>
                      {item.count > 0 && <div style={{ fontSize: 11, color: 'var(--sa-text-dim)' }}>{item.count} records</div>}
                    </div>
                    <span style={{ marginLeft: 'auto', color: 'var(--sa-text-mute)' }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════
              ADMINS VIEW
              ════════════════════════════════════════════════ */}
          {!selectedCampus && viewMode === 'admins' && (
            <div>
              <div className="sa-page-header">
                <div>
                  <div className="sa-page-title">🛡 Admin Accounts</div>
                  <div className="sa-page-sub">All constituency admins — click a row to enter their app</div>
                </div>
              </div>
              <div className="sa-table-wrap">
                <div className="sa-table-head">
                  <div className="sa-table-title">
                    Constituences
                    <span className="sa-table-badge">{filteredAdmins.length}</span>
                  </div>
                  <input
                    className="sa-search"
                    placeholder="🔍  Search name, email, constituency…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="sa-table-scroll">
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Admin</th>
                        <th>Constituency</th>
                        <th>Campus</th>
                        <th>Members</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAdmins.map((a, idx) => {
                        const av = avatarProps(a.displayName || a.firstName, a.email);
                        return (
                          <tr
                            key={a.id}
                            onClick={e => { if ((e.target as HTMLElement).closest('select,button,input')) return; if (a.churchId) startImpersonation((a as any).uid || a.id, a.churchId!); }}
                            title={a.churchId ? 'Click to enter app as this admin' : ''}
                          >
                            <td style={{ color: 'var(--sa-text-mute)', fontSize: 11, textAlign: 'right', width: 36 }}>{idx + 1}</td>
                            <td>
                              <div className="sa-user-cell">
                                <div className="sa-avatar" style={{ background: av.bg }}>{av.initials}</div>
                                <div className="sa-user-info">
                                  <span className="sa-user-name">{a.displayName || a.firstName || '—'}</span>
                                  <span className="sa-user-email">{a.email || '—'}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              {editingConstituencyId === a.id ? (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <input
                                    autoFocus
                                    className="sa-input"
                                    style={{ fontSize: 12, padding: '4px 8px', width: 140 }}
                                    value={constituencyInput}
                                    onChange={e => setConstituencyInput(e.target.value)}
                                  />
                                  <button className="sa-btn sa-btn-teal" onClick={() => saveConstituency(a)} disabled={savingConstituencyId === a.id}>{savingConstituencyId === a.id ? '…' : '✓'}</button>
                                  <button className="sa-btn sa-btn-ghost" onClick={cancelEditConstituency}>✕</button>
                                </div>
                              ) : (
                                <div className="sa-constituency">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span className="sa-const-name">{a.churchName || <span style={{ color: 'var(--sa-text-mute)', fontStyle: 'italic' }}>Unset</span>}</span>
                                    <button className="sa-rename-btn" onClick={e => { e.stopPropagation(); startEditConstituency(a); }}>✏</button>
                                  </div>
                                  {a.churchId && <span className="sa-const-id">{a.churchId.slice(0, 8)}…</span>}
                                </div>
                              )}
                            </td>
                            <td>
                              <select
                                className="sa-select"
                                style={{ fontSize: 11, padding: '4px 8px' }}
                                value={(a as any).campusId || ''}
                                onChange={e => { e.stopPropagation(); assignCampus(a, e.target.value || null); }}
                              >
                                <option value="">No Campus</option>
                                {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {a.churchId
                                ? (a.memberCount != null
                                  ? <strong>{a.memberCount}</strong>
                                  : (memberCountsLoading ? <span style={{ color: 'var(--sa-text-mute)' }}>…</span> : '—'))
                                : '—'}
                            </td>
                            <td>
                              <span className={`sa-status ${a.isActive !== false ? 'sa-status-active' : 'sa-status-inactive'}`}>
                                {a.isActive !== false ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <button
                                  className={`sa-btn ${a.isActive !== false ? 'sa-toggle-active' : 'sa-toggle-inactive'}`}
                                  disabled={updatingIds[a.id]}
                                  onClick={e => { e.stopPropagation(); toggleActiveStatus(a); }}
                                >{updatingIds[a.id] ? '…' : (a.isActive !== false ? 'Deactivate' : 'Activate')}</button>
                                <button
                                  className="sa-btn sa-btn-rose"
                                  disabled={updatingIds[a.id]}
                                  onClick={e => { e.stopPropagation(); softDeleteAdmin(a); }}
                                >Delete</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredAdmins.length === 0 && (
                        <tr><td colSpan={7}><div className="sa-empty"><span className="sa-empty-icon">🛡</span>No admins found.</div></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════
              LEADERS VIEW
              ════════════════════════════════════════════════ */}
          {!selectedCampus && viewMode === 'leaders' && (
            <div>
              <div className="sa-page-header">
                <div>
                  <div className="sa-page-title">👑 Leaders</div>
                  <div className="sa-page-sub">Promote a leader to admin to swap their roles</div>
                </div>
              </div>
              {leadersLoading && <div className="sa-loading">Loading leaders…</div>}
              {!leadersLoading && (
                <div className="sa-table-wrap">
                  <div className="sa-table-head">
                    <div className="sa-table-title">
                      Leaders
                      <span className="sa-table-badge">{filteredLeaders.length}</span>
                    </div>
                    <input
                      className="sa-search"
                      placeholder="🔍  Search leaders…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="sa-table-scroll">
                    <table className="sa-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Leader</th>
                          <th>Constituency</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Joined</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLeaders.map((l, idx) => {
                          const av = avatarProps(l.displayName || l.firstName, l.email);
                          const created = (l as any).createdAt?.toDate ? (l as any).createdAt.toDate() : ((l as any).createdAt ? new Date((l as any).createdAt) : null);
                          return (
                            <tr key={l.id}>
                              <td style={{ color: 'var(--sa-text-mute)', fontSize: 11, textAlign: 'right', width: 36 }}>{idx + 1}</td>
                              <td>
                                <div className="sa-user-cell">
                                  <div className="sa-avatar" style={{ background: av.bg }}>{av.initials}</div>
                                  <div className="sa-user-info">
                                    <span className="sa-user-name">{l.displayName || l.firstName || '—'}</span>
                                    <span className="sa-user-email">{l.email || '—'}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div className="sa-constituency">
                                  <span className="sa-const-name">{l.churchName || '—'}</span>
                                  {l.churchId && <span className="sa-const-id">{l.churchId.slice(0, 8)}…</span>}
                                </div>
                              </td>
                              <td>
                                <span className={`sa-role-pill ${l.role === 'leader' ? 'sa-role-green' : l.role === 'admin' ? 'sa-role-yellow' : ''}`}>{l.role || 'leader'}</span>
                              </td>
                              <td>
                                <span className={`sa-status ${l.isActive !== false ? 'sa-status-active' : 'sa-status-inactive'}`}>
                                  {l.isActive !== false ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td style={{ color: 'var(--sa-text-dim)', fontSize: 12, whiteSpace: 'nowrap' }}>
                                {created ? created.toLocaleDateString() : '—'}
                              </td>
                              <td>
                                <button
                                  className="sa-btn sa-btn-gold"
                                  disabled={updatingIds[l.id]}
                                  onClick={() => setPendingPromotion(l)}
                                  title="Promote to Admin (current admin becomes leader)"
                                >↑ Promote</button>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredLeaders.length === 0 && (
                          <tr><td colSpan={7}><div className="sa-empty"><span className="sa-empty-icon">👑</span>No leaders found.</div></td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════
              MINISTRIES VIEW
              ════════════════════════════════════════════════ */}
          {!selectedCampus && viewMode === 'ministries' && (
            <div>
              <div className="sa-page-header">
                <div>
                  <div className="sa-page-title">⛪ Ministries</div>
                  <div className="sa-page-sub">Active and unassigned ministry accounts</div>
                </div>
              </div>

              {/* Active ministries */}
              <div className="sa-table-wrap" style={{ marginBottom: 24 }}>
                <div className="sa-table-head">
                  <div className="sa-table-title">Active<span className="sa-table-badge">{ministryAccounts.length}</span></div>
                </div>
                <div className="sa-table-scroll">
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>#</th><th>Ministry Admin</th><th>Ministry Name</th><th>Members</th><th>Status</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ministryAccounts.map((m, idx) => {
                        const av = avatarProps(m.displayName || m.firstName, m.email);
                        return (
                          <tr key={m.id} onClick={e => { if ((e.target as HTMLElement).closest('button')) return; if (m.churchId) startImpersonation((m as any).uid || m.id, m.churchId!); }} title={m.churchId ? 'Enter ministry app' : ''}>
                            <td style={{ color: 'var(--sa-text-mute)', fontSize: 11, textAlign: 'right', width: 36 }}>{idx + 1}</td>
                            <td>
                              <div className="sa-user-cell">
                                <div className="sa-avatar" style={{ background: av.bg }}>{av.initials}</div>
                                <div className="sa-user-info">
                                  <span className="sa-user-name">{m.displayName || m.firstName || '—'}</span>
                                  <span className="sa-user-email">{m.email || '—'}</span>
                                </div>
                              </div>
                            </td>
                            <td style={{ color: 'var(--sa-text)', fontSize: 13 }}>{m.preferences?.ministryName || m.churchName || '—'}</td>
                            <td style={{ textAlign: 'center' }}>{m.memberCount ?? '—'}</td>
                            <td><span className={`sa-status ${m.isActive !== false ? 'sa-status-active' : 'sa-status-inactive'}`}>{m.isActive !== false ? 'Active' : 'Inactive'}</span></td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {m.churchId && <button className="sa-btn sa-btn-teal" onClick={e => { e.stopPropagation(); startImpersonation((m as any).uid || m.id, m.churchId!); }}>👁 Enter</button>}
                                <button className={`sa-btn ${m.isActive !== false ? 'sa-toggle-active' : 'sa-toggle-inactive'}`} disabled={updatingIds[m.id]} onClick={e => { e.stopPropagation(); toggleActiveStatus(m); }}>{updatingIds[m.id] ? '…' : (m.isActive !== false ? 'Deactivate' : 'Activate')}</button>
                                <button className="sa-btn sa-btn-rose" disabled={updatingIds[m.id]} onClick={e => { e.stopPropagation(); softDeleteAdmin(m); }}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {ministryAccounts.length === 0 && <tr><td colSpan={6}><div className="sa-empty"><span className="sa-empty-icon">⛪</span>No active ministries.</div></td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Unassigned / deleted ministries */}
              {unassignedMinistries.length > 0 && (
                <div className="sa-table-wrap" style={{ borderColor: 'rgba(251,146,60,0.2)' }}>
                  <div className="sa-table-head" style={{ borderBottom: '1px solid rgba(251,146,60,0.15)' }}>
                    <div className="sa-table-title" style={{ color: '#fb923c' }}>
                      ⚠ Unassigned / Deleted
                      <span className="sa-table-badge" style={{ background: 'rgba(251,146,60,0.12)', color: '#fb923c', borderColor: 'rgba(251,146,60,0.25)' }}>{unassignedMinistries.length}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--sa-text-dim)' }}>These can be restored</span>
                  </div>
                  <div className="sa-table-scroll">
                    <table className="sa-table">
                      <thead>
                        <tr><th>#</th><th>Admin</th><th>Ministry</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {unassignedMinistries.map((m, idx) => {
                          const av = avatarProps(m.displayName || m.firstName, m.email);
                          return (
                            <tr key={m.id}>
                              <td style={{ color: 'var(--sa-text-mute)', fontSize: 11, textAlign: 'right', width: 36 }}>{idx + 1}</td>
                              <td>
                                <div className="sa-user-cell">
                                  <div className="sa-avatar" style={{ background: av.bg }}>{av.initials}</div>
                                  <div className="sa-user-info">
                                    <span className="sa-user-name">{m.displayName || m.firstName || '—'}</span>
                                    <span className="sa-user-email">{m.email || '—'}</span>
                                  </div>
                                </div>
                              </td>
                              <td>{m.preferences?.ministryName || m.churchName || '—'}</td>
                              <td>
                                <button className="sa-btn sa-btn-teal" onClick={() => restoreMinistry(m)}>↩ Restore</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════
              NEWLY REGISTERED VIEW
              ════════════════════════════════════════════════ */}
          {!selectedCampus && viewMode === 'newly_registered' && (
            <div>
              <div className="sa-page-header">
                <div>
                  <div className="sa-page-title">🆕 New Users</div>
                  <div className="sa-page-sub">Recently registered users awaiting assignment</div>
                </div>
                <button className="sa-btn sa-btn-ghost" onClick={refreshAllData} style={{ padding: '9px 16px' }}>⟳ Refresh</button>
              </div>
              {newlyRegisteredLoading && <div className="sa-loading">Loading…</div>}
              {!newlyRegisteredLoading && (
                <div className="sa-table-wrap">
                  <div className="sa-table-head">
                    <div className="sa-table-title">Recent Registrations<span className="sa-table-badge">{newlyRegistered.length}</span></div>
                  </div>
                  <div className="sa-table-scroll">
                    <table className="sa-table">
                      <thead>
                        <tr><th>#</th><th>User</th><th>Role</th><th>Constituency</th><th>Joined</th><th>Last Login</th></tr>
                      </thead>
                      <tbody>
                        {newlyRegistered.map((u, idx) => {
                          const av = avatarProps(u.displayName || u.firstName, u.email);
                          const created = (u as any).createdAt?.toDate ? (u as any).createdAt.toDate() : ((u as any).createdAt ? new Date((u as any).createdAt) : null);
                          const lastLogin = (u as any).lastLoginAt?.toDate ? (u as any).lastLoginAt.toDate() : ((u as any).lastLoginAt ? new Date((u as any).lastLoginAt) : null);
                          return (
                            <tr key={u.id}>
                              <td style={{ color: 'var(--sa-text-mute)', fontSize: 11, textAlign: 'right', width: 36 }}>{idx + 1}</td>
                              <td>
                                <div className="sa-user-cell">
                                  <div className="sa-avatar" style={{ background: av.bg }}>{av.initials}</div>
                                  <div className="sa-user-info">
                                    <span className="sa-user-name">{u.displayName || u.firstName || '—'}</span>
                                    <span className="sa-user-email">{u.email || '—'}</span>
                                  </div>
                                </div>
                              </td>
                              <td><span className="sa-role-pill sa-role-blue">{u.role || 'member'}</span></td>
                              <td style={{ color: 'var(--sa-text-dim)', fontSize: 12 }}>{u.churchName || '—'}</td>
                              <td style={{ color: 'var(--sa-text-dim)', fontSize: 12, whiteSpace: 'nowrap' }}>{created ? created.toLocaleDateString() : '—'}</td>
                              <td style={{ color: 'var(--sa-text-dim)', fontSize: 12, whiteSpace: 'nowrap' }}>{lastLogin ? lastLogin.toLocaleDateString() : '—'}</td>
                            </tr>
                          );
                        })}
                        {newlyRegistered.length === 0 && <tr><td colSpan={6}><div className="sa-empty"><span className="sa-empty-icon">🆕</span>No new users found.</div></td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════
              ALL MEMBERS VIEW
              ════════════════════════════════════════════════ */}
          {!selectedCampus && viewMode === 'all_members' && (
            <div>
              <div className="sa-page-header">
                <div>
                  <div className="sa-page-title">👥 All Members</div>
                  <div className="sa-page-sub">Every member across all constituencies ({totalMembers?.toLocaleString() ?? '…'} total)</div>
                </div>
                <button className="sa-btn sa-btn-ghost" onClick={loadAllMembers} style={{ padding: '9px 16px' }}>⟳ Refresh</button>
              </div>
              {allMembersLoading && <div className="sa-loading">Loading members…</div>}
              {!allMembersLoading && (
                <div className="sa-table-wrap">
                  <div className="sa-table-head">
                    <div className="sa-table-title">Members<span className="sa-table-badge">{allMembers.length}</span></div>
                  </div>
                  <div className="sa-table-scroll">
                    <table className="sa-table">
                      <thead>
                        <tr><th>#</th><th>Member</th><th>Role</th><th>Constituency</th><th>Bacenta Leader</th><th>Phone</th></tr>
                      </thead>
                      <tbody>
                        {allMembers.map((m: Member, idx: number) => {
                          const av = avatarProps(`${(m as any).firstName || ''} ${(m as any).lastName || ''}`.trim(), (m as any).email);
                          return (
                            <tr key={(m as any).id}>
                              <td style={{ color: 'var(--sa-text-mute)', fontSize: 11, textAlign: 'right', width: 36 }}>{idx + 1}</td>
                              <td>
                                <div className="sa-user-cell">
                                  <div className="sa-avatar" style={{ background: av.bg }}>{av.initials}</div>
                                  <div className="sa-user-info">
                                    <span className="sa-user-name">{(m as any).firstName} {(m as any).lastName}</span>
                                    <span className="sa-user-email">{(m as any).email || '—'}</span>
                                  </div>
                                </div>
                              </td>
                              <td><span className="sa-role-pill">{(m as any).role || 'member'}</span></td>
                              <td style={{ color: 'var(--sa-text-dim)', fontSize: 12 }}>{(m as any).churchName || '—'}</td>
                              <td style={{ color: 'var(--sa-text-dim)', fontSize: 12 }}>{(m as any).bacentaLeaderName || '—'}</td>
                              <td style={{ color: 'var(--sa-text-dim)', fontSize: 12 }}>{(m as any).phoneNumber || '—'}</td>
                            </tr>
                          );
                        })}
                        {allMembers.length === 0 && <tr><td colSpan={6}><div className="sa-empty"><span className="sa-empty-icon">👥</span>No members found.</div></td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <p style={{ marginTop: 32, fontSize: 10, textAlign: 'center', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--sa-text-mute)' }}>
            SuperAdmin Console · Global Constituency Management
          </p>
        </main>
      </div>

      {/* ════════════════════════════════════════════════
          MODALS
          ════════════════════════════════════════════════ */}

      {/* Create Campus */}
      {
        showCampusModal && (
          <div className="sa-modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !creatingCampus) setShowCampusModal(false); }}>
            <div className="sa-modal">
              <div className="sa-modal-header">
                <div className="sa-modal-title">🏫 New Campus</div>
                <button className="sa-modal-close" onClick={() => !creatingCampus && setShowCampusModal(false)}>×</button>
              </div>
              <div className="sa-modal-body">
                <div className="sa-form-group">
                  <label className="sa-form-label">Campus Name</label>
                  <input
                    autoFocus
                    className="sa-input"
                    value={newCampusName}
                    onChange={e => setNewCampusName(e.target.value)}
                    placeholder="e.g. North Campus"
                    onKeyDown={e => e.key === 'Enter' && !creatingCampus && createCampus()}
                  />
                  {campusError && <span className="sa-form-error">{campusError}</span>}
                </div>
              </div>
              <div className="sa-modal-footer">
                <button className="sa-btn sa-btn-ghost" onClick={() => setShowCampusModal(false)} disabled={creatingCampus}>Cancel</button>
                <button
                  className="sa-btn sa-btn-gold"
                  style={{ padding: '9px 20px', fontSize: 13 }}
                  disabled={creatingCampus || !newCampusName.trim()}
                  onClick={async () => { await createCampus(); if (!campusError) setShowCampusModal(false); }}
                >{creatingCampus ? 'Creating…' : 'Create Campus'}</button>
              </div>
            </div>
          </div>
        )
      }

      {/* Edit Campus */}
      {
        editingCampus && !confirmDeleteCampus && (
          <div className="sa-modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !creatingCampus && !deletingCampus) setEditingCampus(null); }}>
            <div className="sa-modal">
              <div className="sa-modal-header">
                <div className="sa-modal-title">✏ Edit Campus</div>
                <button className="sa-modal-close" onClick={() => !creatingCampus && !deletingCampus && setEditingCampus(null)}>×</button>
              </div>
              <div className="sa-modal-body">
                <div className="sa-form-group">
                  <label className="sa-form-label">Campus Name</label>
                  <input
                    autoFocus
                    className="sa-input"
                    value={editingCampusName}
                    onChange={e => setEditingCampusName(e.target.value)}
                  />
                  {campusError && <span className="sa-form-error">{campusError}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0 0', borderTop: '1px solid var(--sa-border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--sa-text-dim)' }}>Active</span>
                  <select
                    className="sa-select"
                    style={{ fontSize: 12 }}
                    value={editingCampus.isActive === false ? 'inactive' : 'active'}
                    onChange={e => setEditingCampus({ ...editingCampus, isActive: e.target.value === 'active' })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="sa-modal-footer space-between">
                <button
                  className="sa-btn sa-btn-rose"
                  disabled={creatingCampus || deletingCampus}
                  onClick={() => setConfirmDeleteCampus(true)}
                >{deletingCampus ? 'Deleting…' : 'Delete Campus'}</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="sa-btn sa-btn-ghost" disabled={creatingCampus || deletingCampus} onClick={() => setEditingCampus(null)}>Cancel</button>
                  <button
                    className="sa-btn sa-btn-gold"
                    style={{ padding: '9px 18px' }}
                    disabled={creatingCampus || deletingCampus}
                    onClick={saveCampusEdit}
                  >{creatingCampus ? 'Saving…' : 'Save Changes'}</button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Confirm delete campus */}
      <ConfirmationModal
        isOpen={!!editingCampus && confirmDeleteCampus}
        onClose={() => setConfirmDeleteCampus(false)}
        onConfirm={() => { setConfirmDeleteCampus(false); performDeleteCampus(); }}
        title="Delete Campus"
        message={editingCampus ? `Delete campus "${editingCampus.name}"? Constituencies will become unassigned.` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      {/* Promote leader to admin */}
      <ConfirmationModal
        isOpen={!!pendingPromotion}
        onClose={() => setPendingPromotion(null)}
        onConfirm={async () => { if (pendingPromotion) await promoteLeaderToAdmin(pendingPromotion); }}
        title="Promote Leader"
        message={pendingPromotion ? `Promote ${pendingPromotion.displayName || pendingPromotion.email} to Admin? The current admin for their constituency will become a leader.` : ''}
        confirmText="Promote"
        cancelText="Cancel"
        type="info"
      />

      {/* ── MOBILE BOTTOM NAV (phone only, hidden via CSS on larger screens) ── */}
      {!isImpersonating && (
        <nav className="sa-bottom-nav">
          {[
            { icon: '📊', label: 'Home', view: 'dashboard' as const },
            { icon: '🛡', label: 'Admins', view: 'admins' as const },
            { icon: '👑', label: 'Leaders', view: 'leaders' as const },
            { icon: '🆕', label: 'New', view: 'newly_registered' as const },
            { icon: '👥', label: 'Members', view: 'all_members' as const },
          ].map(item => (
            <button
              key={item.view}
              className={`sa-bottom-nav-btn ${viewMode === item.view && !selectedCampusId ? 'active' : ''}`}
              onClick={() => { setSelectedCampusId(null); setViewMode(item.view); }}
            >
              <span className="bnav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );

};

export default SuperAdminDashboard;
