import sql from './src/lib/db.js';
async function check() {
  const tables = ['jobs', 'campaigns', 'social_group_urls', 'interviews', 'contact_points'];
  for (const t of tables) {
     const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${t}`;
     console.log(t, cols.map(c => c.column_name).join(', '));
  }
}
check().then(() => process.exit(0));
