import sql from './src/lib/db.js';

async function checkPhoneFormat() {
  const samplePhones = await sql`
    SELECT id, candidate_id, type, value 
    FROM public.contact_points 
    WHERE type ILIKE 'phone' 
    LIMIT 20;
  `;
  console.log('Sample Phone numbers in public.contact_points:');
  console.log(samplePhones);

  const sampleCandidatePhones = await sql`
    SELECT id, display_number, full_name, phones 
    FROM public.candidates 
    WHERE phones IS NOT NULL AND array_length(phones, 1) > 0 
    LIMIT 10;
  `;
  console.log('\nSample phones array in public.candidates:');
  console.log(sampleCandidatePhones);
  
  process.exit(0);
}
checkPhoneFormat();
