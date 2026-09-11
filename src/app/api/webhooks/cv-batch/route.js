import { NextResponse } from 'next/server';
import sql from '../../../../lib/db';

export async function POST(req) {
  try {
    const secret = req.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body = await req.json();
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }

    const { action = 'CREATE', batch_id, total_files = 1, status = 'running', notification_id, source = 'n8n_form_upload' } = body;

    if (action === 'CREATE') {
      const [row] = await sql`
        INSERT INTO cv_import_batches (id, source, total_files, status, notification_id, created_at, updated_at)
        VALUES (
          ${batch_id ? batch_id : sql`gen_random_uuid()`}, 
          ${source}, 
          ${total_files}, 
          ${status}, 
          ${notification_id || null}, 
          NOW(), 
          NOW()
        )
        RETURNING id, source, total_files, status, notification_id, created_at
      `;
      return NextResponse.json({ success: true, batch: row }, { status: 201 });
    }

    if (action === 'UPDATE') {
      if (!batch_id) {
        return NextResponse.json({ error: 'batch_id is required for UPDATE' }, { status: 400 });
      }
      const [row] = await sql`
        UPDATE cv_import_batches
        SET 
          status = COALESCE(${status ?? null}, status),
          notification_id = COALESCE(${notification_id ?? null}, notification_id),
          updated_at = NOW()
        WHERE id = ${batch_id}
        RETURNING id, status, notification_id, updated_at
      `;
      return NextResponse.json({ success: true, batch: row });
    }

    if (action === 'FIND_STUCK') {
      const stuckBatches = await sql`
        SELECT id, source, total_files, status, notification_id, created_at, updated_at
        FROM cv_import_batches
        WHERE status = 'running' AND updated_at < NOW() - INTERVAL '10 minutes'
        ORDER BY created_at ASC
      `;

      const result = [];
      for (const b of stuckBatches) {
        const pendingItems = await sql`
          SELECT id as batch_item_id, batch_id, original_filename, drive_file_id, drive_url, status
          FROM cv_import_batch_items
          WHERE batch_id = ${b.id} AND status IN ('queued', 'processing')
          ORDER BY created_at ASC
        `;
        result.push({
          batch: b,
          pendingItems
        });
      }

      return NextResponse.json({ success: true, stuckBatches: result });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[cv-batch] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
