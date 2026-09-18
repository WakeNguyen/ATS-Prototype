import sql from './src/lib/db.js';

async function checkSameCandidateDups() {
  const dups = await sql`
    SELECT candidate_id, value, COUNT(*) as count
    FROM public.contact_points
    WHERE type ILIKE '%phone%'
    GROUP BY candidate_id, value
    HAVING COUNT(*) > 1;
  `;
  console.log(dups);
}
checkSameCandidateDups().then(() => process.exit(0));
