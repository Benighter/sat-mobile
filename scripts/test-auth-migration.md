# 🧪 Testing Firebase Dynamic Links Migration

## Pre-Migration Testing

### 1. Test Current Password Reset (Before Migration)

1. **Open your SAT Mobile app**
2. **Click "Forgot Password"**
3. **Enter a valid email address**
4. **Check email inbox** - you should receive a password reset email
5. **Click the link** - it should open your app (if installed) or browser
6. **Complete password reset** - verify it works end-to-end

**Expected Result**: Password reset works with Dynamic Links

### 2. Document Current Behavior

Record the current link format in the email:
- Should look like: `https://sat-mobile-de6f1.page.link/...`
- Note how it behaves on mobile vs desktop

## Migration Testing

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Firebase Admin SDK

1. **Download Service Account Key**:
   - Go to [Firebase Console](https://console.firebase.google.com/project/sat-mobile-de6f1/settings/serviceaccounts/adminsdk)
   - Click "Generate new private key"
   - Save as `firebase-admin-key.json` in project root

2. **Set Environment Variable**:
   ```bash
   # Windows
   set GOOGLE_APPLICATION_CREDENTIALS=firebase-admin-key.json
   
   # macOS/Linux
   export GOOGLE_APPLICATION_CREDENTIALS=firebase-admin-key.json
   ```

### 3. Run Migration

```bash
npm run migrate:auth-links
```

**Expected Output**:
```
✅ Firebase Admin SDK initialized successfully
🔄 Starting migration from Dynamic Links to Firebase Hosting...
📝 Updating project configuration...
   Domain: sat-mobile-de6f1.firebaseapp.com
✅ Migration completed successfully!
```

### 4. Test New Password Reset Flow

1. **Wait 5-10 minutes** for changes to propagate
2. **Test password reset again**:
   - Use "Forgot Password" feature
   - Check email inbox
   - **New link format** should be: `https://sat-mobile-de6f1.firebaseapp.com/__/auth/links/...`
3. **Click the new link**:
   - Should open your Android app (if installed)
   - Should open browser (if app not installed)
4. **Complete password reset** - verify it works

### 5. Test on Multiple Devices

- [ ] **Android device with app installed** - link opens app
- [ ] **Android device without app** - link opens browser
- [ ] **Desktop browser** - link works normally
- [ ] **iOS device** (if applicable) - link works in browser

## Rollback Testing

If issues occur:

```bash
npm run rollback:auth-links
```

**Expected**: Password reset returns to Dynamic Links format

## Troubleshooting

### Common Issues

**Issue**: "Permission denied" error
**Solution**: 
- Verify service account key is correct
- Ensure account has "Project Editor" role

**Issue**: Links don't open app
**Solution**:
- Check AndroidManifest.xml was updated correctly
- Verify app is signed with same certificate
- Test on physical device (not emulator)

**Issue**: Migration script fails
**Solution**:
- Ensure Firebase Hosting is enabled
- Check internet connection
- Verify project ID is correct

### Debug Commands

```bash
# Check current configuration
node scripts/migrate-auth-links.js

# View migration guide
npm run migration:dynamic-links

# Test Firebase connection
npm run test:firebase
```

## Success Criteria

✅ **Migration Successful When**:
- [ ] Migration script runs without errors
- [ ] Password reset emails use new hosting domain
- [ ] Links open Android app correctly
- [ ] Password reset completes successfully
- [ ] No user-facing changes in functionality

## Post-Migration Monitoring

1. **Monitor Firebase Console** for authentication errors
2. **Check email delivery rates** remain normal
3. **Watch for user reports** of password reset issues
4. **Test periodically** to ensure continued functionality

## Emergency Rollback

If critical issues occur in production:

```bash
npm run rollback:auth-links
```

This immediately restores Dynamic Links functionality while you debug the issue.

---

**Remember**: Dynamic Links will stop working on August 25, 2025, so migration must be completed before then!
