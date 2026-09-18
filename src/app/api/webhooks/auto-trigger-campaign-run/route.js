import { NextResponse } from 'next/server';
import sql from '../../../../lib/db.js';
import { 
  computeCampaignDispatchPreview, 
  _executeCampaignRunInternal, 
  checkCampaignAutoCompletion 
} from '../../../campaign_actions.js';

/**
 * POST /api/webhooks/auto-trigger-campaign-run
 * Atomic claim & trigger endpoint for n8n Auto-Scheduler Workflow E.
 * Protected by `x-internal-secret` header.
 */
export async function POST(request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { campaignId } = body;

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }

    // 1. Check & Compute Dispatch Preview
    const previewRes = await computeCampaignDispatchPreview(campaignId);
    if (!previewRes.success) {
      return NextResponse.json({ error: previewRes.error }, { status: 400 });
    }

    const dispatch = previewRes.dispatch || [];
    if (dispatch.length === 0) {
      // Check if campaign already met quota and should auto-complete
      const compRes = await checkCampaignAutoCompletion(campaignId);
      return NextResponse.json({ 
        success: false, 
        reason: 'no_eligible_groups',
        message: 'No eligible groups available for dispatch at this time (all groups posted recently, in cooldown, or quota reached).',
        completed: compRes?.completed || false
      }, { status: 200 });
    }

    // 2. Execute Run with atomic transaction lock
    const runRes = await _executeCampaignRunInternal({
      campaignId,
      confirmedDispatch: dispatch,
      triggerSource: 'Auto-Scheduler',
      triggeredBy: 'n8n_scheduler'
    });

    if (!runRes.success) {
      return NextResponse.json({ error: runRes.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      runId: runRes.runId,
      notificationId: runRes.notificationId,
      dispatchedCount: dispatch.length
    });
  } catch (error) {
    console.error('[Webhook auto-trigger-campaign-run] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
