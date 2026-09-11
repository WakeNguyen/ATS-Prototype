'use server';

import sql from '../lib/db.js';

let revalidatePath = () => {};
try {
  const nextCache = await import('next/cache');
  if (nextCache && nextCache.revalidatePath) {
    revalidatePath = nextCache.revalidatePath;
  }
} catch (e) {}

// Guard: đảm bảo hàm chỉ được gọi từ trong 1 request/server-action THẬT của Next.js
// (UI thật, hoặc HTTP request thật tới app đang chạy) — KHÔNG cho phép gọi trực tiếp
// từ 1 script Node độc lập import thẳng module này (đúng loại lỗi đã gây ra PHẦN M).
// headers() chỉ hoạt động trong request context thật; gọi ngoài context này sẽ throw.
async function assertRealRequestContext(fnName) {
  try {
    let headersFn = null;
    try {
      const mod = await import('next/headers');
      headersFn = mod?.headers;
    } catch {
      const mod = await import('next/headers.js');
      headersFn = mod?.headers;
    }
    if (!headersFn) throw new Error("headers() function not available");
    await headersFn();
  } catch (e) {
    throw new Error(
      `[SECURITY GUARD] ${fnName} bị chặn: hàm này có tác dụng phụ ghi dữ liệu thật, ` +
      `chỉ được phép gọi từ UI/HTTP request thật của app đang chạy (npm run dev hoặc bản deploy), ` +
      `KHÔNG được import thẳng module rồi gọi trong 1 script/test độc lập. ` +
      `Xem GEMINI.md mục 10.8 và docs/testing/FIX_SPEC_2026-09-02_n8n_cv-parser-batch-resume-and-dedup-cases.md mục M/N. ` +
      `Lỗi gốc: ${e.message}`
    );
  }
}

/**
 * Fetch all pending CV imports for the HITL queue.
 */
export async function getPendingCVImports() {
  try {
    const pending = await sql`
      SELECT id, payload, match_status, matched_candidate_id, matched_details, created_at
      FROM pending_cv_imports
      WHERE status = 'Pending'
      ORDER BY created_at ASC
    `;
    return { success: true, data: pending };
  } catch (error) {
    console.error("Error fetching pending imports:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Helper to create a new Candidate profile from raw CV payload (used in FORCE_CREATE).
 */
async function createCandidateFromPayload(sqlTx, payload) {
  const ext = (payload.original_filename || '').split('.').pop() || 'pdf';
  const initialCvUrls = payload.cv_url 
    ? [{ url: payload.cv_url, filename: `CV_1.${ext}`, added_at: new Date().toISOString() }] 
    : [];

  const [newCand] = await sqlTx`
    INSERT INTO candidates (full_name, prefix, dob, address, cv_url, cv_urls, notes, created_time, last_updated)
    VALUES (
      ${payload.full_name || 'Unknown Candidate'}, 
      ${payload.prefix || 'Mr.'}, 
      ${payload.dob || null}, 
      ${payload.address || ''}, 
      ${payload.cv_url || ''}, 
      ${sqlTx.json(initialCvUrls)}, 
      ${payload.notes || ''}, 
      NOW(), 
      NOW()
    )
    RETURNING id, display_number
  `;

  if (payload.contactPoints && Array.isArray(payload.contactPoints) && payload.contactPoints.length > 0) {
    const contactInserts = payload.contactPoints.map(cp => ({
      candidate_id: newCand.id,
      type: cp.type,
      value: cp.value,
      created_time: new Date(),
      last_updated: new Date()
    }));
    await sqlTx`INSERT INTO contact_points ${sqlTx(contactInserts)}`;

    const allContacts = await sqlTx`SELECT type, value FROM contact_points WHERE candidate_id = ${newCand.id}`;
    const phones = [], emails = [], socials = [];
    const texts = [];
    for (const cp of allContacts) {
      const t = (cp.type || "").toLowerCase();
      const v = String(cp.value || "").trim();
      if (t.includes('phone') || t.includes('zalo') || t.includes('whatsapp') || t.includes('mobile')) phones.push(v);
      else if (t.includes('mail')) emails.push(v);
      else socials.push({ type: cp.type, value: v, url: v });
      texts.push(v);
    }
    await sqlTx`
      UPDATE candidates SET
        phones = ${phones}, emails = ${emails}, socials = ${sqlTx.json(socials)}, all_contacts_text = ${texts.join(' | ')}
      WHERE id = ${newCand.id}
    `;
  }

  const finalFileName = `CV_${newCand.display_number}_1.${ext}`;
  if (payload.cv_url) {
    await sqlTx`
      UPDATE candidates
      SET cv_urls = ${sqlTx.json([{ url: payload.cv_url, filename: finalFileName, added_at: new Date().toISOString() }])}
      WHERE id = ${newCand.id}
    `;
  }

  if (process.env.N8N_RENAME_WEBHOOK_URL && payload.drive_file_id) {
    try {
      await fetch(process.env.N8N_RENAME_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drive_file_id: payload.drive_file_id, new_name: finalFileName })
      });
    } catch (renameErr) {
      console.error('[hitl_actions] Rename webhook error in FORCE_CREATE (ignored):', renameErr);
    }
  }

  return newCand;
}

/**
 * Resolve a pending CV import.
 * @param {string} id - The ID of the pending import
 * @param {string} action - 'REJECT' | 'DISMISS' | 'MERGE' | 'FORCE_CREATE'
 * @param {object} mergeOptions - Config for MERGE action
 */
