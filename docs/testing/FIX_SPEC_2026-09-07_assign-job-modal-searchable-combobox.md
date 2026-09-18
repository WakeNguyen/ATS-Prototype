# FIX SPEC v2 — AssignToJobModal Searchable Fields + Search Menu Default Sort

Date: 2026-09-07 (v2 — supersedes v1 in this same file; user explicitly asked
for consistency with the Search Menu's existing search mechanism instead of
a new lightweight client-side filter)

**Từ:** Claude (Architect/QA)

## Part 1 — AssignToJobModal: reuse Search Menu's exact search pattern

User feedback: the 2 fields in `AssignToJobModal`
(`src/app/candidates/page.js`, ~line 208-345) — "1. Filter by Client
Company" and "2. Select Target Position" — must search the same way as
`/search` (Search Menu), not a new custom component.

### What Search Menu already does (`src/app/search/page.js` +
`src/app/actions.js`) — verified by direct code read, reuse as-is:

- One `searchTerm` text input, debounced ~300ms via `setTimeout` in a
  `useEffect` keyed on `[searchTerm, ...]` (see `src/app/search/page.js`
  lines ~123-133).
- Calls server actions that do the actual filtering + pagination in
  PostgreSQL (never loads the full table into the browser):
  - `getClientSearchData({ searchTerm, page, pageSize })` — line ~2094 of
    `src/app/actions.js`. Matches on `cl.name`, `display_number`,
    `industry`, `location` (accent-insensitive via `unaccent()`).
  - `getJobSearchData({ searchTerm, page, pageSize })` — line ~2148.
    Matches on `job_title`, `display_number`, client name, `location`.

These two functions are an exact fit for the modal's two fields — **reuse
them directly, do not write new search functions or a new client-side
filter component.**

### What to build in `AssignToJobModal`

Replace `getJobs()` / `getClients()` (which load the full list into
`jobs`/`clients` state) and the two static `<select>` elements with:

- **Client Company field**: a text input + debounced call to
  `getClientSearchData({ searchTerm, pageSize: 20 })` (no need for full
  pagination UI inside a modal — top ~20 matches is enough), rendered as a
  dropdown list of matches (same interaction pattern as Search Menu: type,
  see filtered list below the input, click a row to select). Keep the "All
  Clients" default state when the field is empty (no filter → job list
  unrestricted by client).
- **Target Position field**: same pattern with
  `getJobSearchData({ searchTerm, pageSize: 20 })`. If a client was
  selected in the field above, also filter jobs client-side by
  `client_id === selectedClientId` after the server search returns (or, if
  you'd rather keep it simpler and fully consistent with Search Menu's own
  behavior, pass the selected client name into the job search term — your
  call, keep whichever is less code).
- Keep existing `required` validation and `handleAssign` submit logic
  unchanged — `selectedJobId` still needs to end up holding the job's
  `id`/`job_id` exactly as before.

## Part 2 — Search Menu default sort: newest → oldest

User request: the Search Menu list (all 3 tabs — Candidate, Client, Job
Order Database) should default to **newest-first**, not oldest-first. Verified
by direct code read: all 3 search functions in `src/app/actions.js`
currently sort ascending by `display_number` (which correlates with
creation order, oldest record = lowest number) — this is backwards from
every other list in the app (`getJobs`, `getClients`, `getCampaigns` all
already sort `created_time DESC`).

Change exactly these 3 `ORDER BY` clauses:

1. `getCandidateSearchData()` (~line 2080):
   `ORDER BY c.display_number ASC NULLS LAST`
   → `ORDER BY c.display_number DESC NULLS LAST`

2. `getClientSearchData()` (~line 2134):
   `ORDER BY cl.display_number ASC NULLS LAST, cl.name ASC`
   → `ORDER BY cl.display_number DESC NULLS LAST, cl.name ASC`

3. `getJobSearchData()` (~line 2189):
   `ORDER BY j.display_number ASC NULLS LAST, j.created_time DESC`
   → `ORDER BY j.display_number DESC NULLS LAST, j.created_time DESC`

Nothing else in these 3 functions needs to change (search/filter WHERE
clauses, pagination math, and the count query all stay as-is).

## What must NOT change

- `src/app/search/page.js` itself — it already calls these 3 functions
  correctly; changing the `ORDER BY` inside them is enough, no frontend
  change needed for Part 2.
- Any other caller of `getJobs()`/`getClients()` in the codebase besides
  `AssignToJobModal` — check with
  `grep -rn "getJobs()\|getClients()" src/app` before removing/changing
  those two functions' usage, and only touch the call site inside
  `AssignToJobModal`. Do not change `getJobs()`/`getClients()` themselves.

## Reporting back (per `GEMINI.md` §10.9 — active as of today)

Write the code only. Do **not** commit or push. Tell Claude (or note in
`docs/DEVELOPMENT_LOG.md` as usual) when ready for QA — Claude reads the
diff, verifies, and handles commit + push + Vercel deployment check.
