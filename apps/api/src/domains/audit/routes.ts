import { Hono } from 'hono';
import { asc, desc, sql } from 'drizzle-orm';
import { getAdminDb } from '../../db/client.js';
import { auditLog } from '../../db/schema.js';
import { verifyChain, type AuditChainRow } from './service.js';

/**
 * Audit log read routes (Phase 05 T12). Reads via getAdminDb() with admin
 * session context. audit_log is cross-tenant append-only (D-C).
 * Gated by requireAdmin in server.ts.
 *
 * GET /            -> paginated page + page_chain_valid (per-page check only, D-R NIT)
 * GET /verify-chain -> authoritative full-ledger verifyChain over hash-bearing rows
 */
export const auditRouter = new Hono();

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

/** Maps a Drizzle audit_log row to the chain-verification shape used by verifyChain. */
function toChainRow(row: typeof auditLog.$inferSelect): AuditChainRow {
  return {
    actorUserId: row.actorUserId,
    actorOrgId: row.actorOrgId ?? null,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    beforeJsonb: row.beforeJsonb ?? null,
    afterJsonb: row.afterJsonb ?? null,
    requestId: row.requestId ?? null,
    prevHash: row.prevHash,
    entryHash: row.entryHash,
  };
}

auditRouter.get('/', async (c) => {
  const page = Math.max(1, Number(c.req.query('page') ?? 1) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(c.req.query('limit') ?? DEFAULT_LIMIT) || DEFAULT_LIMIT));
  const action = c.req.query('action');
  const adminDb = getAdminDb();

  const baseQuery = adminDb.select().from(auditLog);
  const rows = action
    ? await baseQuery
        .where(sql`${auditLog.action} = ${action}`)
        .orderBy(desc(auditLog.id))
        .limit(limit)
        .offset((page - 1) * limit)
    : await baseQuery.orderBy(desc(auditLog.id)).limit(limit).offset((page - 1) * limit);

  const countRows = (await adminDb
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLog)) as Array<{ count: number }>;
  const total = countRows[0]?.count ?? 0;

  // Per-page chain check (D-R NIT): verifyChain expects ascending order and only
  // covers the visible page - hence `page_chain_valid`, NOT `chain_valid`.
  const ascending = [...rows].reverse().filter((r) => r.entryHash.length === 64);
  const pageCheck = verifyChain(ascending.map(toChainRow));

  return c.json({
    entries: rows,
    total,
    page,
    page_chain_valid: pageCheck.valid,
  });
});

auditRouter.get('/verify-chain', async (c) => {
  const adminDb = getAdminDb();
  // Only hash-bearing rows participate (pre-Phase-05 '' placeholder rows are excluded).
  const rows = await adminDb.select().from(auditLog).orderBy(asc(auditLog.id));
  const chainRows = rows.filter((r) => r.entryHash.length === 64).map(toChainRow);
  const result = verifyChain(chainRows);
  return c.json({
    chain_valid: result.valid,
    broken_at: result.brokenAt,
    total: chainRows.length,
  });
});
