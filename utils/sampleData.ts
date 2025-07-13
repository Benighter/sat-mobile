import { Member, Bacenta, AttendanceRecord } from '../types';
import { formatDateToYYYYMMDD, getSundaysOfMonth } from './dateUtils';

export const createSampleBacentas = (): Bacenta[] => {
  return [
    {
      id: 'bacenta_1',
      name: 'Victory Chapel'
    },
    {
      id: 'bacenta_2', 
      name: 'Grace Fellowship'
    },
    {
      id: 'bacenta_3',
      name: 'Faith Community'
    },
    {
      id: 'bacenta_4',
      name: 'Hope Center'
    },
    {
      id: 'bacenta_5',
      name: 'Love Assembly'
    }
  ];
};

export const createSampleMembers = (bacentas: Bacenta[]): Member[] => {
  const now = new Date().toISOString();
  const today = formatDateToYYYYMMDD(new Date());
  
  const members: Member[] = [
    // Victory Chapel members
    {
      id: 'member_1',
      firstName: 'John',
      lastName: 'Smith',
      phoneNumber: '+1-555-0101',
      buildingAddress: '123 Main St, Springfield, IL',
      bornAgainStatus: true,
      bacentaId: bacentas[0].id,
      role: 'Bacenta Leader',
      joinedDate: '2023-01-15',
      createdDate: now,
      lastUpdated: now
    },
    {
      id: 'member_2',
      firstName: 'Sarah',
      lastName: 'Johnson',
      phoneNumber: '+1-555-0102',
      buildingAddress: '456 Oak Ave, Springfield, IL',
      bornAgainStatus: true,
      bacentaId: bacentas[0].id,
      joinedDate: '2023-02-20',
      createdDate: now,
      lastUpdated: now
    },
    {
      id: 'member_3',
      firstName: 'Michael',
      lastName: 'Brown',
      phoneNumber: '+1-555-0103',
      buildingAddress: '789 Pine Rd, Springfield, IL',
      bornAgainStatus: false,
      bacentaId: bacentas[0].id,
      joinedDate: '2023-03-10',
      createdDate: now,
      lastUpdated: now
    },
    
    // Grace Fellowship members
    {
      id: 'member_4',
      firstName: 'Emily',
      lastName: 'Davis',
      phoneNumber: '+1-555-0104',
      buildingAddress: '321 Elm St, Springfield, IL',
      bornAgainStatus: true,
      bacentaId: bacentas[1].id,
      joinedDate: '2023-01-25',
      createdDate: now,
      lastUpdated: now
    },
    {
      id: 'member_5',
      firstName: 'David',
      lastName: 'Wilson',
      phoneNumber: '+1-555-0105',
      buildingAddress: '654 Maple Dr, Springfield, IL',
      bornAgainStatus: true,
      bacentaId: bacentas[1].id,
      joinedDate: '2023-04-05',
      createdDate: now,
      lastUpdated: now
    },
    {
      id: 'member_6',
      firstName: 'Lisa',
      lastName: 'Anderson',
      phoneNumber: '+1-555-0106',
      buildingAddress: '987 Cedar Ln, Springfield, IL',
      bornAgainStatus: false,
      bacentaId: bacentas[1].id,
      joinedDate: '2023-05-12',
      createdDate: now,
      lastUpdated: now
    },
    
    // Faith Community members
    {
      id: 'member_7',
      firstName: 'Robert',
      lastName: 'Taylor',
      phoneNumber: '+1-555-0107',
      buildingAddress: '147 Birch St, Springfield, IL',
      bornAgainStatus: true,
      bacentaId: bacentas[2].id,
      joinedDate: '2023-02-14',
      createdDate: now,
      lastUpdated: now
    },
    {
      id: 'member_8',
      firstName: 'Jennifer',
      lastName: 'Martinez',
      phoneNumber: '+1-555-0108',
      buildingAddress: '258 Spruce Ave, Springfield, IL',
      bornAgainStatus: true,
      bacentaId: bacentas[2].id,
      joinedDate: '2023-06-18',
      createdDate: now,
      lastUpdated: now
    },
    
    // Hope Center members
    {
      id: 'member_9',
      firstName: 'Christopher',
      lastName: 'Garcia',
      phoneNumber: '+1-555-0109',
      buildingAddress: '369 Willow Rd, Springfield, IL',
      bornAgainStatus: false,
      bacentaId: bacentas[3].id,
      joinedDate: '2023-03-22',
      createdDate: now,
      lastUpdated: now
    },
    {
      id: 'member_10',
      firstName: 'Amanda',
      lastName: 'Rodriguez',
      phoneNumber: '+1-555-0110',
      buildingAddress: '741 Poplar St, Springfield, IL',
      bornAgainStatus: true,
      bacentaId: bacentas[3].id,
      joinedDate: '2023-07-08',
      createdDate: now,
      lastUpdated: now
    },
    
    // Love Assembly members
    {
      id: 'member_11',
      firstName: 'Matthew',
      lastName: 'Lee',
      phoneNumber: '+1-555-0111',
      buildingAddress: '852 Ash Dr, Springfield, IL',
      bornAgainStatus: true,
      bacentaId: bacentas[4].id,
      joinedDate: '2023-04-30',
      createdDate: now,
      lastUpdated: now
    },
    {
      id: 'member_12',
      firstName: 'Jessica',
      lastName: 'White',
      phoneNumber: '+1-555-0112',
      buildingAddress: '963 Hickory Ln, Springfield, IL',
      bornAgainStatus: true,
      bacentaId: bacentas[4].id,
      joinedDate: '2023-08-15',
      createdDate: now,
      lastUpdated: now
    },
    
    // Unassigned members
    {
      id: 'member_13',
      firstName: 'Daniel',
      lastName: 'Thompson',
      phoneNumber: '+1-555-0113',
      buildingAddress: '159 Walnut St, Springfield, IL',
      bornAgainStatus: false,
      bacentaId: '',
      joinedDate: '2023-09-01',
      createdDate: now,
      lastUpdated: now
    },
    {
      id: 'member_14',
      firstName: 'Ashley',
      lastName: 'Harris',
      phoneNumber: '+1-555-0114',
      buildingAddress: '357 Chestnut Ave, Springfield, IL',
      bornAgainStatus: true,
      bacentaId: '',
      joinedDate: '2023-09-20',
      createdDate: now,
      lastUpdated: now
    }
  ];
  
  return members;
};

