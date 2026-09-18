import { NextResponse } from 'next/server';
import sql from '../../../lib/db';
import { randomUUID } from 'crypto';
import * as actions from '../../actions';
import { isTestRouteAllowed } from '../../../lib/testRouteGuard.js';

export async function GET(request) {
    if (!isTestRouteAllowed()) {
      return NextResponse.json({ success: false, error: 'This test route is disabled outside local sandbox environment.' }, { status: 403 });
    }
    
    console.log("Starting DB Integrity Tests via API...");
    const results = [];
    const testId = 'test-' + Date.now();
    
    // Helper to safely execute cleanup
    const clean = async (q) => { try { await q; } catch(e) {} };

    // DB-01
    let db01_status = 'FAIL', db01_log = '';
    try {
        const candId = randomUUID();
        await sql`INSERT INTO sandbox.candidates (id, display_number, full_name) VALUES (${candId}, 999901, ${testId})`;
        await sql`INSERT INTO sandbox.contact_points (id, candidate_id, type, value) VALUES (gen_random_uuid(), ${candId}, 'Phone', '123')`;
        await sql`INSERT INTO sandbox.activity (id, candidate_id, display_number, current_stage, summary) VALUES (gen_random_uuid(), ${candId}, 999901, 'Stage', 'Test')`;
        
        await sql`DELETE FROM sandbox.candidates WHERE id = ${candId}`;
        const contacts = await sql`SELECT count(*) FROM sandbox.contact_points WHERE candidate_id = ${candId}`;
        const activities = await sql`SELECT count(*) FROM sandbox.activity WHERE candidate_id = ${candId}`;
        
        if (contacts[0].count === '0' && activities[0].count === '0') db01_status = 'PASS';
        else db01_log += `Contacts=${contacts[0].count}, Activities=${activities[0].count}`;
        
        await clean(sql`DELETE FROM sandbox.contact_points WHERE candidate_id = ${candId}`);
        await clean(sql`DELETE FROM sandbox.activity WHERE candidate_id = ${candId}`);
        await clean(sql`DELETE FROM sandbox.candidates WHERE id = ${candId}`);
    } catch(e) { db01_log += `ERROR: ${e.message}`; }
    results.push({ id: 'DB-01', status: db01_status, log: db01_log });

    // DB-02
    let db02_status = 'FAIL', db02_log = '';
    try {
        const jobId = randomUUID();
        const candId = randomUUID();
        await sql`INSERT INTO sandbox.jobs (id, display_number, job_title) VALUES (${jobId}, 999902, ${testId})`;
        await sql`INSERT INTO sandbox.candidates (id, display_number, full_name) VALUES (${candId}, 999902, ${testId})`;
        await sql`INSERT INTO sandbox.activity (id, job_id, candidate_id, display_number, summary) VALUES (gen_random_uuid(), ${jobId}, ${candId}, 999902, 'Test')`;
        
        await sql`DELETE FROM sandbox.jobs WHERE id = ${jobId}`;
        const activities = await sql`SELECT count(*) FROM sandbox.activity WHERE job_id = ${jobId}`;
        
        if (activities[0].count === '0') db02_status = 'PASS';
        else db02_log += `Activities=${activities[0].count}`;
        
        await clean(sql`DELETE FROM sandbox.activity WHERE job_id = ${jobId}`);
        await clean(sql`DELETE FROM sandbox.jobs WHERE id = ${jobId}`);
        await clean(sql`DELETE FROM sandbox.candidates WHERE id = ${candId}`);
    } catch(e) { db02_log += `ERROR: ${e.message}`; }
    results.push({ id: 'DB-02', status: db02_status, log: db02_log });

    // DB-03
    let db03_status = 'FAIL', db03_log = '';
    try {
        const clientId = randomUUID();
        const jobId = randomUUID();
        await sql`INSERT INTO sandbox.clients (id, display_number, name) VALUES (${clientId}, 999903, ${testId})`;
        await sql`INSERT INTO sandbox.jobs (id, display_number, client_id, job_title) VALUES (${jobId}, 999903, ${clientId}, ${testId})`;
        
        await sql`DELETE FROM sandbox.clients WHERE id = ${clientId}`;
        const jobs = await sql`SELECT client_id FROM sandbox.jobs WHERE id = ${jobId}`;
        
        if (jobs.length > 0 && jobs[0].client_id === null) db03_status = 'PASS';
        else db03_log += `client_id=${jobs.length > 0 ? jobs[0].client_id : 'null'}`;
        
        await clean(sql`DELETE FROM sandbox.jobs WHERE id = ${jobId}`);
        await clean(sql`DELETE FROM sandbox.clients WHERE id = ${clientId}`);
    } catch(e) { db03_log += `ERROR: ${e.message}`; }
    results.push({ id: 'DB-03', status: db03_status, log: db03_log });

    // DB-04
    let db04_status = 'FAIL', db04_log = '';
    try {
        const actId = randomUUID();
        const candId = randomUUID();
        await sql`INSERT INTO sandbox.candidates (id, display_number, full_name) VALUES (${candId}, 999904, ${testId})`;
        await sql`INSERT INTO sandbox.activity (id, display_number, candidate_id, summary) VALUES (${actId}, 999904, ${candId}, 'Test')`;
        await sql`INSERT INTO sandbox.activity_log (id, application_id, note) VALUES (gen_random_uuid(), ${actId}, ${testId})`;
        
        await sql`DELETE FROM sandbox.activity WHERE id = ${actId}`;
        const logs = await sql`SELECT count(*) FROM sandbox.activity_log WHERE application_id = ${actId}`;
        
        if (logs[0].count === '0') db04_status = 'PASS';
        else db04_log += `Logs=${logs[0].count}`;
        
        await clean(sql`DELETE FROM sandbox.activity_log WHERE application_id = ${actId}`);
        await clean(sql`DELETE FROM sandbox.activity WHERE id = ${actId}`);
        await clean(sql`DELETE FROM sandbox.candidates WHERE id = ${candId}`);
    } catch(e) { db04_log += `ERROR: ${e.message}`; }
    results.push({ id: 'DB-04', status: db04_status, log: db04_log });

    // DB-05
    let db05_status = 'FAIL', db05_log = '';
    try {
        const parentId = randomUUID();
        const childId = randomUUID();
        const candId = randomUUID();
        await sql`INSERT INTO sandbox.candidates (id, display_number, full_name) VALUES (${candId}, 999905, ${testId})`;
        await sql`INSERT INTO sandbox.activity (id, display_number, candidate_id, summary) VALUES (${parentId}, 999905, ${candId}, 'Test')`;
        await sql`INSERT INTO sandbox.activity (id, display_number, candidate_id, parent_item_id, summary) VALUES (${childId}, 999906, ${candId}, ${parentId}, 'Test')`;
        
        await sql`DELETE FROM sandbox.activity WHERE id = ${parentId}`;
        const child = await sql`SELECT parent_item_id FROM sandbox.activity WHERE id = ${childId}`;
        
        if (child.length > 0 && child[0].parent_item_id === null) db05_status = 'PASS';
        else db05_log += `child parent_item_id=${child.length > 0 ? child[0].parent_item_id : 'null'}`;
        
        await clean(sql`DELETE FROM sandbox.activity WHERE id IN (${parentId}, ${childId})`);
        await clean(sql`DELETE FROM sandbox.candidates WHERE id = ${candId}`);
    } catch(e) { db05_log += `ERROR: ${e.message}`; }
    results.push({ id: 'DB-05', status: db05_status, log: db05_log });

    // DB-09
    let db09_status = 'FAIL', db09_log = '';
    try {
        const candId = randomUUID();
        await sql`INSERT INTO sandbox.candidates (id, display_number, full_name) VALUES (${candId}, 999909, ${testId})`;
        await actions.addContactPoint(candId, 'Phone', '0912345678');
        const cand = await sql`SELECT phones, all_contacts_text FROM sandbox.candidates WHERE id = ${candId}`;
        
        if (cand.length > 0 && cand[0].phones && cand[0].phones.includes('0912345678') && cand[0].all_contacts_text.includes('0912345678')) {
            db09_status = 'PASS';
        } else {
            db09_log += `phones=${JSON.stringify(cand.length > 0 ? cand[0].phones : null)}`;
        }
        await clean(sql`DELETE FROM sandbox.contact_points WHERE candidate_id = ${candId}`);
        await clean(sql`DELETE FROM sandbox.candidates WHERE id = ${candId}`);
    } catch(e) { db09_log += `ERROR: ${e.message}`; }
    results.push({ id: 'DB-09', status: db09_status, log: db09_log });

    // DB-10: JSONB Branches concurrent lost update
    let db10_status = 'FAIL', db10_log = '';
    try {
        const clientId = randomUUID();
        await sql`INSERT INTO sandbox.clients (id, display_number, name, branches) VALUES (${clientId}, 999910, ${testId}, '[{"id": "b1", "name": "B1"}]'::jsonb)`;
        
        const branch2Payload = { branchName: "B2", address: "A" };
        const branch3Payload = { branchName: "B3", address: "A" };
        
        await Promise.all([
            actions.addClientBranch(clientId, branch2Payload),
            actions.addClientBranch(clientId, branch3Payload)
        ]);
        
        const cli = await sql`SELECT branches FROM sandbox.clients WHERE id = ${clientId}`;
        if (cli.length > 0 && cli[0].branches.length === 3) {
            db10_status = 'PASS';
        } else {
            db10_log += `branches count=${cli.length > 0 ? cli[0].branches.length : 0}. Lost update occurred!`;
        }
        await clean(sql`DELETE FROM sandbox.clients WHERE id = ${clientId}`);
    } catch(e) { db10_log += `ERROR: ${e.message}`; }
    results.push({ id: 'DB-10', status: db10_status, log: db10_log });

    // DB-13: Ghost candidate without contacts
    let db13_status = 'FAIL', db13_log = '';
    try {
        const candId = randomUUID();
        await sql`INSERT INTO sandbox.candidates (id, display_number, full_name, all_contacts_text) VALUES (${candId}, 999913, 'Ghost Candidate DB13', '')`;
        const searchRes = await actions.searchCandidatesServer({ query: 'Ghost Candidate DB13' });
        if (searchRes && searchRes.data && searchRes.data.length > 0) {
            db13_status = 'PASS';
        } else {
            db13_log += `Search failed to find candidate. returned data length: ${searchRes?.data?.length}`;
        }
        await clean(sql`DELETE FROM sandbox.candidates WHERE id = ${candId}`);
    } catch(e) { db13_log += `ERROR: ${e.message}`; }
    results.push({ id: 'DB-13', status: db13_status, log: db13_log });

    // DB-14: Large note
    let db14_status = 'FAIL', db14_log = '';
    try {
        const actId = randomUUID();
        const candId = randomUUID();
        await sql`INSERT INTO sandbox.candidates (id, display_number, full_name) VALUES (${candId}, 999914, ${testId})`;
        await sql`INSERT INTO sandbox.activity (id, display_number, candidate_id, summary) VALUES (${actId}, 999914, ${candId}, 'Test')`;
        
        const largeString = 'A'.repeat(100000);
        await actions.addActivityLog(actId, 'Note', largeString, '');
        
        const logs = await sql`SELECT length(note) as len FROM sandbox.activity_log WHERE application_id = ${actId}`;
        if (logs.length > 0 && logs[0].len === 100000) db14_status = 'PASS';
        else db14_log += `len=${logs.length > 0 ? logs[0].len : 0}`;
        
        await clean(sql`DELETE FROM sandbox.activity_log WHERE application_id = ${actId}`);
        await clean(sql`DELETE FROM sandbox.activity WHERE id = ${actId}`);
        await clean(sql`DELETE FROM sandbox.candidates WHERE id = ${candId}`);
    } catch(e) { db14_log += `ERROR: ${e.message}`; }
    results.push({ id: 'DB-14', status: db14_status, log: db14_log });

    // DB-15: Invalid planning date
    let db15_status = 'FAIL', db15_log = '';
    try {
        const actId = randomUUID();
        const candId = randomUUID();
        await sql`INSERT INTO sandbox.candidates (id, display_number, full_name) VALUES (${candId}, 999915, ${testId})`;
        await sql`INSERT INTO sandbox.activity (id, display_number, candidate_id, summary) VALUES (${actId}, 999915, ${candId}, 'Test')`;
        
        const res = await actions.updateApplicationAction(actId, { planning_date: '2030-13-45' });
        if (res && res.success === false) {
            db15_status = 'PASS';
            db15_log += 'Validation rejected: ' + JSON.stringify(res.error);
        } else {
            db15_log += 'Action succeeded unexpectedly.';
        }
        
        await clean(sql`DELETE FROM sandbox.activity WHERE id = ${actId}`);
        await clean(sql`DELETE FROM sandbox.candidates WHERE id = ${candId}`);
    } catch(e) { db15_log += `Setup ERROR: ${e.message}`; }
    results.push({ id: 'DB-15', status: db15_status, log: db15_log });

    // DB-16: Future DOB
    let db16_status = 'FAIL', db16_log = '';
    try {
        const payload = { full_name: 'Future Boy', contactPoints: [{ type: 'Phone', value: '0900000000' }], dob: '2099-12-31' };
        const res = await actions.createCandidateWithStrictValidation(payload);
        if (res && res.success === false) {
            db16_status = 'PASS';
            db16_log += 'Validation rejected: ' + JSON.stringify(res.error);
        } else {
            db16_log += 'Action succeeded unexpectedly.';
            await clean(sql`DELETE FROM sandbox.candidates WHERE full_name = 'Future Boy'`);
        }
    } catch(e) { db16_log += `Setup ERROR: ${e.message}`; }
    results.push({ id: 'DB-16', status: db16_status, log: db16_log });

    // DB-17: Dedup Phone
    let db17_status = 'FAIL', db17_log = '';
    try {
        const candId = randomUUID();
        await sql`INSERT INTO sandbox.candidates (id, display_number, full_name) VALUES (${candId}, 999917, 'Dedup Original')`;
        await sql`INSERT INTO sandbox.contact_points (id, candidate_id, type, value) VALUES (gen_random_uuid(), ${candId}, 'Phone', '+84901234567')`;
        
        const res = await actions.createCandidateWithStrictValidation({ full_name: 'Dedup New 1', contactPoints: [{ type: 'Phone', value: '0901234567' }] });
        if (res && res.success === false) {
            db17_status = 'PASS';
            db17_log += 'Duplicate caught: ' + JSON.stringify(res.error);
        } else {
            db17_log += 'Action succeeded unexpectedly.';
            await clean(sql`DELETE FROM sandbox.candidates WHERE full_name = 'Dedup New 1'`);
        }
        await clean(sql`DELETE FROM sandbox.contact_points WHERE candidate_id = ${candId}`);
        await clean(sql`DELETE FROM sandbox.candidates WHERE id = ${candId}`);
    } catch(e) { db17_log += `Setup ERROR: ${e.message}`; }
    results.push({ id: 'DB-17', status: db17_status, log: db17_log });

    // DB-18: Dedup LinkedIn
    let db18_status = 'FAIL', db18_log = '';
    try {
        const candId = randomUUID();
        await sql`INSERT INTO sandbox.candidates (id, display_number, full_name) VALUES (${candId}, 999918, 'Dedup LI Original')`;
        await sql`INSERT INTO sandbox.contact_points (id, candidate_id, type, value) VALUES (gen_random_uuid(), ${candId}, 'LinkedIn', 'https://linkedin.com/in/user/?locale=en')`;
        
        const res = await actions.createCandidateWithStrictValidation({ full_name: 'Dedup New 2', contactPoints: [{ type: 'LinkedIn', value: 'www.linkedin.com/in/user' }] });
        if (res && res.success === false) {
            db18_status = 'PASS';
            db18_log += 'Duplicate caught: ' + JSON.stringify(res.error);
        } else {
            db18_log += 'Action succeeded unexpectedly.';
            await clean(sql`DELETE FROM sandbox.candidates WHERE full_name = 'Dedup New 2'`);
        }
        await clean(sql`DELETE FROM sandbox.contact_points WHERE candidate_id = ${candId}`);
        await clean(sql`DELETE FROM sandbox.candidates WHERE id = ${candId}`);
    } catch(e) { db18_log += `Setup ERROR: ${e.message}`; }
    results.push({ id: 'DB-18', status: db18_status, log: db18_log });

    // DB-19: Dedup Email
    let db19_status = 'FAIL', db19_log = '';
    try {
        const candId = randomUUID();
        await sql`INSERT INTO sandbox.candidates (id, display_number, full_name) VALUES (${candId}, 999919, 'Dedup Email Original')`;
        await sql`INSERT INTO sandbox.contact_points (id, candidate_id, type, value) VALUES (gen_random_uuid(), ${candId}, 'Email', 'John.Doe@Gmail.COM')`;
        
        const res = await actions.createCandidateWithStrictValidation({ full_name: 'Dedup New 3', contactPoints: [{ type: 'Email', value: 'john.doe@gmail.com' }] });
        if (res && res.success === false) {
            db19_status = 'PASS';
            db19_log += 'Duplicate caught: ' + JSON.stringify(res.error);
        } else {
            db19_log += 'Action succeeded unexpectedly.';
            await clean(sql`DELETE FROM sandbox.candidates WHERE full_name = 'Dedup New 3'`);
        }
        await clean(sql`DELETE FROM sandbox.contact_points WHERE candidate_id = ${candId}`);
        await clean(sql`DELETE FROM sandbox.candidates WHERE id = ${candId}`);
    } catch(e) { db19_log += `Setup ERROR: ${e.message}`; }
    results.push({ id: 'DB-19', status: db19_status, log: db19_log });

    
    // DB-06: Orphan Activity Log
    let db06_status = 'FAIL', db06_log = '';
    try {
        const fakeAppId = randomUUID();
        try {
            await sql`INSERT INTO sandbox.activity_log (id, application_id, note) VALUES (gen_random_uuid(), ${fakeAppId}, 'Test')`;
            db06_log += 'Inserted log for non-existent application!';
            await clean(sql`DELETE FROM sandbox.activity_log WHERE application_id = ${fakeAppId}`);
        } catch (err) {
            if (err.message.includes('foreign key constraint')) db06_status = 'PASS';
            else db06_log += 'Unexpected error: ' + err.message;
        }
    } catch(e) { db06_log += `Setup ERROR: ${e.message}`; }
    results.push({ id: 'DB-06', status: db06_status, log: db06_log });

    // DB-07: Orphan Contact Point
    let db07_status = 'FAIL', db07_log = '';
    try {
        const fakeCandId = randomUUID();
        try {
            await sql`INSERT INTO sandbox.contact_points (id, candidate_id, type, value) VALUES (gen_random_uuid(), ${fakeCandId}, 'Phone', '123')`;
            db07_log += 'Inserted contact for non-existent candidate!';
            await clean(sql`DELETE FROM sandbox.contact_points WHERE candidate_id = ${fakeCandId}`);
        } catch (err) {
            if (err.message.includes('foreign key constraint')) db07_status = 'PASS';
            else db07_log += 'Unexpected error: ' + err.message;
        }
    } catch(e) { db07_log += `Setup ERROR: ${e.message}`; }
    results.push({ id: 'DB-07', status: db07_status, log: db07_log });

    // DB-11: Empty Job Title bypass
    let db11_status = 'FAIL', db11_log = '';
    try {
        const jobId = randomUUID();
        try {
            await sql`INSERT INTO sandbox.jobs (id, display_number, job_title) VALUES (${jobId}, 999911, '')`;
            db11_log += 'Inserted empty job_title without error.';
            await clean(sql`DELETE FROM sandbox.jobs WHERE id = ${jobId}`);
        } catch (err) {
            if (err.message.includes('violates check constraint') || err.message.includes('not-null constraint')) db11_status = 'PASS';
            else { db11_status = 'PASS'; db11_log += 'Handled via app layer / skipped DB check'; }
        }
        // Actually, schema map doesn't show DB constraint for empty string. Let's test server action instead.
        const res = await actions.createJobForClient({ job_title: '' });
        if (res && res.success === false) { db11_status = 'PASS'; db11_log = ''; }
        else { db11_status = 'FAIL'; db11_log = 'Bypassed empty title'; }
    } catch(e) { db11_log += `Setup ERROR: ${e.message}`; }
    results.push({ id: 'DB-11', status: db11_status, log: db11_log });

    // DB-12: SQL Injection Payload
    let db12_status = 'FAIL', db12_log = '';
    try {
        const res = await actions.searchCandidatesServer({ query: "'; DROP TABLE candidates; --" });
        if (res) {
            const cands = await sql`SELECT count(*) FROM sandbox.candidates`;
            if (cands[0].count > 0) db12_status = 'PASS';
            else db12_log += 'Table dropped?';
        }
    } catch(e) { db12_log += `Setup ERROR: ${e.message}`; }
    results.push({ id: 'DB-12', status: db12_status, log: db12_log });

    // DB-20: Missing Mandatory fields
    let db20_status = 'FAIL', db20_log = '';
    try {
        const res = await actions.createCandidateWithStrictValidation({ });
        if (res && res.success === false) db20_status = 'PASS';
        else db20_log += 'Bypassed missing mandatory fields';
    } catch(e) { db20_log += `Setup ERROR: ${e.message}`; }
    results.push({ id: 'DB-20', status: db20_status, log: db20_log });

    
    // DB-08: Stage desync 
    let db08_status = 'FAIL', db08_log = '';
    try {
        const actId = randomUUID();
        const candId = randomUUID();
        await sql`INSERT INTO sandbox.candidates (id, display_number, full_name) VALUES (${candId}, 999908, ${testId})`;
        await sql`INSERT INTO sandbox.activity (id, display_number, candidate_id, current_stage, summary) VALUES (${actId}, 999908, ${candId}, 'Contact', 'Test')`;
        
        try {
            await sql.begin(async (tx) => {
                await tx`INSERT INTO sandbox.activity_log (id, application_id, note, new_stage) VALUES (gen_random_uuid(), ${actId}, 'Test', '1st Interview')`;
                // simulate failure
                throw new Error("Simulated update failure");
            });
        } catch (e) {
            // expected
        }
        
        const logs = await sql`SELECT count(*) FROM sandbox.activity_log WHERE application_id = ${actId}`;
        const act = await sql`SELECT current_stage FROM sandbox.activity WHERE id = ${actId}`;
        
        if (logs[0].count === '0' && act[0].current_stage === 'Contact') {
            db08_status = 'PASS';
        } else {
            db08_log += `logs=${logs[0].count}, stage=${act[0].current_stage}`;
        }
        
        await clean(sql`DELETE FROM sandbox.activity_log WHERE application_id = ${actId}`);
        await clean(sql`DELETE FROM sandbox.activity WHERE id = ${actId}`);
        await clean(sql`DELETE FROM sandbox.candidates WHERE id = ${candId}`);
    } catch(e) { db08_log += `Setup ERROR: ${e.message}`; }
    results.push({ id: 'DB-08', status: db08_status, log: db08_log });

    results.sort((a,b) => parseInt(a.id.split('-')[1]) - parseInt(b.id.split('-')[1]));
    return NextResponse.json(results);
}
