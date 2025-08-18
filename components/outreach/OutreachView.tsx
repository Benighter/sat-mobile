import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { hasAdminPrivileges } from '../../utils/permissionUtils';
import { OutreachMember, OutreachBacenta } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Badge from '../ui/Badge';
import { UsersIcon, PlusIcon, CheckIcon, ExclamationTriangleIcon, ChevronLeftIcon, PeopleIcon, TrashIcon } from '../icons';
import AllBacentasView from '../bacentas/AllBacentasView';
import BulkOutreachAddModal from './BulkOutreachAddModal';
import AddOutreachMemberModal from './AddOutreachMemberModal';


// MonthPicker not used in this composition; removed to reduce noise

// Detail view for a single outreach bacenta (moves form here)
const BacentaDetail: React.FC<{
  bacenta: OutreachBacenta;
  members: OutreachMember[];
  weekStart: string;
  onBack: () => void;
}> = ({ bacenta, members, weekStart, onBack }) => {
  const { deleteOutreachMemberHandler, convertOutreachMemberToPermanentHandler, userProfile, showConfirmation, createOutreachDeletionRequestHandler } = useAppContext();
  const isAdmin = hasAdminPrivileges(userProfile);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [room, setRoom] = useState('');
  const [coming, setComing] = useState<boolean>(false);
  const [reason, setReason] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // inline add handler replaced by modal

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50/30 dark:from-dark-950 dark:via-dark-900 dark:to-dark-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Header with Back Button */}
          <div className="flex items-center gap-4">
            <button
              className="group p-3 rounded-xl glass border border-white/20 dark:border-dark-600/50 hover:shadow-lg transition-all duration-200 hover:scale-105"
              onClick={onBack}
            >
              <ChevronLeftIcon className="w-6 h-6 text-gray-600 dark:text-dark-300 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors duration-200" />
            </button>
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white">
                <span className="bg-gradient-to-r from-rose-600 to-amber-500 bg-clip-text text-transparent">
                  {bacenta.name}
                </span>
              </h1>
              <p className="text-gray-600 dark:text-dark-300 mt-1">
                Showing outreach for the week starting {new Date(weekStart).toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>

          {/* Add Member Form - Enhanced */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-green-500 to-blue-600 rounded-3xl blur opacity-20"></div>
            <div className="relative glass p-8 rounded-2xl border border-white/20 dark:border-dark-600/50 backdrop-blur-xl shadow-xl">
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Add Outreach Member</h2>
                  <p className="text-gray-600 dark:text-dark-300 mt-1">Record new community outreach contact</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Input
                    label="Full Name"
                    placeholder="Enter full name"
                    value={name}
                    onChange={setName}
                    className="bg-white/80 dark:bg-dark-700/80 border-gray-200 dark:border-dark-600 focus:ring-green-500 dark:focus:ring-green-400"
                  />
                  <Input
                    label="Phone Number"
                    placeholder="e.g. 024XXXXXXX"
                    value={phone}
                    onChange={setPhone}
                    className="bg-white/80 dark:bg-dark-700/80 border-gray-200 dark:border-dark-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <Input
                    label="Room/Area"
                    placeholder="Room or area"
                    value={room}
                    onChange={setRoom}
                    className="bg-white/80 dark:bg-dark-700/80 border-gray-200 dark:border-dark-600 focus:ring-purple-500 dark:focus:ring-purple-400"
                  />
                  <Select
                    label="Coming to Church?"
                    value={coming ? 'yes' : 'no'}
                    onChange={(v) => setComing(v === 'yes')}
                    className="bg-white/80 dark:bg-dark-700/80 border-gray-200 dark:border-dark-600 focus:ring-amber-500 dark:focus:ring-amber-400"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </Select>
                </div>

                {!coming && (
                  <div className="animate-in slide-in-from-top-2 duration-300">
                    <Input
                      label="Reason for Not Coming"
                      placeholder="Why are they not coming to church?"
                      value={reason}
                      onChange={setReason}
                      className="bg-white/80 dark:bg-dark-700/80 border-gray-200 dark:border-dark-600 focus:ring-orange-500 dark:focus:ring-orange-400"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-dark-600">
                  <Button
                    onClick={() => setShowAddModal(true)}
                    leftIcon={<PlusIcon className="w-5 h-5" />}
                    className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    Add Outreach Member
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowBulk(true)}
                  >
                    Bulk Add
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <AddOutreachMemberModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            bacentaId={bacenta.id}
            bacentaName={bacenta.name}
            weekStart={weekStart}
          />
          <BulkOutreachAddModal
            isOpen={showBulk}
            onClose={() => setShowBulk(false)}
            bacentaId={bacenta.id}
            bacentaName={bacenta.name}
            weekStart={weekStart}
          />

          {/* Members List - Enhanced */}
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Outreach Members</h2>
              <p className="text-gray-600 dark:text-dark-300 mt-1">
                {members.length > 0 ? `${members.length} member${members.length === 1 ? '' : 's'} contacted this week` : 'No members contacted yet'}
              </p>
            </div>

            {members.length > 0 ? (
              <div className="grid gap-4">
                {members.map(m => (
                  <div key={m.id} className="group relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-dark-600 dark:to-dark-500 rounded-2xl opacity-0 group-hover:opacity-100 transition duration-300 blur-sm"></div>
                    <div className="relative glass p-6 rounded-2xl border border-white/20 dark:border-dark-600/50 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">{m.name}</h3>
                            {m.comingStatus ? (
                              <Badge color="green" className="font-medium">
                                <CheckIcon className="w-3 h-3 mr-1" />
                                Coming
                              </Badge>
                            ) : (
                              <Badge color="yellow" className="font-medium">
                                <ExclamationTriangleIcon className="w-3 h-3 mr-1" />
                                Not Coming
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-dark-300">
                            <div className="flex items-center gap-1">
                              <span className="font-medium">Room:</span>
                              <span>{m.roomNumber || 'Not specified'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="font-medium">Phone:</span>
                              <span>{m.phoneNumbers?.[0] || 'Not provided'}</span>
                            </div>
                          </div>

              {!m.comingStatus && m.notComingReason && (
                            <div className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
                <span className="font-medium">Reason:</span> {m.notComingReason}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 ml-4">
                          {!m.convertedMemberId && (
                            <Button
                              size="sm"
                              onClick={() => convertOutreachMemberToPermanentHandler(m.id)}
                              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200"
                            >
                              Convert to Member
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (isAdmin) {
                                deleteOutreachMemberHandler(m.id);
                                return;
                              }
                              showConfirmation('createDeletionRequest', { member: { firstName: m.name, lastName: '' } }, async () => {
                                await createOutreachDeletionRequestHandler(m.id);
                              })
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                            title="Delete member"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 space-y-4">
                <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-dark-700 dark:to-dark-600 flex items-center justify-center">
                  <UsersIcon className="w-12 h-12 text-gray-400 dark:text-dark-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">No Outreach Members Yet</h3>
                  <p className="text-gray-600 dark:text-dark-300">
                    Start by adding your first outreach contact using the form above.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

};

const OutreachView: React.FC = () => {
  const {
    outreachBacentas,
    outreachMembers,
    allOutreachMembers, // All outreach members across all time periods
    bacentas, // Regular bacentas for validation
    deleteOutreachBacentaHandler,
    currentTab,
  } = useAppContext();

  // const [newBacentaName, setNewBacentaName] = useState('');
  const [selectedBacentaId, setSelectedBacentaId] = useState<string>('');

  // Monday-based week state (YYYY-MM-DD for Monday) - fixed to current week
  const weekStart = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0,0,0,0);
    return monday.toISOString().slice(0,10);
  }, []);

  // Preselect bacenta when arriving from All Bacentas
  useEffect(() => {
    const id = (currentTab as any)?.data?.bacentaId as string | undefined;
    if (id) setSelectedBacentaId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // const membersByBacenta = useMemo(() => {
  //   const map: Record<string, OutreachMember[]> = {};
  //   for (const m of outreachMembers) {
  //     (map[m.bacentaId] ||= []).push(m);
  //   }
  //   return map;
  // }, [outreachMembers]);

  // Overall totals using ALL outreach members (across all time periods)
  // Fallback to current monthly data if allOutreachMembers is empty
  // Filter out orphaned members whose bacentaId doesn't exist in current bacentas
  const effectiveAllMembers = useMemo(() => {
    const baseMembers = allOutreachMembers.length > 0 ? allOutreachMembers : outreachMembers;
    const validBacentaIds = new Set(bacentas.map(b => b.id));
    
    // Filter out members whose bacentaId doesn't exist anymore
    const validMembers = baseMembers.filter(m => validBacentaIds.has(m.bacentaId));
    
    return validMembers;
  }, [allOutreachMembers, outreachMembers, bacentas]);
  
  // Group members by bacenta ID for consistent calculation
  const allMembersByBacenta = useMemo(() => {
    const map: Record<string, OutreachMember[]> = {};
    for (const m of effectiveAllMembers) {
      (map[m.bacentaId] ||= []).push(m);
    }
    return map;
  }, [effectiveAllMembers]);

  const totals = useMemo(() => {
    // Calculate totals consistently using only valid outreach members
    const overall = effectiveAllMembers.length;
    const overallComing = effectiveAllMembers.filter(m => m.comingStatus).length;
    const overallConverted = effectiveAllMembers.filter(m => !!m.convertedMemberId).length;
    const overallComingRate = overall ? Math.round((overallComing / overall) * 100) : 0;
    const overallConversionRate = overall ? Math.round((overallConverted / overall) * 100) : 0;
    
    // Calculate per-outreach-bacenta stats for the individual cards in this view
    const perBacenta = outreachBacentas.map(b => {
      const list = allMembersByBacenta[b.id] || [];
      const total = list.length;
      const coming = list.filter(m => m.comingStatus).length;
      const converted = list.filter(m => !!m.convertedMemberId).length;
      const comingRate = total ? Math.round((coming / total) * 100) : 0;
      const conversionRate = total ? Math.round((converted / total) * 100) : 0;
      
      return { bacenta: b, total, coming, converted, comingRate, conversionRate };
    });
    
    return { perBacenta, overall, overallComing, overallConverted, overallComingRate, overallConversionRate };
  }, [outreachBacentas, allMembersByBacenta, effectiveAllMembers]);

  // Weekly members map for stats/cards (Mon..Sun) - use effective data source
  const weeklyMembersByBacenta = useMemo(() => {
    const monday = new Date(weekStart);
    const sunday = new Date(monday); sunday.setDate(monday.getDate()+6);
    const inWeek = (d?: string) => d ? (new Date(d) >= monday && new Date(d) <= sunday) : false;
    const map: Record<string, OutreachMember[]> = {};
    
    // Use effective data source - prefer allOutreachMembers if available, fallback to current monthly data
    const dataSource = effectiveAllMembers.length > 0 ? effectiveAllMembers : outreachMembers;
    
    for (const m of dataSource) {
      if (inWeek(m.outreachDate)) {
        (map[m.bacentaId] ||= []).push(m);
      }
    }
    return map;
  }, [effectiveAllMembers, outreachMembers, weekStart]);

  // Calculate weekly totals
  const weeklyTotals = useMemo(() => {
    const weeklyMembers = Object.values(weeklyMembersByBacenta).flat();
    const weeklyTotal = weeklyMembers.length;
    const weeklyComing = weeklyMembers.filter(m => m.comingStatus).length;
    const weeklyConverted = weeklyMembers.filter(m => !!m.convertedMemberId).length;
    return { weeklyTotal, weeklyComing, weeklyConverted };
  }, [weeklyMembersByBacenta]);

  // Note: adding outreach bacenta is handled elsewhere; this view only displays



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50/30 dark:from-dark-950 dark:via-dark-900 dark:to-dark-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* If a bacenta is selected, show its detail view instead of the dashboard */}
        {selectedBacentaId && outreachBacentas.find(b => b.id === selectedBacentaId) ? (
          <BacentaDetail
            bacenta={outreachBacentas.find(b => b.id === selectedBacentaId)!}
            members={(weeklyMembersByBacenta[selectedBacentaId] || [])}
            weekStart={weekStart}
            onBack={() => setSelectedBacentaId('')}
          />
        ) : (
          <div className="space-y-12">
            {/* Header Section */}
            <div className="text-center space-y-6">
              <div className="space-y-4">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight">
                  <span className="bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 bg-clip-text text-transparent">
                    Outreach
                  </span>
                </h1>
                <p className="text-lg sm:text-xl text-gray-600 dark:text-dark-300 max-w-2xl mx-auto leading-relaxed">
                  Capture community outreach and track conversions with precision and care
                </p>
              </div>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Total Outreach Card - Enhanced */}
              <div className="lg:col-span-1">
                <div className="relative group">
                  <div className="absolute -inset-1 z-0 bg-gradient-to-r from-rose-500 to-amber-500 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-300 pointer-events-none"></div>
                  <div className="relative z-10 bg-white dark:bg-white p-8 rounded-2xl border border-gray-200 dark:border-gray-300 shadow-lg">
                    <div className="text-center space-y-4">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 shadow-lg">
                        <PeopleIcon className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wider text-rose-600">
                          Overall Total Outreach
                        </p>
                        <div className="text-5xl font-extrabold text-slate-900 mt-2 leading-none">
                          {totals.overall}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Total people outreached across all bacentas
                        </p>
                      </div>
                      
                      {/* Additional stats */}
                      <div className="pt-4 border-t border-gray-200 space-y-2">
                        <div className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">
                          All-Time Statistics
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Coming to church:</span>
                          <span className="font-semibold text-green-600">
                            {totals.overallComing} ({totals.overallComingRate}%)
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Converted members:</span>
                          <span className="font-semibold text-purple-600">
                            {totals.overallConverted} ({totals.overallConversionRate}%)
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Active bacentas:</span>
                          <span className="font-semibold text-blue-600">
                            {outreachBacentas.length}
                          </span>
                        </div>
                        
                        {/* Current week stats */}
                        {weeklyTotals.weeklyTotal > 0 && (
                          <>
                            <div className="pt-3 mt-3 border-t border-gray-100">
                              <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">
                                This Week
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">People contacted:</span>
                                <span className="font-semibold text-rose-600">
                                  {weeklyTotals.weeklyTotal}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Coming this week:</span>
                                <span className="font-semibold text-green-600">
                                  {weeklyTotals.weeklyComing}
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* All Bacentas Section - Enhanced */}
              <div className="lg:col-span-2">
                <AllBacentasView />
              </div>
            </div>

            {/* Individual Bacentas Management */}
            {outreachBacentas.length > 0 && (
              <div className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
                    Individual Bacenta Management
                  </h2>
                  <p className="text-gray-600 dark:text-dark-300 mt-2 text-lg">
                    Manage outreach activities for each building
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {outreachBacentas.map(b => {
                    const stats = totals.perBacenta.find(x => x.bacenta.id === b.id);
                    const total = stats?.total || 0;
                    const comingRate = stats?.comingRate || 0;
                    const conversionRate = stats?.conversionRate || 0;
                    const coming = stats?.coming || 0;
                    const converted = stats?.converted || 0;

                    return (
                      <div key={b.id} className="group relative">
                        <div className="absolute -inset-0.5 z-0 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-dark-600 dark:to-dark-500 rounded-2xl opacity-0 group-hover:opacity-100 transition duration-300 blur-sm pointer-events-none"></div>
                        <div className="relative bg-white/95 dark:bg-dark-800/95 p-6 rounded-2xl border border-gray-200 dark:border-dark-600 shadow-md hover:shadow-xl transition-all duration-300 backdrop-blur-sm">
                          <div className="space-y-4">
                            {/* Header with Total Count */}
                            <div className="flex items-start justify-between">
                              <button
                                className="text-left flex-1 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors duration-200"
                                onClick={() => setSelectedBacentaId(b.id)}
                              >
                                <div className="flex items-center gap-3 mb-2">
                                  <div className="bg-gradient-to-r from-rose-500 to-amber-500 p-2 rounded-lg">
                                    <PeopleIcon className="w-5 h-5 text-white" />
                                  </div>
                                  <div className="text-left">
                                    <div className="text-3xl font-bold text-slate-800 dark:text-white">
                                      {total}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-dark-400 uppercase tracking-wide">
                                      {total === 1 ? 'Total Member' : 'Total Members'}
                                    </div>
                                  </div>
                                </div>
                                <h3 className="font-bold text-lg text-slate-800 dark:text-white truncate">
                                  {b.name}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
                                  {total > 0 
                                    ? `${coming} coming • ${converted} converted`
                                    : 'No outreach members yet - click to add some'
                                  }
                                </p>
                              </button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteOutreachBacentaHandler(b.id)}
                                title="Delete bacenta"
                                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </Button>
                            </div>

                            {/* Stats */}
                            <div className="flex flex-wrap gap-2">
                              {total > 0 ? (
                                <>
                                  <Badge color="green" className="font-medium">
                                    {comingRate}% coming
                                  </Badge>
                                  <Badge color="purple" className="font-medium">
                                    {conversionRate}% converted
                                  </Badge>
                                </>
                              ) : (
                                <Badge color="gray" className="font-medium">
                                  No data yet
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OutreachView;

