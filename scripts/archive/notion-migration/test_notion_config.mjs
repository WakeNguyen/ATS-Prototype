import fs from 'fs';
const mcpConfig = JSON.parse(fs.readFileSync('C:/Users/trith/.gemini/antigravity/mcp_config.json', 'utf8'));
const notionServer = mcpConfig.mcpServers['notion-mcp-server'];
console.log('Notion Server command:', notionServer?.command);
console.log('Notion Server args:', notionServer?.args?.map(a => a.length > 20 ? a.substring(0, 5) + '...' : a));
console.log('Notion Server env keys:', Object.keys(notionServer?.env || {}));
