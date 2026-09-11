# FIX SPEC — Campaign ↔ Multiple Jobs Linking

Date: 2026-09-07
Author: Claude (Architect/QA)
Priority: Medium (architecture gap, not breaking production)

## 1. Problem (verified by direct code + DB read, not by report)

`campaigns.job_id` is a single scalar `uuid` column (1 campaign → 0 or 1 job).
Real business need: one Facebook posting campaign often needs to represent
**multiple** job openings at once (e.g. "Client X đang tuyển 3 vị trí: A, B, C"
in one post/campaign).

Confirmed by reading `src/app/campaign_actions.js`: `job_id` is used ONLY for
display/search (`LEFT JOIN jobs j ON c.job_id = j.id` in `getCampaigns()` line
~93 and `getCampaignDetail()` line ~148, plus the search filter on
`j.job_title` at line ~122). It is **NOT** read anywhere in
`computeCampaignDispatchPreview()`, `triggerCampaignRun()`, or
`_getEligibilityState()` — i.e. it has zero effect on posting logic, targeting,
or the n8n/VPS dispatch payload.

**Confirmed scope with user**: campaign `content` (the FB post text) stays a
single shared field — we are NOT splitting content per job. This is purely
about letting a campaign be *tagged/linked* to more than one job for
tracking/reporting. This makes the change low-risk: dispatch, n8n workflows,
and the VPS bridge/Playwright scripts need ZERO changes.

## 2. Design

Replace the scalar `campaigns.job_id` with a many-to-many join table,
following the exact same pattern already used for `campaign_social_groups`
(delete-then-reinsert inside the same `sql.begin()` transaction as the
campaign update — see `updateCampaign()` handling of `targetGroupIds`).

### 2.1 Database migration (apply via Supabase migration, both schemas if
`sandbox` still exists — check first, project is on `public` only per today's
cutover)

