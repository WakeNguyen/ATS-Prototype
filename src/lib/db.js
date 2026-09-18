import postgres from 'postgres';

const rawConnectionString = process.env.DATABASE_URL || '';
const targetSchema = process.env.DB_SCHEMA || 'sandbox'; // Default to isolated 'sandbox' schema (set DB_SCHEMA=public for prod)

// Ensure search_path is set in connection string options
let connectionString = rawConnectionString;
if (connectionString && !connectionString.includes('search_path')) {
  const separator = connectionString.includes('?') ? '&' : '?';
  connectionString = `${connectionString}${separator}options=-c%20search_path%3D${targetSchema},public,extensions`;
}

const globalRef = global;
if (!globalRef.postgresSqlClient) {
  globalRef.postgresSqlClient = postgres(connectionString, {
    ssl: 'require',
    max: 10,
    idle_timeout: 20,
    connect_timeout: 30,
    prepare: false, // Critical for Supabase transaction mode pooler (port 6543)
    connection: {
      search_path: `${targetSchema},public,extensions`
    }
  });
}

const sql = globalRef.postgresSqlClient;
export default sql;

function buildConnectionString(schema) {
  let cs = rawConnectionString;
  if (cs && !cs.includes('search_path')) {
    const separator = cs.includes('?') ? '&' : '?';
    cs = `${cs}${separator}options=-c%20search_path%3D${schema},public,extensions`;
  }
  return cs;
}

if (!globalRef.postgresSqlClientSandbox) {
  globalRef.postgresSqlClientSandbox = postgres(buildConnectionString('sandbox'), {
    ssl: 'require',
    max: 3,
    idle_timeout: 20,
    connect_timeout: 30,
    prepare: false,
    connection: {
      search_path: 'sandbox,public,extensions'
    }
  });
}

export const sqlSandbox = globalRef.postgresSqlClientSandbox;
