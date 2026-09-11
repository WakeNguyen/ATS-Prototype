/**
 * @file testRouteGuard.js
 * @description Guards internal QA/test-only API routes (qa-test, db-test, biz-test) from
 * executing outside local sandbox conditions. These routes run real INSERT/UPDATE/DELETE
 * against the database and must never be reachable when NODE_ENV is production or when
 * DB_SCHEMA does not explicitly target the sandbox schema.
 * @returns {boolean} true if safe to proceed, false if the route must refuse to run.
 */
export function isTestRouteAllowed() {
  const schema = process.env.DB_SCHEMA || 'sandbox';
  if (process.env.NODE_ENV === 'production') return false;
  if (schema !== 'sandbox') return false;
  return true;
}
