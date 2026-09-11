"use server";

import sql from '../lib/db.js';
import { revalidatePath } from 'next/cache';
import { stripAccents } from '../lib/utils.js';
import { validatePayload, candidateCreationSchema, contactPointItemSchema, clientBranchSchema, jobOrderUpdateSchema, activityLogCreationSchema } from '../lib/validation.js';

// ========================================================
// 1. ACTION MENU FUNCTIONS
// ========================================================

// 1.1 Lấy dữ liệu cho trang Action Menu (Hồ sơ ứng tuyển + Jobs + Clients + Contacts)
export async function getActionMenuData({ 
  searchTerm = "", 
  status = "ALL", 
  client = "ALL", 
  jobId = "ALL", 
  isPassive = "ALL",
  page = 1,
  pageSize = 80,
  sortBy = null,
  sortDir = "desc"
} = {}) {
  try {
    const rawSearch = (searchTerm || "").trim();
    const cleanSearch = rawSearch
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/+$/, "");
    const formattedSearch = cleanSearch ? `%${cleanSearch.toLowerCase()}%` : null;

    const filterJob = jobId && jobId !== "ALL" ? jobId : null;
    const filterStatus = status && status !== "ALL" ? status : null;
    const filterClient = client && client !== "ALL" ? client : null;
    const filterPassive = isPassive === "ALL" 
      ? null 
      : isPassive === "SOURCING" 
      ? true 
      : isPassive === "APPLY" 
      ? false 
      : null;

    const offset = Math.max(0, (page - 1) * pageSize);

    const [countRes, data] = await Promise.all([
      sql`
        SELECT COUNT(*)::int AS total
        FROM activity app
        LEFT JOIN candidates c ON app.candidate_id = c.id
        LEFT JOIN jobs j ON app.job_id = j.id
        LEFT JOIN clients cl ON j.client_id = cl.id
        WHERE 
          (${filterJob}::uuid IS NULL OR app.job_id = ${filterJob})
          AND (${filterStatus}::text IS NULL OR app.status::text = ${filterStatus})
          AND (${filterClient}::text IS NULL OR cl.name = ${filterClient})
          AND (${filterPassive}::boolean IS NULL OR app.is_passive = ${filterPassive})
          AND (
            ${formattedSearch}::text IS NULL 
            OR unaccent(LOWER(c.full_name)) LIKE unaccent(${formattedSearch})
            OR c.display_number::text LIKE ${formattedSearch}
            OR app.display_number::text LIKE ${formattedSearch}
            OR unaccent(LOWER(COALESCE(j.job_title, ''))) LIKE unaccent(${formattedSearch})
            OR unaccent(LOWER(COALESCE(cl.name, ''))) LIKE unaccent(${formattedSearch})
            OR unaccent(LOWER(COALESCE(app.note, ''))) LIKE unaccent(${formattedSearch})
            OR unaccent(LOWER(COALESCE(c.all_contacts_text, ''))) LIKE unaccent(${formattedSearch})
          )
      `,
      sql`
        SELECT 
          app.id AS application_id,
          app.candidate_id,
          app.job_id,
          app.display_number AS app_display_number,
          'ACT-' || LPAD(COALESCE(app.display_number, 0)::text, 4, '0') AS display_id,
          app.status,
          app.current_stage,
          app.result,
          app.reason_failed,
          app.note_failure_reason,
          app.priority,
          app.source_channel,
          app.acquisition_type,
          app.is_passive,
          TO_CHAR(app.planning_date, 'YYYY-MM-DD') AS planning_date,
          app.note AS application_note,
          app.created_time AS application_created,
          c.full_name AS candidate_name,
          c.display_number AS candidate_number,
          c.cv_url,
          c.blocked,
          c.blacklist_note,
          j.job_title AS order_name,
          j.display_number AS job_display_number,
          cl.name AS client_name,
          cl.id AS client_id
        FROM activity app
        LEFT JOIN candidates c ON app.candidate_id = c.id
        LEFT JOIN jobs j ON app.job_id = j.id
        LEFT JOIN clients cl ON j.client_id = cl.id
        WHERE 
          (${filterJob}::uuid IS NULL OR app.job_id = ${filterJob})
          AND (${filterStatus}::text IS NULL OR app.status::text = ${filterStatus})
          AND (${filterClient}::text IS NULL OR cl.name = ${filterClient})
          AND (${filterPassive}::boolean IS NULL OR app.is_passive = ${filterPassive})
          AND (
            ${formattedSearch}::text IS NULL 
            OR unaccent(LOWER(c.full_name)) LIKE unaccent(${formattedSearch})
            OR c.display_number::text LIKE ${formattedSearch}
            OR app.display_number::text LIKE ${formattedSearch}
            OR unaccent(LOWER(COALESCE(j.job_title, ''))) LIKE unaccent(${formattedSearch})
            OR unaccent(LOWER(COALESCE(cl.name, ''))) LIKE unaccent(${formattedSearch})
            OR unaccent(LOWER(COALESCE(app.note, ''))) LIKE unaccent(${formattedSearch})
            OR unaccent(LOWER(COALESCE(c.all_contacts_text, ''))) LIKE unaccent(${formattedSearch})
          )
        ORDER BY ${
          sortBy === 'planning_date'
            ? (sortDir === 'asc' ? sql`app.planning_date ASC NULLS LAST, app.display_number DESC NULLS LAST` : sql`app.planning_date DESC NULLS LAST, app.display_number DESC NULLS LAST`)
            : sql`app.display_number DESC NULLS LAST, app.created_time DESC`
        }
        LIMIT ${pageSize} OFFSET ${offset}
      `
    ]);

    const totalCount = countRes[0]?.total || 0;

    const serialized = data.map(row => ({
      ...row,
      application_note: row.application_note ? row.application_note.replace(/<(br|br\/|\/p|\/div)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : '',
      planning_date: row.planning_date || null,
      application_created: row.application_created ? new Date(row.application_created).toISOString() : null,
    }));

    return { success: true, data: serialized, totalCount, page, pageSize };
  } catch (error) {
    console.error("Error fetching action menu data:", error);
    return { success: false, error: error.message, data: [], totalCount: 0 };
  }
}

