# Firestore Data Structure Design

## Overview
This document outlines the Firestore database structure for the SAT Mobile application, migrating from localStorage to Firebase Firestore.

## Collections Structure

### 1. Users Collection (`users`)
```
users/{userId}
├── email: string
├── displayName: string
├── role: string ('admin' | 'leader' | 'member')
├── churchId: string (reference to church)
├── createdAt: timestamp
├── lastLoginAt: timestamp
└── isActive: boolean
```

### 2. Churches Collection (`churches`)
```
churches/{churchId}
├── name: string
├── address: string
├── contactInfo: object
│   ├── phone: string
│   └── email: string
├── settings: object
│   ├── timezone: string
│   └── defaultMinistries: string[]
├── createdAt: timestamp
└── lastUpdated: timestamp
```

### 3. Bacentas Collection (`churches/{churchId}/bacentas`)
```
bacentas/{bacentaId}
├── id: string
├── name: string
├── createdAt: timestamp
└── lastUpdated: timestamp
```

### 4. Members Collection (`churches/{churchId}/members`)
```
members/{memberId}
├── id: string
├── firstName: string
├── lastName: string
├── phoneNumber: string
├── buildingAddress: string
├── bornAgainStatus: boolean
├── bacentaId: string (reference to bacenta)
├── joinedDate: string (YYYY-MM-DD)
├── createdDate: string (ISO)
├── lastUpdated: string (ISO)
└── isActive: boolean
```

### 5. New Believers Collection (`churches/{churchId}/newBelievers`)
```
newBelievers/{newBelieverId}
├── id: string
├── name: string
├── surname: string
├── contact: string
├── dateOfBirth: string (YYYY-MM-DD)
├── residence: string
├── studies: string
├── campus: string
├── occupation: string
├── year: string
├── isFirstTime: boolean
├── ministry: string
├── joinedDate: string (YYYY-MM-DD)
├── createdDate: string (ISO)
├── lastUpdated: string (ISO)
└── isActive: boolean
```

### 6. Attendance Records Collection (`churches/{churchId}/attendance`)
```
attendance/{attendanceId}
├── id: string (memberId_date or newBelieverId_date)
├── memberId?: string (for regular members)
├── newBelieverId?: string (for new believers)
├── date: string (YYYY-MM-DD)
├── status: string ('Present' | 'Absent')
├── recordedAt: timestamp
└── recordedBy: string (userId)
```

## Security Rules Structure

### Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Church data access based on user's churchId
    match /churches/{churchId} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.churchId == churchId;
      
      // Subcollections inherit church-level permissions
      match /{collection}/{document} {
        allow read, write: if request.auth != null && 
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.churchId == churchId;
      }
    }
  }
}
```

## Data Migration Strategy

### Phase 1: Parallel Operation
- Keep localStorage as primary
- Sync writes to both localStorage and Firestore
- Read from localStorage for consistency

### Phase 2: Firebase Primary
- Switch to Firestore as primary data source
- Keep localStorage as backup/cache
- Implement offline support

### Phase 3: Full Migration
- Remove localStorage dependencies
- Full Firestore operation with offline persistence

## Indexing Strategy

### Composite Indexes Needed
1. `attendance` collection:
   - `date` (ascending) + `memberId` (ascending)
   - `date` (ascending) + `newBelieverId` (ascending)
   - `memberId` (ascending) + `date` (descending)

2. `members` collection:
   - `bacentaId` (ascending) + `lastUpdated` (descending)
   - `bornAgainStatus` (ascending) + `joinedDate` (descending)

3. `newBelievers` collection:
   - `ministry` (ascending) + `joinedDate` (descending)
   - `isFirstTime` (ascending) + `createdDate` (descending)

## Real-time Subscriptions

### Key Collections for Real-time Updates
1. Members - for live member list updates
2. Attendance - for real-time attendance tracking
3. New Believers - for immediate new believer registration
4. Bacentas - for organizational structure changes

## Offline Support Strategy

### Firestore Offline Persistence
- Enable offline persistence for all collections
- Implement conflict resolution for concurrent edits
- Cache critical data for offline operation

### Data Synchronization
- Automatic sync when connection restored
- Manual sync trigger for user control
- Sync status indicators in UI
