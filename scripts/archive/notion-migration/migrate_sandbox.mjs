import postgres from 'postgres';
const sql = postgres('process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/postgres'', {ssl: 'require'});

async function runMigrations() {
  console.log('--- MIGRATING SANDBOX ---');
  try {
    await sql.begin(async (sqlTx) => {
      await sqlTx`
        CREATE TABLE IF NOT EXISTS sandbox.pending_cv_imports (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            payload jsonb NOT NULL,
            match_status text NOT NULL,
            matched_candidate_id uuid,
            matched_details jsonb,
            status text DEFAULT 'Pending',
            created_at timestamptz DEFAULT NOW(),
            resolved_at timestamptz
        );
      `;
      console.log('Created table sandbox.pending_cv_imports');

      await sqlTx`
        ALTER TABLE sandbox.candidates 
        ADD COLUMN IF NOT EXISTS cv_urls jsonb DEFAULT '[]'::jsonb;
      `;
      console.log('Added cv_urls to sandbox.candidates');
    });
    console.log('--- DONE ---');
  } catch(e) {
    console.error(e);
  }
}
runMigrations().then(() => process.exit(0));
