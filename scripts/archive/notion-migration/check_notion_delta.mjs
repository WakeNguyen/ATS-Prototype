import fs from 'fs';
import sql from './src/lib/db.js';

const mcpConfig = JSON.parse(fs.readFileSync('C:/Users/trith/.gemini/antigravity/mcp_config.json', 'utf8'));
const headersStr = mcpConfig.mcpServers['notion-mcp-server']?.env?.OPENAPI_MCP_HEADERS || '{}';
const headers = JSON.parse(headersStr);

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
    if (!res.ok) break;
    const data = await res.json();
    results = results.concat(data.results);
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }
  return results;
}

async function checkDelta() {
  console.log('=== EXACT DELTA ANALYSIS (NOTION VS SUPABASE PUBLIC) ===');

  const targets = [
    { name: 'candidates', dbId: 'a1f6d98431964934bf8e94284788e2b7', table: 'candidates' },
    { name: 'campaigns', dbId: '84a5b1e22e1643de95e5966cf44da725', table: 'campaigns' },
    { name: 'social_group_urls', dbId: '3700900c70518089871ee32c239cab43', table: 'social_group_urls' },
    { name: 'interviews', dbId: '3750900c7051806a80e1d0e36cc72804', table: 'interviews' },
    { name: 'application', dbId: '3440900c705180829dc6fdee16409f1c', table: 'activity' },
    { name: 'reach_sourcing', dbId: 'e0585fe75ad840a5b3a8891caa047381', table: 'reach_sourcing' },
    { name: 'clients', dbId: '026c91284f104f3dbd5fa8563618b3cf', table: 'clients' },
    { name: 'jobs', dbId: 'ad00f3d903dc4275b2766c48146fe0c2', table: 'jobs' }
  ];

  for (const t of targets) {
    const pages = await queryNotion(t.dbId);
    const existing = await sql.unsafe(`SELECT notion_id, id FROM public.${t.table} WHERE notion_id IS NOT NULL`);
    const existingNotionIds = new Set(existing.map(e => e.notion_id.toLowerCase().replace(/-/g, '')));
    
    const missing = [];
    for (const p of pages) {
      const cleanId = p.id.toLowerCase().replace(/-/g, '');
      if (!existingNotionIds.has(cleanId)) {
        missing.push(p);
      }
    }
    
    console.log(`\nTable: ${t.table.toUpperCase()} (Notion DB: ${t.name})`);
    console.log(`- Total Notion Pages: ${pages.length}`);
    console.log(`- Existing in Supabase with notion_id: ${existing.length}`);
    console.log(`- Missing in Supabase: ${missing.length}`);
    
    if (missing.length > 0) {
      console.log(`  Sample Missing records:`);
      for (const m of missing.slice(0, 5)) {
        let title = '';
        for (const k of Object.keys(m.properties || {})) {
          if (m.properties[k].type === 'title') {
            title = m.properties[k].title?.[0]?.plain_text || '';
            break;
          }
        }
        console.log(`  * [${m.created_time}] ${title} (Notion ID: ${m.id})`);
      }
    }
  }
}

checkDelta().then(() => process.exit(0));
