import fs from 'fs';

const mcpConfig = JSON.parse(fs.readFileSync('C:/Users/trith/.gemini/antigravity/mcp_config.json', 'utf8'));
const notionServer = mcpConfig.mcpServers['notion-mcp-server'];
const headersStr = notionServer?.env?.OPENAPI_MCP_HEADERS || '{}';
const headers = JSON.parse(headersStr);

async function testNotion() {
  const res = await fetch('https://api.notion.com/v1/databases/a1f6d98431964934bf8e94284788e2b7/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
      ...headers
    },
    body: JSON.stringify({ page_size: 5 })
  });
  
  const data = await res.json();
  console.log('Notion Candidate DB Query status:', res.status);
  console.log('Candidates found:', data.results?.length);
  if (data.results?.length > 0) {
    for (const sample of data.results) {
      const name = sample.properties['Full Name']?.title?.[0]?.plain_text;
      const id = sample.properties['ID_Candidate']?.unique_id?.number;
      console.log(`- Candidate #${id}: ${name} (ID: ${sample.id}, Created: ${sample.created_time})`);
    }
  }
}

testNotion();
