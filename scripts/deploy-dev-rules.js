#!/usr/bin/env node

/**
 * Deploy Development Firestore Rules
 * 
 * This script temporarily deploys development rules that allow unauthenticated
 * access to SuperAdmin collections for prototype testing.
 * 
 * WARNING: These rules are NOT secure for production!
 * 
 * Usage: node scripts/deploy-dev-rules.js
 */

import { execSync } from 'child_process';
import { copyFileSync, existsSync } from 'fs';

console.log('🔧 Deploying development Firestore rules...');
console.log('⚠️  WARNING: These rules allow unauthenticated SuperAdmin access!');
console.log('⚠️  DO NOT use in production!');
console.log('');

try {
  // Check if Firebase CLI is available
  try {
    execSync('firebase --version', { stdio: 'ignore' });
  } catch (error) {
    console.error('❌ Firebase CLI not found. Please install it:');
    console.log('   npm install -g firebase-tools');
    console.log('   firebase login');
    process.exit(1);
  }

  // Check if development rules exist
  if (!existsSync('firestore.rules.dev')) {
    console.error('❌ Development rules file not found: firestore.rules.dev');
    process.exit(1);
  }

  // Backup current rules
  if (existsSync('firestore.rules')) {
    copyFileSync('firestore.rules', 'firestore.rules.backup');
    console.log('📋 Backed up current rules to firestore.rules.backup');
  }

  // Copy development rules
  copyFileSync('firestore.rules.dev', 'firestore.rules');
  console.log('📄 Copied development rules to firestore.rules');

  // Deploy rules
  console.log('🚀 Deploying rules to Firebase...');
  execSync('firebase deploy --only firestore:rules', { stdio: 'inherit' });

  console.log('');
  console.log('✅ Development rules deployed successfully!');
  console.log('');
  console.log('🔓 SuperAdmin prototype now has unauthenticated access');
  console.log('📝 To restore production rules later:');
  console.log('   cp firestore.rules.backup firestore.rules');
  console.log('   firebase deploy --only firestore:rules');
  console.log('');
  console.log('🔐 For production, set up proper SuperAdmin authentication:');
  console.log('   npm run setup:superadmin');

} catch (error) {
  console.error('❌ Error deploying development rules:', error.message);
  process.exit(1);
}