// 1.2 Lấy danh sách Activity Logs (Action Notes) theo application_id
export async function getActivityLogs(applicationId) {
  if (!applicationId) return { success: true, data: [] };
  try {
    const data = await sql`
      SELECT 
        id, application_id, action_type, note, result, reason_failed, action_date, created_time
      FROM activity_log
      WHERE application_id = ${applicationId}
      ORDER BY action_date DESC, created_time DESC
    `;
    const sanitized = data.map(row => ({
      ...row,
      note: row.note ? row.note.replace(/<(br|br\/|\/p|\/div)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : ''
    }));
    return { success: true, data: JSON.parse(JSON.stringify(sanitized)) };
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    return { success: false, error: error.message };
  }
}

// 1.3 Cập nhật nhanh thông tin dòng Action / Activity
export async function updateApplicationAction(applicationId, updateData) {
  if (!applicationId) return { success: false, error: "Thiếu mã Application ID" };
  try {
    const { status, planning_date, note, current_stage, source_channel, is_passive, result, reason_failed, note_failure_reason } = updateData;
    const parsedPlanningDate = planning_date !== undefined ? (planning_date ? new Date(planning_date) : null) : undefined;
    
    const [appCheck] = await sql`SELECT status FROM activity WHERE id = ${applicationId}`;
    const isReopening = updateData.status && updateData.status !== 'Closed';
    if (appCheck && appCheck.status === 'Closed' && !isReopening && !updateData.status) {
        return { success: false, error: "Không thể chỉnh sửa hồ sơ đang bị khóa (Closed)" };
    }

    await sql`
      UPDATE activity
      SET 
        status = ${status !== undefined ? status : sql`status`},
        planning_date = ${parsedPlanningDate !== undefined ? parsedPlanningDate : sql`planning_date`},
        note = ${note !== undefined ? note : sql`note`},
        current_stage = ${current_stage !== undefined ? current_stage : sql`current_stage`},
        source_channel = ${source_channel !== undefined ? source_channel : sql`source_channel`},
        is_passive = ${is_passive !== undefined ? is_passive : sql`is_passive`},
        result = ${result !== undefined ? result : sql`result`},
        reason_failed = ${reason_failed !== undefined ? reason_failed : sql`reason_failed`},
        note_failure_reason = ${note_failure_reason !== undefined ? note_failure_reason : sql`note_failure_reason`},
        last_updated = NOW()
      WHERE id = ${applicationId}
    `;

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error("Error updating application action:", error);
    return { success: false, error: error.message };
  }
}

// 1.3.1 Cập nhật ghi chú lớn của Application
export async function updateApplicationNote(applicationId, note) {
  return updateApplicationAction(applicationId, { note });
}

// 1.4 Thêm Action Note / Activity Log mới (Hỗ trợ cả Object lẫn Positional Arguments)
export async function addActivityLog(logDataOrAppId, maybeStage, maybeNote, maybeResult) {
  let application_id, action_type, note, result, reason_failed, action_date;

  if (typeof logDataOrAppId === 'object' && logDataOrAppId !== null) {
    application_id = logDataOrAppId.application_id || logDataOrAppId.applicationId;
    action_type = logDataOrAppId.action_type || logDataOrAppId.actionType;
    note = logDataOrAppId.note;
    result = logDataOrAppId.result;
    reason_failed = logDataOrAppId.reason_failed;
    action_date = logDataOrAppId.action_date || logDataOrAppId.actionDate;
  } else {
    application_id = logDataOrAppId;
    action_type = maybeStage;
    note = maybeNote;
    result = maybeResult;
  }

  if (!application_id) return { success: false, error: "Missing Application ID" };

  try {
    const parsedActionDate = action_date ? new Date(action_date) : new Date();
    const finalResult = result || 'Pass';
    const finalReasonFailed = finalResult === 'Fail' ? (reason_failed || null) : null;

    if (application_id) {
        const [appCheck] = await sql`SELECT status FROM activity WHERE id = ${application_id}`;
        if (appCheck && appCheck.status === 'Closed') {
            return { success: false, error: "Không thể chỉnh sửa hồ sơ đang bị khóa (Closed)" };
        }
    }

    const inserted = await sql.begin(async (tx) => {
      const [insertedLog] = await tx`
        INSERT INTO activity_log (
          id, application_id, action_type, note, result, reason_failed, action_date, created_time
        ) VALUES (
          gen_random_uuid(), ${application_id}, ${action_type || 'Contact'}, ${note || ''}, ${finalResult}, ${finalReasonFailed}, ${parsedActionDate}, NOW()
        )
        RETURNING *
      `;

      if (action_type) {
        // Đồng bộ current_stage (như cũ) + Result/Reason cấp Application từ chính log vừa thêm
        // (log mới nhất luôn là log vừa insert vì action_date mặc định = NOW() trừ khi user chọn ngày quá khứ —
        //  giữ đúng hành vi hiện tại của current_stage, không thêm logic "tìm lại log mới nhất" ở đây)
        await tx`
          UPDATE activity
          SET
            current_stage = ${action_type},
            result = ${finalResult === 'Fail' ? 'Failed' : 'Passed'},
            reason_failed = ${finalReasonFailed},
            note_failure_reason = ${finalResult === 'Fail' ? (note || null) : null},
            last_updated = NOW()
          WHERE id = ${application_id}
        `;
      }
      return insertedLog;
    });

    revalidatePath('/');
    revalidatePath('/candidates');
    revalidatePath('/jobs');
    return { success: true, data: JSON.parse(JSON.stringify(inserted)) };
  } catch (error) {
    console.error("Error adding activity log:", error);
    return { success: false, error: error.message };
  }
}

// 1.5 Cập nhật một dòng Action Note / Activity Log
export async function updateActivityLog(logId, applicationId, logData) {
  if (!logId) return { success: false, error: "Missing Log ID" };
  try {
    const { action_type, note, action_date, result, reason_failed } = logData;
    const parsedActionDate = action_date ? new Date(action_date) : undefined;
    const finalReasonFailed = result === 'Fail' ? (reason_failed !== undefined ? reason_failed : sql`reason_failed`) : (result === 'Pass' ? null : (reason_failed !== undefined ? reason_failed : sql`reason_failed`));

    await sql.begin(async (tx) => {
      await tx`
        UPDATE activity_log
        SET
          action_type = ${action_type !== undefined ? action_type : sql`action_type`},
          note = ${note !== undefined ? note : sql`note`},
          action_date = ${parsedActionDate !== undefined ? parsedActionDate : sql`action_date`},
          result = ${result !== undefined ? result : sql`result`},
          reason_failed = ${finalReasonFailed}
        WHERE id = ${logId}
      `;

      if (applicationId) {
        const latest = await tx`
          SELECT action_type, note, result, reason_failed FROM activity_log
          WHERE application_id = ${applicationId}
          ORDER BY action_date DESC, created_time DESC
          LIMIT 1
        `;
        if (latest.length > 0) {
          const l = latest[0];
          await tx`
            UPDATE activity
            SET
              current_stage = ${l.action_type},
              result = ${l.result === 'Fail' ? 'Failed' : 'Passed'},
              reason_failed = ${l.result === 'Fail' ? l.reason_failed : null},
              note_failure_reason = ${l.result === 'Fail' ? l.note : null},
              last_updated = NOW()
            WHERE id = ${applicationId}
          `;
        }
      }
    });

    revalidatePath('/');
    revalidatePath('/candidates');
    revalidatePath('/jobs');
    return { success: true };
  } catch (error) {
    console.error("Error updating activity log:", error);
    return { success: false, error: error.message };
  }
}

// 1.6 Xóa một dòng Action Note / Activity Log
export async function deleteActivityLog(logId, applicationId) {
  if (!logId) return { success: false, error: "Missing Log ID" };
  try {
    if (applicationId) {
        const [appCheck] = await sql`SELECT status FROM activity WHERE id = ${applicationId}`;
        if (appCheck && appCheck.status === 'Closed') {
            return { success: false, error: "Không thể chỉnh sửa hồ sơ đang bị khóa (Closed)" };
        }
    }
    await sql`DELETE FROM activity_log WHERE id = ${logId}`;

    // Cập nhật lại current_stage và result/reason về bước mới nhất còn lại
    if (applicationId) {
      const remaining = await sql`
        SELECT action_type, note, result, reason_failed FROM activity_log
        WHERE application_id = ${applicationId}
        ORDER BY action_date DESC, created_time DESC
        LIMIT 1
      `;
      if (remaining.length > 0) {
        const l = remaining[0];
        await sql`
          UPDATE activity
          SET
            current_stage = ${l.action_type || 'Talent Mapping'},
            result = ${l.result === 'Fail' ? 'Failed' : 'Passed'},
            reason_failed = ${l.result === 'Fail' ? l.reason_failed : null},
            note_failure_reason = ${l.result === 'Fail' ? l.note : null},
            last_updated = NOW()
          WHERE id = ${applicationId}
        `;
      } else {
        await sql`
          UPDATE activity
          SET
            current_stage = 'Talent Mapping',
            result = NULL,
            reason_failed = NULL,
            note_failure_reason = NULL,
            last_updated = NOW()
          WHERE id = ${applicationId}
        `;
      }
    }

    revalidatePath('/');
    revalidatePath('/candidates');
    revalidatePath('/jobs');
    return { success: true };
  } catch (error) {
    console.error("Error deleting activity log:", error);
    return { success: false, error: error.message };
  }
}

// ========================================================
// 2. CANDIDATE PROFILE & MENU FUNCTIONS
// ========================================================

/**
 * Retrieves comprehensive 360° candidate profile data, including personal info,
 * contact points, application pipeline with job orders, and switcher navigation metadata.
 * 
 * If candidateId is null/omitted, automatically fetches the latest candidate in database.
 * 
 * @async
 * @param {string} [candidateId] - Optional Candidate UUID.
 * @returns {Promise<{
 *   success: boolean,
 *   data?: {
 *     candidate: Object,
 *     contacts: Array<Object>,
 *     applications: Array<Object>,
 *     totalCount: number,
 *     currentIndex: number,
 *     prevCandidateId: string | null,
 *     nextCandidateId: string | null,
 *     switcherList: Array<Object>
 *   },
 *   error?: string
 * }>}
 */
export async function getCandidateProfile(candidateId = null) {
  try {
    let targetId = candidateId;

    // 1. If no candidateId provided, fetch latest candidate by display_number
    if (!targetId) {
      const [latest] = await sql`
        SELECT id FROM candidates 
        ORDER BY display_number DESC NULLS LAST, created_time DESC 
        LIMIT 1
      `;
      if (!latest) {
        return { success: false, error: "No candidates found in database." };
      }
      targetId = latest.id;
    }

    // 2. Fetch candidate profile, contacts, applications, and count in parallel
    const [candidates, contacts, applications, countRow] = await Promise.all([
      sql`
        SELECT 
          id, display_number, full_name, prefix, 
          TO_CHAR(dob, 'YYYY-MM-DD') AS dob, 
          address, source, cv_url, cv_urls, blocked, blacklist_note, notes, 
          TO_CHAR(created_time, 'YYYY-MM-DD HH24:MI') AS created_time 
        FROM candidates WHERE id = ${targetId} LIMIT 1
      `,
      sql`
        SELECT id, type, value, TO_CHAR(created_time, 'YYYY-MM-DD HH24:MI') AS created_time 
        FROM contact_points 
        WHERE candidate_id = ${targetId} 
        ORDER BY created_time ASC
      `,
      sql`
        SELECT 
          app.id AS application_id, app.job_id, app.current_stage, app.status, app.result, app.reason_failed, app.note_failure_reason,
          TO_CHAR(app.planning_date, 'YYYY-MM-DD') AS planning_date, 
          app.note, 
          TO_CHAR(app.created_time, 'YYYY-MM-DD HH24:MI') AS created_time, 
          app.display_number,
          app.source_channel, app.acquisition_type, j.job_title, cl.name AS client_name
        FROM activity app
        LEFT JOIN jobs j ON app.job_id = j.id
        LEFT JOIN clients cl ON j.client_id = cl.id
        WHERE app.candidate_id = ${targetId}
        ORDER BY app.created_time DESC
      `,
      sql`SELECT COUNT(*)::int AS total FROM candidates`
    ]);

    if (candidates.length === 0) return { success: false, error: "Candidate not found." };

    const currentCandidate = candidates[0];
    const totalCount = countRow[0]?.total || 0;
    const currentNum = currentCandidate.display_number || 0;

    // 3. Fast Server-side Previous / Next navigation lookup
    const [prevRow, nextRow, rankRow] = await Promise.all([
      sql`
        SELECT id FROM candidates 
        WHERE display_number > ${currentNum}
        ORDER BY display_number ASC NULLS LAST
        LIMIT 1
      `,
      sql`
        SELECT id FROM candidates 
        WHERE display_number < ${currentNum}
        ORDER BY display_number DESC NULLS LAST
        LIMIT 1
      `,
      sql`
        SELECT COUNT(*)::int AS rank 
        FROM candidates 
        WHERE display_number >= ${currentNum}
      `
    ]);

    const prevCandidateId = prevRow[0]?.id || null;
    const nextCandidateId = nextRow[0]?.id || null;
    const currentIndex = rankRow[0]?.rank || 1;

    return {
      success: true,
      data: {
        candidate: currentCandidate,
        contacts: contacts,
        applications: applications,
        totalCount,
        currentIndex,
        prevCandidateId,
        nextCandidateId
      }
    };
  } catch (error) {
    console.error("Error fetching candidate profile:", error);
    return { success: false, error: error.message };
  }
}

// 2.1.1 Tìm kiếm ứng viên 100% Server-Side trên PostgreSQL (Bảo mật & Không dump dữ liệu về Client)
export async function searchCandidatesServer({ query = "", limit = 50, offset = 0 } = {}) {
  try {
    const rawSearch = (query || "").trim();
    const cleanSearch = rawSearch
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/+$/, "");
    const formattedSearch = cleanSearch ? `%${cleanSearch.toLowerCase()}%` : null;

    const [countRes, data] = await Promise.all([
      sql`
        SELECT COUNT(*)::int AS total
        FROM candidates c
        WHERE (${formattedSearch}::text IS NULL 
               OR unaccent(LOWER(c.full_name)) LIKE unaccent(${formattedSearch}) 
               OR c.display_number::text LIKE ${formattedSearch} 
               OR unaccent(LOWER(c.all_contacts_text)) LIKE unaccent(${formattedSearch})
               OR unaccent(LOWER(COALESCE(c.blacklist_note, ''))) LIKE unaccent(${formattedSearch}))
      `,
      sql`
        SELECT 
          c.id,
          c.display_number,
          COALESCE(c.prefix, 'Mr/Ms') AS prefix,
          c.full_name,
          c.blocked,
          c.blacklist_note,
          COALESCE(c.phones, ARRAY[]::text[]) AS phones,
          COALESCE(c.emails, ARRAY[]::text[]) AS emails,
          COALESCE(c.all_contacts_text, '') AS all_contacts_text,
          c.cv_url
        FROM candidates c
        WHERE (${formattedSearch}::text IS NULL 
               OR unaccent(LOWER(c.full_name)) LIKE unaccent(${formattedSearch}) 
               OR c.display_number::text LIKE ${formattedSearch} 
               OR unaccent(LOWER(c.all_contacts_text)) LIKE unaccent(${formattedSearch})
               OR unaccent(LOWER(COALESCE(c.blacklist_note, ''))) LIKE unaccent(${formattedSearch}))
        ORDER BY c.display_number DESC NULLS LAST, c.created_time DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    ]);

    const totalCount = countRes[0]?.total || 0;
    return { 
      success: true, 
      data: JSON.parse(JSON.stringify(data)), 
      totalCount 
    };
  } catch (error) {
    console.error("Error in searchCandidatesServer:", error);
    return { success: false, error: error.message, data: [], totalCount: 0 };
  }
}

// 2.1.2 Tương thích ngược: Lấy danh sách tóm tắt (Server-side limited)
export async function getCandidateSwitcherList(limit = 50) {
  return searchCandidatesServer({ query: "", limit });
}

// Helper: Đồng bộ danh sách liên hệ vào các trường gom sẵn trên bảng candidates
async function syncCandidateAggregatedContacts(candidateId) {
  if (!candidateId) return;
  try {
    const contacts = await sql`SELECT type, value FROM contact_points WHERE candidate_id = ${candidateId}`;
    const phones = [];
    const emails = [];
    const socials = [];
    const allTexts = [];

    for (const c of contacts) {
      const val = (c.value || '').trim();
      if (!val) continue;
      allTexts.push(val);
      const t = (c.type || '').toLowerCase();
      if (t.includes('phone') || t.includes('tel') || t.includes('mobile')) {
        phones.push(val);
      } else if (t.includes('email') || t.includes('mail')) {
        emails.push(val);
      } else {
        socials.push({ type: c.type, value: val });
      }
    }

    await sql`
      UPDATE candidates
      SET
        phones = ${phones}::text[],
        emails = ${emails}::text[],
        socials = ${JSON.stringify(socials)}::jsonb,
        all_contacts_text = ${allTexts.join(' ')},
        last_updated = NOW()
      WHERE id = ${candidateId}
    `;
  } catch (err) {
    console.error("Error syncing aggregated contacts:", err);
  }
}

// 2.2 Cập nhật thông tin ứng viên từ Candidate Menu
export async function updateCandidateProfile(candidateId, updateData) {
  if (!candidateId) return { success: false, error: "Thiếu ID ứng viên" };
  try {
    const { full_name, prefix, dob, address, source, cv_url, blocked, blacklist_note, notes } = updateData;

    // Fetch current candidate cv_url and cv_urls to preserve version history
    const [currentCand] = await sql`
      SELECT display_number, cv_url, cv_urls FROM candidates WHERE id = ${candidateId}
    `;

    let finalCvUrls = currentCand?.cv_urls;
    const oldCvUrl = currentCand?.cv_url || '';
    const newCvUrl = cv_url || '';

    // Auto-append: when user manually edits cv_url field with a new value, preserve old and append new
    if (newCvUrl && newCvUrl !== oldCvUrl) {
      const existingUrls = Array.isArray(currentCand?.cv_urls) ? [...currentCand.cv_urls] : [];
      // If oldCvUrl exists and is not already in existingUrls, ensure it is recorded as previous version
      if (oldCvUrl && !existingUrls.some(entry => entry.url === oldCvUrl)) {
        const oldSeq = existingUrls.length + 1;
        existingUrls.push({
          url: oldCvUrl,
          filename: `CV_${currentCand?.display_number || candidateId}_${oldSeq}.pdf`,
          added_at: new Date().toISOString()
        });
      }
      // Add newCvUrl as the latest version in cv_urls
      const newSeq = existingUrls.length + 1;
      existingUrls.push({
        url: newCvUrl,
        filename: `CV_${currentCand?.display_number || candidateId}_${newSeq}.pdf`,
        added_at: new Date().toISOString()
      });
      finalCvUrls = existingUrls;
    }

    await sql`
      UPDATE candidates
      SET 
        full_name = ${full_name},
        prefix = ${prefix || 'Mr'},
        dob = ${dob || null},
        address = ${address || ''},
        source = ${source || ''}, 
        cv_url = ${newCvUrl},
        cv_urls = ${finalCvUrls ? sql.json(finalCvUrls) : null},
        blocked = ${Boolean(blocked)},
        blacklist_note = ${blacklist_note || ''},
        notes = ${notes || ''},
        last_updated = NOW()
      WHERE id = ${candidateId}
    `;
    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath('/candidates');
    revalidatePath('/');
    return { success: true, cv_urls: finalCvUrls };
  } catch (error) {
    console.error("Error updating candidate profile:", error);
    return { success: false, error: error.message };
  }
}

// 2.2.1 Thêm phiên bản CV mới cho ứng viên (Append CV Versioning)
export async function appendCvVersion({ candidateId, cvUrl, originalFilename = '' }) {
  if (!candidateId || !cvUrl) return { success: false, error: "Missing candidate ID or CV URL" };
  try {
    const [cand] = await sql`
      SELECT display_number, cv_url, cv_urls FROM candidates WHERE id = ${candidateId}
    `;
    if (!cand) return { success: false, error: "Candidate not found" };

    const existingUrls = Array.isArray(cand.cv_urls) ? [...cand.cv_urls] : [];
    const oldCvUrl = cand.cv_url || '';

    // If candidate has an old cv_url that was never added to cv_urls array, preserve it
    if (oldCvUrl && !existingUrls.some(entry => entry.url === oldCvUrl)) {
      const oldSeq = existingUrls.length + 1;
      existingUrls.push({
        url: oldCvUrl,
        filename: `CV_${cand.display_number || candidateId}_${oldSeq}.pdf`,
        added_at: new Date().toISOString()
      });
    }

    const seq = existingUrls.length + 1;
    const ext = (originalFilename || '').split('.').pop() || 'pdf';
    const finalFileName = `CV_${cand.display_number || candidateId}_${seq}.${ext}`;

    const newEntry = {
      url: cvUrl,
      filename: finalFileName,
      added_at: new Date().toISOString()
    };
    const updatedCvUrls = [...existingUrls, newEntry];

    await sql`
      UPDATE candidates
      SET 
        cv_url = ${cvUrl},
        cv_urls = ${sql.json(updatedCvUrls)},
        last_updated = NOW()
      WHERE id = ${candidateId}
    `;

    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath('/candidates');
    revalidatePath('/');
    return { 
      success: true, 
      data: { 
        cv_url: cvUrl, 
        cv_urls: updatedCvUrls 
      } 
    };
  } catch (error) {
    console.error("Error appending CV version:", error);
    return { success: false, error: error.message };
  }
}

// 2.3 Thêm contact point cho ứng viên
export async function addContactPoint(candidateId, type, value) {
  if (!candidateId || !type || !value) return { success: false, error: "Dữ liệu không đầy đủ" };
  try {
    const normalized = normalizeContactValue(type, value);
    if (!normalized) return { success: false, error: "Contact value is invalid" };

    await sql.begin(async (tx) => {
      // 1. Strict Duplicate Check on DB using transaction
      const dups = await tx`
        SELECT cp.id
        FROM contact_points cp
        WHERE cp.candidate_id != ${candidateId} 
          AND cp.type ILIKE ${'%' + type + '%'} 
          AND LOWER(TRIM(cp.value)) = ${normalized}
        LIMIT 1
      `;
      
      if (dups.length > 0) {
        throw new Error(`Duplicate Contact Detected: This contact is already associated with another candidate.`);
      }

      await tx`
        INSERT INTO contact_points (id, candidate_id, type, value, created_time)
          VALUES (gen_random_uuid(), ${candidateId}, ${type}, ${normalized}, NOW())
      `;
      
      // Sync logic manually inside Tx
      const allContacts = await tx`SELECT type, value FROM contact_points WHERE candidate_id = ${candidateId}`;
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
      await tx`
        UPDATE candidates SET
          phones = ${phones}, emails = ${emails}, socials = ${tx.json(socials)}, all_contacts_text = ${texts.join(' | ')}
        WHERE id = ${candidateId}
      `;
    });

    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath('/candidates');
    return { success: true };
  } catch (error) {
    console.error("Error adding contact point:", error);
    return { success: false, error: error.message };
  }
}

// 2.4 Cập nhật contact point của ứng viên
export async function updateContactPoint(contactId, candidateId, type, value) {
  if (!contactId || !type || !value) return { success: false, error: "Dữ liệu không đầy đủ" };
  try {
    const normalized = normalizeContactValue(type, value);
    if (!normalized) return { success: false, error: "Contact value is invalid" };

    await sql.begin(async (tx) => {
      if (candidateId) {
        const dups = await tx`
          SELECT cp.id
          FROM contact_points cp
          WHERE cp.candidate_id != ${candidateId} 
            AND cp.id != ${contactId}
            AND cp.type ILIKE ${'%' + type + '%'} 
            AND LOWER(TRIM(cp.value)) = ${normalized}
          LIMIT 1
        `;
        
        if (dups.length > 0) {
          throw new Error(`Duplicate Contact Detected: This contact is already associated with another candidate.`);
        }
      }

      await tx`
        UPDATE contact_points
          SET type = ${type}, value = ${normalized}
        WHERE id = ${contactId}
      `;
      
      if (candidateId) {
        const allContacts = await tx`SELECT type, value FROM contact_points WHERE candidate_id = ${candidateId}`;
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
        await tx`
          UPDATE candidates SET
            phones = ${phones}, emails = ${emails}, socials = ${tx.json(socials)}, all_contacts_text = ${texts.join(' | ')}
          WHERE id = ${candidateId}
        `;
      }
    });

    if (candidateId) {
      revalidatePath(`/candidates/${candidateId}`);
    }
    revalidatePath('/candidates');
    return { success: true };
  } catch (error) {
    console.error("Error updating contact point:", error);
    return { success: false, error: error.message };
  }
}

// 2.5 Xóa contact point của ứng viên
export async function deleteContactPoint(contactId, candidateId) {
  if (!contactId) return { success: false, error: "Thiếu Contact ID" };
  try {
    await sql`DELETE FROM contact_points WHERE id = ${contactId}`;
    if (candidateId) {
      await syncCandidateAggregatedContacts(candidateId);
      revalidatePath(`/candidates/${candidateId}`);
    }
    revalidatePath('/candidates');
    return { success: true };
  } catch (error) {
    console.error("Error deleting contact point:", error);
    return { success: false, error: error.message };
  }
}

// 2.6 Gán ứng viên vào một Job Order mới (Tạo Application / Activity)
export async function assignCandidateToJob({ candidateId, jobId, sourceChannel = "Direct Sourcing", note = "", initialStage = "Talent Mapping", isPassive = true, planningDate = null }, sqlTx = sql) {
  if (!candidateId || !jobId) return { success: false, error: "Vui lòng chọn ứng viên và vị trí tuyển dụng" };
  try {
    const doAssign = async (tx) => {
      // 1. Kiểm tra Blacklist candidate
      const [cand] = await tx`SELECT blocked FROM candidates WHERE id = ${candidateId}`;
      if (!cand) throw new Error("Ứng viên không tồn tại");
      if (cand.blocked) throw new Error("Ứng viên này đang trong danh sách đen (Blacklisted)");

      // 2. Kiểm tra Duplicate application
      const [targetJob] = await tx`SELECT status, job_title FROM jobs WHERE id = ${jobId}`;
        if (targetJob && (targetJob.status === 'Closed' || targetJob.status === 'Filled' || targetJob.status === 'On Hold')) {
            throw new Error(`Vị trí tuyển dụng "${targetJob.job_title}" hiện đang ở trạng thái ${targetJob.status} và không nhận thêm ứng viên.`);
        }
        
        const [existingApp] = await tx`
        SELECT id, status FROM activity 
        WHERE candidate_id = ${candidateId} AND job_id = ${jobId}
      `;
      if (existingApp) {
        if (existingApp.status === 'Closed' || existingApp.status === 'Cancelled') {
          throw new Error("Ứng viên này đã từng ứng tuyển vào vị trí này và hiện đang bị đóng hồ sơ. Vui lòng kiểm tra lại.");
        }
        throw new Error("Ứng viên đã được gán vào vị trí này và hiện đang ở trong pipeline.");
      }

      const [newApp] = await tx`
        INSERT INTO activity (
            id, candidate_id, job_id, status, current_stage, result, priority,
            source_channel, note, is_passive, planning_date, summary, created_time, last_updated
          ) VALUES (
            gen_random_uuid(), ${candidateId}, ${jobId}, 'In progress', ${initialStage}, 'Pending', 1,
            ${sourceChannel}, ${note}, ${isPassive}, COALESCE(${planningDate ? planningDate : null}::date, CURRENT_DATE), '', NOW(), NOW()
          )
        RETURNING *
      `;

      await tx`
        INSERT INTO activity_log (
          id, application_id, action_type, note, result, action_date, created_time
        ) VALUES (
          gen_random_uuid(), ${newApp.id}, ${initialStage}, ${note || 'Assigned to Job Order pipeline'}, 'Pass', NOW(), NOW()
        )
      `;
      return newApp;
    };

    let newApp;
    if (sqlTx === sql) {
      newApp = await sql.begin(doAssign);
    } else {
      newApp = await doAssign(sqlTx);
    }

    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath('/');
    revalidatePath('/jobs');
    revalidatePath('/search');
    return { success: true, data: JSON.parse(JSON.stringify(newApp)) };
  } catch (error) {
    console.error("Error assigning candidate to job:", error);
    return { success: false, error: error.message };
  }
}

// 2.7 Helper chuẩn hóa giá trị contact point để kiểm tra trùng lặp
function normalizeContactValue(type, rawValue) {
  if (!rawValue) return "";
  const t = (type || "").toLowerCase().trim();
  const val = String(rawValue).trim();
  
  if (t.includes("email") || t.includes("mail")) {
    return val.toLowerCase();
  }
  
  if (t.includes("phone") || t.includes("tel") || t.includes("mobile") || t.includes("call")) {
      let digits = val.replace(/[^\d+]/g, "");
      if (digits.startsWith("0")) {
        digits = "+84" + digits.slice(1);
      } else if (!digits.startsWith("+")) {
        digits = "+84" + digits;
      }
      const digitCount = digits.replace(/\D/g, "").length; // đếm chữ số thật, bỏ dấu +
      if (digitCount < 8 || digitCount > 12) {
        return ""; 
      }
      return digits;
    }
  
  // URLs (LinkedIn, Facebook, Github, Website, etc.)
  let cleanUrl = val
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  
  return cleanUrl;
}

// 2.8 Kiểm tra trùng lặp contact points trên toàn bộ Database
export async function checkCandidateContactDuplicate(contactPoints, currentCandidateId = null, sqlClient = sql) {
  if (!contactPoints || !Array.isArray(contactPoints) || contactPoints.length === 0) {
    return { success: true, hasDuplicate: false, duplicates: [] };
  }

  try {
    const duplicates = [];

    for (const cp of contactPoints) {
      const rawVal = (cp.value || "").trim();
      if (!rawVal) continue;
      const type = cp.type || "Contact";
      const normalized = normalizeContactValue(type, rawVal);
      if (!normalized) continue;

      const searchPattern = `%${normalized}%`;
      const rawPattern = `%${rawVal.toLowerCase()}%`;

      const matches = await sqlClient`
        SELECT 
          cp.id AS contact_id,
          cp.type AS matched_type,
          cp.value AS matched_value,
          c.id AS candidate_id,
          c.display_number,
          c.full_name,
          c.cv_url,
          c.blocked,
          c.blacklist_note
        FROM contact_points cp
        JOIN candidates c ON cp.candidate_id = c.id
        WHERE 
          (${currentCandidateId}::uuid IS NULL OR cp.candidate_id != ${currentCandidateId})
          AND (
            LOWER(TRIM(cp.value)) = LOWER(${rawVal})
            OR LOWER(REPLACE(REPLACE(REPLACE(REPLACE(cp.value, ' ', ''), '-', ''), '.', ''), '(', '')) LIKE ${searchPattern}
            OR LOWER(cp.value) LIKE ${searchPattern}
            OR LOWER(cp.value) LIKE ${rawPattern}
          )
        LIMIT 5
      `;

      if (matches.length > 0) {
        duplicates.push({
          type: cp.type,
          value: rawVal,
          normalized,
          matchedCandidate: {
            id: matches[0].candidate_id,
            display_number: matches[0].display_number,
            full_name: matches[0].full_name,
            matchedType: matches[0].matched_type,
            matchedValue: matches[0].matched_value,
            blocked: matches[0].blocked,
            blacklist_note: matches[0].blacklist_note
          }
        });
      } else {
        const candidateMatches = await sql`
          SELECT 
            id AS candidate_id,
            display_number,
            full_name,
            cv_url,
            blocked,
            blacklist_note
          FROM candidates
          WHERE 
            (${currentCandidateId}::uuid IS NULL OR id != ${currentCandidateId})
            AND (
              unaccent(LOWER(all_contacts_text)) LIKE unaccent(${searchPattern})
              OR unaccent(LOWER(cv_url)) LIKE unaccent(${searchPattern})
            )
          LIMIT 1
        `;

        if (candidateMatches.length > 0) {
          duplicates.push({
            type: cp.type,
            value: rawVal,
            normalized,
            matchedCandidate: {
              id: candidateMatches[0].candidate_id,
              display_number: candidateMatches[0].display_number,
              full_name: candidateMatches[0].full_name,
              matchedType: "Candidate Record",
              matchedValue: rawVal,
              blocked: candidateMatches[0].blocked,
              blacklist_note: candidateMatches[0].blacklist_note
            }
          });
        }
      }
    }

    return {
      success: true,
      hasDuplicate: duplicates.length > 0,
      duplicates
    };
  } catch (error) {
    console.error("Error checking candidate duplicate:", error);
    return { success: false, error: error.message, hasDuplicate: false, duplicates: [] };
  }
}

// 2.9 Tạo hồ sơ ứng viên mới với kiểm soát chống trùng 100%
export async function createCandidateWithStrictValidation(payload) {
  // Use Zod schema validation
  const validation = validatePayload(candidateCreationSchema, payload);
  if (!validation.success) {
    return { success: false, error: validation.error };
  }
  const {
    full_name, prefix, dob, address, cv_url, notes, contactPoints,
    assignToJobId, initialStage, sourceChannel
  } = validation.data;

  try {
    return await sql.begin(async (sqlTx) => {
      // 1. Strict Duplicate Check on DB using transaction
      // Note: Since checkCandidateContactDuplicate uses sql internally, we call it 
      // cautiously. But to fix the TOCTOU issue completely we should query within sqlTx.
      const dupCheck = await checkCandidateContactDuplicate(contactPoints, null, sqlTx);
      if (dupCheck.hasDuplicate) {
        const d = dupCheck.duplicates[0];
        throw new Error(`Duplicate Contact Detected: ${d.type} (${d.value}) is already registered for Candidate #${d.matchedCandidate.display_number} - ${d.matchedCandidate.full_name}.`);
      }

      // 3. Insert Candidate (using atomic display_number calculation)
      const [candidate] = await sqlTx`
        INSERT INTO candidates (
          id, full_name, prefix, dob, address, cv_url, notes,
          created_time, last_updated
        ) VALUES (
          gen_random_uuid(), ${full_name}, ${prefix}, 
          ${dob ? dob : null}, ${address || null}, ${cv_url ? cv_url.trim() : null}, ${notes || null},
          NOW(), NOW()
        )
        RETURNING *
      `;

      // 4. Insert Contact Points
      const normalizedContacts = contactPoints.map(cp => ({ ...cp, norm: normalizeContactValue(cp.type, cp.value) }));
      for (const cp of normalizedContacts) {
          if (!cp.norm) continue;
          await sqlTx`
            INSERT INTO contact_points (id, candidate_id, type, value, created_time)
            VALUES (gen_random_uuid(), ${candidate.id}, ${cp.type}, ${cp.norm}, NOW())
          `;
        }

      // 5. Aggregate and sync contact summaries on candidates table manually inside Tx
      const allContacts = await sqlTx`SELECT type, value FROM contact_points WHERE candidate_id = ${candidate.id}`;
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
        WHERE id = ${candidate.id}
      `;

      // 6. Optional: Assign to Job Order & create initial activity note
      let newApp = null;
      if (assignToJobId) {
        const assignRes = await assignCandidateToJob({
          candidateId: candidate.id,
          jobId: assignToJobId,
          sourceChannel,
          note: notes ? `Initial sourcing note: ${notes}` : `Directly sourced profile added to pipeline`,
          initialStage: initialStage || "Talent Mapping",
          isPassive: true
        }, sqlTx);
        if (!assignRes.success) {
          throw new Error(assignRes.error);
        }
        newApp = assignRes.data;
      }

      return {
        success: true,
        candidate: JSON.parse(JSON.stringify(candidate)),
        application: newApp ? JSON.parse(JSON.stringify(newApp)) : null
      };
    });
  } catch (error) {
    console.error("Error in createCandidateWithStrictValidation:", error);
    return { success: false, error: error.message };
  } finally {
    revalidatePath('/candidates');
    revalidatePath('/search');
    revalidatePath('/');
    revalidatePath('/jobs');
  }
}

// ========================================================
// 3. JOBS & CLIENT WORKBENCH (MS ACCESS MASTER-DETAIL FLOW)
// ========================================================

// 3.0 Lấy toàn bộ dữ liệu cho màn hình MS Access Style Client & Jobs Workbench
export async function getClientWorkbenchData({ clientId = null, clientIndex = 0, searchTerm = "", jobId = null, clientName = null } = {}) {
  try {
    const rawSearch = (searchTerm || "").trim().toLowerCase();
    const formattedSearch = rawSearch ? `%${rawSearch}%` : null;

    // 1. Lấy danh sách tóm tắt tất cả Clients
    const allClients = await sql`
      SELECT 
        cl.id,
        cl.display_number,
        cl.name,
        COALESCE(cl.location, 'Ho Chi Minh') as location,
        COALESCE(cl.status, 'Active') as status,
        COALESCE(cl.tax_code, '') as tax_code,
        COALESCE(cl.address, '') as address,
        COALESCE(cl.branches, '[]'::jsonb) as branches,
        cl.created_time,
        COUNT(DISTINCT j.id)::int as job_count
      FROM clients cl
      LEFT JOIN jobs j ON cl.id = j.client_id
      WHERE (${formattedSearch}::text IS NULL 
             OR unaccent(LOWER(cl.name)) LIKE unaccent(${formattedSearch}) 
             OR cl.display_number::text LIKE ${formattedSearch}
             OR unaccent(LOWER(COALESCE(cl.location, ''))) LIKE unaccent(${formattedSearch}))
      GROUP BY cl.id, cl.display_number, cl.name, cl.location, cl.status, cl.tax_code, cl.address, cl.branches, cl.created_time
      ORDER BY cl.created_time DESC NULLS LAST, cl.display_number DESC NULLS LAST, cl.name ASC
    `;

    const formattedClients = allClients.map(c => {
      let br = [];
      if (Array.isArray(c.branches)) {
        br = c.branches;
      } else if (typeof c.branches === 'string') {
        try { br = JSON.parse(c.branches); } catch (e) { br = []; }
      }
      return { ...c, branches: Array.isArray(br) ? br : [] };
    });

    if (formattedClients.length === 0) {
      return { 
        success: true, 
        clients: [], 
        currentClient: null, 
        currentIndex: 0,
        totalClients: 0,
        jobs: [], 
        selectedJob: null, 
        applications: [], 
        selectedApp: null, 
        actionLogs: [] 
      };
    }

    // 1.1 Nếu có jobId, tìm Client sở hữu Job đó
    let resolvedClientId = clientId;
    if (jobId && !resolvedClientId) {
      const [jobRecord] = await sql`SELECT id, client_id FROM jobs WHERE id = ${jobId}`;
      if (jobRecord && jobRecord.client_id) {
        resolvedClientId = jobRecord.client_id;
      }
    }

    // 1.2 Nếu có clientName, tìm Client theo tên
    if (clientName && !resolvedClientId) {
      const cleanName = stripAccents(clientName.trim());
      const matched = formattedClients.find(c => stripAccents(c.name) === cleanName || stripAccents(c.name).includes(cleanName));
      if (matched) {
        resolvedClientId = matched.id;
      }
    }

    // Xác định Client hiện tại
    let activeClient = null;
    let activeIndex = 0;

    if (resolvedClientId) {
      const idx = formattedClients.findIndex(c => c.id === resolvedClientId);
      if (idx !== -1) {
        activeClient = formattedClients[idx];
        activeIndex = idx;
      }
    }
    
    if (!activeClient) {
      const safeIndex = Math.min(Math.max(0, clientIndex), formattedClients.length - 1);
      activeClient = formattedClients[safeIndex];
      activeIndex = safeIndex;
    }

    // 2. Lấy danh sách Jobs của Client hiện tại
    const jobs = await sql`
      SELECT 
        j.id,
        j.display_number,
        j.job_title as title,
        COALESCE(j.location, 'Ho Chi Minh') as location,
        COALESCE(j.status::text, 'Open') as status,
        COALESCE(j.working_mode, ARRAY[]::text[]) as working_mode,
        COALESCE(j.notes, '') as notes,
        COALESCE(j.jd_url, '') as jd_url,
        COALESCE(j.jd_text, '') as jd_text,
        j.created_time,
        COUNT(a.id)::int as applicant_count
      FROM jobs j
      LEFT JOIN activity a ON j.id = a.job_id
      WHERE j.client_id = ${activeClient.id}
      GROUP BY j.id, j.display_number, j.job_title, j.location, j.status, j.working_mode, j.notes, j.jd_url, j.jd_text, j.created_time
      ORDER BY j.created_time DESC NULLS LAST, j.display_number DESC NULLS LAST
    `;

    // 3. Nếu có jobId và khớp với danh sách jobs thì chọn đúng Job đó, nếu không chọn Job đầu tiên
    let selectedJob = null;
    if (jobId) {
      selectedJob = jobs.find(j => j.id === jobId) || (jobs.length > 0 ? jobs[0] : null);
    } else {
      selectedJob = jobs.length > 0 ? jobs[0] : null;
    }
    let applications = [];
    let selectedApp = null;
    let actionLogs = [];

    if (selectedJob) {
      applications = await sql`
        SELECT 
          a.id,
          a.display_number,
          COALESCE(a.status::text, 'In progress') as status,
          TO_CHAR(a.planning_date, 'DD-Mon-YY') as planning_date,
          a.planning_date as raw_planning_date,
          c.id as candidate_id,
          c.display_number as candidate_display_number,
          c.full_name as candidate_name,
          COALESCE(a.source_channel, a.acquisition_type, 'Direct') as candidate_source,
          COALESCE(a.is_passive, false) as is_passive,
          COALESCE(a.current_stage, 'New') as current_stage,
          COALESCE(a.note, '') as note,
          a.result,
          a.reason_failed,
          a.note_failure_reason
        FROM activity a
        JOIN candidates c ON a.candidate_id = c.id
        WHERE a.job_id = ${selectedJob.id}
        ORDER BY a.created_time DESC
      `;

      if (applications.length > 0) {
        selectedApp = applications[0];
        actionLogs = await sql`
          SELECT 
            id,
            action_type,
            TO_CHAR(action_date, 'DD-Mon-YY HH24:MI') as date_formatted,
            action_date,
            COALESCE(note, '') as note,
            COALESCE(result, '') as result
          FROM activity_log
          WHERE application_id = ${selectedApp.id}
          ORDER BY action_date DESC, created_time DESC
        `;
      }
    }

    // 2. Lấy danh sách Client Persons (Người phụ trách & Danh bạ liên lạc của Client)
    const clientPersons = await sql`
      SELECT 
        id,
        display_number,
        client_id,
        COALESCE(full_name, 'Contact Person') as full_name,
        COALESCE(job_title, 'HR') as job_title,
        COALESCE(department, '') as department,
        COALESCE(is_primary, false) as is_primary,
        COALESCE(contact_points, '[]'::jsonb) as contact_points,
        COALESCE(notes, '') as notes
      FROM client_persons
      WHERE client_id = ${activeClient.id}
      ORDER BY is_primary DESC, created_time ASC
    `;

    return {
      success: true,
      clients: JSON.parse(JSON.stringify(formattedClients)),
      currentClient: JSON.parse(JSON.stringify(activeClient)),
      clientPersons: JSON.parse(JSON.stringify(clientPersons)),
      currentIndex: activeIndex,
      totalClients: formattedClients.length,
      jobs: JSON.parse(JSON.stringify(jobs)),
      selectedJob: JSON.parse(JSON.stringify(selectedJob)),
      applications: JSON.parse(JSON.stringify(applications)),
      selectedApp: JSON.parse(JSON.stringify(selectedApp)),
      actionLogs: JSON.parse(JSON.stringify(actionLogs))
    };
  } catch (error) {
    console.error("Error fetching client workbench data:", error);
    return { success: false, error: error.message };
  }
}

// 3.0.0.1 Thêm Người Phụ Trách Phía Khách Hàng (Client Person)
export async function addClientPerson({ 
  clientId, 
  fullName, 
  jobTitle = "HR", 
  department = "", 
  isPrimary = false, 
  notes = "", 
  initialContactType = "Phone", 
  initialContactValue = "" 
}) {
  if (!clientId) return { success: false, error: "Missing Client ID" };
  try {
    const initialContacts = [];
    if (initialContactValue && initialContactValue.trim()) {
      initialContacts.push({
        id: `cp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: initialContactType || "Phone",
        value: initialContactValue.trim(),
        is_primary: true
      });
    }
    const [inserted] = await sql`
      INSERT INTO client_persons (
        id, client_id, full_name, job_title, department, is_primary, contact_points, notes, created_time, last_updated
      ) VALUES (
        uuid_generate_v7(), ${clientId}, ${fullName || 'Contact Person'}, ${jobTitle || 'HR'}, ${department || ''}, ${isPrimary || false}, ${JSON.stringify(initialContacts)}::jsonb, ${notes || ''}, NOW(), NOW()
      )
      RETURNING *
    `;
    revalidatePath('/jobs');
    return { success: true, person: JSON.parse(JSON.stringify(inserted)) };
  } catch (error) {
    console.error("Error adding client person:", error);
    return { success: false, error: error.message };
  }
}

