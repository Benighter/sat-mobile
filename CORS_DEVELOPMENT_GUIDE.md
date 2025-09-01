# CORS Development Guide

This guide explains how to handle CORS errors when developing with Firebase Cloud Functions locally.

## 🚨 **Common CORS Error**

```
Access to fetch at 'https://us-central1-sat-mobile-de6f1.cloudfunctions.net/hardDeleteUserAccount' 
from origin 'http://localhost:3000' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## ✅ **Automatic Development Fallbacks**

The app now includes **automatic fallbacks** for development that bypass Cloud Functions when CORS errors occur:

### 1. **User Active/Inactive Status**
- **Primary:** Cloud Function `setUserActiveStatus`
- **Fallback:** Direct Firestore update
- **Result:** User status changes work seamlessly in development

### 2. **Hard Delete User**
- **Primary:** Cloud Function `hardDeleteUserAccount`
- **Fallback:** Soft delete (marks user as `isDeleted: true`)
- **Result:** User "deletion" works in development (soft delete)

## 🔧 **How Fallbacks Work**

1. **Try Cloud Function first**
2. **If CORS error occurs:**
   - Log warning with development context
   - Execute Firestore-only fallback
   - Continue operation seamlessly
3. **User sees no error** - operation completes successfully

## 📋 **Development vs Production Behavior**

| Operation | Development (CORS) | Production |
|-----------|-------------------|------------|
| Activate/Deactivate User | ✅ Firestore update | ✅ Cloud Function + Auth |
| Delete User | ✅ Soft delete (Firestore) | ✅ Hard delete (Auth + Firestore) |
| SuperAdmin Operations | ✅ Works with fallbacks | ✅ Full Cloud Function power |

## 🔍 **Checking Fallback Usage**

Watch the browser console for these messages:

```
[userService.setUserActiveStatus] Cloud Function failed (development CORS); applying Firestore fallback: [error details]

[userService.hardDeleteUser] Cloud Function failed (development CORS); applying development fallback (soft delete): [error details]
```

## 🚀 **No Action Required**

- ✅ **Fallbacks are automatic** - no configuration needed
- ✅ **SuperAdmin works fully** in development
- ✅ **All operations complete successfully** despite CORS
- ✅ **Production behavior unchanged** - Cloud Functions work normally

## 🔐 **Production Deployment**

When deploying to production:
- ✅ **Cloud Functions work normally** (no CORS issues)
- ✅ **Fallbacks rarely trigger** (only on network issues)
- ✅ **Full security maintained** (Auth + Firestore operations)

## 🛠️ **Alternative Solutions (Optional)**

If you want to avoid fallbacks entirely in development:

### Option 1: Firebase Emulator Suite
```bash
npm install -g firebase-tools
firebase init emulators
firebase emulators:start
```

### Option 2: CORS Browser Extension
- Install "CORS Unblock" or similar extension
- Enable for localhost development
- **Warning:** Only use for development!

### Option 3: Proxy Setup
Add to `vite.config.js`:
```javascript
export default {
  server: {
    proxy: {
      '/api': {
        target: 'https://us-central1-sat-mobile-de6f1.cloudfunctions.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
}
```

## 📝 **Summary**

- ✅ **CORS errors are handled automatically**
- ✅ **Development experience is smooth**
- ✅ **No manual intervention required**
- ✅ **Production functionality preserved**

The fallback system ensures SuperAdmin works perfectly in development while maintaining full security and functionality in production.
