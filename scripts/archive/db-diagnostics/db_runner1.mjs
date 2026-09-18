import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf-8');
env.split('\n').forEach(line => {
    const match = line.match(/^([^#\s][^=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
});

import { randomUUID } from 'crypto';

async function runTests() {
    const { default: sql } = await import('./src/lib/db.js');
    const actions = await import('./src/app/actions.js');
    
    console.log("Starting DB Integrity Tests...");
    const results = [];
    
    // Helper to log and run SQL
    async function executeAndLog(name, step, queryFunc) {
        try {
            return await queryFunc();
        } catch (e) {
            return { error: e.message };
        }
    }

    const testId = 'test-' + Date.now();
    
    // DB-01: CASCADE Candidate Delete
    let db01_status = 'FAIL';
    let db01_log = '';
    try {
        const candId = randomUUID();
        await sql`INSERT INTO sandbox.candidates (id, display_number, full_name) VALUES (${candId}, 999901, ${testId})`;
        await sql`INSERT INTO sandbox.contact_points (id, candidate_id, type, value) VALUES (gen_random_uuid(), ${candId}, 'Phone', '123')`;
        await sql`INSERT INTO sandbox.activity (id, candidate_id, display_number, current_stage) VALUES (gen_random_uuid(), ${candId}, 999901, 'Stage')`;
        
        db01_log += `BEFORE: 1 Candidate, 1 Contact, 1 Activity.\n`;
        db01_log += `EXECUTE: DELETE FROM sandbox.candidates WHERE id = '${candId}'\n`;
        await sql`DELETE FROM sandbox.candidates WHERE id = ${candId}`;
        
        const contacts = await sql`SELECT count(*) FROM sandbox.contact_points WHERE candidate_id = ${candId}`;
        const activities = await sql`SELECT count(*) FROM sandbox.activity WHERE candidate_id = ${candId}`;
        
        if (contacts[0].count === '0' && activities[0].count === '0') {
            db01_status = 'PASS';
            db01_log += `AFTER: Contacts=0, Activities=0. CASCADE OK.\n`;
        } else {
            db01_log += `AFTER: Contacts=${contacts[0].count}, Activities=${activities[0].count}. CASCADE FAILED.\n`;
        }
        await sql`DELETE FROM sandbox.contact_points WHERE candidate_id = ${candId}`;
        await sql`DELETE FROM sandbox.activity WHERE candidate_id = ${candId}`;
    } catch(e) { db01_log += `ERROR: ${e.message}`; }
    results.push({ id: 'DB-01', name: 'CASCADE Candidate Delete', status: db01_status, log: db01_log, risk: 'Orphan records' });

    // DB-02: CASCADE Job Delete
    let db02_status = 'FAIL', db02_log = '';
    try {
        const jobId = randomUUID();
        const candId = randomUUID();
        await sql`INSERT INTO sandbox.jobs (id, display_number, job_title) VALUES (${jobId}, 999902, ${testId})`;
        await sql`INSERT INTO sandbox.candidates (id, display_number, full_name) VALUES (${candId}, 999902, ${testId})`;
        await sql`INSERT INTO sandbox.activity (id, job_id, candidate_id, display_number) VALUES (gen_random_uuid(), ${jobId}, ${candId}, 999902)`;
        
        db02_log += `EXECUTE: DELETE FROM sandbox.jobs WHERE id = '${jobId}'\n`;
        await sql`DELETE FROM sandbox.jobs WHERE id = ${jobId}`;
        
        const activities = await sql`SELECT count(*) FROM sandbox.activity WHERE job_id = ${jobId}`;
        if (activities[0].count === '0') db02_status = 'PASS';
        else db02_log += `AFTER: Activities=${activities[0].count}. CASCADE FAILED.\n`;
        
        await sql`DELETE FROM sandbox.activity WHERE job_id = ${jobId}`;
        await sql`DELETE FROM sandbox.jobs WHERE id = ${jobId}`;
        await sql`DELETE FROM sandbox.candidates WHERE id = ${candId}`;
    } catch(e) { db02_log += `ERROR: ${e.message}`; }
    results.push({ id: 'DB-02', name: 'CASCADE Job Delete', status: db02_status, log: db02_log, risk: 'Orphan applications' });

    // DB-03: SET NULL Client
    let db03_status = 'FAIL', db03_log = '';
    try {
        const clientId = randomUUID();
        const jobId = randomUUID();
        await sql`INSERT INTO sandbox.clients (id, display_number, name) VALUES (${clientId}, 999903, ${testId})`;
        await sql`INSERT INTO sandbox.jobs (id, display_number, client_id, job_title) VALUES (${jobId}, 999903, ${clientId}, ${testId})`;
        
        db03_log += `EXECUTE: DELETE FROM sandbox.clients WHERE id = '${clientId}'\n`;
        await sql`DELETE FROM sandbox.clients WHERE id = ${clientId}`;
        
        const jobs = await sql`SELECT client_id FROM sandbox.jobs WHERE id = ${jobId}`;
        if (jobs.length > 0 && jobs[0].client_id === null) db03_status = 'PASS';
        else db03_log += `AFTER: Job client_id = ${jobs.length > 0 ? jobs[0].client_id : 'Not Found'}. SET NULL FAILED.\n`;
        
        await sql`DELETE FROM sandbox.jobs WHERE id = ${jobId}`;
        await sql`DELETE FROM sandbox.clients WHERE id = ${clientId}`;
    } catch(e) { db03_log += `ERROR: ${e.message}`; }
    results.push({ id: 'DB-03', name: 'SET NULL Client in Jobs', status: db03_status, log: db03_log, risk: 'Dangling Job refs' });

    // DB-04: CASCADE Activity
    let db04_status = 'FAIL', db04_log = '';
    try {
        const actId = randomUUID();
        const candId = randomUUID();
        await sql`INSERT INTO sandbox.candidates (id, display_number, full_name) VALUES (${candId}, 999904, ${testId})`;
        await sql`INSERT INTO sandbox.activity (id, display_number, candidate_id) VALUES (${actId}, 999904, ${candId})`;
        await sql`INSERT INTO sandbox.activity_log (id, application_id, note) VALUES (gen_random_uuid(), ${actId}, ${testId})`;
        
        db04_log += `EXECUTE: DELETE FROM sandbox.activity WHERE id = '${actId}'\n`;
        await sql`DELETE FROM sandbox.activity WHERE id = ${actId}`;
        
        const logs = await sql`SELECT count(*) FROM sandbox.activity_log WHERE application_id = ${actId}`;
        if (logs[0].count === '0') db04_status = 'PASS';
        else db04_log += `AFTER: Logs=${logs[0].count}. CASCADE FAILED.\n`;
        
        await sql`DELETE FROM sandbox.activity_log WHERE application_id = ${actId}`;
        await sql`DELETE FROM sandbox.activity WHERE id = ${actId}`;
        await sql`DELETE FROM sandbox.candidates WHERE id = ${candId}`;
    } catch(e) { db04_log += `ERROR: ${e.message}`; }
    results.push({ id: 'DB-04', name: 'CASCADE Activity Log Delete', status: db04_status, log: db04_log, risk: 'Orphan activity logs' });

    // DB-05: Self-referencing FK
    let db05_status = 'FAIL', db05_log = '';
    try {
        const parentId = randomUUID();
        const childId = randomUUID();
        const candId = randomUUID();
        await sql`INSERT INTO sandbox.candidates (id, display_number, full_name) VALUES (${candId}, 999905, ${testId})`;
        await sql`INSERT INTO sandbox.activity (id, display_number, candidate_id) VALUES (${parentId}, 999905, ${candId})`;
        await sql`INSERT INTO sandbox.activity (id, display_number, candidate_id, parent_item_id) VALUES (${childId}, 999906, ${candId}, ${parentId})`;
        
        db05_log += `EXECUTE: DELETE FROM sandbox.activity WHERE id = '${parentId}'\n`;
        await sql`DELETE FROM sandbox.activity WHERE id = ${parentId}`;
        
        const child = await sql`SELECT parent_item_id FROM sandbox.activity WHERE id = ${childId}`;
        if (child.length > 0 && child[0].parent_item_id === null) db05_status = 'PASS';
        else db05_log += `AFTER: Child parent_item_id = ${child.length > 0 ? child[0].parent_item_id : 'Deleted'}. SET NULL FAILED.\n`;
        
        await sql`DELETE FROM sandbox.activity WHERE id IN (${parentId}, ${childId})`;
        await sql`DELETE FROM sandbox.candidates WHERE id = ${candId}`;
    } catch(e) { db05_log += `ERROR: ${e.message}`; }
    results.push({ id: 'DB-05', name: 'Self-referencing Activity FK SET NULL', status: db05_status, log: db05_log, risk: 'Broken hierarchies' });

    // Output partial results to verify execution so far
    console.log(JSON.stringify(results, null, 2));

    process.exit(0);
}
runTests();
