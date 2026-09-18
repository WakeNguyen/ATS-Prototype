import sql from './src/lib/db.js';

async function main() {
  const cols = await sql`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name IN ('campaigns', 'social_group_urls', 'interviews', 'activity', 'activity_log', 'contact_points', 'candidates', 'jobs', 'clients')
    ORDER BY table_name, ordinal_position;
  `;
  const byTable = {};
  for (const c of cols) {
    if (!byTable[c.table_name]) byTable[c.table_name] = [];
    byTable[c.table_name].push(`${c.column_name} (${c.data_type})`);
  }
  for (const [t, cl] of Object.entries(byTable)) {
    console.log(`\n=== ${t} ===\n${cl.join(', ')}`);
  }
  process.exit(0);
}
main();
