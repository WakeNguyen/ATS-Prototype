'use server';

import sql from '../lib/db.js';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { encryptSecret, decryptSecret, maskProxyUrl, maskSecret } from '../lib/encryption.js';
import { normalizeSocialGroupUrl as normalizeSocialGroupUrlSync } from '../lib/url_utils.js';


/**
 * Security Guard: Ensures functions with critical side effects are only called
 * within a genuine Next.js request context (UI dispatch or real HTTP request).
 */
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
      `[SECURITY GUARD] ${fnName} blocked: This function has database mutation side-effects ` +
      `and must be dispatched from a real Next.js request context. Raw script import is prohibited. ` +
      `Original error: ${e.message}`
    );
  }
}

// ==========================================
// 1. CAMPAIGN CRUD & READ ACTIONS
// ==========================================

/**
 * Fetch all campaigns with rollup metrics and latest execution run.
 * @param {Object} [filters]
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getCampaigns(filters = {}) {
  try {
    const { status, search, campaign_type } = filters;

    let query = sql`
      SELECT 
        c.id,
        c.campaign_name,
        c.campaign_type,
        c.channel,
        c.post_language,
        c.post_image_url,
        c.content,
        c.target_criteria,
        c.start_date,
        c.end_date,
        c.start_time,
        c.end_time,
        c.is_active,
        c.status,
        c.auto_spin_content,
        c.allow_post_without_join,
        c.auto_run_enabled,
        c.target_quota,
        c.max_posts_per_run,
        c.job_id,
        c.created_time,
        c.last_updated,
        jobs_agg.job_titles,
        jobs_agg.job_ids,
        jobs_agg.client_names,
        (
          SELECT COUNT(*)::int 
          FROM campaign_social_groups csg 
          WHERE csg.campaign_id = c.id
        ) as target_groups_count,
        (
          SELECT COUNT(*)::int 
          FROM campaign_run_items cri
          JOIN campaign_runs cr ON cri.run_id = cr.id
          WHERE cr.campaign_id = c.id AND cri.status = 'Sent'
        ) as total_sent,
        latest_run.id as latest_run_id,
        latest_run.status as latest_run_status,
        latest_run.started_at as latest_run_started_at,
        latest_run.completed_at as latest_run_completed_at,
        latest_run.summary as latest_run_summary,
        latest_run.stats as latest_run_stats
      FROM campaigns c
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(array_agg(j2.job_title ORDER BY j2.job_title), '{}') AS job_titles,
          COALESCE(array_agg(j2.id::text ORDER BY j2.job_title), '{}') AS job_ids,
          COALESCE(array_agg(DISTINCT cl2.name) FILTER (WHERE cl2.name IS NOT NULL), '{}') AS client_names
        FROM campaign_jobs cj
        JOIN jobs j2 ON cj.job_id = j2.id
        LEFT JOIN clients cl2 ON j2.client_id = cl2.id
        WHERE cj.campaign_id = c.id
      ) jobs_agg ON true
      LEFT JOIN LATERAL (
        SELECT id, status, started_at, completed_at, summary, stats
        FROM (
          SELECT id, status, started_at, completed_at, summary, stats
          FROM campaign_runs 
          WHERE campaign_id = c.id
          UNION ALL
          SELECT id, status, started_at, completed_at, summary, stats
          FROM warm_join_runs
          WHERE campaign_id = c.id
        ) combined_runs
        ORDER BY started_at DESC 
        LIMIT 1
      ) latest_run ON true
      WHERE 1=1
    `;

    if (status && status !== 'ALL') {
      if (status === 'HIDE_ARCHIVED') {
        query = sql`${query} AND c.status <> 'Archived'`;
      } else {
        query = sql`${query} AND c.status = ${status}`;
      }
    }

    if (campaign_type && campaign_type !== 'ALL') {
      query = sql`${query} AND c.campaign_type = ${campaign_type}`;
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query = sql`${query} AND (
        c.campaign_name ILIKE ${term} 
        OR c.content ILIKE ${term} 
        OR EXISTS (
          SELECT 1 
          FROM campaign_jobs cj 
          JOIN jobs j3 ON cj.job_id = j3.id 
          WHERE cj.campaign_id = c.id AND j3.job_title ILIKE ${term}
        )
      )`;
    }

    query = sql`${query} ORDER BY c.last_updated DESC`;

    const campaigns = await query;
    return { success: true, data: campaigns };
  } catch (error) {
    console.error('[getCampaigns] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch complete campaign detail including target groups, assigned accounts, and run history.
 * @param {string} id - Campaign UUID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getCampaignDetail(id) {
  try {
    const [campaign] = await sql`
      SELECT c.*
      FROM campaigns c
      WHERE c.id = ${id}
    `;

    if (!campaign) {
      return { success: false, error: 'Campaign not found' };
    }

    const linkedJobs = await sql`
      SELECT j.id, j.job_title, cl.name as client_name
      FROM campaign_jobs cj
      JOIN jobs j ON cj.job_id = j.id
      LEFT JOIN clients cl ON j.client_id = cl.id
      WHERE cj.campaign_id = ${id}
      ORDER BY j.job_title ASC
    `;
    campaign.linkedJobs = linkedJobs;

    const targetGroups = await sql`
      SELECT 
        sgu.id,
        sgu.name,
        sgu.url,
        sgu.group_type,
        sgu.join_status,
        sgu.is_active,
        csg.campaign_id
      FROM campaign_social_groups csg
      JOIN social_group_urls sgu ON csg.social_group_id = sgu.id
      WHERE csg.campaign_id = ${id}
      ORDER BY sgu.name ASC
    `;

    const assignedAccounts = await sql`
      SELECT 
        fa.id,
        fa.account_name,
        fa.account_ref,
        fa.fb_profile_url,
        fa.proxy_url,
        fa.reset_ip_url,
        fa.daily_quota,
        fa.status
      FROM campaign_fb_accounts cfa
      JOIN fb_accounts fa ON cfa.fb_account_id = fa.id
      WHERE cfa.campaign_id = ${id}
      ORDER BY fa.account_name ASC
    `;

    // Mask sensitive proxy credentials
    const maskedAssignedAccounts = assignedAccounts.map(acc => ({
      ...acc,
      proxy_url: maskProxyUrl(decryptSecret(acc.proxy_url))
    }));

    const circuitBreakerLog = await sql`
      SELECT cbl.fb_account_id, fa.account_name, cbl.failed_count, cbl.disabled_at, cbl.trigger_type
      FROM campaign_account_circuit_breaker_log cbl
      JOIN fb_accounts fa ON fa.id = cbl.fb_account_id
      WHERE cbl.campaign_id = ${id}
      ORDER BY cbl.disabled_at DESC
    `;

    let runs = [];
    if (campaign.campaign_type === 'Warming') {
      runs = await sql`
        SELECT 
          wjr.*,
          (
            SELECT COUNT(*)::int 
            FROM warm_join_run_items wjri 
            WHERE wjri.run_id = wjr.id AND wjri.action = 'Joined'
          ) as joined_count,
          (
            SELECT COUNT(*)::int 
            FROM warm_join_run_items wjri 
            WHERE wjri.run_id = wjr.id AND wjri.action = 'Warmed'
          ) as warmed_count,
          (
            SELECT COUNT(*)::int 
            FROM warm_join_run_items wjri 
            WHERE wjri.run_id = wjr.id AND wjri.action = 'Failed'
          ) as failed_count
        FROM warm_join_runs wjr
        WHERE wjr.campaign_id = ${id}
        ORDER BY wjr.started_at DESC
        LIMIT 50
      `;
    } else {
      runs = await sql`
        SELECT 
          cr.*,
          (
            SELECT COUNT(*)::int 
            FROM campaign_run_items cri 
            WHERE cri.run_id = cr.id AND cri.status = 'Sent'
          ) as sent_count,
          (
            SELECT COUNT(*)::int 
            FROM campaign_run_items cri 
            WHERE cri.run_id = cr.id AND cri.status = 'Failed'
          ) as failed_count,
          (
            SELECT COUNT(*)::int 
            FROM campaign_run_items cri 
            WHERE cri.run_id = cr.id AND cri.status = 'Checkpoint'
          ) as checkpoint_count
        FROM campaign_runs cr
        WHERE cr.campaign_id = ${id}
        ORDER BY cr.started_at DESC
        LIMIT 50
      `;
    }

    campaign.totalGroupsInPool = targetGroups.length;
    campaign.targetGroupsCount = targetGroups.length;

    return {
      success: true,
      data: {
        campaign,
        targetGroups,
        assignedAccounts: maskedAssignedAccounts,
        runs,
        circuitBreakerLog
      }
    };
  } catch (error) {
    console.error('[getCampaignDetail] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch detailed execution metrics and items for a specific campaign run.
 * @param {string} runId
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getCampaignRunDetail(runId) {
  try {
    const [run] = await sql`
      SELECT 
        cr.*,
        c.campaign_name,
        c.channel,
        c.post_image_url
      FROM campaign_runs cr
      JOIN campaigns c ON cr.campaign_id = c.id
      WHERE cr.id = ${runId}
    `;

    if (!run) {
      return { success: false, error: 'Campaign run not found' };
    }

    const items = await sql`
      SELECT 
        cri.*,
        fa.account_name,
        fa.account_ref
      FROM campaign_run_items cri
      LEFT JOIN fb_accounts fa ON cri.fb_account_id = fa.id
      WHERE cri.run_id = ${runId}
      ORDER BY cri.created_time ASC
    `;

    return {
      success: true,
      data: {
        run,
        items
      }
    };
  } catch (error) {
    console.error('[getCampaignRunDetail] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a new Campaign.
 * @param {Object} data
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export async function createCampaign(data) {
  try {
    const {
      campaign_name,
      campaign_type = 'Job Posting',
      channel = 'Facebook Group',
      post_language = 'vi',
      post_image_url = '',
      content = '',
      target_criteria = '',
      start_date = null,
      end_date = null,
      start_time = '00:00',
      end_time = '23:59',
      status = 'Draft',
      auto_spin_content = false,
      allow_post_without_join = false,
      auto_run_enabled = false,
      target_quota = null,
      max_posts_per_run = 15,
      job_id = null,
      job_ids = [],
      targetGroupIds = [],
      assignedAccountIds = []
    } = data;

    if (!campaign_name || !campaign_name.trim()) {
      return { success: false, error: 'Campaign name is required' };
    }

    const validCreateStatuses = ['Draft', 'Active', 'Archived'];
    const finalStatus = status || 'Draft';
    if (!validCreateStatuses.includes(finalStatus)) {
      return { success: false, error: `Invalid status: "${status}". Must be one of: ${validCreateStatuses.join(', ')}.` };
    }

    const validCampaignTypes = ['Job Posting', 'Warming'];
    const normalizedType = campaign_type || 'Job Posting';
    if (!validCampaignTypes.includes(normalizedType)) {
      return { success: false, error: `Invalid campaign_type: "${campaign_type}". Must be "Job Posting" or "Warming".` };
    }

    const effectiveJobIds = (job_ids && job_ids.length > 0) ? job_ids : (job_id ? [job_id] : []);
    const primaryJobId = effectiveJobIds[0] || null;
    const parsedMaxPosts = parseInt(max_posts_per_run, 10);
    const validatedMaxPostsPerRun = Math.min(15, Math.max(1, isNaN(parsedMaxPosts) ? 15 : parsedMaxPosts));
    const computedIsActive = finalStatus === 'Active';

    const [newCampaign] = await sql.begin(async (sqlTx) => {
      const [inserted] = await sqlTx`
        INSERT INTO campaigns (
          campaign_name, campaign_type, channel, post_language, post_image_url, content,
          target_criteria, start_date, end_date, start_time, end_time, is_active, status,
          auto_spin_content, allow_post_without_join, auto_run_enabled, target_quota, max_posts_per_run, job_id, created_time, last_updated
        ) VALUES (
          ${campaign_name.trim()}, ${normalizedType}, ${channel}, ${post_language}, ${post_image_url || null}, ${content || ''},
          ${target_criteria || null}, ${start_date || null}, ${end_date || null}, ${start_time || '00:00'}, ${end_time || '23:59'}, ${computedIsActive}, ${finalStatus},
          ${Boolean(auto_spin_content)}, ${Boolean(allow_post_without_join)}, ${Boolean(auto_run_enabled)}, ${target_quota ? Number(target_quota) : null}, ${validatedMaxPostsPerRun}, ${primaryJobId}, now(), now()
        )
        RETURNING id
      `;

      if (effectiveJobIds.length > 0) {
        for (const jid of effectiveJobIds) {
          await sqlTx`
            INSERT INTO campaign_jobs (campaign_id, job_id)
            VALUES (${inserted.id}, ${jid})
            ON CONFLICT DO NOTHING
          `;
        }
      }

      if (targetGroupIds && targetGroupIds.length > 0) {
        for (const groupId of targetGroupIds) {
          await sqlTx`
            INSERT INTO campaign_social_groups (campaign_id, social_group_id)
            VALUES (${inserted.id}, ${groupId})
            ON CONFLICT DO NOTHING
          `;
        }
      }

      if (assignedAccountIds && assignedAccountIds.length > 0) {
        for (const accId of assignedAccountIds) {
          await sqlTx`
            INSERT INTO campaign_fb_accounts (campaign_id, fb_account_id)
            VALUES (${inserted.id}, ${accId})
            ON CONFLICT DO NOTHING
          `;
        }
      }

      return [inserted];
    });

    revalidatePath('/campaigns');
    revalidatePath('/');
    return { success: true, id: newCampaign.id };
  } catch (error) {
    console.error('[createCampaign] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update an existing Campaign.
 * @param {string} id
 * @param {Object} data
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateCampaign(id, data) {
  try {
    const {
      campaign_name,
      campaign_type,
      channel,
      post_language,
      post_image_url,
      content,
      target_criteria,
      start_date,
      end_date,
      start_time,
      end_time,
      status,
      auto_spin_content,
      allow_post_without_join,
      auto_run_enabled,
      target_quota,
      max_posts_per_run,
      job_id,
      job_ids,
      targetGroupIds,
      assignedAccountIds
    } = data;

    // If campaign_type is provided and changing, check if runs already exist
    if (campaign_type !== undefined) {
      const validCampaignTypes = ['Job Posting', 'Warming'];
      if (!validCampaignTypes.includes(campaign_type)) {
        return { success: false, error: `Invalid campaign_type: "${campaign_type}". Must be "Job Posting" or "Warming".` };
      }

      const [curr] = await sql`SELECT campaign_type FROM campaigns WHERE id = ${id}`;
      if (!curr) {
        return { success: false, error: 'Campaign not found' };
      }

      if (curr.campaign_type !== campaign_type) {
        const [{ exists: hasPostingRuns }] = await sql`SELECT EXISTS(SELECT 1 FROM campaign_runs WHERE campaign_id = ${id})`;
        const [{ exists: hasWarmRuns }] = await sql`SELECT EXISTS(SELECT 1 FROM warm_join_runs WHERE campaign_id = ${id})`;
        if (hasPostingRuns || hasWarmRuns) {
          return { success: false, error: 'Không thể đổi loại Campaign sau khi đã có lượt chạy.' };
        }
      }
    }

    if (status !== undefined) {
      const validStatuses = ['Draft', 'Active', 'Archived'];
      if (!validStatuses.includes(status)) {
        return { success: false, error: `Invalid status: "${status}". Must be one of: ${validStatuses.join(', ')}.` };
      }
    }

    let validatedMaxPostsPerRun = undefined;
    if (max_posts_per_run !== undefined) {
      const parsedMaxPosts = parseInt(max_posts_per_run, 10);
      validatedMaxPostsPerRun = Math.min(15, Math.max(1, isNaN(parsedMaxPosts) ? 15 : parsedMaxPosts));
    }

    await sql.begin(async (sqlTx) => {
      await sqlTx`
        UPDATE campaigns SET
          campaign_name = COALESCE(${campaign_name ? campaign_name.trim() : null}, campaign_name),
          campaign_type = CASE WHEN ${campaign_type !== undefined} THEN ${campaign_type || null} ELSE campaign_type END,
          channel = COALESCE(${channel || null}, channel),
          post_language = COALESCE(${post_language || null}, post_language),
          post_image_url = CASE WHEN ${post_image_url !== undefined} THEN ${post_image_url || null} ELSE post_image_url END,
          content = COALESCE(${content !== undefined ? content : null}, content),
          target_criteria = CASE WHEN ${target_criteria !== undefined} THEN ${target_criteria || null} ELSE target_criteria END,
          start_date = CASE WHEN ${start_date !== undefined} THEN ${start_date || null} ELSE start_date END,
          end_date = CASE WHEN ${end_date !== undefined} THEN ${end_date || null} ELSE end_date END,
          start_time = CASE WHEN ${start_time !== undefined} THEN ${start_time || '00:00'} ELSE start_time END,
          end_time = CASE WHEN ${end_time !== undefined} THEN ${end_time || '23:59'} ELSE end_time END,
          status = CASE WHEN ${status !== undefined} THEN ${status || null} ELSE status END,
          is_active = CASE WHEN ${status !== undefined} THEN ${status === 'Active'} ELSE is_active END,
          auto_spin_content = COALESCE(${auto_spin_content !== undefined ? auto_spin_content : null}, auto_spin_content),
          allow_post_without_join = COALESCE(${allow_post_without_join !== undefined ? Boolean(allow_post_without_join) : null}, allow_post_without_join),
          auto_run_enabled = COALESCE(${auto_run_enabled !== undefined ? Boolean(auto_run_enabled) : null}, auto_run_enabled),
          target_quota = CASE WHEN ${target_quota !== undefined} THEN ${target_quota ? Number(target_quota) : null} ELSE target_quota END,
          max_posts_per_run = CASE WHEN ${validatedMaxPostsPerRun !== undefined} THEN ${validatedMaxPostsPerRun !== undefined ? validatedMaxPostsPerRun : null} ELSE max_posts_per_run END,
          job_id = CASE 
            WHEN ${job_ids !== undefined} THEN ${(job_ids && job_ids.length > 0) ? job_ids[0] : null}
            WHEN ${job_id !== undefined} THEN ${job_id || null} 
            ELSE job_id 
          END,
          last_updated = now()
        WHERE id = ${id}
      `;

      if (job_ids !== undefined) {
        await sqlTx`DELETE FROM campaign_jobs WHERE campaign_id = ${id}`;
        if (job_ids.length > 0) {
          for (const jid of job_ids) {
            await sqlTx`
              INSERT INTO campaign_jobs (campaign_id, job_id)
              VALUES (${id}, ${jid})
              ON CONFLICT DO NOTHING
            `;
          }
        }
      }

      if (targetGroupIds !== undefined) {
        await sqlTx`DELETE FROM campaign_social_groups WHERE campaign_id = ${id}`;
        if (targetGroupIds.length > 0) {
          for (const groupId of targetGroupIds) {
            await sqlTx`
              INSERT INTO campaign_social_groups (campaign_id, social_group_id)
              VALUES (${id}, ${groupId})
              ON CONFLICT DO NOTHING
            `;
          }
        }
      }

      if (assignedAccountIds !== undefined) {
        await sqlTx`DELETE FROM campaign_fb_accounts WHERE campaign_id = ${id}`;
        if (assignedAccountIds.length > 0) {
          for (const accId of assignedAccountIds) {
            await sqlTx`
              INSERT INTO campaign_fb_accounts (campaign_id, fb_account_id)
              VALUES (${id}, ${accId})
              ON CONFLICT DO NOTHING
            `;
          }
        }
      }
    });

    revalidatePath('/campaigns');
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('[updateCampaign] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Replace all target social groups for a campaign.
 * @param {string} campaignId
 * @param {string[]} groupIds
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function setCampaignTargetGroups(campaignId, groupIds = []) {
  try {
    await sql.begin(async (sqlTx) => {
      await sqlTx`DELETE FROM campaign_social_groups WHERE campaign_id = ${campaignId}`;
      if (groupIds && groupIds.length > 0) {
        for (const groupId of groupIds) {
          await sqlTx`
            INSERT INTO campaign_social_groups (campaign_id, social_group_id)
            VALUES (${campaignId}, ${groupId})
            ON CONFLICT DO NOTHING
          `;
        }
      }
    });
    revalidatePath('/campaigns');
    return { success: true };
  } catch (error) {
    console.error('[setCampaignTargetGroups] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Replace all assigned FB accounts for a campaign.
 * @param {string} campaignId
 * @param {string[]} accountIds
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function setCampaignAssignedAccounts(campaignId, accountIds = []) {
  try {
    await sql.begin(async (sqlTx) => {
      await sqlTx`DELETE FROM campaign_fb_accounts WHERE campaign_id = ${campaignId}`;
      if (accountIds && accountIds.length > 0) {
        for (const accId of accountIds) {
          await sqlTx`
            INSERT INTO campaign_fb_accounts (campaign_id, fb_account_id)
            VALUES (${campaignId}, ${accId})
            ON CONFLICT DO NOTHING
          `;
        }
      }
    });
    revalidatePath('/campaigns');
    return { success: true };
  } catch (error) {
    console.error('[setCampaignAssignedAccounts] Error:', error);
    return { success: false, error: error.message };
  }
}


/**
 * Nhận diện lỗi 'Failed' có thật sự phản ánh TÀI KHOẢN có vấn đề (cần con người đăng
 * nhập lại) hay không — dùng để lọc sự kiện tính vào ngưỡng trip circuit breaker.
 * KHÔNG tính lỗi UI selector/network/timeout/"chưa join group" (không phải lỗi account,
 * xem FIX_SPEC_2026-09-18b). Khớp CHÍNH XÁC với điều kiện ILIKE dùng trong 2 webhook
 * route (campaign-run-progress, warm-join-run-progress) — sửa ở đây thì PHẢI sửa đồng
 * bộ cả 2 nơi đó.
 */
