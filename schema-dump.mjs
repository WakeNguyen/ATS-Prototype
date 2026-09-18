import sql from './src/lib/db.js';

async function run() {
  try {
    console.log('=== TABLES trong schema sandbox ===');
    const sandboxTables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'sandbox' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    console.log(sandboxTables.map(t => t.table_name));

    console.log('\n=== TABLES trong schema public ===');
    const publicTables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    console.log(publicTables.map(t => t.table_name));

    console.log('\n=== CỘT theo từng bảng (schema sandbox) ===');
    const cols = await sql`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'sandbox'
      ORDER BY table_name, ordinal_position;
    `;
    let currentTable = '';
    for (const c of cols) {
      if (c.table_name !== currentTable) {
        currentTable = c.table_name;
        console.log(`\n-- ${currentTable} --`);
      }
      console.log(`  ${c.column_name} : ${c.data_type} (nullable=${c.is_nullable}, default=${c.column_default ?? '-'})`);
    }

    console.log('\n=== FOREIGN KEYS (schema sandbox) ===');
    const fks = await sql`
      SELECT
        tc.table_name, kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'sandbox';
    `;
    console.log(fks);
  } catch (e) {
    console.error('ERROR:', e);
  } finally {
    process.exit(0);
  }
}
run();
