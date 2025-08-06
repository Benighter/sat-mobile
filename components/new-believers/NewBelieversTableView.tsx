import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { NewBeliever, AttendanceStatus } from '../../types';
import Table from '../ui/Table';
import { SmartTextParser } from '../../utils/smartTextParser';
import { UserIcon, EditIcon, TrashIcon, CalendarIcon, PhoneIcon, MapPinIcon } from '../icons';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Input from '../ui/Input';
import AttendanceMarker from '../attendance/AttendanceMarker';
import NewBelieverDetailModal from './NewBelieverDetailModal';
import { formatDisplayDate, formatDateToDisplay } from '../../utils/dateUtils';

const NewBelieversTableView: React.FC = () => {
  const {
    newBelievers,
    attendanceRecords,
    openNewBelieverForm,
    deleteNewBelieverHandler,
    markNewBelieverAttendanceHandler,
    isLoading,
    displayedSundays,
    showConfirmation,
    showToast
  } = useAppContext();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMinistry, setSelectedMinistry] = useState('');
  const [showFirstTimeOnly, setShowFirstTimeOnly] = useState(false);
  const [selectedNewBeliever, setSelectedNewBeliever] = useState<NewBeliever | null>(null);

  const handleContactClick = async (contact: string) => {
    await SmartTextParser.copyPhoneToClipboard(contact, showToast);
  };

  // Get unique ministries for filter dropdown
  const uniqueMinistries = useMemo(() => {
    const ministries = newBelievers
      .map(nb => nb.ministry)
      .filter(ministry => ministry && ministry.trim() !== '');
    return [...new Set(ministries)].sort();
  }, [newBelievers]);

  // Filter new believers
  const filteredNewBelievers = useMemo(() => {
    return newBelievers
      .filter(nb => {
        const matchesSearch = searchTerm === '' || 
          nb.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          nb.surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
          nb.contact.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesMinistry = selectedMinistry === '' || nb.ministry === selectedMinistry;
        const matchesFirstTime = !showFirstTimeOnly || nb.isFirstTime;
        
        return matchesSearch && matchesMinistry && matchesFirstTime;
      })
      .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
  }, [newBelievers, searchTerm, selectedMinistry, showFirstTimeOnly]);

  // Get attendance status for a new believer on a specific date
  const getAttendanceStatus = (newBelieverId: string, date: string): AttendanceStatus | undefined => {
    const record = attendanceRecords.find(ar => ar.newBelieverId === newBelieverId && ar.date === date);
    return record?.status;
  };

  // Get attendance rate for a new believer
  const getAttendanceRate = (newBelieverId: string) => {
    if (displayedSundays.length === 0) return 0;
    const presentCount = displayedSundays.filter(date => 
      getAttendanceStatus(newBelieverId, date) === 'Present'
    ).length;
    return Math.round((presentCount / displayedSundays.length) * 100);
  };

  // Get display name
  const getDisplayName = (newBeliever: NewBeliever) => {
    return `${newBeliever.name}${newBeliever.surname ? ` ${newBeliever.surname}` : ''}`;
  };

  // Define table columns
  const columns = [
    {
      key: 'name',
      header: 'New Believer',
      width: '25%',
      render: (newBeliever: NewBeliever) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-lg">
              {getDisplayName(newBeliever)}
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              {newBeliever.isFirstTime && (
                <Badge variant="success" size="sm">First Time</Badge>
              )}
              {newBeliever.ministry && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  {newBeliever.ministry}
                </span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact Info',
      width: '20%',
      render: (newBeliever: NewBeliever) => (
        <div className="space-y-1">
          {newBeliever.contact && (
            <div
              className="flex items-center text-sm text-gray-600 cursor-pointer hover:bg-blue-50 rounded px-1 py-1 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleContactClick(newBeliever.contact);
              }}
            >
              <PhoneIcon className="w-3 h-3 mr-1 text-gray-400" />
              {newBeliever.contact}
            </div>
          )}
          {newBeliever.residence && (
            <div className="flex items-center text-sm text-gray-600">
              <MapPinIcon className="w-3 h-3 mr-1 text-gray-400" />
              {newBeliever.residence}
            </div>
          )}
        </div>
      ),
    },

    // Attendance columns for each Sunday
    ...displayedSundays.map(date => ({
      key: `attendance_${date}`,
      header: formatDisplayDate(date),
      width: `${Math.max(8, 40 / displayedSundays.length)}%`,
      align: 'center' as const,
      render: (newBeliever: NewBeliever) => {
        const status = getAttendanceStatus(newBeliever.id, date);
        return (
          <div className="flex justify-center">
            <AttendanceMarker
              memberId={newBeliever.id}
              date={date}
              currentStatus={status}
              onMarkAttendance={(id, date, status) => markNewBelieverAttendanceHandler(id, date, status)}
            />
          </div>
        );
      },
    })),
    {
      key: 'attendanceRate',
      header: 'Attendance',
      width: '10%',
      align: 'center' as const,
      render: (newBeliever: NewBeliever) => {
        const rate = getAttendanceRate(newBeliever.id);
        return (
          <div className="flex flex-col items-center">
            <span className="font-semibold text-lg">{rate}%</span>
            <Badge 
              variant={rate >= 80 ? 'success' : rate >= 60 ? 'warning' : 'danger'} 
              size="sm"
              className="mt-1"
            >
              {rate >= 80 ? 'Excellent' : rate >= 60 ? 'Good' : 'Poor'}
            </Badge>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '10%',
      align: 'center' as const,
      render: (newBeliever: NewBeliever) => (
        <div className="flex items-center justify-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openNewBelieverForm(newBeliever);
            }}
            className="p-2 hover:bg-blue-100"
            title="Edit New Believer"
          >
            <EditIcon className="w-4 h-4 text-blue-600" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              showConfirmation(
                'deleteNewBeliever',
                newBeliever,
                () => deleteNewBelieverHandler(newBeliever.id)
              );
            }}
            className="p-2 hover:bg-red-100"
            title="Delete New Believer"
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
      {/* Header with current month and filters */}
      <div className="glass p-4 rounded-2xl shadow-lg">
        <div className="flex flex-col space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <UserIcon className="w-5 h-5 mr-2 text-green-600" />
              New Believers Table - {currentMonthName}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Attendance tracking for {displayedSundays.length} Sunday{displayedSundays.length !== 1 ? 's' : ''} this month
            </p>
          </div>
          
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 items-end">
            <input
              type="text"
              placeholder="Search new believers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-3 sm:py-2 border-0 bg-white/50 focus:bg-white/80 rounded-lg transition-colors text-base sm:text-sm placeholder-gray-500"
            />
            <select
              value={selectedMinistry}
              onChange={(e) => setSelectedMinistry(e.target.value)}
              className="w-full px-3 py-3 sm:py-2 border-0 bg-white/50 focus:bg-white/80 rounded-lg transition-colors text-base sm:text-sm"
            >
              <option value="">All Ministries</option>
              {uniqueMinistries.map(ministry => (
                <option key={ministry} value={ministry}>{ministry}</option>
              ))}
            </select>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showFirstTimeOnly}
                onChange={(e) => setShowFirstTimeOnly(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">First time only</span>
            </label>
          </div>
        </div>
      </div>

      {/* New Believers Table */}
      <Table
        data={filteredNewBelievers}
        columns={columns}
        loading={isLoading}
        emptyMessage={
          searchTerm || selectedMinistry || showFirstTimeOnly
            ? "No new believers match your filters" 
            : "No new believers registered yet"
        }
        onRowClick={(newBeliever) => setSelectedNewBeliever(newBeliever)}
      />

      {/* Summary */}
      {filteredNewBelievers.length > 0 && (
        <div className="glass p-4 rounded-2xl shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-gray-900">Total New Believers</div>
              <div className="text-2xl font-bold text-green-600">{filteredNewBelievers.length}</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">First Time Visitors</div>
              <div className="text-2xl font-bold text-blue-600">
                {filteredNewBelievers.filter(nb => nb.isFirstTime).length}
              </div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">Avg Attendance</div>
              <div className="text-2xl font-bold text-purple-600">
                {filteredNewBelievers.length > 0 
                  ? Math.round(filteredNewBelievers.reduce((sum, nb) => sum + getAttendanceRate(nb.id), 0) / filteredNewBelievers.length)
                  : 0}%
              </div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">With Ministry</div>
              <div className="text-2xl font-bold text-orange-600">
                {filteredNewBelievers.filter(nb => nb.ministry && nb.ministry.trim() !== '').length}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <NewBelieverDetailModal
        isOpen={selectedNewBeliever !== null}
        onClose={() => setSelectedNewBeliever(null)}
        newBeliever={selectedNewBeliever}
      />
    </div>
  );
};

export default NewBelieversTableView;