export async function isAccountHealthFailure(errorMessage) {
  if (!errorMessage) return false;
  const msg = String(errorMessage).toLowerCase();
  return (
    msg.includes('session expired') ||
    msg.includes('login required') ||
    msg.includes('fb-session.json not found')
  );
}

/**
 * Nếu failedCount >= 3: gỡ thật account khỏi campaign_fb_accounts (circuit breaker),
 * ghi log vào campaign_account_circuit_breaker_log để _getEligibilityState / warming
 * resolve biết mà CHẶN fallback "dùng tất cả account Active" cho đúng campaign này.
 * Gọi trong CÙNG transaction với insert item Failed vừa ghi.
 */
export async function _maybeTripCircuitBreaker(sqlTx, campaignId, fbAccountId, failedCount, triggerType) {
  if (!campaignId || !fbAccountId || failedCount < 3) return;

  const deleted = await sqlTx`
    DELETE FROM campaign_fb_accounts
    WHERE campaign_id = ${campaignId} AND fb_account_id = ${fbAccountId}
    RETURNING fb_account_id
  `;

  if (deleted.length > 0) {
    await sqlTx`
      INSERT INTO campaign_account_circuit_breaker_log (campaign_id, fb_account_id, trigger_type, failed_count, disabled_at)
      VALUES (${campaignId}, ${fbAccountId}, ${triggerType}, ${failedCount}, now())
      ON CONFLICT (campaign_id, fb_account_id) DO UPDATE SET
        failed_count = EXCLUDED.failed_count,
        disabled_at = EXCLUDED.disabled_at,
        trigger_type = EXCLUDED.trigger_type
    `;
  }
}

/**
 * Internal helper to retrieve the latest eligibility state for a campaign:
 * Active target groups, active FB accounts (with remaining daily quotas),
 * 24h posting cooldowns, and group-account joined mappings.
 * 
 * Shared between `computeCampaignDispatchPreview` and `triggerCampaignRun`.
 * 
 * @param {string} campaignId
 * @param {import('../lib/db.js').Sql} sqlClient - sql or sqlTx
 * @returns {Promise<{
 *   targetGroups: Array,
 *   campaignGroupIds: Set<string>,
 *   accountState: Map<string, Object>,
 *   recentSet: Set<string>,
 *   joinedMap: Map<string, Set<string>>
 * }>}
 */
async function _getEligibilityState(campaignId, sqlClient) {
  // 1. Fetch Target Groups currently linked to campaign and active
  const targetGroups = await sqlClient`
    SELECT sgu.id, sgu.name, sgu.url, sgu.group_type, sgu.join_status
    FROM campaign_social_groups csg
    JOIN social_group_urls sgu ON csg.social_group_id = sgu.id
    WHERE csg.campaign_id = ${campaignId} AND sgu.is_active = true
    ORDER BY sgu.name ASC
  `;

  const campaignGroupIds = new Set(targetGroups.map(g => g.id));

  // 2. Fetch Eligible Accounts (assigned to campaign or fallback to all active accounts)
  let eligibleAccounts = await sqlClient`
    SELECT fa.id, fa.account_name, fa.account_ref, fa.daily_quota, fa.status, fa.proxy_url, fa.reset_ip_url, fa.allow_post_without_join
    FROM campaign_fb_accounts cfa
    JOIN fb_accounts fa ON cfa.fb_account_id = fa.id
    WHERE cfa.campaign_id = ${campaignId} AND fa.status = 'Active'
  `;

  if (eligibleAccounts.length === 0) {
    // Chỉ fallback sang "tất cả account Active" nếu campaign này CHƯA TỪNG bị circuit
    // breaker tự gỡ account — tránh campaign âm thầm đổi sang account khác ngoài ý định
    // PO chỉ vì vừa bị gỡ hết account được chỉ định (PO quyết định 2026-09-15).
    const breakerHit = await sqlClient`
      SELECT 1 FROM campaign_account_circuit_breaker_log WHERE campaign_id = ${campaignId} LIMIT 1
    `;
    if (breakerHit.length === 0) {
      eligibleAccounts = await sqlClient`
        SELECT id, account_name, account_ref, daily_quota, status, proxy_url, reset_ip_url, allow_post_without_join
        FROM fb_accounts
        WHERE status = 'Active'
      `;
    }
  }

  // Filter out busy accounts currently engaged in Warming, Sync, or another active Job Posting run
  const busyAccountIds = await _getBusyFbAccountIds(sqlClient);
  if (busyAccountIds.length > 0) {
    eligibleAccounts = eligibleAccounts.filter(a => !busyAccountIds.includes(a.id));
  }

  // 3. Check 24-hour Cooldown on Target Groups & 3-hour Cooldown on Interrupted Groups
  let recentSet = new Set();
  if (targetGroups.length > 0) {
    const recentlyPostedOrInterruptedGroupIds = await sqlClient`
      SELECT DISTINCT social_group_id
      FROM campaign_run_items
      WHERE social_group_id = ANY(${targetGroups.map(g => g.id)})
        AND (
          (status = 'Sent' AND posted_at > now() - interval '24 hours')
          OR (status = 'Interrupted' AND retry_eligible_at > now())
        )
    `;
    recentSet = new Set(recentlyPostedOrInterruptedGroupIds.map(r => r.social_group_id));
  }

  // 4. Calculate today's posts per account
  const todayPosts = await sqlClient`
    SELECT fb_account_id, COUNT(*)::int as count
    FROM campaign_run_items
    WHERE status = 'Sent'
      AND posted_at >= date_trunc('day', now())
    GROUP BY fb_account_id
  `;
  const todayPostsMap = new Map(todayPosts.map(tp => [tp.fb_account_id, tp.count]));

  // Account quota tracking map
  const accountState = new Map();
  for (const acc of eligibleAccounts) {
    const postsToday = todayPostsMap.get(acc.id) || 0;
    // Daily Post Quota enforcement removed per User request (2026-09-07 FIX_SPEC)
    const remainingQuota = Number.MAX_SAFE_INTEGER;
    accountState.set(acc.id, {
      ...acc,
      postsToday,
      remainingQuota,
      assignedThisRun: 0
    });
  }

  // 5. Fetch Account Joined Groups Map
  const joinedMap = new Map(); // socialGroupId -> Set of accountIds
  if (targetGroups.length > 0) {
    const joinedRows = await sqlClient`
      SELECT fb_account_id, social_group_id
      FROM fb_account_groups
      WHERE social_group_id = ANY(${targetGroups.map(g => g.id)})
    `;
    for (const row of joinedRows) {
      if (!joinedMap.has(row.social_group_id)) {
        joinedMap.set(row.social_group_id, new Set());
      }
      joinedMap.get(row.social_group_id).add(row.fb_account_id);
    }
  }

  return {
    targetGroups,
    campaignGroupIds,
    accountState,
    recentSet,
    joinedMap
  };
}

