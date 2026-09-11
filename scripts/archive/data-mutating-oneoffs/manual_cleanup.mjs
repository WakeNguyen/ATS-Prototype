import sql from './src/lib/db.js';

async function manualCleanup() {
    console.log('=== CLEANING REMAINING NOTION COPY-PASTE ARTIFACTS IN SUPABASE ===');
    await sql.begin(async (sqlTx) => {
        // Delete anhdo1410 from #1008
        await sqlTx`DELETE FROM public.contact_points WHERE value = 'https://www.facebook.com/anhdo1410' AND candidate_id = (SELECT id FROM public.candidates WHERE display_number = 1008)`;
        
        // Delete hoangkhuong.pham from #1760
        await sqlTx`DELETE FROM public.contact_points WHERE value = 'https://www.facebook.com/hoangkhuong.pham' AND candidate_id = (SELECT id FROM public.candidates WHERE display_number = 1760)`;
        
        // Delete tai-lam-46742b67 from #524
        await sqlTx`DELETE FROM public.contact_points WHERE value = 'https://www.linkedin.com/in/tai-lam-46742b67/' AND candidate_id = (SELECT id FROM public.candidates WHERE display_number = 524)`;
        
        console.log('- Manually deleted the 3 incorrect copy-pasted links from the wrong candidates.');
    });

    console.log('\n=== FINAL RE-SCREENING DUPLICATES ===');
    const dups = await sql`
        SELECT 
          cp.type, cp.value, COUNT(DISTINCT cp.candidate_id) as num_candidates
        FROM public.contact_points cp
        WHERE cp.value IS NOT NULL AND TRIM(cp.value) != ''
          AND LOWER(cp.value) NOT IN ('n/a', 'na', 'none', 'null', 'không có')
        GROUP BY cp.type, cp.value
        HAVING COUNT(DISTINCT cp.candidate_id) > 1
    `;
    if (dups.length === 0) {
        console.log("- No duplicate contact points found across different candidates! DB is 100% clean.");
    } else {
        console.log(`- Found ${dups.length} remaining duplicates:`, dups);
    }
}
manualCleanup().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
