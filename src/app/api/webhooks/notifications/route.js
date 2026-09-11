import { NextResponse } from 'next/server';
import sql from '../../../../lib/db';

export async function POST(req) {
  try {
    const secret = req.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    if (body.id) {
      const [row] = await sql`
        UPDATE notifications
        SET
          title = COALESCE(${body.title ?? null}, title),
          message = COALESCE(${body.message ?? null}, message),
          severity = COALESCE(${body.severity ?? null}, severity),
          metadata = COALESCE(${body.metadata ? JSON.stringify(body.metadata) : null}::jsonb, metadata),
          is_read = false,
          updated_at = NOW()
        WHERE id = ${body.id}
        RETURNING id
      `;
      return NextResponse.json({ id: row?.id ?? body.id });
    }

    const [row] = await sql`
      INSERT INTO notifications (type, title, message, severity, link, metadata)
      VALUES (${body.type}, ${body.title}, ${body.message ?? null}, ${body.severity ?? 'info'}, ${body.link ?? null}, ${body.metadata ? JSON.stringify(body.metadata) : null})
      RETURNING id
    `;
    console.log('[notifications] INSERTED notification id:', row?.id, 'title:', body.title);
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
