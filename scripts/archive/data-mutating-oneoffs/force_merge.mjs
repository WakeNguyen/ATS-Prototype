import sql from './src/lib/db.js';

async function forceMergeAndClean() {
    console.log('=== FORCE MERGING SPECIFIED CANDIDATES ===');
    await sql.begin(async (sqlTx) => {
        const merges = [
            { ghost: 2819, master: 3186, desc: 'Tran Minh Nguyet -> Tran Thi Minh Nguyet' },
            { ghost: 54, master: 60, desc: 'Nguyễn Thanh Sơn -> Nguyen Thanh Son' }
        ];

        for (const m of merges) {
            const g = await sqlTx`SELECT id FROM public.candidates WHERE display_number = ${m.ghost}`;
            const mst = await sqlTx`SELECT id FROM public.candidates WHERE display_number = ${m.master}`;
            if (g.length === 0 || mst.length === 0) {
                console.log(`Skipping ${m.desc} (one or both not found)`);
                continue;
            }

            const ghostId = g[0].id;
            const masterId = mst[0].id;

            await sqlTx`UPDATE public.activity SET candidate_id = ${masterId} WHERE candidate_id = ${ghostId}`;
            await sqlTx`UPDATE public.contact_points SET candidate_id = ${masterId} WHERE candidate_id = ${ghostId}`;
            
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

            await sqlTx`DELETE FROM public.candidates WHERE id = ${ghostId}`;

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
            console.log(`- Merged ${m.desc} successfully.`);
        }
    });

    console.log('\n=== CLEANING ORPHANS ===');
    const d1 = await sql`DELETE FROM public.contact_points WHERE candidate_id NOT IN (SELECT id FROM public.candidates) RETURNING id`;
    console.log(`- Deleted ${d1.length} orphan contact points.`);
    
    const d2 = await sql`DELETE FROM public.activity WHERE candidate_id NOT IN (SELECT id FROM public.candidates) OR job_id NOT IN (SELECT id FROM public.jobs) RETURNING id`;
    console.log(`- Deleted ${d2.length} orphan activities.`);
    
    const d3 = await sql`DELETE FROM public.activity_log WHERE application_id NOT IN (SELECT id FROM public.activity) RETURNING id`;
    console.log(`- Deleted ${d3.length} orphan activity logs.`);

    // Check if interviews has application_id as foreign key and delete if orphan
    const d4 = await sql`DELETE FROM public.interviews WHERE application_id IS NOT NULL AND application_id NOT IN (SELECT id FROM public.activity) RETURNING id`;
    console.log(`- Deleted ${d4.length} orphan interviews.`);
    
    console.log('\n=== RE-SCREENING DUPLICATES ===');
    const dups = await sql`
        SELECT 
          cp.type, cp.value, COUNT(DISTINCT cp.candidate_id) as num_candidates,
          array_agg(DISTINCT '#' || c.display_number || ' (' || c.full_name || ')') as candidate_list
        FROM public.contact_points cp
        JOIN public.candidates c ON cp.candidate_id = c.id
        WHERE cp.value IS NOT NULL AND TRIM(cp.value) != ''
          AND LOWER(cp.value) NOT IN ('n/a', 'na', 'none', 'null', 'không có')
        GROUP BY cp.type, cp.value
        HAVING COUNT(DISTINCT cp.candidate_id) > 1
        ORDER BY cp.type, cp.value;
    `;
    if (dups.length === 0) {
        console.log("- No duplicate contact points found across different candidates! DB is 100% clean.");
    } else {
        console.log(`- Found ${dups.length} remaining duplicates:`);
        console.log(dups);
    }
}

forceMergeAndClean().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
