import { NextResponse } from 'next/server';
import sql from '../../../../lib/db';

export async function GET(req) {
  try {
    const secret = req.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batch_id');

    if (!batchId) {
      return NextResponse.json({ error: 'batch_id is required' }, { status: 400 });
    }

    const items = await sql`
      SELECT id, batch_id, original_filename, drive_file_id, drive_url, status, result_match_status, candidate_id, pending_import_id, error_message, created_at
      FROM cv_import_batch_items
      WHERE batch_id = ${batchId}
      ORDER BY created_at ASC
    `;

    return NextResponse.json({ success: true, items });
  } catch (err) {
    console.error('[cv-batch-item GET] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

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

    const { 
      action = 'INSERT', 
      item, 
      batch_item_id, 
      status, 
      result_match_status, 
      candidate_id, 
      pending_import_id, 
      error_message 
    } = body;

    if (action === 'INSERT') {
      const { batch_id, original_filename, drive_file_id, drive_url, status: itemStatus = 'queued' } = item || body;
      const [row] = await sql`
        INSERT INTO cv_import_batch_items (batch_id, original_filename, drive_file_id, drive_url, status, created_at, updated_at)
        VALUES (${batch_id}, ${original_filename}, ${drive_file_id || null}, ${drive_url || null}, ${itemStatus}, NOW(), NOW())
        RETURNING id, batch_id, original_filename, drive_file_id, drive_url, status, created_at
      `;
      return NextResponse.json({ success: true, batch_item: row }, { status: 201 });
    }

    if (action === 'LOCK' || (action === 'UPDATE' && status === 'processing')) {
      const targetId = batch_item_id || item?.id;
      if (!targetId) {
        return NextResponse.json({ error: 'batch_item_id is required' }, { status: 400 });
      }

      const result = await sql.begin(async (sqlTx) => {
        // Acquire advisory transaction lock for this batch item ID
        await sqlTx`SELECT pg_advisory_xact_lock(hashtext(${targetId}::text))`;

        // Only transition from queued to processing
        const [row] = await sqlTx`
          UPDATE cv_import_batch_items
          SET status = 'processing', updated_at = NOW()
          WHERE id = ${targetId} AND status = 'queued'
          RETURNING id, batch_id, status, updated_at
        `;

        if (!row) {
          const [current] = await sqlTx`
            SELECT id, batch_id, status FROM cv_import_batch_items WHERE id = ${targetId}
          `;
          return { success: false, locked: false, currentStatus: current?.status, message: 'Item is not in queued state' };
        }

        return { success: true, locked: true, batch_item: row };
      });

      return NextResponse.json(result, { status: result.locked ? 200 : 409 });
    }

    if (action === 'UPDATE') {
      const targetId = batch_item_id || item?.id;
      if (!targetId) {
        return NextResponse.json({ error: 'batch_item_id is required for UPDATE' }, { status: 400 });
      }

      const row = await sql.begin(async (sqlTx) => {
        await sqlTx`SELECT pg_advisory_xact_lock(hashtext(${targetId}::text))`;
        const [updatedRow] = await sqlTx`
          UPDATE cv_import_batch_items
          SET 
            status = COALESCE(${status ?? null}, status),
            result_match_status = COALESCE(${result_match_status ?? null}, result_match_status),
            candidate_id = COALESCE(${candidate_id ?? null}, candidate_id),
            pending_import_id = COALESCE(${pending_import_id ?? null}, pending_import_id),
            error_message = COALESCE(${error_message ?? null}, error_message),
            updated_at = NOW()
          WHERE id = ${targetId}
          RETURNING id, batch_id, status, result_match_status, candidate_id, pending_import_id, error_message, updated_at
        `;
        return updatedRow;
      });

      return NextResponse.json({ success: true, batch_item: row });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[cv-batch-item POST] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
