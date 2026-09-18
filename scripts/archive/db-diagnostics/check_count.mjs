import sql from './src/lib/db.js';
async function check() {
  const c = await sql`SELECT COUNT(*) FROM public.candidates WHERE notion_id IS NOT NULL`;
  console.log('Candidates with notion_id:', c[0].count);
  const cp = await sql`SELECT COUNT(*) FROM public.contact_points WHERE notion_id IS NOT NULL`;
  console.log('Contact Points with notion_id:', cp[0].count);
}
check().then(() => process.exit(0));
