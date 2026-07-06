import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { getAdminDb } from '../../db/client.js';
import { auditLog, finders } from '../../db/schema.js';

/**
 * Admin finders service (Phase 03 T03).
 *
 * Admin-vs-RLS model (D-C): `finders` is FORCE ROW LEVEL SECURITY. These
 * cross-tenant admin operations use the dedicated BYPASSRLS connection
 * getAdminDb() and NEVER call setTenantContext. Every mutation writes audit_log.
 */

export type FinderStatus = 'pending' | 'approved' | 'suspended';

export type FinderRow = typeof finders.$inferSelect;

/**
 * Public-facing finder row. CPF is masked (last 3 digits only) so the admin list
 * never leaks the full document. Account/workspace ids are
 * resolved or rendered via the raw-ID fallback on the frontend.
 */
export type AdminFinderRow = Omit<FinderRow, 'cpf'> & { cpfMasked: string | null };

function maskCpf(cpf: string | null): string | null {
  if (!cpf) return null;
  if (cpf.length <= 3) return `***${cpf}`;
  return `***${cpf.slice(-3)}`;
}

function toAdminRow(row: FinderRow): AdminFinderRow {
  const { cpf, ...rest } = row;
  return { ...rest, cpfMasked: maskCpf(cpf) };
}

const PAGE_SIZE = 50;

export async function listFinders(opts: {
  status?: FinderStatus;
  cursor?: string | null;
}): Promise<{ items: AdminFinderRow[]; nextCursor: string | null }> {
  const db = getAdminDb();
  const conditions = [];
  if (opts.status) conditions.push(eq(finders.status, opts.status));
  if (opts.cursor) conditions.push(lt(finders.createdAt, new Date(opts.cursor)));
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(finders)
    .where(where)
    .orderBy(desc(finders.createdAt))
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const items = (hasMore ? rows.slice(0, PAGE_SIZE) : rows).map(toAdminRow);
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? last.createdAt.toISOString() : null;
  return { items, nextCursor };
}

export async function getFinder(finderId: string): Promise<AdminFinderRow | null> {
  const db = getAdminDb();
  const [row] = await db.select().from(finders).where(eq(finders.id, finderId)).limit(1);
  return row ? toAdminRow(row) : null;
}

export class FinderStateError extends Error {
  constructor(
    public readonly code: 'not_found' | 'invalid_state',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'FinderStateError';
  }
}

/**
 * Approve a finder - idempotent (D-R WARN). In one transaction:
 *   1. SELECT ... FOR UPDATE locks the row for concurrent double-clicks.
 *   2. Idempotency: already-approved -> no-op return; non-pending non-approved -> invalid_state.
 *   3. Flip status pending -> approved + persist the Hub workspace id.
 *   4. Write audit_log.
 */
export async function approveFinder(
  finderId: string,
  adminUserId: string,
): Promise<{ id: string; status: FinderStatus }> {
  const db = getAdminDb();

  // Phase 1 of the work - tx-bound state changes (org + status + audit).
  const result = await db.transaction(async (tx) => {
    const [finder] = await tx
      .select()
      .from(finders)
      .where(eq(finders.id, finderId))
      .for('update')
      .limit(1);

    if (!finder) throw new FinderStateError('not_found');

    if (finder.status !== 'pending') {
      if (finder.status === 'approved') {
        return { finder, alreadyApproved: true as const };
      }
      throw new FinderStateError('invalid_state');
    }

    const workspaceId = (finder.workspaceId ?? finder.orgId) || finder.id;

    await tx
      .update(finders)
      .set({
        status: 'approved',
        workspaceId,
        orgId: workspaceId,
        approvedAt: new Date(),
        approvedByUserId: adminUserId,
        updatedAt: new Date(),
      })
      .where(and(eq(finders.id, finderId), eq(finders.status, 'pending')));

    await tx.insert(auditLog).values({
      actorUserId: adminUserId,
      action: 'finder.approved',
      entityType: 'finder',
      entityId: finder.id,
      afterJsonb: { workspaceId, provisioning: 'operator_owned' },
      prevHash: sql`''`,
      entryHash: sql`''`,
    });

    return {
      finder: {
        ...finder,
        workspaceId,
        orgId: workspaceId,
      },
      alreadyApproved: false as const,
    };
  });

  // Already approved -> idempotent no-op.
  if (result.alreadyApproved) {
    return { id: result.finder.id, status: 'approved' };
  }

  return { id: result.finder.id, status: 'approved' };
}

/**
 * Suspend a finder - state-guarded (D-R). Only an approved finder can be
 * suspended; an already-suspended finder is an idempotent no-op; a pending
 * finder throws invalid_state.
 */
export async function suspendFinder(
  finderId: string,
  adminUserId: string,
  reason: string,
): Promise<{ id: string; status: FinderStatus }> {
  const db = getAdminDb();
  return db.transaction(async (tx) => {
    const [finder] = await tx
      .select()
      .from(finders)
      .where(eq(finders.id, finderId))
      .for('update')
      .limit(1);
    if (!finder) throw new FinderStateError('not_found');
    if (finder.status === 'suspended') return { id: finder.id, status: 'suspended' };
    if (finder.status !== 'approved') throw new FinderStateError('invalid_state');

    await tx
      .update(finders)
      .set({
        status: 'suspended',
        suspendedAt: new Date(),
        suspendedReason: reason,
        updatedAt: new Date(),
      })
      .where(and(eq(finders.id, finderId), eq(finders.status, 'approved')));

    await tx.insert(auditLog).values({
      actorUserId: adminUserId,
      action: 'finder.suspended',
      entityType: 'finder',
      entityId: finder.id,
      afterJsonb: { reason },
      prevHash: sql`''`,
      entryHash: sql`''`,
    });
    return { id: finder.id, status: 'suspended' };
  });
}
