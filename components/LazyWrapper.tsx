import React, { Suspense, lazy } from 'react';
import OptimizedLoader from './OptimizedLoader';

// Loading component
const LoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <OptimizedLoader size="md" message="Loading..." />
  </div>
);

// Lazy load heavy components
export const LazyAttendanceAnalyticsView = lazy(() => import('./AttendanceAnalyticsView'));
export const LazyMemberListView = lazy(() => import('./MemberListView'));
export const LazyBacentasTableView = lazy(() => import('./BacentasTableView'));
export const LazyBacentaLeadersView = lazy(() => import('./BacentaLeadersView'));

export const LazyWeeklyAttendanceView = lazy(() => import('./WeeklyAttendanceView'));
export const LazyNewBelieversView = lazy(() => import('./NewBelieversView'));

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
