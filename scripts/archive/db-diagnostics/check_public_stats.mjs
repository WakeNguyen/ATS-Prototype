import sql from './src/lib/db.js';

async function main() {
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    console.log('=== ROW COUNTS IN PUBLIC SCHEMA ===');
    for (const t of tables) {
      const [{ count }] = await sql.unsafe(`SELECT count(*)::int as count FROM public.${t.table_name}`);
      console.log(`${t.table_name.padEnd(25)}: ${count} rows`);
    }

    console.log('\n=== LATEST CANDIDATES (PUBLIC) ===');
    const candidates = await sql`
      SELECT id, display_number, display_id, full_name, created_time, created_at 
      FROM public.candidates 
      ORDER BY display_number DESC NULLS LAST 
      LIMIT 5;
    `;
    console.log(candidates);

    console.log('\n=== LATEST CONTACT POINTS (PUBLIC) ===');
    const cps = await sql`
      SELECT id, candidate_id, type, value, created_time, created_at 
      FROM public.contact_points 
      ORDER BY created_time DESC NULLS LAST, created_at DESC NULLS LAST 
      LIMIT 5;
    `;
    console.log(cps);

    console.log('\n=== LATEST APPLICATIONS / ACTIVITY (PUBLIC) ===');
    const apps = await sql`
      SELECT id, display_number, candidate_id, job_id, status, current_stage, created_time 
      FROM public.activity 
      ORDER BY display_number DESC NULLS LAST 
      LIMIT 5;
    `;
    console.log(apps);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}
main();
