import sql from './src/lib/db.js';

function normalizeContactValue(type, rawValue) {
  if (!rawValue) return "";
  const t = (type || "").toLowerCase().trim();
  const val = String(rawValue).trim();
  
  if (t.includes("email") || t.includes("mail")) {
    return val.toLowerCase();
  }
  
  if (t.includes("phone") || t.includes("tel") || t.includes("mobile") || t.includes("call")) {
    let digits = val.replace(/[^\d+]/g, "").trim();
    if (digits.startsWith("+84")) {
      digits = "+84" + digits.slice(3).replace(/^0+/, "");
    } else if (digits.startsWith("84") && digits.length >= 11) {
      digits = "+84" + digits.slice(2).replace(/^0+/, "");
    } else if (digits.startsWith("0")) {
      digits = "+84" + digits.slice(1);
    } else if (!digits.startsWith("+")) {
      digits = "+84" + digits.replace(/^0+/, "");
    }
    return digits;
  }
  return val;
}

async function heal() {
  console.log('=== AUTO-HEAL CONTACTS INITIALIZING ===');
  
  // 1. Phones
  const invalidPhones = await sql`
    SELECT id, type, value, candidate_id 
    FROM public.contact_points 
    WHERE type ILIKE '%phone%' AND (value NOT LIKE '+84%' OR LENGTH(value) < 11 OR LENGTH(value) > 13);
  `;
  
  let pCount = 0;
  for (const cp of invalidPhones) {
    const fixed = normalizeContactValue(cp.type, cp.value);
    if (fixed && fixed !== cp.value) {
      await sql`UPDATE public.contact_points SET value = ${fixed}, last_updated = NOW() WHERE id = ${cp.id}`;
      pCount++;
    }
  }
  console.log(`- Fixed ${pCount} / ${invalidPhones.length} Phone Numbers.`);

  // 2. Emails
  const invalidEmails = await sql`
    SELECT id, type, value, candidate_id 
    FROM public.contact_points 
    WHERE type ILIKE '%mail%' AND (value != LOWER(value) OR value != TRIM(value));
  `;
  
  let eCount = 0;
  for (const cp of invalidEmails) {
    const fixed = normalizeContactValue(cp.type, cp.value);
    if (fixed && fixed !== cp.value) {
      await sql`UPDATE public.contact_points SET value = ${fixed}, last_updated = NOW() WHERE id = ${cp.id}`;
      eCount++;
    }
  }
  console.log(`- Fixed ${eCount} / ${invalidEmails.length} Emails.`);

  // 3. Re-aggregate for affected candidates
  const affectedCandidates = new Set([...invalidPhones.map(c => c.candidate_id), ...invalidEmails.map(c => c.candidate_id)]);
  console.log(`- Re-aggregating GIN search arrays for ${affectedCandidates.size} candidates...`);
  
  for (const cid of affectedCandidates) {
    const allContacts = await sql`SELECT type, value FROM public.contact_points WHERE candidate_id = ${cid}`;
    const phones = [], emails = [], socials = [], texts = [];
    for (const cp of allContacts) {
      const t = (cp.type || "").toLowerCase();
      const v = String(cp.value || "").trim();
      if (t.includes('phone') || t.includes('zalo') || t.includes('mobile')) phones.push(v);
      else if (t.includes('mail')) emails.push(v);
      else socials.push({ type: cp.type, value: v, url: v });
      texts.push(v);
    }
    await sql`
      UPDATE public.candidates SET
        phones = ${phones}, emails = ${emails}, socials = ${socials}, all_contacts_text = ${texts.join(' | ')}
      WHERE id = ${cid}
    `;
  }
  
  console.log('=== AUTO-HEAL COMPLETED ===');
}

heal().then(() => process.exit(0));
