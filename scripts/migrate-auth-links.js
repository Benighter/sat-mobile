#!/usr/bin/env node

/**
 * Firebase Dynamic Links to Hosting Migration Script
 * 
 * This script migrates your Firebase project from Dynamic Links to Firebase Hosting
 * for authentication email links (password reset, email verification, etc.)
 * 
 * Required before August 25, 2025 when Firebase Dynamic Links shuts down.
 */

const admin = require('firebase-admin');
const { getProjectConfigManager } = require('firebase-admin/project-config');

// Initialize Firebase Admin SDK
// Make sure you have GOOGLE_APPLICATION_CREDENTIALS environment variable set
// or provide the path to your service account key file
try {
  admin.initializeApp({
    projectId: 'sat-mobile-de6f1', // Your Firebase project ID
  });
  console.log('✅ Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
  console.log('\n📋 Setup Instructions:');
  console.log('1. Download your service account key from Firebase Console');
  console.log('2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable');
  console.log('3. Or place the key file in this directory and update the script');
  process.exit(1);
}

async function migrateToHostingLinks() {
  try {
    console.log('🔄 Starting migration from Dynamic Links to Firebase Hosting...\n');

    const projectConfigManager = getProjectConfigManager();
    
    // Configuration to use Firebase Hosting for mobile authentication links
    const updateRequest = {
      mobileLinksConfig: {
        domain: 'sat-mobile-de6f1.firebaseapp.com' // Your Firebase Hosting domain
      }
    };

    console.log('📝 Updating project configuration...');
    console.log('   Domain:', updateRequest.mobileLinksConfig.domain);
    
    const response = await projectConfigManager.updateProjectConfig(updateRequest);
    
    console.log('✅ Migration completed successfully!');
    console.log('\n📋 What changed:');
    console.log('   • Password reset emails now use Firebase Hosting links');
    console.log('   • Email verification links now use Firebase Hosting links');
    console.log('   • Links will use format: https://sat-mobile-de6f1.firebaseapp.com/__/auth/links');
    
    console.log('\n🧪 Next Steps:');
    console.log('1. Test password reset flow on your Android app');
    console.log('2. Verify the new links work correctly');
    console.log('3. Deploy your updated Android app with the new intent filter');
    
    console.log('\n⚠️  Important Notes:');
    console.log('• Keep your existing Dynamic Links working until August 25, 2025');
    console.log('• Test thoroughly before deploying to production');
    console.log('• Monitor for any issues after deployment');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('• Ensure you have Project Editor or Owner permissions');
    console.log('• Verify your service account key is valid');
    console.log('• Check that Firebase Hosting is enabled for your project');
    process.exit(1);
  }
}

async function rollbackToDynamicLinks() {
  try {
    console.log('🔄 Rolling back to Dynamic Links...\n');

    const projectConfigManager = getProjectConfigManager();
    
    // Configuration to use Dynamic Links (rollback)
    const updateRequest = {
      mobileLinksConfig: {
        domain: 'FIREBASE_DYNAMIC_LINK' // Special value to use Dynamic Links
      }
    };

    console.log('📝 Updating project configuration...');
    console.log('   Rolling back to Dynamic Links');
    
    const response = await projectConfigManager.updateProjectConfig(updateRequest);
    
    console.log('✅ Rollback completed successfully!');
    console.log('   • Authentication emails now use Dynamic Links again');
    console.log('   • This is temporary - remember to migrate before August 25, 2025');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error.message);
    process.exit(1);
  }
}

// Command line interface
const command = process.argv[2];

if (command === 'migrate') {
  migrateToHostingLinks();
} else if (command === 'rollback') {
  rollbackToDynamicLinks();
} else {
  console.log('🔥 Firebase Dynamic Links Migration Tool\n');
  console.log('Usage:');
  console.log('  node scripts/migrate-auth-links.js migrate   - Migrate to Firebase Hosting');
  console.log('  node scripts/migrate-auth-links.js rollback  - Rollback to Dynamic Links');
  console.log('\n📅 Deadline: August 25, 2025');
  console.log('📖 Documentation: https://firebase.google.com/support/dynamic-links-faq');
}
