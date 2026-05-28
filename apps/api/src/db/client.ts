import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env.js';
import * as schema from './schema.js';

/**
 * Postgres client. Lazy-initialized so the server can boot in environments
 * without DATABASE_URL (e.g., template before configuration).
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

export async function closeDb() {
  if (_client) {
    await _client.end();
    _client = null;
    _db = null;
  }
}
