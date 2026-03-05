#!/usr/bin/env node

/**
 * Setup SuperAdmin User Script
 * 
 * This script creates a proper Firebase Auth user for SuperAdmin with the correct
 * Firestore user document containing superAdmin: true flag.
 * 
 * Usage: node scripts/setup-superadmin.js
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// SuperAdmin credentials
const SUPERADMIN_EMAIL = 'admin@gmail.com';
const SUPERADMIN_PASSWORD = 'Admin@123';
const SUPERADMIN_DISPLAY_NAME = 'Super Administrator';

async function setupSuperAdmin() {
  try {
    console.log('🔧 Setting up SuperAdmin user...');

    // Initialize Firebase Admin SDK
    let serviceAccount;
    try {
      // Try to load service account key
      const serviceAccountPath = join(__dirname, '..', 'firebase-service-account.json');
      serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    } catch (error) {
      console.error('❌ Firebase service account key not found.');
      console.log('📝 To set up SuperAdmin, you need to:');
      console.log('1. Go to Firebase Console > Project Settings > Service Accounts');
      console.log('2. Click "Generate new private key"');
      console.log('3. Save the JSON file as "firebase-service-account.json" in the project root');
      console.log('4. Run this script again');
      process.exit(1);
    }

    const app = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id
    });

    const auth = getAuth(app);
    const firestore = getFirestore(app);

    console.log('🔍 Checking if SuperAdmin user exists...');

    let userRecord;
    try {
      // Try to get existing user
      userRecord = await auth.getUserByEmail(SUPERADMIN_EMAIL);
      console.log('✅ SuperAdmin user already exists in Firebase Auth');
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log('👤 Creating SuperAdmin user in Firebase Auth...');
        userRecord = await auth.createUser({
          email: SUPERADMIN_EMAIL,
          password: SUPERADMIN_PASSWORD,
          displayName: SUPERADMIN_DISPLAY_NAME,
          emailVerified: true
        });
        console.log('✅ SuperAdmin user created in Firebase Auth');
      } else {
        throw error;
      }
    }

    console.log('📄 Setting up SuperAdmin user document in Firestore...');

    // Create/update user document in Firestore
    const userDocRef = firestore.collection('users').doc(userRecord.uid);
    await userDocRef.set({
      email: SUPERADMIN_EMAIL,
      displayName: SUPERADMIN_DISPLAY_NAME,
      firstName: 'Super',
      lastName: 'Administrator',
      role: 'superadmin',
      superAdmin: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      // No churchId - SuperAdmin operates across all churches
    }, { merge: true });

    console.log('✅ SuperAdmin user document created/updated in Firestore');
    console.log('');
    console.log('🎉 SuperAdmin setup complete!');
    console.log('');
    console.log('📋 SuperAdmin credentials:');
    console.log(`   Email: ${SUPERADMIN_EMAIL}`);
    console.log(`   Password: ${SUPERADMIN_PASSWORD}`);
    console.log('');
    console.log('🔐 The SuperAdmin user now has:');
    console.log('   ✓ Firebase Auth account');
    console.log('   ✓ Firestore user document with superAdmin: true');
    console.log('   ✓ Proper permissions for all SuperAdmin operations');
    console.log('');
    console.log('🚀 You can now sign in to SuperAdmin in the app!');

  } catch (error) {
    console.error('❌ Error setting up SuperAdmin:', error);
    process.exit(1);
  }
}

// Run the setup
setupSuperAdmin();
