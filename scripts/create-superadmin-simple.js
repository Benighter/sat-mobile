#!/usr/bin/env node

/**
 * Simple SuperAdmin User Creation Script
 * 
 * This script creates the SuperAdmin user using Firebase Admin SDK
 * without requiring Firebase Console access.
 * 
 * Usage: node scripts/create-superadmin-simple.js
 */

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Your Firebase config (from firebase.config.ts)
const firebaseConfig = {
  apiKey: "AIzaSyDkyjDhyz_LCbUpRgftD2qo31e5SteAiKg",
  authDomain: "sat-mobile-de6f1.firebaseapp.com",
  projectId: "sat-mobile-de6f1",
  storageBucket: "sat-mobile-de6f1.firebasestorage.app",
  messagingSenderId: "1076014285349",
  appId: "1:1076014285349:web:d72d460aefe5ca8d76b5cc"
};

// SuperAdmin credentials
const SUPERADMIN_EMAIL = 'admin@gmail.com';
const SUPERADMIN_PASSWORD = 'Admin@123';

async function createSuperAdmin() {
  try {
    console.log('🔧 Creating SuperAdmin user...');

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const firestore = getFirestore(app);

    console.log('🔍 Checking if SuperAdmin user exists...');

    let userCredential;
    try {
      // Try to sign in first (to check if user exists)
      userCredential = await signInWithEmailAndPassword(auth, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
      console.log('✅ SuperAdmin user already exists in Firebase Auth');
    } catch (error) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        console.log('👤 Creating SuperAdmin user in Firebase Auth...');
        userCredential = await createUserWithEmailAndPassword(auth, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
        console.log('✅ SuperAdmin user created in Firebase Auth');
      } else {
        throw error;
      }
    }

    const user = userCredential.user;
    console.log('📄 Creating SuperAdmin user document in Firestore...');

    // Create user document in Firestore
    const userDocRef = doc(firestore, 'users', user.uid);
    await setDoc(userDocRef, {
      email: SUPERADMIN_EMAIL,
      displayName: 'Super Administrator',
      firstName: 'Super',
      lastName: 'Administrator',
      role: 'superadmin',
      superAdmin: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      // No churchId - SuperAdmin operates across all churches
    }, { merge: true });

    console.log('✅ SuperAdmin user document created in Firestore');
    console.log('');
    console.log('🎉 SuperAdmin setup complete!');
    console.log('');
    console.log('📋 SuperAdmin credentials:');
    console.log(`   Email: ${SUPERADMIN_EMAIL}`);
    console.log(`   Password: ${SUPERADMIN_PASSWORD}`);
    console.log(`   UID: ${user.uid}`);
    console.log('');
    console.log('🔐 The SuperAdmin user now has:');
    console.log('   ✓ Firebase Auth account');
    console.log('   ✓ Firestore user document with superAdmin: true');
    console.log('   ✓ Proper permissions for all SuperAdmin operations');
    console.log('');
    console.log('🚀 You can now sign in to SuperAdmin in the app!');

  } catch (error) {
    console.error('❌ Error creating SuperAdmin:', error);
    
    if (error.code === 'auth/email-already-in-use') {
      console.log('');
      console.log('ℹ️  The email is already in use. This might mean:');
      console.log('   1. SuperAdmin user already exists');
      console.log('   2. Try signing in with admin@gmail.com / Admin@123');
      console.log('   3. If login fails, the Firestore document might be missing');
    }
    
    process.exit(1);
  }
}

// Run the creation
createSuperAdmin();
