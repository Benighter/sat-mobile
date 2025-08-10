#!/usr/bin/env node

/**
 * Push Notification Test Script for SAT Mobile
 * 
 * This script helps test and verify push notification setup
 * Run with: node scripts/test-push-notifications.js
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Initialize Firebase Admin SDK
// Make sure you have the service account key file
try {
  // Try to initialize with default credentials first
  admin.initializeApp();
  console.log('✅ Firebase Admin SDK initialized with default credentials');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK');
  console.error('Make sure you have proper Firebase credentials configured');
  console.error('You can set GOOGLE_APPLICATION_CREDENTIALS environment variable');
  process.exit(1);
}

const db = admin.firestore();
const messaging = admin.messaging();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function testPushNotificationSetup() {
  console.log('🧪 SAT Mobile Push Notification Test');
  console.log('====================================\n');

  try {
    // Step 1: Check if we can access Firestore
    console.log('1. Testing Firestore connection...');
    const testDoc = await db.collection('test').doc('connection').set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      test: 'push-notification-setup'
    });
    await db.collection('test').doc('connection').delete();
    console.log('✅ Firestore connection successful\n');

    // Step 2: Get church ID and user input
    const churchId = await askQuestion('Enter your church ID (e.g., sat-mobile-church): ');
    if (!churchId.trim()) {
      console.log('❌ Church ID is required');
      process.exit(1);
    }

    // Step 3: List device tokens for the church
    console.log('\n2. Checking device tokens...');
    const tokensSnapshot = await db.collection(`churches/${churchId}/deviceTokens`)
      .where('isActive', '==', true)
      .get();

    if (tokensSnapshot.empty) {
      console.log('❌ No active device tokens found');
      console.log('Make sure at least one admin has enabled push notifications');
      process.exit(1);
    }

    console.log(`✅ Found ${tokensSnapshot.size} active device token(s)`);
    
    // Show tokens (truncated for security)
    tokensSnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`   ${index + 1}. ${data.platform} - ${data.id.substring(0, 20)}... (User: ${data.userId})`);
    });

    // Step 4: Ask if user wants to send test notification
    const sendTest = await askQuestion('\n3. Send test notification to all devices? (y/n): ');
    
    if (sendTest.toLowerCase() !== 'y') {
      console.log('Test cancelled');
      process.exit(0);
    }

    // Step 5: Send test notifications
    console.log('\n4. Sending test notifications...');
    const tokens = [];
    tokensSnapshot.forEach(doc => tokens.push(doc.id));

    const message = {
      notification: {
        title: '🧪 SAT Mobile Test',
        body: 'Push notifications are working correctly! 🎉'
      },
      data: {
        test: 'true',
        timestamp: Date.now().toString(),
        source: 'test-script'
      },
      webpush: {
        headers: {
          'TTL': '86400'
        },
        notification: {
          title: '🧪 SAT Mobile Test',
          body: 'Push notifications are working correctly! 🎉',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          requireInteraction: true,
          actions: [
            {
              action: 'open',
              title: 'Open App'
            }
          ]
        }
      },
      android: {
        notification: {
          title: '🧪 SAT Mobile Test',
          body: 'Push notifications are working correctly! 🎉',
          icon: 'ic_notification',
          color: '#334155',
          sound: 'default'
        },
        priority: 'high'
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: '🧪 SAT Mobile Test',
              body: 'Push notifications are working correctly! 🎉'
            },
            badge: 1,
            sound: 'default'
          }
        }
      }
    };

    // Send to each token individually for better error handling
    let successCount = 0;
    let failureCount = 0;
    const failedTokens = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      try {
        const response = await messaging.send({
          ...message,
          token: token
        });
        console.log(`   ✅ Sent to token ${i + 1}: ${response}`);
        successCount++;
      } catch (error) {
        console.log(`   ❌ Failed to send to token ${i + 1}: ${error.message}`);
        failureCount++;
        failedTokens.push({ token, error: error.message });
      }
    }

    // Step 6: Report results
    console.log('\n5. Test Results:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failureCount}`);

    if (failedTokens.length > 0) {
      console.log('\nFailed tokens (may need cleanup):');
      failedTokens.forEach((failed, index) => {
        console.log(`   ${index + 1}. ${failed.token.substring(0, 20)}... - ${failed.error}`);
      });

      // Ask if user wants to clean up invalid tokens
      const cleanup = await askQuestion('\nClean up invalid tokens? (y/n): ');
      if (cleanup.toLowerCase() === 'y') {
        console.log('\n6. Cleaning up invalid tokens...');
        const batch = db.batch();
        
        for (const failed of failedTokens) {
          if (failed.error.includes('registration-token-not-registered') || 
              failed.error.includes('invalid-registration-token')) {
            const tokenRef = db.doc(`churches/${churchId}/deviceTokens/${failed.token}`);
            batch.update(tokenRef, {
              isActive: false,
              lastError: failed.error,
              lastErrorAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }

        await batch.commit();
        console.log('✅ Invalid tokens marked as inactive');
      }
    }

    if (successCount > 0) {
      console.log('\n🎉 Test completed! Check your devices for the test notification.');
      console.log('If you received the notification, your push notification setup is working correctly!');
    } else {
      console.log('\n❌ No notifications were sent successfully.');
      console.log('Please check your Firebase configuration and device token setup.');
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('Full error:', error);
  } finally {
    rl.close();
  }
}

// Additional utility functions
async function listChurches() {
  console.log('\n📋 Available Churches:');
  try {
    const churchesSnapshot = await db.collection('churches').get();
    if (churchesSnapshot.empty) {
      console.log('No churches found');
      return;
    }

    churchesSnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`${index + 1}. ${doc.id} - ${data.name || 'Unnamed Church'}`);
    });
  } catch (error) {
    console.error('Failed to list churches:', error.message);
  }
}

async function showUsage() {
  console.log('SAT Mobile Push Notification Test Script');
  console.log('Usage: node scripts/test-push-notifications.js [command]');
  console.log('');
  console.log('Commands:');
  console.log('  test     - Run push notification test (default)');
  console.log('  churches - List available churches');
  console.log('  help     - Show this help message');
  console.log('');
  console.log('Environment:');
  console.log('  GOOGLE_APPLICATION_CREDENTIALS - Path to service account key file');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/test-push-notifications.js');
  console.log('  node scripts/test-push-notifications.js churches');
  console.log('  GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/test-push-notifications.js');
}

// Main execution
const command = process.argv[2] || 'test';

async function main() {
  switch (command) {
    case 'test':
      await testPushNotificationSetup();
      break;
    case 'churches':
      await listChurches();
      rl.close();
      break;
    case 'help':
      await showUsage();
      rl.close();
      break;
    default:
      console.log(`Unknown command: ${command}`);
      await showUsage();
      rl.close();
      break;
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  rl.close();
  process.exit(1);
});
