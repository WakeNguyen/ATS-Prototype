import sql from '../../../src/lib/db.js';

async function run() {
  const isDryRun = !process.argv.includes('--apply');
  console.log('=== Normalizing Legacy Result/Reason ===');
  if (isDryRun) {
    console.log('[DRY RUN] Running in dry-run mode. Pass --apply to actually mutate data.');
  } else {
    console.log('[APPLY] Mutating data...');
  }

  try {
    const failedStages = [
      'Rejected', 'Failed Interview', 'Failed Screen', 'Failed Test',
      'Reject Offer', 'Withdraw Interview Process',
      'Rejected By Hiring Manager', 'Recjected By Hiring Manager',
      'Failed Interview (2nd)', 'Failed Interview (3rd)'
    ];

    const schemas = ['sandbox', 'public'];

    for (const schema of schemas) {
      console.log(`\nProcessing schema: ${schema}`);
      
      const countQuery = await sql`
        SELECT COUNT(*) as cnt
        FROM ${sql(schema + '.activity')}
        WHERE result IS NULL
          AND current_stage = ANY(${failedStages}::text[])
      `;
      const count = countQuery[0].cnt;
      
      console.log(`Found ${count} records with legacy failed stages and no result in ${schema}.`);

      if (!isDryRun && count > 0) {
        await sql`
          UPDATE ${sql(schema + '.activity')}
          SET result = 'Failed',
              reason_failed = COALESCE(reason_failed, 'Withdrawn - N/A'),
              last_updated = NOW()
          WHERE result IS NULL
            AND current_stage = ANY(${failedStages}::text[])
        `;
        console.log(`Successfully updated ${count} records in ${schema}.`);
      }
    }

  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

run();
