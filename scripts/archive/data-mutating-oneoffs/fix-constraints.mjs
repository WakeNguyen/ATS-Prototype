import fs from 'fs';
const envPath = 'g:/My Drive/AI project/ATS/ats-web/.env.local';
const env = fs.readFileSync(envPath, 'utf-8');
env.split('\n').forEach(line => {
    const match = line.match(/^([^#\s][^=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
});

async function run() {
    const { default: sql } = await import('./src/lib/db.js');
    console.log("Adding Foreign Key constraints...");
    
    try {
        await sql.begin(async sql => {
            // Drop existing ones if they magically exist with wrong rules
            const tables = ['contact_points', 'activity', 'activity_log', 'jobs'];
            for(const table of tables) {
                const constraints = await sql`SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema = 'sandbox' AND table_name = ${table} AND constraint_type = 'FOREIGN KEY'`;
                for(const c of constraints) {
                    await sql.unsafe(`ALTER TABLE sandbox.${table} DROP CONSTRAINT ${c.constraint_name}`);
                }
            }

            // Candidates dependencies
            await sql`ALTER TABLE sandbox.contact_points ADD CONSTRAINT fk_cp_candidate FOREIGN KEY (candidate_id) REFERENCES sandbox.candidates(id) ON DELETE CASCADE`;
            await sql`ALTER TABLE sandbox.activity ADD CONSTRAINT fk_act_candidate FOREIGN KEY (candidate_id) REFERENCES sandbox.candidates(id) ON DELETE CASCADE`;
            
            // Jobs dependencies
            await sql`ALTER TABLE sandbox.activity ADD CONSTRAINT fk_act_job FOREIGN KEY (job_id) REFERENCES sandbox.jobs(id) ON DELETE CASCADE`;
            
            // Clients dependencies
            await sql`ALTER TABLE sandbox.jobs ADD CONSTRAINT fk_job_client FOREIGN KEY (client_id) REFERENCES sandbox.clients(id) ON DELETE SET NULL`;
            
            // Activity dependencies
            await sql`ALTER TABLE sandbox.activity_log ADD CONSTRAINT fk_log_act FOREIGN KEY (application_id) REFERENCES sandbox.activity(id) ON DELETE CASCADE`;
            await sql`ALTER TABLE sandbox.activity ADD CONSTRAINT fk_act_parent FOREIGN KEY (parent_item_id) REFERENCES sandbox.activity(id) ON DELETE SET NULL`;
            
            console.log("Constraints added successfully!");
        });
    } catch(e) {
        console.error("Error migrating:", e.message);
    }
    process.exit(0);
}
run();