```sql
CREATE TABLE IF NOT EXISTS campaign_jobs (
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_time timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, job_id)
);

-- Backfill existing single links
INSERT INTO campaign_jobs (campaign_id, job_id)
SELECT id, job_id FROM campaigns WHERE job_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

Do **NOT** drop `campaigns.job_id` yet — leave it in place, unused, as a safe
rollback path. We can drop it in a later cleanup pass once this has run
cleanly in production for a while.

### 2.2 Backend — `src/app/campaign_actions.js`

**a) `getCampaigns()` (~line 55-127)**: replace the scalar
`LEFT JOIN jobs j ON c.job_id = j.id` / `cl.name as client_name` with an
aggregate subquery so each campaign returns an array of linked jobs:

```sql
LEFT JOIN LATERAL (
  SELECT
    COALESCE(array_agg(j2.job_title ORDER BY j2.job_title), '{}') AS job_titles,
    COALESCE(array_agg(j2.id ORDER BY j2.job_title), '{}') AS job_ids,
    COALESCE(array_agg(DISTINCT cl2.name) FILTER (WHERE cl2.name IS NOT NULL), '{}') AS client_names
  FROM campaign_jobs cj
  JOIN jobs j2 ON cj.job_id = j2.id
  LEFT JOIN clients cl2 ON j2.client_id = cl2.id
  WHERE cj.campaign_id = c.id
) jobs_agg ON true
```

Remove `c.job_id` and `j.job_title` from the SELECT list (or keep `c.job_id`
for now, harmless), add `jobs_agg.job_titles, jobs_agg.job_ids,
jobs_agg.client_names` to the SELECT list.

Update the search filter (~line 122) — it currently does
`j.job_title ILIKE ${term}` — change to check membership across the linked
jobs, e.g. wrap in `EXISTS (SELECT 1 FROM campaign_jobs cj JOIN jobs j3 ON
cj.job_id = j3.id WHERE cj.campaign_id = c.id AND j3.job_title ILIKE ${term})`.

**b) `getCampaignDetail()` (~line 133-150)**: same idea — after fetching
`campaign`, run a second query:
```js
const linkedJobs = await sql`
  SELECT j.id, j.job_title, cl.name as client_name
  FROM campaign_jobs cj
  JOIN jobs j ON cj.job_id = j.id
  LEFT JOIN clients cl ON j.client_id = cl.id
  WHERE cj.campaign_id = ${id}
  ORDER BY j.job_title
`;
```
and attach `campaign.linkedJobs = linkedJobs` before returning.

**c) `createCampaign()` (~line 311-370)**: accept `job_ids = []` (array)
instead of (in addition to, for backward compat) `job_id`. After the
`INSERT INTO campaigns` and inside the same `sqlTx` transaction block (same
place `targetGroupIds` is handled), add:
```js
if (job_ids && job_ids.length > 0) {
  for (const jid of job_ids) {
    await sqlTx`INSERT INTO campaign_jobs (campaign_id, job_id) VALUES (${inserted.id}, ${jid})`;
  }
}
```

**d) `updateCampaign()` (~line 396-460)**: accept `job_ids` (array or
`undefined` = "don't touch"). Remove the `job_id = CASE WHEN...` line from the
`UPDATE campaigns SET ...` (or leave it harmless if `job_ids` provided
implies `job_id` is not sent from the frontend anymore). Mirror the
`targetGroupIds` sync pattern exactly:
```js
if (job_ids !== undefined) {
  await sqlTx`DELETE FROM campaign_jobs WHERE campaign_id = ${id}`;
  if (job_ids.length > 0) {
    for (const jid of job_ids) {
      await sqlTx`INSERT INTO campaign_jobs (campaign_id, job_id) VALUES (${id}, ${jid})`;
    }
  }
}
```

### 2.3 Frontend — `src/app/components/CampaignEditModal.js`

Replace the single `<select>` "Linked Job" (~line 466-481, currently
`-- No Linked Job --` + one job per `<option>`) with a multi-select: a
button that opens a small checklist/dropdown of jobs (checkbox per job,
search input if the job list is long), similar in spirit to the group
picker but simpler — jobs list is typically much smaller than groups, so a
plain searchable checklist popover is enough, no need for the full paginated
table built for FB groups.

State: replace `jobId` (string) with `selectedJobIds` (a `Set`). On load
(~line 138), populate from `c.linkedJobs.map(j => j.id)` instead of
`c.job_id`. On submit (~line 234), send `job_ids: isJobPosting ?
Array.from(selectedJobIds) : []` instead of `job_id`.

Show selected jobs as removable chips/tags above or below the picker so the
user can see at a glance which jobs are linked.

### 2.4 Frontend — `src/app/campaigns/page.js` list table

The "Linked Job" column (~line 1137, 1203-1209) currently renders one
clickable job-title link. Change to render one small chip/badge per linked
job (from `c.job_titles` / need matching `c.job_ids` array to build each
link `/jobs?job_id=...`), wrapping if there are several. If a campaign has
0 linked jobs, keep showing "—" or similar as it does today.

## 3. What must NOT change

- `computeCampaignDispatchPreview()`, `triggerCampaignRun()`,
  `_getEligibilityState()` — zero changes, job linkage does not touch
  dispatch/posting logic.
- n8n workflows (A, D, C), VPS bridge/Playwright scripts — zero changes.
- `campaigns.content`, `post_image_url` — stay single shared fields per
  campaign, unchanged.

## 4. QA checklist for AG (given today's repeated pattern of reporting "done"
when only docs were written, or writing code but never committing/pushing —
this checklist is mandatory, not optional)

1. `grep -n "job_id" src/app/campaign_actions.js` after your changes — every
   remaining reference must be intentional (e.g. leftover unused column is
   fine, but the app must not silently still rely on it for anything you
   were supposed to migrate).
2. Create a campaign linked to 2+ jobs, save, reload the Campaigns list page,
   confirm both job chips show up.
3. Edit that campaign, unlink one job, save, reload, confirm only the
   remaining one shows.
4. Confirm search-by-job-title in the Campaigns list still finds a campaign
   through ANY of its linked jobs, not just the first one.
5. Run `git status --short` and `git log --oneline -3` and paste the actual
   output in your report — do not report "done" without this.
6. Push to `origin/master`, wait for Vercel to reach `READY` on `production`,
   and paste the deployment commit SHA in your report.
