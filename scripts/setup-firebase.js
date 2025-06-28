#!/usr/bin/env node

/**
 * Firebase Setup Script for Church Connect Mobile
 * This script helps set up Firebase configuration and guides through the migration process
 */

import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

console.log('🔥 Firebase Setup for Church Connect Mobile');
console.log('===========================================\n');

async function setupFirebase() {
  try {
    // Check if .env already exists
    if (fs.existsSync('.env')) {
      console.log('⚠️  .env file already exists.');
      const overwrite = await question('Do you want to overwrite it? (y/N): ');
      if (overwrite.toLowerCase() !== 'y') {
        console.log('Setup cancelled. You can manually edit your .env file.');
        rl.close();
        return;
      }
    }

    console.log('📝 Let\'s configure your Firebase project settings...\n');
    
    // Collect Firebase configuration
    const apiKey = await question('Enter your Firebase API Key: ');
    const authDomain = await question('Enter your Firebase Auth Domain (e.g., your-project.firebaseapp.com): ');
    const projectId = await question('Enter your Firebase Project ID: ');
    const storageBucket = await question('Enter your Firebase Storage Bucket (e.g., your-project.appspot.com): ');
    const messagingSenderId = await question('Enter your Firebase Messaging Sender ID: ');
    const appId = await question('Enter your Firebase App ID: ');
    
    // Optional settings
    console.log('\n🔧 Optional settings...');
    const useEmulator = await question('Use Firebase emulators for development? (y/N): ');
    const geminiApiKey = await question('Enter your Gemini API Key (optional, press Enter to skip): ');

    // Create .env file
    const envContent = `# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=${apiKey}
REACT_APP_FIREBASE_AUTH_DOMAIN=${authDomain}
REACT_APP_FIREBASE_PROJECT_ID=${projectId}
REACT_APP_FIREBASE_STORAGE_BUCKET=${storageBucket}
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=${messagingSenderId}
REACT_APP_FIREBASE_APP_ID=${appId}

# Development Settings
REACT_APP_USE_FIREBASE_EMULATOR=${useEmulator.toLowerCase() === 'y' ? 'true' : 'false'}

# Gemini API Key (optional)
${geminiApiKey ? `GEMINI_API_KEY=${geminiApiKey}` : '# GEMINI_API_KEY=your-gemini-api-key-here'}
`;

    fs.writeFileSync('.env', envContent);
    console.log('\n✅ .env file created successfully!');

    // Update main entry point
    console.log('\n🔄 Updating main entry point...');
    
    // Check current index.tsx
    if (fs.existsSync('index.tsx')) {
      const indexContent = fs.readFileSync('index.tsx', 'utf8');
      
      if (!indexContent.includes('FirebaseApp')) {
        const useFirebase = await question('Switch to Firebase app now? (Y/n): ');
        
        if (useFirebase.toLowerCase() !== 'n') {
          // Backup original
          fs.writeFileSync('index.tsx.backup', indexContent);
          console.log('📦 Original index.tsx backed up as index.tsx.backup');
          
          // Update to use FirebaseApp
          const newIndexContent = indexContent.replace(
            /import App from ['"]\.\/App['"];?/,
            "import FirebaseApp from './FirebaseApp';"
          ).replace(
            /<App\s*\/>/g,
            '<FirebaseApp />'
          );
          
          fs.writeFileSync('index.tsx', newIndexContent);
          console.log('✅ Updated index.tsx to use FirebaseApp');
        }
      }
    }

    // Display next steps
    console.log('\n🎉 Firebase setup complete!');
    console.log('\n📋 Next Steps:');
    console.log('1. Set up your Firebase project:');
    console.log('   - Go to https://console.firebase.google.com/');
    console.log('   - Enable Firestore Database');
    console.log('   - Enable Authentication (Email/Password)');
    console.log('   - Apply security rules from FIREBASE_MIGRATION_GUIDE.md');
    
    console.log('\n2. Create initial user and church documents:');
    console.log('   - See FIREBASE_MIGRATION_GUIDE.md for detailed instructions');
    
    console.log('\n3. Test the setup:');
    console.log('   - Run: npm run test:firebase');
    console.log('   - Run: npm run dev');
    
    console.log('\n4. Migration:');
    console.log('   - If you have existing data, the app will show a migration modal');
    console.log('   - Backup your data before migrating');
    console.log('   - Follow the migration wizard');
    
    console.log('\n📖 For detailed instructions, see FIREBASE_MIGRATION_GUIDE.md');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

// Check if Firebase is installed
if (!fs.existsSync('node_modules/firebase')) {
  console.log('❌ Firebase is not installed. Please run: npm install firebase');
  process.exit(1);
}

setupFirebase();
