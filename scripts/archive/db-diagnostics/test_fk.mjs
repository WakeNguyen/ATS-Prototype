import sql from './src/lib/db.js'; sql.unsafe('SELECT constraint_name FROM information_schema.key_column_usage WHERE table_name = ''activity''').then(console.log).then(()=>process.exit(0));
