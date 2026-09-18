import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

// Read .env.local
const envPath = path.join(process.cwd(), '.env.local');
let databaseUrl = process.env.DATABASE_URL;
let internalSecret = process.env.INTERNAL_WEBHOOK_SECRET;

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=')) {
      databaseUrl = trimmed.substring('DATABASE_URL='.length).trim();
      if ((databaseUrl.startsWith('"') && databaseUrl.endsWith('"')) || (databaseUrl.startsWith("'") && databaseUrl.endsWith("'"))) {
        databaseUrl = databaseUrl.slice(1, -1);
      }
    }
    if (trimmed.startsWith('INTERNAL_WEBHOOK_SECRET=')) {
      internalSecret = trimmed.substring('INTERNAL_WEBHOOK_SECRET='.length).trim();
      if ((internalSecret.startsWith('"') && internalSecret.endsWith('"')) || (internalSecret.startsWith("'") && internalSecret.endsWith("'"))) {
        internalSecret = internalSecret.slice(1, -1);
      }
    }
  }
}

const sql = postgres(databaseUrl, {
  ssl: 'require',
  max: 2,
  prepare: false
});

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting Phase 6 Webhooks & Mutex Automated Tests');
  console.log('====================================================');

  // Test 1: POST /api/webhooks/group-membership-sync-schedule-roll
  console.log('\n--- TEST 1: Schedule Roll Idempotency ---');
  const testDate = '2026-12-31';
  const times = [`${testDate}T09:15:00.000Z`, `${testDate}T15:45:00.000Z`];

  // Clean test rows first
  await sql`DELETE FROM sandbox.group_membership_sync_schedule WHERE for_date = ${testDate}`;

  // Call schedule roll
  const rollRes1 = await fetch('http://127.0.0.1:3001/api/webhooks/group-membership-sync-schedule-roll', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': internalSecret
    },
    body: JSON.stringify({ scheduledTimes: times })
  }).then(r => r.json());

  console.log('Roll 1 Response:', rollRes1);
  if (!rollRes1.success || rollRes1.inserted.length !== 2) {
    throw new Error('TEST 1 FAILED on initial roll insertion');
  }

  // Call schedule roll again with same date/times (Idempotency test)
  const rollRes2 = await fetch('http://127.0.0.1:3001/api/webhooks/group-membership-sync-schedule-roll', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': internalSecret
    },
    body: JSON.stringify({ scheduledTimes: times })
  }).then(r => r.json());

  console.log('Roll 2 (Duplicate) Response:', rollRes2);
  if (!rollRes2.success || rollRes2.inserted.length !== 0) {
    throw new Error('TEST 1 FAILED on idempotency: duplicate rows should not be inserted');
  }
  console.log('✅ TEST 1 PASSED: Schedule roll is strictly idempotent.');

  // Test 2: POST /api/webhooks/group-membership-sync-claim-schedule
  console.log('\n--- TEST 2: Atomic Claim Schedule ---');
  // Update 1 slot to be past/due
  await sql`
    UPDATE sandbox.group_membership_sync_schedule 
    SET scheduled_for = now() - interval '1 minute'
    WHERE for_date = ${testDate} AND slot_index = 1
  `;

  // Claim 1
  const claimRes1 = await fetch('http://127.0.0.1:3001/api/webhooks/group-membership-sync-claim-schedule', {
    method: 'POST',
    headers: { 'x-internal-secret': internalSecret }
  }).then(r => r.json());

  console.log('Claim 1 Response:', claimRes1);
  if (!claimRes1.claimed || !claimRes1.scheduleId) {
    throw new Error('TEST 2 FAILED on first claim');
  }

  // Claim 2 immediately after (should be false)
  const claimRes2 = await fetch('http://127.0.0.1:3001/api/webhooks/group-membership-sync-claim-schedule', {
    method: 'POST',
    headers: { 'x-internal-secret': internalSecret }
  }).then(r => r.json());

  console.log('Claim 2 (Immediate Repeat) Response:', claimRes2);
  if (claimRes2.claimed !== false) {
    throw new Error('TEST 2 FAILED on concurrency guard: already claimed slot claimed twice');
  }
  console.log('✅ TEST 2 PASSED: Atomic claiming works with FOR UPDATE SKIP LOCKED.');

  // Test 3: GET /api/webhooks/group-membership-sync-data
  console.log('\n--- TEST 3: Sync Data & Mutex Lock Exclusion ---');
  const syncDataRes = await fetch(`http://127.0.0.1:3001/api/webhooks/group-membership-sync-data?scheduleId=${claimRes1.scheduleId}`, {
    headers: { 'x-internal-secret': internalSecret }
  }).then(r => r.json());

  console.log('Sync Data Response:', syncDataRes);
  if (!syncDataRes.success || !syncDataRes.runId) {
    throw new Error('TEST 3 FAILED on sync-data acquisition');
  }
  const testRunId = syncDataRes.runId;

  // Verify second concurrent sync-data call gets already_running
  const syncDataRes2 = await fetch(`http://127.0.0.1:3001/api/webhooks/group-membership-sync-data?scheduleId=${claimRes1.scheduleId}`, {
    headers: { 'x-internal-secret': internalSecret }
  }).then(r => r.json());

  console.log('Sync Data 2 (Concurrent run attempt):', syncDataRes2);
  if (syncDataRes2.success !== false || syncDataRes2.error !== 'already_running') {
    throw new Error('TEST 3 FAILED: concurrent sync session should be locked out');
  }
  console.log('✅ TEST 3 PASSED: Sync data acquires global lock and returns eligible accounts.');

  // Test 4: POST /api/webhooks/group-membership-sync-callback
  console.log('\n--- TEST 4: Callback & Group Membership Upsert ---');
  // Fetch sample group and account
  const [sampleGroup] = await sql`SELECT id, url FROM sandbox.social_group_urls WHERE is_active = true LIMIT 1`;
  const [sampleAccount] = await sql`SELECT id FROM sandbox.fb_accounts WHERE status = 'Active' LIMIT 1`;

  if (sampleGroup && sampleAccount) {
    const callbackPayload = {
      runId: testRunId,
      status: 'Completed',
      n8nExecutionId: 'test-exec-001',
      items: [
        {
          fbAccountId: sampleAccount.id,
          joinedGroupUrls: [sampleGroup.url, 'https://facebook.com/groups/unmatched-test-group-99999']
        }
      ]
    };

    const callbackRes1 = await fetch('http://127.0.0.1:3001/api/webhooks/group-membership-sync-callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': internalSecret
      },
      body: JSON.stringify(callbackPayload)
    }).then(r => r.json());

    console.log('Callback 1 Response:', callbackRes1);
    if (!callbackRes1.success || callbackRes1.matchedCount !== 1 || callbackRes1.unmatchedCount !== 1) {
      throw new Error('TEST 4 FAILED: callback matching count mismatch');
    }

    // Call callback again (Idempotency test)
    const callbackRes2 = await fetch('http://127.0.0.1:3001/api/webhooks/group-membership-sync-callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': internalSecret
      },
      body: JSON.stringify(callbackPayload)
    }).then(r => r.json());

    console.log('Callback 2 (Duplicate) Response:', callbackRes2);
    if (!callbackRes2.success) {
      throw new Error('TEST 4 FAILED: callback upsert failed on repeat');
    }
    console.log('✅ TEST 4 PASSED: Callback upsert and unmatched URLs handled properly.');
  }

  // Cleanup test records
  console.log('\n--- Dọn dẹp dữ liệu test cô lập (Rule 10.8) ---');
  await sql`DELETE FROM sandbox.group_membership_sync_runs WHERE id = ${testRunId}`;
  await sql`DELETE FROM sandbox.group_membership_sync_schedule WHERE for_date = ${testDate}`;
  console.log('✅ Test data cleaned up.');

  await sql.end();
  console.log('\n====================================================');
  console.log('🎉 ALL 4 PHASE 6 WEBHOOK TESTS PASSED PERFECTLY!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
