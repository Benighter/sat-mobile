import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { collection, getDocs, getDoc, query, where, limit, updateDoc, doc, Timestamp, onSnapshot, addDoc, setDoc } from 'firebase/firestore';
// NOTE: Removed getFunctions/httpsCallable usage for member counts due to CORS issues on callable function.
// import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../firebase.config';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import AdminChurchPreview from './AdminChurchPreview';
import ConfirmationModal from '../modals/confirmations/ConfirmationModal';
import { ministryAccessService } from '../../services/ministryAccessService';
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
}

interface SuperAdminDashboardProps {
  onSignOut: () => void;
}

// Lightweight badge using existing color utilities
const StatusBadge: React.FC<{ active: boolean }> = ({ active }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide shadow-sm transition-colors
    ${active ? 'bg-green-600/90 text-white border border-green-500/70' : 'bg-red-600/90 text-white border border-red-500/70'}`}
  >{active ? 'ACTIVE' : 'INACTIVE'}</span>
);

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onSignOut }) => {
  const { isImpersonating, startImpersonation } = useAppContext();
  const [previewAdmin, setPreviewAdmin] = useState<AdminUserRecord | null>(null);
  const [admins, setAdmins] = useState<AdminUserRecord[]>([]);
  // Leaders state and view toggle
  const [leaders, setLeaders] = useState<AdminUserRecord[]>([]);
  const [viewMode, setViewMode] = useState<'dashboard' | 'admins' | 'leaders' | 'newly_registered' | 'all_members'>('dashboard');
  const [leadersLoading, setLeadersLoading] = useState(false);
  const [newlyRegistered, setNewlyRegistered] = useState<AdminUserRecord[]>([]);
  const [newlyRegisteredLoading, setNewlyRegisteredLoading] = useState(false);

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
  // Ministry access requests
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [superAdminNotifications, setSuperAdminNotifications] = useState<any[]>([]);

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

  // Function to manually reload access requests
  const loadAccessRequests = useCallback(async () => {
    try {
      setAccessLoading(true);
      setAccessError(null);
      const qReq = query(
        collection(db, 'ministryAccessRequests'),
        where('status', '==', 'pending'),
        limit(200)
      );
      const snapshot = await getDocs(qReq);
      const items = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      items.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setAccessRequests(items);
    } catch (e: any) {
      console.error('Failed to load access requests', e);
      setAccessError(e.message || 'Failed to load access requests');
    } finally {
      setAccessLoading(false);
    }
  }, []);

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
      setStats({
        total: filtered.length,
        active: filtered.filter(a => a.isActive !== false).length,
        inactive: filtered.filter(a => a.isActive === false).length
      });

      // Force reload member counts and access requests in parallel
      await Promise.all([
        computeMemberCounts(filtered, true), // Force full recount
        loadAccessRequests() // Reload access requests
      ]);

    } catch (e: any) {
      console.error('Failed to refresh data', e);
      setError(e.message || 'Failed to refresh data');
    } finally {
      setLoading(false);
    }
  }, [loadAccessRequests]);

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

  // Load ministry access requests (realtime)
  useEffect(() => {
    try {
      setAccessLoading(true);
      const qReq = query(
        collection(db, 'ministryAccessRequests'),
        where('status', '==', 'pending'),
        limit(200)
      );
      const unsub = onSnapshot(qReq, snap => {
        const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        items.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setAccessRequests(items);
        setAccessLoading(false);
      }, err => { setAccessError(err?.message || 'Failed to load access requests'); setAccessLoading(false); });
      return () => { try { unsub(); } catch {} };
    } catch (e:any) {
      setAccessError(e.message || 'Failed to load access requests');
      setAccessLoading(false);
    }
  }, []);

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
        items.sort((a,b) => {
          if (a.isRead !== b.isRead) {
            return a.isRead ? 1 : -1; // Unread items first
          }
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        });
        setSuperAdminNotifications(items);
      }, err => {
        console.error('Failed to load superAdmin notifications:', err);
      });
      return () => { try { unsub(); } catch {} };
    } catch (e:any) {
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

  const approveAccess = useCallback(async (req: any) => {
    try {
      await ministryAccessService.approveRequest(req.id, { uid: 'superadmin', name: 'SuperAdmin' });
      // Notify requester in their ministry church context if available, else admin's church
      const churchId = req.ministryChurchId || req.requesterChurchId || (admins.find(a => a.uid === req.requesterUid)?.churchId) || null;
      if (churchId) {
        // Scope notifications to that church for delivery
        setNotificationContext({} as any, churchId);
        await notificationService.createForRecipients([
          req.requesterUid
        ], 'system_message' as any, 'Ministry access approved', { description: 'Your ministry account has been approved. You can now view cross-church ministry data.' }, undefined, { id: 'superadmin', name: 'SuperAdmin' });
      }

      // Mark related notification as read
      const relatedNotification = superAdminNotifications.find(n => n.requestId === req.id);
      if (relatedNotification) {
        await markNotificationAsRead(relatedNotification.id);
      }
    } catch (e:any) {
      setAccessError(e.message || 'Failed to approve request');
    }
  }, [admins, superAdminNotifications, markNotificationAsRead]);

  const rejectAccess = useCallback(async (req: any) => {
    try {
      await ministryAccessService.rejectRequest(req.id, { uid: 'superadmin', name: 'SuperAdmin' });
      const churchId = req.ministryChurchId || req.requesterChurchId || (admins.find(a => a.uid === req.requesterUid)?.churchId) || null;
      if (churchId) {
        setNotificationContext({} as any, churchId);
        await notificationService.createForRecipients([
          req.requesterUid
        ], 'system_message' as any, 'Ministry access rejected', { description: 'Your ministry access request was rejected. Contact SuperAdmin for details.' }, undefined, { id: 'superadmin', name: 'SuperAdmin' });
      }

      // Mark related notification as read
      const relatedNotification = superAdminNotifications.find(n => n.requestId === req.id);
      if (relatedNotification) {
        await markNotificationAsRead(relatedNotification.id);
      }
    } catch (e:any) {
      setAccessError(e.message || 'Failed to reject request');
    }
  }, [admins, superAdminNotifications, markNotificationAsRead]);

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
        filtered.sort((a,b) => getTime(b.createdAt) - getTime(a.createdAt));
        setLeaders(filtered);
      } catch (e) {
        console.warn('Leaders snapshot processing failed', e);
      } finally {
        setLeadersLoading(false);
      }
    }, err => { setLeadersLoading(false); setError(err?.message || 'Failed to load leaders'); });
    return () => { try { unsubL(); } catch {} };
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
        filtered.sort((a,b) => getTime(b.createdAt) - getTime(a.createdAt));
        setNewlyRegistered(filtered);
      } catch (e) {
        console.warn('Newly registered snapshot processing failed', e);
      } finally {
        setNewlyRegisteredLoading(false);
      }
    }, err => { setNewlyRegisteredLoading(false); setError(err?.message || 'Failed to load newly registered users'); });
    return () => { try { unsubNR(); } catch {} };
  }, [viewMode]);

  // Load campuses (realtime)
  useEffect(() => {
    const qCampuses = query(collection(db, 'campuses'), limit(200));
    const unsub = onSnapshot(qCampuses, snap => {
  const list: CampusRecord[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(c => !(c as any).isDeleted);
  list.sort((a,b) => (a.name || '').localeCompare(b.name || '', 'en', { sensitivity: 'base' })); // alphabetical by default
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
        filtered.sort((a,b) => getTime(b.createdAt) - getTime(a.createdAt));
        setAdmins(filtered);
        setStats({
          total: filtered.length,
          active: filtered.filter(a => a.isActive !== false).length,
          inactive: filtered.filter(a => a.isActive === false).length
        });
        // If every admin has a numeric memberCount, aggregate directly; else run computeMemberCounts (which will reconcile)
        const allHaveCounts = filtered.length > 0 && filtered.every(a => typeof a.memberCount === 'number');
        if (allHaveCounts) {
          setTotalMembers(filtered.reduce((s,a) => s + (a.memberCount || 0), 0));
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
        try { current[cid]!(); } catch {}
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
      Object.values(memberListenersRef.current).forEach(u => { try { u(); } catch {} });
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
    } catch (e:any) {
      setError(e.message || 'Failed to update status');
    } finally {
      setUpdating(admin.id, false);
    }
  };

  const softDeleteAdmin = async (admin: AdminUserRecord) => {
    // Reuse the same state for hard-delete confirmation
    setPendingDeleteAdmin(admin);
  };

  const performSoftDeleteAdmin = async () => {
    // Soft delete locally (Firestore only) to avoid CORS with callable
    const admin = pendingDeleteAdmin;
    if (!admin) return;
    try {
      setUpdating(admin.id, true);
      await updateDoc(doc(db, 'users', admin.id), {
        isDeleted: true,
        isActive: false,
        deletedAt: Timestamp.now(),
        lastUpdated: Timestamp.now()
      });
      setAdmins(prev => prev.filter(a => a.id !== admin.id));
      setStats(prev => prev ? {
        total: Math.max(0, prev.total - 1),
        active: Math.max(0, prev.active - (admin.isActive !== false ? 1 : 0)),
        inactive: Math.max(0, prev.inactive - (admin.isActive === false ? 1 : 0))
      } : prev);
    } catch (e:any) {
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
      try { window.dispatchEvent(new CustomEvent('constituencyUpdated', { detail: { adminId: admin.id, newName } })); } catch {}

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
          try { window.dispatchEvent(new CustomEvent('constituencyUpdated', { detail: { adminId: admin.id, newName, cascade: true } })); } catch {}
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
    } catch (e:any) {
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
    } catch (e:any) {
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
      // Soft delete campus
      await updateDoc(doc(db, 'campuses', editingCampus.id), { isDeleted: true, deletedAt: Timestamp.now() });
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
    } catch (e:any) {
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
    } catch (e:any) {
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
      } catch (e:any) {
        setError(e.message || 'Failed to promote leader');
        return;
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

  // (Removed legacy read-only constituency detail; full impersonation implemented instead)

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Global background */}
      <div className="fixed inset-0 bg-gradient-to-br from-white/50 via-gray-50/30 to-gray-100/20 dark:from-dark-900/50 dark:via-dark-800/30 dark:to-dark-700/20 pointer-events-none" />

      {/* Fixed Header (mirrors main app style, simplified) */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-r from-blue-50/95 via-white/95 to-indigo-50/95 dark:from-dark-800/95 dark:via-dark-900/95 dark:to-dark-800/95 backdrop-blur-md border-b border-gray-200/50 dark:border-dark-600/50 shadow-xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 desktop:px-10 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Logo + Title */}
            <button
              onClick={() => { setSelectedCampusId(null); }}
              className="group flex items-center gap-3 sm:gap-4 focus:outline-none"
              title="Return to main dashboard"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white dark:bg-dark-700 rounded-xl flex items-center justify-center shadow ring-2 ring-blue-100 dark:ring-dark-600 p-1 group-hover:scale-105 transition-transform">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div className="hidden xs:block text-left">
                <h1 className="text-lg sm:text-2xl font-bold gradient-text font-serif leading-tight group-hover:opacity-90">Super Admin</h1>
                <p className="text-[11px] sm:text-xs text-gray-600 dark:text-dark-300 font-medium tracking-wide">Global Constituency Management</p>
              </div>
            </button>
            {/* Center spacer for better layout */}
            <div className="flex-1"></div>
            {/* Right actions - centered and well-spaced */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Notification Bell */}
              <NotificationBadge />

              <button
                onClick={refreshAllData}
                disabled={loading || memberCountsLoading || accessLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg hover:shadow-xl hover:from-indigo-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 transition-all duration-200"
                title="Refresh all data including stats, member counts, and access requests"
              >
                {(loading || memberCountsLoading || accessLoading) && (
                  <span className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin"/>
                )}
                <span>{(loading || memberCountsLoading || accessLoading) ? 'Refreshing…' : 'Refresh'}</span>
              </button>

              {!selectedCampus && (
                <button
                  onClick={() => setShowCampusModal(true)}
                  className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-xl hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-400 transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Campus
                </button>
              )}

              <button
                onClick={onSignOut}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg hover:shadow-xl hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content area with top padding to clear fixed header */}
      <div className="relative flex-1 pt-24 sm:pt-28 pb-10 px-3 sm:px-6 desktop:px-10 max-w-7xl w-full mx-auto">
  {/* Impersonation banner removed */}
        {/* Mobile quick actions under header */}
        {!selectedCampus && (
          <div className="flex sm:hidden items-center gap-2 mb-5">
            <button
              onClick={() => setShowCampusModal(true)}
              className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >New Campus</button>
          </div>
        )}

        {/* Enhanced View Toggle with Modern Design */}
        {!selectedCampus && (
          <div className="mb-8 flex justify-center">
            <div className="flex items-center gap-1.5 p-1.5 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-dark-700 dark:to-dark-600 rounded-2xl shadow-lg border border-white/20 dark:border-white/10">
              <button
                onClick={() => setViewMode('dashboard')}
                className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                  viewMode === 'dashboard'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg transform scale-105'
                    : 'text-gray-600 dark:text-dark-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-dark-500/50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V7zm0 0a2 2 0 012-2h6l2 2h6a2 2 0 012 2v2H3V7z" />
                  </svg>
                  Dashboard
                </span>
              </button>
              <button
                onClick={() => setViewMode('admins')}
                className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                  viewMode === 'admins'
                    ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg transform scale-105'
                    : 'text-gray-600 dark:text-dark-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-dark-500/50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  Admins ({admins.length})
                </span>
              </button>
              <button
                onClick={() => setViewMode('leaders')}
                className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                  viewMode === 'leaders'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg transform scale-105'
                    : 'text-gray-600 dark:text-dark-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-dark-500/50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Leaders ({leaders.length})
                </span>
              </button>
              <button
                onClick={() => setViewMode('newly_registered')}
                className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                  viewMode === 'newly_registered'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg transform scale-105'
                    : 'text-gray-600 dark:text-dark-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-dark-500/50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  New Users ({newlyRegistered.length})
                </span>
              </button>
              <button
                onClick={() => {
                  setViewMode('all_members');
                  loadAllMembers();
                }}
                className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                  viewMode === 'all_members'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg transform scale-105'
                    : 'text-gray-600 dark:text-dark-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-dark-500/50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  All Members ({allMembers.length})
                </span>
              </button>
            </div>
          </div>
        )}

  {/* Enhanced Dashboard Stats Grid - Only show on Dashboard tab */}
        {!selectedCampus && viewMode === 'dashboard' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12 mt-4">
            {/* Total Constituencies Card */}
            <div className="group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-600/10 rounded-3xl transform rotate-1 group-hover:rotate-2 transition-transform duration-300"></div>
              <div className="relative glass rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 group-hover:scale-[1.02] border border-white/20 dark:border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wider font-bold text-indigo-600 dark:text-indigo-400">Constituencies</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-black tracking-tight">{stats?.total ?? '-'}</p>
                  <p className="text-sm text-gray-700">Total registered</p>
                </div>
              </div>
            </div>

            {/* Total Members Card - Clickable */}
            <div
              className="group relative overflow-hidden cursor-pointer"
              onClick={() => {
                setViewMode('all_members');
                loadAllMembers();
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-600/10 rounded-3xl transform -rotate-1 group-hover:-rotate-2 transition-transform duration-300"></div>
              <div className="relative glass rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 group-hover:scale-[1.02] border border-white/20 dark:border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wider font-bold text-blue-600 dark:text-blue-400">Members</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-black tracking-tight">
                    {totalMembers != null ? totalMembers.toLocaleString() : (memberCountsLoading ? '…' : '-')}
                  </p>
                  <p className="text-sm text-gray-700">Across all constituencies</p>
                  <p className="text-xs text-blue-600 font-medium">Click to view all members</p>
                </div>
              </div>
            </div>

            {/* Active Constituencies Card */}
            <div className="group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-600/10 rounded-3xl transform rotate-1 group-hover:rotate-2 transition-transform duration-300"></div>
              <div className="relative glass rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 group-hover:scale-[1.02] border border-white/20 dark:border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wider font-bold text-green-600 dark:text-green-400">Active</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-black tracking-tight">{stats?.active ?? '-'}</p>
                  <p className="text-sm text-gray-700">Operational constituencies</p>
                </div>
              </div>
            </div>

            {/* Inactive Constituencies Card */}
            <div className="group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-pink-600/10 rounded-3xl transform -rotate-1 group-hover:-rotate-2 transition-transform duration-300"></div>
              <div className="relative glass rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 group-hover:scale-[1.02] border border-white/20 dark:border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wider font-bold text-red-600 dark:text-red-400">Inactive</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-black tracking-tight">{stats?.inactive ?? '-'}</p>
                  <p className="text-sm text-gray-700">Require attention</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ministry Access Requests - Only show on Dashboard tab */}
        {!selectedCampus && viewMode === 'dashboard' && accessRequests.length > 0 && (
          <div className="lg:col-span-3 mb-8">
            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200/70 dark:border-dark-700 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200/60 dark:border-dark-700 flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold">Ministry Access Requests</h2>
                  <p className="text-xs text-gray-500">Approve or reject access to cross-church ministry data</p>
                </div>
                {accessLoading && <span className="text-xs text-gray-500">Loading…</span>}
              </div>
              {accessError && <div className="px-4 sm:px-6 py-2 text-sm text-red-600">{accessError}</div>}
              <div className="divide-y divide-gray-100 dark:divide-dark-700">
                {accessRequests.map(req => (
                  <div key={req.id} className="px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{req.requesterName || req.requesterEmail || req.requesterUid}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200`}>PENDING</span>
                      </div>
                      <div className="text-xs text-gray-500 truncate">Ministry: {req.ministryName || '—'}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => approveAccess(req)} className="px-3 py-1.5 text-xs rounded-md bg-green-600 text-white">Approve</button>
                      <button onClick={() => rejectAccess(req)} className="px-3 py-1.5 text-xs rounded-md bg-red-600 text-white">Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}



        {/* Notifications moved to bell icon in header - this section removed for cleaner dashboard */}

        {/* Campus Overview Cards */}
        {selectedCampus && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-dark-50 flex items-center gap-2"><span className="text-indigo-500">🏫</span> {selectedCampus.name}</h2>
              <button onClick={() => openEditCampus(selectedCampus)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white">Edit Campus</button>
            </div>
            <div className="glass rounded-2xl shadow overflow-hidden border border-gray-200/40 dark:border-dark-600/40">
              <div className="px-5 py-4 border-b border-gray-200/40 dark:border-dark-600/40 bg-white/60 dark:bg-dark-800/60 flex items-center justify-between">
                <h3 className="font-semibold text-gray-700 dark:text-dark-100 text-sm">Constituencies in this Campus</h3>
                <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-dark-700 text-[11px] font-semibold text-gray-600 dark:text-dark-300">{campusAdmins.length}</span>
              </div>
              <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
                <table className="min-w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 dark:text-dark-300 bg-gray-50/70 dark:bg-dark-700/70">
                      <th className="px-4 py-3 font-semibold w-10">#</th>
                      <th className="px-5 py-3 font-semibold">Admin</th>
                      <th className="px-5 py-3 font-semibold">Constituency</th>
                      <th className="px-5 py-3 font-semibold">Members</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Actions</th>
                      <th className="px-5 py-3 font-semibold">Campus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100/60 dark:divide-dark-600/40">
                    {campusAdmins.map((a, idx) => {
                      return (
                        <tr
                          key={a.id}
                          className="group hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20 cursor-pointer"
                          onClick={(e) => { if ((e.target as HTMLElement).closest('select,button,input')) return; if (a.churchId) startImpersonation((a as any).uid || a.id, a.churchId!); }}
                          title={a.churchId ? 'Enter app (impersonate)' : ''}
                        >
                          <td className="px-4 py-3 text-right text-gray-500 dark:text-dark-300">{idx + 1}</td>
                          <td className="px-5 py-3 whitespace-nowrap min-w-[180px]">
                            <div className="flex flex-col leading-tight">
                              <span className="font-medium text-gray-800 dark:text-dark-100 truncate max-w-[200px]">{a.displayName || a.firstName || '—'}</span>
                              <span className="text-[11px] text-gray-500 dark:text-dark-300 truncate max-w-[220px]">{a.email || '—'}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 min-w-[220px] text-gray-700 dark:text-dark-300">
                            {editingConstituencyId === a.id ? (
                              <div className="flex flex-col gap-1">
                                <input
                                  autoFocus
                                  value={constituencyInput}
                                  onChange={e => setConstituencyInput(e.target.value)}
                                  placeholder="Constituency name"
                                  className="px-2 py-1 rounded-md bg-white/70 dark:bg-dark-700/70 border border-gray-300 dark:border-dark-600 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => saveConstituency(a)}
                                    disabled={savingConstituencyId === a.id}
                                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                                  >{savingConstituencyId === a.id ? 'Saving...' : 'Save'}</button>
                                  <button
                                    onClick={cancelEditConstituency}
                                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-gray-300 dark:bg-dark-600 hover:bg-gray-400 dark:hover:bg-dark-500 text-gray-800 dark:text-dark-50"
                                  >Cancel</button>
                                </div>
                              </div>
                            ) : (
                              a.churchName ? (
                                <div className="flex flex-col leading-tight">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-800 dark:text-dark-100 truncate max-w-[180px] underline decoration-dotted" title={a.churchName}>{a.churchName}</span>
                                    <button
                                      onClick={() => startEditConstituency(a)}
                                      className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                                      title="Rename constituency"
                                    >Rename</button>
                                  </div>
                                  {a.churchId && <span className="text-[10px] text-gray-400 dark:text-dark-400 font-mono">{a.churchId}</span>}
                                </div>
                              ) : (
                                <button
                                  onClick={() => startEditConstituency(a)}
                                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                                >Set Name</button>
                              )
                            )}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap text-gray-700 dark:text-dark-300">
                            {a.churchId ? (
                              a.memberCount != null ? (
                                a.memberCount >= 0 ? (
                                  <span className="font-semibold" title="Members in this constituency">{a.memberCount}</span>
                                ) : (
                                  <span className="text-[11px] text-orange-500" title="Member count unavailable (permissions)">!</span>
                                )
                              ) : memberCountsLoading ? (
                                <span className="text-[11px] text-gray-400">…</span>
                              ) : (
                                <span className="text-[11px] text-gray-400">—</span>
                              )
                            ) : <span className="text-[11px] text-gray-400">—</span>}
                          </td>
                          <td className="px-5 py-3"><StatusBadge active={a.isActive !== false} /></td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleActiveStatus(a)}
                                disabled={updatingIds[a.id]}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                  ${a.isActive !== false
                                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                    : 'bg-green-600 hover:bg-green-700 text-white'}`}
                                title={a.isActive !== false ? 'Deactivate admin' : 'Activate admin'}
                              >
                                {updatingIds[a.id] ? '...' : (a.isActive !== false ? 'Deactivate' : 'Activate')}
                              </button>
                              <button
                                onClick={() => softDeleteAdmin(a)}
                                disabled={updatingIds[a.id]}
                                className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Soft delete admin"
                              >
                                {updatingIds[a.id] ? '...' : 'Delete'}
                              </button>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <select
                                value={(a as any).campusId || ''}
                                onChange={e => assignCampus(a, e.target.value || null)}
                                className="px-2 py-1 rounded-md bg-white/70 dark:bg-dark-700/70 border border-gray-300 dark:border-dark-600 text-[11px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
                              >
                                <option value="">Unassign</option>
                                {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                              {assigningRef.current[a.id] && <span className="text-[10px] text-indigo-500">Updating…</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {campusAdmins.length === 0 && (
                      <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500 dark:text-dark-300 text-sm">No constituencies yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

  {!isImpersonating && !selectedCampus && campusAggregates.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-dark-100 flex items-center gap-2"><span className="text-indigo-500">🏫</span> Campuses</h2>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-300">{campusAggregates.length}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {campusAggregates.map(({ campus, adminCount, constituencyCount, members }) => (
                <div key={campus.id} className="glass rounded-2xl p-5 shadow group hover:shadow-xl transition-all cursor-pointer" onClick={() => setSelectedCampusId(campus.id)}>
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-base text-gray-800 dark:text-dark-50 truncate" title={campus.name}>{campus.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${campus.isActive === false ? 'bg-red-600/90 text-white' : 'bg-green-600/90 text-white'}`}>{campus.isActive === false ? 'INACTIVE' : 'ACTIVE'}</span>
                  </div>
                  <div className="flex flex-col gap-2 text-[11px] font-medium text-gray-600 dark:text-dark-300">
                    <div className="flex items-center justify-between"><span>Admins</span><span className="text-gray-800 dark:text-dark-100 font-semibold tabular-nums">{adminCount}</span></div>
                    <div className="flex items-center justify-between"><span>Constituencies</span><span className="text-gray-800 dark:text-dark-100 font-semibold tabular-nums">{constituencyCount}</span></div>
                    <div className="flex items-center justify-between"><span>Members</span><span className="text-indigo-600 dark:text-indigo-400 font-semibold tabular-nums">{members}</span></div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); openEditCampus(campus); }} className="px-2 py-1 rounded-md text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white">Edit</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

  {!isImpersonating && !selectedCampus && (
          <>
        {error && (
          <div className="glass border-l-4 border-red-500 rounded-xl p-4 mb-6 shadow-md animate-scale-in">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

  {/* Table Card (admins or leaders) */}
  {viewMode === 'admins' && (
  <div className="glass rounded-2xl shadow-xl overflow-hidden border border-gray-200/40 dark:border-dark-600/40">
          <div className="px-5 py-4 flex flex-col gap-3 border-b border-gray-200/40 dark:border-dark-600/40 bg-white/60 dark:bg-dark-800/60 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-black dark:text-white text-lg flex items-center gap-2">
                <span className="text-black dark:text-white">▣</span> Admin Accounts / Constituencies
              </h2>
              <div className="flex items-center gap-3 text-xs font-medium text-gray-600 dark:text-dark-300">
                <span className="hidden xs:inline">Showing</span>
                <span className="px-2 py-0.5 rounded-lg bg-gray-200 text-gray-900 border border-gray-300 dark:bg-dark-700 dark:text-dark-50 dark:border-dark-600 shadow-sm">
                  {filteredAdmins.length}
                </span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search constituencies, admins, email..."
                className="w-full sm:max-w-xs px-3 py-2 rounded-lg bg-white/70 dark:bg-dark-700/70 border border-gray-300 dark:border-dark-600 text-[12px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-2 rounded-lg text-[11px] font-semibold bg-gray-300 dark:bg-dark-600 text-gray-800 dark:text-dark-50"
                >Clear</button>
              )}
              <div className="flex-1" />
              <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-dark-400">
                <span className="hidden md:inline">Tip: Use campus selector in each row to move a constituency</span>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar max-h-[60vh]">
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 dark:text-dark-300 bg-gray-50/70 dark:bg-dark-700/70 backdrop-blur-sm">
                  <th className="px-4 py-3 font-semibold w-10">#</th>
                  <th className="px-5 py-3 font-semibold w-36">Name</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Constituency</th>
                  <th className="px-5 py-3 font-semibold">Campus</th>
                  <th className="px-5 py-3 font-semibold">Members</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Created</th>
                  <th className="px-5 py-3 font-semibold">Last Login</th>
                  <th className="px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/60 dark:divide-dark-600/40">
                {filteredAdmins.map((a, idx) => {
                  const created = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : null);
                  const lastLogin = a.lastLoginAt?.toDate ? a.lastLoginAt.toDate() : (a.lastLoginAt ? new Date(a.lastLoginAt) : null);
                  return (
                    <tr
                      key={a.id}
                      className="group hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer"
                      onClick={(e) => { if ((e.target as HTMLElement).closest('select,button,input')) return; if (a.churchId) startImpersonation((a as any).uid || a.id, a.churchId!); }}
                      title={a.churchId ? 'Enter app (impersonate)' : ''}
                    >
                      <td className="px-4 py-3 text-gray-500 dark:text-dark-300 text-right tabular-nums select-none">{idx + 1}</td>
                      <td className="px-5 py-3 font-medium text-gray-800 dark:text-dark-50 whitespace-nowrap">
                        {a.displayName ? a.displayName.split(' ')[0] : (a.firstName || '—')}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-dark-200 whitespace-nowrap">{a.email || '—'}</td>
                      <td className="px-5 py-3 text-gray-700 dark:text-dark-300 min-w-[200px]">
                        {editingConstituencyId === a.id ? (
                          <div className="flex flex-col gap-1">
                            <input
                              autoFocus
                              value={constituencyInput}
                              onChange={e => setConstituencyInput(e.target.value)}
                              placeholder="Constituency name"
                              className="px-2 py-1 rounded-md bg-white/70 dark:bg-dark-700/70 border border-gray-300 dark:border-dark-600 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => saveConstituency(a)}
                                disabled={savingConstituencyId === a.id}
                                className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                              >{savingConstituencyId === a.id ? 'Saving...' : 'Save'}</button>
                              <button
                                onClick={cancelEditConstituency}
                                className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-gray-300 dark:bg-dark-600 hover:bg-gray-400 dark:hover:bg-dark-500 text-gray-800 dark:text-dark-50"
                              >Cancel</button>
                            </div>
                          </div>
                        ) : (
                          a.churchName ? (
                            <div className="flex flex-col leading-tight">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-800 dark:text-dark-100 truncate max-w-[140px] underline decoration-dotted" title={a.churchName}>{a.churchName}</span>
                                <button
                                  onClick={() => startEditConstituency(a)}
                                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                                  title="Rename constituency"
                                >Rename</button>
                              </div>
                              {a.churchId && <span className="text-[10px] text-gray-400 dark:text-dark-400 font-mono">{a.churchId}</span>}
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditConstituency(a)}
                              className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                            >Set Name</button>
                          )
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap min-w-[160px]">
                        <div className="flex flex-col gap-1">
                          <select
                            value={(a as any).campusId || ''}
                            onChange={e => assignCampus(a, e.target.value || null)}
                            className="px-2 py-1 rounded-md bg-white/70 dark:bg-dark-700/70 border border-gray-300 dark:border-dark-600 text-[11px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          >
                            <option value="">No Campus</option>
                            {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          {assigningRef.current[a.id] && <span className="text-[10px] text-indigo-500">Updating…</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-gray-700 dark:text-dark-300">
                        {a.churchId ? (
                          a.memberCount != null ? (
                            a.memberCount >= 0 ? (
                              <span className="font-semibold" title="Members in this constituency">{a.memberCount}</span>
                            ) : (
                              <span className="text-[11px] text-orange-500" title="Member count unavailable (permissions)">!</span>
                            )
                          ) : memberCountsLoading ? (
                            <span className="text-[11px] text-gray-400">…</span>
                          ) : (
                            <span className="text-[11px] text-gray-400">—</span>
                          )
                        ) : <span className="text-[11px] text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3"><StatusBadge active={a.isActive !== false} /></td>
                      <td className="px-5 py-3 text-gray-500 dark:text-dark-400 whitespace-nowrap">{created ? created.toLocaleDateString() : '—'}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-dark-400 whitespace-nowrap">{lastLogin ? lastLogin.toLocaleDateString() : '—'}</td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleActiveStatus(a)}
                            disabled={updatingIds[a.id]}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                              ${a.isActive !== false
                                ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                : 'bg-green-600 hover:bg-green-700 text-white'}`}
                            title={a.isActive !== false ? 'Deactivate admin' : 'Activate admin'}
                          >
                            {updatingIds[a.id] ? '...' : (a.isActive !== false ? 'Deactivate' : 'Activate')}
                          </button>
                          <button
                            onClick={() => softDeleteAdmin(a)}
                            disabled={updatingIds[a.id]}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Soft delete admin"
                          >
                            {updatingIds[a.id] ? '...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredAdmins.length === 0 && !loading && (
                  <tr>
                    <td className="px-5 py-10 text-center text-gray-500 dark:text-dark-300" colSpan={9}>No admin accounts found</td>
                  </tr>
                )}
              </tbody>
            </table>
            {loading && (
              <div className="p-4 text-center text-xs text-gray-500 dark:text-dark-300">Loading...</div>
            )}
          </div>
          </div>
        )}

        {viewMode === 'leaders' && (
          <div className="glass rounded-2xl shadow-xl overflow-hidden border border-gray-200/40 dark:border-dark-600/40">
            <div className="px-5 py-4 flex flex-col gap-3 border-b border-gray-200/40 dark:border-dark-600/40 bg-white/60 dark:bg-dark-800/60 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-800 dark:text-white text-lg flex items-center gap-2">
                  <span className="text-indigo-500">▣</span> Leaders
                </h2>
                <div className="flex items-center gap-3 text-xs font-medium text-gray-500 dark:text-dark-300">
                  <span className="hidden xs:inline">Showing</span>
                  <span className="px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-dark-200">{filteredLeaders.length}</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search leaders, email..."
                  className="w-full sm:max-w-xs px-3 py-2 rounded-lg bg-white/70 dark:bg-dark-700/70 border border-gray-300 dark:border-dark-600 text-[12px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-3 py-2 rounded-lg text-[11px] font-semibold bg-gray-300 dark:bg-dark-600 text-gray-800 dark:text-dark-50"
                  >Clear</button>
                )}
                <div className="flex-1" />
                <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-dark-400">
                  <span className="hidden md:inline">Tip: Promote a leader to make them admin and demote current admin</span>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto custom-scrollbar max-h-[60vh]">
              <table className="min-w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 dark:text-dark-300 bg-gray-50/70 dark:bg-dark-700/70 backdrop-blur-sm">
                    <th className="px-4 py-3 font-semibold w-10">#</th>
                    <th className="px-5 py-3 font-semibold w-36">Name</th>
                    <th className="px-5 py-3 font-semibold">Email</th>
                    <th className="px-5 py-3 font-semibold">Constituency</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Created</th>
                    <th className="px-5 py-3 font-semibold">Last Login</th>
                    <th className="px-5 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/60 dark:divide-dark-600/40">
                  {filteredLeaders.map((l, idx) => {
                    const created = (l as any).createdAt?.toDate ? (l as any).createdAt.toDate() : ((l as any).createdAt ? new Date((l as any).createdAt) : null);
                    const lastLogin = (l as any).lastLoginAt?.toDate ? (l as any).lastLoginAt.toDate() : ((l as any).lastLoginAt ? new Date((l as any).lastLoginAt) : null);
                    return (
                      <tr key={l.id} className="group hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20 transition-colors">
                        <td className="px-4 py-3 text-right text-gray-500 dark:text-dark-300">{idx + 1}</td>
                        <td className="px-5 py-3 font-medium text-gray-800 dark:text-dark-50 whitespace-nowrap">{l.displayName ? l.displayName.split(' ')[0] : (l.firstName || '—')}</td>
                        <td className="px-5 py-3 text-gray-600 dark:text-dark-200 whitespace-nowrap">{l.email || '—'}</td>
                        <td className="px-5 py-3 text-gray-700 dark:text-dark-300 min-w-[200px]">
                          <div className="flex flex-col leading-tight">
                            <span className="font-medium text-gray-800 dark:text-dark-100 truncate max-w-[180px]" title={l.churchName}>{l.churchName || '—'}</span>
                            {l.churchId && <span className="text-[10px] text-gray-400 dark:text-dark-400 font-mono">{l.churchId}</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3"><StatusBadge active={l.isActive !== false} /></td>
                        <td className="px-5 py-3 text-gray-500 dark:text-dark-400 whitespace-nowrap">{created ? created.toLocaleDateString() : '—'}</td>
                        <td className="px-5 py-3 text-gray-500 dark:text-dark-400 whitespace-nowrap">{lastLogin ? lastLogin.toLocaleDateString() : '—'}</td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setPendingPromotion(l)}
                              disabled={updatingIds[l.id]}
                              className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Promote to Admin (swap with current admin)"
                            >{updatingIds[l.id] ? '...' : 'Promote to Admin'}</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLeaders.length === 0 && !leadersLoading && (
                    <tr>
                      <td className="px-5 py-10 text-center text-gray-500 dark:text-dark-300" colSpan={8}>No leaders found</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {leadersLoading && (
                <div className="p-4 text-center text-xs text-gray-500 dark:text-dark-300">Loading leaders...</div>
              )}
            </div>
          </div>
        )}

        {/* Newly Registered People Table */}
        {viewMode === 'newly_registered' && (
          <div className="group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-600/5 rounded-3xl transform -rotate-1 group-hover:-rotate-2 transition-transform duration-500"></div>
            <div className="relative glass rounded-3xl shadow-2xl overflow-hidden border border-white/30 dark:border-white/10 backdrop-blur-xl">
              <div className="px-6 py-5 flex flex-col gap-3 border-b border-white/20 dark:border-white/10 bg-gradient-to-r from-white/80 to-white/60 dark:from-dark-800/80 dark:to-dark-800/60 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-gray-900 dark:text-white text-xl flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    </div>
                    Newly Registered Users (Last 30 Days)
                  </h2>
                  <div className="flex items-center gap-3 text-sm font-semibold text-gray-600 dark:text-dark-300">
                    <span className="hidden xs:inline">Total:</span>
                    <span className="px-3 py-1.5 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 text-purple-700 dark:text-purple-300 rounded-xl font-bold shadow-sm">{newlyRegistered.length}</span>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[70vh] custom-scrollbar">
                <table className="min-w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 dark:text-dark-300 bg-gradient-to-r from-gray-50/70 to-gray-100/70 dark:from-dark-700/70 dark:to-dark-600/70">
                      <th className="px-4 py-3 font-semibold w-10">#</th>
                      <th className="px-5 py-3 font-semibold">Name</th>
                      <th className="px-5 py-3 font-semibold">Email</th>
                      <th className="px-5 py-3 font-semibold">Role</th>
                      <th className="px-5 py-3 font-semibold">Church</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Registered</th>
                      <th className="px-5 py-3 font-semibold">Last Login</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100/60 dark:divide-dark-600/40">
                    {newlyRegistered.map((user, idx) => {
                      const created = user.createdAt?.toDate?.();
                      const lastLogin = user.lastLoginAt?.toDate?.();
                      return (
                        <tr key={user.id} className="group hover:bg-purple-50/60 dark:hover:bg-purple-900/20 transition-colors">
                          <td className="px-4 py-3 text-right text-gray-500 dark:text-dark-300">{idx + 1}</td>
                          <td className="px-5 py-3 font-medium text-gray-800 dark:text-dark-50 whitespace-nowrap">
                            {user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || '—'}
                          </td>
                          <td className="px-5 py-3 text-gray-600 dark:text-dark-200 whitespace-nowrap">{user.email || '—'}</td>
                          <td className="px-5 py-3 text-gray-700 dark:text-dark-300">
                            <span className="px-2 py-1 bg-gray-100 dark:bg-dark-600 text-gray-700 dark:text-dark-200 rounded-md text-xs font-medium">
                              {user.role || 'member'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-700 dark:text-dark-300 min-w-[200px]">
                            <div className="flex flex-col leading-tight">
                              <span className="font-medium text-gray-800 dark:text-dark-100 truncate max-w-[180px]" title={user.churchName}>
                                {user.churchName || '—'}
                              </span>
                              {user.churchId && <span className="text-[10px] text-gray-400 dark:text-dark-400 font-mono">{user.churchId}</span>}
                            </div>
                          </td>
                          <td className="px-5 py-3"><StatusBadge active={user.isActive !== false} /></td>
                          <td className="px-5 py-3 text-gray-500 dark:text-dark-400 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span>{created ? created.toLocaleDateString() : '—'}</span>
                              {created && <span className="text-xs text-purple-600 dark:text-purple-400">{created.toLocaleTimeString()}</span>}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-gray-500 dark:text-dark-400 whitespace-nowrap">{lastLogin ? lastLogin.toLocaleDateString() : 'Never'}</td>
                        </tr>
                      );
                    })}
                    {newlyRegistered.length === 0 && !newlyRegisteredLoading && (
                      <tr>
                        <td className="px-5 py-10 text-center text-gray-500 dark:text-dark-300" colSpan={8}>
                          <div className="flex flex-col items-center gap-2">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span>No new users registered in the last 30 days</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {newlyRegisteredLoading && (
                  <div className="p-4 text-center text-xs text-gray-500 dark:text-dark-300">Loading newly registered users...</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* All Members Table */}
        {viewMode === 'all_members' && (
          <div className="group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-600/5 rounded-3xl transform -rotate-1 group-hover:-rotate-2 transition-transform duration-500"></div>
            <div className="relative glass rounded-3xl shadow-2xl overflow-hidden border border-white/30 dark:border-white/10 backdrop-blur-xl">
              <div className="px-6 py-5 flex flex-col gap-3 border-b border-white/20 dark:border-white/10 bg-gradient-to-r from-white/80 to-white/60 dark:from-dark-800/80 dark:to-dark-800/60 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-black dark:text-white text-xl flex items-center gap-3">
                    <span className="text-blue-600 dark:text-blue-400">👥</span> All Members
                  </h2>
                  <div className="flex items-center gap-3 text-xs font-medium text-gray-600 dark:text-dark-300">
                    <span className="hidden xs:inline">Showing</span>
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-semibold">
                      {allMembers.length} members
                    </span>
                    <span className="hidden xs:inline">across all constituencies</span>
                  </div>
                </div>
                {allMembersError && (
                  <div className="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                    {allMembersError}
                  </div>
                )}
              </div>

              <div className="overflow-hidden">
                {allMembersLoading ? (
                  <div className="p-8 text-center">
                    <div className="inline-flex items-center gap-2 text-blue-600">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading members from all constituencies...
                    </div>
                  </div>
                ) : allMembers.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>No members found</span>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[600px]">
                    <table className="min-w-full">
                      <thead className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-dark-700 dark:to-dark-600 border-b border-gray-200 dark:border-dark-500 z-10">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 dark:text-dark-200 uppercase tracking-wider">#</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 dark:text-dark-200 uppercase tracking-wider">Name</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 dark:text-dark-200 uppercase tracking-wider">Constituency</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 dark:text-dark-200 uppercase tracking-wider">Contact</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 dark:text-dark-200 uppercase tracking-wider">Born Again</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 dark:text-dark-200 uppercase tracking-wider">Water Baptism</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 dark:text-dark-200 uppercase tracking-wider">Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100/60 dark:divide-dark-600/40">
                        {allMembers.map((member, index) => (
                          <tr
                            key={member.id}
                            className="group hover:bg-blue-50/60 dark:hover:bg-blue-900/20 transition-colors"
                          >
                            <td className="px-5 py-3 text-sm text-gray-600 dark:text-dark-300">
                              {index + 1}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                {member.profilePicture ? (
                                  <img
                                    src={member.profilePicture}
                                    alt={member.firstName}
                                    className="w-8 h-8 rounded-full object-cover border border-gray-200"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-sm font-semibold">
                                    {member.firstName.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-900 dark:text-dark-100 truncate">
                                      {`${member.firstName} ${member.lastName || ''}`.trim()}
                                    </span>
                                    {member.bornAgainStatus && (
                                      <span className="text-xs text-green-600" title="Born Again">⭐</span>
                                    )}
                                  </div>
                                  {member.buildingAddress && (
                                    <div className="text-xs text-gray-500 dark:text-dark-400 truncate">
                                      {member.buildingAddress}
                                      {member.roomNumber && ` - Room ${member.roomNumber}`}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
                                {member.constituencyName}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <div className="text-sm text-gray-600 dark:text-dark-300">
                                {member.phoneNumber && member.phoneNumber !== '-' ? (
                                  <div>{member.phoneNumber}</div>
                                ) : (
                                  <div className="text-gray-400">—</div>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                member.bornAgainStatus
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                              }`}>
                                {member.bornAgainStatus ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                member.baptized
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                              }`}>
                                {member.baptized ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                member.role === 'Bacenta Leader'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                  : member.role === 'Fellowship Leader'
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                              }`}>
                                {member.role || 'Member'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

          {/* end of conditional sections */}
          </>
        )}
  <p className="mt-6 text-[10px] text-gray-400 dark:text-dark-400 text-center tracking-wide">Prototype Super Admin view – more features coming soon.</p>
        {showCampusModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !creatingCampus && setShowCampusModal(false)} />
            <div className="relative z-10 w-full max-w-sm glass rounded-2xl p-6 shadow-xl border border-gray-200/40 dark:border-dark-600/40 animate-scale-in">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-dark-50 mb-4">Create Campus</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-dark-300 mb-1">Name</label>
                  <input
                    autoFocus
                    value={newCampusName}
                    onChange={e => setNewCampusName(e.target.value)}
                    placeholder="Campus name"
                    className="w-full px-3 py-2 rounded-md bg-white/80 dark:bg-dark-700/70 border border-gray-300 dark:border-dark-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  {campusError && <p className="mt-1 text-[11px] text-red-500">{campusError}</p>}
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowCampusModal(false)}
                    disabled={creatingCampus}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-gray-200 dark:bg-dark-600 text-gray-800 dark:text-dark-50 hover:bg-gray-300 dark:hover:bg-dark-500 disabled:opacity-50"
                  >Cancel</button>
                  <button
                    onClick={async () => { await createCampus(); if (!campusError) setShowCampusModal(false); }}
                    disabled={creatingCampus}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                  >{creatingCampus ? 'Creating…' : 'Create'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
        {editingCampus && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !creatingCampus && !deletingCampus && setEditingCampus(null)} />
            <div className="relative z-10 w-full max-w-sm glass rounded-2xl p-6 shadow-xl border border-gray-200/40 dark:border-dark-600/40 animate-scale-in">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-dark-50 mb-4">Edit Campus</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-dark-300 mb-1">Name</label>
                  <input
                    value={editingCampusName}
                    onChange={e => setEditingCampusName(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-white/80 dark:bg-dark-700/70 border border-gray-300 dark:border-dark-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  {campusError && <p className="mt-1 text-[11px] text-red-500">{campusError}</p>}
                </div>
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={deleteCampus}
                    disabled={creatingCampus || deletingCampus}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                  >{deletingCampus ? 'Deleting…' : 'Delete'}</button>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setEditingCampus(null)}
                      disabled={creatingCampus || deletingCampus}
                      className="px-4 py-2 rounded-lg text-xs font-semibold bg-gray-200 dark:bg-dark-600 text-gray-800 dark:text-dark-50 hover:bg-gray-300 dark:hover:bg-dark-500 disabled:opacity-50"
                    >Cancel</button>
                    <button
                      onClick={saveCampusEdit}
                      disabled={creatingCampus || deletingCampus}
                      className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                    >{creatingCampus ? 'Saving…' : 'Save'}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {previewAdmin && (
          <AdminChurchPreview admin={previewAdmin} onClose={() => setPreviewAdmin(null)} />
        )}

        {/* Confirm soft-delete admin */}
        <ConfirmationModal
          isOpen={!!pendingDeleteAdmin}
          onClose={() => setPendingDeleteAdmin(null)}
          onConfirm={performSoftDeleteAdmin}
          title="Delete Admin"
          message={pendingDeleteAdmin ? `Soft delete admin "${pendingDeleteAdmin.displayName || pendingDeleteAdmin.email}"? They will be marked deleted and removed from this list.` : ''}
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
        />

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
        {/* Promote leader to admin (swap roles) */}
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
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
