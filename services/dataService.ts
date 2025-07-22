
import { Member, AttendanceRecord, AttendanceStatus, Bacenta, NewBeliever } from '../types';
// CONGREGATION_GROUPS removed from imports
import { formatDateToYYYYMMDD } from '../utils/dateUtils';

const MEMBERS_KEY = 'church_members';
const ATTENDANCE_KEY = 'church_attendance';
const BACENTAS_KEY = 'church_bacentas'; // New key for Bacentas
const NEW_BELIEVERS_KEY = 'church_connect_new_believers'; // New key for New Believers - match localStorage key

const getInitialMembers = (): Member[] => {
  // const now = new Date().toISOString();
  // const todayYYYYMMDD = formatDateToYYYYMMDD(new Date());
  // Members are initialized without a bacentaId or with an empty string
  // Return empty array to remove mock members
  return []; 
};

const getInitialAttendance = (): AttendanceRecord[] => {
  // Return empty array - no sample attendance data
  return [];
};


export const MemberService = {
  getMembers: async (): Promise<Member[]> => {
    const data = localStorage.getItem(MEMBERS_KEY);
    if (!data) {
      const initialMembers = getInitialMembers();
      localStorage.setItem(MEMBERS_KEY, JSON.stringify(initialMembers));
      return initialMembers;
    }
    const members = JSON.parse(data) as Member[];
    return members;
  },
  addMember: async (memberData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>): Promise<Member> => {
    const members = await MemberService.getMembers();
    const now = new Date().toISOString();
    const newMember: Member = {
      ...memberData,
      id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      createdDate: now,
      lastUpdated: now,
      // Ensure required fields have defaults
      firstName: memberData.firstName.trim(),
      lastName: memberData.lastName?.trim() || '',
      phoneNumber: memberData.phoneNumber?.trim() || '',
      buildingAddress: memberData.buildingAddress?.trim() || '',
      profilePicture: memberData.profilePicture?.trim() || '',
      bornAgainStatus: memberData.bornAgainStatus || false,
      bacentaId: memberData.bacentaId || '',
      role: memberData.role || 'Member', // Default role is Member
    };
    members.push(newMember);
    localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
    return newMember;
  },

  addMultipleMembers: async (membersData: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>[]): Promise<{
    successful: Member[],
    failed: { data: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>, error: string }[]
  }> => {
    const members = await MemberService.getMembers();
    const now = new Date().toISOString();
    const successful: Member[] = [];
    const failed: { data: Omit<Member, 'id' | 'createdDate' | 'lastUpdated'>, error: string }[] = [];

    for (const memberData of membersData) {
      try {
        // Validate required fields
        if (!memberData.firstName?.trim()) {
          throw new Error('First name is required');
        }

        // Create unique ID with timestamp and random component to avoid collisions
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 11);
        const newMember: Member = {
          ...memberData,
          id: `m_${timestamp}_${random}`,
          createdDate: now,
          lastUpdated: now,
          // Ensure required fields have defaults
          firstName: memberData.firstName.trim(),
          lastName: memberData.lastName?.trim() || '',
          phoneNumber: memberData.phoneNumber?.trim() || '',
          buildingAddress: memberData.buildingAddress?.trim() || '',
          profilePicture: memberData.profilePicture?.trim() || '',
          bornAgainStatus: memberData.bornAgainStatus || false,
          bacentaId: memberData.bacentaId || '',
          role: memberData.role || 'Member', // Default role is Member
        };

        members.push(newMember);
        successful.push(newMember);

        // Small delay to ensure unique timestamps
        await new Promise(resolve => setTimeout(resolve, 1));
      } catch (error) {
        failed.push({
          data: memberData,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Save all successful members at once
    if (successful.length > 0) {
      localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
    }

    return { successful, failed };
  },
  updateMember: async (updatedMember: Member): Promise<Member> => {
    let members = await MemberService.getMembers();
    updatedMember.lastUpdated = new Date().toISOString();
    // Ensure role is set on update, defaulting to Member if not provided
    updatedMember.role = updatedMember.role || 'Member';
    members = members.map(m => m.id === updatedMember.id ? updatedMember : m);
    localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
    return updatedMember;
  },
  deleteMember: async (memberId: string): Promise<void> => {
    let members = await MemberService.getMembers();
    members = members.filter(m => m.id !== memberId);
    localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
    
    let attendance = await AttendanceService.getAttendance();
    attendance = attendance.filter(a => a.memberId !== memberId);
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(attendance));
  },
};

export const AttendanceService = {
  getAttendance: async (): Promise<AttendanceRecord[]> => {
    const data = localStorage.getItem(ATTENDANCE_KEY);
     if (!data) {
      const initialAttendance = getInitialAttendance(); // Will be empty - no sample data
      localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(initialAttendance));
      return initialAttendance;
    }
    return JSON.parse(data);
  },
  markAttendance: async (memberId: string, date: string, status: AttendanceStatus): Promise<AttendanceRecord> => {
    let attendanceRecords = await AttendanceService.getAttendance();
    const recordId = `${memberId}_${date}`;
    const existingRecordIndex = attendanceRecords.findIndex(ar => ar.id === recordId);

    let updatedRecord: AttendanceRecord;
    if (existingRecordIndex > -1) {
      attendanceRecords[existingRecordIndex].status = status;
      updatedRecord = attendanceRecords[existingRecordIndex];
    } else {
      updatedRecord = { id: recordId, memberId, date, status };
      attendanceRecords.push(updatedRecord);
    }
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(attendanceRecords));
    return updatedRecord;
  },
  markNewBelieverAttendance: async (newBelieverId: string, date: string, status: AttendanceStatus): Promise<AttendanceRecord> => {
    let attendanceRecords = await AttendanceService.getAttendance();
    const recordId = `newbeliever_${newBelieverId}_${date}`;
    const existingRecordIndex = attendanceRecords.findIndex(ar => ar.id === recordId);

    let updatedRecord: AttendanceRecord;
    if (existingRecordIndex > -1) {
      attendanceRecords[existingRecordIndex].status = status;
      updatedRecord = attendanceRecords[existingRecordIndex];
    } else {
      updatedRecord = { id: recordId, newBelieverId, date, status };
      attendanceRecords.push(updatedRecord);
    }
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(attendanceRecords));
    return updatedRecord;
  },
  getAttendanceForMember: async (memberId: string): Promise<AttendanceRecord[]> => {
    const attendanceRecords = await AttendanceService.getAttendance();
    return attendanceRecords.filter(ar => ar.memberId === memberId);
  },
  getAttendanceForNewBeliever: async (newBelieverId: string): Promise<AttendanceRecord[]> => {
    const attendanceRecords = await AttendanceService.getAttendance();
    return attendanceRecords.filter(ar => ar.newBelieverId === newBelieverId);
  },
};

