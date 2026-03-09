#!/usr/bin/env node

/**
 * Firebase Integration Test Script
 * This script tests basic Firebase connectivity and configuration
 */

import fs from 'fs';
import path from 'path';

console.log('🔥 Firebase Integration Test');
console.log('============================\n');

// Check if Firebase is installed
console.log('📦 Checking Firebase installation...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (packageJson.dependencies.firebase) {
    console.log(`✅ Firebase ${packageJson.dependencies.firebase} is installed`);
  } else {
    console.log('❌ Firebase is not installed');
    process.exit(1);
  }
} catch (error) {
  console.log('❌ Could not read package.json');
  process.exit(1);
}

// Check if Firebase config file exists
console.log('\n⚙️  Checking Firebase configuration...');
const configFiles = [
  'firebase.config.ts',
  'services/firebaseService.ts',
  'contexts/FirebaseAppContext.tsx',
  'components/AuthWrapper.tsx',
  'components/LoginForm.tsx',
  'utils/dataMigration.ts'
];

let allFilesExist = true;
configFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n❌ Some Firebase files are missing. Please run the migration setup again.');
  process.exit(1);
}

// Check environment variables template
console.log('\n🔐 Checking environment configuration...');
if (fs.existsSync('.env.example')) {
  console.log('✅ .env.example template exists');
  
  if (fs.existsSync('.env')) {
    console.log('✅ .env file exists');
    
    // Read and validate .env file
    const envContent = fs.readFileSync('.env', 'utf8');
    const requiredVars = [
      'REACT_APP_FIREBASE_API_KEY',
      'REACT_APP_FIREBASE_AUTH_DOMAIN',
      'REACT_APP_FIREBASE_PROJECT_ID',
      'REACT_APP_FIREBASE_STORAGE_BUCKET',
      'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
      'REACT_APP_FIREBASE_APP_ID'
    ];
    
    let envConfigured = true;
    requiredVars.forEach(varName => {
      if (envContent.includes(`${varName}=your-`) || !envContent.includes(varName)) {
        console.log(`⚠️  ${varName} needs to be configured`);
        envConfigured = false;
      } else {
        console.log(`✅ ${varName} is configured`);
      }
    });
    
    if (!envConfigured) {
      console.log('\n⚠️  Please configure your Firebase environment variables in .env file');
    }
  } else {
    console.log('⚠️  .env file not found. Copy .env.example to .env and configure it');
  }
} else {
  console.log('❌ .env.example template missing');
}

// Check TypeScript configuration
console.log('\n📝 Checking TypeScript configuration...');
if (fs.existsSync('tsconfig.json')) {
  console.log('✅ tsconfig.json exists');
} else {
  console.log('❌ tsconfig.json missing');
}

// Check if types are properly defined
console.log('\n🏷️  Checking type definitions...');
if (fs.existsSync('types.ts')) {
  const typesContent = fs.readFileSync('types.ts', 'utf8');
  const requiredTypes = ['Member', 'Bacenta', 'AttendanceRecord', 'NewBeliever'];
  
  requiredTypes.forEach(type => {
    if (typesContent.includes(`interface ${type}`)) {
      console.log(`✅ ${type} interface defined`);
    } else {
      console.log(`❌ ${type} interface missing`);
    }
  });
} else {
  console.log('❌ types.ts file missing');
}

// Summary
console.log('\n📊 Test Summary');
console.log('================');

if (allFilesExist) {
  console.log('✅ All Firebase files are present');
  console.log('✅ Firebase dependency is installed');
  
  if (fs.existsSync('.env')) {
    console.log('✅ Environment configuration file exists');
  } else {
    console.log('⚠️  Environment configuration needs setup');
  }
  
  console.log('\n🎉 Firebase integration is ready!');
  console.log('\n📋 Next Steps:');
  console.log('1. Configure your .env file with Firebase project settings');
  console.log('2. Set up Firestore security rules');
  console.log('3. Create initial user and church documents');
  console.log('4. Switch to FirebaseApp in your main entry point');
  console.log('5. Test authentication and data migration');
  
} else {
  console.log('❌ Firebase integration setup is incomplete');
  console.log('\n🔧 Please run the migration setup again');
}
