# Custom Prayers - Quick Start Guide

## ✅ Implementation Complete!

The Custom Prayers feature is fully implemented and ready to use. Here's how to integrate it into your app.

## 🚀 Quick Integration (5 Minutes)

### Option 1: Add to Existing Prayer Member Details View

1. **Import the components:**
```typescript
import CustomPrayersView from './CustomPrayersView';
import CustomPrayerTrackingView from './CustomPrayerTrackingView';
import { calculateTotalCustomHours } from '../../utils/customPrayerUtils';
```

2. **Get data from context:**
```typescript
const {
  customPrayers,
  customPrayerRecords,
  saveCustomPrayerHandler,
  deleteCustomPrayerHandler,
  markCustomPrayerAttendanceHandler,
  userProfile
} = useAppContext();
```

3. **Filter for current member:**
```typescript
const memberCustomPrayers = customPrayers.filter(p => p.memberId === memberId);
const memberCustomRecords = customPrayerRecords.filter(r => r.memberId === memberId);
const canEdit = userProfile?.uid === memberId || userProfile?.role === 'Admin';
```

4. **Add to your JSX:**
```typescript
<CustomPrayersView
  prayers={memberCustomPrayers}
  memberId={memberId}
  memberName={member.name}
  onSave={saveCustomPrayerHandler}
  onDelete={deleteCustomPrayerHandler}
  canEdit={canEdit}
/>

{memberCustomPrayers.length > 0 && (
  <CustomPrayerTrackingView
    prayers={memberCustomPrayers}
    records={memberCustomRecords}
    memberId={memberId}
    memberName={member.name}
    onMarkAttendance={markCustomPrayerAttendanceHandler}
    canEdit={canEdit}
  />
)}
```

### Option 2: Create a New "My Custom Prayers" Tab

See `CUSTOM_PRAYERS_INTEGRATION_EXAMPLE.tsx` for a complete example with tabs.

## 📋 Firestore Security Rules

Add these rules to your `firestore.rules`:

```javascript
match /churches/{churchId}/customPrayers/{prayerId} {
  allow read: if isAuthenticated() && belongsToChurch(churchId);
  allow create: if isAuthenticated() && belongsToChurch(churchId) && 
                request.resource.data.memberId == request.auth.uid;
  allow update, delete: if isAuthenticated() && 
                        (resource.data.memberId == request.auth.uid || isAdmin(churchId));
}

match /churches/{churchId}/customPrayerRecords/{recordId} {
  allow read: if isAuthenticated() && belongsToChurch(churchId);
  allow write: if isAuthenticated() && belongsToChurch(churchId);
}
```

## 🧪 Testing Your Integration

### 1. Create a Custom Prayer
- Click "Add Prayer" button
- Fill in:
  - Name: "Morning Prayer"
  - Category: "Personal"
  - Days: Select Mon-Fri
  - Start: 05:00
  - End: 06:00
- Click "Add Prayer"
- Should see success toast
- Prayer should appear in list

### 2. Test Overnight Prayer
- Create prayer with:
  - Start: 23:00
  - End: 05:00
- Should show 🌙 indicator
- Duration should be 6.0 hours

### 3. Track Attendance
- Click on a day in the tracking grid
- Should toggle: Unmarked → Prayed (green) → Missed (red) → Prayed
- Statistics should update immediately

### 4. Test Permissions
- As member: Can only edit own prayers
- As admin: Can edit all prayers
- As leader: Can view but not edit others' prayers

## 📊 Combining Statistics

To show combined church + custom prayer hours:

```typescript
import { calculateTotalCustomHours } from '../../utils/customPrayerUtils';

const churchHours = /* your existing calculation */;
const customHours = calculateTotalCustomHours(
  customPrayers,
  customPrayerRecords,
  memberId,
  startDate,
  endDate
);
const totalHours = churchHours + customHours;
```

## 🎨 UI Components Overview

### CustomPrayersView
**Purpose:** Manage custom prayers (add, edit, delete)
**Shows:** List of prayers with details
**Actions:** Add, Edit, Delete buttons

### CustomPrayerTrackingView
**Purpose:** Track attendance for custom prayers
**Shows:** Weekly grid with Prayed/Missed status
**Actions:** Click cells to mark attendance

### CustomPrayerFormModal
**Purpose:** Add/Edit prayer details
**Shows:** Form with all prayer fields
**Actions:** Save, Cancel

## 🔑 Key Features

### ✅ Overnight Prayers
```typescript
// Example: All-night vigil
startTime: "23:00"
endTime: "05:00"
// Correctly calculates as 6 hours
// Shows 🌙 indicator
```

### ✅ Flexible Days
```typescript
days: {
  monday: true,
  tuesday: true,
  wednesday: false,
  thursday: false,
  friday: true,
  saturday: false,
  sunday: false
}
// Prayer only active on Mon, Tue, Fri
```

### ✅ Real-Time Sync
- All changes sync immediately via Firestore listeners
- No manual refresh needed
- Works across multiple tabs/devices

## 🐛 Troubleshooting

### Prayers not showing?
- Check Firestore rules are deployed
- Verify `customPrayers` state is populated in context
- Check browser console for errors

### Can't edit prayers?
- Verify `canEdit` prop is true
- Check user permissions (own prayers or admin)
- Ensure `saveCustomPrayerHandler` is passed correctly

### Overnight duration wrong?
- Verify start/end times are in HH:MM format
- Check `calculatePrayerDuration` function
- Should handle end < start correctly

### Tracking not updating?
- Check `markCustomPrayerAttendanceHandler` is called
- Verify Firestore listener is active
- Check network tab for Firestore writes

## 📱 Mobile Support

All components are fully responsive:
- ✅ Touch-friendly buttons
- ✅ Horizontal scroll for tables
- ✅ Responsive grids
- ✅ Mobile-optimized modals

## 🎯 Next Steps

1. ✅ Add components to your Prayer view
2. ✅ Deploy Firestore security rules
3. ✅ Test with real data
4. ✅ Gather user feedback
5. ✅ Iterate and improve

## 📚 Documentation

- **Implementation Plan:** `CUSTOM_PRAYERS_PLAN.md`
- **Implementation Summary:** `CUSTOM_PRAYERS_IMPLEMENTATION.md`
- **Integration Example:** `CUSTOM_PRAYERS_INTEGRATION_EXAMPLE.tsx`
- **This Guide:** `CUSTOM_PRAYERS_QUICK_START.md`

## 💡 Tips

1. **Start Simple:** Add just the CustomPrayersView first, then add tracking
2. **Test Thoroughly:** Especially overnight prayers and permissions
3. **User Feedback:** Get feedback on the UI/UX before rolling out
4. **Performance:** The real-time listeners are efficient, but monitor with many users
5. **Mobile First:** Test on mobile devices early

## 🎉 You're Ready!

The Custom Prayers feature is production-ready. Just integrate the components and deploy!

**Questions?** Check the implementation files or the inline code comments.

**Happy Coding!** 🙏

