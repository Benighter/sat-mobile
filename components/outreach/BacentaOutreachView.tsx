import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { OutreachMember } from '../../types';
import { formatDateToYYYYMMDD } from '../../utils/dateUtils';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Badge from '../ui/Badge';
import { CalendarIcon, PlusIcon, CheckIcon, ExclamationTriangleIcon, ChevronLeftIcon, ChevronRightIcon, TrashIcon, UserIcon, PhoneIcon } from '../icons';
import BulkOutreachAddModal from './BulkOutreachAddModal';

// Week picker (Monday-based)
const WeekPicker: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const parse = (s: string) => new Date(s + 'T00:00:00');
  const addDays = (d: Date, days: number) => {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + days);
    nd.setHours(0,0,0,0);
    return nd;
  };
  const format = (d: Date) => formatDateToYYYYMMDD(d);

  // value is already a Monday (YYYY-MM-DD)
  const monday = parse(value);
  const sunday = addDays(monday, 6);
  const label = `${monday.toLocaleDateString(undefined,{ month:'short', day:'numeric' })} - ${sunday.toLocaleDateString(undefined,{ month:'short', day:'numeric' })}`;

  return (
    <div className="inline-flex items-center gap-2 bg-white/70 dark:bg-dark-700/60 rounded-full px-2 py-1.5 border border-gray-200 dark:border-dark-600 shadow-sm relative z-20 pointer-events-auto">
      <button type="button" className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-600 text-gray-600 pointer-events-auto relative z-30" onClick={() => {
        onChange(format(addDays(monday, -7)));
      }} aria-label="Previous week">
        <ChevronLeftIcon className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2 px-2">
        <CalendarIcon className="w-4 h-4 text-gray-600" />
        <span className="font-semibold tracking-wide">Week of {monday.toLocaleDateString(undefined,{ weekday:'long' })} · {label}</span>
      </div>
      <button type="button" className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-600 text-gray-600 pointer-events-auto relative z-30" onClick={() => {
        onChange(format(addDays(monday, 7)));
      }} aria-label="Next week">
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

interface BacentaOutreachViewProps {
  bacentaId: string;
}

