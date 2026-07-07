import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveAdminDatabaseUrl } from '../client.js';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const drizzleDir = path.join(apiRoot, 'drizzle');

function migrationSql(): string {
  return fs
    .readdirSync(drizzleDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => fs.readFileSync(path.join(drizzleDir, name), 'utf8'))
    .join('\n');
}

describe('single database role contract', () => {
  it('keeps migrations compatible with the standard FXL database owner role', () => {
    const sql = migrationSql();

    expect(sql).not.toMatch(/\bCREATE\s+ROLE\b/i);
    expect(sql).not.toMatch(/\bALTER\s+ROLE\b/i);
    expect(sql).not.toMatch(/\bBYPASSRLS\b/i);
    expect(sql).not.toMatch(/\bGRANT\b[\s\S]*\bTO\s+fxl_sales_(?:owner|app|admin)\b/i);
    expect(sql).not.toMatch(/\bTO\s+fxl_sales_(?:owner|app|admin)\b/i);
    expect(sql).toMatch(/\bFORCE\s+ROW\s+LEVEL\s+SECURITY\b/i);
    expect(sql).toMatch(/app\.fxl_admin/i);
  });

  it('uses DATABASE_URL for admin DB access when no separate admin URL is configured', () => {
    expect(
      resolveAdminDatabaseUrl({
        DATABASE_URL: 'postgresql://project_user:secret@localhost:5432/project_db',
      }),
    ).toBe('postgresql://project_user:secret@localhost:5432/project_db');
  });
});
