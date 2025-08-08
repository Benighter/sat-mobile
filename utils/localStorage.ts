// Local + Session Storage Utility for SAT Mobile
import { Member, Bacenta, AttendanceRecord, TabOption, NewBeliever } from '../types';

// Storage keys (persistent)
const STORAGE_KEYS = {
  MEMBERS: 'church_connect_members',
  BACENTAS: 'church_connect_bacentas',
  ATTENDANCE_RECORDS: 'church_connect_attendance',
  NEW_BELIEVERS: 'church_connect_new_believers',
  CURRENT_TAB: 'church_connect_current_tab',
  DISPLAYED_DATE: 'church_connect_displayed_date',
  APP_VERSION: 'church_connect_version',
  LAST_BACKUP: 'church_connect_last_backup',
  THEME_PREFERENCE: 'church_connect_theme_preference',
} as const;

// Session storage keys (cleared when session ends)
const SESSION_KEYS = {
  NAV_STACK: 'church_connect_nav_stack',
  CURRENT_TAB: 'church_connect_session_current_tab',
} as const;

// Current app version for migration purposes
const APP_VERSION = '1.0.0';

// Generic storage functions
const setItem = <T>(key: string, value: T): void => {
  try {
    const serializedValue = JSON.stringify(value);
    localStorage.setItem(key, serializedValue);
  } catch (error) {
    console.error(`Error saving to localStorage (${key}):`, error);
  }
};

const getItem = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Error reading from localStorage (${key}):`, error);
    return defaultValue;
  }
};

const removeItem = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing from localStorage (${key}):`, error);
  }
};

// Session storage helpers
const setSessionItem = <T>(key: string, value: T): void => {
  try {
    const serializedValue = JSON.stringify(value);
    sessionStorage.setItem(key, serializedValue);
  } catch (error) {
    // Ignore session storage errors
  }
};

const getSessionItem = <T>(key: string, defaultValue: T): T => {
  try {
    const item = sessionStorage.getItem(key);
    if (item === null) return defaultValue;
    return JSON.parse(item) as T;
  } catch (error) {
    return defaultValue;
  }
};

const removeSessionItem = (key: string): void => {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    // Ignore
  }
};

// Members storage
export const membersStorage = {
  save: (members: Member[]): void => {
    setItem(STORAGE_KEYS.MEMBERS, members);
    updateLastBackup();
  },
  
  load: (): Member[] => {
    return getItem<Member[]>(STORAGE_KEYS.MEMBERS, []);
  },
  
  add: (member: Member): void => {
    const members = membersStorage.load();
    members.push(member);
    membersStorage.save(members);
  },
  
  update: (updatedMember: Member): void => {
    const members = membersStorage.load();
    const index = members.findIndex(m => m.id === updatedMember.id);
    if (index !== -1) {
      members[index] = updatedMember;
      membersStorage.save(members);
    }
  },
  
  remove: (memberId: string): void => {
    const members = membersStorage.load();
    const filteredMembers = members.filter(m => m.id !== memberId);
    membersStorage.save(filteredMembers);
    
    // Also remove related attendance records
    attendanceStorage.removeByMember(memberId);
  },
  
  clear: (): void => {
    removeItem(STORAGE_KEYS.MEMBERS);
  }
};

// Bacentas storage
export const bacentasStorage = {
  save: (bacentas: Bacenta[]): void => {
    setItem(STORAGE_KEYS.BACENTAS, bacentas);
    updateLastBackup();
  },
  
  load: (): Bacenta[] => {
    return getItem<Bacenta[]>(STORAGE_KEYS.BACENTAS, []);
  },
  
  add: (bacenta: Bacenta): void => {
    const bacentas = bacentasStorage.load();
    bacentas.push(bacenta);
    bacentasStorage.save(bacentas);
  },
  
  update: (updatedBacenta: Bacenta): void => {
    const bacentas = bacentasStorage.load();
    const index = bacentas.findIndex(b => b.id === updatedBacenta.id);
    if (index !== -1) {
      bacentas[index] = updatedBacenta;
      bacentasStorage.save(bacentas);
    }
  },
  
  remove: (bacentaId: string): void => {
    const bacentas = bacentasStorage.load();
    const filteredBacentas = bacentas.filter(b => b.id !== bacentaId);
    bacentasStorage.save(filteredBacentas);
    
    // Update members to remove bacenta assignment
    const members = membersStorage.load();
    const updatedMembers = members.map(member => 
      member.bacentaId === bacentaId 
        ? { ...member, bacentaId: undefined }
        : member
    );
    membersStorage.save(updatedMembers);
  },
  
  clear: (): void => {
    removeItem(STORAGE_KEYS.BACENTAS);
  }
};

