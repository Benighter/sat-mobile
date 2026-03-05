import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Checkbox from '../ui/Checkbox';
import Button from '../ui/Button';
import { OutreachMember } from '../../types';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { membersFirebaseService } from '../../services/firebaseService';
import { getUpcomingSunday } from '../../utils/dateUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  member?: OutreachMember | null;
  bacentaName?: string;
}

// Simple phone normalizer matching AddOutreachMemberModal behavior
const normalizePhone = (p: string) => p.replace(/\s+/g, '').replace(/^\+?233/, '0');

const EditOutreachMemberModal: React.FC<Props> = ({ isOpen, onClose, member, bacentaName }) => {
  const { updateOutreachMemberHandler, showToast, sonsOfGod } = useAppContext();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [room, setRoom] = useState('');
  const [coming, setComing] = useState<'yes' | 'no'>('no');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [bornAgain, setBornAgain] = useState(false);

  // Hydrate fields whenever the targeted member changes or modal opens
  useEffect(() => {
    if (!member || !isOpen) return;
    const currentSunday = getUpcomingSunday();
    setName(member.name || '');
    setPhone(member.phoneNumbers?.[0] || '');
    setRoom(member.roomNumber || '');
    setComing(member.comingStatus && member.comingStatusSunday === currentSunday ? 'yes' : 'no');
    setReason(member.comingStatusSunday === currentSunday ? (member.notComingReason || '') : '');
    setBornAgain(!!member.sonOfGodId || !!member.bornAgainMemberId);
  }, [member, isOpen]);

  const reset = () => {
    setName('');
    setPhone('');
    setRoom('');
    setComing('no');
    setReason('');
    setBornAgain(false);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!member) return;
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('warning', 'Please enter a name');
      return;
    }
    setSaving(true);
    try {


      const normalizedPhone = phone ? normalizePhone(phone) : '';
      const comingStatusSunday = getUpcomingSunday();

      // Handle Born Again - use Sons of God system instead of creating members directly
      let sonOfGodId: string | undefined = member.sonOfGodId || undefined;
      let bornAgainMemberId: string | undefined = member.bornAgainMemberId || undefined;

      if (bornAgain && !member.sonOfGodId) {
        // If ticking born again and no Sons of God record yet, create one
        try {
          const { sonsOfGodFirebaseService } = await import('../../services/firebaseService');
          sonOfGodId = await sonsOfGodFirebaseService.add({
            name: trimmed,
            phoneNumber: normalizedPhone || undefined,
            roomNumber: room || undefined,
            outreachDate: member.outreachDate,
            bacentaId: member.bacentaId,
            notes: '',
            integrated: false
          } as any);
        } catch (e) {
          console.error('Failed to create SonOfGod record', e);
          sonOfGodId = undefined;
        }
      } else if (!bornAgain && member.sonOfGodId) {
        // If unchecking born again, clear the Sons of God link
        console.log('🗑️ Clearing Sons of God link...');
        sonOfGodId = '';
      }

      // Legacy: clear bornAgainMemberId if unchecking born again
      if (!bornAgain && member.bornAgainMemberId) {
        bornAgainMemberId = '';
      }

      const updateData: any = {
        name: trimmed,
        phoneNumbers: normalizedPhone ? [normalizedPhone] : [],
        roomNumber: room || undefined,
        comingStatus: coming === 'yes',
        comingStatusSunday,
        notComingReason: coming === 'no' && reason ? reason : undefined,
      };

      // Only include sonOfGodId if it has a meaningful value
      if (sonOfGodId !== undefined) {
        updateData.sonOfGodId = sonOfGodId;
      }

      // Only include bornAgainMemberId if it has a meaningful value
      if (bornAgainMemberId !== undefined) {
        updateData.bornAgainMemberId = bornAgainMemberId;
      }

      await updateOutreachMemberHandler(member.id, updateData);
      showToast('success', 'Outreach member updated');
      reset();
      onClose();
    } catch (e) {
      console.error('❌ Save failed:', e);
      showToast('error', 'Failed to update outreach member');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { reset(); onClose(); }}
      title={`Edit Outreach Member${bacentaName ? ` · ${bacentaName}` : ''}`}
      size="lg"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input label="Full Name" placeholder="Enter full name" value={name} onChange={setName} />
          <Input label="Phone Number" placeholder="e.g. 024XXXXXXX" value={phone} onChange={setPhone} />
          <Input label="Room/Area" placeholder="Room or area" value={room} onChange={setRoom} />
          <Select label="Coming to Church?" value={coming} onChange={v => setComing(v as 'yes' | 'no')}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </Select>
        </div>

        {coming === 'no' && (
          <Input label="Reason for Not Coming" placeholder="Why are they not coming to church?" value={reason} onChange={setReason} />
        )}

        <Checkbox
          label="Born Again (also add to Sons of God)"
          checked={bornAgain}
          onChange={(e) => setBornAgain((e.target as HTMLInputElement).checked)}
          wrapperClassName="mt-2"
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={() => { reset(); onClose(); }} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !member} loading={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default EditOutreachMemberModal;
