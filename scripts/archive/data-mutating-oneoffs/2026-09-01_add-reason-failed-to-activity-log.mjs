import sql from '../../../src/lib/db.js';

async function run() {
  const isDryRun = !process.argv.includes('--apply');
  console.log('=== Migration: Add reason_failed column to activity_log ===');
  if (isDryRun) {
    console.log('[DRY RUN] Running in dry-run mode. Pass --apply to execute migration.');
  } else {
    console.log('[APPLY] Executing migration...');
  }

  const schemas = ['sandbox', 'public'];

  try {
    for (const schema of schemas) {
      console.log(`\nChecking schema: ${schema}`);
      
      const checkCol = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = ${schema}
          AND table_name = 'activity_log'
          AND column_name = 'reason_failed'
      `;

      if (checkCol.length > 0) {
        console.log(`Column reason_failed already exists in ${schema}.activity_log (${checkCol[0].data_type}, nullable: ${checkCol[0].is_nullable}).`);
      } else {
        console.log(`Column reason_failed does NOT exist yet in ${schema}.activity_log.`);
        if (!isDryRun) {
          await sql.unsafe(`ALTER TABLE ${schema}.activity_log ADD COLUMN IF NOT EXISTS reason_failed TEXT;`);
          console.log(`Successfully added reason_failed column to ${schema}.activity_log.`);
        }
      }
    }

    if (!isDryRun) {
      console.log('\n--- VERIFY COLUMNS IN public.activity_log ---');
      const cols = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'activity_log'
        ORDER BY ordinal_position ASC
      `;
      console.table(cols);
    }
  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    process.exit(0);
  }
}

run();
