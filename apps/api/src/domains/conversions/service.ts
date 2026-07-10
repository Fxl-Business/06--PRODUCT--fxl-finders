import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { getDb } from '../../db/client.js';
import {
  apps,
  clicks,
  commissionRules,
  commissions,
  conversions,
  finders,
  leads,
  referralLinks,
  sellers,
  webhookEvents,
} from '../../db/schema.js';
import { buildCommissionRows, type CommissionRow } from '../commissions/service.js';
import { writeAuditEntry } from '../audit/service.js';

/**
 * Conversions domain service (Phase 05 T05).
 *
 * ingestConversion runs on getAdminDb() with admin session context (D-C): the webhook
 * is a cross-tenant path with NO finder JWT and must SELECT clicks / finders /
 * commission_rules without a tenant context. setTenantContext is NEVER called here.
 * The split WITH CHECK(true) INSERT policies (D10) keep the app webhook path viable
 * for writes, but cross-tenant READS require the admin context.
 * The route handler passes in rawBodyHash (D-L) - the service stores it verbatim in
 * webhook_events.body_hash and does NOT recompute a hash of the parsed body.
 *
 * Two-level idempotency guard: webhook_events ON CONFLICT(source,event_id) (body-level)
 * then conversions.idempotency_key UNIQUE (semantics-level).
 */

type Db = ReturnType<typeof getDb>;
export type ConversionRow = typeof conversions.$inferSelect;
type ClickRow = { clickId: string; linkId: string; createdAt: Date };

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas (D-M: ONE field set - byte-matches Phase 06 sender)
// ─────────────────────────────────────────────────────────────────────────────

export const WebhookBodySchema = z.object({
  source: z.string().min(1),
  external_order_id: z.string().min(1),
  event_type: z.enum(['sale', 'refund']),
  idempotency_key: z.string().min(1),
  click_id: z.string().nullable(),
  finder_code: z.string().optional(), // D-M attribution fallback
  seller_account_id: z.string().nullable(),
  customer_email: z.string().email(),
  customer_name: z.string().min(1), // D-L leads PII
  customer_phone: z.string().nullable(), // D-L leads PII
  customer_cpf: z.string().nullable(), // D-L leads PII
  customer_org_id: z.string().nullable(),
  realized_setup_brl: z.number().int().nonnegative(),
  realized_monthly_brl: z.number().int().nonnegative(),
  closed_at: z.string().datetime(), // ISO 8601; parsed to Date in service
});
export type WebhookBody = z.infer<typeof WebhookBodySchema>;

export const RefundBodySchema = z.object({
  conversion_id: z.string().uuid(),
  reason: z.string().min(1),
});

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (unit-tested)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Last-touch attribution: the most recent click whose created_at is within
 * `attributionWindowDays` before `closedAt` (inclusive window start). Returns null
 * when no click qualifies.
 */
export function resolveAttribution(
  clickRows: ClickRow[],
  closedAt: Date,
  attributionWindowDays: number,
): ClickRow | null {
  const windowStart = closedAt.getTime() - attributionWindowDays * 86400000;
  const inWindow = clickRows.filter(
    (c) => c.createdAt.getTime() >= windowStart && c.createdAt.getTime() <= closedAt.getTime(),
  );
  if (inWindow.length === 0) return null;
  return inWindow.reduce((latest, c) =>
    c.createdAt.getTime() > latest.createdAt.getTime() ? c : latest,
  );
}

/** idempotency_key = sha256(source + external_order_id + event_type) (D-N). */
export function buildIdempotencyKey(
  source: string,
  externalOrderId: string,
  eventType: string,
): string {
  return createHash('sha256').update(source + externalOrderId + eventType).digest('hex');
}

