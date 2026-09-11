import fs from 'fs';
import sql from './src/lib/db.js';

const mcpConfig = JSON.parse(fs.readFileSync('C:/Users/trith/.gemini/antigravity/mcp_config.json', 'utf8'));
const headersStr = mcpConfig.mcpServers['notion-mcp-server']?.env?.OPENAPI_MCP_HEADERS || '{}';
const headers = JSON.parse(headersStr);

async function queryNotion(dbId, filter = undefined, sorts = undefined) {
  let results = [];
  let hasMore = true;
  let startCursor = undefined;
  while (hasMore) {
    const body = { page_size: 100, start_cursor: startCursor };
    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28', ...headers },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      console.error('Error:', res.status, await res.text());
      break;
    }
    const data = await res.json();
    results = results.concat(data.results);
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }
  return results;
}

async function inspectNewRecords() {
  console.log('=== CHECKING CANDIDATES IN NOTION VS SUPABASE PUBLIC ===');
  // Fetch latest candidates from Notion sorted by Created Time desc
  const notionCandidates = await queryNotion('a1f6d98431964934bf8e94284788e2b7', undefined, [
    { property: 'Created Time', direction: 'descending' }
  ]);
  
  console.log(`Total Notion candidates fetched: ${notionCandidates.length}`);
  
  // Get all display_numbers and names from public.candidates
  const sbCandidates = await sql.unsafe('SELECT id, display_number, full_name, created_time FROM public.candidates');
  const sbDisplayMap = new Map();
  const sbNameMap = new Map();
  for (const c of sbCandidates) {
    if (c.display_number) sbDisplayMap.set(c.display_number, c);
    if (c.full_name) sbNameMap.set(c.full_name.toLowerCase().trim(), c);
  }
  
  const newCandidates = [];
  for (const nc of notionCandidates) {
    const idNum = nc.properties['ID_Candidate']?.unique_id?.number;
    const name = nc.properties['Full Name']?.title?.[0]?.plain_text || '';
    const notionId = nc.id;
    const created = nc.created_time;
    
    const existsByNum = idNum && sbDisplayMap.has(idNum);
    if (!existsByNum) {
      newCandidates.push({ idNum, name, notionId, created, props: nc.properties });
    }
  }
  
  console.log(`Found ${newCandidates.length} Candidates in Notion that are NOT in public.candidates by display_number:`);
  for (const c of newCandidates.slice(0, 15)) {
    console.log(`- #${c.idNum}: "${c.name}" (Created: ${c.created}, NotionID: ${c.notionId})`);
  }

  console.log('\n=== CHECKING CAMPAIGNS IN NOTION VS SUPABASE PUBLIC ===');
  const notionCampaigns = await queryNotion('84a5b1e22e1643de95e5966cf44da725');
  const sbCampaigns = await sql.unsafe('SELECT id, name, created_time FROM public.campaigns');
  const sbCampNameMap = new Set(sbCampaigns.map(c => c.name.toLowerCase().trim()));
  
  const newCampaigns = [];
  for (const camp of notionCampaigns) {
    const name = camp.properties['Campaign Name']?.title?.[0]?.plain_text || '';
    if (!sbCampNameMap.has(name.toLowerCase().trim())) {
      newCampaigns.push({ name, id: camp.id, created: camp.created_time });
    }
  }
  console.log(`Found ${newCampaigns.length} new Campaigns in Notion:`);
  for (const c of newCampaigns) {
    console.log(`- "${c.name}" (Created: ${c.created}, ID: ${c.id})`);
  }

  console.log('\n=== CHECKING SOCIAL GROUP URLS IN NOTION VS SUPABASE PUBLIC ===');
  const notionSocials = await queryNotion('3700900c70518089871ee32c239cab43');
  const sbSocials = await sql.unsafe('SELECT id, group_name, url FROM public.social_group_urls');
  const sbSocialUrlMap = new Set(sbSocials.map(s => (s.url || '').toLowerCase().trim()));
  const newSocials = [];
  for (const s of notionSocials) {
    const name = s.properties['Name']?.title?.[0]?.plain_text || '';
    const url = s.properties['URL']?.url || '';
    if (url && !sbSocialUrlMap.has(url.toLowerCase().trim())) {
      newSocials.push({ name, url, id: s.id });
    }
  }
  console.log(`Found ${newSocials.length} new Social Group URLs in Notion (out of ${notionSocials.length} in Notion vs ${sbSocials.length} in Supabase)`);
  for (const s of newSocials.slice(0, 5)) {
    console.log(`- "${s.name}" -> ${s.url}`);
  }

  console.log('\n=== CHECKING INTERVIEWS IN NOTION VS SUPABASE PUBLIC ===');
  const notionInterviews = await queryNotion('3750900c7051806a80e1d0e36cc72804');
  const sbInterviews = await sql.unsafe('SELECT id, interview_title, created_time FROM public.interviews');
  console.log(`Notion Interviews: ${notionInterviews.length}, Supabase Interviews: ${sbInterviews.length}`);
}

inspectNewRecords().then(() => process.exit(0));
