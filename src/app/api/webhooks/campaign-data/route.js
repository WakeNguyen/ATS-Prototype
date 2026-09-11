import { NextResponse } from 'next/server';
import sql from '../../../../lib/db.js';
import { decryptSecret } from '../../../../lib/encryption.js';

/**
 * GET /api/webhooks/campaign-data
 * Endpoint for n8n to retrieve aggregated campaign data, target groups, active accounts, and 24h history.
 * Protected by `x-internal-secret` header.
 */
export async function GET(request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId');
    const runId = searchParams.get('runId');

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId parameter is required' }, { status: 400 });
    }

    const [campaign] = await sql`
      SELECT 
        id, campaign_name, channel, content, post_image_url, post_language,
        auto_spin_content, target_quota, is_active, status, start_time, end_time, auto_run_enabled
      FROM campaigns
      WHERE id = ${campaignId}
    `;

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const targetGroups = await sql`
      SELECT sgu.id, sgu.name, sgu.url, sgu.group_type, sgu.join_status
      FROM campaign_social_groups csg
      JOIN social_group_urls sgu ON csg.social_group_id = sgu.id
      WHERE csg.campaign_id = ${campaignId} AND sgu.is_active = true
      ORDER BY sgu.name ASC
    `;

    const rawAccounts = await sql`
      SELECT id, account_name, account_ref, proxy_url, reset_ip_url, daily_quota, status
      FROM fb_accounts
      WHERE status = 'Active'
      ORDER BY account_name ASC
    `;

    // Decrypt proxy_url for n8n execution
    const accounts = rawAccounts.map(acc => ({
      ...acc,
      proxy_url: decryptSecret(acc.proxy_url) || ''
    }));

    const recentLogs = await sql`
      SELECT social_group_id, fb_account_id, status, posted_at
      FROM campaign_run_items
      WHERE status = 'Sent'
        AND posted_at > now() - interval '24 hours'
    `;

    return NextResponse.json({
      success: true,
      campaign,
      targetGroups,
      accounts,
      recentLogs,
      runId: runId || null
    });
  } catch (error) {
    console.error('[Webhook campaign-data] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
