import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { MemberDeletionRequest, DeletionRequestStatus } from '../types';
import { memberDeletionRequestService } from '../services/firebaseService';
import { hasAdminPrivileges } from '../utils/permissionUtils';
import { formatISODate } from '../utils/dateUtils';
import Button from './ui/Button';
import Input from './ui/Input';
import Badge from './ui/Badge';
import {
  UserIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  SearchIcon,
  CalendarIcon,
  UserGroupIcon
} from './icons';

interface MemberDeletionRequestsViewProps {
  // No props needed for full-screen view
}

const MemberDeletionRequestsView: React.FC<MemberDeletionRequestsViewProps> = () => {
  const { userProfile, showToast, deleteMemberHandler, showConfirmation } = useAppContext();
  const [deletionRequests, setDeletionRequests] = useState<MemberDeletionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DeletionRequestStatus>('all');
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

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
          
          // First update the request status
          await memberDeletionRequestService.update(request.id, {
            status: 'approved',
            reviewedBy: userProfile?.uid || '',
            reviewedByName: `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim(),
            reviewedAt: new Date().toISOString()
          });

          // Then delete the actual member
          await deleteMemberHandler(request.memberId);
          
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
      
      await memberDeletionRequestService.update(request.id, {
        status: 'rejected',
        reviewedBy: userProfile?.uid || '',
        reviewedByName: `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim(),
        reviewedAt: new Date().toISOString(),
        adminNotes: adminNotes || 'Request rejected by administrator'
      });
      
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

  // Don't render if not admin
  if (!isAdmin) {
    return null;
  }

  const pendingCount = deletionRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Member Deletion Requests</h1>
            <p className="text-sm text-gray-600">
              Review and manage member deletion requests from leaders
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
                placeholder="Search by member name or requester..."
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
                  getStatusBadgeVariant={getStatusBadgeVariant}
                  getStatusIcon={getStatusIcon}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Request Card Component
interface RequestCardProps {
  request: MemberDeletionRequest;
  onApprove: () => void;
  onReject: (notes?: string) => void;
  isProcessing: boolean;
  getStatusBadgeVariant: (status: DeletionRequestStatus) => string;
  getStatusIcon: (status: DeletionRequestStatus) => React.ReactNode;
}

const RequestCard: React.FC<RequestCardProps> = ({
  request,
  onApprove,
  onReject,
  isProcessing,
  getStatusBadgeVariant,
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
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <UserIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{request.memberName}</h3>
              <p className="text-sm text-gray-600">
                Requested by: <span className="font-medium">{request.requestedByName}</span>
              </p>
              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <CalendarIcon className="w-4 h-4" />
                  <span>Requested: {formatISODate(request.requestedAt)}</span>
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

        {request.reason && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">
              <span className="font-medium">Reason:</span> {request.reason}
            </p>
          </div>
        )}

        {request.adminNotes && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <span className="font-medium">Admin Notes:</span> {request.adminNotes}
            </p>
          </div>
        )}

        {request.reviewedByName && (
          <div className="mb-4 text-sm text-gray-600">
            Reviewed by: <span className="font-medium">{request.reviewedByName}</span>
          </div>
        )}

        {request.status === 'pending' && (
          <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
            <Button
              onClick={onApprove}
              variant="danger"
              size="sm"
              disabled={isProcessing}
              className="flex items-center space-x-2"
            >
              <CheckIcon className="w-4 h-4" />
              <span>Approve & Delete</span>
            </Button>
            <Button
              onClick={() => setShowRejectModal(true)}
              variant="secondary"
              size="sm"
              disabled={isProcessing}
              className="flex items-center space-x-2"
            >
              <XMarkIcon className="w-4 h-4" />
              <span>Reject</span>
            </Button>
            {isProcessing && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Processing...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowRejectModal(false)}></div>
          <div className="relative bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Deletion Request</h3>
            <p className="text-sm text-gray-600 mb-4">
              Provide a reason for rejecting the deletion request for {request.memberName}:
            </p>
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Enter rejection reason (optional)..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
            />
            <div className="flex items-center space-x-3 mt-4">
              <Button onClick={handleRejectSubmit} variant="danger" size="sm">
                Reject Request
              </Button>
              <Button onClick={() => setShowRejectModal(false)} variant="secondary" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MemberDeletionRequestsView;
