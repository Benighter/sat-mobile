import React, { useEffect, useState, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase.config';
import { getSundaysOfMonth, getCurrentOrMostRecentSunday, getUpcomingSunday, formatFullDate, getMonthName } from '../../utils/dateUtils';

interface AdminChurchPreviewProps {
  admin: {
    id: string;
    displayName?: string;
    email?: string;
    churchId?: string;
    churchName?: string;
  } | null;
  onClose: () => void;
}

// Detail view identifiers for stats cards
type DetailView = 'members' | 'confirmations' | 'attendance' | 'outreach' | 'bacentas' | 'guests' | 'newBelievers' | null;


const AdminChurchPreview: React.FC<AdminChurchPreviewProps> = ({ admin, onClose }) => {
  const [loading, setLoading] = useState(true);
  // simplified loading: one flag only
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [bacentas, setBacentas] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [newBelievers, setNewBelievers] = useState<any[]>([]);
  const [confirmations, setConfirmations] = useState<any[]>([]); // all sunday confirmations
  const [guests, setGuests] = useState<any[]>([]);
  const [outreachMembers, setOutreachMembers] = useState<any[]>([]);
  // (unused for snapshot currently) const [outreachBacentas, setOutreachBacentas] = useState<any[]>([]);
  const [detailView, setDetailView] = useState<DetailView>(null);

  const churchId = admin?.churchId;

  const fetchCollection = useCallback(async (_name: string, coll: string) => {
    if (!churchId) return [];
    try {
      const snap = await getDocs(collection(db, 'churches', churchId, coll));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e: any) {
      console.warn('[AdminChurchPreview] Failed fetching', coll, e);
      setError(e.message || String(e));
      return [];
  } finally { /* no-op */ }
  }, [churchId]);

  useEffect(() => {
    let cancelled = false;
    if (!churchId) return;
    (async () => {
      setLoading(true); setError(null);
      const [m, b, a, nb, c, g, om] = await Promise.all([
        fetchCollection('members', 'members'),
        fetchCollection('bacentas', 'bacentas'),
        fetchCollection('attendance', 'attendance'),
        fetchCollection('newBelievers', 'newBelievers'),
        fetchCollection('confirmations', 'sundayConfirmations'),
        fetchCollection('guests', 'guests'),
        fetchCollection('outreachMembers', 'outreachMembers')
      ]);
      if (cancelled) return;
      setMembers(m.filter((x: any) => (x as any).isActive !== false));
      setBacentas(b);
      setAttendance(a);
      setNewBelievers(nb);
      setConfirmations(c);
      setGuests(g);
      setOutreachMembers(om);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [churchId, fetchCollection]);

  if (!admin) return null;

  const displayedDate = new Date();
  const sundays = getSundaysOfMonth(displayedDate.getFullYear(), displayedDate.getMonth());
  const totalMembers = members.filter(m => !m.frozen).length;

  let attendanceRate = 0;
  if (sundays.length && totalMembers) {
    const totalPossible = totalMembers * sundays.length;
    let presents = 0;
    sundays.forEach(s => {
      members.filter(m => !m.frozen).forEach(m => {
        const rec = attendance.find(ar => ar.memberId === m.id && ar.date === s && ar.status === 'Present');
        if (rec) presents++;
      });
    });
    attendanceRate = totalPossible ? Math.round((presents / totalPossible) * 100) : 0;
  }

  const currentSunday = getCurrentOrMostRecentSunday();
  const sundayRecords = attendance.filter(r => r.date === currentSunday && r.status === 'Present');
  const presentMemberIds = new Set(sundayRecords.filter(r => r.memberId).map(r => r.memberId));
  const presentNewBelieverIds = new Set(sundayRecords.filter(r => r.newBelieverId).map(r => r.newBelieverId));
  const weeklyAttendance = members.filter(m => !m.frozen && presentMemberIds.has(m.id)).length + newBelievers.filter(nb => presentNewBelieverIds.has(nb.id)).length;

  const upcomingSunday = getUpcomingSunday();
  const confirmationRecords = confirmations.filter(r => r.date === upcomingSunday && r.status === 'Confirmed');
  let confirmedCount = 0;
  confirmationRecords.forEach(r => {
    if (r.memberId) {
      if (members.some(m => m.id === r.memberId)) confirmedCount++;
    } else if (r.guestId) {
      if (guests.some(g => g.id === r.guestId)) confirmedCount++;
    }
  });
  const confirmationTarget = totalMembers || 0;

  const outreachTotal = outreachMembers.length;

  // Total confirmations overall + upcoming
  const totalConfirmationsOverall = confirmations.filter(r => r.status === 'Confirmed').length;

  const monthName = getMonthName(displayedDate.getMonth());
  const year = displayedDate.getFullYear();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-dark-800 w-full max-w-5xl rounded-xl shadow-2xl border border-gray-200 dark:border-dark-600 p-6 relative animate-fade-in">
        <button onClick={onClose} className="absolute top-3 right-3 px-3 py-1.5 rounded-md bg-slate-700 text-white text-xs hover:bg-slate-600">Close</button>
        <h2 className="text-2xl font-bold mb-1 text-gray-900 dark:text-dark-100">{admin.displayName || admin.email}</h2>
        <p className="text-sm text-gray-600 dark:text-dark-300 mb-4">{admin.churchName || 'Constituency'} • {monthName} {year}</p>
        {error && <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}
        <PreviewGrid
          loading={loading}
          stats={{
            members: totalMembers,
            confirmationsUpcoming: confirmedCount,
            confirmationsTotal: totalConfirmationsOverall,
            attendanceRate,
            weeklyAttendance,
            outreach: outreachTotal,
            bacentas: bacentas.length,
            guests: guests.length,
            newBelievers: newBelievers.length
          }}
          monthName={monthName}
          currentSundayLabel={formatFullDate(currentSunday).split(',')[0]}
          confirmationTarget={confirmationTarget}
          onSelect={setDetailView}
        />
        <DetailSection
          view={detailView}
          onClose={() => setDetailView(null)}
          data={{ members, confirmations, attendance, newBelievers, guests, outreachMembers, bacentas }}
          upcomingSunday={upcomingSunday}
        />
        <p className="mt-6 text-xs text-gray-500 dark:text-dark-400">Snapshot fetched directly (read-only). No impersonation session established.</p>
      </div>
    </div>
  );
};

const accentMap: Record<string, { border: string; icon: string; }> = {
  blue: { border: 'border-l-blue-400', icon: 'text-blue-500' },
  rose: { border: 'border-l-rose-400', icon: 'text-rose-500' },
  emerald: { border: 'border-l-emerald-400', icon: 'text-emerald-500' },
  amber: { border: 'border-l-amber-400', icon: 'text-amber-500' },
  indigo: { border: 'border-l-indigo-400', icon: 'text-indigo-500' },
  purple: { border: 'border-l-purple-400', icon: 'text-purple-500' },
  slate: { border: 'border-l-slate-400', icon: 'text-slate-500' },
  teal: { border: 'border-l-teal-400', icon: 'text-teal-500' },
};

const PreviewStat: React.FC<{ title: string; value: string | number; description?: string; accent?: string; onClick?: () => void; }> = ({ title, value, description, accent = 'slate', onClick }) => {
  const colors = accentMap[accent] || accentMap.slate;
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      className={`p-4 bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-lg shadow-sm transition relative ${colors.border} border-l-4 ${clickable ? 'cursor-pointer hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500' : ''}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-300 mb-1 flex items-center justify-between">
        <span>{title}</span>
        {clickable && <span className="text-[10px] font-semibold text-indigo-500">View</span>}
      </p>
      <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">{value}</p>
      {description && <p className="text-xs text-gray-600 dark:text-dark-400 mt-1 leading-tight">{description}</p>}
    </div>
  );
};

// Grid component mapping stats to cards
const PreviewGrid: React.FC<{
  loading: boolean;
  stats: {
    members: number;
    confirmationsUpcoming: number;
    confirmationsTotal: number;
    attendanceRate: number;
    weeklyAttendance: number;
    outreach: number;
    bacentas: number;
    guests: number;
    newBelievers: number;
  };
  monthName: string;
  currentSundayLabel: string;
  confirmationTarget: number;
  onSelect: (view: DetailView | null) => void;
}> = ({ loading, stats, monthName, currentSundayLabel, confirmationTarget, onSelect }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <PreviewStat title="Total Members" value={loading ? '…' : stats.members} description="Active members" accent="blue" onClick={() => onSelect('members')} />
      <PreviewStat title="Sunday Confirmations" value={loading ? '…' : stats.confirmationsUpcoming} description={`of ${confirmationTarget} • Next Sunday (All: ${stats.confirmationsTotal})`} accent="rose" onClick={() => onSelect('confirmations')} />
      <PreviewStat title="Attendance Rate" value={loading ? '…' : `${stats.attendanceRate}%`} description={`For ${monthName}`} accent="emerald" onClick={() => onSelect('attendance')} />
      <PreviewStat title="Weekly Attendance" value={loading ? '…' : stats.weeklyAttendance} description={currentSundayLabel} accent="amber" onClick={() => onSelect('attendance')} />
      <PreviewStat title="Outreach" value={loading ? '…' : stats.outreach} description="Outreach members" accent="indigo" onClick={() => onSelect('outreach')} />
      <PreviewStat title="Bacentas" value={loading ? '…' : stats.bacentas} description="Cell groups" accent="purple" onClick={() => onSelect('bacentas')} />
      <PreviewStat title="Guests" value={loading ? '…' : stats.guests} description="Tracked guests" accent="slate" onClick={() => onSelect('guests')} />
      <PreviewStat title="New Believers" value={loading ? '…' : stats.newBelievers} description="Follow-up list" accent="teal" onClick={() => onSelect('newBelievers')} />
    </div>
  );
};


// Detail section component
const DetailSection: React.FC<{
  view: DetailView;
  onClose: () => void;
  data: {
    members: any[];
    confirmations: any[];
    attendance: any[];
    newBelievers: any[];
    guests: any[];
    outreachMembers: any[];
    bacentas: any[];
  };
  upcomingSunday: string;
}> = ({ view, onClose, data, upcomingSunday }) => {
  const MAX = 250;
  if (!view) return null;
  const truncate = (arr: any[]) => arr.slice(0, MAX);
  let title = '';
  let rows: any[] = [];
  switch (view) {
    case 'members':
      title = 'Members'; rows = truncate(data.members); break;
    case 'confirmations':
      title = 'Sunday Confirmations'; rows = truncate(data.confirmations.filter(c => c.status === 'Confirmed')); break;
    case 'attendance':
      title = 'Attendance Records'; rows = truncate(data.attendance); break;
    case 'outreach':
      title = 'Outreach Members'; rows = truncate(data.outreachMembers); break;
    case 'bacentas':
      title = 'Bacentas'; rows = truncate(data.bacentas); break;
    case 'guests':
      title = 'Guests'; rows = truncate(data.guests); break;
    case 'newBelievers':
      title = 'New Believers'; rows = truncate(data.newBelievers); break;
  }
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-dark-100">{title}</h3>
        <button onClick={onClose} className="px-2 py-1 rounded-md text-[11px] font-semibold bg-gray-200 dark:bg-dark-600 text-gray-800 dark:text-dark-50 hover:bg-gray-300 dark:hover:bg-dark-500">Close</button>
      </div>
      <div className="overflow-x-auto border border-gray-200 dark:border-dark-600 rounded-lg">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 dark:bg-dark-700 text-gray-600 dark:text-dark-300">
            <tr>
              {view === 'members' && <th className="px-3 py-2 text-left font-semibold w-32">Name</th>}
              {view === 'members' && <th className="px-3 py-2 text-left font-semibold">Bacenta</th>}
              {view === 'confirmations' && <th className="px-3 py-2 text-left font-semibold">Date</th>}
              {view === 'confirmations' && <th className="px-3 py-2 text-left font-semibold">Member/Guest</th>}
              {view === 'confirmations' && <th className="px-3 py-2 text-left font-semibold">Status</th>}
              {view === 'attendance' && <th className="px-3 py-2 text-left font-semibold">Date</th>}
              {view === 'attendance' && <th className="px-3 py-2 text-left font-semibold">Member</th>}
              {view === 'attendance' && <th className="px-3 py-2 text-left font-semibold">Status</th>}
              {view === 'outreach' && <th className="px-3 py-2 text-left font-semibold">Name</th>}
              {view === 'outreach' && <th className="px-3 py-2 text-left font-semibold">Bacenta</th>}
              {view === 'bacentas' && <th className="px-3 py-2 text-left font-semibold">Name</th>}
              {view === 'bacentas' && <th className="px-3 py-2 text-left font-semibold">Leader</th>}
              {view === 'guests' && <th className="px-3 py-2 text-left font-semibold">Name</th>}
              {view === 'guests' && <th className="px-3 py-2 text-left font-semibold">Bacenta</th>}
              {view === 'newBelievers' && <th className="px-3 py-2 text-left font-semibold">Name</th>}
              {view === 'newBelievers' && <th className="px-3 py-2 text-left font-semibold">Bacenta</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-dark-600 bg-white dark:bg-dark-800 text-gray-700 dark:text-dark-200">
            {rows.map((r, i) => {
              if (view === 'members') {
                return <tr key={r.id || i}><td className="px-3 py-1.5">{r.firstName}</td><td className="px-3 py-1.5">{r.bacentaId || '—'}</td></tr>;
              }
              if (view === 'confirmations') {
                const label = r.memberId ? `Member:${r.memberId}` : r.guestId ? `Guest:${r.guestId}` : '—';
                return <tr key={r.id || i}><td className="px-3 py-1.5">{r.date}</td><td className="px-3 py-1.5">{label}</td><td className="px-3 py-1.5">{r.status}</td></tr>;
              }
              if (view === 'attendance') {
                const label = r.memberId ? r.memberId : r.newBelieverId ? `NB:${r.newBelieverId}` : '—';
                return <tr key={r.id || i}><td className="px-3 py-1.5">{r.date}</td><td className="px-3 py-1.5">{label}</td><td className="px-3 py-1.5">{r.status}</td></tr>;
              }
              if (view === 'outreach') {
                const first = typeof r.name === 'string' ? r.name.split(' ')[0] : r.firstName || '—';
                return <tr key={r.id || i}><td className="px-3 py-1.5">{first}</td><td className="px-3 py-1.5">{r.bacentaId || '—'}</td></tr>;
              }
              if (view === 'bacentas') {
                return <tr key={r.id || i}><td className="px-3 py-1.5">{r.name || r.bacentaName || '—'}</td><td className="px-3 py-1.5">{r.leaderId || '—'}</td></tr>;
              }
              if (view === 'guests') {
                return <tr key={r.id || i}><td className="px-3 py-1.5">{r.firstName}</td><td className="px-3 py-1.5">{r.bacentaId || '—'}</td></tr>;
              }
              if (view === 'newBelievers') {
                return <tr key={r.id || i}><td className="px-3 py-1.5">{r.firstName}</td><td className="px-3 py-1.5">{r.bacentaId || '—'}</td></tr>;
              }
              return null;
            })}
            {rows.length === 0 && (
              <tr><td className="px-3 py-4 text-center text-[11px] text-gray-500" colSpan={3}>No records</td></tr>
            )}
          </tbody>
        </table>
        {rows.length >= MAX && <p className="mt-2 text-[10px] text-gray-400 px-1">Showing first {MAX} records.</p>}
        {view === 'confirmations' && <p className="mt-2 text-[10px] text-gray-400 px-1">Upcoming Sunday: {upcomingSunday}</p>}
      </div>
    </div>
  );
};

export default AdminChurchPreview;
