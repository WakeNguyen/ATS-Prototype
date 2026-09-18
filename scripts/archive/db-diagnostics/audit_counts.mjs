import fs from 'fs';
import sql from './src/lib/db.js';

const mcpConfig = JSON.parse(fs.readFileSync('C:/Users/trith/.gemini/antigravity/mcp_config.json', 'utf8'));
const headersStr = mcpConfig.mcpServers['notion-mcp-server']?.env?.OPENAPI_MCP_HEADERS || '{}';
const headers = JSON.parse(headersStr);

const DATABASES = {
  candidates: 'a1f6d984-3196-4934-bf8e-94284788e2b7',
  contact_points: '6d8b17c5-940a-492f-b2d9-13b6788a2079',
  clients: '026c9128-4f10-4f3d-bd5f-a8563618b3cf',
  client_contacts: '5ed1414e-50c3-42e4-af6c-df77c036429c',
  jobs: 'ad00f3d9-03dc-4275-b276-6c48146fe0c2',
  application: '3440900c-7051-8082-9dc6-fdee16409f1c',
  reach_sourcing: 'e0585fe7-5ad8-40a5-b3a8-891caa047381',
  campaigns: '84a5b1e2-2e16-43de-95e5-966cf44da725',
  social_group_urls: '3700900c-7051-8089-871e-e32c239cab43',
  interview: '3750900c-7051-806a-80e1-d0e36cc72804'
};

async function fetchAllNotionPages(dbId) {
  let results = [];
  let hasMore = true;
  let startCursor = undefined;
  
  while (hasMore) {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
        ...headers
      },
      body: JSON.stringify({
        page_size: 100,
        start_cursor: startCursor
      })
    });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Error querying DB ${dbId}:`, res.status, errText);
      break;
    }
    
    const data = await res.json();
    results = results.concat(data.results);
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }
  return results;
}

async function auditCounts() {
  console.log('=== NOTION VS SUPABASE PUBLIC SCHEMA COUNTS ===');
  for (const [name, dbId] of Object.entries(DATABASES)) {
    try {
      const cleanDbId = dbId.replace(/-/g, '');
      const notionPages = await fetchAllNotionPages(cleanDbId);
      
      let tableName = name;
      if (name === 'application') tableName = 'activity';
      if (name === 'reach_sourcing') tableName = 'reach_sourcing';
      if (name === 'interview') tableName = 'interviews';
      
      let sbCount = 0;
      try {
        const [{ count }] = await sql.unsafe(`SELECT count(*)::int as count FROM public.${tableName}`);
        sbCount = count;
      } catch (err) {
        sbCount = `Table not found / error: ${err.message}`;
      }
      
      console.log(`${name.padEnd(20)} | Notion: ${String(notionPages.length).padStart(6)} | Supabase (public): ${String(sbCount).padStart(6)} | Diff: ${typeof sbCount === 'number' ? notionPages.length - sbCount : 'N/A'}`);
    } catch (e) {
      console.error(`Failed auditing ${name}:`, e.message);
    }
  }
}

auditCounts().then(() => process.exit(0));
