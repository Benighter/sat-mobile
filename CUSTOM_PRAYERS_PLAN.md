# Custom Prayers Feature - Implementation Plan

## 1. Data Structure & Schema

### Firestore Collection Structure
```
churches/{churchId}/customPrayers/{customPrayerId}
```

### CustomPrayer Interface
```typescript
interface CustomPrayer {
  id: string;
  memberId: string;
  name: string; // e.g., "Personal Prayer", "All-night Vigil"
  category: 'Personal' | 'All-night Vigil' | 'Quiet Time' | 'Other';
  customCategory?: string; // For 'Other' category
  
  // Days of week (true = active on that day)
  days: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  
  // Time configuration
  startTime: string; // HH:MM format (24-hour)
  endTime: string; // HH:MM format (24-hour)
  
  // Metadata
  isActive: boolean;
  createdAt: string; // ISO timestamp
  createdBy: string; // User ID
  updatedAt?: string;
  updatedBy?: string;
}
```

### CustomPrayerRecord Interface
```typescript
interface CustomPrayerRecord {
  id: string; // customPrayerId_memberId_date
  customPrayerId: string;
  memberId: string;
  date: string; // YYYY-MM-DD
  status: 'Prayed' | 'Missed';
  recordedAt?: string;
  recordedBy?: string;
}
```

## 2. Time Calculation Logic

### Overnight Prayer Handling
```typescript
function calculatePrayerDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  // If end time is less than start time, it crosses midnight
  if (endMinutes < startMinutes) {
    // Add 24 hours (1440 minutes) to end time
    return (endMinutes + 1440 - startMinutes) / 60;
  }
  
  return (endMinutes - startMinutes) / 60;
}

function isOvernightPrayer(startTime: string, endTime: string): boolean {
  const [startHour] = startTime.split(':').map(Number);
  const [endHour] = endTime.split(':').map(Number);
  return endHour < startHour;
}
```

## 3. UI Components

### A. Custom Prayers Management View
**Location**: New tab or section in Prayer view
**Components**:
- `CustomPrayersView.tsx` - Main view showing list of custom prayers
- `CustomPrayerFormModal.tsx` - Add/Edit modal
- `CustomPrayerCard.tsx` - Individual prayer card with details

### B. Member Details Integration
**Location**: `PrayerMemberDetailsView.tsx`
**Additions**:
- Show custom prayers alongside church prayers
- Combined statistics (total hours from both)
- Separate sections for clarity

### C. Custom Prayer Tracking
**Location**: New component or integrated into existing prayer tracking
**Features**:
- Weekly grid for each custom prayer
- Mark Prayed/Missed for each day
- Visual indicators for overnight prayers

## 4. Permissions Matrix

| Action | Member (Own) | Leader (Bacenta) | Admin |
|--------|--------------|------------------|-------|
| View own custom prayers | ✅ | ✅ | ✅ |
| Create custom prayer | ✅ | ❌ | ✅ |
| Edit own custom prayer | ✅ | ❌ | ✅ |
| Delete own custom prayer | ✅ | ❌ | ✅ |
| View others' custom prayers | ❌ | ✅ (bacenta only) | ✅ |
| Mark own attendance | ✅ | ❌ | ✅ |
| Edit others' custom prayers | ❌ | ❌ | ✅ |

## 5. Implementation Steps

### Phase 1: Data Layer (Steps 1-3)
1. ✅ Create TypeScript interfaces in `types.ts`
2. ✅ Create Firebase service in `services/firebaseService.ts`
3. ✅ Add context state and handlers in `FirebaseAppContext.tsx`

### Phase 2: UI Components (Steps 4-6)
4. ✅ Create `CustomPrayerFormModal.tsx` (Add/Edit)
5. ✅ Create `CustomPrayersView.tsx` (List & Management)
6. ✅ Create `CustomPrayerTrackingCard.tsx` (Attendance tracking)

### Phase 3: Integration (Steps 7-9)
7. ✅ Add custom prayers to navigation/tabs
8. ✅ Integrate into `PrayerMemberDetailsView.tsx`
9. ✅ Update statistics calculations

### Phase 4: Testing & Polish (Steps 10-12)
10. ✅ Test overnight prayer calculations
11. ✅ Test permissions for different user roles
12. ✅ Mobile responsiveness testing

## 6. Key Features Detail

### Custom Prayer Form
**Fields**:
- Prayer Name (text input)
- Category (dropdown: Personal, All-night Vigil, Quiet Time, Other)
- Custom Category Name (text input, shown if "Other" selected)
- Days of Week (checkboxes for Mon-Sun)
- Start Time (time picker, 24-hour)
- End Time (time picker, 24-hour)
- Active Status (toggle)

**Validation**:
- Name required (max 50 chars)
- At least one day must be selected
- Start and end times required
- Show warning if overnight prayer detected
- Custom category name required if "Other" selected

### Custom Prayers List View
**Display**:
- Card-based layout
- Each card shows:
  - Prayer name and category
  - Days active (badges)
  - Time range (with overnight indicator)
  - Active/Inactive status
  - Edit/Delete buttons
- Empty state with "Add Custom Prayer" CTA

### Attendance Tracking
**Weekly Grid**:
- Similar to main prayer tracking
- One row per custom prayer
- Columns for each active day
- Click to toggle Prayed/Missed
- Show duration for each session
- Total hours per week

### Member Details View Updates
**Sections**:
1. Church Prayer Schedule (existing)
2. Custom Prayers (new)
3. Combined Statistics:
   - Total church prayer hours
   - Total custom prayer hours
   - Grand total hours
   - Breakdown by week/month

## 7. Visual Design

### Overnight Prayer Indicator
```
🌙 All-night Vigil
Friday: 23:00 → Saturday: 05:00 (6h)
```

### Day Badges
```
[Mon] [Tue] [Wed] [Thu] [Fri] [Sat] [Sun]
  ✓     ✓     -     -     ✓     -     -
```

### Time Display
```
Normal: 04:30 - 06:30 (2h)
Overnight: 23:00 - 05:00 (6h) 🌙
```

## 8. Database Queries

### Get Member's Custom Prayers
```typescript
query(
  collection(db, 'churches/{churchId}/customPrayers'),
  where('memberId', '==', memberId),
  where('isActive', '==', true),
  orderBy('createdAt', 'desc')
)
```

### Get Custom Prayer Records for Week
```typescript
query(
  collection(db, 'churches/{churchId}/customPrayerRecords'),
  where('memberId', '==', memberId),
  where('date', '>=', weekStart),
  where('date', '<=', weekEnd)
)
```

## 9. Edge Cases to Handle

1. **Overnight prayers spanning two days**
   - Calculate duration correctly
   - Display clearly with indicator
   - Handle date transitions properly

2. **Inactive custom prayers**
   - Don't show in tracking grid
   - Keep historical records
   - Allow reactivation

3. **Deleted custom prayers**
   - Soft delete or hard delete?
   - Keep historical records?
   - Archive approach recommended

4. **Time zone considerations**
   - Store times in local format
   - No conversion needed (same as church prayers)

5. **Multiple custom prayers on same day**
   - Allow overlapping times
   - Calculate total hours correctly
   - Show all in tracking view

## 10. Success Metrics

- Members can create custom prayers in < 2 minutes
- Overnight prayers calculate correctly 100% of time
- Mobile-friendly interface
- Real-time updates work smoothly
- No performance degradation with 100+ custom prayers

## Next Steps

Start with Phase 1: Data Layer implementation.

