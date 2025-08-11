import React, { useEffect, useState, useCallback, useRef } from 'react';
import { collection, getDocs, getDoc, query, where, limit, updateDoc, doc, Timestamp, onSnapshot } from 'firebase/firestore';
// NOTE: Removed getFunctions/httpsCallable usage for member counts due to CORS issues on callable function.
// import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../firebase.config';

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
  const [admins, setAdmins] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number; active: number; inactive: number } | null>(null);
  const [totalMembers, setTotalMembers] = useState<number | null>(null);
  const [memberCountsLoading, setMemberCountsLoading] = useState(false);
  // Manual recount state removed (automatic live listeners will keep counts fresh)
  // Constituency editing state
  const [editingConstituencyId, setEditingConstituencyId] = useState<string | null>(null);
  const [constituencyInput, setConstituencyInput] = useState('');
  const [savingConstituencyId, setSavingConstituencyId] = useState<string | null>(null);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setError(null);
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
      // Kick off member counts after admins are loaded
      computeMemberCounts(filtered);
    } catch (e: any) {
      console.error('Failed to load admins', e);
      setError(e.message || 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  }, []);

  const computeMemberCounts = useCallback(async (adminsList: AdminUserRecord[], forceFullRecount: boolean = false) => {
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
            const data = churchSnap.data();
            let churchCount: number | null = (data && typeof data.membersCount === 'number') ? data.membersCount : null;

            // If forcing or missing churchCount, recount by reading active members collection
            if (forceFullRecount || churchCount == null) {
              const membersCol = collection(db, 'churches', cid, 'members');
              const snap = await getDocs(membersCol);
              // Count only active members (isActive !== false)
              churchCount = snap.docs.filter(d => (d.data() as any).isActive !== false).length;
              // Write back to church doc if different
              if (!data || data.membersCount !== churchCount) {
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
        // Fire and forget; we don't want UI blocked. Await with catch to surface issues quietly.
        Promise.allSettled(reconciliationWrites).then(results => {
          const failures = results.filter(r => r.status === 'rejected');
          if (failures.length) console.warn('Some member count reconciliation writes failed');
        });
      }

      const total = Object.values(countsMap).filter(v => v >= 0).reduce((s, v) => s + v, 0);
      setTotalMembers(total);
      setAdmins(prev => prev.map(a => (!a.churchId ? a : (countsMap[a.churchId] != null ? { ...a, memberCount: countsMap[a.churchId] } : a))));
    } finally {
      setMemberCountsLoading(false);
    }
  }, []);

  // Per-church live member listeners (track active members directly) -----------------
  const memberListenersRef = useRef<Record<string, () => void>>({});
  const liveCountsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

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
      await updateDoc(doc(db, 'users', admin.id), {
        isActive: admin.isActive === false,
        lastUpdated: Timestamp.now()
      });
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
    const confirmed = window.confirm(`Soft delete admin "${admin.displayName || admin.email}"? They will be marked deleted and removed from this list.`);
    if (!confirmed) return;
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
        total: prev.total - 1,
        active: prev.active - (admin.isActive !== false ? 1 : 0),
        inactive: prev.inactive - (admin.isActive === false ? 1 : 0)
      } : prev);
    } catch (e:any) {
      setError(e.message || 'Failed to delete admin');
    } finally {
      setUpdating(admin.id, false);
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

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background similar to main app */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-dark-900 dark:via-dark-950 dark:to-dark-800" />
      <div className="relative flex-1 pt-8 pb-10 px-3 sm:px-6 desktop:px-10 max-w-7xl w-full mx-auto">
        {/* Top Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 mt-2">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text font-serif tracking-tight">Super Admin Dashboard</h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-dark-300 font-medium">Central overview of all admin accounts (prototype)</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchAdmins}
              disabled={loading}
              className="group relative inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-md hover:shadow-lg hover:from-indigo-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <span className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin"/>}
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <button
              onClick={onSignOut}
              className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="glass rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-dark-300">Total Constituencies</p>
            </div>
            <p className="mt-2 text-3xl font-bold text-indigo-600 dark:text-indigo-400 tracking-tight drop-shadow-sm">{stats?.total ?? '-'}</p>
          </div>
          <div className="glass rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400">Total Members</p>
            <p className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400 tracking-tight">{totalMembers != null ? totalMembers : (memberCountsLoading ? '…' : '-')}</p>
          </div>
          <div className="glass rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-green-600 dark:text-green-400">Active</p>
            <p className="mt-2 text-3xl font-bold text-green-600 dark:text-green-400 tracking-tight">{stats?.active ?? '-'}</p>
          </div>
          <div className="glass rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-red-600 dark:text-red-400">Inactive</p>
            <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400 tracking-tight">{stats?.inactive ?? '-'}</p>
          </div>
        </div>

        {error && (
          <div className="glass border-l-4 border-red-500 rounded-xl p-4 mb-6 shadow-md animate-scale-in">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Table Card */}
        <div className="glass rounded-2xl shadow-xl overflow-hidden border border-gray-200/40 dark:border-dark-600/40">
          <div className="px-5 py-4 flex items-center justify-between border-b border-gray-200/40 dark:border-dark-600/40 bg-white/60 dark:bg-dark-800/60 backdrop-blur-sm">
            <h2 className="font-semibold text-gray-800 dark:text-white text-lg flex items-center gap-2">
              <span className="text-indigo-500">▣</span> Admin Accounts
            </h2>
            <div className="flex items-center gap-3 text-xs font-medium text-gray-500 dark:text-dark-300">
              <span className="hidden xs:inline">Showing</span>
              <span className="px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-dark-200">{admins.length}</span>
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar max-h-[60vh]">
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 dark:text-dark-300 bg-gray-50/70 dark:bg-dark-700/70 backdrop-blur-sm">
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Constituency</th>
                  <th className="px-5 py-3 font-semibold">Members</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Created</th>
                  <th className="px-5 py-3 font-semibold">Last Login</th>
                  <th className="px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/60 dark:divide-dark-600/40">
                {admins.map(a => {
                  const created = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : null);
                  const lastLogin = a.lastLoginAt?.toDate ? a.lastLoginAt.toDate() : (a.lastLoginAt ? new Date(a.lastLoginAt) : null);
                  return (
                    <tr key={a.id} className="group hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-800 dark:text-dark-50 whitespace-nowrap">
                        {a.displayName || [a.firstName, a.lastName].filter(Boolean).join(' ') || '—'}
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
                                <span className="font-medium text-gray-800 dark:text-dark-100 truncate max-w-[140px]" title={a.churchName}>{a.churchName}</span>
                                <button
                                  onClick={() => startEditConstituency(a)}
                                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                                  title="Edit constituency"
                                >Edit</button>
                              </div>
                              {a.churchId && <span className="text-[10px] text-gray-400 dark:text-dark-400 font-mono">{a.churchId}</span>}
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditConstituency(a)}
                              className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                            >Assign</button>
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
                {admins.length === 0 && !loading && (
                  <tr>
                    <td className="px-5 py-10 text-center text-gray-500 dark:text-dark-300" colSpan={8}>No admin accounts found</td>
                  </tr>
                )}
              </tbody>
            </table>
            {loading && (
              <div className="p-4 text-center text-xs text-gray-500 dark:text-dark-300">Loading...</div>
            )}
          </div>
        </div>
        <p className="mt-6 text-[10px] text-gray-400 dark:text-dark-400 text-center tracking-wide">Prototype Super Admin view – more features coming soon.</p>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
