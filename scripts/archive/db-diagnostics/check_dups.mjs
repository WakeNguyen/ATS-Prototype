import sql from './src/lib/db.js';

async function checkDups() {
  const dups = await sql`
    SELECT cp.value AS phone, c.display_number, c.full_name, c.id AS candidate_id
    FROM public.contact_points cp
    JOIN public.candidates c ON cp.candidate_id = c.id
    WHERE cp.value IN ('+84768104818', '+84822201930')
    ORDER BY cp.value;
  `;
  console.log(dups);
}
checkDups().then(() => process.exit(0));
