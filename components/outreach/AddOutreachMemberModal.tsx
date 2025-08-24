import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Checkbox from '../ui/Checkbox';
import Button from '../ui/Button';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { membersFirebaseService } from '../../services/firebaseService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bacentaId: string; // regular bacenta id used for both outreach record and member
  weekStart: string; // YYYY-MM-DD (Monday)
  bacentaName?: string;
}

const AddOutreachMemberModal: React.FC<Props> = ({ isOpen, onClose, bacentaId, weekStart, bacentaName }) => {
  const { addOutreachMemberHandler, showToast } = useAppContext();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [room, setRoom] = useState('');
  const [coming, setComing] = useState<'yes' | 'no'>('no');
  const [reason, setReason] = useState('');
  const [bornAgain, setBornAgain] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName('');
    setPhone('');
    setRoom('');
    setComing('no');
    setReason('');
    setBornAgain(false);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const trimmed = name.trim();
  const normalizePhone = (p: string) => p.replace(/\s+/g, '').replace(/^\+?233/, '0');
  const normalizedPhone = phone ? normalizePhone(phone) : '';
    if (!trimmed) {
      showToast('warning', 'Please enter a name');
      return;
    }
  setSubmitting(true);
    try {
      // If born again, create a Member first (unassigned, outreach origin)
      let bornAgainMemberId: string | undefined;
      if (bornAgain) {
        // Duplicate guard: if phone provided, try find an existing born-again member with same phone
        if (normalizedPhone) {
          try {
            const allMembers = await membersFirebaseService.getAll();
            const existing = allMembers.find(m => m.phoneNumber && normalizePhone(m.phoneNumber) === normalizedPhone && m.bornAgainStatus);
            if (existing) {
              bornAgainMemberId = existing.id;
            }
          } catch {}
        }
        if (!bornAgainMemberId) {
          bornAgainMemberId = await membersFirebaseService.add({
          firstName: trimmed,
          lastName: '',
          phoneNumber: normalizedPhone || '',
          buildingAddress: '',
          roomNumber: room || '',
          bornAgainStatus: true,
          outreachOrigin: true,
          bacentaId: '', // keep unassigned until conversion
          role: 'Member',
          } as any);
        }
      }

      // Add Outreach entry, linking the created member when applicable
      await addOutreachMemberHandler({
        name: trimmed,
        phoneNumbers: normalizedPhone ? [normalizedPhone] : [],
        roomNumber: room || undefined,
        bacentaId,
        comingStatus: coming === 'yes',
        notComingReason: coming === 'no' && reason ? reason : undefined,
        outreachDate: weekStart,
        ...(bornAgain && bornAgainMemberId ? { bornAgainMemberId } : {}),
      } as any);

      reset();
      onClose();
    } catch (e) {
      // Defensive toast just in case
      showToast('error', 'Failed to add outreach member');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { reset(); onClose(); }} title={`Add Outreach Member${bacentaName ? ` · ${bacentaName}` : ''}`} size="lg">
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
          <Button variant="secondary" onClick={() => { reset(); onClose(); }} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} loading={submitting}>
            {submitting ? 'Adding...' : 'Add Member'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AddOutreachMemberModal;
