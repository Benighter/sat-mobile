# Church Connect Mobile

A mobile-first church membership management application built with React, TypeScript, and Framer Motion. Features comprehensive member management, attendance tracking, congregation grouping (Bacentas), and critical member alerts with full mobile gesture support.

## Features

### Core Functionality
- **Member Management**: Add, edit, and delete church members with detailed information
- **Attendance Tracking**: Mark attendance for each Sunday with smart date validation
- **Bacenta Organization**: Group members into Bacentas (congregations) for better organization
- **Critical Alerts**: Automatic detection of members with consecutive absences
- **Analytics Dashboard**: Comprehensive attendance analytics with charts and graphs
- **Data Management**: Export/import functionality with Excel support

### Mobile-First Design
- **Responsive UI**: Optimized for mobile devices with touch-friendly interfaces
- **Glass Morphism**: Modern, polished design with glass effects and smooth animations
- **Gesture Navigation**: Full swipe gesture support for intuitive mobile navigation
- **Hardware Back Button**: Support for Android hardware back button and browser back button
- **Touch Optimization**: Enhanced touch targets and mobile-specific interactions

### Navigation Features
- **Swipe Gestures**: Swipe right to navigate back to previous screens
- **Navigation History**: Intelligent navigation history tracking
- **Back Button Support**: Visual back button with smooth animations
- **Gesture Feedback**: Visual feedback during swipe gestures
- **Smart Navigation**: Context-aware navigation with proper state management

## Mobile Navigation Usage

### Gesture Controls
- **Swipe Right**: Navigate back to the previous screen
- **Hardware Back Button**: Use your device's back button (Android)
- **Browser Back Button**: Standard browser back button support
- **Escape Key**: Press Escape to navigate back (desktop)

### Visual Indicators
- **Back Button**: Appears in the header when navigation history is available
- **Swipe Hint**: First-time users see a helpful swipe gesture hint
- **Smooth Transitions**: Animated transitions between screens for better UX

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key

3. Run the app:
   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:5173` (or the port shown in terminal)

## Mobile Testing

For the best mobile experience:
1. Open the app in your mobile browser
2. Add to home screen for app-like experience
3. Test swipe gestures by swiping right from the left edge
4. Use hardware back button on Android devices
5. Navigate through different sections to experience the gesture navigation

## Technology Stack

- **React 19** - Modern React with latest features
- **TypeScript** - Type-safe development
- **Framer Motion** - Smooth animations and gesture handling
- **Tailwind CSS** - Utility-first styling with custom glass morphism
- **Chart.js** - Interactive charts and analytics
- **Vite** - Fast development and build tool
- **LocalStorage** - Client-side data persistence

## Architecture

- **Context-based State Management**: Centralized app state with React Context
- **Custom Hooks**: Reusable logic for navigation, data management, and gestures
- **Component-based Architecture**: Modular, reusable components
- **Mobile-first Responsive Design**: Optimized for mobile with desktop support
- **Gesture-driven Navigation**: Natural mobile navigation patterns
