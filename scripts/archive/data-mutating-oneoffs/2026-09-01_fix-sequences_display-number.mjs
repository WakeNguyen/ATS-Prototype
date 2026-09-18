import sql from './src/lib/db.js';

async function run() {
  try {
    const schemas = ['sandbox', 'public'];
    const tables = ['candidates', 'activity', 'jobs', 'clients'];

    for (const schema of schemas) {
      for (const table of tables) {
        console.log(`Processing ${schema}.${table}...`);
        
        // 1. Create sequence
        await sql.unsafe(`CREATE SEQUENCE IF NOT EXISTS ${schema}.${table}_display_number_seq;`);
        
        // 2. Set value
        await sql.unsafe(`
          SELECT setval(
            '${schema}.${table}_display_number_seq',
            COALESCE((SELECT MAX(display_number) FROM ${schema}.${table}), 0) + 1,
            false
          );
        `);
        
        // 3. Alter table default
        await sql.unsafe(`
          ALTER TABLE ${schema}.${table}
          ALTER COLUMN display_number SET DEFAULT nextval('${schema}.${table}_display_number_seq');
        `);
      }
    }
    console.log('Sequence setup completed.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

run();
