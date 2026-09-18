import { NextResponse } from 'next/server';
import sql from '../../../../lib/db.js';

export async function POST(request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { scheduledTimes = [] } = await request.json();
    if (!Array.isArray(scheduledTimes) || scheduledTimes.length !== 2) {
      return NextResponse.json({ error: 'scheduledTimes must be an array of exactly 2 ISO timestamps' }, { status: 400 });
    }

    const forDate = new Date(scheduledTimes[0]).toISOString().slice(0, 10);
    const inserted = [];

    for (let i = 0; i < scheduledTimes.length; i++) {
      const [row] = await sql`
        INSERT INTO group_membership_sync_schedule (for_date, slot_index, scheduled_for, status)
        VALUES (${forDate}, ${i + 1}, ${scheduledTimes[i]}, 'Pending')
        ON CONFLICT (for_date, slot_index) DO NOTHING
        RETURNING id, scheduled_for
      `;
      if (row) inserted.push(row);
    }

    return NextResponse.json({ success: true, forDate, inserted });
  } catch (error) {
    console.error('[Webhook group-membership-sync-schedule-roll] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