// 3.0.0.2 Cập nhật Người Phụ Trách Phía Khách Hàng
export async function updateClientPerson(personId, updateData) {
  if (!personId) return { success: false, error: "Missing Person ID" };
  try {
    const { fullName, jobTitle, department, isPrimary, notes } = updateData;
    const [updated] = await sql`
      UPDATE client_persons
      SET 
        full_name = ${fullName !== undefined ? fullName : sql`full_name`},
        job_title = ${jobTitle !== undefined ? jobTitle : sql`job_title`},
        department = ${department !== undefined ? department : sql`department`},
        is_primary = ${isPrimary !== undefined ? isPrimary : sql`is_primary`},
        notes = ${notes !== undefined ? notes : sql`notes`},
        last_updated = NOW()
      WHERE id = ${personId}
      RETURNING *
    `;
    revalidatePath('/jobs');
    return { success: true, person: JSON.parse(JSON.stringify(updated)) };
  } catch (error) {
    console.error("Error updating client person:", error);
    return { success: false, error: error.message };
  }
}

// 3.0.0.3 Xóa Người Phụ Trách
export async function deleteClientPerson(personId) {
  if (!personId) return { success: false, error: "Missing Person ID" };
  try {
    await sql`DELETE FROM client_persons WHERE id = ${personId}`;
    revalidatePath('/jobs');
    return { success: true };
  } catch (error) {
    console.error("Error deleting client person:", error);
    return { success: false, error: error.message };
  }
}

