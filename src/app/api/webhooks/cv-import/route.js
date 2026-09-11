import { NextResponse } from 'next/server';
import sql from '../../../../lib/db';
import { validatePayload, candidateCreationSchema } from '../../../../lib/validation';

export async function POST(req) {
  try {
    const secret = req.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload = await req.json();
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (e) {}
    }

    // Validate incoming N8N payload
    const { success, data, error } = validatePayload(candidateCreationSchema, payload);
    if (!success) {
      console.error('[cv-import] Validation error:', JSON.stringify(error), 'Payload:', JSON.stringify(payload));
      return NextResponse.json({ error: 'Invalid payload', details: error }, { status: 400 });
    }

    // Prepare list of contact values to check for duplicates
    const checkValues = data.contactPoints.map(cp => cp.value.trim().toLowerCase());
    
    // Check for existing candidates matching ANY of these contact points
    // We group by candidate_id to find out how many unique candidates match
    const matches = await sql`
      SELECT candidate_id, COUNT(*) as match_count
      FROM contact_points
      WHERE LOWER(TRIM(value)) = ANY(${checkValues})
      GROUP BY candidate_id
    `;

    const matchedCandidateIds = matches.map(m => m.candidate_id);

    if (matchedCandidateIds.length === 0) {
      // 0 MATCHES -> NEW CANDIDATE -> AUTO CREATE
      let createdCandidate = null;
      await sql.begin(async (sqlTx) => {
        const ext = (data.original_filename || '').split('.').pop() || 'pdf';
        const initialCvUrls = data.cv_url 
          ? [{ url: data.cv_url, filename: `CV_1.${ext}`, added_at: new Date().toISOString() }] 
          : [];

        // Insert candidate
        const [newCand] = await sqlTx`
          INSERT INTO candidates (full_name, prefix, dob, address, cv_url, cv_urls, notes, created_time, last_updated)
          VALUES (
            ${data.full_name}, 
            ${data.prefix}, 
            ${data.dob || null}, 
            ${data.address}, 
            ${data.cv_url}, 
            ${sql.json(initialCvUrls)}, 
            ${data.notes}, 
            NOW(), 
            NOW()
          )
          RETURNING id, display_number
        `;
        createdCandidate = newCand;

        // Update cv_urls with final filename using the real display_number
        if (data.cv_url) {
          const finalFileName = `CV_${newCand.display_number}_1.${ext}`;
          const finalCvUrls = [{ url: data.cv_url, filename: finalFileName, added_at: new Date().toISOString() }];
          await sqlTx`
            UPDATE candidates
            SET cv_urls = ${sql.json(finalCvUrls)}
            WHERE id = ${newCand.id}
          `;
        }

        console.log('[cv-import] INSERTED new candidate id:', newCand.id, 'display_number:', newCand.display_number, 'name:', data.full_name);

        // Insert contact points
        const contactInserts = data.contactPoints.map(cp => ({
          candidate_id: newCand.id,
          type: cp.type,
          value: cp.value,
          created_time: new Date(),
          last_updated: new Date()
        }));
        if (contactInserts.length > 0) {
          await sqlTx`INSERT INTO contact_points ${sql(contactInserts)}`;

          // Sync denormalized search cache ngay trong cung transaction
          const phones = [], emails = [], socials = [];
          const texts = [];
          for (const cp of contactInserts) {
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

        // If assignToJobId is provided, create Application
        if (data.assignToJobId) {
          await sqlTx`
            INSERT INTO activity (candidate_id, job_id, current_stage, status, source_channel, created_time, last_updated)
            VALUES (${newCand.id}, ${data.assignToJobId}, ${data.initialStage}, 'In progress', ${data.sourceChannel}, NOW(), NOW())
          `;
        }
      });

      return NextResponse.json({ 
        message: 'Candidate created successfully', 
        match_status: 'NEW',
        id: createdCandidate?.id,
        display_number: createdCandidate?.display_number 
      }, { status: 201 });
    }

    // 1 OR MORE MATCHES -> QUEUE FOR HUMAN REVIEW (HITL)
    const matchStatus = matchedCandidateIds.length === 1 ? 'UPDATE' : 'CONFLICT';
    const targetCandidateId = matchedCandidateIds.length === 1 ? matchedCandidateIds[0] : null;

    // Fetch details of all matched candidate(s) for the UI diff & conflict resolution
    let matchedDetails = null;
    if (matchedCandidateIds.length >= 1) {
      const candidatesInfo = await sql`
        SELECT id, full_name, dob, address, notes, cv_url, cv_urls, display_number, blocked, blacklist_note
        FROM candidates WHERE id = ANY(${matchedCandidateIds})
      `;
      const activeApplications = await sql`
        SELECT candidate_id, job_id, status FROM activity
        WHERE candidate_id = ANY(${matchedCandidateIds}) AND status = 'In progress'
      `;
      const withContacts = await Promise.all(candidatesInfo.map(async (c) => {
        const contacts = await sql`SELECT type, value FROM contact_points WHERE candidate_id = ${c.id}`;
        return { ...c, contacts, active_applications: activeApplications.filter(a => a.candidate_id === c.id) };
      }));
      matchedDetails = { candidates: withContacts };
    }

    const [pendingRow] = await sql`
      INSERT INTO pending_cv_imports (payload, match_status, matched_candidate_id, matched_details, status, created_at)
      VALUES (${sql.json(payload)}, ${matchStatus}, ${targetCandidateId}, ${matchedDetails ? sql.json(matchedDetails) : null}, 'Pending', NOW())
      RETURNING id
    `;
    console.log('[cv-import] INSERTED pending_cv_imports id:', pendingRow?.id, 'for target candidate:', targetCandidateId, 'matchStatus:', matchStatus);

    return NextResponse.json({ 
      message: `Duplicate detected. Queued for Human Review.`, 
      match_status: matchStatus,
      matched_candidate_id: targetCandidateId,
      pending_import_id: pendingRow?.id
    }, { status: 202 });

  } catch (err) {
    console.error("Webhook CV Import Error:", err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
