import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

// Read .env.local
const envPath = path.join(process.cwd(), '.env.local');
let databaseUrl = process.env.DATABASE_URL;

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=')) {
      databaseUrl = trimmed.substring('DATABASE_URL='.length).trim();
      if ((databaseUrl.startsWith('"') && databaseUrl.endsWith('"')) || (databaseUrl.startsWith("'") && databaseUrl.endsWith("'"))) {
        databaseUrl = databaseUrl.slice(1, -1);
      }
    }
  }
}

if (!databaseUrl) {
  console.error('DATABASE_URL not found!');
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  ssl: 'require',
  max: 1,
  prepare: false
});

async function run() {
  console.log('--- Applying Urgent Security RLS Fix ---');
  const rlsStatements = [
    `ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE IF EXISTS public.pending_cv_imports ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE IF EXISTS public.cv_import_batches ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE IF EXISTS public.cv_import_batch_items ENABLE ROW LEVEL SECURITY;`,
    `REVOKE ALL ON public.notifications, public.pending_cv_imports, public.cv_import_batches, public.cv_import_batch_items FROM anon, authenticated;`,

    `ALTER TABLE IF EXISTS sandbox.notifications ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE IF EXISTS sandbox.pending_cv_imports ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE IF EXISTS sandbox.cv_import_batches ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE IF EXISTS sandbox.cv_import_batch_items ENABLE ROW LEVEL SECURITY;`,
    `REVOKE ALL ON sandbox.notifications, sandbox.pending_cv_imports, sandbox.cv_import_batches, sandbox.cv_import_batch_items FROM anon, authenticated;`
  ];

  for (const stmt of rlsStatements) {
    await sql.unsafe(stmt);
  }
  console.log('✅ RLS and REVOKE applied on notifications, pending_cv_imports, cv_import_batches, cv_import_batch_items.');

  console.log('--- Applying Phase 6 Migrations ---');

  // 1. Column account_ids on warm_join_runs
  await sql.unsafe(`ALTER TABLE public.warm_join_runs ADD COLUMN IF NOT EXISTS account_ids uuid[] DEFAULT NULL;`);
  await sql.unsafe(`ALTER TABLE sandbox.warm_join_runs ADD COLUMN IF NOT EXISTS account_ids uuid[] DEFAULT NULL;`);
  console.log('✅ Column account_ids added to warm_join_runs on public & sandbox.');

  // 2. Table group_membership_sync_schedule
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS public.group_membership_sync_schedule (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      for_date date NOT NULL,
      slot_index int NOT NULL CHECK (slot_index IN (1, 2)),
      scheduled_for timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'Pending'
        CHECK (status = ANY (ARRAY['Pending','Fired','Cancelled'])),
      fired_at timestamptz,
      created_time timestamptz NOT NULL DEFAULT now(),
      UNIQUE (for_date, slot_index)
    );
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS sandbox.group_membership_sync_schedule (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      for_date date NOT NULL,
      slot_index int NOT NULL CHECK (slot_index IN (1, 2)),
      scheduled_for timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'Pending'
        CHECK (status = ANY (ARRAY['Pending','Fired','Cancelled'])),
      fired_at timestamptz,
      created_time timestamptz NOT NULL DEFAULT now(),
      UNIQUE (for_date, slot_index)
    );
  `);
  console.log('✅ Created table group_membership_sync_schedule on public & sandbox.');

  // 3. Table group_membership_sync_runs
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS public.group_membership_sync_runs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      schedule_id uuid REFERENCES public.group_membership_sync_schedule(id),
      status text NOT NULL DEFAULT 'Running'
        CHECK (status = ANY (ARRAY['Running','Completed','Failed','PartialSuccess'])),
      trigger_source text NOT NULL DEFAULT 'cron_jitter',
      account_ids uuid[] DEFAULT NULL,
      started_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz,
      stats jsonb,
      summary text,
      error_message text,
      n8n_execution_id text,
      created_time timestamptz NOT NULL DEFAULT now()
    );
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS sandbox.group_membership_sync_runs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      schedule_id uuid REFERENCES sandbox.group_membership_sync_schedule(id),
      status text NOT NULL DEFAULT 'Running'
        CHECK (status = ANY (ARRAY['Running','Completed','Failed','PartialSuccess'])),
      trigger_source text NOT NULL DEFAULT 'cron_jitter',
      account_ids uuid[] DEFAULT NULL,
      started_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz,
      stats jsonb,
      summary text,
      error_message text,
      n8n_execution_id text,
      created_time timestamptz NOT NULL DEFAULT now()
    );
  `);
  console.log('✅ Created table group_membership_sync_runs on public & sandbox.');

  // 4. RLS on new tables
  const syncRlsStatements = [
    `ALTER TABLE public.group_membership_sync_schedule ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE public.group_membership_sync_runs ENABLE ROW LEVEL SECURITY;`,
    `REVOKE ALL ON public.group_membership_sync_schedule, public.group_membership_sync_runs FROM anon, authenticated;`,

    `ALTER TABLE sandbox.group_membership_sync_schedule ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE sandbox.group_membership_sync_runs ENABLE ROW LEVEL SECURITY;`,
    `REVOKE ALL ON sandbox.group_membership_sync_schedule, sandbox.group_membership_sync_runs FROM anon, authenticated;`
  ];

  for (const stmt of syncRlsStatements) {
    await sql.unsafe(stmt);
  }
  console.log('✅ RLS and REVOKE applied on sync tables.');

  await sql.end();
  console.log('All migrations completed successfully.');
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