const BacentaOutreachView: React.FC<BacentaOutreachViewProps> = ({ bacentaId }) => {
  const {
    bacentas,
    outreachMembers,
    outreachMonth,
    setOutreachMonth,
    addOutreachMemberHandler,
    updateOutreachMemberHandler,
    deleteOutreachMemberHandler,
    convertOutreachMemberToPermanentHandler,
    showToast
  } = useAppContext();

  // Monday-based week state (YYYY-MM-DD for Monday)
  const [weekStart, setWeekStart] = useState<string>(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0,0,0,0);
    return formatDateToYYYYMMDD(monday);
  });

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [room, setRoom] = useState('');
  const [coming, setComing] = useState<boolean>(false);
  const [reason, setReason] = useState('');
  // Keep monthly subscription in sync when week changes
  useEffect(() => {
    const ym = weekStart.slice(0,7);
    if (ym !== outreachMonth) setOutreachMonth(ym);
  }, [weekStart, outreachMonth, setOutreachMonth]);

  const [showForm, setShowForm] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  const bacenta = bacentas.find(b => b.id === bacentaId);

  // Filter outreach members for this bacenta and week
  const weeklyMembers = useMemo(() => {
    const monday = new Date(weekStart);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const inWeek = (d?: string) => {
      if (!d) return false;
      const date = new Date(d);
      return date >= monday && date <= sunday;
    };

    return outreachMembers.filter(m =>
      m.bacentaId === bacentaId && inWeek(m.outreachDate)
    );
  }, [outreachMembers, bacentaId, weekStart]);

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await addOutreachMemberHandler({
        name: trimmed,
        phoneNumbers: phone ? [phone] : [],
        roomNumber: room || undefined,
        bacentaId: bacentaId,
        comingStatus: coming,
        notComingReason: !coming && reason ? reason : undefined,
  outreachDate: weekStart, // Monday date of the selected week
      });
      setName(''); setPhone(''); setRoom(''); setReason(''); setComing(false);
      setShowForm(false); // Close form after adding
      showToast('success', 'Outreach member added');
    } catch (error) {
      showToast('error', 'Failed to add outreach member');
    }
  };

  const handleToggleComing = async (member: OutreachMember) => {
    try {
      await updateOutreachMemberHandler(member.id, {
        comingStatus: !member.comingStatus,
        notComingReason: member.comingStatus ? 'Changed to not coming' : undefined,
        lastUpdated: new Date().toISOString(),
      });
      showToast('success', 'Status updated');
    } catch (error) {
      showToast('error', 'Failed to update status');
    }
  };

  const handleConvert = async (member: OutreachMember) => {
    if (member.convertedMemberId) return;
    try {
      await convertOutreachMemberToPermanentHandler(member.id);
      showToast('success', 'Member converted successfully');
    } catch (error) {
      showToast('error', 'Failed to convert member');
    }
  };

  const handleDelete = async (member: OutreachMember) => {
    if (!confirm(`Delete ${member.name} from outreach list?`)) return;
    try {
      await deleteOutreachMemberHandler(member.id);
      showToast('success', 'Member deleted');
    } catch (error) {
      showToast('error', 'Failed to delete member');
    }
  };

  if (!bacenta) {
    return <div className="p-8 text-center text-gray-500">Bacenta not found</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col items-center text-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-rose-500 to-amber-500 bg-clip-text text-transparent">
            {bacenta.name} Outreach
          </h2>
          <p className="text-sm text-gray-500 dark:text-dark-300 mt-1">Manage weekly outreach for this building</p>
        </div>
        <WeekPicker value={weekStart} onChange={setWeekStart} />
      </div>

      {/* Add member button/form */}
      {!showForm ? (
        <div className="flex justify-center gap-3">
          <Button
            onClick={() => setShowForm(true)}
            leftIcon={<PlusIcon className="w-4 h-4" />}
            className="bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white border-0 shadow-lg"
          >
            Add Outreach Member
          </Button>
          <Button
            onClick={() => setShowBulkModal(true)}
            variant="secondary"
          >
            Bulk Add
          </Button>
        </div>
      ) : (
        <div className="glass p-6 rounded-2xl border border-slate-200 dark:border-dark-600">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Add Outreach Member</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <Input label="Name" placeholder="Full name" value={name} onChange={setName} className="sm:col-span-4" />
            <Input label="Phone" placeholder="e.g. 024XXXXXXX" value={phone} onChange={setPhone} className="sm:col-span-3" />
            <Input label="Room" placeholder="Room or area" value={room} onChange={setRoom} className="sm:col-span-3" />
            <Select label="Coming?" value={coming ? 'yes' : 'no'} onChange={(v) => setComing(v === 'yes')} className="sm:col-span-2">
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </Select>
            {!coming && (
              <Input label="Reason (optional)" placeholder="Why not coming?" value={reason} onChange={setReason} className="sm:col-span-12" />
            )}
            <div className="sm:col-span-12 flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleAdd} leftIcon={<PlusIcon className="w-4 h-4" />}>Add Member</Button>
            </div>
          </div>
        </div>
      )}

      {/* Members table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Outreach Members ({weeklyMembers.length})</h3>
            <div className="text-xs text-gray-500">Week starting {new Date(weekStart).toLocaleDateString()}</div>
          </div>
        </div>

        {weeklyMembers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <UserIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">No outreach members yet</p>
            <p className="text-sm">Add some members using the button above!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {weeklyMembers.map((member, index) => (
                  <tr key={member.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-blue-50/50 transition-colors duration-200`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-r from-rose-400 to-amber-400 flex items-center justify-center">
                            <span className="text-xs font-medium text-white">
                              {member.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{member.name}</div>
                          {member.convertedMemberId && (
                            <div className="text-xs text-purple-600 font-medium">✓ Converted</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {member.phoneNumbers?.[0] ? (
                        <div className="flex items-center text-sm text-gray-900 cursor-pointer hover:text-blue-600"
                             onClick={() => window.open(`tel:${member.phoneNumbers![0]}`)}>
                          <PhoneIcon className="w-4 h-4 mr-2 text-gray-400" />
                          {member.phoneNumbers[0]}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {member.roomNumber || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <Badge color={member.comingStatus ? 'green' : 'red'} size="sm">
                        {member.comingStatus ? 'Coming' : 'Not Coming'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                      <div className="truncate" title={member.notComingReason || ''}>
                        {member.notComingReason || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleComing(member)}
                          title={member.comingStatus ? 'Mark as not coming' : 'Mark as coming'}
                          className="p-1.5"
                        >
                          {member.comingStatus ? <ExclamationTriangleIcon className="w-4 h-4 text-orange-500" /> : <CheckIcon className="w-4 h-4 text-green-500" />}
                        </Button>

                        {!member.convertedMemberId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleConvert(member)}
                            title="Convert to permanent member"
                            className="p-1.5"
                          >
                            <UserIcon className="w-4 h-4 text-blue-500" />
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(member)}
                          title="Delete member"
                          className="p-1.5"
                        >
                          <TrashIcon className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <BulkOutreachAddModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        bacentaId={bacentaId}
        bacentaName={bacenta?.name}
        weekStart={weekStart}
      />
    </div>
  );
};

export default BacentaOutreachView;
