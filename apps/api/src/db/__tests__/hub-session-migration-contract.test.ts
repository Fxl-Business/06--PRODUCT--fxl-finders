import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(testDir, '../../..');
const migrationPath = resolve(apiRoot, 'drizzle/0009_durable_bff_sessions.sql');
const snapshotPath = resolve(apiRoot, 'drizzle/meta/0009_snapshot.json');
const journalPath = resolve(apiRoot, 'drizzle/meta/_journal.json');

describe('durable Hub session migration contract', () => {
  it('creates exactly one hub_sessions table with the required columns', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    const createStatements = sql.match(/CREATE TABLE "hub_sessions"/g) ?? [];

    expect(createStatements).toHaveLength(1);
    expect(sql).toMatch(/"id" text PRIMARY KEY NOT NULL/);
    expect(sql).toMatch(/"encrypted_refresh_token" text NOT NULL/);
    expect(sql).toMatch(/"account_id" text(?:,|\n)/);
    expect(sql).toMatch(/"created_at" timestamp with time zone DEFAULT now\(\) NOT NULL/);
    expect(sql).toMatch(/"updated_at" timestamp with time zone DEFAULT now\(\) NOT NULL/);
  });

  it('contains no plaintext refresh-token column, seed, default, or comment', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).not.toMatch(/hub_refresh_token/i);
    expect(sql).not.toMatch(/COMMENT ON/i);
    expect(sql).not.toMatch(/DEFAULT\s+'[^']*'/i);
    expect(sql).not.toMatch(/\brt[-_]/i);
  });

  it('registers the same table contract in the generated snapshot', () => {
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as {
      tables: Record<
        string,
        {
          columns: Record<
            string,
            { type: string; primaryKey: boolean; notNull: boolean; default?: string }
          >;
        }
      >;
    };
    const table = snapshot.tables['public.hub_sessions'];

    expect(table).toBeDefined();
    if (!table) {
      throw new Error('Generated snapshot is missing public.hub_sessions');
    }
    expect(table.columns.id).toMatchObject({ type: 'text', primaryKey: true, notNull: true });
    expect(table.columns.encrypted_refresh_token).toMatchObject({
      type: 'text',
      primaryKey: false,
      notNull: true,
    });
    expect(table.columns.account_id).toMatchObject({
      type: 'text',
      primaryKey: false,
      notNull: false,
    });
    expect(table.columns.created_at).toMatchObject({
      type: 'timestamp with time zone',
      primaryKey: false,
      notNull: true,
      default: 'now()',
    });
    expect(table.columns.updated_at).toMatchObject({
      type: 'timestamp with time zone',
      primaryKey: false,
      notNull: true,
      default: 'now()',
    });
  });

  it('registers migration index 9 with the current journal version', () => {
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
      version: string;
      entries: Array<{ idx: number; version: string; tag: string }>;
    };
    const entries = journal.entries.filter((entry) => entry.idx === 9);

    expect(entries).toEqual([
      expect.objectContaining({
        idx: 9,
        tag: '0009_durable_bff_sessions',
        version: journal.version,
      }),
    ]);
  });
});
