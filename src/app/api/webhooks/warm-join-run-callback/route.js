import { NextResponse } from 'next/server';
import sql, { sqlSandbox } from '../../../../lib/db.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (val) => typeof val === 'string' && UUID_REGEX.test(val.trim());

/**
 * POST /api/webhooks/warm-join-run-callback
 * Called by n8n ONCE after the entire Auto-Warm & Group Auto-Joiner run finishes.
 * As of 2026-09-06, per-item insertion + side-effects moved to
 * warm-join-run-progress/route.js (called once per account, mirroring
 * campaign-run-progress/campaign-run-callback split for Job Posting). This route
 * is now a pure finalizer: closes warm_join_runs, computes final aggregate stats
 * from warm_join_run_items, and closes out the main run notification.
 * Protected by `x-internal-secret` header.
 */
export async function POST(request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      runId,
      status = 'Completed',
      summary = '',
      errorMessage = null,
      n8nExecutionId = null
    } = body;

    const sqlClient = body.environment === 'sandbox' ? sqlSandbox : sql;

    let targetRunId = isValidUUID(runId) ? runId.trim() : null;

    if (!targetRunId) {
      return NextResponse.json({ error: 'runId is required and must be a valid UUID' }, { status: 400 });
    }

    await sqlClient.begin(async (sqlTx) => {
      // 1. Compute final aggregate stats from items already inserted by warm-join-run-progress
      const [counts] = await sqlTx`
        SELECT
          COUNT(*) FILTER (WHERE social_group_id IS NULL)::int as total_accounts,
          COUNT(*) FILTER (WHERE social_group_id IS NULL AND action = 'Warmed')::int as warmed_count,
          COUNT(*) FILTER (WHERE action = 'Joined')::int as joined_count,
          COUNT(*) FILTER (WHERE action = 'Failed')::int as failed_count,
          COUNT(*) FILTER (WHERE social_group_id IS NULL AND action = 'Checkpoint')::int as checkpoint_count
        FROM warm_join_run_items
        WHERE run_id = ${targetRunId}
      `;

      // 2. Update warm_join_runs (status + merge final stats, preserve totalPlanned/lastNotifiedMilestone)
      const [run] = await sqlTx`
        UPDATE warm_join_runs SET
          status = ${status},
          completed_at = now(),
          summary = ${summary || null},
          error_message = ${errorMessage || null},
          n8n_execution_id = ${n8nExecutionId || null},
          stats = COALESCE(stats, '{}'::jsonb) || ${sqlTx.json({
            totalItems: counts.total_accounts,
            warmedCount: counts.warmed_count,
            joinedCount: counts.joined_count,
            failedCount: counts.failed_count,
            checkpointCount: counts.checkpoint_count
          })}
        WHERE id = ${targetRunId}
        RETURNING id, notification_id, campaign_id
      `;

      if (!run) {
        throw new Error(`warm_join_runs with ID ${targetRunId} not found`);
      }

      // 3. Close out the main run notification (was previously never closed — bugfix)
      if (run.notification_id) {
        const severity = status === 'Failed' ? 'error' : (status === 'PartialSuccess' ? 'warning' : 'success');
        const notifTitle = status === 'Failed'
          ? 'Phiên nuôi tài khoản thất bại'
          : (status === 'PartialSuccess' ? 'Phiên nuôi tài khoản hoàn tất một phần' : 'Phiên nuôi tài khoản hoàn tất');

        await sqlTx`
          UPDATE notifications SET
            type = 'warm_join_completed',
            title = ${notifTitle},
            message = ${summary || 'Phiên nuôi tài khoản & tự động tham gia nhóm đã hoàn tất.'},
            severity = ${severity},
            is_read = false,
            updated_at = now()
          WHERE id = ${run.notification_id}
        `;
      }

      // 4. Update campaign status if attached to a specific campaign
      if (run.campaign_id) {
        await sqlTx`
          UPDATE campaigns SET status = 'Active', last_updated = now()
          WHERE id = ${run.campaign_id}
        `;
      }
    });

    // 5. Check if Warming campaign coverage or end_date is completed
    const [closedRun] = await sqlClient`SELECT campaign_id FROM warm_join_runs WHERE id = ${targetRunId}`;
    if (closedRun?.campaign_id) {
      const { checkWarmingCampaignAutoCompletion } = await import('../../../campaign_actions.js');
      await checkWarmingCampaignAutoCompletion(closedRun.campaign_id, sqlClient);
    }

    return NextResponse.json({ success: true, runId: targetRunId });
  } catch (error) {
    console.error('[Webhook warm-join-run-callback] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
