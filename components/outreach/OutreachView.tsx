import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { OutreachMember, OutreachBacenta, TabKeys } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Badge from '../ui/Badge';
import { CalendarIcon, UsersIcon, PlusIcon, CheckIcon, ExclamationTriangleIcon, ChevronLeftIcon, ChevronRightIcon, PeopleIcon, GroupIcon, ChartBarIcon, TrashIcon } from '../icons';

const MonthPicker: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const [year, month] = value.split('-');
  const toYM = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const current = new Date(parseInt(year), parseInt(month) - 1, 1);
  return (
    <div className="inline-flex items-center gap-2 bg-white/70 dark:bg-dark-700/60 rounded-full px-2 py-1.5 border border-gray-200 dark:border-dark-600 shadow-sm">
      <button
        className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-600 text-gray-600"
        onClick={() => onChange(toYM(new Date(current.getFullYear(), current.getMonth() - 1, 1)))}
        aria-label="Previous month"
      >
        <ChevronLeftIcon className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2 px-2">
        <CalendarIcon className="w-4 h-4 text-gray-600" />
        <span className="font-semibold tracking-wide">
          {current.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
        </span>
      </div>
      <button
        className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-600 text-gray-600"
        onClick={() => onChange(toYM(new Date(current.getFullYear(), current.getMonth() + 1, 1)))}
        aria-label="Next month"
      >
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

// Week picker (Monday-based)
const WeekPicker: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const parse = (s: string) => new Date(s + 'T00:00:00');
  const addDays = (d: Date, days: number) => { const nd = new Date(d); nd.setDate(nd.getDate() + days); nd.setHours(0,0,0,0); return nd; };
  const format = (d: Date) => d.toISOString().slice(0,10);
  const monday = parse(value); // already Monday
  const sunday = addDays(monday, 6);
  const label = `${monday.toLocaleDateString(undefined,{ month:'short', day:'numeric' })} - ${sunday.toLocaleDateString(undefined,{ month:'short', day:'numeric' })}`;

  return (
    <div className="inline-flex items-center gap-2 bg-white/70 dark:bg-dark-700/60 rounded-full px-2 py-1.5 border border-gray-200 dark:border-dark-600 shadow-sm">
      <button type="button" className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-600 text-gray-600" onClick={() => onChange(format(addDays(monday, -7)))} aria-label="Previous week">
        <ChevronLeftIcon className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2 px-2">
        <CalendarIcon className="w-4 h-4 text-gray-600" />
        <span className="font-semibold tracking-wide">Week of {monday.toLocaleDateString(undefined,{ weekday:'long' })} · {label}</span>
      </div>
      <button type="button" className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-600 text-gray-600" onClick={() => onChange(format(addDays(monday, 7)))} aria-label="Next week">
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  );
};
// Detail view for a single outreach bacenta (moves form here)
const BacentaDetail: React.FC<{
  bacenta: OutreachBacenta;
  members: OutreachMember[];
  weekStart: string;
  onBack: () => void;
}> = ({ bacenta, members, weekStart, onBack }) => {
  const { addOutreachMemberHandler, updateOutreachMemberHandler, deleteOutreachMemberHandler, convertOutreachMemberToPermanentHandler, showToast } = useAppContext();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [room, setRoom] = useState('');
  const [coming, setComing] = useState<boolean>(false);
  const [reason, setReason] = useState('');

  const handleAdd = async () => {
    try {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Enter a name');
      await addOutreachMemberHandler({
        name: trimmed,
        phoneNumbers: phone ? [phone] : [],
        roomNumber: room || undefined,
        bacentaId: bacenta.id,
        comingStatus: coming,
        notComingReason: !coming && reason ? reason : undefined,
        outreachDate: weekStart, // Monday date of the selected week
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
      setName(''); setPhone(''); setRoom(''); setReason(''); setComing(false);
      showToast('success', 'Outreach member added');
    } catch (e: any) {
      showToast('error', 'Failed to add outreach member', e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button className="px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700" onClick={onBack}>
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <h3 className="text-xl font-bold">{bacenta.name}</h3>
      {/* Weekly filter hint */}
      <div className="text-xs text-gray-500">Showing outreach for the week starting {new Date(weekStart).toLocaleDateString()}</div>
      </div>

      {/* Add member form */}
      <div className="glass p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-12 gap-3 border border-slate-200 dark:border-dark-600">
        <Input label="Name" placeholder="Full name" value={name} onChange={setName} className="sm:col-span-4" />
        <Input label="Phone" placeholder="e.g. 024XXXXXXX" value={phone} onChange={setPhone} className="sm:col-span-3" />
        <Input label="Room" placeholder="Room or area" value={room} onChange={setRoom} className="sm:col-span-3" />
        <Select label="Coming?" value={coming ? 'yes' : 'no'} onChange={(v) => setComing(v === 'yes')} className="sm:col-span-2">
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </Select>
        {!coming && (
          <Input label="Reason (optional)" placeholder="Why not coming?" value={reason} onChange={setReason} className="sm:col-span-6" />
        )}
        <div className="sm:col-span-12 flex justify-end pt-1">
          <Button onClick={handleAdd} leftIcon={<PlusIcon className="w-4 h-4" />}>Add Outreach Member</Button>
        </div>
      </div>

      {/* Members list */}
      <div className="rounded-2xl border border-slate-200 dark:border-dark-600 overflow-hidden">
        <div className="divide-y">
          {members.map(m => (
            <div key={m.id} className="p-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-medium truncate">{m.name}</div>

                <div className="text-xs text-gray-500">Room {m.roomNumber || '—'} · {m.phoneNumbers?.[0] || 'No phone'}</div>
              </div>
              <div className="flex items-center gap-3">
                {m.comingStatus ? (
                  <Badge color="green" size="sm"><span className="inline-flex items-center"><CheckIcon className="w-3 h-3 mr-1" /> Coming</span></Badge>
                ) : (
                  <Badge color="yellow" size="sm"><span className="inline-flex items-center"><ExclamationTriangleIcon className="w-3 h-3 mr-1" /> Not Coming</span></Badge>
                )}
                {!m.convertedMemberId && (
                  <Button size="sm" variant="secondary" onClick={() => convertOutreachMemberToPermanentHandler(m.id)}>Convert</Button>
                )}
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <div className="p-4 text-sm text-gray-500">No outreach members yet</div>
          )}
        </div>
      </div>
    </div>
  );

};

const OutreachView: React.FC = () => {
  const {
    outreachBacentas,
    outreachMembers,
    outreachMonth,
    setOutreachMonth,
    addOutreachBacentaHandler,
    deleteOutreachBacentaHandler,
    deleteOutreachMemberHandler,
    switchTab,
    currentTab,
    showToast
  } = useAppContext();

  const [newBacentaName, setNewBacentaName] = useState('');
  const [selectedBacentaId, setSelectedBacentaId] = useState<string>('');

  // Monday-based week state (YYYY-MM-DD for Monday)
  const [weekStart, setWeekStart] = useState<string>(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0,0,0,0);
    return monday.toISOString().slice(0,10);
  });

  // Preselect bacenta when arriving from All Bacentas
  useEffect(() => {
    const id = (currentTab as any)?.data?.bacentaId as string | undefined;
    if (id) setSelectedBacentaId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const membersByBacenta = useMemo(() => {
    const map: Record<string, OutreachMember[]> = {};
    for (const m of outreachMembers) {
      (map[m.bacentaId] ||= []).push(m);
    }
    return map;
  }, [outreachMembers]);

  const totals = useMemo(() => {
    const perBacenta = outreachBacentas.map(b => {
      const list = membersByBacenta[b.id] || [];
      const total = list.length;
      const coming = list.filter(m => m.comingStatus).length;
      const converted = list.filter(m => !!m.convertedMemberId).length;
      const comingRate = total ? Math.round((coming / total) * 100) : 0;
      const conversionRate = total ? Math.round((converted / total) * 100) : 0;
      return { bacenta: b, total, coming, converted, comingRate, conversionRate };
    });
    const overall = perBacenta.reduce((acc, x) => acc + x.total, 0);
    const overallComing = perBacenta.reduce((acc, x) => acc + x.coming, 0);
    const overallConverted = perBacenta.reduce((acc, x) => acc + x.converted, 0);
    const overallComingRate = overall ? Math.round((overallComing / overall) * 100) : 0;
    const overallConversionRate = overall ? Math.round((overallConverted / overall) * 100) : 0;
    return { perBacenta, overall, overallComing, overallConverted, overallComingRate, overallConversionRate };
  }, [outreachBacentas, membersByBacenta]);

  // Weekly members map for stats/cards (Mon..Sun)
  const weeklyMembersByBacenta = useMemo(() => {
    const monday = new Date(weekStart);
    const sunday = new Date(monday); sunday.setDate(monday.getDate()+6);
    const inWeek = (d?: string) => d ? (new Date(d) >= monday && new Date(d) <= sunday) : false;
    const map: Record<string, OutreachMember[]> = {};
    for (const m of outreachMembers) if (inWeek(m.outreachDate)) (map[m.bacentaId] ||= []).push(m);
    return map;
  }, [outreachMembers, weekStart]);

  const handleAddBacenta = async () => {
    const name = newBacentaName.trim();
    if (!name) return;
    await addOutreachBacentaHandler({ name });
    setNewBacentaName('');
  };



  return (
    <div className="space-y-6">
      {/* If a bacenta is selected, show its detail view instead of the dashboard */}
      {selectedBacentaId && outreachBacentas.find(b => b.id === selectedBacentaId) ? (
        <BacentaDetail
          bacenta={outreachBacentas.find(b => b.id === selectedBacentaId)!}
          members={(weeklyMembersByBacenta[selectedBacentaId] || [])}
          weekStart={weekStart}
          onBack={() => setSelectedBacentaId('')}
        />
      ) : (
        <>

      {/* Header */}
      <div className="flex flex-col items-center text-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-rose-500 to-amber-500 bg-clip-text text-transparent">Outreach</h2>
          <p className="text-sm text-gray-500 dark:text-dark-300 mt-1">Capture community outreach and track conversions</p>
        </div>
        <WeekPicker value={weekStart} onChange={setWeekStart} />
      </div>



      {/* Stats Dashboard Section */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total outreach */}
        <div className="rounded-2xl p-4 border border-gray-200 dark:border-dark-600 bg-gradient-to-br from-rose-50 to-rose-100/60 dark:from-rose-900/20 dark:to-rose-800/10 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-rose-600">Total Outreach</p>
            <PeopleIcon className="w-5 h-5 text-rose-600/80" />
          </div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight">{totals.overall}</div>
          <p className="mt-1 text-xs text-rose-700/70">Members contacted this month</p>
        </div>

        {/* Coming rate */}
        <div className="rounded-2xl p-4 border border-gray-200 dark:border-dark-600 bg-gradient-to-br from-emerald-50 to-emerald-100/60 dark:from-emerald-900/20 dark:to-emerald-800/10 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-emerald-700">Coming Rate</p>
            <ChartBarIcon className="w-5 h-5 text-emerald-600/80" />
          </div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight">{totals.overallComingRate}%</div>
          <p className="mt-1 text-xs text-emerald-700/70">{totals.overallComing} of {totals.overall} confirmed</p>
        </div>

        {/* Conversion rate */}
        <div className="rounded-2xl p-4 border border-gray-200 dark:border-dark-600 bg-gradient-to-br from-indigo-50 to-indigo-100/60 dark:from-indigo-900/20 dark:to-indigo-800/10 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-indigo-700">Conversion Rate</p>
            <ChartBarIcon className="w-5 h-5 text-indigo-600/80" />
          </div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight">{totals.overallConversionRate}%</div>
          <p className="mt-1 text-xs text-indigo-700/70">{totals.overallConverted} became members</p>
        </div>

        {/* Active bacentas */}
        <div className="rounded-2xl p-4 border border-gray-200 dark:border-dark-600 bg-gradient-to-br from-amber-50 to-amber-100/60 dark:from-amber-900/20 dark:to-amber-800/10 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-amber-700">Active Bacentas</p>
            <GroupIcon className="w-5 h-5 text-amber-600/80" />
          </div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight">{totals.perBacenta.filter(x => x.total > 0).length}</div>
          <p className="mt-1 text-xs text-amber-700/70">Outreach groups with activity</p>
        </div>
      </div>

      {/* Bacentas Grid Section */}
      <div className="max-w-6xl mx-auto mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Open All Bacentas card */}
        <button
          className="group rounded-2xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 p-4 shadow-sm hover:shadow-md transition-all text-left"
          onClick={() => switchTab({ id: TabKeys.ALL_BACENTAS, name: 'All Bacenta Leaders' })}
        >
          <div className="flex items-center justify-between">
            <div className="font-semibold truncate">All Bacentas</div>
            <GroupIcon className="w-4 h-4 text-gray-500 group-hover:text-rose-500" />
          </div>
          <p className="mt-3 text-sm text-gray-600 dark:text-dark-300">Open the complete bacenta list</p>
        </button>

        {outreachBacentas.map(b => {
          const stats = totals.perBacenta.find(x => x.bacenta.id === b.id);
          const total = stats?.total || 0;
          const comingRate = stats?.comingRate || 0;
          const conversionRate = stats?.conversionRate || 0;
          return (
            <div key={b.id} className="group rounded-2xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 p-4 shadow-sm transition-all text-left">
              <div className="flex items-start justify-between">
                <button className="font-semibold truncate text-left" onClick={() => setSelectedBacentaId(b.id)}>{b.name}</button>
                {/* Delete: only for custom-added bacentas (no heuristic available, so showing for all outreach bacentas) */}
                <Button size="sm" variant="ghost" onClick={() => deleteOutreachBacentaHandler(b.id)} title="Delete bacenta">
                  <TrashIcon className="w-4 h-4" />
                </Button>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <Badge color="blue">{total} members</Badge>
                <Badge color="green">{comingRate}% coming</Badge>
                <Badge color="purple">{conversionRate}% converted</Badge>
              </div>
            </div>
          );
        })}
      </div>
      </>
      )}
    </div>
  );
};

export default OutreachView;

