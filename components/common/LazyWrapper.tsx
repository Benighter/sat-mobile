import React, { Suspense, lazy } from 'react';
import OptimizedLoader from './OptimizedLoader';

// Loading component
const LoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <OptimizedLoader size="md" message="Loading..." />
  </div>
);

// Lazy load heavy components
export const LazyAttendanceAnalyticsView = lazy(() => import('../attendance/AttendanceAnalyticsView'));
export const LazyMemberListView = lazy(() => import('../members/MemberListView'));
export const LazyBacentaLeadersView = lazy(() => import('../bacentas/BacentaLeadersView'));

export const LazyWeeklyAttendanceView = lazy(() => import('../attendance/WeeklyAttendanceView'));
export const LazySundayHeadCountsView = lazy(() => import('../attendance/SundayHeadCountsView.tsx'));
export const LazySundayHeadCountSectionView = lazy(() => import('../attendance/SundayHeadCountSectionView'));
export const LazySundayConfirmationsView = lazy(() => import('../attendance/SundayConfirmationsView'));
export const LazyNewBelieversView = lazy(() => import('../new-believers/NewBelieversView'));
export const LazyMyDeletionRequestsView = lazy(() => import('../members/MyDeletionRequestsView'));
export const LazyMemberDeletionRequestsView = lazy(() => import('../members/MemberDeletionRequestsView'));
export const LazyOutreachView = lazy(() => import('../outreach/OutreachView'));
export const LazyBacentaOutreachView = lazy(() => import('../outreach/BacentaOutreachView'));
export const LazyPrayerView = lazy(() => import('../prayer/PrayerView'));
export const LazyPrayerMemberDetailsView = lazy(() => import('../prayer/PrayerMemberDetailsView'));
export const LazyMinistriesView = lazy(() => import('../members/MinistriesView'));
export const LazyBacentaMeetingsView = lazy(() => import('../meetings/BacentaMeetingsView'));

// Wrapper component for lazy loading
interface LazyWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const LazyWrapper: React.FC<LazyWrapperProps> = ({ 
  children, 
  fallback = <LoadingFallback /> 
}) => (
  <Suspense fallback={fallback}>
    {children}
  </Suspense>
);

export default LazyWrapper;
