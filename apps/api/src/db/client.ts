import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env.js';
import * as schema from './schema.js';

/**
 * Postgres clients. Lazy-initialized so the server can boot in environments
 * without DATABASE_URL (e.g., template before configuration).
 *
 * Access pattern (D-H): use getDb() / getAdminDb(). There is intentionally NO
 * `db` singleton and NO `db/index.ts` barrel.
 *   - getDb()      -> standard runtime connection.
 *                    Tenant-scoped service fns wrap work in a transaction and
 *                    call setTenantContext(tx, orgId) before any query (D-D).
 *   - getAdminDb() -> cross-tenant service connection. By default this reuses
 *                    DATABASE_URL to match the standard FXL single-role DB
 *                    pattern, with an admin session setting for forced RLS.
 *                    ADMIN_DATABASE_URL is only an optional override.
 */

let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL not configured. Set it in apps/api/.env');
  }
  if (!_db) {
    _client = postgres(env.DATABASE_URL, { max: 10 });
    _db = drizzle(_client, { schema });
  }
  return _db;
}

let _adminClient: ReturnType<typeof postgres> | null = null;
let _adminDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

const adminConnectionOptions = {
  connection: {
    'app.fxl_admin': 'true',
  },
} as const;

export function resolveAdminDatabaseUrl(dbEnv: {
  DATABASE_URL?: string;
  ADMIN_DATABASE_URL?: string;
}): string | undefined {
  return dbEnv.ADMIN_DATABASE_URL ?? dbEnv.DATABASE_URL;
}

/**
 * Admin / cross-tenant DB connection. Used ONLY by admin domain routes that
 * legitimately span orgs. It normally reuses DATABASE_URL; a separate
 * ADMIN_DATABASE_URL can still be supplied for local experiments or future
 * infrastructure, but it is no longer required. The admin session setting is
 * what makes forced RLS policies admit cross-tenant service paths.
 */
export function getAdminDb() {
  const url = resolveAdminDatabaseUrl(env);
  if (!url) {
    throw new Error('DATABASE_URL not configured. Set it in apps/api/.env');
  }
  if (!_adminDb) {
    _adminClient = postgres(url, { max: 5, ...adminConnectionOptions });
    _adminDb = drizzle(_adminClient, { schema });
  }
  return _adminDb;
}

export async function closeDb() {
  if (_client) {
    await _client.end();
    _client = null;
    _db = null;
  }
  if (_adminClient) {
    await _adminClient.end();
    _adminClient = null;
    _adminDb = null;
  }
}
