import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { Member } from '../../types';
import { ArrowLeftIcon, ClipboardIcon, CheckIcon } from '../icons';
import { formatBirthdayDisplay } from '../../utils/birthdayUtils';
import Button from '../ui/Button';

interface CopyOptions {
  includeNames: boolean;
  includeSurnames: boolean;
  includePhones: boolean;
  includeBirthdays: boolean;
  includeBacentaName: boolean;
  groupByBacenta: boolean;
  memberType: 'all' | 'includeLeaders' | 'excludeLeaders';
}

const CopyMembersView: React.FC = () => {
  const { 
    members, 
    bacentas, 
    switchTab, 
    showToast,
    currentTab 
  } = useAppContext();

  const [options, setOptions] = useState<CopyOptions>({
    includeNames: true,
    includeSurnames: false,
    includePhones: false,
    includeBirthdays: false,
    includeBacentaName: false,
    groupByBacenta: false,
    memberType: 'all'
  });
  const [isCopying, setIsCopying] = useState(false);

  // Get the current bacenta filter from navigation context
  // This will be passed when navigating from a filtered members view
  const bacentaFilter = currentTab.data?.bacentaFilter || null;
  const searchTerm = currentTab.data?.searchTerm || '';
  const roleFilter = currentTab.data?.roleFilter || 'all';

  // Get bacenta name if filtering by bacenta
  const getBacentaName = (bacentaId: string) => {
    if (!bacentaId) return null;
    const bacenta = bacentas.find(b => b.id === bacentaId);
    return bacenta?.name || 'Unknown Bacenta';
  };

  const currentBacentaName = bacentaFilter ? getBacentaName(bacentaFilter) : null;

  // Handle back navigation
  const handleBack = () => {
    // Navigate back to the members view with the same context
    if (bacentaFilter) {
      // If we came from a specific bacenta, go back to that bacenta view
      const bacenta = bacentas.find(b => b.id === bacentaFilter);
      if (bacenta) {
        switchTab({ id: bacentaFilter, name: bacenta.name });
      } else {
        switchTab({ id: 'all_members', name: 'All Members' });
      }
    } else {
      // Go back to all members view
      switchTab({ id: 'all_members', name: 'All Members' });
    }
  };

  // If no members available, show a message
  if (members.length === 0) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={handleBack}
            className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-sm transition-colors"
            title="Go back"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Copy Members</h1>
            <p className="text-sm text-gray-600">No members available</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No members found to copy.</p>
          <Button
            variant="primary"
            onClick={handleBack}
            className="mt-4"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Filter members based on current context (same logic as MembersTableView)
  const filteredMembers = useMemo(() => {
    const getRolePriority = (role: string | undefined) => {
      switch (role) {
        case 'Bacenta Leader': return 1;
        case 'Fellowship Leader': return 2;
        case 'Member': return 3;
        default: return 4;
      }
    };

    return members
      .filter(member => {
        // Filter by bacenta if specified
        if (bacentaFilter && member.bacentaId !== bacentaFilter) {
          return false;
        }

        // Filter by role
        if (roleFilter !== 'all' && (member.role || 'Member') !== roleFilter) {
          return false;
        }

        // Filter by search term
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          return (
            member.firstName.toLowerCase().includes(searchLower) ||
            (member.lastName || '').toLowerCase().includes(searchLower) ||
            member.phoneNumber.includes(searchTerm) ||
            member.buildingAddress.toLowerCase().includes(searchLower)
          );
        }

        return true;
      })
      .sort((a, b) => {
        // First sort by role priority
        const rolePriorityA = getRolePriority(a.role);
        const rolePriorityB = getRolePriority(b.role);

        if (rolePriorityA !== rolePriorityB) {
          return rolePriorityA - rolePriorityB;
        }

        // Then sort by last name, then first name within the same role
        const lastNameA = a.lastName || '';
        const lastNameB = b.lastName || '';
        return lastNameA.localeCompare(lastNameB) || a.firstName.localeCompare(b.firstName);
      });
  }, [members, bacentaFilter, searchTerm, roleFilter]);

  // Filter members based on selected type
  const getFilteredMembersByType = () => {
    switch (options.memberType) {
      case 'includeLeaders':
        return filteredMembers.filter(m => 
          m.role === 'Bacenta Leader' || 
          m.role === 'Fellowship Leader' || 
          m.role === 'Member' ||
          !m.role // Include members without role (default to Member)
        );
      case 'excludeLeaders':
        return filteredMembers.filter(m => m.role === 'Member' || !m.role);
      case 'all':
      default:
        return filteredMembers;
    }
  };

  // Generate the text to copy
  const generateCopyText = () => {
    const membersToProcess = getFilteredMembersByType();
    const lines: string[] = [];

    if (options.groupByBacenta) {
      // Group members by bacenta
      const membersByBacenta = membersToProcess.reduce((acc, member) => {
        const bacentaId = member.bacentaId || 'unassigned';
        if (!acc[bacentaId]) {
          acc[bacentaId] = [];
        }
        acc[bacentaId].push(member);
        return acc;
      }, {} as Record<string, Member[]>);

      // Sort bacentas alphabetically
      const sortedBacentaIds = Object.keys(membersByBacenta).sort((a, b) => {
        const nameA = a === 'unassigned' ? 'Unassigned Members' : (getBacentaName(a) || 'Unknown Bacenta');
        const nameB = b === 'unassigned' ? 'Unassigned Members' : (getBacentaName(b) || 'Unknown Bacenta');
        return nameA.localeCompare(nameB);
      });

      let globalCounter = 1;

      sortedBacentaIds.forEach((bacentaId, bacentaIndex) => {
        const bacentaMembers = membersByBacenta[bacentaId];
        const bacentaName = bacentaId === 'unassigned' ? 'Unassigned Members' : (getBacentaName(bacentaId) || 'Unknown Bacenta');

        // Add bacenta header
        lines.push(`${bacentaName} Bacenta`);

        // Process members in this bacenta
        bacentaMembers.forEach((member) => {
          const parts: string[] = [];

          // Always add numbering (default behavior)
          parts.push(`${globalCounter}.`);

          if (options.includeNames && member.firstName) {
            parts.push(member.firstName.trim());
          }

          if (options.includeSurnames && member.lastName && member.lastName.trim()) {
            parts.push(member.lastName.trim());
          }

          if (options.includePhones && member.phoneNumber && member.phoneNumber !== '-' && member.phoneNumber.trim()) {
            parts.push(member.phoneNumber.trim());
          }

          if (options.includeBirthdays && member.birthday) {
            parts.push(`(${formatBirthdayDisplay(member.birthday)})`);
          }

          const line = parts.join(' ');
          if (line.trim()) {
            lines.push(line);
            globalCounter++;
          }
        });

        // Add empty line between bacentas (except for the last one)
        if (bacentaIndex < sortedBacentaIds.length - 1) {
          lines.push('');
        }
      });
    } else {
      // Single list format
      // Add bacenta name if requested and we're filtering by a specific bacenta
      if (options.includeBacentaName && currentBacentaName) {
        lines.push(`${currentBacentaName} Bacenta`);
        lines.push(''); // Empty line for spacing
      }

      // Process each member
      membersToProcess.forEach((member, index) => {
        const parts: string[] = [];

        // Always add numbering (default behavior)
        parts.push(`${index + 1}.`);

        if (options.includeNames && member.firstName) {
          parts.push(member.firstName.trim());
        }

        if (options.includeSurnames && member.lastName && member.lastName.trim()) {
          parts.push(member.lastName.trim());
        }

        if (options.includePhones && member.phoneNumber && member.phoneNumber !== '-' && member.phoneNumber.trim()) {
          parts.push(member.phoneNumber.trim());
        }

        if (options.includeBirthdays && member.birthday) {
          parts.push(`(${formatBirthdayDisplay(member.birthday)})`);
        }

        const line = parts.join(' ');
        if (line.trim()) {
          lines.push(line);
        }
      });
    }

    return lines.join('\n');
  };

  // Handle copy to clipboard
  const handleCopy = async () => {
    setIsCopying(true);
    
    try {
      const textToCopy = generateCopyText();
      
      if (!textToCopy.trim()) {
        showToast('warning', 'No Data', 'No member data to copy with current settings.');
        setIsCopying(false);
        return;
      }

      await navigator.clipboard.writeText(textToCopy);
      
      const filteredCount = getFilteredMembersByType().length;
      showToast('success', 'Copied!', `${filteredCount} member${filteredCount !== 1 ? 's' : ''} copied to clipboard.`);
      
      // Navigate back to the previous view
      handleBack();
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      showToast('error', 'Copy Failed', 'Failed to copy to clipboard. Please try again.');
    } finally {
      setIsCopying(false);
    }
  };

  // Preview text
  const previewText = generateCopyText();
  const previewLines = previewText.split('\n').slice(0, 10);
  const hasMoreLines = previewText.split('\n').length > 10;
  const memberCount = getFilteredMembersByType().length;

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Back Button */}
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={handleBack}
            className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-sm transition-colors"
            title="Go back"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Copy Members</h1>
            <p className="text-sm text-gray-600">
              {currentBacentaName ? `${currentBacentaName} Bacenta` : 'All Members'} • {memberCount} member{memberCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Options Panel */}
        <div className="space-y-6">
          {/* Data Fields Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Fields</h3>
            <div className="space-y-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includeNames}
                  onChange={(e) => setOptions(prev => ({ ...prev, includeNames: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Names (First Names)</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includeSurnames}
                  onChange={(e) => setOptions(prev => ({ ...prev, includeSurnames: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Surnames/Last Names</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includePhones}
                  onChange={(e) => setOptions(prev => ({ ...prev, includePhones: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Phone Numbers/Contacts</span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includeBirthdays}
                  onChange={(e) => setOptions(prev => ({ ...prev, includeBirthdays: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Birthdays</span>
              </label>
            </div>
          </div>

          {/* Format Options Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Format Options</h3>
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Note:</strong> Numbering (1. 2. 3.) is automatically included in all outputs.
              </p>
            </div>
            <div className="space-y-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.groupByBacenta}
                  onChange={(e) => setOptions(prev => ({ ...prev, groupByBacenta: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Group by Bacenta</span>
                  <p className="text-xs text-gray-500">Organize members under their respective bacentas</p>
                </div>
              </label>

              {currentBacentaName && !options.groupByBacenta && (
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.includeBacentaName}
                    onChange={(e) => setOptions(prev => ({ ...prev, includeBacentaName: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Include bacenta name header</span>
                </label>
              )}
            </div>
          </div>

          {/* Member Types Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Member Types</h3>
            <div className="space-y-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="memberType"
                  value="all"
                  checked={options.memberType === 'all'}
                  onChange={(e) => setOptions(prev => ({ ...prev, memberType: e.target.value as any }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">All Members</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="memberType"
                  value="includeLeaders"
                  checked={options.memberType === 'includeLeaders'}
                  onChange={(e) => setOptions(prev => ({ ...prev, memberType: e.target.value as any }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Include Leaders</span>
                <span className="text-xs text-gray-500">(Bacenta + Fellowship Leaders + Members)</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="memberType"
                  value="excludeLeaders"
                  checked={options.memberType === 'excludeLeaders'}
                  onChange={(e) => setOptions(prev => ({ ...prev, memberType: e.target.value as any }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Exclude Leaders</span>
                <span className="text-xs text-gray-500">(Members only)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="space-y-6">
          {/* Preview Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
            {previewText ? (
              <>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-80 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {previewLines.join('\n')}
                    {hasMoreLines && '\n...'}
                  </pre>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  {memberCount} member{memberCount !== 1 ? 's' : ''} will be copied
                  {hasMoreLines && ` (showing first 10 lines)`}
                </p>
              </>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                <p className="text-gray-500">No data to preview with current settings</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              variant="primary"
              onClick={handleCopy}
              disabled={isCopying || !previewText.trim()}
              className="w-full flex items-center justify-center space-x-2 py-3"
              size="lg"
            >
              {isCopying ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Copying...</span>
                </>
              ) : (
                <>
                  <ClipboardIcon className="w-5 h-5" />
                  <span>Copy to Clipboard</span>
                </>
              )}
            </Button>
            
            <Button
              variant="secondary"
              onClick={handleBack}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default CopyMembersView;
