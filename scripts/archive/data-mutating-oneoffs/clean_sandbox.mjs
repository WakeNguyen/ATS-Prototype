import sql from './src/lib/db.js';
async function fix() {
  const c = await sql`SELECT COUNT(*) FROM sandbox.candidates`;
  console.log('Sandbox candidates count before clean:', c[0].count);
  await sql`DELETE FROM sandbox.candidates WHERE display_number > 0`; // Or just clear the sandbox tables that were polluted
  console.log('Sandbox cleaned.');
}
fix().then(() => process.exit(0));
