import sql from './src/lib/db.js';

async function checkBrokenPhones() {
  const remainingInvalid = await sql`
    SELECT id, candidate_id, value 
    FROM public.contact_points 
    WHERE type ILIKE '%phone%' 
      AND (value NOT LIKE '+84%' OR LENGTH(value) < 11 OR LENGTH(value) > 13);
  `;
  
  const foreign = [];
  const brokenText = [];
  
  for (const row of remainingInvalid) {
    const v = row.value;
    // Check if it's a valid international number (+ followed by 7 to 15 digits)
    const isInternational = /^\+\d{7,15}$/.test(v);
    
    if (isInternational && !v.startsWith('+84')) {
      foreign.push(v);
    } else {
      brokenText.push(v);
    }
  }
  
  console.log(`Remaining un-normalized phones: ${remainingInvalid.length}`);
  console.log(`Foreign numbers (+1, +44, etc): ${foreign.length}`);
  if (foreign.length > 0) console.log(foreign.slice(0, 5), '...');
  
  console.log(`\nBroken / Mistyped texts: ${brokenText.length}`);
  if (brokenText.length > 0) {
    brokenText.forEach(v => console.log(`- "${v}"`));
  }
}

checkBrokenPhones().then(() => process.exit(0));
