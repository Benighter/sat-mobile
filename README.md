# SAT Mobile

A comprehensive, mobile-first church membership management application built with React 19, TypeScript, Framer Motion, and Firebase. This application provides churches with a complete solution for managing members, tracking attendance, organizing congregations into Bacentas, and monitoring member engagement with advanced analytics, real-time synchronization, and cloud storage.

## 🔥 Firebase Integration

**NEW**: This app now supports **Firebase Firestore** for cloud data storage with real-time synchronization, offline support, and multi-user collaboration.

### Quick Firebase Setup

```bash
# Run the interactive setup wizard
npm run setup:firebase

# Test Firebase integration
npm run test:firebase

# View detailed migration guide
npm run migration:guide
```

### Firebase Features
- 🔐 **Authentication**: Secure user login with Firebase Auth
- ☁️ **Cloud Storage**: All data stored in Firestore with real-time sync
- 📱 **Offline Support**: Works offline with automatic sync when online
- 👥 **Multi-user**: Multiple users can collaborate in real-time
- 🔄 **Data Migration**: Seamless migration from localStorage to Firebase
- 🛡️ **Security**: Church-level data isolation and role-based access

## 🎯 Overview

SAT Mobile is designed specifically for churches that need a modern, efficient way to manage their congregation. The application combines powerful member management tools with intuitive mobile-first design, making it easy for church administrators to track attendance, organize members into groups (Bacentas), and identify members who may need additional pastoral care.

**Key Highlights:**
- 📱 **Mobile-First Design**: Optimized for smartphones and tablets with touch-friendly interfaces
- 🏗️ **Modern Architecture**: Built with React 19, TypeScript, Firebase, and modern web technologies
- 📊 **Advanced Analytics**: Comprehensive attendance tracking with charts and visual reports
- 🔄 **Real-time Updates**: Instant data synchronization with Firebase Firestore and offline support
- 📤 **Data Export**: Excel export functionality with detailed reports and charts
- 🎨 **Polished UI**: Glass morphism design with smooth animations and professional appearance
- ☁️ **Cloud-First**: Firebase integration with authentication, real-time sync, and multi-user support

## ✨ Core Features


### 👥 Member Management
- **Complete Member Profiles**: Store detailed information including name, phone, address, born-again status, and join date
- **Bacenta Assignment**: Organize members into Bacentas (congregation groups) for better management
- **Smart Forms**: Context-aware forms that adapt based on the current view (e.g., auto-select Bacenta when adding from within a specific group)
- **Member Search & Filtering**: Quickly find members by name, Bacenta, or other criteria
- **Bulk Operations**: Efficient management of multiple members simultaneously

### 📅 Attendance Tracking
- **Smart Date Management**: Automatically displays current month's Sundays with intuitive navigation
- **One-Click Marking**: Simple present/absent toggle buttons for quick attendance entry
- **Date Validation**: Prevents editing future dates and past months for data integrity
- **Monthly Navigation**: Easy navigation between months with automatic Sunday calculation
- **Attendance History**: Complete historical records for each member and Bacenta

### 🏛️ Bacenta Organization
- **Flexible Grouping**: Create and manage multiple Bacentas (congregation groups)
- **Member Assignment**: Easily assign and reassign members to different Bacentas
- **Group Analytics**: View attendance statistics and trends for each Bacenta
- **Hierarchical Navigation**: Organized menu system for easy access to all Bacentas
- **Group Management**: Add, edit, and delete Bacentas with member reassignment handling



### 📊 Analytics & Reporting
- **Interactive Charts**: Beautiful, responsive charts using Chart.js for attendance visualization
- **Comprehensive Dashboards**: Overview statistics with key metrics and trends
- **Detailed Reports**: In-depth analysis of attendance patterns by member, Bacenta, and time period
- **Export Capabilities**: Generate Excel reports with embedded charts and comprehensive data
- **Real-time Updates**: Live data visualization that updates as attendance is marked

### 📱 Mobile-First Design & Navigation

#### Advanced UI Features
- **Glass Morphism Design**: Modern, polished interface with translucent glass effects and subtle shadows
- **Responsive Layout**: Optimized for all screen sizes from mobile phones to tablets and desktops
- **Touch-Optimized Controls**: Large, accessible buttons and touch targets designed for finger navigation
- **Consistent Visual Language**: Unified design system with neutral color palette and professional appearance
- **Smooth Animations**: Framer Motion-powered transitions and micro-interactions for enhanced user experience