// Attendance records storage
export const attendanceStorage = {
  save: (records: AttendanceRecord[]): void => {
    setItem(STORAGE_KEYS.ATTENDANCE_RECORDS, records);
    updateLastBackup();
  },
  
  load: (): AttendanceRecord[] => {
    return getItem<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE_RECORDS, []);
  },
  
  add: (record: AttendanceRecord): void => {
    const records = attendanceStorage.load();
    // Remove existing record for same member and date
    const filteredRecords = records.filter(
      r => !(r.memberId === record.memberId && r.date === record.date)
    );
    filteredRecords.push(record);
    attendanceStorage.save(filteredRecords);
  },
  
  update: (memberId: string, date: string, status: AttendanceRecord['status']): void => {
    const records = attendanceStorage.load();
    const existingIndex = records.findIndex(
      r => r.memberId === memberId && r.date === date
    );
    
    const newRecord: AttendanceRecord = {
      id: existingIndex !== -1 ? records[existingIndex].id : generateId(),
      memberId,
      date,
      status,
      markedAt: new Date().toISOString(),
    };
    
    if (existingIndex !== -1) {
      records[existingIndex] = newRecord;
    } else {
      records.push(newRecord);
    }
    
    attendanceStorage.save(records);
  },
  
  removeByMember: (memberId: string): void => {
    const records = attendanceStorage.load();
    const filteredRecords = records.filter(r => r.memberId !== memberId);
    attendanceStorage.save(filteredRecords);
  },
  
  clear: (): void => {
    removeItem(STORAGE_KEYS.ATTENDANCE_RECORDS);
  }
};

// New believers storage
export const newBelieversStorage = {
  save: (newBelievers: NewBeliever[]): void => {
    setItem(STORAGE_KEYS.NEW_BELIEVERS, newBelievers);
    updateLastBackup();
  },

  load: (): NewBeliever[] => {
    return getItem<NewBeliever[]>(STORAGE_KEYS.NEW_BELIEVERS, []);
  },

  add: (newBeliever: NewBeliever): void => {
    const newBelievers = newBelieversStorage.load();
    newBelievers.push(newBeliever);
    newBelieversStorage.save(newBelievers);
  },

  update: (updatedNewBeliever: NewBeliever): void => {
    const newBelievers = newBelieversStorage.load();
    const index = newBelievers.findIndex(nb => nb.id === updatedNewBeliever.id);
    if (index !== -1) {
      newBelievers[index] = updatedNewBeliever;
      newBelieversStorage.save(newBelievers);
    }
  },

  remove: (newBelieverId: string): void => {
    const newBelievers = newBelieversStorage.load();
    const filteredNewBelievers = newBelievers.filter(nb => nb.id !== newBelieverId);
    newBelieversStorage.save(filteredNewBelievers);
  },

  clear: (): void => {
    removeItem(STORAGE_KEYS.NEW_BELIEVERS);
  }
};

// App state storage (persistent across sessions)
export const appStateStorage = {
  saveCurrentTab: (tab: TabOption): void => {
    setItem(STORAGE_KEYS.CURRENT_TAB, tab);
  },

  loadCurrentTab: (): TabOption | null => {
    return getItem<TabOption | null>(STORAGE_KEYS.CURRENT_TAB, null);
  },

  saveDisplayedDate: (date: Date): void => {
    setItem(STORAGE_KEYS.DISPLAYED_DATE, date.toISOString());
  },

  loadDisplayedDate: (): Date => {
    const dateString = getItem<string>(STORAGE_KEYS.DISPLAYED_DATE, new Date().toISOString());
    return new Date(dateString);
  },

  clear: (): void => {
    removeItem(STORAGE_KEYS.CURRENT_TAB);
    removeItem(STORAGE_KEYS.DISPLAYED_DATE);
  }
};

