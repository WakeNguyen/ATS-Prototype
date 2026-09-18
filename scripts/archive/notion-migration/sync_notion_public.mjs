import fs from 'fs';
import sql from './src/lib/db.js';

const mcpConfig = JSON.parse(fs.readFileSync('C:/Users/trith/.gemini/antigravity/mcp_config.json', 'utf8'));
const headersStr = mcpConfig.mcpServers['notion-mcp-server']?.env?.OPENAPI_MCP_HEADERS || '{}';
const headers = JSON.parse(headersStr);

// Normalization function (E.164 for phones, lowercased for emails)
function normalizeContactValue(type, rawValue) {
  if (!rawValue) return "";
  const t = (type || "").toLowerCase().trim();
  const val = String(rawValue).trim();
  
  if (t.includes("email") || t.includes("mail")) {
    return val.toLowerCase();
  }
  
  if (t.includes("phone") || t.includes("tel") || t.includes("mobile") || t.includes("call")) {
    let digits = val.replace(/[^\d+]/g, "").trim();
    if (digits.startsWith("+84")) {
      digits = "+84" + digits.slice(3).replace(/^0+/, "");
    } else if (digits.startsWith("84") && digits.length >= 11) {
      digits = "+84" + digits.slice(2).replace(/^0+/, "");
    } else if (digits.startsWith("0")) {
      digits = "+84" + digits.slice(1);
    } else if (!digits.startsWith("+")) {
      digits = "+84" + digits.replace(/^0+/, "");
    }
    return digits;
  }
  
  let cleanUrl = val.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
  return cleanUrl;
}

// Fetch all from Notion
async function queryNotion(dbId) {
  let results = [];
  let hasMore = true;
  let startCursor = undefined;
  while (hasMore) {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28', ...headers },
      body: JSON.stringify({ page_size: 100, start_cursor: startCursor })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    results = results.concat(data.results);
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }
  return results;
}

// Extract properties
function extractTitle(props, name) { return props[name]?.title?.[0]?.plain_text || null; }
function extractText(props, name) { return props[name]?.rich_text?.[0]?.plain_text || null; }
function extractSelect(props, name) { return props[name]?.select?.name || null; }
function extractDate(props, name) { return props[name]?.date?.start || null; }
function extractRelation(props, name) { return props[name]?.relation?.map(r => r.id) || []; }

