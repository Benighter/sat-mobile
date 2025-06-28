// Data Migration Utility for localStorage to Firebase
import { 
  membersStorage, 
  bacentasStorage, 
  attendanceStorage, 
  newBelieversStorage,
  appStateStorage 
} from './localStorage';
import { 
  membersFirebaseService,
  bacentasFirebaseService,
  attendanceFirebaseService,
  newBelieversFirebaseService,
  firebaseUtils
} from '../services/firebaseService';
import { Member, Bacenta, AttendanceRecord, NewBeliever } from '../types';

export interface MigrationStatus {
  step: string;
  progress: number;
  total: number;
  completed: boolean;
  error?: string;
}

export interface MigrationResult {
  success: boolean;
  migratedCounts: {
    members: number;
    bacentas: number;
    attendance: number;
    newBelievers: number;
  };
  errors: string[];
  duration: number;
}

export class DataMigrationService {
  private onProgress?: (status: MigrationStatus) => void;

  constructor(onProgress?: (status: MigrationStatus) => void) {
    this.onProgress = onProgress;
  }

  private updateProgress(step: string, progress: number, total: number, error?: string) {
    if (this.onProgress) {
      this.onProgress({
        step,
        progress,
        total,
        completed: progress >= total,
        error
      });
    }
  }

  // Check if localStorage has data to migrate
  public hasLocalStorageData(): boolean {
    const members = membersStorage.load();
    const bacentas = bacentasStorage.load();
    const attendance = attendanceStorage.load();
    const newBelievers = newBelieversStorage.load();

    return members.length > 0 || bacentas.length > 0 || attendance.length > 0 || newBelievers.length > 0;
  }

  // Get localStorage data summary
  public getLocalStorageDataSummary() {
    return {
      members: membersStorage.load().length,
      bacentas: bacentasStorage.load().length,
      attendance: attendanceStorage.load().length,
      newBelievers: newBelieversStorage.load().length
    };
  }

  // Migrate all data from localStorage to Firebase
  public async migrateAllData(): Promise<MigrationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const migratedCounts = {
      members: 0,
      bacentas: 0,
      attendance: 0,
      newBelievers: 0
    };

    try {
      // Check if Firebase is ready
      if (!firebaseUtils.isReady()) {
        throw new Error('Firebase not ready. User must be authenticated.');
      }

      // Load all localStorage data
      const localMembers = membersStorage.load();
      const localBacentas = bacentasStorage.load();
      const localAttendance = attendanceStorage.load();
      const localNewBelievers = newBelieversStorage.load();

      const totalItems = localMembers.length + localBacentas.length + localAttendance.length + localNewBelievers.length;
      let processedItems = 0;

      // Migrate Bacentas first (as members reference them)
      this.updateProgress('Migrating Bacentas', 0, localBacentas.length);
      for (let i = 0; i < localBacentas.length; i++) {
        try {
          await bacentasFirebaseService.add(localBacentas[i]);
          migratedCounts.bacentas++;
          processedItems++;
          this.updateProgress('Migrating Bacentas', i + 1, localBacentas.length);
        } catch (error: any) {
          errors.push(`Failed to migrate bacenta ${localBacentas[i].name}: ${error.message}`);
        }
      }

      // Migrate Members
      this.updateProgress('Migrating Members', 0, localMembers.length);
      for (let i = 0; i < localMembers.length; i++) {
        try {
          await membersFirebaseService.add(localMembers[i]);
          migratedCounts.members++;
          processedItems++;
          this.updateProgress('Migrating Members', i + 1, localMembers.length);
        } catch (error: any) {
          errors.push(`Failed to migrate member ${localMembers[i].firstName} ${localMembers[i].lastName}: ${error.message}`);
        }
      }

      // Migrate New Believers
      this.updateProgress('Migrating New Believers', 0, localNewBelievers.length);
      for (let i = 0; i < localNewBelievers.length; i++) {
        try {
          await newBelieversFirebaseService.add(localNewBelievers[i]);
          migratedCounts.newBelievers++;
          processedItems++;
          this.updateProgress('Migrating New Believers', i + 1, localNewBelievers.length);
        } catch (error: any) {
          errors.push(`Failed to migrate new believer ${localNewBelievers[i].name}: ${error.message}`);
        }
      }

      // Migrate Attendance Records (in batches for better performance)
      this.updateProgress('Migrating Attendance Records', 0, localAttendance.length);
      const batchSize = 50;
      for (let i = 0; i < localAttendance.length; i += batchSize) {
        try {
          const batch = localAttendance.slice(i, i + batchSize);
          await attendanceFirebaseService.batchUpdate(batch);
          migratedCounts.attendance += batch.length;
          processedItems += batch.length;
          this.updateProgress('Migrating Attendance Records', Math.min(i + batchSize, localAttendance.length), localAttendance.length);
        } catch (error: any) {
          errors.push(`Failed to migrate attendance batch starting at index ${i}: ${error.message}`);
        }
      }

      const duration = Date.now() - startTime;
      this.updateProgress('Migration Complete', totalItems, totalItems);

      return {
        success: errors.length === 0,
        migratedCounts,
        errors,
        duration
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.updateProgress('Migration Failed', 0, 1, error.message);
      
      return {
        success: false,
        migratedCounts,
        errors: [error.message, ...errors],
        duration
      };
    }
  }

  // Backup localStorage data before migration
  public backupLocalStorageData(): string {
    const data = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      members: membersStorage.load(),
      bacentas: bacentasStorage.load(),
      attendance: attendanceStorage.load(),
      newBelievers: newBelieversStorage.load(),
      appState: {
        currentTab: appStateStorage.loadCurrentTab(),
        displayedDate: appStateStorage.loadDisplayedDate().toISOString()
      }
    };

    return JSON.stringify(data, null, 2);
  }

  // Clear localStorage data after successful migration
  public clearLocalStorageData(): void {
    try {
      membersStorage.clear();
      bacentasStorage.clear();
      attendanceStorage.clear();
      newBelieversStorage.clear();
      console.log('localStorage data cleared successfully');
    } catch (error: any) {
      console.error('Failed to clear localStorage data:', error.message);
      throw error;
    }
  }

  // Verify migration by comparing counts
  public async verifyMigration(): Promise<boolean> {
    try {
      const localCounts = this.getLocalStorageDataSummary();
      
      const [firebaseMembers, firebaseBacentas, firebaseAttendance, firebaseNewBelievers] = await Promise.all([
        membersFirebaseService.getAll(),
        bacentasFirebaseService.getAll(),
        attendanceFirebaseService.getAll(),
        newBelieversFirebaseService.getAll()
      ]);

      const firebaseCounts = {
        members: firebaseMembers.length,
        bacentas: firebaseBacentas.length,
        attendance: firebaseAttendance.length,
        newBelievers: firebaseNewBelievers.length
      };

      return (
        localCounts.members <= firebaseCounts.members &&
        localCounts.bacentas <= firebaseCounts.bacentas &&
        localCounts.attendance <= firebaseCounts.attendance &&
        localCounts.newBelievers <= firebaseCounts.newBelievers
      );
    } catch (error: any) {
      console.error('Failed to verify migration:', error.message);
      return false;
    }
  }
}

// Singleton instance for global use
export const dataMigrationService = new DataMigrationService();
