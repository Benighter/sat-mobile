# 📱 SAT Mobile — Church Membership & Cell Management System

SAT Mobile is a modern, mobile-first church membership and Bacenta (cell/home group) management application. Built as a cross-platform progressive hybrid app, it runs seamlessly on the **web**, as a **native Android app** (via Capacitor), and as a **Windows desktop application** (via Electron).

The system integrates real-time synchronization, offline-first support, role-based access, and powerful analytics to help church leadership track, grow, and shepherd their congregations effectively.

---

## ✨ Key Features

### 👤 Member & Cell (Bacenta) Management
- **Hierarchical Directory:** Structured organization of church members, assistants, Bacenta leaders, and Campus Shepherds.
- **Dynamic Leader Assignments:** Manage who leads which cell and assign roles across the church hierarchy.
- **In-App Messaging & Chat:** Real-time chat threads with notification badges for immediate coordination among cell leaders.
- **Impersonation Mode:** Allow high-level administrators to view and troubleshoot the application from the perspective of other users.
- **Duplicate Detection & Cleanup:** Tools to identify and clean up duplicate membership profiles.

### 📊 Attendance & Growth Metrics
- **Sunday Confirmations:** Easy-to-use checklist for marking and verifying Sunday attendance.
- **Weekly Attendance Tracking:** Comprehensive logs of cell meetings, including a Sunday income visibility toggle restricted to authorized Campus Shepherds.
- **Sunday Head Counts & Sections:** Log headcount analytics by specific service sections.
- **New Believers & Discipleship (Sons of God):** Track follow-up processes, status milestones, and spiritual growth classes.
- **Outreach Tracker:** Record soul-winning events and aggregate outreach efforts.

### 📧 Automated System & Push Notifications
- **Automated Birthday Emails:** Cloud Functions integration using the **Resend API** to send customized birthday emails.
- **Cross-Platform Notifications:** In-app toast alerts, background native push notifications (via FCM and `@capacitor/push-notifications`), and local notifications.

### 📥 Data Utilities & Premium PPTX Export
- **Excel & CSV Exports:** Export list views of members, absentees, and attendances for reporting.
- **PowerPoint Hierarchy Visualization:** Export visually stunning organization charts to `.pptx` using `PptxGenJS`, automatically generating slides with color-coded badges, profile photos, and spiritual growth metrics.

---

## 🛠️ Technology Stack

| Technology | Purpose |
| :--- | :--- |
| **React 19 & TypeScript** | Client application logic and structured state management. |
| **Vite** | High-performance frontend bundler. |
| **Tailwind CSS v4** | Modern utility-first styling with customized glassmorphism theme rules. |
| **Firebase Firestore** | Real-time database with automatic IndexedDB offline persistence. |
| **Firebase Auth & Functions** | Secure local persistence authentication and serverless background triggers (Node 22). |
| **Capacitor** | Native wrapper for deploying to Android. |
| **Electron & Builder** | Desktop wrapper for packaging Windows standalone installers (`.exe`). |
| **PptxGenJS & ExcelJS** | Client-side presentation and document generation. |

---

## 📂 Project Directory Structure

```
sat-mobile/
├── .github/                  # CI/CD workflows (if any)
├── android/                  # Android Native Studio Project (Capacitor)
├── build/                    # App build resources & icons
├── components/               # React components grouped by feature:
│   ├── admin/                # Admin Invite & Data Management
│   ├── auth/                 # Login & Verification screens
│   ├── bacentas/             # Cell / Bacenta drawers & views
│   ├── layout/               # Header, sidebar, gestures, wrappers
│   ├── members/              # Lists, profiles, bulk add tools
│   ├── notifications/        # Badge counters and offline alerts
│   └── views/                # Full-page dashboards and settings
├── contexts/                 # Global Contexts (Firebase context, Theme context)
├── electron/                 # Electron main and preload entrypoints
├── functions/                # Firebase Cloud Functions (TypeScript):
│   ├── birthdayNotifications.ts
│   ├── chatTriggers.ts
│   └── sendPushNotification.ts
├── scripts/                  # Development setup and utility scripts
├── services/                 # Firestore, Auth, and User database services
├── utils/                    # Shared helpers (PowerPoint generator, permission checks, etc.)
├── capacitor.config.ts       # Capacitor wrapper configuration
├── firebase.json             # Firebase emulator and hosting options
├── vite.config.ts            # Vite build configuration
└── package.json              # Node dependencies and build scripts
```

---

## 🚀 Getting Started

### 📋 Prerequisites
- **Node.js:** v20+ or v22+
- **pnpm:** Installed globally (`npm install -g pnpm`)
- **Java JDK:** JDK 21 (required for Capacitor Android builds)

### 1. Repository Setup & Install
Clone the repository and install all node packages:
```powershell
pnpm install
```

### 2. Environment Configuration
Create a local `.env` file based on `.env.example`:
```powershell
copy .env.example .env
```
Fill in the configuration parameters with your project's Firebase details:
```ini
# Firebase Client credentials
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=sat-mobile-de6f1.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sat-mobile-de6f1
VITE_FIREBASE_STORAGE_BUCKET=sat-mobile-de6f1.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdefg
VITE_FIREBASE_VAPID_KEY=your-vapid-public-key

# Enable / Disable settings
REACT_APP_USE_FIREBASE_EMULATOR=false
VITE_ENABLE_NATIVE_PUSH=false
```

### 3. Local Development Server
Launch the local Vite environment:
```powershell
pnpm run dev
```
Open your browser and navigate to `http://localhost:5173` (or the port specified in terminal).

---

## 📱 Mobile & Desktop Builds

