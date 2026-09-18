import { NextResponse } from 'next/server';
import sql, { sqlSandbox } from '../../../../lib/db.js';
import { _maybeTripCircuitBreaker, isAccountHealthFailure } from '../../../campaign_actions.js';

const PROGRESS_MILESTONES = [25, 50, 75, 100];

/**
 * POST /api/webhooks/campaign-run-progress
 * Receives execution result of each posted group from n8n / Playwright.
 * Updates campaign_run_items and updates in-app notification in-place.
 * Protected by `x-internal-secret` header.
 */
export async function POST(request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { runId, completedItem } = body;
    const sqlClient = body.environment === 'sandbox' ? sqlSandbox : sql;

    if (!runId || !completedItem) {
      return NextResponse.json({ error: 'runId and completedItem are required' }, { status: 400 });
    }

    const {
      socialGroupId,
      groupName = 'Unknown Group',
      groupUrl = '',
      fbAccountId,
      status = 'Sent',
      errorMessage = null,
      retryEligibleAt = null,
      retry_eligible_at = null
    } = completedItem;

    const finalRetryEligibleAt = retryEligibleAt || retry_eligible_at || (status === 'Interrupted' ? new Date(Date.now() + 3 * 3600 * 1000).toISOString() : null);

    let itemId = null;

    await sqlClient.begin(async (sqlTx) => {
      // 1. Insert item record
      const [inserted] = await sqlTx`
        INSERT INTO campaign_run_items (
          run_id, social_group_id, fb_account_id, group_name, group_url,
          status, error_message, retry_eligible_at, posted_at, created_time
        ) VALUES (
          ${runId}, ${socialGroupId || null}, ${fbAccountId || null},
          ${groupName}, ${groupUrl}, ${status}, ${errorMessage || null},
          ${finalRetryEligibleAt || null},
          ${status === 'Sent' ? sqlTx`now()` : null}, now()
        )
        RETURNING id
      `;
      itemId = inserted.id;

      // 1b. Circuit breaker: CHỈ tính các sự kiện phản ánh TÀI KHOẢN thật sự có vấn đề
      // (Facebook Checkpoint, hoặc Failed do session hết hạn/cần đăng nhập lại) — KHÔNG
      // tính lỗi UI selector/network/timeout/"chưa join group" (xem FIX_SPEC_2026-09-18b).
      // Đếm lại tổng số sự kiện thuộc 2 loại trên của account này TRONG campaign này,
      // trip (gỡ thật khỏi campaign_fb_accounts + log) nếu >= 3.
      const isAccountHealthEvent = status === 'Checkpoint' || (status === 'Failed' && await isAccountHealthFailure(errorMessage));
      if (isAccountHealthEvent && fbAccountId) {
        const [{ campaign_id: breakerCampaignId }] = await sqlTx`
          SELECT campaign_id FROM campaign_runs WHERE id = ${runId}
        `;
        const [{ cnt: failedCount }] = await sqlTx`
          SELECT COUNT(*)::int AS cnt
          FROM campaign_run_items
          WHERE run_id IN (SELECT id FROM campaign_runs WHERE campaign_id = ${breakerCampaignId})
            AND fb_account_id = ${fbAccountId}
            AND (
              status = 'Checkpoint'
              OR (status = 'Failed' AND (
                error_message ILIKE '%session expired%'
                OR error_message ILIKE '%login required%'
                OR error_message ILIKE '%fb-session.json not found%'
              ))
            )
        `;
        await _maybeTripCircuitBreaker(sqlTx, breakerCampaignId, fbAccountId, failedCount, 'job_posting');
      }

      // 2. If Checkpoint / Blocked, immediately mark the FB account
      if (status === 'Checkpoint' && fbAccountId) {
        await sqlTx`
          UPDATE fb_accounts 
          SET status = 'Checkpoint', updated_time = now()
          WHERE id = ${fbAccountId}
        `;
      }

      // 3. Aggregate progress & Update Notification In-Place (Milestones 25/50/75/100)
      const [run] = await sqlTx`
        SELECT cr.id, cr.campaign_id, cr.notification_id, cr.stats, c.campaign_name
        FROM campaign_runs cr
        JOIN campaigns c ON cr.campaign_id = c.id
        WHERE cr.id = ${runId}
        FOR UPDATE
      `;

      if (run && run.notification_id) {
        const [counts] = await sqlTx`
          SELECT 
            COUNT(*)::int as total_completed,
            COUNT(*) FILTER (WHERE status = 'Sent')::int as sent_count,
            COUNT(*) FILTER (WHERE status = 'Failed')::int as failed_count,
            COUNT(*) FILTER (WHERE status = 'Interrupted')::int as interrupted_count,
            COUNT(*) FILTER (WHERE status = 'Not Processed')::int as not_processed_count,
            COUNT(*) FILTER (WHERE status = 'Checkpoint')::int as checkpoint_count,
            COUNT(*) FILTER (WHERE status = 'Skipped')::int as skipped_count
          FROM campaign_run_items
          WHERE run_id = ${runId}
        `;

        const lastNotifiedMilestone = Number(run.stats?.lastNotifiedMilestone) || 0;
        const totalPlanned = run.stats?.totalDispatched || counts.total_completed;
        const currentPct = totalPlanned > 0
          ? Math.floor((counts.total_completed / totalPlanned) * 100)
          : 0;

        // Mốc CAO NHẤT trong PROGRESS_MILESTONES mà (a) đã đạt (currentPct >= mốc)
        // và (b) chưa từng thông báo trước đó (mốc > lastNotifiedMilestone).
        const newMilestone = PROGRESS_MILESTONES
          .filter(m => currentPct >= m && m > lastNotifiedMilestone)
          .pop();

        if (newMilestone) {
          const progressMessage = `📢 Chiến dịch "${run.campaign_name}": ${newMilestone}% hoàn tất ` +
            `(${counts.total_completed}/${totalPlanned} nhóm — ✅ ${counts.sent_count} thành công` +
            `${counts.failed_count > 0 ? `, ❌ ${counts.failed_count} lỗi` : ''}` +
            `${counts.checkpoint_count > 0 ? `, ⚠️ ${counts.checkpoint_count} checkpoint` : ''})`;

          await sqlTx`
            UPDATE notifications SET
              title = ${'Đang chạy chiến dịch... (' + newMilestone + '%)'},
              message = ${progressMessage},
              metadata = jsonb_set(
                metadata,
                '{progress}',
                ${sqlTx.json({
                  totalPlanned,
                  completed: counts.total_completed,
                  sent: counts.sent_count,
                  failed: counts.failed_count,
                  checkpoint: counts.checkpoint_count,
                  skipped: counts.skipped_count,
                  milestone: newMilestone
                })}
              ),
              is_read = false,
              updated_at = now()
            WHERE id = ${run.notification_id}
          `;

          // Ghi nhớ mốc vừa thông báo để không lặp lại
          await sqlTx`
            UPDATE campaign_runs SET
              stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{lastNotifiedMilestone}', ${sqlTx.json(newMilestone)})
            WHERE id = ${runId}
          `;
        }
      }
    });

    return NextResponse.json({ success: true, itemId });
  } catch (error) {
    console.error('[Webhook campaign-run-progress] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