// 3.0.0.4 Thêm 1 Điểm Liên Lạc Mới Vào Danh Bạ Của Người Phụ Trách (JSONB Append)
export async function addPersonContactPoint(personId, { type = "Phone", value = "", isPrimary = false }) {
  if (!personId || !value.trim()) return { success: false, error: "Missing information" };
  try {
    const [person] = await sql`SELECT contact_points FROM client_persons WHERE id = ${personId}`;
    if (!person) return { success: false, error: "Person not found" };

    const rawPoints = Array.isArray(person.contact_points) 
      ? person.contact_points 
      : (typeof person.contact_points === 'string' ? JSON.parse(person.contact_points) : []);

    const newPoint = {
      id: `cp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: type || "Phone",
      value: value.trim(),
      is_primary: Boolean(isPrimary)
    };

    const updatedPoints = [...rawPoints, newPoint];
    const [updated] = await sql`
      UPDATE client_persons
      SET contact_points = ${JSON.stringify(updatedPoints)}::jsonb, last_updated = NOW()
      WHERE id = ${personId}
      RETURNING *
    `;
    revalidatePath('/jobs');
    return { success: true, person: JSON.parse(JSON.stringify(updated)) };
  } catch (error) {
    console.error("Error adding contact point to person:", error);
    return { success: false, error: error.message };
  }
}

// 3.0.0.5 Cập nhật 1 Điểm Liên Lạc Trong Danh Bạ
export async function updatePersonContactPoint(personId, contactPointId, { type, value, isPrimary }) {
  if (!personId || !contactPointId) return { success: false, error: "Missing ID" };
  try {
    const [person] = await sql`SELECT contact_points FROM client_persons WHERE id = ${personId}`;
    if (!person) return { success: false, error: "Person not found" };

    const rawPoints = Array.isArray(person.contact_points) 
      ? person.contact_points 
      : (typeof person.contact_points === 'string' ? JSON.parse(person.contact_points) : []);

    const updatedPoints = rawPoints.map(cp => {
      if (cp.id === contactPointId) {
        return {
          ...cp,
          type: type !== undefined ? type : cp.type,
          value: value !== undefined ? value : cp.value,
          is_primary: isPrimary !== undefined ? isPrimary : cp.is_primary
        };
      }
      return cp;
    });

    const [updated] = await sql`
      UPDATE client_persons
      SET contact_points = ${JSON.stringify(updatedPoints)}::jsonb, last_updated = NOW()
      WHERE id = ${personId}
      RETURNING *
    `;
    revalidatePath('/jobs');
    return { success: true, person: JSON.parse(JSON.stringify(updated)) };
  } catch (error) {
    console.error("Error updating person contact point:", error);
    return { success: false, error: error.message };
  }
}

// 3.0.0.6 Xóa 1 Điểm Liên Lạc Khỏi Danh Bạ Của Người Đó
export async function deletePersonContactPoint(personId, contactPointId) {
  if (!personId || !contactPointId) return { success: false, error: "Missing ID" };
  try {
    const [person] = await sql`SELECT contact_points FROM client_persons WHERE id = ${personId}`;
    if (!person) return { success: false, error: "Person not found" };

    const rawPoints = Array.isArray(person.contact_points) 
      ? person.contact_points 
      : (typeof person.contact_points === 'string' ? JSON.parse(person.contact_points) : []);

    const updatedPoints = rawPoints.filter(cp => cp.id !== contactPointId);

    const [updated] = await sql`
      UPDATE client_persons
      SET contact_points = ${JSON.stringify(updatedPoints)}::jsonb, last_updated = NOW()
      WHERE id = ${personId}
      RETURNING *
    `;
    revalidatePath('/jobs');
    return { success: true, person: JSON.parse(JSON.stringify(updated)) };
  } catch (error) {
    console.error("Error deleting person contact point:", error);
    return { success: false, error: error.message };
  }
}

// 3.0.0.7 Lấy danh sách Client Persons
export async function getClientPersons(clientId) {
  if (!clientId) return { success: false, error: "Missing Client ID" };
  try {
    const persons = await sql`
      SELECT 
        id,
        display_number,
        client_id,
        COALESCE(full_name, 'Contact Person') as full_name,
        COALESCE(job_title, 'HR') as job_title,
        COALESCE(department, '') as department,
        COALESCE(is_primary, false) as is_primary,
        COALESCE(contact_points, '[]'::jsonb) as contact_points,
        COALESCE(notes, '') as notes
      FROM client_persons
      WHERE client_id = ${clientId}
      ORDER BY is_primary DESC, created_time ASC
    `;
    return { success: true, data: JSON.parse(JSON.stringify(persons)) };
  } catch (error) {
    console.error("Error fetching client persons:", error);
    return { success: false, error: error.message };
  }
}

// 3.0.0.7 Thêm Chi Nhánh Mới Cho Client (JSONB Append)
export async function addClientBranch(clientId, { 
  branchName = "New Branch", 
  city = "Ho Chi Minh", 
  address = "", 
  isHeadquarter = false, 
  phone = "", 
  notes = "" 
}) {
  if (!clientId) return { success: false, error: "Missing Client ID" };
  try {
    return await sql.begin(async (tx) => {
      const [client] = await tx`SELECT branches, location, address FROM clients WHERE id = ${clientId} FOR UPDATE`;
      if (!client) return { success: false, error: "Client not found" };

      let rawBranches = Array.isArray(client.branches)
        ? client.branches
        : (typeof client.branches === 'string' ? JSON.parse(client.branches) : []);

      // If branches was empty and client had an existing address, auto-seed it as the default HQ first
      if (rawBranches.length === 0 && (client.location || client.address)) {
        rawBranches.push({
          id: `br_hq_${Date.now()}_init`,
          branch_name: "Main Headquarters",
          city: client.location || "Ho Chi Minh",
          address: client.address || "",
          is_headquarter: !isHeadquarter,
          phone: "",
          notes: "Primary billing & legal address"
        });
      }

      if (isHeadquarter || rawBranches.length === 0) {
        rawBranches = rawBranches.map(b => ({ ...b, is_headquarter: false }));
      }

      const shouldBeHq = Boolean(isHeadquarter) || rawBranches.length === 0;

      const newBranch = {
        id: `br_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        branch_name: branchName.trim() || "Branch Office",
        city: city || "Ho Chi Minh",
        address: address.trim() || "",
        is_headquarter: shouldBeHq,
        phone: phone.trim() || "",
        notes: notes.trim() || ""
      };

      rawBranches.push(newBranch);

      if (shouldBeHq) {
        await tx`
          UPDATE clients
          SET 
            branches = ${sql.json(rawBranches)},
            location = ${newBranch.city},
            address = ${newBranch.address},
            last_updated = NOW()
          WHERE id = ${clientId}
        `;
      } else {
        await tx`
          UPDATE clients
          SET 
            branches = ${sql.json(rawBranches)},
            last_updated = NOW()
          WHERE id = ${clientId}
        `;
      }

      revalidatePath('/jobs');
      return { success: true, branches: rawBranches, newBranch };
    });
  } catch (error) {
    console.error("Error adding client branch:", error);
    return { success: false, error: error.message };
  }
}