const SAFE_DISPATCH_BATCH_SIZE_MAX = 15;
const SAFE_TOTAL_WARM_ACTIONS = 20; // ~2.5 phút/action, quỹ 50 phút trước ngưỡng cứng 55 phút (BRIDGE_TIMEOUT_MS)

/**
 * Smart Dispatcher Server-Side computation:
 * Pre-computes group-to-account assignments, 24h cooldown, and load balancing
 * for In-App HITL Preview Modal.
 * 
 * @param {string} campaignId
 * @returns {Promise<{success: boolean, dispatch?: Array, stats?: Object, error?: string}>}
 */
export async function computeCampaignDispatchPreview(campaignId) {
  try {
    const [campaign] = await sql`
      SELECT id, campaign_name, is_active, status, max_posts_per_run, allow_post_without_join, end_date
      FROM campaigns 
      WHERE id = ${campaignId}
    `;

    if (!campaign) {
      return { success: false, error: 'Campaign not found' };
    }

    const circuitBreakerLog = await sql`
      SELECT fa.account_name, cbl.failed_count
      FROM campaign_account_circuit_breaker_log cbl
      JOIN fb_accounts fa ON fa.id = cbl.fb_account_id
      WHERE cbl.campaign_id = ${campaignId}
      ORDER BY cbl.disabled_at DESC
    `;

    const {
      targetGroups,
      accountState,
      recentSet,
      joinedMap
    } = await _getEligibilityState(campaignId, sql);

    const totalInCampaign = targetGroups.length;
    if (totalInCampaign === 0) {
      return {
        success: true,
        dispatch: [],
        stats: {
          totalInCampaign: 0,
          eligibleCount: 0,
          skippedRecentlyCount: 0,
          skippedNoUrlCount: 0,
          skippedNoAccountAvailable: 0,
          circuitBreakerRemovedAccounts: circuitBreakerLog
        }
      };
    }

    let skippedNoUrlCount = 0;
    let skippedRecentlyCount = 0;
    let skippedNoAccountAvailable = 0;
    const dispatchedJobs = [];

    // Match each target group to the best available account
    for (const group of targetGroups) {
      if (!group.url || !group.url.trim()) {
        skippedNoUrlCount++;
        continue;
      }

      if (recentSet.has(group.id)) {
        skippedRecentlyCount++;
        continue;
      }

      // Filter accounts with remaining quota
      const candidates = Array.from(accountState.values()).filter(a => a.remainingQuota > 0);

      if (candidates.length === 0) {
        skippedNoAccountAvailable++;
        continue;
      }

      const joinedAccountsSet = joinedMap.get(group.id) || new Set();

      // Sort candidate accounts:
      // Priority 1: Has joined the group
      // Priority 2: Lowest (postsToday + assignedThisRun) for load balancing
      candidates.sort((a, b) => {
        const aJoined = joinedAccountsSet.has(a.id) ? 1 : 0;
        const bJoined = joinedAccountsSet.has(b.id) ? 1 : 0;
        if (aJoined !== bJoined) {
          return bJoined - aJoined; // Joined first
        }
        const aLoad = a.postsToday + a.assignedThisRun;
        const bLoad = b.postsToday + b.assignedThisRun;
        return aLoad - bLoad;
      });

      const selectedAccount = candidates[0];
      selectedAccount.assignedThisRun++;
      selectedAccount.remainingQuota--;

      const isAccountAllowed = Boolean(selectedAccount.allow_post_without_join);
      const isCampaignAllowed = Boolean(campaign.allow_post_without_join);
      const allowPostWithoutJoin = isCampaignAllowed || isAccountAllowed;

      dispatchedJobs.push({
        socialGroupId: group.id,
        groupName: group.name,
        groupUrl: group.url,
        fbAccountId: selectedAccount.id,
        accountName: selectedAccount.account_name,
        accountRef: selectedAccount.account_ref,
        proxyUrl: selectedAccount.proxy_url ? maskProxyUrl(decryptSecret(selectedAccount.proxy_url)) : "Direct IP (Host)",
        resetIpUrl: selectedAccount.reset_ip_url || '',
        isJoined: joinedAccountsSet.has(selectedAccount.id),
        allowPostWithoutJoin
      });
    }

    // Total target pool for this campaign
    const [{ total_target_pool }] = await sql`
      SELECT COUNT(DISTINCT social_group_id)::int AS total_target_pool
      FROM campaign_social_groups
      WHERE campaign_id = ${campaignId}
    `;

    // Calculate processed_count towards pool completion (Sent + Failed from valid non-systemic runs)
    const [{ processed_count }] = await sql`
      SELECT COUNT(DISTINCT social_group_id)::int AS processed_count
      FROM campaign_run_items
      WHERE run_id IN (SELECT id FROM campaign_runs WHERE campaign_id = ${campaignId} AND (is_systemic_failure = false OR is_systemic_failure IS NULL))
        AND status IN ('Sent', 'Failed')
    `;

    const totalTargetPool = Number(total_target_pool || 0);
    const totalSentOrProcessed = Number(processed_count || 0);
    const quotaRemaining = Math.max(0, totalTargetPool - totalSentOrProcessed);

    const effectiveMaxPostsPerRun = Math.min(campaign.max_posts_per_run || 15, SAFE_DISPATCH_BATCH_SIZE_MAX);
    const dispatchLimit = Math.min(quotaRemaining, effectiveMaxPostsPerRun);
    let finalDispatch = dispatchedJobs.slice(0, dispatchLimit);

    const previewResult = {
      dispatch: finalDispatch,
      allowPostWithoutJoin: !!campaign.allow_post_without_join,
      totalTargetPool,
      totalSentOrProcessed,
      quotaRemaining,
      maxPostsPerRun: effectiveMaxPostsPerRun,
      safeDispatchBatchSize: effectiveMaxPostsPerRun,
      finalDispatchBatchCount: finalDispatch.length,
      stats: {
        totalInCampaign,
        eligibleCount: finalDispatch.length,
        skippedRecentlyCount,
        skippedNoUrlCount,
        skippedNoAccountAvailable,
        totalTargetPool,
        totalSentOrProcessed,
        quotaRemaining,
        maxPostsPerRun: effectiveMaxPostsPerRun,
        safeDispatchBatchSize: effectiveMaxPostsPerRun,
        circuitBreakerRemovedAccounts: circuitBreakerLog
      }
    };

    return {
      success: true,
      data: previewResult,
      ...previewResult
    };
  } catch (error) {
    console.error('[computeCampaignDispatchPreview] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Internal execution helper for triggering a Campaign Run.
 * Used by both UI Server Actions (HITL Manual) and Webhook Routes (Auto-Scheduler).
 * 
 * @param {Object} params
 * @param {string} params.campaignId
 * @param {Array} params.confirmedDispatch
 * @param {string} [params.triggerSource='HITL_Manual']
 * @param {string} [params.triggeredBy='ats_ui']
 * @returns {Promise<{success: boolean, runId?: string, notificationId?: string, error?: string}>}
 */
export async function _executeCampaignRunInternal({
  campaignId,
  confirmedDispatch = [],
  triggerSource = 'HITL_Manual',
  triggeredBy = 'ats_ui'
}) {
  if (!confirmedDispatch || confirmedDispatch.length === 0) {
    return { success: false, error: 'No dispatched groups selected for this run' };
  }

  let runResult = null;
  let campaignInfo = null;
  let finalValidatedDispatch = null;

  await sql.begin(async (sqlTx) => {
    // 1. Transaction Lock against race conditions
    await sqlTx`SELECT pg_advisory_xact_lock(hashtext(${campaignId}::text))`;

    // 2. Verify campaign exists and is active
    const [campaign] = await sqlTx`
      SELECT id, campaign_name, campaign_type, channel, content, post_image_url, post_language, auto_spin_content, allow_post_without_join, is_active, status
      FROM campaigns
      WHERE id = ${campaignId}
    `;

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.campaign_type !== 'Job Posting') {
      throw new Error('Campaign này không phải loại Job Posting.');
    }

    if (!campaign.is_active) {
      throw new Error('Campaign is currently inactive');
    }

    // 3. Verify no existing Running run
    const [existingRun] = await sqlTx`
      SELECT id FROM campaign_runs
      WHERE campaign_id = ${campaignId} AND status = 'Running'
      LIMIT 1
    `;

    if (existingRun) {
      throw new Error('A run is already in progress for this campaign');
    }

    campaignInfo = campaign;

    // 4. Re-validate confirmedDispatch against latest database state in this transaction
    const {
      campaignGroupIds,
      accountState,
      recentSet
    } = await _getEligibilityState(campaignId, sqlTx);

    const validatedDispatch = [];
    const droppedItems = [];

    for (const item of confirmedDispatch) {
      // Check 1: Group still active and linked to campaign
      if (!item.socialGroupId || !campaignGroupIds.has(item.socialGroupId)) {
        droppedItems.push({
          ...item,
          reason: 'group_removed_or_inactive'
        });
        continue;
      }

      // Check 2: 24h Cooldown / Interrupted Cooldown
      if (recentSet.has(item.socialGroupId)) {
        droppedItems.push({
          ...item,
          reason: 'cooldown_active'
        });
        continue;
      }

      // Check 3: Account is still active
      const acc = accountState.get(item.fbAccountId);
      if (!acc || acc.status !== 'Active') {
        droppedItems.push({
          ...item,
          reason: 'account_not_active'
        });
        continue;
      }

      // Check 4: Account quota
      if (acc.remainingQuota <= 0) {
        droppedItems.push({
          ...item,
          reason: 'quota_exceeded'
        });
        continue;
      }

      // Deduct quota for subsequent items assigned to this account in this run
      acc.remainingQuota--;

      const allowPostWithoutJoin = Boolean(campaignInfo.allow_post_without_join || acc.allow_post_without_join);
      validatedDispatch.push({
        ...item,
        proxyUrl: acc.proxy_url ? decryptSecret(acc.proxy_url) : '',
        resetIpUrl: acc.reset_ip_url || '',
        allowPostWithoutJoin
      });
    }

    if (validatedDispatch.length === 0) {
      throw new Error('Tất cả các nhóm trong dispatch đã không còn hợp lệ (đã đổi trạng thái từ lúc xem trước). Vui lòng mở lại modal xem trước và thử lại.');
    }

    finalValidatedDispatch = validatedDispatch;

    // 5. Create Notification
    const notifTitle = triggerSource === 'Auto-Scheduler'
      ? 'Đang tự động khởi chạy chiến dịch...'
      : 'Đang khởi chạy chiến dịch...';

    const [notif] = await sqlTx`
      INSERT INTO notifications (
        type, title, message, severity, link, metadata, created_at, updated_at
      ) VALUES (
        'campaign_started',
        ${notifTitle},
        ${'Chiến dịch "' + campaign.campaign_name + '" đã bắt đầu: 0/' + validatedDispatch.length + ' nhóm hoàn tất'},
        'info',
        ${'/campaigns?campaign_id=' + campaignId},
        ${sql.json({
          campaignId,
          campaignName: campaign.campaign_name,
          total: validatedDispatch.length,
          completed: 0,
          sent: 0,
          failed: 0,
          skipped: 0,
          triggerSource
        })},
        now(), now()
      )
      RETURNING id
    `;

    // 6. Create Campaign Run
    const runStats = {
      totalDispatched: validatedDispatch.length,
      dispatchSnapshot: validatedDispatch
    };
    if (droppedItems.length > 0) {
      runStats.droppedItems = droppedItems;
    }

    const [run] = await sqlTx`
      INSERT INTO campaign_runs (
        campaign_id, status, triggered_by, trigger_source, notification_id,
        stats, started_at, created_time
      ) VALUES (
        ${campaignId},
        'Running',
        ${triggeredBy},
        ${triggerSource},
        ${notif.id},
        ${sql.json(runStats)},
        now(), now()
      )
      RETURNING id
    `;

    // 7. Update Campaign last_updated
    await sqlTx`
      UPDATE campaigns 
      SET last_updated = now()
      WHERE id = ${campaignId}
    `;

    runResult = {
      runId: run.id,
      notificationId: notif.id
    };
  });

  // 8. Dispatch to n8n Webhook outside transaction
  if (process.env.N8N_CAMPAIGN_TRIGGER_WEBHOOK_URL && runResult?.runId && finalValidatedDispatch) {
    const webhookUrl = process.env.N8N_CAMPAIGN_TRIGGER_WEBHOOK_URL;
    const webhookSecret = process.env.INTERNAL_WEBHOOK_SECRET || '';
    const webhookEnvironment = process.env.DB_SCHEMA || 'public';
    const payload = {
      runId: runResult.runId,
      campaignId,
      dispatch: finalValidatedDispatch,
      content: campaignInfo.content,
      postImageUrl: campaignInfo.post_image_url,
      postLanguage: campaignInfo.post_language,
      autoSpinContent: campaignInfo.auto_spin_content,
      allowPostWithoutJoin: !!campaignInfo.allow_post_without_join,
      environment: webhookEnvironment
    };

    after(async () => {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': webhookSecret
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000)
        });
      } catch (err) {
        console.error('[_executeCampaignRunInternal] Warning: Failed to notify n8n webhook:', err.message);
      }
    });
  }

  revalidatePath('/campaigns');
  revalidatePath('/');
  return { success: true, ...runResult };
}

