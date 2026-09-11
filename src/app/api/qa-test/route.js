import { NextResponse } from 'next/server';
import sql from '../../../lib/db.js';
import { isTestRouteAllowed } from '../../../lib/testRouteGuard.js';
import { 
  createCandidateWithStrictValidation, 
  assignCandidateToJob, 
  addContactPoint, 
  getClientSearchData,
  addActivityLog
} from '../../actions.js';

export async function GET(request) {
  if (!isTestRouteAllowed()) {
    return NextResponse.json({ success: false, error: 'This test route is disabled outside local sandbox environment.' }, { status: 403 });
  }

  const results = [];
  
  try {
    // SETUP: Get a valid job and client for smoke testing
    const [job] = await sql`SELECT id FROM sandbox.jobs LIMIT 1`;
    const jobId = job ? job.id : null;

    // ==========================================
    // TEST 1: Transaction Rollback (DB-06, 07, 08)
    // ==========================================
    let t1_status = 'PASS';
    let t1_msg = 'Transaction rollback works';
    const fakeJobId = 'invalid-uuid-string-to-force-db-error'; // Invalid UUID format
    const t1_email = `rollback_test_${Date.now()}@qa.com`;
    
    const t1_res = await createCandidateWithStrictValidation({
      full_name: 'Rollback Test User',
      contactPoints: [{ type: 'Email', value: t1_email }],
      assignToJobId: fakeJobId // This should fail FK constraint inside the transaction
    });

    // Verify DB
    const [t1_db_check] = await sql`SELECT id FROM sandbox.candidates WHERE full_name = 'Rollback Test User' AND id = ${t1_res?.candidate?.id || '00000000-0000-0000-0000-000000000000'}`;
    const [t1_contact_check] = await sql`SELECT id FROM sandbox.contact_points WHERE value = ${t1_email}`;

    if (t1_res.success) {
      t1_status = 'FAIL';
      t1_msg = 'API returned success despite invalid Job ID';
    } else if (t1_db_check || t1_contact_check) {
      t1_status = 'FAIL';
      t1_msg = 'Partial write detected! Candidate or Contact exists despite transaction failure.';
    } else {
      t1_msg = `Correctly rolled back. Error was: ${t1_res.error}`;
    }
    
    results.push({ id: 'DB-06/07', name: 'Transaction Rollback', status: t1_status, details: t1_msg });

    // ==========================================
    // TEST 2: Concurrency & Display Number (DB-11, DB-12)
    // ==========================================
    let t2_status = 'PASS';
    let t2_msg = 'No display number collision';
    const numConcurrent = 5;
    const t2_promises = [];
    const t2_emails = [];
    
    for (let i = 0; i < numConcurrent; i++) {
      const em = `concurrent_${Date.now()}_${i}@qa.com`;
      t2_emails.push(em);
      t2_promises.push(createCandidateWithStrictValidation({
        full_name: `Concurrent User ${i}`,
        contactPoints: [{ type: 'Email', value: em }]
      }));
    }

    const t2_results = await Promise.all(t2_promises);
    const successCandidates = t2_results.filter(r => r.success).map(r => r.candidate);
    
    if (successCandidates.length === 0) {
      t2_status = 'FAIL';
      t2_msg = 'All concurrent creations failed: ' + t2_results[0].error;
    } else {
      const displayNumbers = successCandidates.map(c => c.display_number);
      const uniqueNumbers = new Set(displayNumbers);
      if (displayNumbers.length !== uniqueNumbers.size) {
        t2_status = 'FAIL';
        t2_msg = `Collision detected! Display numbers: ${displayNumbers.join(', ')}`;
      } else {
        t2_msg = `Created ${successCandidates.length} unique records perfectly.`;
      }
    }
    
    results.push({ id: 'DB-11/12', name: 'Concurrency & Display Number', status: t2_status, details: t2_msg });

    // ==========================================
    // TEST 3: Deduplication Engine (DB-20)
    // ==========================================
    let t3_status = 'PASS';
    let t3_msg = 'Deduplication blocked correctly';
    
    // Attempt to add t2_emails[0] to the second candidate
    if (successCandidates.length >= 2) {
      const cand2_id = successCandidates[1].id;
      const target_email = t2_emails[0]; // Belongs to cand1
      
      const t3_res = await addContactPoint(cand2_id, 'Email', target_email);
      
      if (t3_res.success) {
        t3_status = 'FAIL';
        t3_msg = 'Allowed adding duplicate contact point across different candidates!';
      } else if (!t3_res.error.includes('Duplicate Contact Detected')) {
        t3_status = 'PARTIAL';
        t3_msg = `Failed, but wrong error message: ${t3_res.error}`;
      } else {
        t3_msg = `Blocked perfectly: ${t3_res.error}`;
      }
    } else {
       t3_status = 'SKIP';
       t3_msg = 'Not enough successful candidates from T2 to test T3';
    }

    results.push({ id: 'DB-20', name: 'Deduplication Engine', status: t3_status, details: t3_msg });

    // ==========================================
    // TEST 4: Deprecated Query (BIZ-13)
    // ==========================================
    let t4_status = 'PASS';
    let t4_msg = 'Client search successful';
    
    const t4_res = await getClientSearchData({ searchTerm: 'a' });
    if (!t4_res.success) {
      t4_status = 'FAIL';
      t4_msg = `Client search failed: ${t4_res.error}`;
    } else if (t4_res.data === undefined) {
      t4_status = 'FAIL';
      t4_msg = 'No data array returned';
    } else {
      t4_msg = `Returned ${t4_res.data.length} records without error using client_persons`;
    }

    results.push({ id: 'BIZ-13', name: 'Deprecated Query check', status: t4_status, details: t4_msg });

    // ==========================================
    // TEST 5: Regression Smoke Test
    // ==========================================
    let t5_status = 'PASS';
    let t5_msg = 'Full lifecycle success';
    
    if (jobId) {
      // Create -> Assign -> Log
      const candRes = await createCandidateWithStrictValidation({
        full_name: 'Smoke Test User',
        contactPoints: [{ type: 'Phone', value: `0999${Date.now().toString().slice(-6)}` }]
      });

      if (candRes.success) {
        const assignRes = await assignCandidateToJob({
          candidateId: candRes.candidate.id,
          jobId: jobId,
          initialStage: 'Talent Mapping',
          note: 'Smoke assignment'
        });

        if (assignRes.success) {
          const logRes = await addActivityLog({
            application_id: assignRes.data.id,
            action_type: 'Client Interview',
            note: 'Smoke interview',
            result: 'Pass'
          });

          if (!logRes.success) {
            t5_status = 'FAIL';
            t5_msg = `Activity Log failed: ${logRes.error}`;
          } else {
             // Check DB state
             const [appCheck] = await sql`SELECT current_stage FROM sandbox.activity WHERE id = ${assignRes.data.id}`;
             if (appCheck?.current_stage !== 'Client Interview') {
                t5_status = 'FAIL';
                t5_msg = 'Stage synchronization failed on activity table';
             }
          }
        } else {
          t5_status = 'FAIL';
          t5_msg = `Assign job failed: ${assignRes.error}`;
        }
      } else {
        t5_status = 'FAIL';
        t5_msg = `Candidate creation failed: ${candRes.error}`;
      }
    } else {
      t5_status = 'SKIP';
      t5_msg = 'No jobs available in DB to test assignment';
    }

    results.push({ id: 'SMOKE', name: 'Regression Lifecycle', status: t5_status, details: t5_msg });

    // CLEANUP: Clean test data to keep DB clean
    if (t2_emails.length > 0) {
       await sql`DELETE FROM sandbox.candidates WHERE full_name LIKE 'Concurrent User %' OR full_name = 'Smoke Test User'`;
    }

    return NextResponse.json({ success: true, results });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message, stack: error.stack });
  }
}
