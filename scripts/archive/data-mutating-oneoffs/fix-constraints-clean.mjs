import fs from 'fs';
const envPath = 'g:/My Drive/AI project/ATS/ats-web/.env.local';
const env = fs.readFileSync(envPath, 'utf-8');
env.split('\n').forEach(line => {
    const match = line.match(/^([^#\s][^=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
});

async function run() {
    const { default: sql } = await import('./src/lib/db.js');
    console.log("Cleaning orphans and Adding Foreign Key constraints...");
    
    try {
        await sql.begin(async sql => {
            // Clean orphans
            console.log("Cleaning orphans...");
            await sql`DELETE FROM sandbox.contact_points WHERE candidate_id NOT IN (SELECT id FROM sandbox.candidates)`;
            await sql`DELETE FROM sandbox.activity WHERE candidate_id NOT IN (SELECT id FROM sandbox.candidates)`;
            await sql`DELETE FROM sandbox.activity WHERE job_id IS NOT NULL AND job_id NOT IN (SELECT id FROM sandbox.jobs)`;
            await sql`UPDATE sandbox.jobs SET client_id = NULL WHERE client_id NOT IN (SELECT id FROM sandbox.clients)`;
            await sql`DELETE FROM sandbox.activity_log WHERE application_id NOT IN (SELECT id FROM sandbox.activity)`;
            await sql`UPDATE sandbox.activity SET parent_item_id = NULL WHERE parent_item_id IS NOT NULL AND parent_item_id NOT IN (SELECT id FROM sandbox.activity)`;

            // Candidates dependencies
            console.log("Adding candidate FKs...");
            await sql`ALTER TABLE sandbox.contact_points ADD CONSTRAINT fk_cp_candidate FOREIGN KEY (candidate_id) REFERENCES sandbox.candidates(id) ON DELETE CASCADE`;
            await sql`ALTER TABLE sandbox.activity ADD CONSTRAINT fk_act_candidate FOREIGN KEY (candidate_id) REFERENCES sandbox.candidates(id) ON DELETE CASCADE`;
            
            // Jobs dependencies
            console.log("Adding job FKs...");
            await sql`ALTER TABLE sandbox.activity ADD CONSTRAINT fk_act_job FOREIGN KEY (job_id) REFERENCES sandbox.jobs(id) ON DELETE CASCADE`;
            
            // Clients dependencies
            console.log("Adding client FKs...");
            await sql`ALTER TABLE sandbox.jobs ADD CONSTRAINT fk_job_client FOREIGN KEY (client_id) REFERENCES sandbox.clients(id) ON DELETE SET NULL`;
            
            // Activity dependencies
            console.log("Adding activity FKs...");
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
