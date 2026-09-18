import { NextResponse } from 'next/server';
import sql from '../../../../lib/db.js';
import { checkCampaignAutoCompletion } from '../../../campaign_actions.js';

/**
 * GET /api/webhooks/auto-run-eligible-campaigns
 * Called periodically (e.g. every 2-5m) by n8n Auto-Scheduler Workflow E.
 * Lists active campaigns eligible for auto-triggering.
 * Protected by `x-internal-secret` header.
 */
export async function GET(request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eligibleCampaigns = await sql`
      SELECT 
        c.id,
        c.campaign_name,
        c.max_posts_per_run,
        c.start_date,
        c.end_date,
        c.start_time,
        c.end_time,
        c.status,
        (
          SELECT COUNT(DISTINCT csg.social_group_id)::int
          FROM campaign_social_groups csg
          WHERE csg.campaign_id = c.id
        ) as total_target_pool,
        (
          SELECT COUNT(DISTINCT cri.social_group_id)::int
          FROM campaign_run_items cri
          WHERE cri.run_id IN (
            SELECT cr.id FROM campaign_runs cr WHERE cr.campaign_id = c.id AND cr.is_systemic_failure = false
          ) AND cri.status IN ('Sent', 'Failed')
        ) as processed_count
      FROM campaigns c
      WHERE c.campaign_type = 'Job Posting'
        AND c.is_active = true
        AND c.auto_run_enabled = true
        AND (c.start_date IS NULL OR c.start_date::date <= CURRENT_DATE)
        AND (c.end_date IS NULL OR c.end_date::date >= CURRENT_DATE)
        AND (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::time BETWEEN c.start_time AND c.end_time
        AND NOT EXISTS (
          SELECT 1 FROM campaign_runs cr WHERE cr.campaign_id = c.id AND cr.status = 'Running'
        )
      ORDER BY c.last_updated ASC
    `;

    const readyToRun = [];

    for (const c of eligibleCampaigns) {
      const totalTargetPool = Number(c.total_target_pool || 0);
      const processedCount = Number(c.processed_count || 0);

      if (totalTargetPool > 0 && processedCount >= totalTargetPool) {
        // Automatically mark complete and skip
        await checkCampaignAutoCompletion(c.id);
        continue;
      }

      readyToRun.push({
        id: c.id,
        campaignName: c.campaign_name,
        totalTargetPool,
        maxPostsPerRun: c.max_posts_per_run,
        processedCount,
        status: c.status
      });
    }

    return NextResponse.json({
      success: true,
      count: readyToRun.length,
      eligibleCampaigns: readyToRun
    });
  } catch (error) {
    console.error('[Webhook auto-run-eligible-campaigns] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
