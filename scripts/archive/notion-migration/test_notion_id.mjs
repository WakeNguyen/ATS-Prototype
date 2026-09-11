import sql from './src/lib/db.js';
async function test() {
  const existingCandidates = await sql`SELECT notion_id FROM candidates WHERE notion_id IS NOT NULL LIMIT 5`;
  console.log(existingCandidates);
}
test().then(() => process.exit(0));
