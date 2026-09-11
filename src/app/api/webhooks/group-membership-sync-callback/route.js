import { NextResponse } from 'next/server';
import sql from '../../../../lib/db.js';
import { normalizeSocialGroupUrl } from '../../../../lib/url_utils.js';

export async function POST(request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { runId, status = 'Completed', n8nExecutionId = null, errorMessage = null, items = [] } = body;

    if (!runId) {
      return NextResponse.json({ error: 'runId is required' }, { status: 400 });
    }

    let matchedCount = 0;
    let unmatchedUrls = [];

    await sql.begin(async (sqlTx) => {
      // Cache all active social_group_urls with normalized URLs for the entire batch
      const allGroups = await sqlTx`SELECT id, url FROM social_group_urls WHERE is_active = true`;
      const urlToGroupId = new Map(
        allGroups.map(g => [normalizeSocialGroupUrl(g.url), g.id])
      );

      for (const item of items) {
        const fbAccountId = item.fbAccountId || item.fb_account_id;
        if (!fbAccountId) continue;

        const joinedUrls = Array.isArray(item.joinedGroupUrls) ? item.joinedGroupUrls : [];

        for (const rawUrl of joinedUrls) {
          const normalized = normalizeSocialGroupUrl(rawUrl);
          const socialGroupId = urlToGroupId.get(normalized);

          if (!socialGroupId) {
            unmatchedUrls.push(rawUrl);
            continue;
          }

          // Upsert membership — idempotent, safe against multiple runs
          await sqlTx`
            INSERT INTO fb_account_groups (fb_account_id, social_group_id, joined_at)
            VALUES (${fbAccountId}, ${socialGroupId}, now())
            ON CONFLICT (fb_account_id, social_group_id) DO UPDATE
            SET joined_at = EXCLUDED.joined_at
          `;
          matchedCount++;

          // Best-effort: keep social_group_urls.join_status updated
          await sqlTx`
            UPDATE social_group_urls SET join_status = 'Joined'
            WHERE id = ${socialGroupId} AND join_status = 'Not Joined'
          `;
        }

        if (item.error && /checkpoint/i.test(item.error)) {
          await sqlTx`
            UPDATE fb_accounts SET status = 'Checkpoint', updated_time = now()
            WHERE id = ${fbAccountId}
          `;
        }
      }

      // Close sync run record
      await sqlTx`
        UPDATE group_membership_sync_runs SET
          status = ${status},
          completed_at = now(),
          n8n_execution_id = ${n8nExecutionId},
          error_message = ${errorMessage},
          stats = ${sqlTx.json({ totalItems: items.length, matchedGroups: matchedCount, unmatchedUrlCount: unmatchedUrls.length })}
        WHERE id = ${runId}
      `;
    });

    return NextResponse.json({ success: true, matchedCount, unmatchedCount: unmatchedUrls.length });
  } catch (error) {
    console.error('[Webhook group-membership-sync-callback] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