/**
 * Trigger Campaign Run: Locks the campaign, re-validates dispatch against latest DB state,
 * inserts notifications and campaign_runs, updates status to Running, and triggers n8n webhook.
 * 
 * @param {string} campaignId
 * @param {Array} confirmedDispatch - Dispatched items approved by User
 * @returns {Promise<{success: boolean, runId?: string, notificationId?: string, error?: string}>}
 */
export async function triggerCampaignRun(campaignId, confirmedDispatch = []) {
  try {
    await assertRealRequestContext('triggerCampaignRun');
    return await _executeCampaignRunInternal({
      campaignId,
      confirmedDispatch,
      triggerSource: 'HITL_Manual',
      triggeredBy: 'ats_ui'
    });
  } catch (error) {
    console.error('[triggerCampaignRun] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check Campaign Auto-Completion against Target Pool & End Date:
 * Evaluates whether campaign end_date has passed, or total processed groups (Sent + Failed)
 * has covered the entire target pool.
 * If reached, closes the campaign (is_active = false, auto_run_enabled = false, status = 'Ready')
 * and emits a completion notification.
 * 
 * @param {string} campaignId
 * @param {Object} [sqlClient=sql]
 * @returns {Promise<{success: boolean, completed?: boolean, completedReason?: string, totalProcessed?: number, totalTargetPool?: number, error?: string}>}
 */
export async function checkCampaignAutoCompletion(campaignId, sqlClient = sql) {
  try {
    const [campaign] = await sqlClient`
      SELECT id, campaign_name, is_active, auto_run_enabled, status, end_date
      FROM campaigns
      WHERE id = ${campaignId}
    `;

    if (!campaign) {
      return { success: false, error: 'Campaign not found' };
    }

    // 1. End date check first
    if (campaign.end_date && new Date(campaign.end_date) < new Date(new Date().toDateString())) {
      await sqlClient`
        UPDATE campaigns SET
          is_active = false,
          auto_run_enabled = false,
          status = 'Archived',
          last_updated = now()
        WHERE id = ${campaignId}
      `;

      await sqlClient`
        INSERT INTO notifications (
          type, title, message, severity, link, metadata, created_at, updated_at
        ) VALUES (
          'campaign_completed',
          'Chiến dịch đã hết hạn',
          ${`Chiến dịch "${campaign.campaign_name}" đã hết hạn (end date) và tự động kết thúc.`},
          'success',
          ${'/campaigns?campaign_id=' + campaignId},
          ${sqlClient.json({
            campaignId,
            campaignName: campaign.campaign_name,
            reason: 'end_date'
          })},
          now(), now()
        )
      `;

      revalidatePath('/campaigns');
      return { success: true, completed: true, completedReason: 'end_date' };
    }

    // 2. Pool coverage check
    const [stats] = await sqlClient`
      SELECT 
        COUNT(DISTINCT csg.social_group_id)::int AS total_target_pool,
        COUNT(DISTINCT cri.social_group_id) FILTER (WHERE cri.status IN ('Sent', 'Failed'))::int AS total_processed
      FROM campaign_social_groups csg
      LEFT JOIN campaign_run_items cri
        ON cri.social_group_id = csg.social_group_id
        AND cri.run_id IN (
          SELECT id FROM campaign_runs WHERE campaign_id = ${campaignId} AND (is_systemic_failure = false OR is_systemic_failure IS NULL)
        )
      WHERE csg.campaign_id = ${campaignId}
    `;

    const totalTargetPool = Number(stats?.total_target_pool || 0);
    const totalProcessed = Number(stats?.total_processed || 0);

    if (totalTargetPool > 0 && totalProcessed >= totalTargetPool) {
      await sqlClient`
        UPDATE campaigns SET
          is_active = false,
          auto_run_enabled = false,
          status = 'Archived',
          last_updated = now()
        WHERE id = ${campaignId}
      `;

      // Create completion notification
      await sqlClient`
        INSERT INTO notifications (
          type, title, message, severity, link, metadata, created_at, updated_at
        ) VALUES (
          'campaign_completed',
          'Chiến dịch đã hoàn tất',
          ${`Chiến dịch "${campaign.campaign_name}" đã hoàn tất toàn bộ nhóm mục tiêu (${totalProcessed}/${totalTargetPool} nhóm) và tự động kết thúc.`},
          'success',
          ${'/campaigns?campaign_id=' + campaignId},
          ${sqlClient.json({
            campaignId,
            campaignName: campaign.campaign_name,
            totalProcessed,
            totalTargetPool,
            reason: 'quota'
          })},
          now(), now()
        )
      `;

      revalidatePath('/campaigns');
      return { success: true, completed: true, completedReason: 'quota', totalProcessed, totalTargetPool };
    }

    return { success: true, completed: false, totalProcessed, totalTargetPool };
  } catch (error) {
    console.error('[checkCampaignAutoCompletion] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check Warming Campaign Auto-Completion against End Date & Group Join Coverage:
 * Evaluates whether end_date has passed, or all active non-disabled accounts have joined all target groups.
 * If reached, closes the campaign (is_active = false, auto_run_enabled = false) and emits a notification.
 * 
 * @param {string} campaignId
 * @param {Object} [sqlClient=sql]
 * @returns {Promise<{success: boolean, completed?: boolean, reason?: string, remainingWork?: number, error?: string}>}
 */
export async function checkWarmingCampaignAutoCompletion(campaignId, sqlClient = sql) {
  try {
    const [campaign] = await sqlClient`
      SELECT id, campaign_name, is_active, auto_run_enabled, end_date
      FROM campaigns WHERE id = ${campaignId} AND campaign_type = 'Warming'
    `;
    if (!campaign) return { success: false, error: 'Campaign not found or not Warming type' };

    // 1. End date check first
    if (campaign.end_date && new Date(campaign.end_date) < new Date(new Date().toDateString())) {
      await sqlClient`
        UPDATE campaigns SET status = 'Archived', is_active = false, auto_run_enabled = false, last_updated = now()
        WHERE id = ${campaignId}
      `;
      await sqlClient`
        INSERT INTO notifications (type, title, message, severity, link, metadata, created_at, updated_at)
        VALUES ('campaign_completed', 'Chiến dịch Warming đã hết hạn',
          ${`Chiến dịch "${campaign.campaign_name}" đã hết end_date và tự động kết thúc.`},
          'success', ${'/campaigns?campaign_id=' + campaignId},
          ${sqlClient.json({ campaignId, campaignName: campaign.campaign_name, reason: 'end_date' })},
          now(), now())
      `;
      revalidatePath('/campaigns');
      return { success: true, completed: true, reason: 'end_date' };
    }

    // Guard: nếu campaign_social_groups hoặc campaign_fb_accounts rỗng, không tự đóng campaign chưa cấu hình
    const [{ group_count, account_count }] = await sqlClient`
      SELECT 
        (SELECT COUNT(*)::int FROM campaign_social_groups WHERE campaign_id = ${campaignId}) AS group_count,
        (SELECT COUNT(*)::int FROM campaign_fb_accounts WHERE campaign_id = ${campaignId}) AS account_count
    `;
    if (Number(group_count) === 0 || Number(account_count) === 0) {
      return { success: true, completed: false, remainingWork: 0, reason: 'unconfigured_campaign' };
    }

    // 2. Tính: còn account nào trong campaign_fb_accounts (đã tự loại account bị breaker
    // gỡ — vì _maybeTripCircuitBreaker xóa dòng gán thật rồi) mà CHƯA join hết group không?
    const [{ remaining_work }] = await sqlClient`
      SELECT COUNT(*)::int AS remaining_work
      FROM campaign_fb_accounts cfa
      CROSS JOIN campaign_social_groups csg
      WHERE cfa.campaign_id = ${campaignId} AND csg.campaign_id = ${campaignId}
        AND NOT EXISTS (
          SELECT 1 FROM fb_account_groups fag
          WHERE fag.fb_account_id = cfa.fb_account_id AND fag.social_group_id = csg.social_group_id
        )
    `;

    if (Number(remaining_work) === 0) {
      await sqlClient`
        UPDATE campaigns SET status = 'Archived', is_active = false, auto_run_enabled = false, last_updated = now()
        WHERE id = ${campaignId}
      `;
      await sqlClient`
        INSERT INTO notifications (type, title, message, severity, link, metadata, created_at, updated_at)
        VALUES ('campaign_completed', 'Chiến dịch Warming đã hoàn tất',
          ${`Chiến dịch "${campaign.campaign_name}" đã hoàn tất: mọi tài khoản còn hoạt động đã join hết group mục tiêu.`},
          'success', ${'/campaigns?campaign_id=' + campaignId},
          ${sqlClient.json({ campaignId, campaignName: campaign.campaign_name, reason: 'full_coverage' })},
          now(), now())
      `;
      revalidatePath('/campaigns');
      return { success: true, completed: true, reason: 'full_coverage' };
    }

    return { success: true, completed: false, remainingWork: Number(remaining_work) };
  } catch (error) {
    console.error('[checkWarmingCampaignAutoCompletion] Error:', error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// 3. FB ACCOUNTS CRUD & MANAGEMENT
// ==========================================

/**
 * Fetch all FB Accounts with masked credentials and metrics.
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getFbAccounts() {
  try {
    const accounts = await sql`
      SELECT 
        fa.id,
        fa.notion_id,
        fa.account_name,
        fa.account_ref,
        fa.fb_profile_url,
        fa.proxy_url,
        fa.reset_ip_url,
        fa.daily_quota,
        fa.status,
        fa.allow_post_without_join,
        fa.last_posted_at,
        fa.last_warmed_at,
        fa.notes,
        fa.created_time,
        fa.updated_time,
        (
          SELECT COUNT(*)::int
          FROM fb_account_groups fag
          WHERE fag.fb_account_id = fa.id
        ) as joined_groups_count,
        (
          SELECT COUNT(*)::int
          FROM campaign_run_items cri
          WHERE cri.fb_account_id = fa.id
            AND cri.status = 'Sent'
            AND cri.posted_at >= date_trunc('day', now())
        ) as today_posts_count
      FROM fb_accounts fa
      ORDER BY fa.account_name ASC
    `;

    // Mask sensitive proxy credentials and notes for list view
    const safeAccounts = accounts.map(acc => ({
      ...acc,
      proxy_url: maskProxyUrl(decryptSecret(acc.proxy_url)),
      notes: acc.notes ? maskSecret(decryptSecret(acc.notes)) : ''
    }));

    return { success: true, data: safeAccounts };
  } catch (error) {
    console.error('[getFbAccounts] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch detailed FB account with full unmasked credentials for authorized editing.
 * @param {string} id
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getFbAccountDetail(id) {
  try {
    const [account] = await sql`
      SELECT * FROM fb_accounts WHERE id = ${id}
    `;

    if (!account) {
      return { success: false, error: 'FB Account not found' };
    }

    const joinedGroups = await sql`
      SELECT 
        sgu.id,
        sgu.name,
        sgu.url,
        sgu.group_type,
        fag.joined_at
      FROM fb_account_groups fag
      JOIN social_group_urls sgu ON fag.social_group_id = sgu.id
      WHERE fag.fb_account_id = ${id}
      ORDER BY sgu.name ASC
    `;

    return {
      success: true,
      data: {
        ...account,
        allow_post_without_join: Boolean(account.allow_post_without_join),
        proxy_url: decryptSecret(account.proxy_url) || '',
        notes: decryptSecret(account.notes) || '',
        joinedGroups
      }
    };
  } catch (error) {
    console.error('[getFbAccountDetail] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a new FB Account with encrypted proxy and notes.
 * @param {Object} data
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export async function createFbAccount(data) {
  try {
    const {
      account_name,
      account_ref,
      fb_profile_url = '',
      proxy_url = '',
      reset_ip_url = '',
      daily_quota = 6,
      status = 'Active',
      allow_post_without_join = false,
      notes = '',
      joinedGroupIds = []
    } = data;

    if (!account_name || !account_name.trim()) {
      return { success: false, error: 'Account name is required' };
    }
    if (!account_ref || !account_ref.trim()) {
      return { success: false, error: 'Account ref is required' };
    }

    const encryptedProxy = encryptSecret(proxy_url);
    const encryptedNotes = encryptSecret(notes);

    const [newAccount] = await sql.begin(async (sqlTx) => {
      const [inserted] = await sqlTx`
        INSERT INTO fb_accounts (
          account_name, account_ref, fb_profile_url, proxy_url, reset_ip_url,
          daily_quota, status, allow_post_without_join, notes, created_time, updated_time
        ) VALUES (
          ${account_name.trim()}, ${account_ref.trim()}, ${fb_profile_url || null},
          ${encryptedProxy}, ${reset_ip_url || null}, ${Number(daily_quota) || 6},
          ${status}, ${Boolean(allow_post_without_join)}, ${encryptedNotes}, now(), now()
        )
        RETURNING id
      `;

      if (joinedGroupIds && joinedGroupIds.length > 0) {
        for (const gId of joinedGroupIds) {
          await sqlTx`
            INSERT INTO fb_account_groups (fb_account_id, social_group_id, joined_at)
            VALUES (${inserted.id}, ${gId}, now())
            ON CONFLICT DO NOTHING
          `;
        }
      }

      return [inserted];
    });

    revalidatePath('/fb-accounts');
    revalidatePath('/campaigns');
    return { success: true, id: newAccount.id };
  } catch (error) {
    console.error('[createFbAccount] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update an existing FB Account.
 * @param {string} id
 * @param {Object} data
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateFbAccount(id, data) {
  try {
    const {
      account_name,
      fb_profile_url,
      proxy_url,
      reset_ip_url,
      daily_quota,
      status,
      allow_post_without_join,
      notes,
      joinedGroupIds
    } = data;

    // Encrypt only if unmasked new values are supplied
    const shouldUpdateProxy = proxy_url !== undefined && !proxy_url.includes('***:***');
    const shouldUpdateNotes = notes !== undefined && !notes.includes('••••••••');

    const encryptedProxy = shouldUpdateProxy ? encryptSecret(proxy_url) : undefined;
    const encryptedNotes = shouldUpdateNotes ? encryptSecret(notes) : undefined;

    await sql.begin(async (sqlTx) => {
      await sqlTx`
        UPDATE fb_accounts SET
          account_name = COALESCE(${account_name ? account_name.trim() : null}, account_name),
          fb_profile_url = CASE WHEN ${fb_profile_url !== undefined} THEN ${fb_profile_url || null} ELSE fb_profile_url END,
          proxy_url = CASE WHEN ${shouldUpdateProxy} THEN ${encryptedProxy || null} ELSE proxy_url END,
          reset_ip_url = CASE WHEN ${reset_ip_url !== undefined} THEN ${reset_ip_url || null} ELSE reset_ip_url END,
          daily_quota = COALESCE(${daily_quota ? Number(daily_quota) : null}, daily_quota),
          status = COALESCE(${status || null}, status),
          allow_post_without_join = CASE WHEN ${allow_post_without_join !== undefined} THEN ${Boolean(allow_post_without_join)} ELSE allow_post_without_join END,
          notes = CASE WHEN ${shouldUpdateNotes} THEN ${encryptedNotes || null} ELSE notes END,
          updated_time = now()
        WHERE id = ${id}
      `;

      if (joinedGroupIds !== undefined) {
        await sqlTx`DELETE FROM fb_account_groups WHERE fb_account_id = ${id}`;
        if (joinedGroupIds.length > 0) {
          for (const gId of joinedGroupIds) {
            await sqlTx`
              INSERT INTO fb_account_groups (fb_account_id, social_group_id, joined_at)
              VALUES (${id}, ${gId}, now())
              ON CONFLICT DO NOTHING
            `;
          }
        }
      }
    });

    revalidatePath('/fb-accounts');
    revalidatePath('/campaigns');
    return { success: true };
  } catch (error) {
    console.error('[updateFbAccount] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Replace joined social groups for an FB Account.
 * @param {string} accountId
 * @param {string[]} groupIds
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function setFbAccountGroups(accountId, groupIds = []) {
  try {
    await sql.begin(async (sqlTx) => {
      await sqlTx`DELETE FROM fb_account_groups WHERE fb_account_id = ${accountId}`;
      if (groupIds && groupIds.length > 0) {
        for (const gId of groupIds) {
          await sqlTx`
            INSERT INTO fb_account_groups (fb_account_id, social_group_id, joined_at)
            VALUES (${accountId}, ${gId}, now())
            ON CONFLICT DO NOTHING
          `;
        }
      }
    });
    revalidatePath('/fb-accounts');
    return { success: true };
  } catch (error) {
    console.error('[setFbAccountGroups] Error:', error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// 4. WARM & JOIN READ & ACTION HELPERS
// ==========================================

/**
 * Fetch Auto-Warm & Group Auto-Join execution runs.
 * @param {number} [limit=20]
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
/**
 * Fetch Auto-Warm & Group Auto-Join execution runs.
 * @param {string|null} [campaignId=null] - Optional campaign UUID to filter by
 * @param {number} [limit=20]
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getWarmJoinRuns(campaignId = null, limit = 20) {
  try {
    let query = sql`
      SELECT 
        wjr.*,
        c.campaign_name,
        (
          SELECT COUNT(*)::int 
          FROM warm_join_run_items wjri 
          WHERE wjri.run_id = wjr.id AND wjri.action = 'Joined'
        ) as joined_count,
        (
          SELECT COUNT(*)::int 
          FROM warm_join_run_items wjri 
          WHERE wjri.run_id = wjr.id AND wjri.action = 'Warmed'
        ) as warmed_count,
        (
          SELECT COUNT(*)::int 
          FROM warm_join_run_items wjri 
          WHERE wjri.run_id = wjr.id AND wjri.action = 'Failed'
        ) as failed_count
      FROM warm_join_runs wjr
      LEFT JOIN campaigns c ON wjr.campaign_id = c.id
      WHERE 1=1
    `;

    if (campaignId) {
      query = sql`${query} AND wjr.campaign_id = ${campaignId}`;
    }

    query = sql`${query} ORDER BY wjr.started_at DESC LIMIT ${limit}`;

    const runs = await query;
    return { success: true, data: runs };
  } catch (error) {
    console.error('[getWarmJoinRuns] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch detailed metrics and items for a specific warm/join run.
 * @param {string} runId
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getWarmJoinRunDetail(runId) {
  try {
    const [run] = await sql`
      SELECT wjr.*, c.campaign_name 
      FROM warm_join_runs wjr
      LEFT JOIN campaigns c ON wjr.campaign_id = c.id
      WHERE wjr.id = ${runId}
    `;

    if (!run) {
      return { success: false, error: 'Warm/Join run not found' };
    }

    const items = await sql`
      SELECT 
        wjri.*,
        fa.account_name,
        fa.account_name as fb_account_name,
        fa.account_ref
      FROM warm_join_run_items wjri
      LEFT JOIN fb_accounts fa ON wjri.fb_account_id = fa.id
      WHERE wjri.run_id = ${runId}
      ORDER BY wjri.created_time ASC
    `;

    return {
      success: true,
      data: {
        run,
        items
      }
    };
  } catch (error) {
    console.error('[getWarmJoinRunDetail] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if there is an active Warm & Join run currently in progress.
 * @param {string|null} [campaignId=null] - Optional campaign UUID
 * @returns {Promise<{success: boolean, activeRun?: Object, error?: string}>}
 */
export async function getActiveWarmJoinRun(campaignId = null) {
  try {
    let query = sql`
      SELECT id, campaign_id, status, started_at, summary
      FROM warm_join_runs
      WHERE status = 'Running'
        AND started_at > now() - interval '2 hours'
    `;

    if (campaignId) {
      query = sql`${query} AND campaign_id = ${campaignId}`;
    }

    query = sql`${query} ORDER BY started_at DESC LIMIT 1`;

    const [activeRun] = await query;
    return { success: true, activeRun: activeRun || null };
  } catch (error) {
    console.error('[getActiveWarmJoinRun] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Trigger an Auto-Warm & Group Auto-Join execution run for a Warming Campaign.
 * Takes transaction advisory lock to serialize runs, marks warm_join_runs as 'Running',
 * registers in-app notification, and dispatches to n8n warm-join-trigger webhook.
 * 
 * @param {string} campaignId - Mandatory Campaign UUID (must be campaign_type = 'Warming')
 * @param {Object} [params]
 * @param {string[]} [params.accountIds] - Optional array of account IDs. If empty, uses campaign assigned accounts or active accounts.
 * @returns {Promise<{success: boolean, runId?: string, error?: string}>}
 */
/**
 * Tính danh sách fb_account_id đang "bận" vì 1 trong các nguồn:
 * 1. Job Posting: account nằm trong pool (campaign_fb_accounts) của 1 campaign đang có campaign_runs.status = 'Running'.
 * 2. Warming: account nằm trong account_ids của 1 warm_join_runs đang status = 'Running'
 *    (cửa sổ 2 giờ, đồng bộ đúng ngưỡng đã dùng trong _acquireWarmJoinRunLock).
 * 3. Chính Workflow D: account nằm trong account_ids của 1 group_membership_sync_runs đang status = 'Running'
 *    (chống trường hợp phiên trước chạy quá hạn đè lên phiên sau — timeout 30 phút).
 * @param {object} sqlTx - transaction client (hoặc `sql` nếu gọi ngoài transaction)
 * @returns {Promise<string[]>} - mảng fb_account_id (uuid string) đang bận
 */
export async function _getBusyFbAccountIds(sqlTx) {
  const [jobPostingBusyCfa, jobPostingBusyCri, warmingBusy, syncBusy] = await Promise.all([
    sqlTx`
      SELECT DISTINCT cfa.fb_account_id
      FROM campaign_fb_accounts cfa
      JOIN campaign_runs cr ON cr.campaign_id = cfa.campaign_id
      WHERE cr.status = 'Running'
    `,
    sqlTx`
      SELECT DISTINCT cri.fb_account_id
      FROM campaign_run_items cri
      JOIN campaign_runs cr ON cr.id = cri.run_id
      WHERE cr.status = 'Running' AND cri.fb_account_id IS NOT NULL
    `,
    sqlTx`
      SELECT DISTINCT unnest(account_ids) AS fb_account_id
      FROM warm_join_runs
      WHERE status = 'Running' AND started_at > now() - interval '2 hours'
        AND account_ids IS NOT NULL
    `,
    sqlTx`
      SELECT DISTINCT unnest(account_ids) AS fb_account_id
      FROM group_membership_sync_runs
      WHERE status = 'Running' AND started_at > now() - interval '30 minutes'
        AND account_ids IS NOT NULL
    `
  ]);

  const busySet = new Set([
    ...jobPostingBusyCfa.map(r => r.fb_account_id),
    ...jobPostingBusyCri.map(r => r.fb_account_id),
    ...warmingBusy.map(r => r.fb_account_id),
    ...syncBusy.map(r => r.fb_account_id)
  ]);
  return Array.from(busySet);
}

/**
 * Acquire advisory lock and register a warm & join run record.
 * Shared between UI trigger (triggerWarmJoinRun) and cron webhook (/api/webhooks/warm-join-cron-register).
 * @param {Object} [options]
 * @param {string} [options.campaignId] - Optional campaign UUID (if from UI or campaign context)
 * @param {string[]} [options.accountIds] - Optional specific account IDs
 * @param {string} [options.triggerSource] - 'ats_ui' | 'cron'
 * @returns {Promise<{success: boolean, alreadyRunning?: boolean, runId?: string, error?: string, accountIds?: string[], accounts?: any[], targetGroups?: any[], campaignId?: string|null}>}
 */
export async function _acquireWarmJoinRunLock({
  campaignId = null,
  accountIds = [],
  triggerSource = 'ats_ui'
} = {}) {
  let result = null;

  await sql.begin(async (sqlTx) => {
    // 1. Transaction-level advisory lock to serialize warm/join runs
    await sqlTx`SELECT pg_advisory_xact_lock(hashtext('warm_join_run_lock'))`;

    // 2. Check if any run is currently Running within the last 2 hours (Global serial lock)
    const [activeRun] = await sqlTx`
      SELECT id, started_at 
      FROM warm_join_runs 
      WHERE status = 'Running' 
        AND started_at > now() - interval '2 hours'
      LIMIT 1
    `;

    if (activeRun) {
      result = {
        success: false,
        alreadyRunning: true,
        error: 'already_running',
        activeRunId: activeRun.id
      };
      return;
    }

    let campaign = null;
    let targetGroups = [];
    let resolvedCampaignId = campaignId;

    if (campaignId) {
      const [camp] = await sqlTx`
        SELECT id, campaign_name, campaign_type, is_active, max_posts_per_run
        FROM campaigns
        WHERE id = ${campaignId}
      `;

      if (!camp) {
        throw new Error('Campaign not found');
      }

      if (camp.campaign_type !== 'Warming') {
        throw new Error('Campaign này không phải loại Warming.');
      }

      if (!camp.is_active) {
        throw new Error('Campaign is currently inactive');
      }
      campaign = camp;
    } else {
      // If no campaignId passed (e.g. cron run), check if there is an active Warming campaign
      const [activeCamp] = await sqlTx`
        SELECT id, campaign_name, campaign_type, is_active, max_posts_per_run
        FROM campaigns
        WHERE campaign_type = 'Warming' 
          AND is_active = true
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
        ORDER BY (
          SELECT MAX(completed_at) 
          FROM warm_join_runs wr 
          WHERE wr.campaign_id = campaigns.id
        ) ASC NULLS FIRST
        LIMIT 1
      `;
      if (activeCamp) {
        campaign = activeCamp;
        resolvedCampaignId = activeCamp.id;
      } else {
        result = {
          success: false,
          error: 'no_active_warming_campaign',
          message: 'No active Warming Campaign found for scheduled auto-warm run.'
        };
        return;
      }
    }

    // 3. Resolve target FB accounts:
    let targetAccounts = [];
    if (Array.isArray(accountIds) && accountIds.length > 0) {
      targetAccounts = await sqlTx`
        SELECT fa.id, fa.account_name, fa.account_ref, fa.proxy_url, fa.reset_ip_url, fa.status, fa.last_warmed_at
        FROM fb_accounts fa
        WHERE fa.id = ANY(${accountIds}) AND fa.status = 'Active'
        ORDER BY fa.last_warmed_at ASC NULLS FIRST
      `;
    } else if (resolvedCampaignId) {
      targetAccounts = await sqlTx`
        SELECT fa.id, fa.account_name, fa.account_ref, fa.proxy_url, fa.reset_ip_url, fa.status, fa.last_warmed_at
        FROM campaign_fb_accounts cfa
        JOIN fb_accounts fa ON cfa.fb_account_id = fa.id
        WHERE cfa.campaign_id = ${resolvedCampaignId} AND fa.status = 'Active'
        ORDER BY fa.last_warmed_at ASC NULLS FIRST
      `;

      if (targetAccounts.length === 0) {
        const breakerHit = await sqlTx`
          SELECT 1 FROM campaign_account_circuit_breaker_log WHERE campaign_id = ${resolvedCampaignId} LIMIT 1
        `;
        if (breakerHit.length === 0) {
          targetAccounts = await sqlTx`
            SELECT id, account_name, account_ref, proxy_url, reset_ip_url, status, last_warmed_at
            FROM fb_accounts
            WHERE status = 'Active'
            ORDER BY last_warmed_at ASC NULLS FIRST
          `;
        }
      }
    } else {
      targetAccounts = await sqlTx`
        SELECT id, account_name, account_ref, proxy_url, reset_ip_url, status, last_warmed_at
        FROM fb_accounts
        WHERE status = 'Active'
        ORDER BY last_warmed_at ASC NULLS FIRST
      `;
    }


    // Filter out busy accounts across all 3 automations (Job Posting, Warming, Sync)
    const busyAccountIds = await _getBusyFbAccountIds(sqlTx);
    if (busyAccountIds.length > 0) {
      targetAccounts = targetAccounts.filter(a => !busyAccountIds.includes(a.id));
    }

    if (!targetAccounts || targetAccounts.length === 0) {
      throw new Error('No active and unbusy FB accounts available for warming.');
    }

    const activeAccountIds = targetAccounts.map(a => a.id);

    // 4. Resolve target groups if campaign available
    if (resolvedCampaignId) {
      targetGroups = await sqlTx`
        SELECT sgu.id, sgu.name, sgu.url, sgu.admin_questions, sgu.custom_join_answer
        FROM campaign_social_groups csg
        JOIN social_group_urls sgu ON csg.social_group_id = sgu.id
        WHERE csg.campaign_id = ${resolvedCampaignId} AND sgu.is_active = true
        ORDER BY sgu.name ASC
      `;
    }

    // 5. In-app notification
    const campaignName = campaign ? campaign.campaign_name : 'Global Warming & Auto-Join';
    const notifMsg = triggerSource === 'cron'
      ? `Scheduled auto-warm & join session started (${targetAccounts.length} account(s))...`
      : `Starting warm & join session for campaign "${campaignName}" (${targetAccounts.length} account(s), ${targetGroups.length} group(s))...`;

    const [notif] = await sqlTx`
      INSERT INTO notifications (
        type, title, message, severity, link, metadata, created_at, updated_at
      ) VALUES (
        'warm_join_started',
        'FB Warming & Auto-Join in Progress',
        ${notifMsg},
        'info',
        ${resolvedCampaignId ? '/campaigns?campaign_id=' + resolvedCampaignId : '/campaigns'},
        ${sqlTx.json({
          campaignId: resolvedCampaignId,
          campaignName,
          triggerSource,
          accountCount: targetAccounts.length,
          targetGroupsCount: targetGroups.length,
          accountIds: activeAccountIds,
          total: targetAccounts.length,
          completed: 0
        })},
        now(), now()
      )
      RETURNING id
    `;

    // 6. Create warm_join_runs record
    const summaryMsg = triggerSource === 'cron'
      ? `[Scheduled Cron] Queued ${targetAccounts.length} active account(s) for auto-warm & join`
      : `Queued ${targetAccounts.length} account(s) and ${targetGroups.length} target group(s) for warming & auto-join`;

    const [run] = await sqlTx`
      INSERT INTO warm_join_runs (
        campaign_id, status, trigger_source, started_at, summary, notification_id, account_ids, stats, created_time
      ) VALUES (
        ${resolvedCampaignId || null}, 'Running', ${triggerSource}, now(),
        ${summaryMsg},
        ${notif?.id || null},
        ${activeAccountIds},
        ${sqlTx.json({ totalPlanned: targetAccounts.length })},
        now()
      )
      RETURNING id
    `;

    if (resolvedCampaignId) {
      await sqlTx`
        UPDATE campaigns SET last_updated = now()
        WHERE id = ${resolvedCampaignId}
      `;
    }

    const requestedMax = campaign?.max_posts_per_run || 2;
    const safeAccountCount = Math.max(1, targetAccounts.length);
    const clampedMaxPostsPerRun = Math.max(1, Math.min(requestedMax, Math.floor(SAFE_TOTAL_WARM_ACTIONS / safeAccountCount)));
    const wasClamped = clampedMaxPostsPerRun < requestedMax;

    result = {
      success: true,
      alreadyRunning: false,
      runId: run.id,
      campaignId: resolvedCampaignId || null,
      campaignName,
      maxPostsPerRun: clampedMaxPostsPerRun,
      ...(wasClamped ? { wasClampedForSafety: true, requestedMaxPostsPerRun: requestedMax } : {}),
      notificationId: notif?.id || null,
      accountIds: activeAccountIds,
      accounts: targetAccounts.map(a => ({
        id: a.id,
        account_ref: a.account_ref,
        account_name: a.account_name,
        proxy_url: decryptSecret(a.proxy_url) || '',
        reset_ip_url: a.reset_ip_url || ''
      })),
      targetGroups: targetGroups.map(g => ({
        id: g.id,
        name: g.name,
        url: g.url,
        admin_questions: g.admin_questions,
        custom_join_answer: g.custom_join_answer
      }))
    };
  });

  return result;
}

/**
 * Trigger an automated Facebook account warming and group auto-join session.
 * Enforces transaction-level advisory locking (warm_join_run_lock) and single-active-run constraint.
 * Dispatches task to n8n webhook (warm-join-trigger).
 * @param {string} campaignId - Mandatory Campaign UUID (must be campaign_type = 'Warming')
 * @param {Object} [params]
 * @param {string[]} [params.accountIds] - Optional array of account IDs. If empty, uses campaign assigned accounts or active accounts.
 * @returns {Promise<{success: boolean, runId?: string, error?: string}>}
 */
export async function triggerWarmJoinRun(campaignId, params = {}) {
  await assertRealRequestContext('triggerWarmJoinRun');
  const { accountIds = [], maxGroupsPerAccount } = params || {};

  if (!campaignId) {
    return { success: false, error: 'Campaign ID is required for triggering Warm & Join.' };
  }

  try {
    const lockRes = await _acquireWarmJoinRunLock({
      campaignId,
      accountIds,
      triggerSource: 'ats_ui'
    });

    if (!lockRes.success) {
      if (lockRes.alreadyRunning) {
        return {
          success: false,
          error: 'A warm & join run is currently active. Please wait for it to complete.'
        };
      }
      return { success: false, error: lockRes.error || 'Failed to acquire warm join lock' };
    }

    // Dispatch to n8n Webhook outside transaction
    const webhookUrl = process.env.N8N_WARM_JOIN_TRIGGER_WEBHOOK_URL || 'https://n8n.example.com/webhook/warm-join-trigger';
    const webhookSecret = process.env.INTERNAL_WEBHOOK_SECRET || '';
    const webhookEnvironment = process.env.DB_SCHEMA || 'public';

    let finalMaxGroups = Number(lockRes.maxPostsPerRun) || 2;
    if (maxGroupsPerAccount != null) {
      const requestedOverride = Number(maxGroupsPerAccount);
      const safeAccountCount = Math.max(1, (lockRes.accounts || []).length);
      const clampedOverride = Math.max(1, Math.min(requestedOverride, Math.floor(SAFE_TOTAL_WARM_ACTIONS / safeAccountCount)));
      if (clampedOverride < requestedOverride) {
        console.warn(`[triggerWarmJoinRun] Clamped maxGroupsPerAccount from ${requestedOverride} to ${clampedOverride} for safety (accounts=${safeAccountCount}, cap=${SAFE_TOTAL_WARM_ACTIONS}).`);
      }
      finalMaxGroups = clampedOverride;
    } else if (lockRes.wasClampedForSafety) {
      console.warn(`[triggerWarmJoinRun] Clamped maxGroupsPerAccount from ${lockRes.requestedMaxPostsPerRun} to ${lockRes.maxPostsPerRun} for safety (accounts=${(lockRes.accounts || []).length}, cap=${SAFE_TOTAL_WARM_ACTIONS}).`);
    }

    const payload = {
      runId: lockRes.runId,
      accountIds: lockRes.accountIds,
      campaignId: lockRes.campaignId,
      targetGroups: lockRes.targetGroups,
      maxGroupsPerAccount: finalMaxGroups,
      environment: webhookEnvironment
    };

    console.log('[triggerWarmJoinRun] Dispatching payload to n8n webhook:', JSON.stringify({
      runId: payload.runId,
      campaignId: payload.campaignId,
      accountIds: payload.accountIds,
      targetGroupsCount: payload.targetGroups.length,
      maxGroupsPerAccount: payload.maxGroupsPerAccount
    }));

    after(async () => {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': webhookSecret
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000)
        });
      } catch (err) {
        console.error('[triggerWarmJoinRun] Warning: Failed to notify n8n webhook:', err.message);
      }
    });

    revalidatePath('/campaigns');
    revalidatePath('/');
    return { success: true, runId: lockRes.runId };
  } catch (error) {
    console.error('[triggerWarmJoinRun] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update custom join answer for a social group requiring admin question resolution.
 * @param {string} socialGroupId
 * @param {string} customJoinAnswer
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateSocialGroupJoinAnswer(socialGroupId, customJoinAnswer) {
  try {
    await sql`
      UPDATE social_group_urls SET
        custom_join_answer = ${customJoinAnswer || null},
        join_status = 'Pending Approval'
      WHERE id = ${socialGroupId}
    `;

    revalidatePath('/campaigns');
    return { success: true };
  } catch (error) {
    console.error('[updateSocialGroupJoinAnswer] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch paginated + searched ACTIVE social groups for the campaign Target Groups picker.
 * @param {Object} [filters]
 * @param {string} [filters.search='']
 * @param {string[]} [filters.tagFilters=[]]
 * @param {number} [filters.page=1]
 * @param {number} [filters.pageSize=50]
 * @returns {Promise<{success: boolean, data?: Array, totalCount?: number, error?: string}>}
 */
export async function getSocialGroups(filters = {}) {
  try {
    const { search = '', tagFilters = [], page = 1, pageSize = (filters.limit || 50), ids = null } = filters;

    if (Array.isArray(ids) && ids.length === 0) {
      return { success: true, data: [], totalCount: 0 };
    }

    const term = search.trim() ? `%${search.trim()}%` : null;
    const hasTagFilter = Array.isArray(tagFilters) && tagFilters.length > 0;
    const hasIdsFilter = Array.isArray(ids) && ids.length > 0;
    const offset = (Math.max(1, page) - 1) * pageSize;

    const groups = await sql`
      SELECT id, name, url, group_type, join_status, is_active, admin_questions, custom_join_answer, member_count
      FROM social_group_urls
      WHERE is_active = true
        AND (${term}::text IS NULL OR name ILIKE ${term} OR url ILIKE ${term})
        AND (${hasTagFilter} = false OR group_type && ${tagFilters}::text[])
        AND (${hasIdsFilter} = false OR id = ANY(${ids}::uuid[]))
      ORDER BY name ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const [{ total }] = await sql`
      SELECT COUNT(*) AS total
      FROM social_group_urls
      WHERE is_active = true
        AND (${term}::text IS NULL OR name ILIKE ${term} OR url ILIKE ${term})
        AND (${hasTagFilter} = false OR group_type && ${tagFilters}::text[])
        AND (${hasIdsFilter} = false OR id = ANY(${ids}::uuid[]))
    `;

    return { success: true, data: groups, totalCount: Number(total || 0) };
  } catch (error) {
    console.error('[getSocialGroups] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Return ONLY the ids of active social groups matching search + tag filter — no pagination limit.
 * Used exclusively by the "Select All (Filtered)" / "Deselect All (Filtered)" actions in the
 * campaign Target Groups picker, so bulk-select stays correct across all pages, not just the
 * currently loaded page.
 * @param {Object} [filters]
 * @param {string} [filters.search='']
 * @param {string[]} [filters.tagFilters=[]]
 * @returns {Promise<{success: boolean, ids?: string[], error?: string}>}
 */
export async function getSocialGroupIdsMatchingFilter(filters = {}) {
  try {
    const { search = '', tagFilters = [] } = filters;
    const term = search.trim() ? `%${search.trim()}%` : null;
    const hasTagFilter = Array.isArray(tagFilters) && tagFilters.length > 0;

    const rows = await sql`
      SELECT id
      FROM social_group_urls
      WHERE is_active = true
        AND (${term}::text IS NULL OR name ILIKE ${term} OR url ILIKE ${term})
        AND (${hasTagFilter} = false OR group_type && ${tagFilters}::text[])
    `;

    return { success: true, ids: rows.map((r) => r.id) };
  } catch (error) {
    console.error('[getSocialGroupIdsMatchingFilter] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch the full, persistent list of all tag names ever registered — independent
 * of which groups currently carry them. This is the canonical source for filter
 * bars and autocomplete suggestions (fixes: removing a tag from the last group
 * that had it used to make the tag vanish system-wide).
 * @returns {Promise<{success: boolean, data?: string[], error?: string}>}
 */
export async function getAllTagOptions() {
  try {
    const rows = await sql`SELECT name FROM social_group_tags ORDER BY name ASC`;
    return { success: true, data: rows.map(r => r.name) };
  } catch (error) {
    console.error('[getAllTagOptions] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Validate a tag name against the project's naming policy: no diacritics/special
 * characters, only [A-Za-z0-9 _-]. Applied uniformly to every tag string, whether
 * brand-new or already existing, so behavior stays consistent everywhere.
 * @param {string} name
 * @returns {boolean}
 */
function isValidTagName(name) {
  return /^[A-Za-z0-9 _-]+$/.test((name || '').trim());
}

/**
 * Delete a tag from the persistent registry — ONLY when it is not currently
 * attached to any social group. This is a deliberate, irreversible action
 * (different from removing a tag off a single group). Uses an atomic
 * DELETE ... WHERE NOT EXISTS so the "still in use?" check and the delete
 * happen in a single statement (no race window).
 * @param {string} tagName
 * @returns {Promise<{success: boolean, inUseCount?: number, error?: string}>}
 */
export async function deleteTagFromRegistry(tagName) {
  try {
    const clean = (tagName || '').trim();
    if (!clean) {
      return { success: false, error: 'Tag name is required' };
    }

    const deleted = await sql`
      DELETE FROM social_group_tags
      WHERE name = ${clean}
        AND NOT EXISTS (
          SELECT 1 FROM social_group_urls WHERE ${clean} = ANY(group_type)
        )
      RETURNING id
    `;

    if (deleted.length > 0) {
      revalidatePath('/campaigns');
      return { success: true };
    }

    // Not deleted -- figure out why, to return an accurate message.
    const [existsRow] = await sql`SELECT 1 FROM social_group_tags WHERE name = ${clean}`;
    if (!existsRow) {
      return { success: false, error: `Tag "${clean}" không tồn tại trong registry.` };
    }

    const [{ count }] = await sql`
      SELECT COUNT(*)::int as count FROM social_group_urls WHERE ${clean} = ANY(group_type)
    `;
    return {
      success: false,
      inUseCount: count,
      error: `Không thể xoá — tag "${clean}" vẫn đang được gắn ở ${count} nhóm. Hãy gỡ tag khỏi tất cả nhóm đó trước (qua popover "Edit Group Tags" của từng nhóm), rồi thử lại.`
    };
  } catch (error) {
    console.error('[deleteTagFromRegistry] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update the group_type tags array for a single social group (self-service tagging).
 * @param {string} socialGroupId
 * @param {string[]} tags - Free-form tag strings, no whitelist/enum.
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function updateSocialGroupTags(socialGroupId, tags = []) {
  try {
    // Sanitize: trim, drop empty, dedupe (case-sensitive as typed)
    const cleanTags = [...new Set((tags || []).map(t => (t || '').trim()).filter(Boolean))];

    const invalidTags = cleanTags.filter(t => !isValidTagName(t));
    if (invalidTags.length > 0) {
      return {
        success: false,
        error: `Tên tag không hợp lệ: ${invalidTags.join(', ')}. Chỉ chấp nhận chữ không dấu, số, khoảng trắng, "-", "_".`
      };
    }

    // NEW (PHẦN 5.4/5.8): Register brand-new tag names into the persistent registry.
    // Case-insensitive duplicate prevention using lower(name) unique index.
    if (cleanTags.length > 0) {
      await sql`
        INSERT INTO social_group_tags (name)
        SELECT DISTINCT unnest(${cleanTags}::text[])
        ON CONFLICT ((lower(name))) DO NOTHING
      `;
    }

    await sql`
      UPDATE social_group_urls
      SET group_type = ${cleanTags}
      WHERE id = ${socialGroupId}
    `;

    revalidatePath('/campaigns');
    return { success: true, data: { id: socialGroupId, group_type: cleanTags } };
  } catch (error) {
    console.error('[updateSocialGroupTags] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Rename a tag across the registry AND every group currently carrying it, atomically.
 * Refuses (does not merge) if the new name already exists (case-insensitive) or
 * violates the naming charset policy.
 * @param {string} oldName
 * @param {string} newName
 * @returns {Promise<{success: boolean, affectedGroups?: number, error?: string}>}
 */
export async function renameTagInRegistry(oldName, newName) {
  try {
    const cleanOld = (oldName || '').trim();
    const cleanNew = (newName || '').trim();

    if (!cleanOld || !cleanNew) {
      return { success: false, error: 'Tên tag không được để trống.' };
    }
    if (!isValidTagName(cleanNew)) {
      return { success: false, error: `Tên tag không hợp lệ: "${cleanNew}". Chỉ chấp nhận chữ không dấu, số, khoảng trắng, "-", "_".` };
    }
    if (cleanOld.toLowerCase() === cleanNew.toLowerCase()) {
      return { success: false, error: 'Tên mới trùng với tên cũ (không phân biệt hoa/thường).' };
    }

    let affectedGroups = 0;
    await sql.begin(async (tx) => {
      await tx`UPDATE social_group_tags SET name = ${cleanNew} WHERE name = ${cleanOld}`;
      const updated = await tx`
        UPDATE social_group_urls
        SET group_type = array_replace(group_type, ${cleanOld}, ${cleanNew})
        WHERE ${cleanOld} = ANY(group_type)
        RETURNING id
      `;
      affectedGroups = updated.length;
    });

    revalidatePath('/campaigns');
    return { success: true, affectedGroups };
  } catch (error) {
    // 23505 = unique_violation -- catches the lower(name) index from PHẦN D.1,
    // meaning newName already exists as another tag (case-insensitive collision).
    if (error.code === '23505') {
      return { success: false, error: `Tag "${newName}" đã tồn tại (không phân biệt hoa/thường) — không thể đổi tên trùng. Hãy chọn tên khác.` };
    }
    console.error('[renameTagInRegistry] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Detach a tag from every social group currently carrying it — does NOT delete
 * the tag from the registry (that remains a separate, deliberate action via
 * deleteTagFromRegistry, called afterward if desired).
 * @param {string} tagName
 * @returns {Promise<{success: boolean, removedCount?: number, error?: string}>}
 */
export async function bulkRemoveTagFromGroups(tagName) {
  try {
    const clean = (tagName || '').trim();
    if (!clean) {
      return { success: false, error: 'Tag name is required' };
    }

    const removed = await sql`
      UPDATE social_group_urls
      SET group_type = array_remove(group_type, ${clean})
      WHERE ${clean} = ANY(group_type)
      RETURNING id
    `;

    revalidatePath('/campaigns');
    return { success: true, removedCount: removed.length };
  } catch (error) {
    console.error('[bulkRemoveTagFromGroups] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch paginated + searched social groups for the Library management tab.
 * @param {Object} [filters]
 * @param {boolean} [filters.includeInactive=false]
 * @param {string} [filters.search='']
 * @param {string[]} [filters.tagFilters=[]]
 * @param {number} [filters.page=1]
 * @param {number} [filters.pageSize=50]
 * @returns {Promise<{success: boolean, data?: Array, totalCount?: number, inactiveTotalCount?: number, error?: string}>}
 */
export async function getSocialGroupsLibrary(filters = {}) {
  try {
    const {
      includeInactive = false,
      search = '',
      tagFilters = [],
      minMembers = '',
      maxMembers = '',
      page = 1,
      pageSize = 50,
      focusGroupId = null,
    } = filters;
    const term = search.trim() ? `%${search.trim()}%` : null;
    const hasTagFilter = Array.isArray(tagFilters) && tagFilters.length > 0;
    const offset = (Math.max(1, page) - 1) * pageSize;

    const hasMinMembers = minMembers !== undefined && minMembers !== null && minMembers !== '' && !isNaN(Number(minMembers));
    const numMinMembers = hasMinMembers ? Number(minMembers) : null;
    const hasMaxMembers = maxMembers !== undefined && maxMembers !== null && maxMembers !== '' && !isNaN(Number(maxMembers));
    const numMaxMembers = hasMaxMembers ? Number(maxMembers) : null;

    // 1. Trang dữ liệu (giữ nguyên GROUP BY + aggregation hiện có, chỉ thêm WHERE + LIMIT/OFFSET)
    const groups = await sql`
      SELECT
        sgu.id, sgu.name, sgu.url, sgu.group_type, sgu.is_active,
        sgu.join_status, sgu.admin_questions, sgu.custom_join_answer, sgu.created_time,
        sgu.member_count,
        COUNT(DISTINCT csg.campaign_id) AS campaign_count,
        COALESCE(
          ARRAY_AGG(DISTINCT c.campaign_name) FILTER (WHERE c.campaign_name IS NOT NULL),
          '{}'
        ) AS campaign_names,
        (
          SELECT MAX(cri.posted_at)
          FROM campaign_run_items cri
          WHERE cri.social_group_id = sgu.id AND cri.status = 'Sent'
        ) AS last_posted_at,
        (
          SELECT COUNT(DISTINCT fag.fb_account_id)::int
          FROM fb_account_groups fag
          JOIN fb_accounts fa ON fa.id = fag.fb_account_id
          WHERE fag.social_group_id = sgu.id AND fa.status = 'Active'
        ) AS joined_account_count,
        (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'id', fa.id,
                'account_name', fa.account_name,
                'account_ref', fa.account_ref,
                'joined_at', fag.joined_at
              ) ORDER BY fag.joined_at DESC
            ),
            '[]'::json
          )
          FROM fb_account_groups fag
          JOIN fb_accounts fa ON fa.id = fag.fb_account_id
          WHERE fag.social_group_id = sgu.id AND fa.status = 'Active'
        ) AS joined_accounts_list,
        (
          SELECT COUNT(*)::int
          FROM fb_accounts
          WHERE status = 'Active'
        ) AS total_active_accounts
      FROM social_group_urls sgu
      LEFT JOIN campaign_social_groups csg ON csg.social_group_id = sgu.id
      LEFT JOIN campaigns c ON c.id = csg.campaign_id
      WHERE (
        (${includeInactive} = true OR sgu.is_active = true)
        AND (${term}::text IS NULL OR sgu.name ILIKE ${term} OR sgu.url ILIKE ${term})
        AND (${hasTagFilter} = false OR sgu.group_type && ${tagFilters}::text[])
        AND (${!hasMinMembers} = true OR sgu.member_count >= ${numMinMembers})
        AND (${!hasMaxMembers} = true OR sgu.member_count <= ${numMaxMembers})
      ) OR sgu.id = ${focusGroupId}
      GROUP BY sgu.id
      ORDER BY (sgu.id = ${focusGroupId}) DESC, sgu.created_time DESC NULLS LAST
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    // 2. Tổng số dòng khớp filter hiện tại (KHÔNG join, để tránh nhân bản dòng do LEFT JOIN campaign) +
    //    tổng số dòng inactive toàn bảng (độc lập với filter, phục vụ nhãn "Show Inactive (N)")
    const [counts] = await sql`
      SELECT
        COUNT(*) FILTER (
          WHERE (${includeInactive} = true OR is_active = true)
            AND (${term}::text IS NULL OR name ILIKE ${term} OR url ILIKE ${term})
            AND (${hasTagFilter} = false OR group_type && ${tagFilters}::text[])
            AND (${!hasMinMembers} = true OR member_count >= ${numMinMembers})
            AND (${!hasMaxMembers} = true OR member_count <= ${numMaxMembers})
        ) AS matching_count,
        COUNT(*) FILTER (WHERE NOT is_active) AS inactive_total
      FROM social_group_urls
    `;

    return {
      success: true,
      data: groups,
      totalCount: Number(counts?.matching_count || 0),
      inactiveTotalCount: Number(counts?.inactive_total || 0),
    };
  } catch (error) {
    console.error('[getSocialGroupsLibrary] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Manually create a new Social Group URL record (self-service, no n8n import needed).
 * @param {Object} data - { name, url, group_type, member_count }
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export async function createSocialGroup(data = {}) {
  try {
    const { name, url = '', group_type = [], member_count = null } = data;
    if (!name || !name.trim()) {
      return { success: false, error: 'Group name is required.' };
    }
    const cleanTags = [...new Set((group_type || []).map(t => (t || '').trim()).filter(Boolean))];

    const invalidTags = cleanTags.filter(t => !isValidTagName(t));
    if (invalidTags.length > 0) {
      return {
        success: false,
        error: `Tên tag không hợp lệ: ${invalidTags.join(', ')}. Chỉ chấp nhận chữ không dấu, số, khoảng trắng, "-", "_".`
      };
    }

    let parsedMemberCount = null;
    if (member_count !== undefined && member_count !== null && member_count !== '') {
      const cleaned = typeof member_count === 'number'
        ? Math.round(member_count)
        : parseInt(String(member_count).replace(/\D/g, ''), 10);
      if (!isNaN(cleaned)) {
        parsedMemberCount = cleaned;
      }
    }

    if (cleanTags.length > 0) {
      await sql`
        INSERT INTO social_group_tags (name)
        SELECT DISTINCT unnest(${cleanTags}::text[])
        ON CONFLICT ((lower(name))) DO NOTHING
      `;
    }

    const [row] = await sql`
      INSERT INTO social_group_urls (name, url, group_type, is_active, join_status, member_count)
      VALUES (${name.trim()}, ${url.trim()}, ${cleanTags}, true, 'Not Joined', ${parsedMemberCount})
      RETURNING id
    `;
    revalidatePath('/campaigns');
    return { success: true, id: row.id };
  } catch (error) {
    console.error('[createSocialGroup] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update name/url/member_count of an existing social group (tags handled separately via updateSocialGroupTags).
 * @param {string} id
 * @param {Object} data - { name, url, member_count }
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateSocialGroupDetails(id, data = {}) {
  try {
    const { name, url, member_count } = data;
    if (!name || !name.trim()) {
      return { success: false, error: 'Group name is required.' };
    }

    const updateMemberCount = member_count !== undefined;
    let parsedMemberCount = null;
    if (updateMemberCount && member_count !== null && member_count !== '') {
      const cleaned = typeof member_count === 'number'
        ? Math.round(member_count)
        : parseInt(String(member_count).replace(/\D/g, ''), 10);
      parsedMemberCount = isNaN(cleaned) ? null : cleaned;
    }

    if (updateMemberCount) {
      await sql`
        UPDATE social_group_urls
        SET name = ${name.trim()}, url = ${(url || '').trim()}, member_count = ${parsedMemberCount}
        WHERE id = ${id}
      `;
    } else {
      await sql`
        UPDATE social_group_urls
        SET name = ${name.trim()}, url = ${(url || '').trim()}
        WHERE id = ${id}
      `;
    }

    revalidatePath('/campaigns');
    return { success: true };
  } catch (error) {
    console.error('[updateSocialGroupDetails] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Normalize Facebook group URL for consistent deduplication:
 * - Trim whitespace
 * - Strip trailing slashes
 * - Lowercase protocol and hostname
 * @param {string} rawUrl
 * @returns {string}
 */
export async function normalizeSocialGroupUrl(rawUrl) {
  return normalizeSocialGroupUrlSync(rawUrl);
}

/**
 * Parse member count input supporting Vietnamese dots (1.900), commas (1,900), or pure digits.
 * @param {any} rawVal
 * @returns {{ value: number|null, valid: boolean, error?: string }}
 */
function parseMemberCountInput(rawVal) {
  if (rawVal == null || rawVal === '') {
    return { value: null, valid: true };
  }
  if (typeof rawVal === 'number') {
    if (isNaN(rawVal) || rawVal < 0) {
      return { value: null, valid: false, error: 'Member count must be a non-negative number.' };
    }
    return { value: Math.round(rawVal), valid: true };
  }
  const s = String(rawVal).trim();
  if (!s) {
    return { value: null, valid: true };
  }
  if (!/^[\d.,\s]+$/.test(s)) {
    return { value: null, valid: false, error: `Invalid number format: "${s}". Only numbers are allowed.` };
  }
  const cleanedDigits = s.replace(/[.,\s]/g, '');
  if (!cleanedDigits || !/^\d+$/.test(cleanedDigits)) {
    return { value: null, valid: false, error: `Invalid number format: "${s}".` };
  }
  const num = parseInt(cleanedDigits, 10);
  if (isNaN(num) || num < 0) {
    return { value: null, valid: false, error: 'Member count must be a non-negative number.' };
  }
  return { value: num, valid: true };
}

/**
 * Bulk import social group URLs from parsed CSV/Excel rows with URL deduplication and tag validation.
 * - Checks duplicates against active schema DB
 * - Checks duplicates within the file itself
 * - Validates tag charset with isValidTagName (^[A-Za-z0-9 _-]+$)
 * - Parses member count (supports Vietnamese dot separators like 1.900 and comma separators)
 * - If options.confirm is true, executes insertion and tag registry in a transaction
 * - If options.confirm is false, returns preview validation report
 * @param {Array<{url: string, name: string, group_type?: string|string[], member_count?: any}>} rows
 * @param {Object} [options]
 * @param {boolean} [options.confirm=false]
 * @returns {Promise<{success: boolean, preview?: boolean, summary?: Object, insertedCount?: number, error?: string}>}
 */
export async function bulkImportSocialGroups(rows = [], options = {}) {
  try {
    const { confirm = false } = options;

    if (!Array.isArray(rows) || rows.length === 0) {
      return { success: false, error: 'No data rows provided for import.' };
    }

    if (rows.length > 5000) {
      return {
        success: false,
        error: `File contains ${rows.length.toLocaleString()} rows. Maximum allowed is 5,000 rows per import. Please split your file into smaller batches.`
      };
    }

    // 1. Query existing URLs in active schema
    const existingDbRows = await sql`
      SELECT url FROM social_group_urls
    `;
    const dbUrlSet = new Set(
      existingDbRows
        .map(r => normalizeSocialGroupUrlSync(r.url))
        .filter(Boolean)
    );

    // Query existing tags
    const existingTagRows = await sql`
      SELECT lower(name) as lower_name FROM social_group_tags
    `;
    const existingTagSet = new Set(existingTagRows.map(t => t.lower_name));

    const fileUrlSet = new Set();
    const validRows = [];
    const duplicateInDbRows = [];
    const duplicateInFileRows = [];
    const invalidRows = [];
    const newTagsCollected = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const rowNum = i + 1;
      const rawUrl = (row.url || '').trim();
      const rawName = (row.name || '').trim();
      const rawGroupType = row.group_type;
      const rawMemberCount = row.member_count;

      const rowErrors = [];

      if (!rawUrl) {
        rowErrors.push('Missing URL');
      }

      if (!rawName) {
        rowErrors.push('Missing group name');
      }

      const memberParse = parseMemberCountInput(rawMemberCount);
      if (!memberParse.valid) {
        rowErrors.push(memberParse.error);
      }

      // Clean and validate tags
      let tags = [];
      if (Array.isArray(rawGroupType)) {
        tags = rawGroupType.map(t => (t || '').trim()).filter(Boolean);
      } else if (typeof rawGroupType === 'string' && rawGroupType.trim()) {
        tags = rawGroupType.split(/[,;\n]/).map(t => t.trim()).filter(Boolean);
      }
      const cleanTags = [...new Set(tags)];
      const invalidTags = cleanTags.filter(t => !isValidTagName(t));
      if (invalidTags.length > 0) {
        rowErrors.push(`Invalid tag character(s) in: ${invalidTags.map(t => `"${t}"`).join(', ')}. Only letters, numbers, spaces, '-', '_' allowed.`);
      }

      if (rowErrors.length > 0) {
        invalidRows.push({
          rowNumber: rowNum,
          name: rawName || '—',
          url: rawUrl || '—',
          errors: rowErrors,
        });
        continue;
      }

      // Deduplicate URL
      const normUrl = normalizeSocialGroupUrlSync(rawUrl);

      if (fileUrlSet.has(normUrl)) {
        duplicateInFileRows.push({
          rowNumber: rowNum,
          name: rawName,
          url: rawUrl,
          reason: 'Duplicate URL within uploaded file',
        });
        continue;
      }
      fileUrlSet.add(normUrl);

      if (dbUrlSet.has(normUrl)) {
        duplicateInDbRows.push({
          rowNumber: rowNum,
          name: rawName,
          url: rawUrl,
          reason: 'URL already exists in database',
        });
        continue;
      }

      // Track new valid tags
      for (const t of cleanTags) {
        if (!existingTagSet.has(t.toLowerCase())) {
          newTagsCollected.add(t);
        }
      }

      validRows.push({
        rowNumber: rowNum,
        name: rawName,
        url: rawUrl,
        group_type: cleanTags,
        member_count: memberParse.value,
      });
    }

    const newTagsList = Array.from(newTagsCollected).sort();

    // 2. Return preview validation report if confirm is false
    if (!confirm) {
      return {
        success: true,
        preview: true,
        summary: {
          totalRows: rows.length,
          validCount: validRows.length,
          duplicateInDbCount: duplicateInDbRows.length,
          duplicateInFileCount: duplicateInFileRows.length,
          invalidFormatCount: invalidRows.length,
          newTagsCount: newTagsList.length,
        },
        newTags: newTagsList,
        validPreview: validRows.slice(0, 50),
        duplicateInDbPreview: duplicateInDbRows.slice(0, 50),
        duplicateInFilePreview: duplicateInFileRows.slice(0, 50),
        invalidPreview: invalidRows.slice(0, 50),
      };
    }

    // 3. Confirm mode: execute in transaction
    if (validRows.length === 0) {
      return {
        success: true,
        insertedCount: 0,
        skippedCount: duplicateInDbRows.length + duplicateInFileRows.length + invalidRows.length,
        message: 'No new valid groups to import.',
        summary: {
          totalRows: rows.length,
          validCount: 0,
          duplicateInDbCount: duplicateInDbRows.length,
          duplicateInFileCount: duplicateInFileRows.length,
          invalidFormatCount: invalidRows.length,
          newTagsCount: 0,
        }
      };
    }

    await sql.begin(async (tx) => {
      // Auto-register new tags
      if (newTagsList.length > 0) {
        await tx`
          INSERT INTO social_group_tags (name)
          SELECT DISTINCT unnest(${newTagsList}::text[])
          ON CONFLICT ((lower(name))) DO NOTHING
        `;
      }

      // Batch insert valid groups in chunks of 100
      for (let i = 0; i < validRows.length; i += 100) {
        const chunk = validRows.slice(i, i + 100);
        for (const item of chunk) {
          await tx`
            INSERT INTO social_group_urls (name, url, group_type, member_count, is_active, join_status)
            VALUES (${item.name}, ${item.url}, ${item.group_type}::text[], ${item.member_count}, true, 'Not Joined')
          `;
        }
      }
    });

    revalidatePath('/campaigns');

    return {
      success: true,
      insertedCount: validRows.length,
      skippedCount: duplicateInDbRows.length + duplicateInFileRows.length + invalidRows.length,
      newTagsRegistered: newTagsList,
      summary: {
        totalRows: rows.length,
        validCount: validRows.length,
        duplicateInDbCount: duplicateInDbRows.length,
        duplicateInFileCount: duplicateInFileRows.length,
        invalidFormatCount: invalidRows.length,
        newTagsCount: newTagsList.length,
      }
    };
  } catch (error) {
    console.error('[bulkImportSocialGroups] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Soft activate/deactivate a social group. NEVER hard-deletes (Rule C.9 GEMINI.md).
 * @param {string} id
 * @param {boolean} isActive
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function toggleSocialGroupActive(id, isActive) {
  try {
    await sql`
      UPDATE social_group_urls
      SET is_active = ${!!isActive}
      WHERE id = ${id}
    `;
    revalidatePath('/campaigns');
    return { success: true };
  } catch (error) {
    console.error('[toggleSocialGroupActive] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Bulk assign multiple social group URLs to one or more campaigns.
 * Uses batch insert with ON CONFLICT (campaign_id, social_group_id) DO NOTHING
 * and counts actual inserted rows vs already linked rows.
 * 
 * @param {string[]} socialGroupIds
 * @param {string[]} campaignIds
 * @returns {Promise<{success: boolean, insertedCount?: number, alreadyLinkedCount?: number, totalPairs?: number, error?: string}>}
 */
export async function bulkAssignSocialGroupsToCampaigns(socialGroupIds = [], campaignIds = []) {
  try {
    const cleanGroupIds = [...new Set((socialGroupIds || []).filter(Boolean))];
    const cleanCampaignIds = [...new Set((campaignIds || []).filter(Boolean))];

    if (cleanGroupIds.length === 0 || cleanCampaignIds.length === 0) {
      return { success: false, error: 'Please select at least one social group and one campaign.' };
    }

    const pairs = [];
    for (const campaignId of cleanCampaignIds) {
      for (const groupId of cleanGroupIds) {
        pairs.push({ campaignId, groupId });
      }
    }

    const totalPairs = pairs.length;
    let insertedCount = 0;

    const BATCH_SIZE = 500;
    await sql.begin(async (sqlTx) => {
      for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
        const chunk = pairs.slice(i, i + BATCH_SIZE);
        const cIds = chunk.map(p => p.campaignId);
        const gIds = chunk.map(p => p.groupId);

        const insertedRows = await sqlTx`
          INSERT INTO campaign_social_groups (campaign_id, social_group_id)
          SELECT c_id, g_id
          FROM unnest(${cIds}::uuid[], ${gIds}::uuid[]) AS t(c_id, g_id)
          ON CONFLICT (campaign_id, social_group_id) DO NOTHING
          RETURNING campaign_id, social_group_id
        `;
        insertedCount += insertedRows.length;
      }
    });

    const alreadyLinkedCount = totalPairs - insertedCount;
    revalidatePath('/campaigns');
    return {
      success: true,
      insertedCount,
      alreadyLinkedCount,
      totalPairs
    };
  } catch (error) {
    console.error('[bulkAssignSocialGroupsToCampaigns] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Return ONLY the IDs of all social groups matching current library filters (no pagination limit).
 * Used for "Select All (Filtered)" in the Social Groups library.
 * 
 * @param {Object} [filters]
 * @returns {Promise<{success: boolean, ids?: string[], error?: string}>}
 */
export async function getSocialGroupsLibraryIdsMatchingFilter(filters = {}) {
  try {
    const {
      includeInactive = false,
      search = '',
      tagFilters = [],
      minMembers = '',
      maxMembers = '',
    } = filters;
    const term = search.trim() ? `%${search.trim()}%` : null;
    const hasTagFilter = Array.isArray(tagFilters) && tagFilters.length > 0;
    const hasMinMembers = minMembers !== undefined && minMembers !== null && minMembers !== '' && !isNaN(Number(minMembers));
    const numMinMembers = hasMinMembers ? Number(minMembers) : null;
    const hasMaxMembers = maxMembers !== undefined && maxMembers !== null && maxMembers !== '' && !isNaN(Number(maxMembers));
    const numMaxMembers = hasMaxMembers ? Number(maxMembers) : null;

    const rows = await sql`
      SELECT id
      FROM social_group_urls
      WHERE (${includeInactive} = true OR is_active = true)
        AND (${term}::text IS NULL OR name ILIKE ${term} OR url ILIKE ${term})
        AND (${hasTagFilter} = false OR group_type && ${tagFilters}::text[])
        AND (${!hasMinMembers} = true OR member_count >= ${numMinMembers})
        AND (${!hasMaxMembers} = true OR member_count <= ${numMaxMembers})
    `;
    return { success: true, ids: rows.map(r => r.id) };
  } catch (error) {
    console.error('[getSocialGroupsLibraryIdsMatchingFilter] Error:', error);
    return { success: false, error: error.message };
  }
}