// 3.0.0.8 Cập Nhật Chi Nhánh Của Client
export async function updateClientBranch(clientId, branchId, { 
  branchName, 
  city, 
  address, 
  isHeadquarter, 
  phone, 
  notes 
}) {
  if (!clientId || !branchId) return { success: false, error: "Missing required parameters" };
  try {
    return await sql.begin(async (tx) => {
      const [client] = await tx`SELECT branches, location, address FROM clients WHERE id = ${clientId} FOR UPDATE`;
      if (!client) return { success: false, error: "Client not found" };

      let rawBranches = Array.isArray(client.branches)
        ? client.branches
        : (typeof client.branches === 'string' ? JSON.parse(client.branches) : []);

      // If branches was empty and user is editing default_hq
      if (branchId === 'default_hq' && rawBranches.length === 0) {
        const newHq = {
          id: `br_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          branch_name: (branchName && branchName.trim()) || "Main Headquarters",
          city: city || client.location || "Ho Chi Minh",
          address: (address !== undefined ? address.trim() : client.address) || "",
          is_headquarter: true,
          phone: (phone && phone.trim()) || "",
          notes: (notes && notes.trim()) || ""
        };
        rawBranches = [newHq];
        await tx`
          UPDATE clients
          SET 
            branches = ${sql.json(rawBranches)},
            location = ${newHq.city},
            address = ${newHq.address},
            last_updated = NOW()
          WHERE id = ${clientId}
        `;
        revalidatePath('/jobs');
        return { success: true, branches: rawBranches, updatedBranch: newHq };
      }

      let updatedBranch = null;
      rawBranches = rawBranches.map(b => {
        if (b.id === branchId) {
          updatedBranch = {
            ...b,
            branch_name: branchName !== undefined ? branchName.trim() : b.branch_name,
            city: city !== undefined ? city : b.city,
            address: address !== undefined ? address.trim() : b.address,
            is_headquarter: isHeadquarter !== undefined ? Boolean(isHeadquarter) : b.is_headquarter,
            phone: phone !== undefined ? phone.trim() : (b.phone || ""),
            notes: notes !== undefined ? notes.trim() : (b.notes || "")
          };
          return updatedBranch;
        }
        if (isHeadquarter) {
          return { ...b, is_headquarter: false };
        }
        return b;
      });

      if (updatedBranch && updatedBranch.is_headquarter) {
        await tx`
          UPDATE clients
          SET 
            branches = ${sql.json(rawBranches)},
            location = ${updatedBranch.city},
            address = ${updatedBranch.address},
            last_updated = NOW()
          WHERE id = ${clientId}
        `;
      } else {
        await tx`
          UPDATE clients
          SET 
            branches = ${sql.json(rawBranches)},
            last_updated = NOW()
          WHERE id = ${clientId}
        `;
      }

      revalidatePath('/jobs');
      return { success: true, branches: rawBranches, updatedBranch };
    });
  } catch (error) {
    console.error("Error updating client branch:", error);
    return { success: false, error: error.message };
  }
}

// 3.0.0.9 Xóa Chi Nhánh Của Client
export async function deleteClientBranch(clientId, branchId) {
  if (!clientId || !branchId) return { success: false, error: "Missing required parameters" };
  try {
    return await sql.begin(async (tx) => {
      const [client] = await tx`SELECT branches, location, address FROM clients WHERE id = ${clientId} FOR UPDATE`;
      if (!client) return { success: false, error: "Client not found" };

      let rawBranches = Array.isArray(client.branches)
        ? client.branches
        : (typeof client.branches === 'string' ? JSON.parse(client.branches) : []);

      const wasHq = rawBranches.some(b => b.id === branchId && b.is_headquarter);
      rawBranches = rawBranches.filter(b => b.id !== branchId);

      if (wasHq && rawBranches.length > 0) {
        rawBranches[0].is_headquarter = true;
        await tx`
          UPDATE clients
          SET 
            branches = ${sql.json(rawBranches)},
            location = ${rawBranches[0].city},
            address = ${rawBranches[0].address},
            last_updated = NOW()
          WHERE id = ${clientId}
        `;
      } else {
        await tx`
          UPDATE clients
          SET 
            branches = ${sql.json(rawBranches)},
            last_updated = NOW()
          WHERE id = ${clientId}
        `;
      }

      revalidatePath('/jobs');
      return { success: true, branches: rawBranches };
    });
  } catch (error) {
    console.error("Error deleting client branch:", error);
    return { success: false, error: error.message };
  }
}

// 3.0.0.10 Đặt Chi Nhánh Làm Trụ Sở Chính (Set as Headquarter)
export async function setHeadquarterBranch(clientId, branchId) {
  if (!clientId || !branchId) return { success: false, error: "Missing required parameters" };
  try {
    const [client] = await sql`SELECT branches FROM clients WHERE id = ${clientId}`;
    if (!client) return { success: false, error: "Client not found" };

    let rawBranches = Array.isArray(client.branches)
      ? client.branches
      : (typeof client.branches === 'string' ? JSON.parse(client.branches) : []);

    let targetBranch = null;
    rawBranches = rawBranches.map(b => {
      if (b.id === branchId) {
        targetBranch = { ...b, is_headquarter: true };
        return targetBranch;
      }
      return { ...b, is_headquarter: false };
    });

    if (targetBranch) {
      await sql`
        UPDATE clients
        SET 
          branches = ${sql.json(rawBranches)},
          location = ${targetBranch.city},
          address = ${targetBranch.address},
          last_updated = NOW()
        WHERE id = ${clientId}
      `;
    }

    revalidatePath('/jobs');
    return { success: true, branches: rawBranches, headquarter: targetBranch };
  } catch (error) {
    console.error("Error setting headquarter branch:", error);
    return { success: false, error: error.message };
  }
}

// 3.0.1 Lấy danh sách Applications và Logs của 1 Job cụ thể
export async function getJobWorkbenchDetails(jobId) {
  if (!jobId) return { success: false, error: "Missing Job ID" };
  try {
    const applications = await sql`
      SELECT 
        a.id,
        a.display_number,
        COALESCE(a.status::text, 'In progress') as status,
        TO_CHAR(a.planning_date, 'DD-Mon-YY') as planning_date,
        a.planning_date as raw_planning_date,
        c.id as candidate_id,
        c.display_number as candidate_display_number,
        c.full_name as candidate_name,
        COALESCE(a.source_channel, a.acquisition_type, 'Direct') as candidate_source,
        COALESCE(a.is_passive, false) as is_passive,
        COALESCE(a.current_stage, 'New') as current_stage,
        COALESCE(a.note, '') as note,
        a.result,
        a.reason_failed,
        a.note_failure_reason
      FROM activity a
      JOIN candidates c ON a.candidate_id = c.id
      WHERE a.job_id = ${jobId}
      ORDER BY a.created_time DESC
    `;

    let selectedApp = applications.length > 0 ? applications[0] : null;
    let actionLogs = [];

    if (selectedApp) {
      actionLogs = await sql`
        SELECT 
          id,
          action_type,
          TO_CHAR(action_date, 'DD-Mon-YY HH24:MI') as date_formatted,
          action_date,
          COALESCE(note, '') as note,
          COALESCE(result, '') as result
        FROM activity_log
        WHERE application_id = ${selectedApp.id}
        ORDER BY action_date DESC, created_time DESC
      `;
    }

    return {
      success: true,
      applications: JSON.parse(JSON.stringify(applications)),
      selectedApp: JSON.parse(JSON.stringify(selectedApp)),
      actionLogs: JSON.parse(JSON.stringify(actionLogs))
    };
  } catch (error) {
    console.error("Error fetching job workbench details:", error);
    return { success: false, error: error.message };
  }
}

// 3.0.2 Lấy danh sách Action Logs của 1 Application cụ thể
export async function getApplicationLogs(applicationId) {
  if (!applicationId) return { success: false, error: "Missing Application ID" };
  try {
    const actionLogs = await sql`
      SELECT 
        id,
        action_type,
        TO_CHAR(action_date, 'DD-Mon-YY HH24:MI') as date_formatted,
        action_date,
        COALESCE(note, '') as note,
        COALESCE(result, '') as result
      FROM activity_log
      WHERE application_id = ${applicationId}
      ORDER BY action_date DESC, created_time DESC
    `;
    return { success: true, actionLogs: JSON.parse(JSON.stringify(actionLogs)) };
  } catch (error) {
    console.error("Error fetching application logs:", error);
    return { success: false, error: error.message };
  }
}

// 3.0.3 Cập nhật nhanh thông tin Client
export async function updateClientField(clientId, field, value) {
  if (!clientId) return { success: false, error: "Missing Client ID" };
  try {
    const allowed = ['name', 'location', 'status', 'tax_code', 'address'];
    if (!allowed.includes(field)) {
      return { success: false, error: `Trường ${field} không hợp lệ` };
    }

    await sql`
      UPDATE clients
      SET ${sql(field)} = ${value}, last_updated = NOW()
      WHERE id = ${clientId}
    `;
    revalidatePath('/jobs');
    return { success: true };
  } catch (error) {
    console.error("Error updating client field:", error);
    return { success: false, error: error.message };
  }
}

// 3.0.4 Tạo Client mới
export async function createClient(clientData = {}) {
  try {
    const { name, location = 'Ho Chi Minh', status = 'Active', tax_code = '', address = '' } = clientData;

    const [inserted] = await sql`
      INSERT INTO clients (
        id, name, location, status, tax_code, address, branches, created_time, last_updated
      ) VALUES (
        uuid_generate_v7(), ${name || `New Client`}, 
        ${location}, ${status}, ${tax_code}, ${address}, '[]'::jsonb, NOW(), NOW()
      )
      RETURNING *
    `;
    revalidatePath('/jobs');
    return { success: true, client: JSON.parse(JSON.stringify(inserted)) };
  } catch (error) {
    console.error("Error creating client:", error);
    return { success: false, error: error.message };
  }
}

// 3.0.5 Cập nhật nhanh thông tin Job
export async function updateJobField(jobId, field, value) {
  if (!jobId) return { success: false, error: "Missing Job ID" };
  try {
    const allowed = ['job_title', 'title', 'location', 'status', 'working_mode', 'notes', 'jd_url', 'jd_text'];
    if (!allowed.includes(field)) {
      return { success: false, error: `Trường ${field} không hợp lệ` };
    }
    const dbField = field === 'title' ? 'job_title' : field;

    if (dbField === 'working_mode') {
      const modeArr = Array.isArray(value) ? value : (value ? [value] : []);
      await sql`
        UPDATE jobs
        SET working_mode = ${modeArr}::text[], last_updated = NOW()
        WHERE id = ${jobId}
      `;
    } else {
      await sql`
        UPDATE jobs
        SET ${sql(dbField)} = ${value}, last_updated = NOW()
        WHERE id = ${jobId}
      `;
    }
    revalidatePath('/jobs');
    return { success: true };
  } catch (error) {
    console.error("Error updating job field:", error);
    return { success: false, error: error.message };
  }
}

// 3.0.6 Tạo Job mới cho Client
export async function createJobForClient(clientId, jobData = {}) {
  if (!clientId) return { success: false, error: "Missing Client ID" };
  if (!jobData.job_title || !jobData.job_title.trim()) {
    return { success: false, error: "Job title is required" };
  }
  try {
    const { 
      job_title, 
      location = 'Ho Chi Minh', 
      status = 'Open', 
      working_mode = ['On-site'], 
      notes = '', 
      jd_url = '', 
      jd_text = '' 
    } = jobData;
    const modeArr = Array.isArray(working_mode) ? working_mode : (working_mode ? [working_mode] : []);

    const [inserted] = await sql`
      INSERT INTO jobs (
        id, client_id, job_title, location, status, working_mode, notes, jd_url, jd_text, created_time, last_updated
      ) VALUES (
        uuid_generate_v7(), ${clientId}, ${job_title}, ${location}, ${status}::job_status, ${modeArr}::text[], ${notes}, ${jd_url}, ${jd_text}, NOW(), NOW()
      )
      RETURNING id, display_number, job_title as title, location, status, working_mode, notes, jd_url, jd_text
    `;
    revalidatePath('/jobs');
    return { success: true, job: JSON.parse(JSON.stringify(inserted)) };
  } catch (error) {
    console.error("Error creating job for client:", error);
    return { success: false, error: error.message };
  }
}

// 3.1 Lấy danh sách Jobs tuyển dụng
export async function getJobs() {
  try {
    const data = await sql`
      SELECT 
        j.id, 
        j.id AS job_id, 
        j.client_id, 
        j.job_title, 
        j.status, 
        j.location, 
        j.display_number, 
        cl.name AS client_name,
        cl.name AS client,
        j.created_time,
        COUNT(app.id)::int AS candidate_count
      FROM jobs j
      LEFT JOIN clients cl ON j.client_id = cl.id
      LEFT JOIN activity app ON j.id = app.job_id
      GROUP BY j.id, j.client_id, j.job_title, j.status, j.location, j.display_number, cl.name, j.created_time
      ORDER BY j.created_time DESC NULLS LAST, j.display_number DESC NULLS LAST
    `;
    return { success: true, data: JSON.parse(JSON.stringify(data)) };
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return { success: false, error: error.message };
  }
}

// 3.2 Lấy danh sách Clients (Khách hàng) cho bộ lọc
export async function getClients() {
  try {
    const data = await sql`
      SELECT 
        id, 
        id AS client_id, 
        display_number, 
        name, 
        name AS client_name, 
        industry, 
        status,
        created_time
      FROM clients
      ORDER BY created_time DESC NULLS LAST, display_number DESC NULLS LAST, name ASC
    `;
    return { success: true, data: JSON.parse(JSON.stringify(data)) };
  } catch (error) {
    console.error("Error fetching clients:", error);
    return { success: false, error: error.message };
  }
}

// 3.2 Lấy danh sách Applications/Activities cho Candidate Directory
export async function getApplications({ jobId = "ALL", stage = null, searchTerm = "", limit = 300, offset = 0 } = {}) {
  try {
    const formattedSearch = searchTerm ? `%${searchTerm.toLowerCase()}%` : null;
    const filterJob = jobId && jobId !== 'ALL' ? jobId : null;
    const filterStage = stage && stage !== 'ALL' ? stage : null;

    const data = await sql`
      SELECT 
        app.id AS application_id, app.candidate_id, app.job_id, app.current_stage,
        app.status, app.result, app.reason_failed, app.note_failure_reason, app.created_time, c.full_name AS candidate_name,
        j.job_title, cl.name AS client_name
      FROM activity app
      LEFT JOIN candidates c ON app.candidate_id = c.id
      LEFT JOIN jobs j ON app.job_id = j.id
      LEFT JOIN clients cl ON j.client_id = cl.id
      WHERE 
        (${filterJob}::uuid IS NULL OR app.job_id = ${filterJob})
        AND (${filterStage}::text IS NULL OR app.current_stage = ${filterStage})
        AND (${formattedSearch}::text IS NULL OR unaccent(LOWER(c.full_name)) LIKE unaccent(${formattedSearch}))
      ORDER BY app.created_time DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return { success: true, data };
  } catch (error) {
    console.error("Error fetching applications:", error);
    return { success: false, error: error.message };
  }
}

// 3.3 Tạo Candidate kèm Activity mới
export async function createCandidateWithApplication(formData) {
  try {
    const { full_name, job_id, phone, email, cv_url, source, note } = formData;
    const [candidate] = await sql`
      INSERT INTO candidates (id, full_name, source, cv_url, notes, created_time)
      VALUES (gen_random_uuid(), ${full_name}, ${source}, ${cv_url}, ${note}, NOW())
      RETURNING id
    `;
    
    if (phone) {
        const normPhone = normalizeContactValue('Phone', phone);
        if (normPhone) await sql`INSERT INTO contact_points (id, candidate_id, type, value) VALUES (gen_random_uuid(), ${candidate.id}, 'Phone', ${normPhone})`;
      }
    
    const [app] = await sql`
      INSERT INTO activity (id, candidate_id, job_id, current_stage, status, created_time)
      VALUES (gen_random_uuid(), ${candidate.id}, ${job_id}, 'New', 'In progress', NOW())
      RETURNING id
    `;

    revalidatePath('/');
    return { success: true, applicationId: app.id, candidateId: candidate.id };
  } catch (error) {
    console.error("Error creating candidate:", error);
    return { success: false, error: error.message };
  }
}

// ========================================================
// 4. SEARCH MENU DATA FUNCTIONS (Backend-filtered & Paginated)
// ========================================================

// 4.1 Lấy dữ liệu Candidate Database với lọc và phân trang ở Backend
export async function getCandidateSearchData({ searchTerm = "", page = 1, pageSize = 80 } = {}) {
  try {
    const rawSearch = (searchTerm || "").trim();
    const cleanSearch = rawSearch
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/+$/, "");
    const formattedSearch = cleanSearch ? `%${cleanSearch.toLowerCase()}%` : null;
    const offset = Math.max(0, (page - 1) * pageSize);

    const [countRes, data] = await Promise.all([
      sql`
        SELECT COUNT(*)::int AS total
        FROM candidates c
        WHERE (${formattedSearch}::text IS NULL 
               OR unaccent(LOWER(c.full_name)) LIKE unaccent(${formattedSearch}) 
               OR c.display_number::text LIKE ${formattedSearch} 
               OR unaccent(LOWER(c.all_contacts_text)) LIKE unaccent(${formattedSearch}))
      `,
      sql`
        SELECT 
          c.id AS candidate_id,
          c.display_number,
          COALESCE(c.prefix, 'Mr/Ms') AS prefix,
          c.full_name,
          c.blocked,
          c.blacklist_note,
          COALESCE(c.phones, ARRAY[]::text[]) AS phones,
          COALESCE(c.emails, ARRAY[]::text[]) AS emails,
          COALESCE(c.socials, '[]'::jsonb) AS socials,
          COALESCE(c.all_contacts_text, '') AS all_contacts_text,
          c.cv_url
        FROM candidates c
        WHERE (${formattedSearch}::text IS NULL 
               OR unaccent(LOWER(c.full_name)) LIKE unaccent(${formattedSearch}) 
               OR c.display_number::text LIKE ${formattedSearch} 
               OR unaccent(LOWER(c.all_contacts_text)) LIKE unaccent(${formattedSearch}))
        ORDER BY c.display_number DESC NULLS LAST
        LIMIT ${pageSize} OFFSET ${offset}
      `
    ]);

    const totalCount = countRes[0]?.total || 0;
    return { success: true, data, totalCount, page, pageSize };
  } catch (error) {
    console.error("Error fetching candidate search data:", error);
    return { success: false, error: error.message, data: [], totalCount: 0 };
  }
}

// 4.2 Lấy dữ liệu Client Database với lọc và phân trang ở Backend
export async function getClientSearchData({ searchTerm = "", page = 1, pageSize = 80 } = {}) {
  try {
    const rawSearch = (searchTerm || "").trim();
    const formattedSearch = rawSearch ? `%${rawSearch.toLowerCase()}%` : null;
    const offset = Math.max(0, (page - 1) * pageSize);

    const [countRes, data] = await Promise.all([
      sql`
        SELECT COUNT(*)::int AS total
        FROM clients cl
        WHERE 
          (${formattedSearch}::text IS NULL 
            OR unaccent(LOWER(cl.name)) LIKE unaccent(${formattedSearch})
            OR cl.display_number::text LIKE ${formattedSearch}
            OR unaccent(LOWER(COALESCE(cl.industry, ''))) LIKE unaccent(${formattedSearch})
            OR unaccent(LOWER(COALESCE(cl.location, ''))) LIKE unaccent(${formattedSearch})
          )
      `,
      sql`
        SELECT 
          cl.id AS client_id,
          cl.display_number,
          cl.name AS client_name,
          COALESCE(cl.industry, '—') AS industry,
          COALESCE(cl.location, '—') AS location,
          COALESCE(cl.status, 'Active') AS status,
          COUNT(DISTINCT j.id)::int AS job_count,
          COUNT(DISTINCT app.id)::int AS candidate_count,
          (SELECT STRING_AGG(full_name, ', ') FROM client_persons WHERE client_id = cl.id) AS contacts
        FROM clients cl
        LEFT JOIN jobs j ON cl.id = j.client_id
        LEFT JOIN activity app ON j.id = app.job_id
        WHERE 
          (${formattedSearch}::text IS NULL 
            OR unaccent(LOWER(cl.name)) LIKE unaccent(${formattedSearch})
            OR cl.display_number::text LIKE ${formattedSearch}
            OR unaccent(LOWER(COALESCE(cl.industry, ''))) LIKE unaccent(${formattedSearch})
            OR unaccent(LOWER(COALESCE(cl.location, ''))) LIKE unaccent(${formattedSearch})
          )
        GROUP BY cl.id, cl.display_number, cl.name, cl.industry, cl.location, cl.status
        ORDER BY cl.display_number DESC NULLS LAST, cl.name ASC
        LIMIT ${pageSize} OFFSET ${offset}
      `
    ]);

    const totalCount = countRes[0]?.total || 0;
    return { success: true, data, totalCount, page, pageSize };
  } catch (error) {
    console.error("Error fetching client search data:", error);
    return { success: false, error: error.message, data: [], totalCount: 0 };
  }
}

// 4.3 Lấy dữ liệu Job Order Database với lọc và phân trang ở Backend
export async function getJobSearchData({ searchTerm = "", page = 1, pageSize = 80 } = {}) {
  try {
    const rawSearch = (searchTerm || "").trim();
    const formattedSearch = rawSearch ? `%${rawSearch.toLowerCase()}%` : null;
    const offset = Math.max(0, (page - 1) * pageSize);

    const [countRes, data] = await Promise.all([
      sql`
        SELECT COUNT(*)::int AS total
        FROM jobs j
        LEFT JOIN clients cl ON j.client_id = cl.id
        WHERE 
          (${formattedSearch}::text IS NULL 
            OR unaccent(LOWER(j.job_title)) LIKE unaccent(${formattedSearch})
            OR j.display_number::text LIKE ${formattedSearch}
            OR unaccent(LOWER(COALESCE(cl.name, ''))) LIKE unaccent(${formattedSearch})
            OR unaccent(LOWER(COALESCE(j.location, ''))) LIKE unaccent(${formattedSearch})
          )
      `,
      sql`
        SELECT 
          j.id AS job_id,
          j.display_number,
          j.job_title,
          cl.name AS client_name,
          cl.id AS client_id,
          j.status,
          j.location,
          COUNT(app.id)::int AS candidate_count,
          TO_CHAR(j.created_time, 'YYYY-MM-DD') AS created_date
        FROM jobs j
        LEFT JOIN clients cl ON j.client_id = cl.id
        LEFT JOIN activity app ON j.id = app.job_id
        WHERE 
          (${formattedSearch}::text IS NULL 
            OR unaccent(LOWER(j.job_title)) LIKE unaccent(${formattedSearch})
            OR j.display_number::text LIKE ${formattedSearch}
            OR unaccent(LOWER(COALESCE(cl.name, ''))) LIKE unaccent(${formattedSearch})
            OR unaccent(LOWER(COALESCE(j.location, ''))) LIKE unaccent(${formattedSearch})
          )
        GROUP BY j.id, j.display_number, j.job_title, cl.name, cl.id, j.status, j.location, j.created_time
        ORDER BY j.display_number DESC NULLS LAST, j.created_time DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `
    ]);

    const totalCount = countRes[0]?.total || 0;
    return { success: true, data, totalCount, page, pageSize };
  } catch (error) {
    console.error("Error fetching job search data:", error);
    return { success: false, error: error.message, data: [], totalCount: 0 };
  }
}

