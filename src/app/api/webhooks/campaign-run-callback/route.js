import { NextResponse } from 'next/server';
import sql, { sqlSandbox } from '../../../../lib/db.js';

/**
 * POST /api/webhooks/campaign-run-callback
 * Called once by n8n when an entire Campaign Run finishes.
 * Closes the run, resets campaign status, and updates the summary notification.
 * Protected by `x-internal-secret` header.
 */
export async function POST(request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const sqlClient = body.environment === 'sandbox' ? sqlSandbox : sql;
    const {
      runId,
      status = 'Completed',
      summary = '',
      errorMessage = null,
      n8nExecutionId = null,
      isSystemicFailure = false,
      is_systemic_failure = false
    } = body;

    const systemicFailure = Boolean(isSystemicFailure || is_systemic_failure);

    if (!runId) {
      return NextResponse.json({ error: 'runId is required' }, { status: 400 });
    }

    let campaignIdToVerify = null;

    await sqlClient.begin(async (sqlTx) => {
      // 1. Update Campaign Run
      const [run] = await sqlTx`
        UPDATE campaign_runs SET
          status = ${status},
          is_systemic_failure = ${systemicFailure},
          completed_at = now(),
          summary = ${summary || null},
          error_message = ${errorMessage || null},
          n8n_execution_id = ${n8nExecutionId || null}
        WHERE id = ${runId}
        RETURNING campaign_id, notification_id
      `;

      if (!run) {
        throw new Error(`Campaign run with ID ${runId} not found`);
      }

      campaignIdToVerify = run.campaign_id;

      // 2. Reset Campaign status or trigger Circuit Breaker
      if (systemicFailure) {
        await sqlTx`
          UPDATE campaigns SET
            status = 'Needs Review',
            is_active = false,
            auto_run_enabled = false,
            last_updated = now()
          WHERE id = ${run.campaign_id}
        `;
      } else {
        await sqlTx`
          UPDATE campaigns SET
            status = 'Active',
            last_updated = now()
          WHERE id = ${run.campaign_id}
        `;
      }

      // 3. Update summary notification in-place
      if (run.notification_id) {
        let severity = status === 'Failed' ? 'error' : (status === 'PartialSuccess' ? 'warning' : 'success');
        let notifTitle = status === 'Failed' 
          ? 'Chiến dịch thất bại' 
          : (status === 'PartialSuccess' ? 'Chiến dịch hoàn tất một phần' : 'Chiến dịch hoàn tất thành công');

        if (systemicFailure) {
          severity = 'error';
          notifTitle = 'Chiến dịch cần kiểm tra (Lỗi hệ thống / Bridge)';
        }

        await sqlTx`
          UPDATE notifications SET
            type = 'campaign_completed',
            title = ${notifTitle},
            message = ${summary || (systemicFailure ? 'Gặp lỗi hạ tầng/bridge không phản hồi. Chiến dịch đã tạm dừng để kiểm tra.' : 'Chiến dịch đã hoàn tất toàn bộ quá trình đăng bài.')},
            severity = ${severity},
            is_read = false,
            updated_at = now()
          WHERE id = ${run.notification_id}
        `;
      }
    });

    // 4. Check if Target Quota is completed (only for non-systemic runs)
    if (campaignIdToVerify && !systemicFailure) {
      const { checkCampaignAutoCompletion } = await import('../../../campaign_actions.js');
      await checkCampaignAutoCompletion(campaignIdToVerify, sqlClient);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Webhook campaign-run-callback] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
