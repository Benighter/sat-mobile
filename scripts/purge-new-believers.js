#!/usr/bin/env node

/**
 * Danger: Hard-delete all New Believers in a church
 *
 * Usage (PowerShell):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\path\\to\\serviceAccount.json"; node scripts/purge-new-believers.js --church <CHURCH_ID> [--attendance]
 *
 * Requirements:
 * - A Firebase service account key JSON and GOOGLE_APPLICATION_CREDENTIALS pointing to it
 * - The provided church ID is correct (this will delete data under churches/<churchId>/newBelievers)
 */

import admin from 'firebase-admin';

// --- Arg parsing ---
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.findIndex(a => a === `--${name}`);
  if (idx >= 0) {
    return args[idx + 1] && !args[idx + 1].startsWith('--') ? args[idx + 1] : true;
  }
  return undefined;
};

const churchId = getArg('church');
const alsoAttendance = args.includes('--attendance') || getArg('attendance') === true;
const skipPrompt = args.includes('--yes') || getArg('yes') === true;
const dryRun = args.includes('--dry-run') || getArg('dry-run') === true;

if (!churchId) {
  console.error('❌ Missing required --church <CHURCH_ID> argument');
  process.exit(1);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('❌ GOOGLE_APPLICATION_CREDENTIALS not set to your service account JSON');
  console.error('   Set it then re-run this script.');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();

const collectionPath = (name) => `churches/${churchId}/${name}`;

async function deleteInBatches(colPath, whereField, whereValue) {
  const batchSize = 400; // safe margin under 500 limit
  let totalDeleted = 0;

  while (true) {
    let queryRef = db.collection(colPath).limit(batchSize);
    if (whereField && typeof whereValue !== 'undefined') {
      queryRef = queryRef.where(whereField, '==', whereValue);
    }

    const snap = await queryRef.get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += snap.size;
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 50));
  }

  return totalDeleted;
}

async function countDocs(colPath) {
  const snap = await db.collection(colPath).get();
  return snap.size;
}

async function main() {
  console.log('⚠️  DANGER OPERATION: Hard delete New Believers');
  console.log(`• Church: ${churchId}`);
  console.log(`• Path: ${collectionPath('newBelievers')}`);
  console.log(`• Also delete related attendance: ${alsoAttendance ? 'Yes' : 'No'}`);
  console.log(`• Dry run: ${dryRun ? 'Yes' : 'No'}`);

  // Pre-count
  const nbCount = await countDocs(collectionPath('newBelievers'));
  console.log(`\nAbout to delete ${nbCount} document(s) from newBelievers.`);

  if (nbCount === 0) {
    console.log('Nothing to delete. Exiting.');
    process.exit(0);
  }

  if (dryRun) {
    console.log('\n🧪 Dry run only. No deletions will be performed.');
    process.exit(0);
  }

  // Interactive confirmation only if running in a TTY
  if (!skipPrompt && process.stdin.isTTY) {
    process.stdout.write('\nType DELETE to proceed: ');
    const input = await new Promise(resolve => {
      process.stdin.once('data', d => resolve(String(d).trim()));
    });
    if (input !== 'DELETE') {
      console.log('Aborted.');
      process.exit(1);
    }
  } else {
    console.log(skipPrompt ? 'Proceeding with --yes.' : 'No TTY detected; proceeding without prompt.');
  }

  // Gather all newBeliever IDs first (so we can clean attendance reliably)
  const nbSnap = await db.collection(collectionPath('newBelievers')).get();
  const nbIds = nbSnap.docs.map(d => d.id);

  // Delete all newBelievers
  console.log('\n🗑️ Deleting newBelievers in batches...');
  const deletedNB = await deleteInBatches(collectionPath('newBelievers'));
  console.log(`✅ Deleted ${deletedNB} newBelievers.`);

  if (alsoAttendance && nbIds.length > 0) {
    console.log('\n🧹 Cleaning related attendance records...');
    let totalDeleted = 0;
    for (const id of nbIds) {
      while (true) {
        const snap = await db.collection(collectionPath('attendance')).where('newBelieverId', '==', id).limit(400).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        totalDeleted += snap.size;
        await new Promise(r => setTimeout(r, 20));
      }
    }
    console.log(`✅ Deleted ${totalDeleted} attendance record(s) linked to new believers.`);
  }

  console.log('\n🎉 Purge complete.');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Failed to purge new believers:', err?.message || err);
  process.exit(1);
});
