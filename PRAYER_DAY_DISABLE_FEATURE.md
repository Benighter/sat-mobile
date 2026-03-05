# Prayer Day Disable/Enable Feature

## Overview
This feature allows administrators to disable specific prayer days (Tuesday through Sunday) so that they don't affect anyone's prayer attendance tracking. Disabled days only affect current and future dates, leaving past prayer records unaffected.

## Key Features

### 1. **Disable Days from Current Date Forward**
- When a day is disabled, it affects only the current date and future dates
- Past prayer records remain completely unaffected
- The system tracks the date from which each day was disabled

### 2. **Re-enable Days**
- When a day is re-enabled, it only affects current and future dates
- Days that were disabled in the past remain disabled for those historical dates
- This ensures data integrity and prevents retroactive changes

### 3. **Visual Indicators**
- Disabled days are highlighted in red in the prayer table
- Table headers show "DISABLED" instead of prayer times for disabled days
- Table cells for disabled days have a red background
- Tooltips explain that the day is disabled

### 4. **Attendance Marking Prevention**
- Users cannot mark prayer attendance on disabled days
- Disabled days show 0 hours in the prayer schedule
- Weekly totals automatically exclude disabled days

## How to Use

### For Administrators

#### Disabling a Day
1. Navigate to the Prayer view
2. Click on any day header in the prayer table
3. The "Edit Prayer Times" modal will open
4. Find the day you want to disable
5. Toggle the switch from "Enabled" (green) to "Disabled" (red)
6. The day will be disabled from today onwards
7. Click "Save" to apply changes

#### Re-enabling a Day
1. Follow steps 1-3 above
2. Find the disabled day (shown in red)
3. Toggle the switch from "Disabled" (red) to "Enabled" (green)
4. The day will be enabled from today onwards
5. Click "Save" to apply changes

### For Regular Users
- Disabled days will appear with a red background in the prayer table
- You cannot mark attendance on disabled days
- Disabled days don't count towards your weekly prayer hours

## Technical Implementation

### Database Schema
The `PrayerSchedule` interface now includes a `disabledDays` field:

```typescript
interface PrayerSchedule {
  id: string;
  weekStart?: string;
  isPermanent: boolean;
  times: {
    tuesday: { start: string; end: string };
    wednesday: { start: string; end: string };
    thursday: { start: string; end: string };
    friday: { start: string; end: string };
    saturday: { start: string; end: string };
    sunday: { start: string; end: string };
  };
  // New field
  disabledDays?: {
    tuesday?: string;    // Date from which Tuesday is disabled (YYYY-MM-DD)
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  };
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}
```

### How It Works

1. **Disabling a Day**: When you disable a day (e.g., Thursday), the system stores today's date in `disabledDays.thursday`
2. **Checking if Disabled**: When displaying or calculating prayer hours, the system checks:
   - Is there a `disabledDays.thursday` value?
   - Is the current date >= the disabled date?
   - If yes, the day is disabled for that date
3. **Re-enabling**: When you re-enable a day, the system removes the date from `disabledDays.thursday`
4. **Historical Integrity**: Past dates that were disabled remain disabled because the check compares the date being viewed with the disabled-from date

### Files Modified

1. **types.ts**: Added `disabledDays` field to `PrayerSchedule` interface
2. **utils/prayerUtils.ts**: Updated `getPrayerSessionInfo()` to check for disabled days and return 0 hours
3. **components/prayer/EditPrayerTimesModal.tsx**: Added UI controls to disable/enable days
4. **components/prayer/PrayerView.tsx**: Updated table to visually indicate disabled days and prevent marking attendance

## Examples

### Example 1: Disabling Thursday
- Today is October 29, 2025
- Admin disables Thursday
- Result:
  - Thursday, October 30, 2025 and all future Thursdays are disabled
  - Thursday, October 23, 2025 and all past Thursdays remain enabled
  - Users cannot mark attendance on October 30 or future Thursdays
  - Past Thursday records are unchanged

### Example 2: Re-enabling Thursday
- Today is November 5, 2025
- Admin re-enables Thursday (which was disabled on October 29)
- Result:
  - Thursday, November 6, 2025 and all future Thursdays are enabled
  - Thursdays from October 30 to November 5 remain disabled
  - Users can mark attendance on November 6 and future Thursdays
  - Historical disabled period (Oct 30 - Nov 5) is preserved

## Benefits

1. **Flexibility**: Easily handle special circumstances (holidays, church events, etc.)
2. **Data Integrity**: Past records are never affected by current changes
3. **Transparency**: Clear visual indicators show which days are disabled
4. **Simplicity**: Simple toggle interface for administrators
5. **Accuracy**: Weekly totals automatically adjust for disabled days

## Notes

- Only administrators can disable/enable days
- Changes apply to both permanent (default) and week-specific schedules
- Disabled days show 0 hours in prayer calculations
- The feature works seamlessly with existing prayer time customization

