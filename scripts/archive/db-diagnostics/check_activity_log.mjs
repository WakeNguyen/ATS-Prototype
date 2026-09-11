import sql from './src/lib/db.js';

async function checkActivityLogSchema() {
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'activity_log';
  `;
  console.log('activity_log columns:');
  console.log(cols);
}
checkActivityLogSchema().then(() => process.exit(0));
