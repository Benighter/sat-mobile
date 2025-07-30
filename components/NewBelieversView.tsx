import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { NewBeliever } from '../types';
import { formatDateToDisplay } from '../utils/dateUtils';
import { SmartTextParser } from '../utils/smartTextParser';
import { PlusIcon, EditIcon, TrashIcon, UserIcon, CalendarIcon, PhoneIcon, MapPinIcon, GridIcon, TableIcon } from './icons';
import Button from './ui/Button';
import NewBelieverFormModal from './NewBelieverFormModal';
import BulkNewBelieverAddModal from './BulkNewBelieverAddModal';
import NewBelieversTableView from './NewBelieversTableView';

const NewBelieversView: React.FC = () => {
  const {
    newBelievers,
    openNewBelieverForm,
    isNewBelieverFormOpen,
    editingNewBeliever,
    closeNewBelieverForm,
    deleteNewBelieverHandler,
    showConfirmation,
    showToast
  } = useAppContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMinistry, setSelectedMinistry] = useState('');
  const [showFirstTimeOnly, setShowFirstTimeOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

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

  // Filter new believers based on search and filters
  const filteredNewBelievers = useMemo(() => {
    return newBelievers.filter(nb => {
      const matchesSearch = searchTerm === '' || 
        nb.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        nb.surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        nb.contact.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesMinistry = selectedMinistry === '' || nb.ministry === selectedMinistry;
      const matchesFirstTime = !showFirstTimeOnly || nb.isFirstTime;
      
      return matchesSearch && matchesMinistry && matchesFirstTime;
    });
  }, [newBelievers, searchTerm, selectedMinistry, showFirstTimeOnly]);

  // Sort by joined date (newest first)
  const sortedNewBelievers = useMemo(() => {
    return [...filteredNewBelievers].sort((a, b) => 
      new Date(b.joinedDate).getTime() - new Date(a.joinedDate).getTime()
    );
  }, [filteredNewBelievers]);

  const handleEdit = (newBeliever: NewBeliever) => {
    openNewBelieverForm(newBeliever);
  };

  const handleDelete = (newBeliever: NewBeliever) => {
    showConfirmation(
      'deleteNewBeliever',
      newBeliever,
      () => deleteNewBelieverHandler(newBeliever.id)
    );
  };

  const getDisplayName = (newBeliever: NewBeliever) => {
    return `${newBeliever.name}${newBeliever.surname ? ` ${newBeliever.surname}` : ''}`;
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Believers</h1>
          <p className="text-gray-600 mt-1">
            {newBelievers.length} new believer{newBelievers.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Card View"
            >
              <GridIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
          
          {/* Add Buttons */}
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setIsBulkModalOpen(true)}
              variant="secondary"
              leftIcon={<PlusIcon className="w-4 h-4" />}
              size="sm"
            >
              Bulk Add
            </Button>
            <Button
              onClick={() => openNewBelieverForm(undefined)}
              variant="primary"
              leftIcon={<PlusIcon className="w-5 h-5" />}
            >
              Add New Believer
            </Button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              id="search"
              type="text"
              placeholder="Search by name or contact..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Ministry Filter */}
          <div>
            <label htmlFor="ministry-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Ministry
            </label>
            <select
              id="ministry-filter"
              value={selectedMinistry}
              onChange={(e) => setSelectedMinistry(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Ministries</option>
              {uniqueMinistries.map(ministry => (
                <option key={ministry} value={ministry}>{ministry}</option>
              ))}
            </select>
          </div>

          {/* First Time Filter */}
          <div className="flex items-end">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showFirstTimeOnly}
                onChange={(e) => setShowFirstTimeOnly(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">First time visitors only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Content - Cards or Table View */}
      {viewMode === 'table' ? (
        <NewBelieversTableView />
      ) : sortedNewBelievers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <UserIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {newBelievers.length === 0 ? 'No New Believers Yet' : 'No Results Found'}
          </h3>
          <p className="text-gray-600 mb-4">
            {newBelievers.length === 0 
              ? 'Start by adding your first new believer to track their journey.'
              : 'Try adjusting your search or filter criteria.'
            }
          </p>
          {newBelievers.length === 0 && (
            <Button
              onClick={() => openNewBelieverForm(undefined)}
              variant="primary"
              leftIcon={<PlusIcon className="w-5 h-5" />}
            >
              Add First New Believer
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedNewBelievers.map(newBeliever => (
            <div key={newBeliever.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              {/* Header with name and actions */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {getDisplayName(newBeliever)}
                  </h3>
                  {newBeliever.isFirstTime && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      First Time
                    </span>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(newBeliever)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <EditIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(newBeliever)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-2 mb-4">
                {newBeliever.contact && (
                  <div
                    className="flex items-center text-sm text-gray-600 cursor-pointer hover:bg-blue-50 rounded px-1 py-1 transition-colors"
                    onClick={() => handleContactClick(newBeliever.contact)}
                  >
                    <PhoneIcon className="w-4 h-4 mr-2 text-gray-400" />
                    {newBeliever.contact}
                  </div>
                )}
                {newBeliever.residence && (
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPinIcon className="w-4 h-4 mr-2 text-gray-400" />
                    {newBeliever.residence}
                  </div>
                )}
                <div className="flex items-center text-sm text-gray-600">
                  <CalendarIcon className="w-4 h-4 mr-2 text-gray-400" />
                  Joined: {formatDateToDisplay(newBeliever.joinedDate)}
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-2 text-sm">
                {newBeliever.ministry && (
                  <div>
                    <span className="font-medium text-gray-700">Ministry:</span>
                    <span className="ml-2 text-gray-600">{newBeliever.ministry}</span>
                  </div>
                )}
                {newBeliever.studies && (
                  <div>
                    <span className="font-medium text-gray-700">Studies:</span>
                    <span className="ml-2 text-gray-600">{newBeliever.studies}</span>
                  </div>
                )}
                {newBeliever.occupation && (
                  <div>
                    <span className="font-medium text-gray-700">Occupation:</span>
                    <span className="ml-2 text-gray-600">{newBeliever.occupation}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      <NewBelieverFormModal
        isOpen={isNewBelieverFormOpen}
        onClose={closeNewBelieverForm}
        newBeliever={editingNewBeliever}
      />
      
      <BulkNewBelieverAddModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
      />
    </div>
  );
};

export default NewBelieversView;