export const createSampleAttendance = (members: Member[]): AttendanceRecord[] => {
  const records: AttendanceRecord[] = [];
  const today = new Date();
  const currentMonthSundays = getSundaysOfMonth(today.getFullYear(), today.getMonth());
  
  members.forEach(member => {
    currentMonthSundays.forEach((sundayDate, index) => {
      // Create varied attendance patterns
      let shouldAttend = true;
      
      // Some members have better attendance than others
      if (member.id === 'member_3' || member.id === 'member_6') {
        // These members have poor attendance (critical)
        shouldAttend = Math.random() > 0.7;
      } else if (member.id === 'member_9' || member.id === 'member_13') {
        // These members have moderate attendance
        shouldAttend = Math.random() > 0.4;
      } else {
        // Most members have good attendance
        shouldAttend = Math.random() > 0.2;
      }
      
      const status = shouldAttend ? 'Present' : 'Absent';
      records.push({
        id: `${member.id}_${sundayDate}`,
        memberId: member.id,
        date: sundayDate,
        status
      });
    });
  });
  
  return records;
};

export const initializeSampleData = () => {
  const bacentas = createSampleBacentas();
  const members = createSampleMembers(bacentas);
  const attendance = createSampleAttendance(members);
  
  // Save to localStorage
  localStorage.setItem('church_bacentas', JSON.stringify(bacentas));
  localStorage.setItem('church_members', JSON.stringify(members));
  localStorage.setItem('church_attendance', JSON.stringify(attendance));
  
  console.log('Sample data initialized:', {
    bacentas: bacentas.length,
    members: members.length,
    attendance: attendance.length
  });
  
  return { bacentas, members, attendance };
};
