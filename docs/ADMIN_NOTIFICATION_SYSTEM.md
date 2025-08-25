# Admin Notification System

## Note on Admin Invites and Cross-Tenant Access

When an administrator invites another administrator who already has their own members/bacentas (i.e., existing data under their church), accepting the invite will no longer demote them to a leader or change their church. Instead, a cross-tenant access link is created so the inviter can switch (view-as) into the invited admin’s church. This link is read-only by default unless upgraded separately.

This document explains the Admin Notification System implemented for SAT Mobile, which allows admins to monitor their linked leaders' activities in real-time.

## Overview

The notification system tracks leader activities and sends notifications only to admins who are specifically linked to those leaders, maintaining proper role-based access control.

## System Architecture

### Core Components

1. **Types** (`types.ts`)
   - `AdminNotification`: Core notification data structure
   - `NotificationActivityType`: Enum of trackable activities

2. **Notification Service** (`services/notificationService.ts`)
   - Firebase operations for notifications
   - Real-time listening capabilities
   - Admin-leader relationship management

3. **UI Components**
   - `NotificationBadge`: Header notification icon with unread count
   - `NotificationCenter`: Modal displaying notification list

4. **Integration Service** (`services/notificationIntegration.ts`)
   - Wraps existing Firebase operations
   - Automatically creates notifications for leader activities

## Features

### Tracked Activities

The system automatically tracks the following leader activities:

- **Member Management**
  - Adding new members
  - Updating member information
  - Changing member roles

- **Attendance Tracking**
  - Confirming Sunday service attendance
  - Batch attendance confirmations

- **New Believer Management**
  - Adding new believers
  - Updating new believer information

- **Guest Management**
  - Adding guests to bacentas

- **Other Actions**
  - Freezing and unfreezing members
  - Converting guests/outreach to permanent members
  - Changing bacenta assignment

### Role-Based Filtering

- Only **admins** receive notifications
- Notifications are sent only to admins who **invited/linked** specific leaders
- Leaders don't receive notifications about other leaders' activities
- Maintains existing admin-leader relationship structure

## Usage Guide

### For Developers

#### 1. Setting Up Notification Context

```typescript
import { setNotificationIntegrationContext } from '../services/notificationIntegration';
import { setNotificationContext } from '../services/notificationService';

// In your app context or auth handler
useEffect(() => {
  if (user && churchId) {
    setNotificationIntegrationContext(user, churchId);
    setNotificationContext(user, churchId);
  }
}, [user, churchId]);
```

#### 2. Using Notification-Enabled Operations

Instead of using direct Firebase service functions, use the notification-enabled wrappers:

```typescript
// OLD WAY
import { membersFirebaseService } from '../services/firebaseService';
await membersFirebaseService.add(memberData);

// NEW WAY (with notifications)
import { memberOperationsWithNotifications } from '../services/notificationIntegration';
await memberOperationsWithNotifications.add(memberData);
```

#### 3. Available Notification-Enabled Operations

```typescript
// Member operations
memberOperationsWithNotifications.add(memberData)
memberOperationsWithNotifications.update(memberId, updates, originalMember)
memberOperationsWithNotifications.delete(memberId, memberName)

// New believer operations
newBelieverOperationsWithNotifications.add(newBelieverData)
newBelieverOperationsWithNotifications.update(id, updates, original)

// Guest operations
guestOperationsWithNotifications.add(guestData)

// Confirmation operations
confirmationOperationsWithNotifications.batchConfirm(confirmations, date)
confirmationOperationsWithNotifications.addOrUpdate(confirmation)
```

### For Component Integration

#### Adding Notifications to Existing Forms

1. **Import notification-enabled operations**:
```typescript
import { memberOperationsWithNotifications } from '../services/notificationIntegration';
```

2. **Replace service calls**:
```typescript
// In your form submission handler
const handleSubmit = async (formData) => {
  try {
    // This will automatically create notifications for linked admins
    await memberOperationsWithNotifications.add(formData);
    showToast('success', 'Member added successfully');
  } catch (error) {
    showToast('error', 'Failed to add member');
  }
};
```

