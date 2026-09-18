import { NextResponse } from 'next/server';
import sql from '../../../../lib/db.js';

/**
 * POST /api/webhooks/import-social-groups
 * Bulk imports / upserts social groups from CSV/Google Sheets.
 * Uses ON CONFLICT (lower(trim(url))) DO NOTHING on sandbox, with fallback on public schema.
 * Protected by `x-internal-secret` header.
 */
export async function POST(request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { rows = [] } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No rows provided' });
    }

    // Filter and clean rows
    const validRows = rows.filter(r => r && r.url && typeof r.url === 'string' && r.url.trim().length > 0);

    if (validRows.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No valid URL rows found' });
    }

    const currentSchema = process.env.DB_SCHEMA || 'sandbox';
    let insertedCount = 0;
    let warning = null;

    if (currentSchema === 'sandbox') {
      const insertRows = validRows.map(r => ({
        name: r.name || 'Unnamed Group',
        url: r.url.trim(),
        group_type: Array.isArray(r.groupType) ? r.groupType : (r.groupType ? [String(r.groupType)] : ['General']),
        is_active: true,
        join_status: 'Not Joined',
        created_time: new Date()
      }));

      const inserted = await sql`
        INSERT INTO social_group_urls ${sql(insertRows, 'name', 'url', 'group_type', 'is_active', 'join_status', 'created_time')}
        ON CONFLICT (lower(trim(url))) DO NOTHING
        RETURNING id
      `;

      insertedCount = inserted.length;
    } else {
      // Fallback for public schema without unique constraint
      warning = 'public schema fallback used (checking existing URLs before insertion)';
      const normUrls = validRows.map(r => r.url.trim().toLowerCase());

      const existing = await sql`
        SELECT lower(trim(url)) as norm_url
        FROM social_group_urls
        WHERE lower(trim(url)) = ANY(${normUrls})
      `;
      const existingSet = new Set(existing.map(e => e.norm_url));

      const toInsert = validRows.filter(r => !existingSet.has(r.url.trim().toLowerCase()));

      if (toInsert.length > 0) {
        for (const row of toInsert) {
          const groupType = Array.isArray(row.groupType) ? row.groupType : (row.groupType ? [String(row.groupType)] : ['General']);
          await sql`
            INSERT INTO social_group_urls (name, url, group_type, is_active, join_status, created_time)
            VALUES (${row.name || 'Unnamed Group'}, ${row.url.trim()}, ${groupType}, true, 'Not Joined', now())
          `;
        }
      }
      insertedCount = toInsert.length;
    }

    return NextResponse.json({
      success: true,
      totalReceived: validRows.length,
      insertedCount,
      warning
    });
  } catch (error) {
    console.error('[Webhook import-social-groups] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
