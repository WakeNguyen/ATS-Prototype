import sql from './src/lib/db.js';

async function checkAllDups() {
  const dups = await sql`
    SELECT 
      cp.type,
      cp.value, 
      COUNT(DISTINCT cp.candidate_id) as num_candidates,
      array_agg(DISTINCT '#' || c.display_number || ' (' || c.full_name || ')') as candidate_list
    FROM public.contact_points cp
    JOIN public.candidates c ON cp.candidate_id = c.id
    WHERE cp.value IS NOT NULL 
      AND TRIM(cp.value) != ''
      AND LOWER(cp.value) NOT IN ('n/a', 'na', 'none', 'null', 'không có')
    GROUP BY cp.type, cp.value
    HAVING COUNT(DISTINCT cp.candidate_id) > 1
    ORDER BY cp.type, cp.value;
  `;
  
  if (dups.length === 0) {
    console.log("No other duplicates found!");
  } else {
    console.log(`Found ${dups.length} duplicate contact points across multiple candidates:\n`);
    dups.forEach(d => {
      console.log(`[${d.type}] ${d.value}`);
      console.log(`   -> Shared by: ${d.candidate_list.join(', ')}\n`);
    });
  }
}
checkAllDups().then(() => process.exit(0));
