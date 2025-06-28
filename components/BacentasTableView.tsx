import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { Bacenta } from '../types';
import Table from './ui/Table';
import { GroupIcon, EditIcon, TrashIcon, UsersIcon, CalendarIcon, TrendingUpIcon } from './icons';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Input from './ui/Input';
import { formatDisplayDate } from '../utils/dateUtils';

const BacentasTableView: React.FC = () => {
  const {
    bacentas,
    members,
    attendanceRecords,
    openBacentaForm,
    deleteBacentaHandler,
    showConfirmation,
    isLoading,
    switchTab,
    displayedSundays
  } = useAppContext();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    bacenta: Bacenta | null;
    position: { x: number; y: number };
  }>({
    isOpen: false,
    bacenta: null,
    position: { x: 0, y: 0 }
  });

  // Filter bacentas by search term
  const filteredBacentas = useMemo(() => {
    return bacentas
      .filter(bacenta => {
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          return bacenta.name.toLowerCase().includes(searchLower);
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [bacentas, searchTerm]);

  // Handle long press for context menu
  const handleLongPress = (bacenta: Bacenta, event: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'clientX' in event ? event.clientX : event.touches[0].clientX;
    const clientY = 'clientY' in event ? event.clientY : event.touches[0].clientY;

    setContextMenu({
      isOpen: true,
      bacenta,
      position: {
        x: Math.min(clientX, window.innerWidth - 200),
        y: Math.min(clientY, window.innerHeight - 120)
      }
    });
  };

  const closeContextMenu = () => {
    setContextMenu({
      isOpen: false,
      bacenta: null,
      position: { x: 0, y: 0 }
    });
  };

  const handleEditBacenta = () => {
    if (contextMenu.bacenta) {
      openBacentaForm(contextMenu.bacenta);
      closeContextMenu();
    }
  };

  const handleDeleteBacenta = () => {
    if (contextMenu.bacenta) {
      const memberCount = members.filter(m => m.bacentaId === contextMenu.bacenta!.id).length;

      showConfirmation('deleteBacenta', {
        bacenta: contextMenu.bacenta,
        memberCount
      }, () => {
        deleteBacentaHandler(contextMenu.bacenta!.id);
      });

      closeContextMenu();
    }
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.isOpen) {
        closeContextMenu();
      }
    };

    if (contextMenu.isOpen) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [contextMenu.isOpen]);

  // Get member count for a bacenta
  const getMemberCount = (bacentaId: string) => {
    return members.filter(member => member.bacentaId === bacentaId).length;
  };

  // Get current month's Sundays automatically
  const currentMonthSundays = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const sundays = [];
    const date = new Date(year, month, 1);

    // Find first Sunday of the month
    while (date.getDay() !== 0) {
      date.setDate(date.getDate() + 1);
    }

    // Collect all Sundays in the month
    while (date.getMonth() === month) {
      sundays.push(date.toISOString().split('T')[0]);
      date.setDate(date.getDate() + 7);
    }

    return sundays;
  }, []);

  // Get attendance rate for a bacenta (current month)
  const getAttendanceRate = (bacentaId: string) => {
    const bacentaMembers = members.filter(member => member.bacentaId === bacentaId);
    if (bacentaMembers.length === 0 || currentMonthSundays.length === 0) return 0;

    const totalPossibleAttendance = bacentaMembers.length * currentMonthSundays.length;
    const actualAttendance = attendanceRecords.filter(record =>
      bacentaMembers.some(member => member.id === record.memberId) &&
      currentMonthSundays.includes(record.date) &&
      record.status === 'Present'
    ).length;

    return totalPossibleAttendance > 0 ? Math.round((actualAttendance / totalPossibleAttendance) * 100) : 0;
  };

  // Get recent activity (members joined in last 30 days)
  const getRecentActivity = (bacentaId: string) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return members.filter(member => 
      member.bacentaId === bacentaId && 
      new Date(member.createdDate) >= thirtyDaysAgo
    ).length;
  };

  // Define table columns
  const columns = [
    {
      key: 'name',
      header: 'Bacenta Name',
      width: '30%',
      render: (bacenta: Bacenta) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center">
            <GroupIcon className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-lg">
              {bacenta.name}
            </div>
            <div className="text-sm text-gray-500">
              ID: {bacenta.id.slice(0, 8)}...
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'memberCount',
      header: 'Members',
      width: '15%',
      align: 'center' as const,
      render: (bacenta: Bacenta) => {
        const count = getMemberCount(bacenta.id);
        return (
          <div className="flex flex-col items-center">
            <div className="flex items-center space-x-2">
              <UsersIcon className="w-4 h-4 text-blue-500" />
              <span className="font-semibold text-lg">{count}</span>
            </div>
            <Badge 
              variant={count > 10 ? 'success' : count > 5 ? 'warning' : 'secondary'} 
              size="sm"
              className="mt-1"
            >
              {count > 10 ? 'Large' : count > 5 ? 'Medium' : 'Small'}
            </Badge>
          </div>
        );
      },
    },
    {
      key: 'attendanceRate',
      header: 'Attendance Rate',
      width: '15%',
      align: 'center' as const,
      render: (bacenta: Bacenta) => {
        const rate = getAttendanceRate(bacenta.id);
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
      key: 'recentActivity',
      header: 'Recent Activity',
      width: '15%',
      align: 'center' as const,
      render: (bacenta: Bacenta) => {
        const activity = getRecentActivity(bacenta.id);
        return (
          <div className="flex flex-col items-center">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="w-4 h-4 text-orange-500" />
              <span className="font-semibold text-lg">{activity}</span>
            </div>
            <span className="text-xs text-gray-500 mt-1">
              New members (30d)
            </span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: '15%',
      align: 'center' as const,
      render: (bacenta: Bacenta) => {
        const memberCount = getMemberCount(bacenta.id);
        const attendanceRate = getAttendanceRate(bacenta.id);
        
        let status = 'Active';
        let variant: 'success' | 'warning' | 'danger' = 'success';
        
        if (memberCount === 0) {
          status = 'Empty';
          variant = 'danger';
        } else if (attendanceRate < 50) {
          status = 'Low Activity';
          variant = 'warning';
        }
        
        return (
          <Badge variant={variant} size="sm">
            {status}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '10%',
      align: 'center' as const,
      render: (bacenta: Bacenta) => (
        <div className="flex items-center justify-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openBacentaForm(bacenta);
            }}
            className="p-2 hover:bg-blue-100"
            title="Edit Bacenta"
          >
            <EditIcon className="w-4 h-4 text-blue-600" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              deleteBacentaHandler(bacenta.id);
            }}
            className="p-2 hover:bg-red-100"
            title="Delete Bacenta"
          >
            <TrashIcon className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      ),
    },
  ];

  // Get current month name
  const currentDate = new Date();
  const currentMonthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header with current month and search */}
      <div className="glass p-4 rounded-2xl shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <GroupIcon className="w-5 h-5 mr-2 text-purple-600" />
              Bacentas Overview - {currentMonthName}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Attendance data for {currentMonthSundays.length} Sunday{currentMonthSundays.length !== 1 ? 's' : ''} this month
            </p>
          </div>
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search bacentas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-0 bg-white/50 focus:bg-white/80 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Bacentas Table */}
      <Table
        data={filteredBacentas}
        columns={columns}
        loading={isLoading}
        emptyMessage={
          searchTerm 
            ? "No bacentas match your search" 
            : "No bacentas created yet"
        }
        onRowClick={(bacenta) => switchTab({ id: bacenta.id, name: bacenta.name })}
        onRowLongPress={handleLongPress}
      />

      {/* Summary */}
      {filteredBacentas.length > 0 && (
        <div className="glass p-4 rounded-2xl shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-gray-900">Total Bacentas</div>
              <div className="text-2xl font-bold text-blue-600">{filteredBacentas.length}</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">Total Members</div>
              <div className="text-2xl font-bold text-green-600">
                {filteredBacentas.reduce((sum, bacenta) => sum + getMemberCount(bacenta.id), 0)}
              </div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">Avg Attendance</div>
              <div className="text-2xl font-bold text-purple-600">
                {filteredBacentas.length > 0 
                  ? Math.round(filteredBacentas.reduce((sum, bacenta) => sum + getAttendanceRate(bacenta.id), 0) / filteredBacentas.length)
                  : 0}%
              </div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">Active Bacentas</div>
              <div className="text-2xl font-bold text-orange-600">
                {filteredBacentas.filter(bacenta => getMemberCount(bacenta.id) > 0).length}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.isOpen && contextMenu.bacenta && (
        <div
          className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 min-w-[160px]"
          style={{
            left: contextMenu.position.x,
            top: contextMenu.position.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleEditBacenta}
            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-3"
          >
            <EditIcon className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Edit Bacenta</span>
          </button>
          <button
            onClick={handleDeleteBacenta}
            className="w-full px-4 py-3 text-left hover:bg-red-50 transition-colors duration-200 flex items-center space-x-3"
          >
            <TrashIcon className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-700">Delete Bacenta</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default BacentasTableView;
