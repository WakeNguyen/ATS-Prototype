import { NextResponse } from 'next/server';
import sql from '../../../../lib/db.js';
import { decryptSecret } from '../../../../lib/encryption.js';
import { _getBusyFbAccountIds } from '../../../campaign_actions.js';

export async function GET(request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scheduleId = new URL(request.url).searchParams.get('scheduleId') || null;
    let result = null;

    await sql.begin(async (sqlTx) => {
      // 1. Transaction-level advisory lock to serialize sync runs
      await sqlTx`SELECT pg_advisory_xact_lock(hashtext('group_membership_sync_run_lock'))`;

      const [activeSync] = await sqlTx`
        SELECT id FROM group_membership_sync_runs
        WHERE status = 'Running' AND started_at > now() - interval '30 minutes'
        LIMIT 1
      `;
      if (activeSync) {
        result = { success: false, error: 'already_running', activeRunId: activeSync.id };
        return;
      }

      // 2. Eliminate busy accounts (Per-Account Mutex)
      const busyIds = await _getBusyFbAccountIds(sqlTx);

      const eligible = await sqlTx`
        SELECT id, account_name, account_ref, proxy_url, reset_ip_url
        FROM fb_accounts
        WHERE status = 'Active'
          ${busyIds.length > 0 ? sqlTx`AND id != ALL(${busyIds})` : sqlTx``}
        ORDER BY account_ref ASC
      `;

      const eligibleIds = eligible.map(a => a.id);

      // 3. Register run record (acts as mutex lock until callback finishes)
      const [run] = await sqlTx`
        INSERT INTO group_membership_sync_runs (schedule_id, status, trigger_source, account_ids, started_at, created_time)
        VALUES (${scheduleId}, 'Running', 'cron_jitter', ${eligibleIds}, now(), now())
        RETURNING id
      `;

      result = {
        success: true,
        runId: run.id,
        skippedBusyCount: busyIds.length,
        accounts: eligible.map(a => ({
          id: a.id,
          account_ref: a.account_ref,
          account_name: a.account_name,
          proxy_url: decryptSecret(a.proxy_url) || '',
          reset_ip_url: a.reset_ip_url || ''
        }))
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Webhook group-membership-sync-data] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
