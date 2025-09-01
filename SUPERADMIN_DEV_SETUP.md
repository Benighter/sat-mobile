# SuperAdmin Development Setup Guide

This guide explains how to set up SuperAdmin for development testing using temporary unauthenticated access rules.

## ⚠️ Important Security Warning

**The development setup described here is NOT secure for production!**

- It allows unauthenticated access to all SuperAdmin collections
- Anyone can read/write SuperAdmin data without authentication
- Only use this for local development and testing
- Always restore production rules before deploying to production

## 🚀 Quick Development Setup (Option A)

### Prerequisites

1. **Firebase CLI installed and logged in:**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Firebase project initialized:**
   ```bash
   firebase init firestore
   ```

### Step 1: Deploy Development Rules

Run the automated deployment script:

```bash
npm run deploy:dev-rules
```

This script will:
- ✅ Backup your current `firestore.rules` to `firestore.rules.backup`
- ✅ Copy development rules from `firestore.rules.dev` to `firestore.rules`
- ✅ Deploy the new rules to Firebase
- ✅ Show confirmation that SuperAdmin now has unauthenticated access

### Step 2: Test SuperAdmin Access

1. **Start your development server:**
   ```bash
   npm run dev
   # or
   npm run dev:3001
   ```

2. **Access SuperAdmin:**
   - Go to your app in the browser
   - Use SuperAdmin credentials:
     - **Email:** `admin@gmail.com`
     - **Password:** `Admin@123`

3. **Verify functionality:**
   - SuperAdmin dashboard should load without permission errors
   - You should see admin users, campuses, notifications, etc.
   - All SuperAdmin operations should work

## 🔄 Restoring Production Rules

When you're done with development testing, restore the secure production rules:

### Manual Restoration
```bash
# Copy backup back to main rules file
cp firestore.rules.backup firestore.rules

# Deploy production rules
firebase deploy --only firestore:rules
```

### What This Restores
- ✅ Requires authenticated users with `superAdmin: true` flag
- ✅ Blocks unauthenticated access to all collections
- ✅ Maintains proper security for production deployment

## 📁 Files Involved

### Development Rules File
- **Location:** `firestore.rules.dev`
- **Purpose:** Contains rules that allow unauthenticated SuperAdmin access
- **Key difference:** Adds `isDevSuperAdminAccess()` function that returns `true` for unauthenticated requests

### Backup Files
- **Current rules backup:** `firestore.rules.backup`
- **Created automatically** when running `npm run deploy:dev-rules`

### Scripts
- **Deploy dev rules:** `scripts/deploy-dev-rules.js`
- **Package.json command:** `npm run deploy:dev-rules`

## 🔍 What the Development Rules Do

The development rules add this function:

```javascript
function isDevSuperAdminAccess() {
  return request.auth == null; // Unauthenticated access for dev prototype
}
```

And modify all SuperAdmin collection rules to include:
```javascript
allow read, write: if isSuperAdmin() || isDevSuperAdminAccess();
```

This means:
- ✅ Authenticated SuperAdmin users still work (production path)
- ✅ Unauthenticated requests also work (development prototype)
- ⚠️ **Anyone can access SuperAdmin data without authentication**

## 🚨 Troubleshooting

### "Firebase CLI not found"
```bash
npm install -g firebase-tools
firebase login
```

### "Permission denied" during deployment
```bash
firebase login
firebase use --add  # Select your project
```

### "Development rules file not found"
The `firestore.rules.dev` file should exist in your project root. If missing, check that you have the latest code.

### SuperAdmin still shows permission errors
1. Verify rules were deployed: Check Firebase Console > Firestore > Rules
2. Clear browser cache and reload
3. Check browser console for other errors

## 🔐 Moving to Production

For production deployment, use the proper SuperAdmin authentication setup instead:

```bash
# Set up real SuperAdmin user with authentication
npm run setup:superadmin
```

See `SUPERADMIN_PRODUCTION_SETUP.md` for production setup instructions.

## 📝 Summary Commands

```bash
# Deploy development rules (unauthenticated access)
npm run deploy:dev-rules

# Test SuperAdmin
# Email: admin@gmail.com, Password: Admin@123

# Restore production rules
cp firestore.rules.backup firestore.rules
firebase deploy --only firestore:rules
```

---

**Remember:** Always restore production rules before deploying to production environments!
