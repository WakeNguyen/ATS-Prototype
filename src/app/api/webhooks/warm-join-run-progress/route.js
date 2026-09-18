import { NextResponse } from 'next/server';
import sql, { sqlSandbox } from '../../../../lib/db.js';
import { _maybeTripCircuitBreaker, isAccountHealthFailure } from '../../../campaign_actions.js';

const PROGRESS_MILESTONES = [25, 50, 75, 100];

/**
 * POST /api/webhooks/warm-join-run-progress
 * Receives the result of ONE finished FB account (warm + auto-join sub-items) from n8n.
 * Inserts warm_join_run_items rows (1 account-level row + N group-level rows), applies
 * the same side-effects as the old end-of-run callback used to (per account instead of
 * batched at the end), and updates the in-app notification in-place when a new
 * progress milestone (25/50/75/100%) is crossed. Mirrors campaign-run-progress/route.js.
 * Protected by `x-internal-secret` header.
 */
export async function POST(request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { runId, completedAccount } = body;

    const sqlClient = body.environment === 'sandbox' ? sqlSandbox : sql;

    if (!runId || !completedAccount) {
      return NextResponse.json({ error: 'runId and completedAccount are required' }, { status: 400 });
    }

    const {
      fbAccountId = null,
      accountAction = 'Warmed',
      accountErrorMessage = null,
      groupItems = []
    } = completedAccount;

    await sqlClient.begin(async (sqlTx) => {
      // 1. Insert the account-level item row (social_group_id = NULL marks it as the
      //    "1 account done" tick used for progress counting).
      await sqlTx`
        INSERT INTO warm_join_run_items (
          run_id, fb_account_id, social_group_id, group_name, group_url,
          action, error_message, created_time
        ) VALUES (
          ${runId}, ${fbAccountId || null}, NULL, NULL, NULL,
          ${accountAction}, ${accountErrorMessage || null}, now()
        )
      `;

      // 2. If account hit Checkpoint, flag it immediately (don't wait for run to finish)
      if (accountAction === 'Checkpoint' && fbAccountId) {
        await sqlTx`
          UPDATE fb_accounts SET status = 'Checkpoint', updated_time = now()
          WHERE id = ${fbAccountId}
        `;
      }

      // 3. Insert one warm_join_run_items row per group action + apply side-effects
      //    (identical logic to what warm-join-run-callback used to do per item).
      for (const g of groupItems) {
        const socialGroupId = g.socialGroupId || null;
        const groupName = g.groupName || '';
        const groupUrl = g.groupUrl || '';
        const action = g.action || 'Joined';
        const itemError = g.errorMessage || null;
        const adminQuestions = g.adminQuestions || null;
        const needsCustomAnswer = !!g.needsCustomAnswer;

        await sqlTx`
          INSERT INTO warm_join_run_items (
            run_id, fb_account_id, social_group_id, group_name, group_url,
            action, error_message, created_time
          ) VALUES (
            ${runId}, ${fbAccountId || null}, ${socialGroupId}, ${groupName}, ${groupUrl},
            ${action}, ${itemError || null}, now()
          )
        `;

        if (action === 'Joined' && socialGroupId && fbAccountId) {
          await sqlTx`
            UPDATE social_group_urls SET
              join_status = 'Joined',
              last_posted_account_id = ${fbAccountId}
            WHERE id = ${socialGroupId}
          `;
          await sqlTx`
            INSERT INTO fb_account_groups (fb_account_id, social_group_id, joined_at)
            VALUES (${fbAccountId}, ${socialGroupId}, now())
            ON CONFLICT (fb_account_id, social_group_id) DO UPDATE
            SET joined_at = EXCLUDED.joined_at
          `;
        }

        if ((needsCustomAnswer || action === 'AutoAnswered' || action === 'JoinRequested') && adminQuestions && socialGroupId) {
          const updatedRows = await sqlTx`
            UPDATE social_group_urls SET
              join_status = 'Needs Custom Answer',
              admin_questions = ${adminQuestions}
            WHERE id = ${socialGroupId} AND (join_status IS NULL OR join_status != 'Joined')
            RETURNING id
          `;
          if (updatedRows && updatedRows.length > 0) {
            await sqlTx`
              INSERT INTO notifications (
                type, title, message, severity, link, metadata, created_at, updated_at
              ) VALUES (
                'warm_join_needs_attention',
                'Cần điền câu trả lời xét duyệt nhóm',
                ${'Nhóm "' + (groupName || 'Facebook Group') + '" yêu cầu câu hỏi xét duyệt mới: ' + adminQuestions.substring(0, 150)},
                'warning',
                ${'/campaigns?tab=social-groups&group_id=' + socialGroupId},
                ${sqlTx.json({ runId, socialGroupId, groupName, adminQuestions })},
                now(), now()
              )
            `;
          }
        }
      }

      // 4. Touch last_warmed_at for this account
      if (fbAccountId) {
        await sqlTx`
          UPDATE fb_accounts SET last_warmed_at = now(), updated_time = now()
          WHERE id = ${fbAccountId}
        `;
      }

      // 5. Aggregate progress & update notification in-place (milestones 25/50/75/100)
      const [run] = await sqlTx`
        SELECT wjr.id, wjr.campaign_id, wjr.notification_id, wjr.stats,
               COALESCE(c.campaign_name, 'Global Warming & Auto-Join') AS campaign_name
        FROM warm_join_runs wjr
        LEFT JOIN campaigns c ON wjr.campaign_id = c.id
        WHERE wjr.id = ${runId}
        FOR UPDATE OF wjr
      `;

      // Circuit breaker: CHỈ tính các sự kiện phản ánh TÀI KHOẢN thật sự có vấn đề
      // (Checkpoint, hoặc Failed do session hết hạn) ở CẢ account-level (accountAction)
      // lẫn group-level (groupItems[].action) trong lượt gọi này — KHÔNG tính lỗi khác
      // (xem FIX_SPEC_2026-09-18b). Đếm lại tổng số sự kiện thuộc 2 loại trên của account
      // này TRONG campaign này, trip nếu >= 3.
      let hasGroupHealthFailure = false;
      for (const g of groupItems) {
        if (g.action === 'Checkpoint' || (g.action === 'Failed' && await isAccountHealthFailure(g.errorMessage))) {
          hasGroupHealthFailure = true;
          break;
        }
      }

      const isAccountHealthEventThisCall =
        accountAction === 'Checkpoint' ||
        (accountAction === 'Failed' && await isAccountHealthFailure(accountErrorMessage)) ||
        hasGroupHealthFailure;

      if (isAccountHealthEventThisCall && fbAccountId && run?.campaign_id) {
        const [{ cnt: failedCount }] = await sqlTx`
          SELECT COUNT(*)::int AS cnt
          FROM warm_join_run_items
          WHERE run_id IN (SELECT id FROM warm_join_runs WHERE campaign_id = ${run.campaign_id})
            AND fb_account_id = ${fbAccountId}
            AND (
              action = 'Checkpoint'
              OR (action = 'Failed' AND (
                error_message ILIKE '%session expired%'
                OR error_message ILIKE '%login required%'
                OR error_message ILIKE '%fb-session.json not found%'
              ))
            )
        `;
        await _maybeTripCircuitBreaker(sqlTx, run.campaign_id, fbAccountId, failedCount, 'warming');
      }

      if (run && run.notification_id) {
        const [counts] = await sqlTx`
          SELECT
            COUNT(*) FILTER (WHERE social_group_id IS NULL)::int as completed_accounts,
            COUNT(*) FILTER (WHERE social_group_id IS NULL AND action = 'Warmed')::int as warmed_count,
            COUNT(*) FILTER (WHERE social_group_id IS NULL AND action = 'Failed')::int as failed_account_count,
            COUNT(*) FILTER (WHERE social_group_id IS NULL AND action = 'Checkpoint')::int as checkpoint_count,
            COUNT(*) FILTER (WHERE action = 'Joined')::int as joined_count
          FROM warm_join_run_items
          WHERE run_id = ${runId}
        `;

        const lastNotifiedMilestone = Number(run.stats?.lastNotifiedMilestone) || 0;
        const totalPlanned = Number(run.stats?.totalPlanned) || counts.completed_accounts;
        const currentPct = totalPlanned > 0
          ? Math.floor((counts.completed_accounts / totalPlanned) * 100)
          : 0;

        const newMilestone = PROGRESS_MILESTONES
          .filter(m => currentPct >= m && m > lastNotifiedMilestone)
          .pop();

        if (newMilestone) {
          const progressMessage = `Chiến dịch "${run.campaign_name}": ${newMilestone}% hoàn tất ` +
            `(${counts.completed_accounts}/${totalPlanned} tài khoản - nuôi thành công ${counts.warmed_count}` +
            `${counts.joined_count > 0 ? `, đã vào ${counts.joined_count} nhóm` : ''}` +
            `${counts.failed_account_count > 0 ? `, ${counts.failed_account_count} lỗi` : ''}` +
            `${counts.checkpoint_count > 0 ? `, ${counts.checkpoint_count} checkpoint` : ''})`;

          await sqlTx`
            UPDATE notifications SET
              title = ${'Đang nuôi tài khoản... (' + newMilestone + '%)'},
              message = ${progressMessage},
              metadata = jsonb_set(
                metadata,
                '{progress}',
                ${sqlTx.json({
                  totalPlanned,
                  completed: counts.completed_accounts,
                  warmed: counts.warmed_count,
                  joined: counts.joined_count,
                  failed: counts.failed_account_count,
                  checkpoint: counts.checkpoint_count,
                  milestone: newMilestone
                })}
              ),
              is_read = false,
              updated_at = now()
            WHERE id = ${run.notification_id}
          `;

          await sqlTx`
            UPDATE warm_join_runs SET
              stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{lastNotifiedMilestone}', ${sqlTx.json(newMilestone)})
            WHERE id = ${runId}
          `;
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Webhook warm-join-run-progress] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
