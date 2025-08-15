import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { getUpcomingBirthdays, getBirthdayStats, calculateAge, getBirthdaysForMonth } from '../../utils/birthdayUtils';
import { CakeIcon, GiftIcon, CalendarIcon, UserIcon, ChevronLeftIcon, ChevronRightIcon } from '../icons';
import { CheckIcon } from '../icons';
import Button from '../ui/Button';
import { BirthdayNotificationService } from '../../services/birthdayNotificationService';
import { userService } from '../../services/userService';

// Minimal stat item to keep layout clean
const StatItem = ({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: React.ReactNode; bg?: string }) => (
  <div className={`flex items-center gap-3 rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 p-3 shadow-sm`}>
    <div className={`w-8 h-8 rounded-md flex items-center justify-center ${bg || 'bg-gray-50'}`}>{icon}</div>
    <div>
      <p className="text-lg font-semibold text-gray-900 dark:text-dark-100 leading-5">{value}</p>
      <p className="text-xs text-gray-500 dark:text-dark-400">{label}</p>
    </div>
  </div>
);


const BirthdaysView: React.FC = () => {
  const { members, bacentas, displayedDate, navigateToPreviousMonth, navigateToNextMonth, currentChurchId, userProfile, showToast } = useAppContext();

  const [isTriggering, setIsTriggering] = useState(false);
  const [triggeredNow, setTriggeredNow] = useState(false);

  const upcomingBirthdays = useMemo(() => getUpcomingBirthdays(members), [members]);
  const selectedMonthBirthdays = useMemo(() => getBirthdaysForMonth(members, displayedDate), [members, displayedDate]);

  const birthdayStats = useMemo(() => getBirthdayStats(members), [members]);

  const todaysBirthdays = useMemo(() => upcomingBirthdays.filter(b => b.isToday), [upcomingBirthdays]);
  const futureBirthdays = useMemo(() => upcomingBirthdays.filter(b => !b.isToday), [upcomingBirthdays]);

  // For month view, separate passed and future birthdays
  const passedBirthdays = useMemo(() => selectedMonthBirthdays.filter(b => b.hasPassedThisYear && !b.isToday), [selectedMonthBirthdays]);
  const monthFutureBirthdays = useMemo(() => selectedMonthBirthdays.filter(b => !b.hasPassedThisYear && !b.isToday), [selectedMonthBirthdays]);
  const monthTodaysBirthdays = useMemo(() => selectedMonthBirthdays.filter(b => b.isToday), [selectedMonthBirthdays]);

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return now.getFullYear() === displayedDate.getFullYear() && now.getMonth() === displayedDate.getMonth();
  }, [displayedDate]);
  const monthLabel = useMemo(() => displayedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), [displayedDate]);

  const getBacentaName = (bacentaId: string) => {
    const bacenta = bacentas.find(b => b.id === bacentaId);
    return bacenta?.name || 'Unassigned';
  };

  const ProfileAvatar = ({ member }: { member: any }) => {
    if (member.profilePicture) {
      return (
        <img
          src={member.profilePicture}
          alt={`${member.firstName} ${member.lastName || ''}`}
          className="w-12 h-12 rounded-full object-cover shadow-lg ring-2 ring-white/20"
        />
      );
    }

    const initials = `${member.firstName.charAt(0)}${(member.lastName || '').charAt(0)}`.toUpperCase();
    return (
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-lg ring-2 ring-white/20">
        <span className="text-sm">{initials}</span>
      </div>
    );
  };

  const BirthdayCard = ({ birthday }: { birthday: any }) => {
    const { member, age, daysUntil, isToday, displayDate, hasPassedThisYear, currentAge } = birthday;
    const ageToday = useMemo(() => calculateAge(member.birthday, new Date()), [member.birthday]);
    
    // Determine age label based on whether birthday has passed
    let ageLabel: string;
    if (isToday) {
      ageLabel = `Turns ${ageToday}`;
    } else if (hasPassedThisYear) {
      ageLabel = `Turned ${currentAge}`;
    } else {
      ageLabel = `Turning ${age}`;
    }

    return (
      <div
        className={`group p-3 sm:p-4 rounded-xl border transition-all duration-200 ${
          isToday
            ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20'
            : hasPassedThisYear
            ? 'border-gray-300 bg-gray-50 dark:bg-gray-700/30 opacity-75'
            : 'border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 hover:border-slate-300 dark:hover:border-dark-500 hover:shadow-md'
        }`}
      >
        <div className="flex items-center">
          <div className="mr-3 sm:mr-4 flex-shrink-0">
            <ProfileAvatar member={member} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-dark-100 truncate">
                {member.firstName} {member.lastName || ''}
              </h3>
              <span
                className={`ml-3 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                  isToday
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                    : hasPassedThisYear
                    ? 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-dark-700 dark:text-dark-200'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                {displayDate}
              </span>
            </div>

            <div className="mt-1 flex items-center text-xs sm:text-sm text-gray-600 dark:text-dark-300 gap-4 min-w-0">
              <span className="inline-flex items-center whitespace-nowrap">
                <GiftIcon className="w-4 h-4 mr-1" />
                {ageLabel}
              </span>
              <span className="inline-flex items-center min-w-0">
                <UserIcon className="w-4 h-4 mr-1" />
                <span className="truncate">{getBacentaName(member.bacentaId)}</span>
              </span>

              {!isToday ? (
                <span className="ml-auto text-xs text-gray-500 dark:text-dark-400">
                  {daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`}
                </span>
              ) : (
                <span className="ml-auto inline-flex items-center text-xs font-medium text-amber-700 dark:text-amber-200">
                  <CakeIcon className="w-4 h-4 mr-1" />
                  Today
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const EmptyState = () => (
    <div className="text-center py-12">
      <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <CakeIcon className="w-12 h-12 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No Upcoming Birthdays</h3>
      <p className="text-gray-500 max-w-md mx-auto">
        There are no birthdays coming up in the current period. Check back later or add birthday information to member profiles.
      </p>
    </div>
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header - cleaner, single-line, aligned, responsive sizing */}
      <div className="text-center">
  <div className="inline-flex max-w-full min-w-0 items-center rounded-full bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 px-3 py-2 sm:px-5 sm:py-2 shadow-sm">
          <h1
            className="leading-none font-bold text-gray-900 dark:text-dark-100 text-[clamp(0.8rem,4.2vw,1.4rem)]"
          >
            Upcoming Birthdays
          </h1>
        </div>
        <p className="mt-3 text-xs sm:text-sm md:text-base text-gray-600 dark:text-dark-300 max-w-2xl mx-auto">
          Celebrate with your church family. This month and the next 7 days.
        </p>
  {/* Quick action: trigger all birthday notifications now (admin only) */}
  {userProfile?.role === 'admin' && (
  <div className="mt-3 flex justify-center">
          <Button
            variant="primary"
            onClick={async () => {
              if (!currentChurchId) {
                showToast('error', 'No church context', 'Cannot determine church to process');
                return;
              }
              setIsTriggering(true);
              try {
                const users = await userService.getChurchUsers(currentChurchId);
                const membersWithBirthdays = members.filter(m => !!m.birthday);
                const days = userProfile?.notificationPreferences?.birthdayNotifications?.daysBeforeNotification?.length
                  ? userProfile.notificationPreferences.birthdayNotifications.daysBeforeNotification
                  : [7, 5, 3, 2, 1, 0];

                const svc = BirthdayNotificationService.getInstance();
                const results = await svc.processBirthdayNotifications(
                  currentChurchId,
                  membersWithBirthdays,
                  users as any,
                  bacentas,
                  days,
                  new Date(),
                  { force: true, actorAdminId: userProfile?.uid }
                );
                setTriggeredNow(true);
                showToast('success', 'Notifications Sent', `Processed ${results.processed}, sent ${results.sent}, failed ${results.failed}`);
                setTimeout(() => setTriggeredNow(false), 5000);
              } catch (error: any) {
                showToast('error', 'Trigger Failed', error?.message || 'Failed to trigger processing');
              } finally {
                setIsTriggering(false);
              }
            }}
            loading={isTriggering}
            leftIcon={triggeredNow ? <CheckIcon className="w-4 h-4" /> : <CalendarIcon className="w-4 h-4" />}
          >
            {triggeredNow ? 'Triggered!' : 'Send Birthday Notifications Now'}
          </Button>
  </div>
  )}
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          className="p-2 rounded-full border border-gray-200 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700"
          onClick={navigateToPreviousMonth}
          aria-label="Previous month"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <div className="text-sm sm:text-base font-medium text-gray-900 dark:text-dark-100">
          {monthLabel}
          {!isCurrentMonth && (
            <span className="ml-2 text-xs text-gray-500 dark:text-dark-400">(Viewing)</span>
          )}
        </div>
        <button
          type="button"
          className="p-2 rounded-full border border-gray-200 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700"
          onClick={navigateToNextMonth}
          aria-label="Next month"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Compact stats - reduced visual noise */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatItem icon={<UserIcon className="w-4 h-4 text-blue-600" />} label="Members" value={birthdayStats.totalMembersWithBirthdays} bg="bg-blue-50" />
        <StatItem icon={<CalendarIcon className="w-4 h-4 text-green-600" />} label="Upcoming" value={birthdayStats.upcomingCount} bg="bg-green-50" />
        <StatItem icon={<CakeIcon className="w-4 h-4 text-amber-600" />} label="Today" value={birthdayStats.todayCount} bg="bg-amber-50" />
        <StatItem icon={<GiftIcon className="w-4 h-4 text-purple-600" />} label="Coverage" value={`${birthdayStats.percentageWithBirthdays}%`} bg="bg-purple-50" />
      </div>

      {/* Birthday List - grouped for readability */}
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-600 shadow-sm">
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-dark-600">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-dark-100">
            {isCurrentMonth && selectedMonthBirthdays.length === 0
              ? (upcomingBirthdays.length > 0 ? `${upcomingBirthdays.length} Upcoming Birthday${upcomingBirthdays.length !== 1 ? 's' : ''}` : 'No Upcoming Birthdays')
              : `${selectedMonthBirthdays.length} Birthday${selectedMonthBirthdays.length !== 1 ? 's' : ''} in ${monthLabel}`}
          </h2>
        </div>

        <div className="p-4 sm:p-5">
          {isCurrentMonth && selectedMonthBirthdays.length === 0 ? (
            upcomingBirthdays.length > 0 ? (
              <div className="space-y-4">
                {todaysBirthdays.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Today</h3>
                    {todaysBirthdays.map((b) => (
                      <BirthdayCard key={`${b.member.id}-${b.birthday}`} birthday={b} />
                    ))}
                  </div>
                )}
                {futureBirthdays.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-400">Upcoming</h3>
                    {futureBirthdays.map((b) => (
                      <BirthdayCard key={`${b.member.id}-${b.birthday}`} birthday={b} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <EmptyState />
            )
          ) : (
            <div className="space-y-4">
              {/* Today's birthdays in month view */}
              {monthTodaysBirthdays.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Today</h3>
                  {monthTodaysBirthdays.map((b) => (
                    <BirthdayCard key={`${b.member.id}-${b.birthday}`} birthday={b} />
                  ))}
                </div>
              )}
              
              {/* Future birthdays in month view */}
              {monthFutureBirthdays.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-400">Upcoming This Month</h3>
                  {monthFutureBirthdays.map((b) => (
                    <BirthdayCard key={`${b.member.id}-${b.birthday}`} birthday={b} />
                  ))}
                </div>
              )}
              
              {/* Passed birthdays in month view */}
              {passedBirthdays.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Already Celebrated</h3>
                  {passedBirthdays.map((b) => (
                    <BirthdayCard key={`${b.member.id}-${b.birthday}`} birthday={b} />
                  ))}
                </div>
              )}
              
              {selectedMonthBirthdays.length === 0 && (
                <p className="text-sm text-gray-500">No birthdays found in {monthLabel}.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BirthdaysView;
