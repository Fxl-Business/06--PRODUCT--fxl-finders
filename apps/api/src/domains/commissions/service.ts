import { and, desc, eq, lt, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { getAdminDb, getDb } from '../../db/client.js';
import { setTenantContext } from '../../middleware/auth.js';
import { commissions } from '../../db/schema.js';
import { writeAuditEntry } from '../audit/service.js';

/**
 * Commissions domain service (Phase 05 T03).
 *
 * commissions is tenant-scoped (FORCE RLS, split-INSERT D10). Finder reads run on
 * getDb() inside a tx with setTenantContext (D-D). Admin reads + state transitions
 * (lock / reverse / nightly promote) run on getAdminDb() (BYPASSRLS, D-C) and write
 * an audit_log row in the SAME transaction for every money mutation. The app role
 * has NO UPDATE grant/policy on commissions — defence in depth (D-C).
 *
 * Lifecycle (D-K): auto path is pending → locked → paid → (reversed). The nightly
 * job promotes pending → locked WHERE hold_until < now() with NO manual action and
 * NO `approved` step. Manual "approve / lock-now" (lockCommission) is a pending→locked
 * fast-track. The `approved` enum value exists for forward-compat but is never written.
 */

type Db = ReturnType<typeof getDb>;
type AdminDb = ReturnType<typeof getAdminDb>;
type Tx = { execute: (query: SQL) => Promise<unknown> };
export type CommissionRow = typeof commissions.$inferSelect;
export type CommissionInsertRow = typeof commissions.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas + types
// ─────────────────────────────────────────────────────────────────────────────

export const CommissionStatusSchema = z.enum([
  'pending',
  'approved',
  'locked',
  'paid',
  'reversed',
]);
export type CommissionStatus = z.infer<typeof CommissionStatusSchema>;

export const ApproveCommissionSchema = z.object({
  commissionId: z.string().uuid(),
  approvedByUserId: z.string(),
});

export const ReverseCommissionSchema = z.object({
  commissionId: z.string().uuid(),
  reason: z.string().min(1),
});

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (unit-tested in __tests__/service.test.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Setup commission in int cents: floor(realizedSetupBrl * rate% / 100).
 * `setupRatePct` accepts number | string because Drizzle numeric(5,2) returns a
 * STRING in Node — Number() coercion is mandatory (plan-brief Wave 4 failure-list).
 */
export function calculateSetupCommission(
  realizedSetupBrl: number,
  setupRatePct: number | string,
): number {
  if (realizedSetupBrl === 0) return 0;
  return Math.floor((realizedSetupBrl * Number(setupRatePct)) / 100);
}

/**
 * Recurring commission in int cents:
 * floor(realizedMonthlyBrl * rate% / 100 * recurringMonths). Returns 0 when
 * recurringMonths === 0 or realizedMonthlyBrl === 0 (no recurring commission).
 */
export function calculateRecurringCommission(
  realizedMonthlyBrl: number,
  recurringRatePct: number | string,
  recurringMonths: number,
): number {
  if (recurringMonths === 0 || realizedMonthlyBrl === 0) return 0;
  return Math.floor((realizedMonthlyBrl * Number(recurringRatePct)) / 100) * recurringMonths;
}

/**
 * State-machine guard (D-K). Allowed: pending→locked, locked→paid, and from→reversed
 * for from ∈ {pending, locked, paid}. `reversed` is terminal. No *→approved produced
 * by v1.0 logic. `approved` is kept in the enum for forward-compat only.
 */
const TRANSITIONS: Record<CommissionStatus, CommissionStatus[]> = {
  pending: ['locked', 'reversed'],
  approved: ['locked', 'reversed'], // forward-compat; never produced by v1.0
  locked: ['paid', 'reversed'],
  paid: ['reversed'],
  reversed: [],
};

export function isValidTransition(from: CommissionStatus, to: CommissionStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

type ConversionForCommission = {
  id: string;
  orgId: string;
  finderId: string;
  appId: string;
  productId: string;
  realizedSetupBrl: number;
  realizedMonthlyBrl: number;
};

type CommissionRule = {
  setupRatePct: number | string;
  recurringRatePct: number | string;
  recurringMonths: number;
};

/**
 * Builds the commission insert rows for a conversion (D4: skip zero-amount rows).
 * New rows start at status='pending' with the given holdUntil. Returns an empty
 * array (never undefined) for a fully zero-realized conversion.
 */
export function buildCommissionRows(
  conversion: ConversionForCommission,
  rule: CommissionRule,
  holdUntil: Date,
): CommissionInsertRow[] {
  const rows: CommissionInsertRow[] = [];

  const setupAmount = calculateSetupCommission(conversion.realizedSetupBrl, rule.setupRatePct);
  if (setupAmount > 0) {
    rows.push({
      conversionId: conversion.id,
      orgId: conversion.orgId,
      finderId: conversion.finderId,
      appId: conversion.appId,
      productId: conversion.productId,
      kind: 'setup',
      basisBrl: conversion.realizedSetupBrl,
      ratePct: String(rule.setupRatePct),
      amountBrl: setupAmount,
      status: 'pending',
      holdUntil,
    });
  }

  const recurringAmount = calculateRecurringCommission(
    conversion.realizedMonthlyBrl,
    rule.recurringRatePct,
    rule.recurringMonths,
  );
  if (recurringAmount > 0) {
    rows.push({
      conversionId: conversion.id,
      orgId: conversion.orgId,
      finderId: conversion.finderId,
      appId: conversion.appId,
      productId: conversion.productId,
      kind: 'recurring',
      basisBrl: conversion.realizedMonthlyBrl,
      ratePct: String(rule.recurringRatePct),
      amountBrl: recurringAmount,
      status: 'pending',
      holdUntil,
    });
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Finder reads own commissions (D-D: tx-scoped setTenantContext on getDb()).
 */
export async function getCommissionsByFinder(
  db: Db,
  orgId: string,
  finderId: string,
): Promise<CommissionRow[]> {
  return db.transaction(async (tx) => {
    await setTenantContext(tx as unknown as Tx, orgId);
    return tx
      .select()
      .from(commissions)
      .where(eq(commissions.finderId, finderId))
      .orderBy(desc(commissions.createdAt));
  });
}

/**
 * Admin cross-tenant read (D-C: getAdminDb() BYPASSRLS; NO setTenantContext).
 */
export async function getCommissionsAdmin(
  adminDb: AdminDb,
  filters?: { status?: CommissionStatus; finderId?: string },
): Promise<CommissionRow[]> {
  const conditions = [];
  if (filters?.status) conditions.push(eq(commissions.status, filters.status));
  if (filters?.finderId) conditions.push(eq(commissions.finderId, filters.finderId));
  const query = adminDb.select().from(commissions);
  const rows =
    conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(commissions.createdAt))
      : await query.orderBy(desc(commissions.createdAt));
  return rows;
}

/**
 * Manual "approve / lock-now" fast-track (D-K: pending→locked). Runs on getAdminDb()
 * in one tx; validates the transition; writes a commission.approve audit row in the
 * SAME tx (D-C). Throws Error('commission_not_found') / Error('invalid_transition').
 */
export async function lockCommission(
  adminDb: AdminDb,
  commissionId: string,
  actorUserId: string,
): Promise<CommissionRow> {
  return adminDb.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(commissions)
      .where(eq(commissions.id, commissionId))
      .limit(1)
      .for('update');
    if (!current) throw new Error('commission_not_found');
    if (!isValidTransition(current.status as CommissionStatus, 'locked')) {
      throw new Error('invalid_transition');
    }
    const [updated] = await tx
      .update(commissions)
      .set({ status: 'locked', lockedAt: new Date(), updatedAt: new Date() })
      .where(eq(commissions.id, commissionId))
      .returning();
    if (!updated) throw new Error('commission_not_found');
    await writeAuditEntry(tx, {
      actorUserId,
      actorOrgId: current.orgId,
      action: 'commission.approve',
      entityType: 'commission',
      entityId: commissionId,
      beforeJsonb: current,
      afterJsonb: updated,
    });
    return updated;
  });
}

/**
 * D-K auto path. Nightly job promotes pending→locked WHERE hold_until < now().
 * Runs on getAdminDb() (cross-tenant, no JWT). Returns the count of promoted rows.
 * A freshly-ingested 'pending' commission reaches 'locked' here with NO manual action.
 */
export async function promoteHoldExpired(adminDb: AdminDb): Promise<number> {
  const promoted = await adminDb
    .update(commissions)
    .set({ status: 'locked', lockedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(commissions.status, 'pending'), lt(commissions.holdUntil, new Date())))
    .returning({ id: commissions.id });
  return promoted.length;
}

/**
 * Reverses a commission (D-C money mutation: getAdminDb() + audit in the same tx).
 * If status='paid': INSERT a NEW negative-amount 'reversed' row (the original is
 * immutable). If status in {pending, locked}: UPDATE the original to 'reversed'.
 * Throws Error('invalid_transition') when the current status is already 'reversed'.
 */
export async function reverseCommission(
  adminDb: AdminDb,
  commissionId: string,
  reason: string,
  actorUserId: string,
): Promise<CommissionRow> {
  return adminDb.transaction(async (tx) => {
    const [original] = await tx
      .select()
      .from(commissions)
      .where(eq(commissions.id, commissionId))
      .limit(1)
      .for('update');
    if (!original) throw new Error('commission_not_found');
    const currentStatus = original.status as CommissionStatus;
    if (!isValidTransition(currentStatus, 'reversed')) {
      throw new Error('invalid_transition');
    }

    let result: CommissionRow;
    if (currentStatus === 'paid') {
      // Immutable original: insert a new negative-amount reversed row.
      const [negative] = await tx
        .insert(commissions)
        .values({
          conversionId: original.conversionId,
          orgId: original.orgId,
          finderId: original.finderId,
          appId: original.appId,
          productId: original.productId,
          kind: original.kind,
          basisBrl: original.basisBrl,
          ratePct: original.ratePct,
          amountBrl: -original.amountBrl,
          status: 'reversed',
          holdUntil: original.holdUntil,
          reversedAt: new Date(),
          reversedReason: reason,
        })
        .returning();
      if (!negative) throw new Error('commission_reversal_failed');
      result = negative;
    } else {
      const [updated] = await tx
        .update(commissions)
        .set({ status: 'reversed', reversedAt: new Date(), reversedReason: reason, updatedAt: new Date() })
        .where(eq(commissions.id, commissionId))
        .returning();
      if (!updated) throw new Error('commission_not_found');
      result = updated;
    }

    await writeAuditEntry(tx, {
      actorUserId,
      actorOrgId: original.orgId,
      action: 'commission.reverse',
      entityType: 'commission',
      entityId: commissionId,
      beforeJsonb: original,
      afterJsonb: result,
    });
    return result;
  });
}
