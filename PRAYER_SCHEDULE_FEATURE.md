# Prayer Schedule Customization Feature

## Overview
This feature allows **administrators only** to customize prayer session times for any week (past, present, or future). Changes can be applied to a specific week or set as the permanent default for all future weeks. The UI updates in real-time to reflect the changes.

## Key Features

### 1. **Admin-Only Access**
- Only users with admin privileges can edit prayer times
- Leaders and regular members see the times but cannot modify them
- Clickable day headers are only available to admins

### 2. **Flexible Scheduling**
- **Week-Specific**: Apply custom times to a specific week only
- **Permanent Default**: Set new default times for all future weeks
- **No Date Restrictions**: Admins can edit times for past, present, and future weeks

### 3. **Real-Time Updates**
- Changes are immediately reflected in the UI via Firestore listeners
- Success indicator shows when save is complete
- Visual indicators show which days have custom schedules

### 4. **Visual Indicators**
- **Blue border & background**: Days with custom schedules
- **Blue dot badge**: Indicates custom schedule (week-specific or default)
- **Hover tooltips**: Show schedule type and allow editing (admin only)

## How to Use

### For Administrators:

1. **Navigate to Prayer View**
   - Go to the Prayer tab in the application

2. **Click on Any Day Header**
   - Click on Tuesday, Wednesday, Thursday, Friday, Saturday, or Sunday
   - A modal will open showing the current times for that week

3. **Edit Times**
   - Modify start and end times for any day (24-hour format)
   - Times are independent for each day

4. **Choose Scope**
   - **Unchecked** (default): Changes apply only to this specific week
   - **Checked**: Changes become the new default for all future weeks

5. **Save**
   - Click "Save for This Week" or "Save as Default"
   - Success message appears confirming the save
   - Modal closes automatically after 800ms
   - Table updates immediately to show new times

### For Leaders/Members:

- View prayer times in the table headers
- See visual indicators for customized schedules
- Cannot edit times (headers are not clickable)

## Technical Implementation

### Data Structure

#### PrayerSchedule Type
```typescript
interface PrayerSchedule {
  id: string; // 'default' for permanent, or Tuesday date (YYYY-MM-DD) for week-specific
  weekStart?: string; // Tuesday date for week-specific schedules
  isPermanent: boolean; // true for default schedule
  times: {
    tuesday: { start: string; end: string };
    wednesday: { start: string; end: string };
    thursday: { start: string; end: string };
    friday: { start: string; end: string };
    saturday: { start: string; end: string };
    sunday: { start: string; end: string };
  };
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}
```

### Schedule Priority

The system uses the following priority when determining which times to display:

1. **Week-Specific Schedule** (highest priority)
   - ID: Tuesday date of the week (e.g., "2025-01-07")
   - `isPermanent: false`
   - Only applies to that specific week

2. **Default Schedule** (medium priority)
   - ID: "default"
   - `isPermanent: true`
   - Applies to all weeks that don't have a week-specific schedule

3. **Hardcoded Defaults** (lowest priority - fallback)
   - Tuesday/Friday: 04:30-06:30 (2 hours)
   - Wednesday/Thursday: 04:00-06:00 (2 hours)
   - Saturday/Sunday: 05:00-07:00 (2 hours)

### Files Modified

1. **types.ts**
   - Added `PrayerSchedule` interface

2. **services/firebaseService.ts**
   - Added `prayerScheduleFirebaseService` with full CRUD operations
   - Methods: `getAll()`, `getDefault()`, `getByWeek()`, `addOrUpdate()`, `delete()`, `onSnapshot()`

3. **utils/prayerUtils.ts**
   - Updated `getPrayerSessionInfo()` to accept optional `schedules` parameter
   - Implements priority logic: week-specific > default > hardcoded
   - Calculates hours dynamically from start/end times

4. **contexts/FirebaseAppContext.tsx**
   - Added `prayerSchedules` state
   - Added `savePrayerScheduleHandler()` and `deletePrayerScheduleHandler()`
   - Added real-time listener for prayer schedules
   - Integrated schedule fetching in `fetchInitialData()`

5. **components/prayer/EditPrayerTimesModal.tsx**
   - New modal component for editing prayer times
   - Shows current times with option to edit
   - Toggle for permanent vs week-specific
   - Success indicator with auto-close

6. **components/prayer/PrayerView.tsx**
   - Made day headers clickable (admin only)
   - Integrated edit modal
   - Added visual indicators for custom schedules
   - Uses `getPrayerSessionInfo()` with schedules

7. **components/prayer/PrayerMemberDetailsView.tsx**
   - Updated to use custom schedules when calculating hours

## Firestore Structure

### Collection: `churches/{churchId}/prayerSchedules`

#### Default Schedule Document
```
ID: "default"
{
  id: "default",
  isPermanent: true,
  times: {
    tuesday: { start: "04:30", end: "06:30" },
    wednesday: { start: "04:00", end: "06:00" },
    thursday: { start: "04:00", end: "06:00" },
    friday: { start: "04:30", end: "06:30" },
    saturday: { start: "05:00", end: "07:00" },
    sunday: { start: "05:00", end: "07:00" }
  },
  createdAt: "2025-01-15T10:30:00.000Z",
  createdBy: "admin-uid",
  updatedAt: "2025-01-15T10:30:00.000Z",
  updatedBy: "admin-uid"
}
```

#### Week-Specific Schedule Document
```
ID: "2025-01-07" (Tuesday date)
{
  id: "2025-01-07",
  weekStart: "2025-01-07",
  isPermanent: false,
  times: {
    tuesday: { start: "05:00", end: "07:00" },
    wednesday: { start: "05:00", end: "07:00" },
    thursday: { start: "05:00", end: "07:00" },
    friday: { start: "05:00", end: "07:00" },
    saturday: { start: "06:00", end: "08:00" },
    sunday: { start: "06:00", end: "08:00" }
  },
  createdAt: "2025-01-15T10:30:00.000Z",
  createdBy: "admin-uid",
  updatedAt: "2025-01-15T10:30:00.000Z",
  updatedBy: "admin-uid"
}
```

## User Experience

### Admin Experience
1. Sees clickable day headers with hover effect
2. Clicks to open edit modal
3. Edits times as needed
4. Chooses scope (week-specific or permanent)
5. Saves and sees success message
6. Table updates immediately with new times
7. Visual indicators show customized days

### Leader/Member Experience
1. Sees prayer times in table headers
2. Visual indicators show when times are customized
3. Cannot click or edit times
4. Benefits from accurate, up-to-date schedule information

## Benefits

1. **Flexibility**: Accommodate special events, holidays, or seasonal changes
2. **Historical Accuracy**: Edit past weeks if times were recorded incorrectly
3. **Future Planning**: Set up schedules in advance
4. **Transparency**: Visual indicators show when custom schedules are in use
5. **Real-Time**: Changes appear immediately for all users
6. **Admin Control**: Only authorized users can modify schedules
7. **Audit Trail**: Tracks who created/updated schedules and when

## Example Use Cases

1. **Holiday Schedule**: Set special times for Christmas week
2. **Summer Hours**: Change default times for summer months
3. **Correction**: Fix incorrectly recorded times from past weeks
4. **Special Event**: Adjust times for a specific week due to church event
5. **Permanent Change**: Update default times when church policy changes