#### Gesture Navigation System
- **Swipe Gestures**: Intuitive right-swipe navigation to go back to previous screens
- **Hardware Integration**: Full support for Android hardware back button and browser navigation
- **Visual Feedback**: Real-time gesture indicators and smooth transition animations
- **Navigation History**: Intelligent tracking of user navigation patterns with context preservation
- **Multi-Modal Input**: Support for touch gestures, hardware buttons, and keyboard shortcuts (Escape key)

#### Mobile UX Enhancements
- **Fixed Navigation**: Persistent navbar and footer that remain accessible while content scrolls
- **Contextual Menus**: Hamburger menu system with organized sections for easy access
- **Clickable Elements**: Dashboard cards, logos, and navigation elements provide intuitive interaction
- **Modal Dialogs**: Custom confirmation dialogs instead of browser alerts for better mobile experience
- **Swipe Hints**: First-time user guidance for gesture navigation discovery

## 🚀 Getting Started

### Prerequisites

- **Node.js** (version 18 or higher recommended)
- **npm** or **yarn** package manager
- Modern web browser (Chrome, Firefox, Safari, Edge)
- **Optional**: Google Gemini API key for AI features

### Installation & Setup

#### Option 1: Firebase Setup (Recommended)

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd church-connect-mobile
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase**
   ```bash
   # Interactive Firebase setup wizard
   npm run setup:firebase

   # Or manually copy .env.example to .env and configure
   cp .env.example .env
   ```

4. **Configure Firebase Project**
   - Create a Firebase project at https://console.firebase.google.com/
   - Enable Firestore Database and Authentication
   - Apply security rules from `FIREBASE_MIGRATION_GUIDE.md`
   - Create initial user and church documents

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Test Firebase integration**
   ```bash
   npm run test:firebase
   ```

#### Option 2: Local Storage Setup (Legacy)

1. **Clone and install** (steps 1-2 above)

2. **Environment Configuration (Optional)**

   Create a `.env.local` file in the root directory:
   ```bash
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

   *Note: The app works fully without the API key. This is only needed for future AI-powered features.*

3. **Use original App component**
   - Keep `index.tsx` using `App` instead of `FirebaseApp`
   - The application will use localStorage for data persistence

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**

   Navigate to `http://localhost:5173` (or the port shown in your terminal)

### Available Scripts

#### Development
- `npm run dev` - Start development server with hot reload
- `npm run build` - Create production build
- `npm run build:mobile` - Create optimized mobile production build
- `npm run preview` - Preview production build locally
- `npm run serve` - Serve production build on network (for mobile testing)

#### Firebase
- `npm run setup:firebase` - Interactive Firebase setup wizard
- `npm run test:firebase` - Test Firebase integration and configuration
- `npm run migration:guide` - View Firebase migration instructions

## 📱 Mobile Testing & Usage

### Local Mobile Testing

1. **Network Access**: Use `npm run serve` to make the app accessible on your local network
2. **Mobile Browser**: Open the app on your phone's browser using your computer's IP address
3. **Add to Home Screen**: Install as a PWA for native app-like experience
4. **Gesture Testing**: Test swipe navigation by swiping right from the left edge of the screen

### Mobile Navigation Guide

#### Gesture Controls
- **Swipe Right**: Navigate back to the previous screen (swipe from left edge)
- **Hardware Back Button**: Use your Android device's back button
- **Browser Back Button**: Standard browser navigation support
- **Escape Key**: Press Escape to navigate back (desktop/keyboard users)

#### Visual Indicators
- **Back Button**: Appears in the header when navigation history is available
- **Swipe Hint**: First-time users see helpful gesture navigation hints
- **Smooth Transitions**: Animated transitions provide visual feedback during navigation
- **Loading States**: Clear indicators during data operations

### Mobile Features Testing Checklist

- ✅ **Navigation**: Test swipe gestures and back button functionality
- ✅ **Forms**: Verify touch-friendly form inputs and validation
- ✅ **Tables**: Check responsive table layouts and touch scrolling
- ✅ **Modals**: Test modal dialogs and confirmation screens
- ✅ **Charts**: Verify chart responsiveness and touch interactions
- ✅ **Data Persistence**: Confirm data saves correctly in localStorage
- ✅ **Offline Usage**: Test app functionality without internet connection

