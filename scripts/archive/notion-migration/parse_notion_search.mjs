import fs from 'fs';

const raw = fs.readFileSync('C:/Users/trith/.gemini/antigravity/brain/a0a4fff1-3d2e-47bc-a472-12543bb4d62c/.system_generated/steps/109/output.txt', 'utf8');
const data = JSON.parse(raw);

console.log('Total results in page 1:', data.results.length);
console.log('Has more:', data.has_more, 'Next cursor:', data.next_cursor);

const byDb = {};
for (const item of data.results) {
  const dbId = item.parent?.database_id || 'no_db';
  if (!byDb[dbId]) byDb[dbId] = [];
  
  let title = '';
  if (item.properties) {
    for (const key of Object.keys(item.properties)) {
      const prop = item.properties[key];
      if (prop.type === 'title' && prop.title && prop.title[0]) {
        title = prop.title[0].plain_text;
        break;
      }
    }
  }
  byDb[dbId].push({
    id: item.id,
    title,
    created: item.created_time,
    last_edited: item.last_edited_time,
    type: item.object
  });
}

for (const dbId of Object.keys(byDb)) {
  console.log(`\n=== Database: ${dbId} (${byDb[dbId].length} records) ===`);
  for (const r of byDb[dbId].slice(0, 8)) {
    console.log(`- [${r.created}] [Edited: ${r.last_edited}] ${r.title} (${r.id})`);
  }
}
