import { NextResponse } from 'next/server';
import sql from '../../../../lib/db.js';
import { decryptSecret } from '../../../../lib/encryption.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (val) => typeof val === 'string' && UUID_REGEX.test(val.trim());

/**
 * GET /api/webhooks/warm-join-data
 * Endpoint for n8n Auto-Warm & Group Auto-Joiner workflow (C).
 * Returns active FB accounts, target groups needing join, and joined relations.
 * Requires a verified running warm_join_runs record (via ?runId=UUID query parameter).
 * Protected by `x-internal-secret` header.
 */
export async function GET(request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');

    if (!runId || !isValidUUID(runId)) {
      return NextResponse.json({ 
        error: 'Missing or invalid runId query parameter. A verified active runId is required to fetch warm data.' 
      }, { status: 400 });
    }

    // Verify runId exists and is in 'Running' state
    const [activeRun] = await sql`
      SELECT id, status, campaign_id, trigger_source
      FROM warm_join_runs
      WHERE id = ${runId.trim()}
    `;

    if (!activeRun) {
      return NextResponse.json({ 
        error: 'No warm_join_run found with the provided runId.' 
      }, { status: 404 });
    }

    if (activeRun.status !== 'Running') {
      return NextResponse.json({ 
        error: `Run is not in Running state (current status: ${activeRun.status}).` 
      }, { status: 409 });
    }

    // 1. Fetch Active FB Accounts with decrypted proxy_url
    const rawAccounts = await sql`
      SELECT id, account_name, account_ref, proxy_url, reset_ip_url, daily_quota, status, last_warmed_at
      FROM fb_accounts
      WHERE status = 'Active'
      ORDER BY account_name ASC
    `;

    const accounts = rawAccounts.map(acc => ({
      ...acc,
      proxy_url: decryptSecret(acc.proxy_url) || ''
    }));

    // 2. Fetch target groups that are active and not yet fully joined
    const targetGroups = await sql`
      SELECT id, name, url, group_type, join_status, admin_questions, custom_join_answer
      FROM social_group_urls
      WHERE is_active = true 
        AND join_status != 'Joined'
      ORDER BY created_time ASC
      LIMIT 100
    `;

    // 3. Fetch joined relationships
    const joinedRows = await sql`
      SELECT fb_account_id, social_group_id, joined_at
      FROM fb_account_groups
    `;

    return NextResponse.json({
      success: true,
      accounts,
      targetGroups,
      joinedRows
    });
  } catch (error) {
    console.error('[Webhook warm-join-data] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
