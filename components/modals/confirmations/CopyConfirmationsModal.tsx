import React, { useMemo, useState } from 'react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { ClipboardIcon, CheckIcon } from '../../icons';
import { Member, Guest } from '../../../types';
import { useAppContext } from '../../../contexts/FirebaseAppContext';
import { formatFullDate } from '../../../utils/dateUtils';

// Local types mirroring SundayConfirmationsView grouping
type SimpleBacenta = { id: string; name: string };

interface LinkedBacentaGroup {
  bacenta: SimpleBacenta;
  members: Member[];
  guests?: Guest[];
  total: number;
}

interface FellowshipGroup {
  fellowshipLeader: Member;
  bacenta: SimpleBacenta;
  members: Member[];
  guests: Guest[];
  linkedBacentaGroups: LinkedBacentaGroup[];
}

interface BacentaLeaderGroup {
  bacentaLeader: Member;
  bacenta: SimpleBacenta;
  mainMembers: Member[];
  guests: Guest[];
  fellowshipGroups: FellowshipGroup[];
  linkedBacentaGroups: LinkedBacentaGroup[];
}

interface CopyConfirmationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSunday: string; // YYYY-MM-DD
  groups: BacentaLeaderGroup[];
}

const CopyConfirmationsModal: React.FC<CopyConfirmationsModalProps> = ({ isOpen, onClose, selectedSunday, groups }) => {
  const { showToast } = useAppContext();

  const [includeLeaders, setIncludeLeaders] = useState<boolean>(true);
  const [includeMembers, setIncludeMembers] = useState<boolean>(true);
  const [includeGuests, setIncludeGuests] = useState<boolean>(true);
  const [isCopying, setIsCopying] = useState<boolean>(false);

  const generateText = () => {
    const lines: string[] = [];
    lines.push(`Sunday Confirmations - ${formatFullDate(selectedSunday)}`);
    lines.push('');

    let grandTotal = 0;

    if (groups.length === 0) {
      lines.push('No confirmations recorded for this Sunday.');
    } else {
      groups.forEach((group, groupIndex) => {
        // Header for Bacenta Leader section
        if (includeLeaders) {
          lines.push(`💚 Bacenta leader: ${group.bacentaLeader.firstName} ${group.bacentaLeader.lastName || ''} (${group.bacenta.name})`.trim());
        } else if (includeMembers || includeGuests) {
          // Provide context header without leader name
          lines.push(`💚 ${group.bacenta.name}`);
        }

        let groupTotal = 0;

        // Main members under bacenta leader
        if (includeMembers && group.mainMembers.length) {
          group.mainMembers.forEach((m, idx) => {
            lines.push(`${idx + 1}. ${m.firstName} ${m.lastName || ''}`.trim());
            groupTotal += 1;
          });
        }

        // Guests under bacenta leader
        if (includeGuests && group.guests.length) {
          // Only label section if we are listing guests
          lines.push('Guests:');
          group.guests.forEach((g, gi) => {
            lines.push(`${gi + 1}. ${g.firstName} ${g.lastName || ''} (Guest)`.trim());
            groupTotal += 1;
          });
        }

        // Linked bacentas under bacenta leader
        group.linkedBacentaGroups.forEach(lg => {
          // Sub header for linked bacenta
          if (includeMembers || includeGuests) {
            lines.push('');
            lines.push(`❤ ${lg.bacenta.name}`);
          }
          if (includeMembers) {
            lg.members.forEach((m, idx) => {
              lines.push(`${idx + 1}. ${m.firstName} ${m.lastName || ''}`.trim());
              groupTotal += 1;
            });
          }
          if (includeGuests && (lg.guests || []).length) {
            (lg.guests || []).forEach((g, gi) => {
              lines.push(`${gi + 1}. ${g.firstName} ${g.lastName || ''} (Guest)`.trim());
              groupTotal += 1;
            });
          }
        });

        // Fellowship leader groups
        group.fellowshipGroups.forEach(fg => {
          if (includeLeaders) {
            lines.push('');
            lines.push(`❤️ Fellowship leader: ${fg.fellowshipLeader.firstName} ${fg.fellowshipLeader.lastName || ''} (${fg.bacenta.name})`.trim());
          } else if (includeMembers || includeGuests) {
            lines.push('');
            lines.push(`❤️ ${fg.bacenta.name}`);
          }
          if (includeMembers) {
            fg.members.forEach((m, idx) => {
              lines.push(`${idx + 1}. ${m.firstName} ${m.lastName || ''}`.trim());
              groupTotal += 1;
            });
          }
          if (includeGuests && fg.guests.length) {
            fg.guests.forEach((g, gi) => {
              lines.push(`${gi + 1}. ${g.firstName} ${g.lastName || ''} (Guest)`.trim());
              groupTotal += 1;
            });
          }

          // Linked bacentas under fellowship leader
          fg.linkedBacentaGroups.forEach(lg => {
            if (includeMembers || includeGuests) {
              lines.push('');
              lines.push(`❤ ${lg.bacenta.name}`);
            }
            if (includeMembers) {
              lg.members.forEach((m, idx) => {
                lines.push(`${idx + 1}. ${m.firstName} ${m.lastName || ''}`.trim());
                groupTotal += 1;
              });
            }
            if (includeGuests && (lg.guests || []).length) {
              (lg.guests || []).forEach((g, gi) => {
                lines.push(`${gi + 1}. ${g.firstName} ${g.lastName || ''} (Guest)`.trim());
                groupTotal += 1;
              });
            }
          });
        });

        lines.push('');
        lines.push(`Total: ${groupTotal}`);
        grandTotal += groupTotal;
        if (groupIndex < groups.length - 1) lines.push('');
      });

      lines.push('');
      lines.push(`Grand Total: ${grandTotal}`);
    }

    return lines.join('\n');
  };

  const previewText = useMemo(() => generateText(), [includeLeaders, includeMembers, includeGuests, groups, selectedSunday]);
  const previewLines = previewText.split('\n').slice(0, 12);
  const hasMore = previewText.split('\n').length > 12;

  const handleCopy = async () => {
    setIsCopying(true);
    try {
      const text = generateText();
      await navigator.clipboard.writeText(text);
      showToast('success', 'Copied!', 'Confirmations copied to clipboard');
      onClose();
    } catch (e) {
      console.error('Copy failed:', e);
      showToast('error', 'Copy Failed', 'Unable to copy to clipboard');
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Copy Confirmations">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Options */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">Include</h4>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  checked={includeLeaders}
                  onChange={(e) => setIncludeLeaders(e.target.checked)}
                />
                <span className="text-sm text-gray-700">Leaders (Bacenta & Fellowship)</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  checked={includeMembers}
                  onChange={(e) => setIncludeMembers(e.target.checked)}
                />
                <span className="text-sm text-gray-700">Members</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  checked={includeGuests}
                  onChange={(e) => setIncludeGuests(e.target.checked)}
                />
                <span className="text-sm text-gray-700">Guests</span>
              </label>
            </div>
            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 flex items-center">
              <CheckIcon className="w-4 h-4 mr-1 text-blue-600" />
              <span>You can uncheck leaders to copy members only.</span>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-3">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">Preview</h4>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-72 overflow-y-auto">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">{previewLines.join('\n')}{hasMore ? '\n...' : ''}</pre>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleCopy}
              variant="primary"
              size="lg"
              className="w-full flex items-center justify-center space-x-2"
              disabled={isCopying}
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
            <Button onClick={onClose} variant="secondary" className="w-full">Cancel</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CopyConfirmationsModal;
