import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { MemberDeletionRequest, DeletionRequestStatus } from '../../types';
import { hasLeaderPrivileges, hasAdminPrivileges } from '../../utils/permissionUtils';
import { formatISODate } from '../../utils/dateUtils';
import Badge from '../ui/Badge';
import {
  UserIcon,
  ClockIcon,
  CheckIcon,
  XMarkIcon,
  CalendarIcon,
  SearchIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '../icons';

interface MyDeletionRequestsViewProps {
  // No props needed for full-screen view
}

const MyDeletionRequestsView: React.FC<MyDeletionRequestsViewProps> = () => {
  const { userProfile, memberDeletionRequests } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DeletionRequestStatus>('all');

  // Check if current user has leader privileges
  const isLeader = hasLeaderPrivileges(userProfile);
  const isAdmin = hasAdminPrivileges(userProfile);

  // Filter requests to show only those created by the current user
  const myRequests = useMemo(() => {
    if (!userProfile?.uid) return [];
    
    return memberDeletionRequests.filter(request => 
      request.requestedBy === userProfile.uid
    );
  }, [memberDeletionRequests, userProfile?.uid]);

  // Filter requests based on search and status
  const filteredRequests = useMemo(() => {
    return myRequests.filter(request => {
      const matchesSearch = searchTerm === '' || 
        request.memberName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [myRequests, searchTerm, statusFilter]);

  // Get status badge color
  const getStatusBadgeColor = (status: DeletionRequestStatus): 'gray' | 'red' | 'yellow' | 'green' | 'blue' => {
    switch (status) {
      case 'pending': return 'yellow';
      case 'approved': return 'green';
      case 'rejected': return 'red';
      default: return 'gray';
    }
  };

  // Get status icon
  const getStatusIcon = (status: DeletionRequestStatus) => {
    switch (status) {
      case 'pending': return <ClockIcon className="w-4 h-4" />;
      case 'approved': return <CheckIcon className="w-4 h-4" />;
      case 'rejected': return <XMarkIcon className="w-4 h-4" />;
      default: return <ClockIcon className="w-4 h-4" />;
    }
  };

  // Get status description
  const getStatusDescription = (status: DeletionRequestStatus, expiresAt?: string) => {
    switch (status) {
      case 'pending': {
        if (expiresAt) {
          const expiryDate = new Date(expiresAt);
          const now = new Date();
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (daysUntilExpiry <= 0) {
            return 'This request has expired and will be auto-rejected';
          } else if (daysUntilExpiry <= 2) {
            return `Your request is waiting for admin review (expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''})`;
          } else {
            return `Your request is waiting for admin review (expires in ${daysUntilExpiry} days)`;
          }
        }
        return 'Your request is waiting for admin review';
      }
      case 'approved': return 'Your request was approved and the member has been deleted';
      case 'rejected': return 'Your request was rejected by an administrator';
      default: return 'Unknown status';
    }
  };

  // Check if request is close to expiring
  const isCloseToExpiry = (expiresAt?: string) => {
    if (!expiresAt) return false;
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 2 && daysUntilExpiry > 0;
  };

  // Don't render if not a leader or if user is an admin (admins should use Admin Deletion Requests)
  if (!isLeader || isAdmin) {
    return null;
  }

  const pendingCount = myRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <UserIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Deletion Requests</h1>
            <p className="text-sm text-gray-600">
              Track the status of your member deletion requests
              {pendingCount > 0 && (
                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  {pendingCount} pending
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:gap-4 sm:items-end">
          <div className="flex-1">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by member name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-2 border border-gray-300 dark:border-dark-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors text-base sm:text-sm bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 placeholder-gray-500 dark:placeholder-dark-400 text-center search-input"
              />
            </div>
          </div>
          <div className="w-full sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | DeletionRequestStatus)}
              className="w-full px-3 py-3 sm:py-2 border border-gray-300 dark:border-dark-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors text-base sm:text-sm bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <ExclamationTriangleIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Deletion Requests</h3>
              <p className="text-gray-600">
                {searchTerm || statusFilter !== 'all'
                  ? 'No requests match your current filters.'
                  : 'You haven\'t submitted any member deletion requests yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  getStatusBadgeColor={getStatusBadgeColor}
                  getStatusIcon={getStatusIcon}
                  getStatusDescription={getStatusDescription}
                  isCloseToExpiry={isCloseToExpiry}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info Footer */}
      <div className="bg-blue-50 border-t border-blue-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start space-x-3">
            <InformationCircleIcon className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">About Deletion Requests:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Deletion requests require administrator approval before members are removed</li>
                <li>You will be notified when an admin reviews your request</li>
                <li>Typical review time is 1-2 business days</li>
                <li>Members remain active until requests are approved</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Request Card Component
interface RequestCardProps {
  request: MemberDeletionRequest;
  getStatusBadgeColor: (status: DeletionRequestStatus) => 'gray' | 'red' | 'yellow' | 'green' | 'blue';
  getStatusIcon: (status: DeletionRequestStatus) => React.ReactNode;
  getStatusDescription: (status: DeletionRequestStatus, expiresAt?: string) => string;
  isCloseToExpiry: (expiresAt?: string) => boolean;
}

const RequestCard: React.FC<RequestCardProps> = ({
  request,
  getStatusBadgeColor,
  getStatusIcon,
  getStatusDescription,
  isCloseToExpiry
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden">
      {/* Header Section with Status Badge */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <UserIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{request.memberName}</h3>
              <p className="text-sm text-gray-600">My deletion request</p>
            </div>
          </div>
          <Badge
            color={getStatusBadgeColor(request.status)}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium"
          >
            {getStatusIcon(request.status)}
            <span className="capitalize">{request.status}</span>
          </Badge>
        </div>
      </div>

      {/* Main Content Section */}
      <div className="p-6 space-y-4">
        {/* Request Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm">
              <CalendarIcon className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">Submitted:</span>
              <span className="font-medium text-gray-900">{formatISODate(request.requestedAt)}</span>
            </div>
            {request.expiresAt && (
              <div className="flex items-center space-x-2 text-sm">
                <ClockIcon className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Expires:</span>
                <span className={`font-medium ${isCloseToExpiry(request.expiresAt) ? 'text-yellow-600' : 'text-gray-900'}`}>
                  {formatISODate(request.expiresAt)}
                </span>
              </div>
            )}
          </div>

          {request.reviewedAt && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm">
                <CalendarIcon className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Reviewed:</span>
                <span className="font-medium text-gray-900">{formatISODate(request.reviewedAt)}</span>
              </div>
              {request.reviewedByName && (
                <div className="flex items-center space-x-2 text-sm">
                  <UserIcon className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Reviewed by:</span>
                  <span className="font-medium text-gray-900">{request.reviewedByName}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status Description */}
        <div className={`rounded-lg p-4 ${isCloseToExpiry(request.expiresAt) ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50 border border-gray-200'}`}>
          <div className="flex items-start space-x-2">
            <InformationCircleIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isCloseToExpiry(request.expiresAt) ? 'text-yellow-600' : 'text-gray-600'}`} />
            <div>
              <p className={`text-sm font-medium mb-1 ${isCloseToExpiry(request.expiresAt) ? 'text-yellow-800' : 'text-gray-800'}`}>
                Request Status
              </p>
              <p className={`text-sm ${isCloseToExpiry(request.expiresAt) ? 'text-yellow-700' : 'text-gray-700'}`}>
                {getStatusDescription(request.status, request.expiresAt)}
              </p>
              {isCloseToExpiry(request.expiresAt) && (
                <p className="text-xs text-yellow-600 mt-2 font-medium flex items-center space-x-1">
                  <ExclamationTriangleIcon className="w-3 h-3" />
                  <span>This request will expire soon!</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Reason Section */}
        {request.reason && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 mb-1">Deletion Reason</p>
                <p className="text-sm text-amber-700">{request.reason}</p>
              </div>
            </div>
          </div>
        )}

        {/* Admin Notes Section */}
        {request.adminNotes && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <InformationCircleIcon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800 mb-1">Admin Notes</p>
                <p className="text-sm text-blue-700">{request.adminNotes}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyDeletionRequestsView;
