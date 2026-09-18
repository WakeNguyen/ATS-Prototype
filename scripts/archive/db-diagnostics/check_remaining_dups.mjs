import sql from './src/lib/db.js';
async function remainingDups() {
  const dups = await sql`
    SELECT 
      cp.type,
      cp.value, 
      COUNT(DISTINCT cp.candidate_id) as num_candidates,
      array_agg(DISTINCT '#' || c.display_number || ' (' || c.full_name || ')') as candidate_list
    FROM public.contact_points cp
    JOIN public.candidates c ON cp.candidate_id = c.id
    WHERE cp.value IS NOT NULL AND TRIM(cp.value) != ''
      AND LOWER(cp.value) NOT IN ('n/a', 'na', 'none', 'null', 'không có')
    GROUP BY cp.type, cp.value
    HAVING COUNT(DISTINCT cp.candidate_id) > 1
    ORDER BY cp.type, cp.value;
  `;
  console.log(dups);
}
remainingDups().then(() => process.exit(0));
