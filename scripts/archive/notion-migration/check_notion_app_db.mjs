import fs from 'fs';
const mcpConfig = JSON.parse(fs.readFileSync('C:/Users/trith/.gemini/antigravity/mcp_config.json', 'utf8'));
const headersStr = mcpConfig.mcpServers['notion-mcp-server']?.env?.OPENAPI_MCP_HEADERS || '{}';
const headers = JSON.parse(headersStr);

async function checkNotionAppDb() {
  const dbId = '3440900c-7051-8082-9dc6-fdee16409f1c';
  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
    method: 'GET',
    headers: { 'Notion-Version': '2022-06-28', ...headers }
  });
  if (!res.ok) {
    console.error(await res.text());
    return;
  }
  const db = await res.json();
  const parentProp = Object.values(db.properties).find(p => p.type === 'relation' && p.name.includes('Parent'));
  const subProp = Object.values(db.properties).find(p => p.type === 'relation' && p.name.includes('Sub-item'));
  console.log("Parent Prop:", parentProp);
  console.log("Sub-item Prop:", subProp);
}

checkNotionAppDb().then(() => process.exit(0));
