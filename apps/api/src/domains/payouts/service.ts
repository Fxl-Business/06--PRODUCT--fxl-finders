import { and, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { getAdminDb, getDb } from '../../db/client.js';
import { setTenantContext } from '../../middleware/auth.js';
import { commissions, finders, payouts } from '../../db/schema.js';
import { writeAuditEntry } from '../audit/service.js';

/**
 * Payouts domain service (Phase 05 T08, D-Q — Phase 05 OWNS the single payouts table).
 *
 * NO payout_batches, NO payout_batch_id, NO in_payout status. payouts has NO RLS
 * (admin-managed cross-tenant). Admin paths run on getAdminDb() (BYPASSRLS, D-C) and
 * write audit_log in the same tx. Finder reads own payouts via getDb() + setTenantContext.
 *
 * Reserve semantics (D-Q): createPayoutBatch stamps commissions.paid_payout_id while
 * they STAY 'locked'; markPayoutPaid is the ONLY place that flips commissions locked→paid.
 * Admin payouts UI is DEFERRED to Phase 06 (this service is consumed there).
 */

type AdminDb = ReturnType<typeof getAdminDb>;
type Db = ReturnType<typeof getDb>;
type Tx = { execute: (query: SQL) => Promise<unknown> };
export type PayoutRow = typeof payouts.$inferSelect;

export const CreatePayoutSchema = z.object({
  finderId: z.string().uuid(),
  commissionIds: z.array(z.string().uuid()).min(1),
});

export const MarkPaidSchema = z.object({
  payoutId: z.string().uuid(),
  note: z.string().optional(),
});

/**
 * Creates a payout and RESERVES the given commissions (D-Q: stamp paid_payout_id;
 * commissions STAY 'locked'). Runs on getAdminDb() in one tx + audit. Throws:
 *   - finder_payout_details_missing (→422) when cpf/pix_key missing (NOT a NOT NULL crash)
 *   - commissions_not_locked (→422) when any requested id is not locked/already reserved
 */
export async function createPayoutBatch(
  adminDb: AdminDb,
  finderId: string,
  commissionIds: string[],
  actorUserId: string,
): Promise<PayoutRow> {
  return adminDb.transaction(async (tx) => {
    // 1. Finder payout-detail guard (D-Q): surfaced error, not a crash.
    const [finder] = await tx
      .select({ cpf: finders.cpf, pixKey: finders.pixKey })
      .from(finders)
      .where(eq(finders.id, finderId))
      .limit(1);
    if (!finder) throw new Error('finder_not_found');
    if (!finder.cpf || !finder.pixKey) {
      throw new Error('finder_payout_details_missing');
    }

    // 2. Fetch eligible commissions: locked, this finder, not yet reserved.
    const eligible = await tx
      .select()
      .from(commissions)
      .where(
        and(
          inArray(commissions.id, commissionIds),
          eq(commissions.finderId, finderId),
          eq(commissions.status, 'locked'),
          isNull(commissions.paidPayoutId),
        ),
      );
    if (eligible.length !== commissionIds.length) {
      throw new Error('commissions_not_locked');
    }

    // 3. Total.
    const totalBrl = eligible.reduce((sum, row) => sum + row.amountBrl, 0);

    // 4. Insert payout (draft).
    const [payout] = await tx
      .insert(payouts)
      .values({ finderId, totalBrl, status: 'draft' })
      .returning();
    if (!payout) throw new Error('payout_insert_failed');

    // 5. RESERVE (D-Q): stamp paid_payout_id — status STAYS 'locked' (no paid/paid_at here).
    await tx
      .update(commissions)
      .set({ paidPayoutId: payout.id, updatedAt: new Date() })
      .where(inArray(commissions.id, commissionIds));

    // 6. Audit (D-C money mutation) in the SAME tx.
    await writeAuditEntry(tx, {
      actorUserId,
      action: 'payout.mark_paid',
      entityType: 'payout',
      entityId: payout.id,
      afterJsonb: payout,
    });
    return payout;
  });
}

/**
 * Marks a payout paid (D-Q: the ONLY locked→paid transition). Runs on getAdminDb()
 * in one tx + audit. Throws payout_not_found if no draft/exported payout matches.
 */
export async function markPayoutPaid(
  adminDb: AdminDb,
  payoutId: string,
  actorUserId: string,
  note?: string,
): Promise<PayoutRow> {
  return adminDb.transaction(async (tx) => {
    const [updated] = await tx
      .update(payouts)
      .set({ status: 'paid', paidAt: new Date(), paidByUserId: actorUserId, note: note ?? null, updatedAt: new Date() })
      .where(and(eq(payouts.id, payoutId), inArray(payouts.status, ['draft', 'exported'])))
      .returning();
    if (!updated) throw new Error('payout_not_found');

    // FLIP (D-Q): the ONLY commissions locked→paid transition.
    await tx
      .update(commissions)
      .set({ status: 'paid', paidAt: new Date(), updatedAt: new Date() })
      .where(and(eq(commissions.paidPayoutId, payoutId), eq(commissions.status, 'locked')));

    await writeAuditEntry(tx, {
      actorUserId,
      action: 'payout.mark_paid',
      entityType: 'payout',
      entityId: payoutId,
      beforeJsonb: { status: 'draft' },
      afterJsonb: updated,
    });
    return updated;
  });
}

/** Admin cross-tenant read (getAdminDb(), no setTenantContext, D-C). */
export async function getPayoutsAdmin(adminDb: AdminDb, finderId?: string): Promise<PayoutRow[]> {
  const query = adminDb.select().from(payouts);
  return finderId ? query.where(eq(payouts.finderId, finderId)) : query;
}

/** Finder reads own payouts (getDb() + tx-scoped setTenantContext, D-D). */
export async function getPayoutsByFinder(
  db: Db,
  orgId: string,
  finderId: string,
): Promise<PayoutRow[]> {
  return db.transaction(async (tx) => {
    await setTenantContext(tx as unknown as Tx, orgId);
    return tx.select().from(payouts).where(eq(payouts.finderId, finderId));
  });
}
