import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Checkbox from '../ui/Checkbox';
import Button from '../ui/Button';
import { OutreachMember } from '../../types';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { membersFirebaseService } from '../../services/firebaseService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  member?: OutreachMember | null;
  bacentaName?: string;
}

// Simple phone normalizer matching AddOutreachMemberModal behavior
const normalizePhone = (p: string) => p.replace(/\s+/g, '').replace(/^\+?233/, '0');

const EditOutreachMemberModal: React.FC<Props> = ({ isOpen, onClose, member, bacentaName }) => {
  const { updateOutreachMemberHandler, showToast } = useAppContext();

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
    setName(member.name || '');
    setPhone(member.phoneNumbers?.[0] || '');
    setRoom(member.roomNumber || '');
    setComing(member.comingStatus ? 'yes' : 'no');
  setReason(member.notComingReason || '');
  setBornAgain(!!member.bornAgainMemberId);
  }, [member, isOpen]);

  const reset = () => {
    setName('');
    setPhone('');
    setRoom('');
    setComing('no');
    setReason('');
  };

  const handleSave = async () => {
    if (!member) return;
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('warning', 'Please enter a name');
      return;
    }
    setSaving(true);
    try {
      const normalizedPhone = phone ? normalizePhone(phone) : '';

      // Handle Born Again link creation/clearing
  let bornAgainMemberId: string | undefined = member.bornAgainMemberId || undefined;
      if (bornAgain && !member.bornAgainMemberId) {
        // If ticking born again and no link yet, create or reuse a born-again Member
        try {
          let existingId: string | undefined;
          if (normalizedPhone) {
            try {
              const allMembers = await membersFirebaseService.getAll();
              const existing = allMembers.find(m => m.phoneNumber && normalizePhone(m.phoneNumber) === normalizedPhone && m.bornAgainStatus);
              if (existing) existingId = existing.id;
            } catch {}
          }
          bornAgainMemberId = existingId || await membersFirebaseService.add({
            firstName: trimmed,
            lastName: '',
            phoneNumber: normalizedPhone || '',
            buildingAddress: '',
            roomNumber: room || '',
            bornAgainStatus: true,
            outreachOrigin: true,
            bacentaId: '',
            role: 'Member',
          } as any);
        } catch {
          // If for some reason this fails, still proceed with outreach update without the link
          bornAgainMemberId = undefined;
        }
      } else if (!bornAgain && member.bornAgainMemberId) {
        // If unchecking, clear the link (do not delete the member)
        bornAgainMemberId = '';
      }

      await updateOutreachMemberHandler(member.id, {
        name: trimmed,
        phoneNumbers: normalizedPhone ? [normalizedPhone] : [],
        roomNumber: room || undefined,
        comingStatus: coming === 'yes',
        notComingReason: coming === 'no' && reason ? reason : undefined,
        ...(bornAgainMemberId !== undefined ? { bornAgainMemberId } : {}),
      });
      showToast('success', 'Outreach member updated');
      reset();
      onClose();
    } catch (e) {
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
          <Button onClick={handleSave} disabled={saving || !member}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default EditOutreachMemberModal;
