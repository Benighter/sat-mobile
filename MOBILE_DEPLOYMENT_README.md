# 📱 Church Connect Mobile - APK Deployment

Transform your React web app into a native Android APK using Median.co!

## 🚀 Quick Start

1. **Build the app:**
   ```bash
   npm run build:mobile
   ```

2. **Test locally:**
   ```bash
   npm run serve
   ```

3. **Generate icons:**
   - Open `generate-app-icons.html` in your browser
   - Download all generated icons to `public/` folder

4. **Deploy to web hosting** (Vercel, Netlify, etc.)

5. **Create APK on Median.co:**
   - Upload `median.json` configuration
   - Upload app icons
   - Build APK

## 📁 Deployment Files

| File | Purpose |
|------|---------|
| `median.json` | Main Median.co configuration |
| `public/manifest.json` | PWA manifest for mobile features |
| `public/icon-*.svg` | App icons (192x192, 512x512) |
| `generate-app-icons.html` | Icon generator tool |
| `DEPLOYMENT_GUIDE.md` | Complete step-by-step guide |
| `deploy-setup.js` | Setup verification script |

## 🔧 Configuration Highlights

- ✅ **Mobile-optimized** navigation and UI
- ✅ **Portrait orientation** lock
- ✅ **Android back button** handling
- ✅ **Swipe gestures** support
- ✅ **Status bar** styling
- ✅ **Splash screen** configuration
- ✅ **Security** settings optimized
- ✅ **Performance** optimizations

## 📖 Documentation

- **Complete Guide**: See `DEPLOYMENT_GUIDE.md`
- **Median.co Docs**: [https://median.co/docs](https://median.co/docs)

## 🎯 App Details

- **Package ID**: `com.churchconnect.mobile`
- **Version**: 1.0.0
- **Min Android**: API 21 (Android 5.0)
- **Target Android**: API 34 (Android 14)

---

**Ready to deploy?** Follow the `DEPLOYMENT_GUIDE.md` for detailed instructions! 🚀