### 🤖 Android Native Build (Capacitor)
Ensure your environment points to **JDK 21** for Gradle builds:
1. Build the production assets:
   ```powershell
   pnpm run build:mobile
   ```
2. Sync the assets to the Android folder:
   ```powershell
   pnpm exec cap sync android
   ```
3. Open the workspace in Android Studio:
   ```powershell
   pnpm exec cap open android
   ```
4. Build or debug the application onto an emulator or connected device.

### Self-hosted Android updates

The Capacitor app checks for an optional update shortly after each Android launch. Browser and Electron builds do not load the native updater. The update channel is:

```
https://github.com/Benighter/sat-mobile/releases/download/android-updates/android-update.json
```

The native updater only accepts HTTPS, requires package name `com.benighter.satmobile`, compares Android `versionCode` (not the display version string), limits download size, verifies the manifest SHA-256, verifies the APK package/version and installed signing certificate, and then hands the cache-only APK to Android's standard package installer through `FileProvider`. The user can always choose **Later**. On Android 8+, Android may first ask the user to allow SAT Mobile as an install source.

The Android app checks this channel automatically shortly after each app start. A signed-in user can also run the same check manually from **Settings → Help & Updates → Check for updates**. That screen shows the installed app version plus the last automatic or manual check time and result. The Help & Updates section is native-only and does not alter the browser-based Vercel app.

GitHub Actions performs Android builds because a normal Vercel Vite deployment does not provide the Android SDK, release keystore, or a durable place for a generated native artifact. A normal push to `main` continues to deploy the browser app through Vercel exactly as before. An explicit `android-v*` tag on the same commit starts `.github/workflows/android-release.yml`, creates an immutable signed APK release, and updates only the rolling manifest asset used by installed apps.

#### One-time release signing setup

Create and securely back up one upload keystore. Losing or changing it prevents installed copies from accepting updates. Never commit the keystore or its passwords.

```powershell
keytool -genkeypair -v -keystore sat-mobile-upload.jks -alias sat-mobile -keyalg RSA -keysize 4096 -validity 10000
[Convert]::ToBase64String([IO.File]::ReadAllBytes("sat-mobile-upload.jks")) | Set-Clipboard
```

Add these GitHub Actions repository secrets:

- `ANDROID_KEYSTORE_BASE64`: the base64 text copied above
- `ANDROID_KEYSTORE_PASSWORD`: keystore password
- `ANDROID_KEY_ALIAS`: key alias (for example, `sat-mobile`)
- `ANDROID_KEY_PASSWORD`: key password

Local `assembleRelease` builds deliberately fail unless the equivalent `SAT_ANDROID_KEYSTORE_PATH`, `SAT_ANDROID_KEYSTORE_PASSWORD`, `SAT_ANDROID_KEY_ALIAS`, and `SAT_ANDROID_KEY_PASSWORD` environment variables are set. Debug builds do not need them.

> **Existing debug APK:** `sat-mobile-debug.apk` is debug-signed. Android cannot update it with the new production-signed APK, even when installed through ADB. Back up/export any device-only data, uninstall that debug build once, and sideload the first production-signed release. Every later update must use the same production key. The updater intentionally rejects signing-key changes.

#### Publishing an Android update

1. Update `package.json` `version` and `android/version.properties` `VERSION_NAME` to the same semantic version. Increase `VERSION_CODE` to a value greater than every previously published build; never reuse it.
2. Commit and merge the release. Let the existing Vercel deployment validate the browser build.
3. Create and push a matching tag, for example:

   ```powershell
   git tag android-v2.0.3
   git push origin android-v2.0.3
   ```

4. Confirm the **Android self-hosted release** workflow succeeds. It checks version consistency and signing secrets, runs the Vite/Capacitor build, produces a signed APK, generates `android-update.json`, and publishes both as GitHub Release assets. It uploads the immutable versioned assets before changing the rolling manifest, so clients never receive metadata for an unpublished APK.
5. Install/test that release on at least one device. Future launches with a lower `versionCode` will show the optional update prompt.

The workflow may also be started manually, but its `tag` input must name an existing matching `android-v<package version>` tag. Creating or pushing the tag is the explicit authorization to publish; normal commits and Vercel previews never publish an APK.

For a different self-hosted HTTPS origin, build with Gradle property `SAT_UPDATE_MANIFEST_URL` (or an environment variable of the same name). The APK URL in that manifest must use the same host as the manifest, GitHub, or GitHub's asset CDN. The manifest schema is generated by `scripts/create-android-update-manifest.mjs` and includes `schemaVersion`, `packageName`, `versionCode`, `versionName`, `apkUrl`, `sha256`, `sizeBytes`, `releaseNotes`, and `publishedAt`.

### 💻 Windows Desktop Build (Electron)
To compile and package a standalone Windows Electron executable:
1. Compile the desktop mode bundle:
   ```powershell
   pnpm run build:desktop
   ```
2. Package the Windows executable (`.exe` in `release/` folder):
   ```powershell
   pnpm run release:win
   ```

---

## ⚡ Firebase Cloud Functions & Deployments

The backend functions handle birthday scans and chat notifications. They use Node.js 22 and are located in `/functions`.

### 1. Local Emulators
Run the emulators locally during development:
```powershell
firebase emulators:start
```

### 2. Deploy Functions
To deploy function changes directly to Firebase (replace with your active project ID):
```powershell
firebase deploy --only "functions" --project sat-mobile-de6f1
```

To deploy specific Resend birthday functions:
```powershell
firebase deploy --only "functions:sendBirthdayEmail,functions:sendBirthdayEmailHttp" --project sat-mobile-de6f1
```

---

## 📄 License
This project is private and intended solely for the authorized team of SAT Mobile.
