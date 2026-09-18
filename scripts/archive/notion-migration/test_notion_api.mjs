import fs from 'fs';

const mcpConfig = JSON.parse(fs.readFileSync('C:/Users/trith/.gemini/antigravity/mcp_config.json', 'utf8'));
const notionServer = mcpConfig.mcpServers['notion-mcp-server'];
const env = notionServer?.env || {};
const token = env.NOTION_API_KEY || env.NOTION_TOKEN || notionServer?.args?.find(a => a.startsWith('ntn_') || a.startsWith('secret_'));

console.log('Notion token found:', !!token);

async function testNotion() {
  if (!token) {
    console.error('No Notion token found in mcp_config.json');
    return;
  }
  
  const res = await fetch('https://api.notion.com/v1/databases/a1f6d98431964934bf8e94284788e2b7/query', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ page_size: 5 })
  });
  
  const data = await res.json();
  console.log('Notion Candidate DB Query status:', res.status);
  console.log('Candidates found in sample query:', data.results?.length);
  if (data.results?.length > 0) {
    const sample = data.results[0];
    const name = sample.properties['Full Name']?.title?.[0]?.plain_text;
    const id = sample.properties['ID_Candidate']?.unique_id?.number;
    console.log(`Sample Candidate: #${id} - ${name} (Notion Page ID: ${sample.id})`);
  }
}

testNotion();