/** customer_email_hash = sha256(email + orgId) - org-salted, irreversible (D-L). */
export function hashCustomerEmail(email: string, orgId: string): string {
  return createHash('sha256').update(email + orgId).digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// DB function - full ingest (single transaction)
// ─────────────────────────────────────────────────────────────────────────────

export type IngestResult = {
  conversion: ConversionRow | null;
  commissions: CommissionRow[];
  isDuplicate: boolean;
};

export async function ingestConversion(
  db: Db,
  body: WebhookBody,
  rawBodyHash: string,
): Promise<IngestResult> {
  // The sale ingest path books POSITIVE commissions. A 'refund' event must NOT flow
  // here (it would mis-book a positive commission) - refunds go through POST /refund →
  // reverseCommission (which inserts negative rows / flips status). Guard explicitly.
  if (body.event_type !== 'sale') {
    throw new Error('unsupported_event_type');
  }
  return db.transaction(async (tx) => {
    // 1. Webhook dedup (body-level). Stores the route-supplied rawBodyHash verbatim (D-L).
    const inserted = await tx
      .insert(webhookEvents)
      .values({
        source: body.source,
        eventId: body.idempotency_key,
        bodyHash: rawBodyHash,
        signatureValid: true,
        processedAt: new Date(),
      })
      .onConflictDoNothing({ target: [webhookEvents.source, webhookEvents.eventId] })
      .returning({ id: webhookEvents.id });
    if (inserted.length === 0) {
      return { conversion: null, commissions: [], isDuplicate: true };
    }

    // 2. Resolve app (active).
    const [app] = await tx
      .select()
      .from(apps)
      .where(and(eq(apps.slug, body.source), eq(apps.status, 'active')))
      .limit(1);
    if (!app) throw new Error('app_not_found');

    const closedAt = new Date(body.closed_at);

    // 3. Resolve attribution (D-M two-step + hard fail).
    let resolvedLinkId: string | null = null;
    let resolvedClickId: string | null = null;
    if (body.click_id) {
      const [click] = await tx
        .select({ clickId: clicks.clickId, linkId: clicks.linkId, createdAt: clicks.createdAt })
        .from(clicks)
        .where(eq(clicks.clickId, body.click_id))
        .limit(1);
      const attributed = click
        ? resolveAttribution([click], closedAt, app.attributionWindowDays)
        : null;
      if (attributed) {
        resolvedLinkId = attributed.linkId;
        resolvedClickId = attributed.clickId;
      }
    }
    if (!resolvedLinkId && body.finder_code) {
      // Fallback: resolve the link by its bearer code (Phase 04 referral_links.code).
      const [link] = await tx
        .select({ id: referralLinks.id })
        .from(referralLinks)
        .where(eq(referralLinks.code, body.finder_code))
        .limit(1);
      if (link) resolvedLinkId = link.id;
    }
    if (!resolvedLinkId) {
      // NEVER silently drop or insert a null-finder row (D-M). 4xx so financeiro retries/alerts.
      throw new Error('attribution_not_found');
    }

    // 4. Resolve link + finder + quoted snapshot (D-L).
    const [link] = await tx
      .select()
      .from(referralLinks)
      .where(eq(referralLinks.id, resolvedLinkId))
      .limit(1);
    if (!link) throw new Error('attribution_not_found');

    const [finder] = await tx
      .select()
      .from(finders)
      .where(eq(finders.id, link.finderId))
      .limit(1);
    if (!finder) throw new Error('attribution_not_found');

    // 5. Resolve seller (nullable; missing → warn, do not block).
    let sellerId: string | null = null;
    if (body.seller_account_id) {
      const [seller] = await tx
        .select({ id: sellers.id })
        .from(sellers)
        .where(eq(sellers.accountId, body.seller_account_id))
        .limit(1);
      if (seller) sellerId = seller.id;
      else console.warn(`[ingest] seller not found for account_id=${body.seller_account_id}`);
    }

    // 6. Resolve commission rules.
    const [rule] = await tx
      .select()
      .from(commissionRules)
      .where(eq(commissionRules.productId, link.productId))
      .limit(1);
    if (!rule) throw new Error('commission_rules_not_found');

    // 7. customer_email_hash (D-L).
    const customerEmailHash = hashCustomerEmail(body.customer_email, finder.orgId);

    // 8. Insert conversion (semantics-level idempotency guard via idempotency_key UNIQUE).
    const holdUntil = new Date(Date.now() + app.commissionHoldDays * 86400000);
    const [conversion] = await tx
      .insert(conversions)
      .values({
        source: body.source,
        externalOrderId: body.external_order_id,
        eventType: body.event_type,
        idempotencyKey: body.idempotency_key,
        orgId: finder.orgId,
        linkId: link.id,
        clickId: resolvedClickId,
        finderId: finder.id,
        sellerId,
        appId: link.appId,
        productId: link.productId,
        quotedSetupBrl: link.quotedSetupBrl, // snapshot from referral_links (D-L)
        quotedMonthlyBrl: link.quotedMonthlyBrl,
        realizedSetupBrl: body.realized_setup_brl,
        realizedMonthlyBrl: body.realized_monthly_brl,
        customerEmailHash,
        customerOrgId: body.customer_org_id,
        holdUntil,
        closedAt,
      })
      .onConflictDoNothing({ target: conversions.idempotencyKey })
      .returning();
    if (!conversion) {
      return { conversion: null, commissions: [], isDuplicate: true };
    }

    // 9. Insert leads PII row (D-L / LGPD §9). Canonical PII landing; conversions store only the hash.
    await tx.insert(leads).values({
      orgId: finder.orgId,
      clickId: resolvedClickId,
      linkId: link.id,
      customerName: body.customer_name,
      customerEmail: body.customer_email,
      customerPhone: body.customer_phone,
      customerCpf: body.customer_cpf,
      status: 'converted',
    });

    // 10. Build + insert commission rows (D4: skip zero-amount; status='pending', D-K).
    const rows = buildCommissionRows(
      {
        id: conversion.id,
        orgId: finder.orgId,
        finderId: finder.id,
        appId: link.appId,
        productId: link.productId,
        realizedSetupBrl: body.realized_setup_brl,
        realizedMonthlyBrl: body.realized_monthly_brl,
      },
      {
        setupRatePct: rule.setupRatePct,
        recurringRatePct: rule.recurringRatePct,
        recurringMonths: rule.recurringMonths,
      },
      holdUntil,
    );
    const insertedCommissions =
      rows.length > 0 ? await tx.insert(commissions).values(rows).returning() : [];

    // 11. Audit (actor='system' for webhook).
    await writeAuditEntry(tx, {
      actorUserId: 'system',
      actorOrgId: finder.orgId,
      action: 'conversion.recorded',
      entityType: 'conversion',
      entityId: conversion.id,
      afterJsonb: conversion,
    });
    for (const commission of insertedCommissions) {
      await writeAuditEntry(tx, {
        actorUserId: 'system',
        actorOrgId: finder.orgId,
        action: 'commission.created',
        entityType: 'commission',
        entityId: commission.id,
        afterJsonb: commission,
      });
    }

    return { conversion, commissions: insertedCommissions, isDuplicate: false };
  });
}