async function syncAll() {
  console.log('=== STARTING SYNC FROM NOTION TO SUPABASE PUBLIC ===');
  
  // 1. Fetch Candidates (Missing ones)
  console.log('Fetching Candidates...');
  const notionCandidates = await queryNotion('a1f6d98431964934bf8e94284788e2b7');
  const existingCandidates = await sql`SELECT notion_id FROM candidates WHERE notion_id IS NOT NULL`;
  const existingCandidateIds = new Set(existingCandidates.map(c => c.notion_id.replace(/-/g, '').toLowerCase()));
  
  const newCandidates = notionCandidates.filter(p => !existingCandidateIds.has(p.id.replace(/-/g, '').toLowerCase()));
  console.log(`Found ${newCandidates.length} new candidates to sync.`);
  
  for (const page of newCandidates) {
    const fullName = extractTitle(page.properties, 'Full Name') || 'Unknown';
    let prefix = extractSelect(page.properties, 'Prefix') || 'Mr.';
    if (!['Mr.', 'Ms.', 'Mrs.', 'Dr.'].includes(prefix)) prefix = 'Mr.';
    const dob = extractDate(page.properties, 'DOB');
    const address = extractText(page.properties, 'Address');
    const notion_id = page.id;
    
    await sql`
      INSERT INTO candidates (id, display_number, full_name, prefix, dob, address, created_time, last_updated, notion_id)
      VALUES (
        gen_random_uuid(), 
        COALESCE((SELECT MAX(display_number) FROM candidates), 0) + 1,
        ${fullName}, ${prefix}, ${dob ? dob : null}, ${address}, NOW(), NOW(), ${notion_id}
      )
    `;
  }
  
  // 2. Fetch Contact Points
  console.log('Fetching Contact Points...');
  const notionContacts = await queryNotion('6d8b17c5940a492fb2d913b6788a2079');
  const existingContacts = await sql`SELECT notion_id FROM contact_points WHERE notion_id IS NOT NULL`;
  const existingContactIds = new Set(existingContacts.map(c => c.notion_id.replace(/-/g, '').toLowerCase()));
  
  const newContacts = notionContacts.filter(p => !existingContactIds.has(p.id.replace(/-/g, '').toLowerCase()));
  console.log(`Found ${newContacts.length} new contact points to sync.`);
  
  let candidatesToReAggregate = new Set();
  
  for (const page of newContacts) {
    const value = extractTitle(page.properties, 'Value') || extractText(page.properties, 'Value') || extractText(page.properties, 'URL');
    const type = extractSelect(page.properties, 'Type') || 'Unknown';
    const candRelations = extractRelation(page.properties, 'Candidate');
    if (!value || candRelations.length === 0) continue;
    
    const candNotionId = candRelations[0];
    const candidateRec = await sql`SELECT id FROM candidates WHERE notion_id = ${candNotionId} LIMIT 1`;
    if (candidateRec.length === 0) continue;
    
    const candidateId = candidateRec[0].id;
    const normValue = normalizeContactValue(type, value);
    
    await sql`
      INSERT INTO contact_points (id, candidate_id, type, value, created_time, notion_id)
      VALUES (gen_random_uuid(), ${candidateId}, ${type}, ${normValue}, NOW(), ${page.id})
    `;
    candidatesToReAggregate.add(candidateId);
  }
  
  // 3. Re-aggregate candidate contacts
  console.log(`Re-aggregating contacts for ${candidatesToReAggregate.size} candidates...`);
  for (const cid of candidatesToReAggregate) {
    const allContacts = await sql`SELECT type, value FROM contact_points WHERE candidate_id = ${cid}`;
    const phones = [], emails = [], socials = [], texts = [];
    for (const cp of allContacts) {
      const t = (cp.type || "").toLowerCase();
      const v = String(cp.value || "").trim();
      if (t.includes('phone') || t.includes('zalo') || t.includes('mobile')) phones.push(v);
      else if (t.includes('mail')) emails.push(v);
      else socials.push({ type: cp.type, value: v, url: v });
      texts.push(v);
    }
    await sql`
      UPDATE candidates SET
        phones = ${phones}, emails = ${emails}, socials = ${socials}, all_contacts_text = ${texts.join(' | ')}
      WHERE id = ${cid}
    `;
  }
  
  // 4. Jobs
  console.log('Fetching Jobs...');
  const notionJobs = await queryNotion('ad00f3d903dc4275b2766c48146fe0c2');
  const existingJobs = await sql`SELECT notion_id FROM jobs WHERE notion_id IS NOT NULL`;
  const existingJobIds = new Set(existingJobs.map(j => j.notion_id.replace(/-/g, '').toLowerCase()));
  
  const newJobs = notionJobs.filter(p => !existingJobIds.has(p.id.replace(/-/g, '').toLowerCase()));
  console.log(`Found ${newJobs.length} new jobs to sync.`);
  
  for (const page of newJobs) {
    const title = extractTitle(page.properties, 'Job Title') || 'Unknown Job';
    const clientRelations = extractRelation(page.properties, 'Client');
    let clientId = null;
    if (clientRelations.length > 0) {
      const clientRec = await sql`SELECT id FROM clients WHERE notion_id = ${clientRelations[0]} LIMIT 1`;
      if (clientRec.length > 0) clientId = clientRec[0].id;
    }
    await sql`
      INSERT INTO jobs (id, display_number, job_title, client_id, status, created_at, updated_at, notion_id)
      VALUES (
        gen_random_uuid(), 
        COALESCE((SELECT MAX(display_number) FROM jobs), 0) + 1,
        ${title}, ${clientId}, 'Open', NOW(), NOW(), ${page.id}
      )
    `;
  }
  
  // 5. Applications (Master-Detail grouping)
  console.log('Fetching Applications...');
  const notionApps = await queryNotion('3440900c705180829dc6fdee16409f1c');
  
  // Sort notion apps by created time so oldest is first
  notionApps.sort((a, b) => new Date(a.created_time) - new Date(b.created_time));
  
  console.log(`Processing ${notionApps.length} Application/Sub-item records from Notion...`);
  
  for (const page of notionApps) {
    const candRelations = extractRelation(page.properties, 'Candidates') || [];
    const jobRelations = extractRelation(page.properties, 'Jobs') || [];
    
    // Fallback to rollups or other names if relation isn't direct
    // Actually in Notion, they might be nested. We'll try to find them directly first.
    let notionCandId = candRelations.length > 0 ? candRelations[0] : null;
    let notionJobId = jobRelations.length > 0 ? jobRelations[0] : null;
    
    if (!notionCandId || !notionJobId) continue;
    
    const dbCand = await sql`SELECT id FROM candidates WHERE notion_id = ${notionCandId} LIMIT 1`;
    const dbJob = await sql`SELECT id FROM jobs WHERE notion_id = ${notionJobId} LIMIT 1`;
    
    if (dbCand.length === 0 || dbJob.length === 0) continue;
    
    const candidateId = dbCand[0].id;
    const jobId = dbJob[0].id;
    
    // Check if Activity master exists
    let activity = await sql`SELECT id FROM activity WHERE candidate_id = ${candidateId} AND job_id = ${jobId} LIMIT 1`;
    let activityId;
    if (activity.length === 0) {
       const status = extractSelect(page.properties, 'Status') || 'In progress';
       const source = extractSelect(page.properties, 'Source') || 'Other';
       const date = extractDate(page.properties, 'Due Date');
       
       const ins = await sql`
         INSERT INTO activity (
           id, display_number, candidate_id, job_id, status, source_channel, planning_date, created_time, notion_id
         ) VALUES (
           gen_random_uuid(), 
           COALESCE((SELECT MAX(display_number) FROM activity), 0) + 1,
           ${candidateId}, ${jobId}, ${status}, ${source}, ${date ? date : null}, ${page.created_time}, ${page.id}
         ) RETURNING id
       `;
       activityId = ins[0].id;
    } else {
       activityId = activity[0].id;
    }
    
    // Now insert as Activity Log if it hasn't been synced (use action_date & stage to deduplicate roughly)
    const stage = extractSelect(page.properties, 'Stage') || 'Applied';
    const date = extractDate(page.properties, 'Due Date') || page.created_time;
    
    // Check if log already exists
    const existingLog = await sql`
      SELECT id FROM activity_log 
      WHERE activity_id = ${activityId} AND stage = ${stage} 
      LIMIT 1
    `;
    if (existingLog.length === 0) {
      await sql`
        INSERT INTO activity_log (id, activity_id, stage, action_date, created_time)
        VALUES (gen_random_uuid(), ${activityId}, ${stage}, ${date}, ${page.created_time})
      `;
      // Update master stage
      await sql`UPDATE activity SET current_stage = ${stage} WHERE id = ${activityId}`;
    }
  }
  
  console.log('=== SYNC COMPLETED SUCCESSFULLY ===');
}

syncAll().catch(e => {
  console.error('SYNC ERROR:', e);
  process.exit(1);
}).then(() => process.exit(0));
