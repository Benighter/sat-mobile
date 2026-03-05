import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { MemberDeletionRequest, DeletionRequestStatus } from '../../types';
import { memberDeletionRequestService } from '../../services/firebaseService';
import { hasAdminPrivileges } from '../../utils/permissionUtils';
import { formatISODate } from '../../utils/dateUtils';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import {
  UserIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  SearchIcon,
  UserGroupIcon,
  InformationCircleIcon
} from '../icons';

interface MemberDeletionRequestsViewProps {
  // No props needed for full-screen view
}

const MemberDeletionRequestsView: React.FC<MemberDeletionRequestsViewProps> = () => {
  const { userProfile, showToast, showConfirmation, approveDeletionRequestHandler, rejectDeletionRequestHandler } = useAppContext();
  const [deletionRequests, setDeletionRequests] = useState<MemberDeletionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DeletionRequestStatus>('all');
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [isClearingCompleted, setIsClearingCompleted] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);

  // Check if current user is admin
  const isAdmin = hasAdminPrivileges(userProfile);

  // Load deletion requests
  useEffect(() => {
    if (!isAdmin) return;

    const loadRequests = async () => {
      try {
        setIsLoading(true);
        const requests = await memberDeletionRequestService.getAll();
        setDeletionRequests(requests);
      } catch (error: any) {
        console.error('Error loading deletion requests:', error);
        showToast('error', 'Error', 'Failed to load deletion requests');
      } finally {
        setIsLoading(false);
      }
    };

    loadRequests();

    // Set up real-time listener
    const unsubscribe = memberDeletionRequestService.onSnapshot((requests) => {
      setDeletionRequests(requests);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isAdmin, showToast]);

  // Filter requests based on search and status
  const filteredRequests = useMemo(() => {
    return deletionRequests.filter(request => {
      const matchesSearch = searchTerm === '' || 
        request.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.requestedByName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [deletionRequests, searchTerm, statusFilter]);

  // Handle approve request
  const handleApprove = async (request: MemberDeletionRequest) => {
    if (!isAdmin) {
      showToast('error', 'Access Denied', 'Only administrators can approve deletion requests');
      return;
    }

    showConfirmation(
      'deleteMember',
      { member: { name: request.memberName } },
      async () => {
        try {
          setProcessingRequestId(request.id);
          
          await approveDeletionRequestHandler(request.id);
          
          showToast('success', 'Request Approved', 
            `Deletion request for ${request.memberName} has been approved and the member has been deleted.`);
        } catch (error: any) {
          console.error('Error approving deletion request:', error);
          showToast('error', 'Approval Failed', 
            'Failed to approve deletion request. Please try again.');
        } finally {
          setProcessingRequestId(null);
        }
      }
    );
  };

  // Handle reject request
  const handleReject = async (request: MemberDeletionRequest, adminNotes?: string) => {
    if (!isAdmin) {
      showToast('error', 'Access Denied', 'Only administrators can reject deletion requests');
      return;
    }

    try {
      setProcessingRequestId(request.id);
      
  await rejectDeletionRequestHandler(request.id, adminNotes);
      
      showToast('success', 'Request Rejected',
        `Deletion request for ${request.memberName} has been rejected.`);
    } catch (error: any) {
      console.error('Error rejecting deletion request:', error);
      showToast('error', 'Rejection Failed',
        'Failed to reject deletion request. Please try again.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  // Handle clear completed requests
  const handleClearCompleted = async () => {
    if (!isAdmin) {
      showToast('error', 'Access Denied', 'Only administrators can clear completed requests');
      return;
    }

    try {
      setIsClearingCompleted(true);
      const clearedCount = await memberDeletionRequestService.clearCompletedRequests();

      if (clearedCount > 0) {
        showToast('success', 'Completed Requests Cleared',
          `Successfully cleared ${clearedCount} completed deletion request${clearedCount !== 1 ? 's' : ''}`);

        // Refresh the deletion requests list
        const updatedRequests = await memberDeletionRequestService.getAll();
        setDeletionRequests(updatedRequests);
      } else {
        showToast('info', 'No Requests to Clear', 'There are no completed deletion requests to clear');
      }
    } catch (error: any) {
      console.error('❌ Failed to clear completed requests:', error);
      showToast('error', 'Failed to clear requests', error.message);
    } finally {
      setIsClearingCompleted(false);
      setShowClearConfirmation(false);
    }
  };

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

  // Don't render if not admin
  if (!isAdmin) {
    return null;
  }

  const pendingCount = deletionRequests.filter(r => r.status === 'pending').length;
  const completedCount = deletionRequests.filter(r => r.status === 'approved' || r.status === 'rejected').length;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header / Hero */}
      <div className="bg-white border-b border-gray-200 px-6 py-8">
        <div className="max-w-6xl mx-auto relative text-center">
          {/* Desktop: Clear Completed button in the top-right */}
          {completedCount > 0 && (
            <Button
              onClick={() => setShowClearConfirmation(true)}
              variant="secondary"
              size="sm"
              disabled={isClearingCompleted}
              className="hidden sm:inline-flex items-center gap-2 absolute right-0 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full px-4 py-2 shadow-sm hover:bg-white hover:shadow-md text-gray-700 hover:text-gray-900"
            >
              {isClearingCompleted ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  <span>Clearing...</span>
                </>
              ) : (
                <>
                  <TrashIcon className="w-4 h-4" />
                  <span>Clear Completed ({completedCount})</span>
                </>
              )}
            </Button>
          )}

          {/* Centered Hero Icon */}
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-rose-50 to-rose-100 rounded-full flex items-center justify-center shadow-md">
            <ExclamationTriangleIcon className="w-8 h-8 text-rose-600" />
          </div>
          {/* Centered Heading */}
          <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Member Deletion Requests</h1>
          <p className="mt-2 text-base text-gray-600 max-w-2xl mx-auto">Review and manage member deletion requests submitted by leaders. Use filters and search to quickly find requests.</p>

          {/* Badges and Mobile Button */}
          <div className="mt-4 flex items-center justify-center gap-3">
            {pendingCount > 0 && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-800 text-sm font-medium">
                <span className="font-semibold mr-2">{pendingCount}</span>
                pending
              </span>
            )}
            {completedCount > 0 && (
              <Button
                onClick={() => setShowClearConfirmation(true)}
                variant="secondary"
                size="sm"
                disabled={isClearingCompleted}
                className="sm:hidden inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full px-4 py-2 shadow-sm hover:bg-white hover:shadow-md text-gray-700 hover:text-gray-900"
              >
                {isClearingCompleted ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                    <span>Clearing...</span>
                  </>
                ) : (
                  <>
                    <TrashIcon className="w-4 h-4" />
                    <span>Clear Completed ({completedCount})</span>
                  </>
                )}
              </Button>
            )}
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
                placeholder="Search by member name or requester..."
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
        <div className="max-w-6xl mx-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading deletion requests...</p>
              </div>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <UserGroupIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Deletion Requests</h3>
              <p className="text-gray-600">
                {searchTerm || statusFilter !== 'all'
                  ? 'No requests match your current filters.'
                  : 'There are no member deletion requests at this time.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  onApprove={() => handleApprove(request)}
                  onReject={(notes) => handleReject(request, notes)}
                  isProcessing={processingRequestId === request.id}
                  getStatusBadgeColor={getStatusBadgeColor}
                  getStatusIcon={getStatusIcon}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Clear Completed Requests Confirmation Modal */}
      {showClearConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={() => setShowClearConfirmation(false)}></div>
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <TrashIcon className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Clear Completed Requests</h3>
                <p className="text-sm text-gray-600">Permanently delete processed requests</p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-3">
                This will permanently delete all deletion request records that have been approved or rejected.
                Pending requests will not be affected.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <ExclamationTriangleIcon className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800 mb-1">Important</p>
                    <ul className="text-xs text-yellow-700 space-y-1">
                      <li>• This action cannot be undone</li>
                      <li>• Only request records will be deleted (not member data)</li>
                      <li>• {deletionRequests.filter(r => r.status === 'approved' || r.status === 'rejected').length} completed requests will be removed</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <Button
                onClick={() => setShowClearConfirmation(false)}
                variant="secondary"
                size="sm"
                className="px-4 py-2"
                disabled={isClearingCompleted}
              >
                Cancel
              </Button>
              <Button
                onClick={handleClearCompleted}
                variant="danger"
                size="sm"
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white"
                disabled={isClearingCompleted}
              >
                {isClearingCompleted ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Clearing...
                  </>
                ) : (
                  <>
                    <TrashIcon className="w-4 h-4 mr-2" />
                    Clear Completed
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Request Card Component
interface RequestCardProps {
  request: MemberDeletionRequest;
  onApprove: () => void;
  onReject: (notes?: string) => void;
  isProcessing: boolean;
  getStatusBadgeColor: (status: DeletionRequestStatus) => 'gray' | 'red' | 'yellow' | 'green' | 'blue';
  getStatusIcon: (status: DeletionRequestStatus) => React.ReactNode;
}

const RequestCard: React.FC<RequestCardProps> = ({
  request,
  onApprove,
  onReject,
  isProcessing,
  getStatusBadgeColor,
  getStatusIcon
}) => {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');

  const handleRejectSubmit = () => {
    onReject(rejectNotes);
    setShowRejectModal(false);
    setRejectNotes('');
  };

  return (
    <>
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
                <p className="text-sm text-gray-600">Member deletion request</p>
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
                <UserIcon className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Requested by:</span>
                <span className="font-medium text-gray-900">{request.requestedByName}</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <CalendarIcon className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Requested:</span>
                <span className="font-medium text-gray-900">{formatISODate(request.requestedAt)}</span>
              </div>
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

        {/* Action Buttons for Pending Requests */}
        {request.status === 'pending' && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Button
                  onClick={onApprove}
                  variant="danger"
                  size="sm"
                  disabled={isProcessing}
                  className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700"
                >
                  <CheckIcon className="w-4 h-4" />
                  <span>Approve & Delete</span>
                </Button>
                <Button
                  onClick={() => setShowRejectModal(true)}
                  variant="secondary"
                  size="sm"
                  disabled={isProcessing}
                  className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700"
                >
                  <XMarkIcon className="w-4 h-4" />
                  <span>Reject</span>
                </Button>
              </div>
              {isProcessing && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Processing...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={() => setShowRejectModal(false)}></div>
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <XMarkIcon className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Reject Deletion Request</h3>
                <p className="text-sm text-gray-600">For {request.memberName}</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason (Optional)
              </label>
              <textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Provide a reason for rejecting this deletion request..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-end space-x-3">
              <Button
                onClick={() => setShowRejectModal(false)}
                variant="secondary"
                size="sm"
                className="px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRejectSubmit}
                variant="danger"
                size="sm"
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white"
              >
                Reject Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MemberDeletionRequestsView;
