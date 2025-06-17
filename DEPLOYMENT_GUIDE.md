# Church Connect Mobile - APK Deployment Guide

This guide will walk you through deploying your Church Connect Mobile app as an APK using Median.co.

## Prerequisites

1. **Median.co Account**: Sign up at [https://median.co/](https://median.co/)
2. **Built App**: Your React app should be built and ready for deployment
3. **Icons**: App icons in various sizes (we've created these for you)

## Step 1: Prepare Your App for Deployment

### 1.1 Build the App
```bash
npm run build:mobile
```

This creates an optimized production build in the `dist/` folder.

### 1.2 Test the Build Locally
```bash
npm run serve
```

Visit `http://localhost:3000` to test your built app.

## Step 2: Generate App Icons

We've created an icon generator for you:

1. Open `generate-app-icons.html` in your browser
2. Click "Generate Icons" 
3. Download all the generated icons
4. Save them in the `public/` folder with these exact names:
   - `icon-48.png`
   - `icon-72.png`
   - `icon-96.png`
   - `icon-144.png`
   - `icon-192.png`
   - `icon-512.png`

Alternatively, you can use the SVG icons we've already created (`icon-192.svg` and `icon-512.svg`).

## Step 3: Deploy to Median.co

### 3.1 Create a New App
1. Log into your Median.co dashboard
2. Click "Create New App"
3. Choose "Website to App" option

### 3.2 Configure Your App

#### Basic Settings:
- **App Name**: Church Connect Mobile
- **Website URL**: Your deployed website URL (see Step 4)
- **App ID**: `com.churchconnect.mobile`

#### Upload Configuration:
1. Upload the `median.json` file we created
2. This file contains all the mobile-specific settings

#### Upload Icons:
- **App Icon (192x192)**: Upload `icon-192.png`
- **App Icon (512x512)**: Upload `icon-512.png`
- **Additional Icons**: Upload the other icon sizes as needed

### 3.3 Advanced Settings

The `median.json` file includes:
- ✅ Mobile-optimized navigation
- ✅ Proper status bar styling
- ✅ Android back button handling
- ✅ Swipe gesture support
- ✅ Portrait orientation lock
- ✅ Splash screen configuration
- ✅ Security settings

## Step 4: Host Your Website

You need to host your built app online first. Here are some options:

### Option A: Vercel (Recommended)
1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel --prod`
3. Use the provided URL in Median.co

### Option B: Netlify
1. Drag and drop your `dist/` folder to [netlify.com/drop](https://netlify.com/drop)
2. Use the provided URL in Median.co

### Option C: GitHub Pages
1. Push your code to GitHub
2. Enable GitHub Pages in repository settings
3. Use the GitHub Pages URL in Median.co

## Step 5: Generate APK

### 5.1 Build Configuration
In Median.co dashboard:
1. Go to "Build" section
2. Select "Android APK"
3. Choose build settings:
   - **Target SDK**: 34 (already configured)
   - **Min SDK**: 21 (already configured)
   - **Version Code**: 1
   - **Version Name**: 1.0.0

### 5.2 Start Build
1. Click "Start Build"
2. Wait for the build to complete (usually 5-15 minutes)
3. Download your APK file

## Step 6: Install on Your Phone

### Android Installation:
1. Enable "Install from Unknown Sources" in your phone settings
2. Transfer the APK file to your phone
3. Tap the APK file to install
4. Grant necessary permissions

### Testing Checklist:
- ✅ App launches correctly
- ✅ All navigation works
- ✅ Data persists (localStorage)
- ✅ Swipe gestures work
- ✅ Back button functions properly
- ✅ App icons display correctly
- ✅ Splash screen appears

## Troubleshooting

### Common Issues:

**App won't install:**
- Check if "Install from Unknown Sources" is enabled
- Ensure APK file isn't corrupted

**White screen on launch:**
- Check your website URL is accessible
- Verify all assets are loading correctly

**Icons not showing:**
- Ensure icon files are in the correct format and size
- Check file paths in manifest.json

**Navigation issues:**
- Verify median.json configuration
- Test website functionality first

## Configuration Files Created

We've created these files for your deployment:

1. **`median.json`** - Main Median.co configuration
2. **`public/manifest.json`** - PWA manifest for mobile optimization
3. **`public/icon-*.svg`** - App icons in SVG format
4. **`generate-app-icons.html`** - Icon generator tool
5. **Updated `index.html`** - Added mobile meta tags and manifest link
6. **Updated `vite.config.ts`** - Optimized build configuration
7. **Updated `package.json`** - Added deployment scripts

## Next Steps

After successful deployment:

1. **Test thoroughly** on different Android devices
2. **Gather feedback** from users
3. **Update app** by rebuilding and re-uploading to Median.co
4. **Consider publishing** to Google Play Store (requires additional setup)

## Support

- **Median.co Documentation**: [https://median.co/docs](https://median.co/docs)
- **Median.co Support**: Available through their dashboard
- **App Issues**: Check browser console for errors

---

Your Church Connect Mobile app is now ready for APK deployment! 🎉
