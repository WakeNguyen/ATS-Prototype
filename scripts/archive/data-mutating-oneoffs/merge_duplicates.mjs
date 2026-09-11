import sql from './src/lib/db.js';

async function mergeCandidates() {
  console.log('=== STARTING AUTOMATED SAFE MERGE ===');
  
  // 1. Find duplicate groups: candidates sharing same contact AND same name (case-insensitive)
  // This explicitly prevents merging two DIFFERENT people who accidentally shared a copy-pasted link.
  const duplicates = await sql`
    SELECT 
      LOWER(TRIM(c.full_name)) as norm_name,
      cp.type,
      LOWER(TRIM(cp.value)) as norm_value,
      array_agg(c.id ORDER BY c.display_number ASC) as cand_ids
    FROM public.contact_points cp
    JOIN public.candidates c ON cp.candidate_id = c.id
    WHERE cp.value IS NOT NULL AND TRIM(cp.value) != ''
      AND LOWER(cp.value) NOT IN ('n/a', 'na', 'none', 'null', 'không có')
    GROUP BY LOWER(TRIM(c.full_name)), cp.type, LOWER(TRIM(cp.value))
    HAVING COUNT(DISTINCT cp.candidate_id) > 1
  `;
  
  let mergedPairsCount = 0;
  const processedGhosts = new Set();
  
  for (const group of duplicates) {
    const masterId = group.cand_ids[0];
    const ghostIds = group.cand_ids.slice(1);
    
    for (const ghostId of ghostIds) {
      if (processedGhosts.has(ghostId)) continue;
      if (masterId === ghostId) continue;
      
      console.log(`- Merging Ghost [${ghostId}] into Master [${masterId}] (Name: ${group.norm_name})`);
      
      await sql.begin(async (sqlTx) => {
        // A. Relink activities to Master
        await sqlTx`UPDATE public.activity SET candidate_id = ${masterId} WHERE candidate_id = ${ghostId}`;
        
        // B. Relink contact points to Master
        await sqlTx`UPDATE public.contact_points SET candidate_id = ${masterId} WHERE candidate_id = ${ghostId}`;
        
        // C. Clean up newly created EXACT duplicate contact points within the Master
        await sqlTx`
          DELETE FROM public.contact_points 
          WHERE id IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER(PARTITION BY candidate_id, LOWER(type), LOWER(value) ORDER BY created_time ASC) as rn
              FROM public.contact_points
              WHERE candidate_id = ${masterId}
            ) t WHERE t.rn > 1
          )
        `;
        
        // D. Delete the Ghost profile completely
        await sqlTx`DELETE FROM public.candidates WHERE id = ${ghostId}`;
        
        // E. Re-aggregate the fast-search vectors for the Master profile
        const allContacts = await sqlTx`SELECT type, value FROM public.contact_points WHERE candidate_id = ${masterId}`;
        const phones = [], emails = [], socials = [], texts = [];
        for (const cp of allContacts) {
          const t = (cp.type || "").toLowerCase();
          const v = String(cp.value || "").trim();
          if (t.includes('phone') || t.includes('zalo') || t.includes('mobile')) phones.push(v);
          else if (t.includes('mail')) emails.push(v);
          else socials.push({ type: cp.type, value: v, url: v });
          texts.push(v);
        }
        await sqlTx`
          UPDATE public.candidates SET
            phones = ${phones}, emails = ${emails}, socials = ${socials}, all_contacts_text = ${texts.join(' | ')}
          WHERE id = ${masterId}
        `;
      });
      
      processedGhosts.add(ghostId);
      mergedPairsCount++;
    }
  }
  
  console.log(`\n=== MERGE COMPLETE ===`);
  console.log(`Total duplicate "Ghost" profiles safely merged and deleted: ${mergedPairsCount}`);
}

mergeCandidates().then(() => process.exit(0)).catch(e => { console.error('MERGE ERROR:', e); process.exit(1); });
