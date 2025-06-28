# Firebase Migration Guide

## Overview
This guide walks you through migrating your Church Connect Mobile app from localStorage to Firebase Firestore database.

## Prerequisites

### 1. Firebase Project Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use an existing one
3. Enable Firestore Database
4. Enable Authentication
5. Set up Authentication providers (Email/Password recommended)

### 2. Firebase Configuration
1. Copy `.env.example` to `.env`
2. Fill in your Firebase project configuration:
   ```env
   REACT_APP_FIREBASE_API_KEY=your-api-key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your-project-id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
   REACT_APP_FIREBASE_APP_ID=your-app-id
   ```

### 3. Firestore Security Rules
Apply these security rules in Firebase Console:

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

### 4. Create Initial User and Church
You'll need to manually create the first user and church documents:

1. **Create a user document** in `users` collection:
   ```json
   {
     "uid": "your-auth-uid",
     "email": "admin@yourchurch.com",
     "displayName": "Church Admin",
     "churchId": "your-church-id",
     "role": "admin",
     "createdAt": "2024-01-01T00:00:00.000Z",
     "lastLoginAt": "2024-01-01T00:00:00.000Z",
     "isActive": true
   }
   ```

2. **Create a church document** in `churches` collection:
   ```json
   {
     "name": "Your Church Name",
     "address": "Church Address",
     "contactInfo": {
       "phone": "+1234567890",
       "email": "contact@yourchurch.com"
     },
     "settings": {
       "timezone": "America/New_York",
       "defaultMinistries": ["choir", "ushers", "media"]
     },
     "createdAt": "2024-01-01T00:00:00.000Z",
     "lastUpdated": "2024-01-01T00:00:00.000Z"
   }
   ```

## Migration Steps

### Step 1: Switch to Firebase App
1. Update your main entry point to use the Firebase app:
   ```typescript
   // In index.tsx or main.tsx
   import FirebaseApp from './FirebaseApp';
   
   // Replace App with FirebaseApp
   root.render(<FirebaseApp />);
   ```

### Step 2: Authentication
1. Open the app - you'll see the login screen
2. Sign in with the credentials you set up
3. The app will authenticate and load the Firebase context

### Step 3: Data Migration
1. If you have existing localStorage data, you'll see a migration modal
2. **IMPORTANT**: Backup your data first using the "Backup Data First" button
3. Click "Start Migration" to transfer all data to Firebase
4. Wait for the migration to complete
5. Verify that all data has been migrated correctly

### Step 4: Verification
1. Check that all members, bacentas, new believers, and attendance records are present
2. Test creating new records to ensure Firebase operations work
3. Test offline functionality by toggling the offline mode

## Features

### Real-time Synchronization
- All data changes are synchronized in real-time across devices
- Multiple users can work simultaneously
- Changes appear instantly without page refresh

### Offline Support
- App works offline with cached data
- Changes made offline are synchronized when connection is restored
- Offline indicator shows current connection status

### Data Security
- All data is secured with Firebase Authentication
- Church-level data isolation
- Role-based access control ready for future implementation

### Backup and Export
- Export data as JSON for backup purposes
- Import functionality for data restoration
- Migration utilities for moving between environments

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify Firebase configuration in `.env`
   - Check that Authentication is enabled in Firebase Console
   - Ensure Email/Password provider is enabled

2. **Permission Denied Errors**
   - Verify Firestore security rules are correctly applied
   - Check that user document exists with correct `churchId`
   - Ensure church document exists

3. **Migration Failures**
   - Check browser console for detailed error messages
   - Verify internet connection is stable
   - Ensure sufficient Firestore quota

4. **Offline Issues**
   - Offline persistence only works in one browser tab at a time
   - Clear browser cache if offline mode isn't working
   - Check browser compatibility (modern browsers required)

### Performance Optimization

1. **Firestore Indexes**
   - Firebase will suggest composite indexes as you use the app
   - Create recommended indexes in Firebase Console for better performance

2. **Data Pagination**
   - For large datasets, consider implementing pagination
   - Current implementation loads all data for simplicity

3. **Caching Strategy**
   - Firebase automatically caches frequently accessed data
   - Offline persistence provides additional caching

## Development vs Production

### Development
- Use Firebase emulators for local development
- Set `REACT_APP_USE_FIREBASE_EMULATOR=true` in `.env`
- Install Firebase CLI and run emulators

### Production
- Use production Firebase project
- Ensure security rules are properly configured
- Monitor usage and costs in Firebase Console

## Support

For issues with the migration:
1. Check the browser console for error messages
2. Verify Firebase configuration
3. Test with a fresh browser profile
4. Contact your development team with specific error details

## Next Steps

After successful migration:
1. Train users on the new authentication system
2. Set up regular data backups
3. Monitor Firebase usage and costs
4. Consider implementing additional features like user roles
5. Set up Firebase monitoring and alerts
