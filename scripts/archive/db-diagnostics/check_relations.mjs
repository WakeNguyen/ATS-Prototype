import sql from './src/lib/db.js';

async function checkRelations() {
  const stats = await sql`
    SELECT 
      c.display_number, 
      c.full_name,
      (SELECT COUNT(*) FROM public.contact_points cp WHERE cp.candidate_id = c.id) as total_contacts,
      (SELECT COUNT(*) FROM public.activity a WHERE a.candidate_id = c.id) as total_applications,
      (SELECT COUNT(*) FROM public.activity_log al JOIN public.activity a ON al.application_id = a.id WHERE a.candidate_id = c.id) as total_activity_logs,
      (SELECT COUNT(*) FROM public.interviews i JOIN public.activity a ON i.application_id = a.id WHERE a.candidate_id = c.id) as total_interviews
    FROM public.candidates c
    WHERE c.display_number IN (2198, 3353, 619, 738, 2544, 3345)
    ORDER BY c.full_name, c.display_number;
  `;
  
  console.table(stats);
}

checkRelations().then(() => process.exit(0));
