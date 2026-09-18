import sql from '../../src/lib/db.js';

async function test() {
  const [res] = await sql`
    SELECT 
      (SELECT COUNT(*)::int FROM fb_accounts WHERE status = 'Active') AS total_active_accounts
  `;
  console.log('Total active accounts:', res);

  const sampleGroup = await sql`
    SELECT
      sgu.id, sgu.name,
      (
        SELECT COUNT(DISTINCT fag.fb_account_id)::int
        FROM fb_account_groups fag
        JOIN fb_accounts fa ON fa.id = fag.fb_account_id
        WHERE fag.social_group_id = sgu.id AND fa.status = 'Active'
      ) AS joined_account_count,
      (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'id', fa.id,
              'account_name', fa.account_name,
              'account_ref', fa.account_ref,
              'joined_at', fag.joined_at
            ) ORDER BY fag.joined_at DESC
          ),
          '[]'::json
        )
        FROM fb_account_groups fag
        JOIN fb_accounts fa ON fa.id = fag.fb_account_id
        WHERE fag.social_group_id = sgu.id AND fa.status = 'Active'
      ) AS joined_accounts_list
    FROM social_group_urls sgu
    LIMIT 3
  `;
  console.log('Sample group accounts query:', JSON.stringify(sampleGroup, null, 2));
  process.exit(0);
}

test().catch(e => {
  console.error(e);
  process.exit(1);
});
