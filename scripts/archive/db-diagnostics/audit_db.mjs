import sql from './src/lib/db.js';

async function audit() {
  console.log('=== ATS 3.0 DATABASE AUDIT REPORT (PUBLIC SCHEMA) ===');
  
  // 1. Audit Contact Normalization (Phone & Email)
  console.log('\n--- 1. CONTACT NORMALIZATION ---');
  const invalidPhones = await sql`
    SELECT id, type, value, candidate_id 
    FROM public.contact_points 
    WHERE type ILIKE '%phone%' AND (value NOT LIKE '+84%' OR LENGTH(value) < 11 OR LENGTH(value) > 13);
  `;
  console.log(`- Invalid Phone formats (+84xxxxxxxxx): ${invalidPhones.length} records.`);
  if (invalidPhones.length > 0) {
    console.log(invalidPhones.slice(0, 5));
  }

  const invalidEmails = await sql`
    SELECT id, type, value, candidate_id 
    FROM public.contact_points 
    WHERE type ILIKE '%mail%' AND (value != LOWER(value) OR value != TRIM(value));
  `;
  console.log(`- Invalid Email formats (lowercase, trimmed): ${invalidEmails.length} records.`);
  if (invalidEmails.length > 0) {
    console.log(invalidEmails.slice(0, 5));
  }
  
  // 2. Audit Deduplication (Unique Candidate + Job)
  console.log('\n--- 2. DEDUPLICATION INTEGRITY ---');
  const dupApps = await sql`
    SELECT candidate_id, job_id, COUNT(*) as count 
    FROM public.activity 
    GROUP BY candidate_id, job_id 
    HAVING COUNT(*) > 1;
  `;
  console.log(`- Duplicate (Candidate+Job) in Activity table: ${dupApps.length} duplicates.`);
  if (dupApps.length > 0) {
    console.log(dupApps.slice(0, 5));
  }
  
  const dupPhones = await sql`
    SELECT value, COUNT(DISTINCT candidate_id) as candidates
    FROM public.contact_points
    WHERE type ILIKE '%phone%'
    GROUP BY value
    HAVING COUNT(DISTINCT candidate_id) > 1;
  `;
  console.log(`- Duplicate Phones shared across multiple candidates: ${dupPhones.length} records.`);
  if (dupPhones.length > 0) {
    console.log(dupPhones.slice(0, 5));
  }

  // 3. Foreign Key / Orphan Checks
  console.log('\n--- 3. FOREIGN KEY & ORPHAN INTEGRITY ---');
  const orphanContacts = await sql`SELECT COUNT(*) as count FROM public.contact_points WHERE candidate_id NOT IN (SELECT id FROM public.candidates)`;
  console.log(`- Orphan Contact Points: ${orphanContacts[0].count}`);
  
  const orphanActivity = await sql`SELECT COUNT(*) as count FROM public.activity WHERE candidate_id NOT IN (SELECT id FROM public.candidates) OR job_id NOT IN (SELECT id FROM public.jobs)`;
  console.log(`- Orphan Activities: ${orphanActivity[0].count}`);
  
  const orphanLogs = await sql`SELECT COUNT(*) as count FROM public.activity_log WHERE activity_id NOT IN (SELECT id FROM public.activity)`;
  console.log(`- Orphan Activity Logs: ${orphanLogs[0].count}`);
  
  console.log('\n=== AUDIT COMPLETE ===');
}

audit().then(() => process.exit(0));
