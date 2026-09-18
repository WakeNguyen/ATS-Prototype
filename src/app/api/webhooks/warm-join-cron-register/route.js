import { NextResponse } from 'next/server';
import { _acquireWarmJoinRunLock } from '../../../../app/campaign_actions.js';

/**
 * POST /api/webhooks/warm-join-cron-register
 * Webhook route called by n8n Workflow C (cron trigger branch) to register a run.
 * Enforces transaction-level advisory locking (warm_join_run_lock) and ensures no other
 * warm_join run is currently active before granting a new runId.
 * Protected by `x-internal-secret` header.
 */
export async function POST(request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lockRes = await _acquireWarmJoinRunLock({
      campaignId: null,
      accountIds: [],
      triggerSource: 'cron'
    });

    if (!lockRes.success) {
      if (lockRes.alreadyRunning) {
        return NextResponse.json({
          success: false,
          error: 'already_running'
        }, { status: 200 });
      }
      return NextResponse.json({
        success: false,
        error: lockRes.error || 'Failed to acquire lock'
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      runId: lockRes.runId,
      accountIds: lockRes.accountIds,
      campaignId: lockRes.campaignId || null,
      maxGroupsPerAccount: lockRes.maxPostsPerRun
    }, { status: 200 });
  } catch (error) {
    console.error('[warm-join-cron-register] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