export async function resolvePendingCVImport(id, action, mergeOptions = {}) {
  await assertRealRequestContext('resolvePendingCVImport');
  try {
    const result = await sql.begin(async (sqlTx) => {
      const [pending] = await sqlTx`
        SELECT payload FROM pending_cv_imports WHERE id = ${id}
      `;
      const payload = pending?.payload || {};

      if (action === 'REJECT' || action === 'DISMISS') {
        await sqlTx`
          UPDATE pending_cv_imports
          SET status = 'Rejected', resolved_at = NOW()
          WHERE id = ${id}
        `;
        return { success: true };
      } else if (action === 'FORCE_CREATE') {
        const createdCand = await createCandidateFromPayload(sqlTx, payload);
        await sqlTx`
          UPDATE pending_cv_imports
          SET status = 'Approved', resolved_at = NOW()
          WHERE id = ${id}
        `;
        return { success: true, candidateId: createdCand?.id, displayNumber: createdCand?.display_number };
      } else if (action === 'MERGE') {
        const { targetCandidateId, newContactPoints = [], cvUrlStrategy, newCvUrl, fieldUpdates = {} } = mergeOptions;
        
        if (!targetCandidateId) throw new Error("Target candidate ID is required for MERGE.");

        // 1. Update candidate info fields if selected
        if (fieldUpdates && Object.keys(fieldUpdates).length > 0) {
          await sqlTx`
            UPDATE candidates
            SET
              full_name = COALESCE(${fieldUpdates.full_name ?? null}, full_name),
              dob = COALESCE(${fieldUpdates.dob ?? null}, dob),
              address = COALESCE(${fieldUpdates.address ?? null}, address),
              notes = COALESCE(${fieldUpdates.notes ?? null}, notes),
              last_updated = NOW()
            WHERE id = ${targetCandidateId}
          `;
        }

        // 2. Insert new contact points if selected (with server-side deduplication against current DB state)
        if (newContactPoints.length > 0) {
          const existingContacts = await sqlTx`
            SELECT type, LOWER(TRIM(value)) AS norm_value
            FROM contact_points
            WHERE candidate_id = ${targetCandidateId}
          `;
          const existingSet = new Set(existingContacts.map(c => `${c.type}::${c.norm_value}`));

          const dedupedContactPoints = newContactPoints.filter(cp =>
            cp && cp.value && !existingSet.has(`${cp.type}::${cp.value.trim().toLowerCase()}`)
          );

          if (dedupedContactPoints.length > 0) {
            const contactInserts = dedupedContactPoints.map(cp => ({
              candidate_id: targetCandidateId,
              type: cp.type,
              value: cp.value,
              created_time: new Date(),
              last_updated: new Date()
            }));
            await sqlTx`
              INSERT INTO contact_points ${sqlTx(contactInserts, 'candidate_id', 'type', 'value', 'created_time', 'last_updated')}
            `;

            const allContacts = await sqlTx`SELECT type, value FROM contact_points WHERE candidate_id = ${targetCandidateId}`;
            const phones = [], emails = [], socials = [];
            const texts = [];
            for (const cp of allContacts) {
              const t = (cp.type || "").toLowerCase();
              const v = String(cp.value || "").trim();
              if (t.includes('phone') || t.includes('zalo') || t.includes('whatsapp') || t.includes('mobile')) phones.push(v);
              else if (t.includes('mail')) emails.push(v);
              else socials.push({ type: cp.type, value: v, url: v });
              texts.push(v);
            }
            await sqlTx`
              UPDATE candidates SET
                phones = ${phones}, emails = ${emails}, socials = ${sqlTx.json(socials)}, all_contacts_text = ${texts.join(' | ')}
              WHERE id = ${targetCandidateId}
            `;
          }
        }

        // 3. Handle CV URL strategy & cv_urls history
        const [cand] = await sqlTx`
          SELECT display_number, cv_urls FROM candidates WHERE id = ${targetCandidateId}
        `;
        const existingUrls = Array.isArray(cand?.cv_urls) ? cand.cv_urls : [];
        const seq = existingUrls.length + 1;
        const ext = (payload.original_filename || '').split('.').pop() || 'pdf';
        const finalFileName = `CV_${cand?.display_number || targetCandidateId}_${seq}.${ext}`;

        if (newCvUrl && cvUrlStrategy !== 'IGNORE') {
          const newCvEntry = { url: newCvUrl, filename: finalFileName, added_at: new Date().toISOString() };
          const updatedCvUrls = cvUrlStrategy === 'REPLACE' ? [newCvEntry] : [...existingUrls, newCvEntry];
          
          await sqlTx`
            UPDATE candidates
            SET 
              cv_url = ${newCvUrl},
              cv_urls = ${sqlTx.json(updatedCvUrls)},
              last_updated = NOW()
            WHERE id = ${targetCandidateId}
          `;
        }

        // 4. Trigger rename webhook on n8n (cosmetic, failure is ignored)
        if (process.env.N8N_RENAME_WEBHOOK_URL && payload.drive_file_id) {
          try {
            await fetch(process.env.N8N_RENAME_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ drive_file_id: payload.drive_file_id, new_name: finalFileName })
            });
          } catch (renameErr) {
            console.error('[hitl_actions] Rename webhook error in MERGE (ignored):', renameErr);
          }
        }

        // 5. Mark as Approved
        await sqlTx`
          UPDATE pending_cv_imports
          SET status = 'Approved', resolved_at = NOW(), matched_candidate_id = ${targetCandidateId}
          WHERE id = ${id}
        `;

        return { success: true, candidateId: targetCandidateId };
      }
    });

    revalidatePath('/', 'layout'); // Revalidate the whole layout to update the Notification Bell
    return result || { success: true };
  } catch (error) {
    console.error("Error resolving pending import:", error);
    return { success: false, error: error.message };
  }
}