export const BacentaService = { // Renamed from CongregationService
  getBacentas: async (): Promise<Bacenta[]> => {
    const data = localStorage.getItem(BACENTAS_KEY);
    return data ? JSON.parse(data) : [];
  },
  addBacenta: async (name: string): Promise<Bacenta> => {
    const bacentas = await BacentaService.getBacentas();
    const newBacenta: Bacenta = {
      id: `bacenta_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name,
    };
    bacentas.push(newBacenta);
    localStorage.setItem(BACENTAS_KEY, JSON.stringify(bacentas));
    return newBacenta;
  },
  updateBacenta: async (updatedBacenta: Bacenta): Promise<Bacenta> => {
    let bacentas = await BacentaService.getBacentas();
    bacentas = bacentas.map(b => b.id === updatedBacenta.id ? updatedBacenta : b);
    localStorage.setItem(BACENTAS_KEY, JSON.stringify(bacentas));
    return updatedBacenta;
  },
  deleteBacenta: async (bacentaId: string): Promise<void> => {
    let bacentas = await BacentaService.getBacentas();
    bacentas = bacentas.filter(b => b.id !== bacentaId);
    localStorage.setItem(BACENTAS_KEY, JSON.stringify(bacentas));
    
    // Unassign members from this bacenta in localStorage
    let members = await MemberService.getMembers();
    const membersToUpdate = members.filter(m => m.bacentaId === bacentaId);
    if (membersToUpdate.length > 0) {
      members = members.map(m => {
        if (m.bacentaId === bacentaId) {
          return { ...m, bacentaId: '', lastUpdated: new Date().toISOString() };
        }
        return m;
      });
      localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
    }
  },
};

export const NewBelieverService = {
  getNewBelievers: async (): Promise<NewBeliever[]> => {
    const data = localStorage.getItem(NEW_BELIEVERS_KEY);
    return data ? JSON.parse(data) : [];
  },
  addNewBeliever: async (newBelieverData: Omit<NewBeliever, 'id' | 'createdDate' | 'lastUpdated'>): Promise<NewBeliever> => {
    const newBelievers = await NewBelieverService.getNewBelievers();
    const now = new Date().toISOString();
    const newBeliever: NewBeliever = {
      ...newBelieverData,
      id: `newbeliever_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdDate: now,
      lastUpdated: now,
    };
    newBelievers.push(newBeliever);
    localStorage.setItem(NEW_BELIEVERS_KEY, JSON.stringify(newBelievers));
    return newBeliever;
  },
  updateNewBeliever: async (updatedNewBeliever: NewBeliever): Promise<NewBeliever> => {
    let newBelievers = await NewBelieverService.getNewBelievers();
    const updatedData = { ...updatedNewBeliever, lastUpdated: new Date().toISOString() };
    newBelievers = newBelievers.map(nb => nb.id === updatedData.id ? updatedData : nb);
    localStorage.setItem(NEW_BELIEVERS_KEY, JSON.stringify(newBelievers));
    return updatedData;
  },
  deleteNewBeliever: async (newBelieverId: string): Promise<void> => {
    let newBelievers = await NewBelieverService.getNewBelievers();
    newBelievers = newBelievers.filter(nb => nb.id !== newBelieverId);
    localStorage.setItem(NEW_BELIEVERS_KEY, JSON.stringify(newBelievers));
  },
};

export const initializeDataIfNeeded = async () => {
  await MemberService.getMembers();
  await AttendanceService.getAttendance();
  await BacentaService.getBacentas(); // Ensure Bacenta storage is initialized if needed
  await NewBelieverService.getNewBelievers(); // Ensure New Believer storage is initialized if needed
};
