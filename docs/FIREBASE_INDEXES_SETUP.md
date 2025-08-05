# Firebase Indexes Setup Guide

This document explains how to set up the required Firebase Firestore indexes for the SAT Mobile notification system.

## Current Status

⚠️ **Temporary Workaround Active**: The notification system is currently using in-memory sorting to avoid index requirements. This works but has slightly reduced performance for large datasets.

## Required Indexes

### Notification System Index

For optimal performance of the admin notification system, you need to create a composite index:

**Collection**: `churches/{churchId}/notifications`

**Fields**:
1. `adminId` (Ascending)
2. `timestamp` (Descending) 
3. `__name__` (Ascending) - automatically added by Firebase

## How to Create the Index

### Option 1: Use the Firebase Console Link (Easiest)

When you see the error in the console, click the provided link:
```
https://console.firebase.google.com/v1/r/project/sat-mobile-de6f1/firestore/indexes
```

This will take you directly to the Firebase Console where you can create the index automatically.

### Option 2: Manual Creation in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `sat-mobile-de6f1`
3. Navigate to **Firestore Database** → **Indexes** tab
4. Click **Create Index**
5. Set up the index:
   - **Collection ID**: `notifications`
   - **Field path 1**: `adminId` → **Query scope**: Collection → **Order**: Ascending
   - **Field path 2**: `timestamp` → **Query scope**: Collection → **Order**: Descending
   - Click **Create**

### Option 3: Using Firebase CLI

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Create a `firestore.indexes.json` file in your project root:

```json
{
  "indexes": [
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "adminId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "timestamp",
          "order": "DESCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
```

4. Deploy indexes: `firebase deploy --only firestore:indexes`

## After Creating the Index

Once the index is created and built (usually takes a few minutes):

1. **Remove the temporary workaround** from `services/notificationService.ts`
2. **Restore the optimized queries** with `orderBy` clauses
3. **Test the notification system** to ensure it works properly

### Code Changes to Make After Index Creation

In `services/notificationService.ts`, restore these optimized queries:

```typescript
// In getForAdmin function - restore this:
const q = query(
  notificationsRef,
  where('adminId', '==', adminId),
  orderBy('timestamp', 'desc'),
  limit(limitCount)
);

// In onSnapshot function - restore this:
const q = query(
  notificationsRef,
  where('adminId', '==', adminId),
  orderBy('timestamp', 'desc'),
  limit(100)
);
```

## Performance Benefits

After creating the index:
- ✅ **Faster queries**: Database-level sorting instead of in-memory sorting
- ✅ **Better scalability**: Works efficiently with large notification datasets  
- ✅ **Reduced bandwidth**: Proper limits applied at database level
- ✅ **Real-time efficiency**: Optimized real-time listeners

## Troubleshooting

### Index Building Time
- Small projects: 1-5 minutes
- Large projects: Up to 30 minutes
- Check progress in Firebase Console → Firestore → Indexes

### Index Not Working
1. Verify the index status is "Enabled" in Firebase Console
2. Check that field names match exactly (`adminId`, `timestamp`)
3. Ensure you're using the correct collection path format

### Multiple Church Support
Since notifications are stored per church (`churches/{churchId}/notifications`), the index will work for all churches automatically.

## Future Indexes

As the notification system grows, you might need additional indexes for:
- Filtering by activity type: `adminId + activityType + timestamp`
- Date range queries: `adminId + timestamp` (already covered)
- Read status filtering: `adminId + isRead + timestamp`

These can be added following the same process when needed.