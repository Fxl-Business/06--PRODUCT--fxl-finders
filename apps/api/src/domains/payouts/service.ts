import { and, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { getAdminDb, getDb } from '../../db/client.js';
import { setTenantContext } from '../../middleware/auth.js';
import { commissions, finders, payouts } from '../../db/schema.js';
import { writeAuditEntry } from '../audit/service.js';

/**
 * Payouts domain service (Phase 05 T08 + Phase 06 T03, D-Q - Phase 05 OWNS the single
 * payouts table; Phase 06 EXTENDS it with listFindersWithLockedCommissions + generateCsv).
 *
 * NO payout_batches, NO payout_batch_id, NO in_payout status. payouts has NO RLS
 * (admin-managed cross-tenant). Admin paths run on getAdminDb() with the admin
 * session context (D-C) and write audit_log in the same tx. Finder reads own
 * payouts via getDb() + setTenantContext.
 *
 * Reserve semantics (D-Q): createPayoutBatch stamps commissions.paid_payout_id while
 * they STAY 'locked'; markPayoutPaid is the ONLY place that flips commissions locked→paid.
 *
 * Two-person payout approval is DEFERRED to v1.1 (D6 / failure-list #8): the payouts
 * table has NO approved_by_* columns, there is no second-approver gate, and the v1.0 UI
 * shows no approval badge. v1.0 is single-approver - any admin can mark a payout paid.
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

    // 5. RESERVE (D-Q): stamp paid_payout_id - status STAYS 'locked' (no paid/paid_at here).
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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 06 T03 additions (D-Q): finder-readiness listing + CSV export.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A finder with locked, not-yet-reserved commissions ready for payout.
 *
 * Finders missing cpf/pix_key are NOT dropped - they are returned with
 * payable=false + blockedReason so the admin UI can show them with a disabled
 * checkbox (D-Q). They MUST NOT cause a NOT NULL crash anywhere downstream.
 */
export interface FinderCommissionSummary {
  finderId: string;
  finderName: string;
  cpf: string | null;
  pixKey: string | null;
  pixKeyType: string | null;
  totalBrl: number; // sum of locked, not-yet-reserved commission amount_brl
  commissionIds: string[];
  payable: boolean; // false when cpf OR pix_key is missing/empty
  blockedReason: string | null; // 'missing_cpf' | 'missing_pix_key' when not payable
}

/**
 * Lists finders that have locked commissions not yet reserved to a payout
 * (paid_payout_id IS NULL). Runs on getAdminDb() with admin session context (D-C), no
 * setTenantContext. Groups commissions per finder in app code (avoids relying on
 * a specific Drizzle aggregate API); the volume here is bounded by # of finders
 * with open commissions, so an in-memory group is acceptable for v1.0.
 */
export async function listFindersWithLockedCommissions(
  adminDb: AdminDb,
): Promise<FinderCommissionSummary[]> {
  const rows = await adminDb
    .select({
      finderId: finders.id,
      finderName: finders.displayName,
      cpf: finders.cpf,
      pixKey: finders.pixKey,
      pixKeyType: finders.pixKeyType,
      commissionId: commissions.id,
      amountBrl: commissions.amountBrl,
    })
    .from(commissions)
    .innerJoin(finders, eq(commissions.finderId, finders.id))
    .where(and(eq(commissions.status, 'locked'), isNull(commissions.paidPayoutId)));

  const byFinder = new Map<string, FinderCommissionSummary>();
  for (const row of rows) {
    let summary = byFinder.get(row.finderId);
    if (!summary) {
      const hasCpf = row.cpf != null && row.cpf !== '';
      const hasPix = row.pixKey != null && row.pixKey !== '';
      const payable = hasCpf && hasPix;
      const blockedReason = payable ? null : !hasCpf ? 'missing_cpf' : 'missing_pix_key';
      summary = {
        finderId: row.finderId,
        finderName: row.finderName,
        cpf: row.cpf,
        pixKey: row.pixKey,
        pixKeyType: row.pixKeyType,
        totalBrl: 0,
        commissionIds: [],
        payable,
        blockedReason,
      };
      byFinder.set(row.finderId, summary);
    }
    summary.totalBrl += row.amountBrl;
    summary.commissionIds.push(row.commissionId);
  }
  return [...byFinder.values()];
}

export const GenerateCsvSchema = z.object({
  payoutIds: z.array(z.string().uuid()).min(0),
});

const CSV_BOM = '﻿'; // UTF-8 BOM so Excel PT-BR opens without an encoding dialog.
const CSV_HEADER = 'finder_name,cpf,pix_key,pix_key_type,amount_brl,commission_ids';
const brlFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Escapes a CSV cell: wraps in double quotes + doubles embedded quotes when needed. */
function csvCell(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/** One payout's worth of CSV data (finder snapshot + reserved commission ids). */
export interface CsvPayoutLine {
  finderName: string;
  cpf: string | null;
  pixKey: string | null;
  pixKeyType: string | null;
  totalBrl: number; // int cents
  commissionIds: string[];
}

/**
 * PURE CSV builder (D4) - separated from the DB fetch so the byte contract is
 * unit-testable without a DB. UTF-8 BOM + pinned header row + one row per payout.
 * amount_brl uses pt-BR formatting (thousands '.', decimal ',', no currency symbol);
 * commission_ids is the comma-joined UUID list, double-quoted. Empty input → BOM +
 * header only.
 */
export function buildCsvBuffer(rows: CsvPayoutLine[]): Buffer {
  const lines: string[] = [CSV_HEADER];
  for (const row of rows) {
    const amount = brlFormatter.format(row.totalBrl / 100);
    lines.push(
      [
        csvCell(row.finderName),
        csvCell(row.cpf ?? ''),
        csvCell(row.pixKey ?? ''),
        csvCell(row.pixKeyType ?? ''),
        csvCell(amount),
        '"' + row.commissionIds.join(',') + '"', // commission_ids always double-quoted (D4)
      ].join(','),
    );
  }
  return Buffer.from(CSV_BOM + lines.join('\n') + '\n', 'utf-8');
}

/**
 * Generates the payout CSV for the named payouts (D4). Fetches each payout + its
 * finder snapshot + its reserved commission ids, then defers byte-formatting to the
 * pure buildCsvBuffer. Order follows the caller's payoutIds. Runs on getAdminDb()
 * with admin session context (D-C).
 */
export async function generateCsv(adminDb: AdminDb, payoutIds: string[]): Promise<Buffer> {
  if (payoutIds.length === 0) return buildCsvBuffer([]);

  const payoutRows = await adminDb
    .select({
      payoutId: payouts.id,
      totalBrl: payouts.totalBrl,
      finderName: finders.displayName,
      cpf: finders.cpf,
      pixKey: finders.pixKey,
      pixKeyType: finders.pixKeyType,
    })
    .from(payouts)
    .innerJoin(finders, eq(payouts.finderId, finders.id))
    .where(inArray(payouts.id, payoutIds));

  // Reserved commission ids per payout (commissions.paid_payout_id = payout.id).
  const reserved = await adminDb
    .select({ payoutId: commissions.paidPayoutId, commissionId: commissions.id })
    .from(commissions)
    .where(inArray(commissions.paidPayoutId, payoutIds));
  const idsByPayout = new Map<string, string[]>();
  for (const r of reserved) {
    if (!r.payoutId) continue;
    const list = idsByPayout.get(r.payoutId) ?? [];
    list.push(r.commissionId);
    idsByPayout.set(r.payoutId, list);
  }

  // Preserve the caller's payoutIds order for a deterministic file.
  const byId = new Map(payoutRows.map((p) => [p.payoutId, p]));
  const lines: CsvPayoutLine[] = [];
  for (const id of payoutIds) {
    const p = byId.get(id);
    if (!p) continue;
    lines.push({
      finderName: p.finderName,
      cpf: p.cpf,
      pixKey: p.pixKey,
      pixKeyType: p.pixKeyType,
      totalBrl: p.totalBrl,
      commissionIds: idsByPayout.get(id) ?? [],
    });
  }
  return buildCsvBuffer(lines);
}
