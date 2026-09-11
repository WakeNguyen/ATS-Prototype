import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf-8');
env.split('\n').forEach(line => {
    const match = line.match(/^([^#\s][^=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
});
async function run() {
    const { default: sql } = await import('./src/lib/db.js');
    const res = await sql`
        SELECT
            tc.table_schema, 
            tc.constraint_name, 
            tc.table_name, 
            kcu.column_name, 
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name,
            rc.update_rule,
            rc.delete_rule
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            JOIN information_schema.referential_constraints rc
              ON tc.constraint_name = rc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'sandbox';
    `;
    console.log("FOREIGN KEYS:", res);

    const all_const = await sql`SELECT constraint_name, constraint_type, table_name FROM information_schema.table_constraints WHERE table_schema = 'sandbox';`;
    console.log("ALL CONSTRAINTS:", all_const);
    process.exit(0);
}
run();
