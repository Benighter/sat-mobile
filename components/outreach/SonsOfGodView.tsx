import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { SonOfGod } from '../../types';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { SearchIcon, UserIcon, PhoneIcon, HomeIcon, CalendarIcon } from '../icons';
import { SmartTextParser } from '../../utils/smartTextParser';

const SonsOfGodView: React.FC = () => {
  const { sonsOfGod, bacentas, showToast } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [showIntegratedOnly, setShowIntegratedOnly] = useState(false);
  const [showUnintegratedOnly, setShowUnintegratedOnly] = useState(false);

  // Filter and search Sons of God
  const filteredSonsOfGod = useMemo(() => {
    return sonsOfGod.filter(sog => {
      // Integration filter
      if (showIntegratedOnly && !sog.integrated) return false;
      if (showUnintegratedOnly && sog.integrated) return false;

      // Search filter
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        const searchableText = [
          sog.name,
          sog.phoneNumber || '',
          sog.roomNumber || '',
          bacentas.find(b => b.id === sog.bacentaId)?.name || ''
        ].join(' ').toLowerCase();
        
        return searchableText.includes(searchLower);
      }
      
      return true;
    });
  }, [sonsOfGod, searchTerm, showIntegratedOnly, showUnintegratedOnly, bacentas]);

  const handlePhoneClick = async (phoneNumber: string) => {
    if (!phoneNumber) return;
    await SmartTextParser.copyPhoneToClipboard(phoneNumber, showToast);
  };

  const getBacentaName = (bacentaId: string) => {
    return bacentas.find(b => b.id === bacentaId)?.name || 'Unknown Bacenta';
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <UserIcon className="w-6 h-6 text-purple-600" />
              Sons of God
            </h1>
            <p className="text-gray-600 mt-1">
              Born again contacts from outreach (before conversion to members)
            </p>
          </div>
          <div className="text-sm text-gray-500">
            Total: {sonsOfGod.length} | Showing: {filteredSonsOfGod.length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <Input
              placeholder="Search by name, phone, room, or bacenta..."
              value={searchTerm}
              onChange={setSearchTerm}
              leftIcon={<SearchIcon className="w-4 h-4" />}
              iconType="search"
            />
          </div>
          
          {/* Filter buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setShowIntegratedOnly(!showIntegratedOnly);
                setShowUnintegratedOnly(false);
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                showIntegratedOnly 
                  ? 'bg-green-100 border-green-300 text-green-700' 
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
            >
              Integrated Only
            </button>
            <button
              onClick={() => {
                setShowUnintegratedOnly(!showUnintegratedOnly);
                setShowIntegratedOnly(false);
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                showUnintegratedOnly 
                  ? 'bg-orange-100 border-orange-300 text-orange-700' 
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
            >
              Pending Integration
            </button>
            {(searchTerm || showIntegratedOnly || showUnintegratedOnly) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setShowIntegratedOnly(false);
                  setShowUnintegratedOnly(false);
                }}
                className="px-3 py-1.5 rounded-full text-sm font-medium border bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-300"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sons of God List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {filteredSonsOfGod.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {sonsOfGod.length === 0
              ? "No Sons of God records yet. Mark outreach members as 'Born Again' to create records. Note: This shows pre-conversion records only."
              : "No Sons of God match your current filters."
            }
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredSonsOfGod.map((sog, index) => (
              <div key={sog.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Name and Status */}
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {sog.name}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        sog.integrated 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {sog.integrated ? 'Integrated' : 'Pending'}
                      </span>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600">
                      {/* Phone */}
                      {sog.phoneNumber && (
                        <div className="flex items-center gap-2">
                          <PhoneIcon className="w-4 h-4 text-gray-400" />
                          <button
                            onClick={() => handlePhoneClick(sog.phoneNumber!)}
                            className="hover:text-blue-600 hover:underline transition-colors"
                          >
                            {sog.phoneNumber}
                          </button>
                        </div>
                      )}

                      {/* Room */}
                      {sog.roomNumber && (
                        <div className="flex items-center gap-2">
                          <HomeIcon className="w-4 h-4 text-gray-400" />
                          <span>Room {sog.roomNumber}</span>
                        </div>
                      )}

                      {/* Bacenta */}
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-gray-400" />
                        <span>{getBacentaName(sog.bacentaId)}</span>
                      </div>

                      {/* Outreach Date */}
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-gray-400" />
                        <span>{formatDate(sog.outreachDate)}</span>
                      </div>
                    </div>

                    {/* Notes */}
                    {sog.notes && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Notes:</span> {sog.notes}
                      </div>
                    )}

                    {/* Integration Info */}
                    {sog.integrated && sog.integratedMemberId && (
                      <div className="mt-2 text-sm text-green-600">
                        <span className="font-medium">Integrated as Member ID:</span> {sog.integratedMemberId}
                      </div>
                    )}
                  </div>

                  {/* Record Number */}
                  <div className="text-sm text-gray-400 font-mono">
                    #{index + 1}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SonsOfGodView;
