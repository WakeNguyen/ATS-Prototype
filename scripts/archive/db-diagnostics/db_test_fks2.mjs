import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf-8');
env.split('\n').forEach(line => {
    const match = line.match(/^([^#\s][^=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
});
async function run() {
    const { default: sql } = await import('./src/lib/db.js');
    const res = await sql`
        SELECT constraint_name, table_schema, table_name 
        FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY';
    `;
    console.log("FOREIGN KEYS ALL SCHEMAS:", res);
    process.exit(0);
}
run();
