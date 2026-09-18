import fs from 'fs';
import path from 'path';

// Read from G Drive since it's there
const envPath = 'g:/My Drive/AI project/ATS/ats-web/.env.local';
const env = fs.readFileSync(envPath, 'utf-8');
env.split('\n').forEach(line => {
    const match = line.match(/^([^#\s][^=]+)=(.*)$/);
    if (match) {
        process.env[match[1].trim()] = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
    }
});

async function run() {
    try {
        const { default: sql } = await import('./src/lib/db.js');
        const res = await sql`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'sandbox' ORDER BY table_name;`;
        console.log("COLUMNS:", res.map(r => r.table_name + '.' + r.column_name));
        
        const fks = await sql`
        SELECT
            tc.table_name, 
            kcu.column_name, 
            ccu.table_name AS foreign_table_name,
            rc.delete_rule
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'sandbox';
        `;
        console.log("FOREIGN KEYS:", fks);
    } catch(e) { console.error(e); }
    process.exit(0);
}
run();
