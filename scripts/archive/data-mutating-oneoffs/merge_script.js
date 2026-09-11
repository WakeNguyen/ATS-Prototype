const postgres = require('postgres');
const sql = postgres('postgresql://YOUR_USER:YOUR_PASSWORD@ep-your-host.neon.tech/neondb?sslmode=require');

async function main() {
  console.log('Connecting to Neon...');
  const groups = await sql`
    SELECT candidate_id, job_id, COUNT(*) as cnt
    FROM applications
    WHERE candidate_id IS NOT NULL AND job_id IS NOT NULL
    GROUP BY candidate_id, job_id
    HAVING COUNT(*) > 1;
  `;
  console.log(`Found ${groups.length} groups with duplicate applications.`);

  let mergedCount = 0;
  let deletedCount = 0;
  let newLogsCount = 0;

  for (const g of groups) {
    const apps = await sql`
      SELECT id, current_stage, status, note, source_channel, result, created_time, parent_item_id, parent_item_notion_id, notion_id, is_passive
      FROM applications
      WHERE candidate_id = ${g.candidate_id} AND job_id = ${g.job_id}
      ORDER BY created_time ASC, display_number ASC;
    `;

    const parents = apps.filter(a => !a.parent_item_id && !a.parent_item_notion_id);
    const master = parents.length > 0 ? parents[0] : apps[0];
    const children = apps.filter(a => a.id !== master.id);
    const masterId = master.id;

    // 1. Insert Master's initial stage if not present
    const existingMasterLog = await sql`
      SELECT id FROM activity_log 
      WHERE application_id = ${masterId} AND action_type = ${master.current_stage || 'Application'};
    `;
    if (existingMasterLog.length === 0) {
      await sql`
        INSERT INTO activity_log (
          id, application_id, action_type, channel, note, result, action_date, created_time
        ) VALUES (
          gen_random_uuid(), ${masterId}, ${master.current_stage || 'Application'}, ${master.source_channel || 'System'}, ${master.note || 'Initial Application'}, ${master.result || 'Pass'}, ${master.created_time || new Date()}, NOW()
        );
      `;
      newLogsCount++;
    }

    // 2. Process children
    let latestStage = master.current_stage;
    let latestTime = master.created_time;

    for (const ch of children) {
      if (ch.created_time && (!latestTime || new Date(ch.created_time) > new Date(latestTime))) {
        latestTime = ch.created_time;
        if (ch.current_stage) latestStage = ch.current_stage;
      }

      // Check log
      const existingChildLog = await sql`
        SELECT id FROM activity_log 
        WHERE application_id = ${masterId} AND action_type = ${ch.current_stage || 'Step'} AND action_date = ${ch.created_time};
      `;
      if (existingChildLog.length === 0) {
        await sql`
          INSERT INTO activity_log (
            id, application_id, action_type, channel, note, result, action_date, created_time
          ) VALUES (
            gen_random_uuid(), ${masterId}, ${ch.current_stage || 'Step'}, ${ch.source_channel || 'System'}, ${ch.note || ''}, ${ch.result || 'Pass'}, ${ch.created_time || new Date()}, NOW()
          );
        `;
        newLogsCount++;
      }

      // Re-point child logs to master
      await sql`UPDATE activity_log SET application_id = ${masterId} WHERE application_id = ${ch.id};`;

      // Delete child application
      await sql`DELETE FROM applications WHERE id = ${ch.id};`;
      deletedCount++;
    }

    // 3. Update master current_stage
    await sql`
      UPDATE applications 
      SET current_stage = ${latestStage}
      WHERE id = ${masterId};
    `;

    mergedCount++;
  }

  console.log(`Merged ${mergedCount} groups, created ${newLogsCount} logs, deleted ${deletedCount} child records.`);

  const [finalApps] = await sql`SELECT count(*)::int FROM applications;`;
  const [finalLogs] = await sql`SELECT count(*)::int FROM activity_log;`;
  console.log(`Final applications: ${finalApps.count}, final activity_log: ${finalLogs.count}`);

  await sql.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});