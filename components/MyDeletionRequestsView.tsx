import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { MemberDeletionRequest, DeletionRequestStatus } from '../types';
import { hasLeaderPrivileges, hasAdminPrivileges } from '../utils/permissionUtils';
import { formatISODate } from '../utils/dateUtils';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Input from './ui/Input';
import {
  UserIcon,
  ClockIcon,
  CheckIcon,
  XMarkIcon,
  CalendarIcon,
  SearchIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from './icons';

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

  // Get status badge variant
  const getStatusBadgeVariant = (status: DeletionRequestStatus) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
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
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by member name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | DeletionRequestStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  getStatusBadgeVariant={getStatusBadgeVariant}
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
  getStatusBadgeVariant: (status: DeletionRequestStatus) => string;
  getStatusIcon: (status: DeletionRequestStatus) => React.ReactNode;
  getStatusDescription: (status: DeletionRequestStatus, expiresAt?: string) => string;
  isCloseToExpiry: (expiresAt?: string) => boolean;
}

const RequestCard: React.FC<RequestCardProps> = ({
  request,
  getStatusBadgeVariant,
  getStatusIcon,
  getStatusDescription,
  isCloseToExpiry
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <UserIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{request.memberName}</h3>
            <p className="text-sm text-gray-600">Deletion request</p>
            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <CalendarIcon className="w-4 h-4" />
                <span>Submitted: {formatISODate(request.requestedAt)}</span>
              </div>
              {request.reviewedAt && (
                <div className="flex items-center space-x-1">
                  <CalendarIcon className="w-4 h-4" />
                  <span>Reviewed: {formatISODate(request.reviewedAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant={getStatusBadgeVariant(request.status)} className="flex items-center space-x-1">
            {getStatusIcon(request.status)}
            <span className="capitalize">{request.status}</span>
          </Badge>
        </div>
      </div>

      <div className={`mb-4 p-3 rounded-lg ${isCloseToExpiry(request.expiresAt) ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
        <p className={`text-sm ${isCloseToExpiry(request.expiresAt) ? 'text-yellow-700' : 'text-gray-700'}`}>
          <span className="font-medium">Status:</span> {getStatusDescription(request.status, request.expiresAt)}
        </p>
        {isCloseToExpiry(request.expiresAt) && (
          <p className="text-xs text-yellow-600 mt-1 font-medium">
            ⚠️ This request will expire soon!
          </p>
        )}
      </div>

      {request.reason && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            <span className="font-medium">Reason:</span> {request.reason}
          </p>
        </div>
      )}

      {request.adminNotes && (
        <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
          <p className="text-sm text-yellow-700">
            <span className="font-medium">Admin Notes:</span> {request.adminNotes}
          </p>
        </div>
      )}

      {request.reviewedByName && (
        <div className="text-sm text-gray-600">
          Reviewed by: <span className="font-medium">{request.reviewedByName}</span>
        </div>
      )}
    </div>
  );
};

export default MyDeletionRequestsView;
