# Firebase Firestore Indexes Setup

## Overview
Your SAT Mobile app requires composite indexes in Firestore for optimal performance. The app currently works with temporary workarounds, but setting up proper indexes will improve performance.

## Required Indexes

### 1. Members Collection
**Collection ID:** `churches/{churchId}/members`
**Fields:**
- `isActive` (Ascending)
- `lastName` (Ascending)

### 2. New Believers Collection  
**Collection ID:** `churches/{churchId}/newBelievers`
**Fields:**
- `isActive` (Ascending)
- `joinedDate` (Descending)

### 3. Attendance Collection
**Collection ID:** `churches/{churchId}/attendance`
**Fields:**
- `date` (Descending)

## How to Create Indexes

### Method 1: Automatic Creation (Recommended)
1. Use the app normally - Firebase will detect missing indexes
2. Check browser console for index creation links
3. Click the provided links to auto-create indexes
4. Example link format: `https://console.firebase.google.com/v1/r/project/sat-mobile-de6f1/firestore/indexes?create_composite=...`

### Method 2: Manual Creation
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `sat-mobile-de6f1`
3. Navigate to **Firestore Database** → **Indexes**
4. Click **Create Index**
5. Add the fields as specified above

### Method 3: Using Firebase CLI
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firestore in your project
firebase init firestore

# Deploy indexes (if you have firestore.indexes.json)
firebase deploy --only firestore:indexes
```

## Current Status
✅ **App is functional** - Using in-memory sorting as temporary workaround
⚠️ **Performance impact** - Queries may be slower without proper indexes
🎯 **Recommended** - Set up indexes for production use

## Verification
After creating indexes:
1. Refresh your app
2. Check browser console - index errors should disappear
3. App performance should improve, especially with large datasets

## Notes
- Indexes may take a few minutes to build
- The app will continue working during index creation
- Each church gets its own data collection path for isolation
- Indexes are shared across all churches but scoped by collection path

## Support
If you encounter issues:
1. Check Firebase Console for index build status
2. Verify your Firebase project permissions
3. Ensure you're using the correct project ID: `sat-mobile-de6f1`