## 🛠️ Technology Stack

### Frontend Framework
- **React 19** - Latest React with concurrent features and improved performance
- **TypeScript** - Full type safety with strict configuration for robust development
- **Vite** - Lightning-fast development server and optimized production builds

### UI & Styling
- **Tailwind CSS** - Utility-first CSS framework with custom design system
- **Glass Morphism** - Custom CSS implementation for modern translucent effects
- **Lucide React** - Beautiful, consistent icon library with 1000+ icons
- **Responsive Design** - Mobile-first approach with breakpoint-based layouts

### Animation & Interaction
- **Framer Motion** - Production-ready motion library for React
  - Gesture handling for swipe navigation
  - Smooth page transitions and micro-interactions
  - Advanced animation controls and spring physics

### Data Visualization
- **Chart.js** - Powerful, flexible charting library
- **React Chart.js 2** - React wrapper for Chart.js with TypeScript support
- **HTML2Canvas** - Client-side screenshot generation for chart exports
- **Interactive Charts** - Touch-friendly charts optimized for mobile devices

### Data Management
- **LocalStorage API** - Client-side data persistence with structured storage
- **Custom Storage Services** - Type-safe localStorage abstraction layer
- **Excel Export** - XLSX library for comprehensive data export functionality
- **Data Validation** - Runtime type checking and data integrity enforcement

### Development Tools
- **ESLint & Prettier** - Code quality and formatting standards
- **TypeScript Strict Mode** - Maximum type safety and error prevention
- **Vite Plugins** - Optimized build process with code splitting and tree shaking

## 🏗️ Architecture Overview

### Application Structure
```
SAT_mobile/
├── components/           # Reusable UI components
│   ├── icons/           # Custom icon components
│   └── ui/              # Base UI components
├── contexts/            # React Context providers
├── hooks/               # Custom React hooks
├── services/            # Data service layer
├── utils/               # Utility functions
├── types.ts             # TypeScript type definitions
└── constants.ts         # Application constants
```

### Design Patterns

#### State Management
- **React Context API**: Centralized application state management
- **Custom Hooks**: Encapsulated business logic and state operations
- **Service Layer**: Abstracted data operations with consistent API
- **Type-Safe Operations**: Full TypeScript coverage for data operations

#### Component Architecture
- **Atomic Design**: Hierarchical component structure from atoms to pages
- **Composition Pattern**: Flexible component composition with render props
- **Custom Hooks**: Reusable stateful logic across components
- **Error Boundaries**: Graceful error handling and user feedback

#### Data Flow
- **Unidirectional Data Flow**: Predictable state updates following React patterns
- **Optimistic Updates**: Immediate UI feedback with rollback on errors
- **Local-First**: All data operations work offline with localStorage persistence
- **Real-time Synchronization**: Instant updates across all app components

### Mobile-First Architecture

#### Responsive Design System
- **Breakpoint Strategy**: Mobile-first CSS with progressive enhancement
- **Touch Optimization**: Large touch targets and gesture-friendly interfaces
- **Performance Focus**: Optimized bundle size and lazy loading strategies
- **PWA Ready**: Service worker support and app manifest configuration

#### Navigation System
- **History Management**: Custom navigation history with context preservation
- **Gesture Integration**: Native-feeling swipe navigation with visual feedback
- **Deep Linking**: URL-based navigation with state restoration
- **Accessibility**: Full keyboard navigation and screen reader support

## 📱 Mobile App Deployment (APK Generation)

SAT Mobile is designed to be deployed as a native Android APK using **Median.co**, providing users with a true mobile app experience while maintaining the flexibility of web technologies.

### Deployment Overview

The application includes a complete deployment setup for converting the React web app into a native Android APK:

#### Included Deployment Files
- **`median.json`** - Complete Median.co configuration with mobile optimizations
- **`public/manifest.json`** - PWA manifest for mobile app features
- **`public/icon-*.svg`** - High-quality app icons in multiple sizes
- **`generate-app-icons.html`** - Interactive icon generator tool
- **`DEPLOYMENT_GUIDE.md`** - Comprehensive step-by-step deployment instructions
- **`deploy-setup.js`** - Automated setup verification script

### Quick Deployment Steps

1. **Prepare the Application**
   ```bash
   npm run build:mobile    # Create optimized production build
   npm run serve          # Test the build locally
   ```