// Session state storage (cleared on browser/app close)
export const sessionStateStorage = {
  saveNavStack: (stack: TabOption[]): void => {
    setSessionItem(SESSION_KEYS.NAV_STACK, stack);
  },
  loadNavStack: (): TabOption[] => {
    return getSessionItem<TabOption[]>(SESSION_KEYS.NAV_STACK, []);
  },
  saveCurrentTab: (tab: TabOption): void => {
    setSessionItem(SESSION_KEYS.CURRENT_TAB, tab);
  },
  loadCurrentTab: (): TabOption | null => {
    return getSessionItem<TabOption | null>(SESSION_KEYS.CURRENT_TAB, null);
  },
  clear: (): void => {
    removeSessionItem(SESSION_KEYS.NAV_STACK);
    removeSessionItem(SESSION_KEYS.CURRENT_TAB);
  }
};

// Theme storage
export const themeStorage = {
  saveTheme: (theme: 'light' | 'dark' | 'system'): void => {
    setItem(STORAGE_KEYS.THEME_PREFERENCE, theme);
  },

  loadTheme: (): 'light' | 'dark' | 'system' => {
    return getItem<'light' | 'dark' | 'system'>(STORAGE_KEYS.THEME_PREFERENCE, 'system');
  },

  clear: (): void => {
    removeItem(STORAGE_KEYS.THEME_PREFERENCE);
  }
};

// Backup and restore functions
export const backupStorage = {
  export: (): string => {
    const data = {
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      members: membersStorage.load(),
      bacentas: bacentasStorage.load(),
      attendanceRecords: attendanceStorage.load(),
      newBelievers: newBelieversStorage.load(),
      currentTab: appStateStorage.loadCurrentTab(),
      displayedDate: appStateStorage.loadDisplayedDate().toISOString(),
    };
    
    return JSON.stringify(data, null, 2);
  },
  
  import: (jsonData: string): boolean => {
    try {
      const data = JSON.parse(jsonData);
      
      // Validate data structure
      if (!data.version || !data.members || !data.bacentas || !data.attendanceRecords) {
        throw new Error('Invalid backup data structure');
      }

      // Import data
      membersStorage.save(data.members);
      bacentasStorage.save(data.bacentas);
      attendanceStorage.save(data.attendanceRecords);

      // Import new believers if available (for backward compatibility)
      if (data.newBelievers) {
        newBelieversStorage.save(data.newBelievers);
      }
      
      if (data.currentTab) {
        appStateStorage.saveCurrentTab(data.currentTab);
      }
      
      if (data.displayedDate) {
        appStateStorage.saveDisplayedDate(new Date(data.displayedDate));
      }
      
      updateLastBackup();
      return true;
    } catch (error) {
      console.error('Error importing backup:', error);
      return false;
    }
  },
  
  getLastBackupTime: (): Date | null => {
    const timestamp = getItem<string | null>(STORAGE_KEYS.LAST_BACKUP, null);
    return timestamp ? new Date(timestamp) : null;
  }
};

// Utility functions
const updateLastBackup = (): void => {
  setItem(STORAGE_KEYS.LAST_BACKUP, new Date().toISOString());
};

const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Storage info and management
export const storageInfo = {
  getUsage: (): { used: number; available: number; percentage: number } => {
    try {
      let used = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length + key.length;
        }
      }
      
      // Estimate 5MB as typical localStorage limit
      const available = 5 * 1024 * 1024;
      const percentage = (used / available) * 100;
      
      return { used, available, percentage };
    } catch (error) {
      return { used: 0, available: 0, percentage: 0 };
    }
  },
  
  clearAll: (): void => {
    Object.values(STORAGE_KEYS).forEach(key => {
      removeItem(key);
    });
  },
  
  getStorageKeys: (): string[] => {
    return Object.values(STORAGE_KEYS);
  }
};

// Initialize storage version
const initializeStorage = (): void => {
  const currentVersion = getItem<string>(STORAGE_KEYS.APP_VERSION, '');
  if (currentVersion !== APP_VERSION) {
    // Handle version migration here if needed
    setItem(STORAGE_KEYS.APP_VERSION, APP_VERSION);
  }
};

// Initialize on import
initializeStorage();
