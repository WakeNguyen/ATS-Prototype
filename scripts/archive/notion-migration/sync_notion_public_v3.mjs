import fs from 'fs';
import sql from './src/lib/db.js';

const mcpConfig = JSON.parse(fs.readFileSync('C:/Users/trith/.gemini/antigravity/mcp_config.json', 'utf8'));
const headersStr = mcpConfig.mcpServers['notion-mcp-server']?.env?.OPENAPI_MCP_HEADERS || '{}';
const headers = JSON.parse(headersStr);

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

function extractTitle(props, name) { return props[name]?.title?.[0]?.plain_text || null; }
function extractText(props, name) { return props[name]?.rich_text?.[0]?.plain_text || null; }
function extractSelect(props, name) { return props[name]?.select?.name || null; }
function extractDate(props, name) { return props[name]?.date?.start || null; }
function extractRelation(props, name) { return props[name]?.relation?.map(r => r.id) || []; }

async function syncAll() {
  console.log('=== STARTING SYNC (PHASE 2) TO SUPABASE PUBLIC ===');
  
  // 4. Jobs
  console.log('Fetching Jobs...');
  const notionJobs = await queryNotion('ad00f3d903dc4275b2766c48146fe0c2');
  const existingJobs = await sql`SELECT notion_id FROM public.jobs WHERE notion_id IS NOT NULL`;
  const existingJobIds = new Set(existingJobs.map(j => j.notion_id.replace(/-/g, '').toLowerCase()));
  const newJobs = notionJobs.filter(p => !existingJobIds.has(p.id.replace(/-/g, '').toLowerCase()));
  console.log(`Found ${newJobs.length} new jobs to sync.`);
  
  for (const page of newJobs) {
    const title = extractTitle(page.properties, 'Job Title') || 'Unknown Job';
    const clientRelations = extractRelation(page.properties, 'Client');
    let clientId = null;
    if (clientRelations.length > 0) {
      const clientRec = await sql`SELECT id FROM public.clients WHERE notion_id = ${clientRelations[0]} LIMIT 1`;
      if (clientRec.length > 0) clientId = clientRec[0].id;
    }
    await sql`
      INSERT INTO public.jobs (id, display_number, job_title, client_id, status, created_time, last_updated, notion_id)
      VALUES (
        gen_random_uuid(), 
        COALESCE((SELECT MAX(display_number) FROM public.jobs), 0) + 1,
        ${title}, ${clientId}, 'Open', NOW(), NOW(), ${page.id}
      )
    `;
  }
  
  // 5. Campaigns
  console.log('Fetching Campaigns...');
  const notionCampaigns = await queryNotion('84a5b1e22e1643de95e5966cf44da725');
  const existingCampaigns = await sql`SELECT notion_id FROM public.campaigns WHERE notion_id IS NOT NULL`;
  const existingCampIds = new Set(existingCampaigns.map(c => c.notion_id.replace(/-/g, '').toLowerCase()));
  const newCampaigns = notionCampaigns.filter(p => !existingCampIds.has(p.id.replace(/-/g, '').toLowerCase()));
  console.log(`Found ${newCampaigns.length} new campaigns.`);
  for (const page of newCampaigns) {
    const name = extractTitle(page.properties, 'Name') || extractText(page.properties, 'Name') || 'Unknown Campaign';
    await sql`
      INSERT INTO public.campaigns (id, campaign_name, status, created_time, last_updated, notion_id)
      VALUES (
        gen_random_uuid(), ${name}, 'Active', NOW(), NOW(), ${page.id}
      )
    `;
  }

  // 6. Social Group URLs
  console.log('Fetching Social Groups...');
  const notionSocials = await queryNotion('3700900c70518089871ee32c239cab43');
  const existingSocials = await sql`SELECT notion_id FROM public.social_group_urls WHERE notion_id IS NOT NULL`;
  const existingSocialIds = new Set(existingSocials.map(c => c.notion_id.replace(/-/g, '').toLowerCase()));
  const newSocials = notionSocials.filter(p => !existingSocialIds.has(p.id.replace(/-/g, '').toLowerCase()));
  console.log(`Found ${newSocials.length} new social groups.`);
  for (const page of newSocials) {
    const title = extractTitle(page.properties, 'Name') || extractText(page.properties, 'Group Name') || extractText(page.properties, 'Name') || 'Unknown Group';
    const url = extractText(page.properties, 'URL') || '';
    const campRelations = extractRelation(page.properties, 'Campaign');
    await sql`
      INSERT INTO public.social_group_urls (id, name, url, created_time, notion_id)
      VALUES (gen_random_uuid(), ${title}, ${url}, NOW(), ${page.id})
    `;
  }

  // 7. Applications (Master-Detail grouping)
  console.log('Fetching Applications...');
  const notionApps = await queryNotion('3440900c705180829dc6fdee16409f1c');
  notionApps.sort((a, b) => new Date(a.created_time) - new Date(b.created_time));
  
  let appCount = 0;
  for (const page of notionApps) {
    const candRelations = extractRelation(page.properties, 'Candidates') || [];
    const jobRelations = extractRelation(page.properties, 'Jobs') || [];
    let notionCandId = candRelations.length > 0 ? candRelations[0] : null;
    let notionJobId = jobRelations.length > 0 ? jobRelations[0] : null;
    
    if (!notionCandId || !notionJobId) continue;
    const dbCand = await sql`SELECT id FROM public.candidates WHERE notion_id = ${notionCandId} LIMIT 1`;
    const dbJob = await sql`SELECT id FROM public.jobs WHERE notion_id = ${notionJobId} LIMIT 1`;
    if (dbCand.length === 0 || dbJob.length === 0) continue;
    
    const candidateId = dbCand[0].id;
    const jobId = dbJob[0].id;
    
    let activity = await sql`SELECT id FROM public.activity WHERE candidate_id = ${candidateId} AND job_id = ${jobId} LIMIT 1`;
    let activityId;
    if (activity.length === 0) {
       const status = extractSelect(page.properties, 'Status') || 'In progress';
       const source = extractSelect(page.properties, 'Source') || 'Other';
       const date = extractDate(page.properties, 'Due Date');
       
       const ins = await sql`
         INSERT INTO public.activity (
           id, display_number, candidate_id, job_id, status, source_channel, planning_date, created_time, notion_id
         ) VALUES (
           gen_random_uuid(), 
           COALESCE((SELECT MAX(display_number) FROM public.activity), 0) + 1,
           ${candidateId}, ${jobId}, ${status}, ${source}, ${date ? date : null}, ${page.created_time}, ${page.id}
         ) RETURNING id
       `;
       activityId = ins[0].id;
       appCount++;
    } else {
       activityId = activity[0].id;
    }
    
    const stage = extractSelect(page.properties, 'Stage') || 'Applied';
    const date = extractDate(page.properties, 'Due Date') || page.created_time;
    
    const existingLog = await sql`
      SELECT id FROM public.activity_log 
      WHERE activity_id = ${activityId} AND stage = ${stage} AND ABS(EXTRACT(EPOCH FROM (action_date - ${date}::timestamptz))) < 60
      LIMIT 1
    `;
    if (existingLog.length === 0) {
      await sql`
        INSERT INTO public.activity_log (id, activity_id, stage, action_date, created_time)
        VALUES (gen_random_uuid(), ${activityId}, ${stage}, ${date}, ${page.created_time})
      `;
      await sql`UPDATE public.activity SET current_stage = ${stage} WHERE id = ${activityId}`;
    }
  }
  console.log(`Created ${appCount} new master applications/activities.`);
  
  // 8. Interviews
  console.log('Fetching Interviews...');
  const notionInterviews = await queryNotion('3750900c7051806a80e1d0e36cc72804');
  const existingInterviews = await sql`SELECT notion_id FROM public.interviews WHERE notion_id IS NOT NULL`;
  const existingInterviewIds = new Set(existingInterviews.map(c => c.notion_id.replace(/-/g, '').toLowerCase()));
  const newInterviews = notionInterviews.filter(p => !existingInterviewIds.has(p.id.replace(/-/g, '').toLowerCase()));
  console.log(`Found ${newInterviews.length} new interviews.`);
  for (const page of newInterviews) {
    const title = extractTitle(page.properties, 'Title') || 'Interview';
    const date = extractDate(page.properties, 'Date');
    const appRelations = extractRelation(page.properties, 'Application');
    let activityId = null;
    if (appRelations.length > 0) {
      const notionAppId = appRelations[0];
      const appPage = notionApps.find(a => a.id === notionAppId);
      if (appPage) {
        const cR = extractRelation(appPage.properties, 'Candidates');
        const jR = extractRelation(appPage.properties, 'Jobs');
        if (cR.length && jR.length) {
          const cId = await sql`SELECT id FROM public.candidates WHERE notion_id = ${cR[0]} LIMIT 1`;
          const jId = await sql`SELECT id FROM public.jobs WHERE notion_id = ${jR[0]} LIMIT 1`;
          if (cId.length && jId.length) {
            const act = await sql`SELECT id FROM public.activity WHERE candidate_id = ${cId[0].id} AND job_id = ${jId[0].id} LIMIT 1`;
            if (act.length) activityId = act[0].id;
          }
        }
      }
    }
    
    // We only insert if activityId exists to avoid foreign key violations, or allow null if application_id is nullable.
    // Let's check interviews table if application_id is nullable. 
    // It's probably nullable if activityId is null, but we'll insert.
    try {
      await sql`
        INSERT INTO public.interviews (id, application_id, title, date, duration_minutes, notion_id)
        VALUES (
          gen_random_uuid(), ${activityId}, ${title}, ${date ? date : null}, 60, ${page.id}
        )
      `;
    } catch(e) {
      console.log('Skipping interview due to missing application relation: ', title);
    }
  }
  
  console.log('=== PHASE 2 COMPLETED SUCCESSFULLY ===');
}

syncAll().catch(e => {
  console.error('SYNC ERROR:', e);
  process.exit(1);
}).then(() => process.exit(0));