2. **Generate App Icons**
   - Open `generate-app-icons.html` in your browser
   - Generate and download all required icon sizes
   - Icons are automatically optimized for Android requirements

3. **Deploy to Web Hosting**
   - **Vercel** (Recommended): `vercel --prod`
   - **Netlify**: Drag and drop `dist/` folder
   - **GitHub Pages**: Enable in repository settings

4. **Create APK with Median.co**
   - Sign up at [median.co](https://median.co/)
   - Create new "Website to App" project
   - Upload the included `median.json` configuration
   - Upload generated app icons
   - Build and download APK

### Mobile App Features

The generated APK includes all the optimizations for native mobile experience:

#### Native Mobile Optimizations
- ✅ **Portrait Orientation Lock** - Consistent mobile layout
- ✅ **Android Back Button Support** - Hardware back button integration
- ✅ **Swipe Gesture Navigation** - Native-feeling navigation patterns
- ✅ **Status Bar Styling** - Branded status bar with app colors
- ✅ **Splash Screen** - Professional app launch experience
- ✅ **Hardware Acceleration** - Smooth animations and transitions
- ✅ **Security Settings** - Optimized for mobile app distribution

#### App Configuration Highlights
- **App ID**: `com.churchconnect.mobile`
- **Target SDK**: Android 34 (latest)
- **Minimum SDK**: Android 21 (covers 95%+ of devices)
- **Permissions**: Internet, storage access for data export
- **Theme**: Custom branded theme with glass morphism design

### Installation & Distribution

#### For Church Administrators
1. **Download APK** from Median.co after successful build
2. **Install on Android devices** by enabling "Install from Unknown Sources"
3. **Distribute to users** via email, cloud storage, or direct transfer
4. **Future Updates** by rebuilding and redistributing the APK

#### For End Users
1. **Enable Installation** from unknown sources in Android settings
2. **Install APK** by tapping the downloaded file
3. **Grant Permissions** for storage access (for Excel exports)
4. **Add to Home Screen** - App appears like any native Android app

### Advanced Deployment Options

For churches requiring more advanced deployment:

- **Google Play Store**: Additional setup required for store distribution
- **Enterprise Distribution**: Internal app distribution for large organizations
- **Custom Branding**: Modify icons, colors, and app name in configuration files
- **White Label**: Complete customization for multiple church organizations

See the complete **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** for detailed instructions, troubleshooting, and advanced configuration options.

## 💾 Data Management & Storage

### Local Storage Architecture

Church Connect Mobile uses a sophisticated local storage system designed for reliability and performance:

#### Storage Structure
- **Members Data**: `sat_mobile_members` - Complete member profiles and metadata
- **Attendance Records**: `sat_mobile_attendance` - Individual attendance entries with date indexing
- **Bacentas**: `sat_mobile_bacentas` - Congregation group definitions and settings
- **App State**: `sat_mobile_current_tab`, `sat_mobile_displayed_date` - UI state persistence
- **Backup Metadata**: `sat_mobile_version`, `sat_mobile_last_backup` - Data versioning

#### Data Persistence Features
- **Automatic Saving**: All changes are immediately persisted to localStorage
- **Data Validation**: Runtime type checking ensures data integrity
- **Version Management**: Automatic data migration for app updates
- **Backup & Restore**: Complete data export/import functionality
- **Storage Monitoring**: Real-time storage usage tracking and optimization

### Excel Export Capabilities

Comprehensive data export functionality for reporting and backup:

#### Export Features
- **Multi-Sheet Workbooks**: Separate sheets for members, attendance, and analytics
- **Embedded Charts**: Visual attendance charts included in Excel files
- **Filtered Data**: Export specific Bacentas or date ranges
- **Formatted Reports**: Professional formatting with headers and styling
- **Attendance Summaries**: Calculated statistics and trend analysis

#### Export Options
- **Complete Database**: Full export of all members, attendance, and Bacentas
- **Bacenta-Specific**: Export data for individual congregation groups
- **Date Range Reports**: Attendance data for specific time periods
- **Critical Members**: Focused reports on members requiring attention
- **Analytics Data**: Statistical summaries and trend data

## 🔧 Configuration & Customization

### Environment Variables

Optional configuration through `.env.local`:

```bash
# Google Gemini API (for future AI features)
GEMINI_API_KEY=your_api_key_here

# Development settings
VITE_DEV_MODE=true
VITE_DEBUG_STORAGE=false
```

### Customization Options

#### Branding & Theming
- **App Colors**: Modify CSS custom properties in `index.css`
- **Logo Replacement**: Update icons in `public/` directory
- **App Name**: Change in `package.json`, `median.json`, and `manifest.json`
- **Glass Effects**: Adjust transparency and blur values in Tailwind config

#### Functional Configuration
- **Critical Member Threshold**: Modify consecutive absence detection in `constants.ts`
- **Date Formats**: Customize date display formats in `utils/dateUtils.ts`
- **Storage Keys**: Update storage identifiers in `utils/localStorage.ts`
- **Navigation Behavior**: Adjust gesture sensitivity and navigation patterns

## 🐛 Troubleshooting

### Common Issues & Solutions

#### Data Not Persisting
- **Check Browser Storage**: Ensure localStorage is enabled and not full
- **Clear Cache**: Try clearing browser cache and reloading the app
- **Storage Quota**: Check if localStorage quota is exceeded (rare)

#### Mobile Navigation Issues
- **Gesture Conflicts**: Ensure browser gesture navigation is disabled
- **Touch Sensitivity**: Adjust swipe threshold in gesture configuration
- **Hardware Back Button**: Verify Android WebView settings in Median.co

#### Performance Issues
- **Large Datasets**: Consider data archiving for churches with 1000+ members
- **Chart Rendering**: Reduce chart animation complexity for older devices
- **Memory Usage**: Clear browser cache and restart app periodically

#### APK Installation Problems
- **Unknown Sources**: Enable "Install from Unknown Sources" in Android settings
- **Storage Space**: Ensure sufficient device storage for installation
- **Android Version**: Verify device meets minimum Android 5.0 requirement

### Getting Help

- **Documentation**: Check [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for deployment issues
- **Browser Console**: Check for JavaScript errors in browser developer tools
- **Storage Inspector**: Use browser dev tools to inspect localStorage data
- **Network Tab**: Verify all assets are loading correctly

## 📈 Performance & Scalability

### Optimization Features

- **Code Splitting**: Automatic bundle splitting for faster initial load
- **Lazy Loading**: Components loaded on-demand to reduce bundle size
- **Image Optimization**: SVG icons and optimized image assets
- **Caching Strategy**: Aggressive caching of static assets
- **Memory Management**: Efficient React rendering with proper cleanup

### Scalability Considerations

- **Member Capacity**: Tested with 1000+ members without performance degradation
- **Attendance History**: Efficient date-based indexing for fast queries
- **Storage Limits**: localStorage typically supports 5-10MB per domain
- **Export Performance**: Large datasets export efficiently with streaming

## 🤝 Contributing & Support

### Development Setup

1. **Fork the repository** and clone your fork
2. **Install dependencies**: `npm install`
3. **Start development server**: `npm run dev`
4. **Make your changes** following the existing code style
5. **Test thoroughly** on both desktop and mobile
6. **Submit a pull request** with detailed description

### Code Standards

- **TypeScript**: Strict type checking enabled
- **ESLint**: Consistent code formatting and best practices
- **Component Structure**: Follow atomic design principles
- **Mobile-First**: Always consider mobile experience first
- **Accessibility**: Ensure keyboard navigation and screen reader support

### Support & Community

- **Issues**: Report bugs and feature requests via GitHub Issues
- **Discussions**: Join community discussions for questions and ideas
- **Documentation**: Help improve documentation and guides
- **Testing**: Contribute by testing on different devices and browsers

---

## 📄 License & Credits

**SAT Mobile** is built with modern web technologies and designed specifically for church communities. The application demonstrates best practices in mobile-first development, progressive web apps, and user experience design.

### Acknowledgments

- **React Team** - For the amazing React 19 framework
- **Framer Motion** - For beautiful animations and gesture handling
- **Chart.js** - For powerful data visualization capabilities
- **Tailwind CSS** - For the utility-first CSS framework
- **Median.co** - For enabling web-to-native app conversion

### Version Information

- **Current Version**: 1.0.0
- **React Version**: 19.1.0
- **TypeScript Version**: 5.7.2
- **Build Tool**: Vite 6.2.0
- **Target Platforms**: Android 5.0+, iOS 12.0+, Modern Browsers

---

**Ready to transform your church's member management?** 🚀

Start by running `npm install && npm run dev` and experience the future of church administration!
