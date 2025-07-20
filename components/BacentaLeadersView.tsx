import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { Member } from '../types';
import Table from './ui/Table';
import { UserIcon, EditIcon, TrashIcon, UsersIcon, CalendarIcon, TrendingUpIcon, PhoneIcon, MapPinIcon } from './icons';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Input from './ui/Input';
import { formatDisplayDate } from '../utils/dateUtils';

const BacentaLeadersView: React.FC = () => {
  const {
    members,
    bacentas,
    attendanceRecords,
    openMemberForm,
    deleteMemberHandler,
    isLoading,
    displayedSundays,
    openHierarchyModal,
    showConfirmation
  } = useAppContext();
  
  const [searchTerm, setSearchTerm] = useState('');

  // Filter to show only Bacenta Leaders
  const bacentaLeaders = useMemo(() => {
    return members
      .filter(member => member.role === 'Bacenta Leader')
      .filter(member => {
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          return (
            member.firstName.toLowerCase().includes(searchLower) ||
            member.lastName.toLowerCase().includes(searchLower) ||
            member.phoneNumber.toLowerCase().includes(searchLower)
          );
        }
        return true;
      })
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  }, [members, searchTerm]);

  // Get current month info
  const currentDate = new Date();
  const currentMonthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const currentMonthSundays = displayedSundays;

  // Helper functions
  const getBacentaName = (bacentaId: string) => {
    if (!bacentaId) return 'Unassigned';
    const bacenta = bacentas.find(b => b.id === bacentaId);
    return bacenta?.name || 'Unknown';
  };

  const getFellowshipLeadersCount = (bacentaLeaderId: string) => {
    return members.filter(m => m.role === 'Fellowship Leader' && m.bacentaLeaderId === bacentaLeaderId).length;
  };

  const getTotalMembersUnderLeader = (bacentaLeaderId: string) => {
    // Count fellowship leaders + regular members under this bacenta leader
    return members.filter(m => 
      (m.role === 'Fellowship Leader' && m.bacentaLeaderId === bacentaLeaderId) ||
      (m.role === 'Member' && m.bacentaId === members.find(bl => bl.id === bacentaLeaderId)?.bacentaId)
    ).length;
  };

  const getAttendanceRate = (memberId: string) => {
    if (currentMonthSundays.length === 0) return 0;
    
    const memberAttendance = attendanceRecords.filter(record =>
      record.memberId === memberId &&
      currentMonthSundays.includes(record.date) &&
      record.status === 'Present'
    ).length;

    return Math.round((memberAttendance / currentMonthSundays.length) * 100);
  };

  // Define table columns
  const columns = [
    {
      key: 'name',
      header: 'Bacenta Leader',
      width: '25%',
      render: (leader: Member) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-lg">
              {leader.firstName} {leader.lastName}
            </div>
            <div className="flex items-center space-x-1">
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center">
                <span className="mr-1">💚</span>
                Bacenta Leader
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact Info',
      width: '20%',
      render: (leader: Member) => (
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-sm">
            <PhoneIcon className="w-4 h-4 text-blue-500" />
            <span className="text-gray-700">{leader.phoneNumber || 'No phone'}</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <MapPinIcon className="w-4 h-4 text-red-500" />
            <span className="text-gray-600 truncate">{leader.buildingAddress || 'No address'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'bacenta',
      header: 'Bacenta',
      width: '15%',
      render: (leader: Member) => (
        <div className="text-center">
          <div className="font-medium text-gray-900">{getBacentaName(leader.bacentaId)}</div>
          <div className="text-xs text-gray-500 mt-1">
            {leader.joinedDate ? formatDisplayDate(leader.joinedDate) : 'Unknown date'}
          </div>
        </div>
      ),
    },
    {
      key: 'hierarchy',
      header: 'Leadership',
      width: '15%',
      align: 'center' as const,
      render: (leader: Member) => {
        const fellowshipLeaders = getFellowshipLeadersCount(leader.id);
        const totalMembers = getTotalMembersUnderLeader(leader.id);
        return (
          <div className="flex flex-col items-center">
            <div className="flex items-center space-x-2">
              <UsersIcon className="w-4 h-4 text-purple-500" />
              <span className="font-semibold text-lg">{fellowshipLeaders}</span>
            </div>
            <div className="text-xs text-gray-500">Fellowship Leaders</div>
            <div className="text-xs text-gray-600 mt-1">
              {totalMembers} total under leadership
            </div>
          </div>
        );
      },
    },
    {
      key: 'attendance',
      header: 'Attendance',
      width: '10%',
      align: 'center' as const,
      render: (leader: Member) => {
        const rate = getAttendanceRate(leader.id);
        return (
          <div className="flex flex-col items-center">
            <div className="flex items-center space-x-2">
              <TrendingUpIcon className="w-4 h-4 text-green-500" />
              <span className="font-semibold text-lg">{rate}%</span>
            </div>
            <Badge 
              variant={rate >= 80 ? 'success' : rate >= 60 ? 'warning' : 'danger'} 
              size="sm"
              className="mt-1"
            >
              {rate >= 80 ? 'Excellent' : rate >= 60 ? 'Good' : 'Needs Attention'}
            </Badge>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '15%',
      align: 'center' as const,
      render: (leader: Member) => (
        <div className="flex items-center justify-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openHierarchyModal(leader);
            }}
            className="p-2 hover:bg-purple-100"
            title="View Hierarchy"
          >
            <UsersIcon className="w-4 h-4 text-purple-600" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openMemberForm(leader);
            }}
            className="p-2 hover:bg-blue-100"
            title="Edit Leader"
          >
            <EditIcon className="w-4 h-4 text-blue-600" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              showConfirmation(
                'deleteMember',
                { member: leader },
                () => deleteMemberHandler(leader.id)
              );
            }}
            className="p-2 hover:bg-red-100"
            title="Delete Leader"
          >
            <TrashIcon className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with current month and search */}
      <div className="glass p-4 rounded-2xl shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <UserIcon className="w-5 h-5 mr-2 text-green-600" />
              Bacenta Leaders - {currentMonthName}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Leadership overview and hierarchy management
            </p>
          </div>
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search leaders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-0 bg-white/50 focus:bg-white/80 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Bacenta Leaders Table */}
      <Table
        data={bacentaLeaders}
        columns={columns}
        loading={isLoading}
        emptyMessage={
          searchTerm 
            ? "No bacenta leaders match your search" 
            : "No bacenta leaders assigned yet"
        }
        onRowClick={(leader) => openMemberForm(leader)}
      />

      {/* Summary */}
      {bacentaLeaders.length > 0 && (
        <div className="glass p-4 rounded-2xl shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-gray-900">Total Leaders</div>
              <div className="text-2xl font-bold text-green-600">{bacentaLeaders.length}</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">Fellowship Leaders</div>
              <div className="text-2xl font-bold text-purple-600">
                {bacentaLeaders.reduce((sum, leader) => sum + getFellowshipLeadersCount(leader.id), 0)}
              </div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">Total Under Leadership</div>
              <div className="text-2xl font-bold text-blue-600">
                {bacentaLeaders.reduce((sum, leader) => sum + getTotalMembersUnderLeader(leader.id), 0)}
              </div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">Avg Attendance</div>
              <div className="text-2xl font-bold text-orange-600">
                {bacentaLeaders.length > 0 
                  ? Math.round(bacentaLeaders.reduce((sum, leader) => sum + getAttendanceRate(leader.id), 0) / bacentaLeaders.length)
                  : 0}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BacentaLeadersView;
