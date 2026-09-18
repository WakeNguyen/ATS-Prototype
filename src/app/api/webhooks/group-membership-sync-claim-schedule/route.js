import { NextResponse } from 'next/server';
import sql from '../../../../lib/db.js';

export async function POST(request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Atomic claim: UPDATE ... WHERE status='Pending' RETURNING ensures only 1 request grabs 1 row
    // even if multiple polls happen concurrently (PostgreSQL row-level lock handles it).
    const [claimed] = await sql`
      UPDATE group_membership_sync_schedule
      SET status = 'Fired', fired_at = now()
      WHERE id = (
        SELECT id FROM group_membership_sync_schedule
        WHERE status = 'Pending' AND scheduled_for <= now()
        ORDER BY scheduled_for ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, scheduled_for
    `;

    if (!claimed) {
      return NextResponse.json({ claimed: false });
    }

    return NextResponse.json({ claimed: true, scheduleId: claimed.id, scheduledFor: claimed.scheduled_for });
  } catch (error) {
    console.error('[Webhook group-membership-sync-claim-schedule] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
