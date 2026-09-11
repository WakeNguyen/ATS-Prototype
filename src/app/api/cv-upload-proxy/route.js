import { NextResponse } from 'next/server';
import { auth } from '../../../../auth.js';

const MAX_FILES = 10; // Soft limit: Loop Ingest Files processes sequentially

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const incomingForm = await request.formData();
    const files = incomingForm.getAll('files');

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} files per batch` }, { status: 400 });
    }

    const forwardForm = new FormData();
    for (const file of files) {
      forwardForm.append('CV File', file, file.name);
    }

    const n8nUrl = process.env.N8N_CV_UPLOAD_WEBHOOK_URL || 'https://your-n8n-instance.com/webhook/cv-upload';
    const resp = await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'x-internal-secret': process.env.INTERNAL_WEBHOOK_SECRET || '' },
      body: forwardForm
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return NextResponse.json({ error: `n8n webhook failed: ${errText || resp.status}` }, { status: 502 });
    }

    return NextResponse.json({ success: true, fileCount: files.length });
  } catch (error) {
    console.error('[cv-upload-proxy] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