3. **Set up context** (usually done in App.tsx or main context):
```typescript
import { setNotificationIntegrationContext } from '../services/notificationIntegration';

useEffect(() => {
  if (userProfile && currentChurchId) {
    setNotificationIntegrationContext(userProfile, currentChurchId);
  }
}, [userProfile, currentChurchId]);
```

## UI Components Usage

### NotificationBadge

Already integrated in the header (App.tsx). Shows:
- Bell icon for admins only
- Red badge with unread count
- Click opens NotificationCenter

### NotificationCenter

- Modal with notification list
- Mark as read functionality
- Delete notifications
- Real-time updates
- Activity type icons and descriptions

## Database Structure

### Notifications Collection

```
churches/{churchId}/notifications/{notificationId}
```

### Notification Document Structure

```typescript
{
  id: string;
  leaderId: string;          // Leader who performed the action
  leaderName: string;        // Cached leader name
  adminId: string;           // Admin who should receive notification
  activityType: NotificationActivityType;
  timestamp: string;         // ISO timestamp
  isRead: boolean;
  churchId: string;
  
  details: {
    memberName?: string;
    memberRole?: string;
    bacentaName?: string;
    attendanceDate?: string;
    newBelieverName?: string;
    guestName?: string;
    description: string;     // Human-readable description
  };
  
  metadata?: {
    previousValue?: string;
    newValue?: string;
    attendanceCount?: number;
    [key: string]: any;
  };
}
```

## Admin-Leader Relationship Detection

The system automatically detects which admins should receive notifications by:

1. Querying the `adminInvites` collection
2. Finding accepted invites where `invitedUserId` matches the leader's ID
3. Extracting the `createdBy` field (admin's ID) from those invites
4. Creating notifications for those linked admins only

## Performance Considerations

- **Real-time listeners**: Limited to 100 most recent notifications per admin
- **Cleanup**: Automatic deletion of notifications older than 30 days
- **Batch operations**: Multiple notifications created efficiently using Firebase batch writes
- **Offline support**: Notifications sync when connection is restored

## Security

- **Role-based access**: Only admins can see notification UI
- **Church scoping**: All notifications are scoped to specific churches
- **Admin filtering**: Notifications only sent to linked admins, not all admins

## Troubleshooting

### Notifications Not Appearing

1. **Check admin role**: Ensure user has `role: 'admin'`
2. **Verify church context**: Ensure `currentChurchId` is set
3. **Check admin-leader links**: Verify admin invited the leader via `adminInvites`

### Performance Issues

1. **Limit notification queries**: Use pagination for large notification lists
2. **Clean up old notifications**: Run cleanup function periodically
3. **Optimize real-time listeners**: Unsubscribe when components unmount

### Debug Mode

```typescript
// Enable debug logging
import { notificationService } from '../services/notificationService';

// Check unread count
const count = await notificationService.getUnreadCount(adminId);
console.log('Unread notifications:', count);

// Check admin-leader relationships
// (Internal function - check notificationService.ts)
```

## Future Enhancements

Potential future improvements:

1. **Push notifications**: Mobile/browser push notifications
2. **Email notifications**: Daily/weekly digest emails
3. **Notification preferences**: Allow admins to customize notification types
4. **Batch notifications**: Group similar activities together
5. **Analytics**: Track notification engagement and effectiveness

## Migration Guide

### Existing Components

To add notifications to existing components:

1. Import notification-enabled operations
2. Replace direct Firebase service calls
3. Ensure context is set up
4. Test with admin and leader roles

### Example Migration

```typescript
// Before
import { membersFirebaseService } from '../services/firebaseService';

const addMember = async (memberData) => {
  await membersFirebaseService.add(memberData);
};

// After
import { memberOperationsWithNotifications } from '../services/notificationIntegration';

const addMember = async (memberData) => {
  await memberOperationsWithNotifications.add(memberData);
};
```

This migration ensures that leader activities automatically generate notifications for their linked admins without any additional code changes.