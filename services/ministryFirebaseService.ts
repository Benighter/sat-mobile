/**
 * Firebase service adapters for ministry mode.
 *
 * Ministry data is stored in the active ministry church. These adapters keep
 * the context-facing signatures stable while delegating persistence to the
 * standard church-scoped services.
 */

import { Member, NewBeliever } from '../types';
import {
  attendanceFirebaseService,
  confirmationFirebaseService,
  firebaseUtils,
  membersFirebaseService,
  newBelieversFirebaseService
} from './firebaseService';

type MemberInput = Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>;
type NewBelieverInput = Omit<NewBeliever, 'id' | 'createdDate' | 'lastUpdated'>;

export const ministryMembersService = {
  getAll: membersFirebaseService.getAll,
  getById: membersFirebaseService.getById,
  onSnapshot: membersFirebaseService.onSnapshot,

  add: async (member: MemberInput, _userProfile: unknown): Promise<string> => {
    return membersFirebaseService.add({
      ...member,
      isNativeMinistryMember: true
    });
  },

  update: async (
    memberId: string,
    updates: Partial<Member>,
    _userProfile: unknown,
    _contextMember?: Member
  ): Promise<void> => {
    await membersFirebaseService.update(memberId, updates);
  },

  delete: async (memberId: string, _userProfile: unknown): Promise<void> => {
    await membersFirebaseService.delete(memberId);
  },

  /** Copy a ministry member into a constituency while retaining the source record. */
  transferToConstituency: async (
    memberId: string,
    targetConstituencyId: string,
    _userProfile: unknown
  ): Promise<string> => {
    const sourceChurchId = firebaseUtils.getCurrentChurchId();
    if (!sourceChurchId) {
      throw new Error('No ministry church is currently selected');
    }
    if (!targetConstituencyId || targetConstituencyId === sourceChurchId) {
      throw new Error('Select a different constituency');
    }

    const member = await membersFirebaseService.getById(memberId);
    if (!member) {
      throw new Error('Member not found in the ministry church');
    }

    const { id: _id, createdDate: _createdDate, lastUpdated: _lastUpdated, ...memberData } = member;
    const constituencyCopy: MemberInput = {
      ...memberData,
      bacentaId: '',
      linkedBacentaIds: [],
      bacentaLeaderId: undefined,
      assignedLeaderId: undefined,
      isNativeMinistryMember: false
    };

    try {
      firebaseUtils.setChurchContext(targetConstituencyId);
      return await membersFirebaseService.add(constituencyCopy);
    } finally {
      firebaseUtils.setChurchContext(sourceChurchId);
    }
  }
};

export const ministryAttendanceService = {
  getAll: attendanceFirebaseService.getAll,
  getById: attendanceFirebaseService.getById,
  getByDate: attendanceFirebaseService.getByDate,
  onSnapshot: attendanceFirebaseService.onSnapshot,
  addOrUpdate: attendanceFirebaseService.addOrUpdate,
  batchUpdate: attendanceFirebaseService.batchUpdate,
  delete: attendanceFirebaseService.delete
};

export const ministryNewBelieversService = {
  getAll: newBelieversFirebaseService.getAll,
  getById: newBelieversFirebaseService.getById,
  onSnapshot: newBelieversFirebaseService.onSnapshot,
  add: async (newBeliever: NewBelieverInput, _userProfile: unknown): Promise<string> => {
    return newBelieversFirebaseService.add(newBeliever);
  },
  update: newBelieversFirebaseService.update,
  delete: newBelieversFirebaseService.delete
};

export const ministryConfirmationService = {
  getAll: confirmationFirebaseService.getAll,
  getById: confirmationFirebaseService.getById,
  getByDate: confirmationFirebaseService.getByDate,
  onSnapshot: confirmationFirebaseService.onSnapshot,
  add: confirmationFirebaseService.add,
  addOrUpdate: confirmationFirebaseService.addOrUpdate,
  remove: confirmationFirebaseService.remove,
  delete: confirmationFirebaseService.delete
};
