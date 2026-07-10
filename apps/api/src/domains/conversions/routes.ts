import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { getAdminDb } from '../../db/client.js';
import { conversions, finders, sellers } from '../../db/schema.js';
import { reverseCommission, type CommissionRow } from '../commissions/service.js';
import { commissions } from '../../db/schema.js';
import { RefundBodySchema, WebhookBodySchema, ingestConversion } from './service.js';

/**
 * Conversions domain routes (Phase 05 T06).
 *
 * POST / and POST /refund are the inbound webhook path - no product JWT.
 * The hmacVerifyMiddleware is applied at the mount in server.ts and
 * stamps rawBodyHash on the context (D-L). The admin GET is gated by requireAdmin
 * (mounted in server.ts) and reads via getAdminDb() with admin session context (D-C).
 */
export const conversionsRouter = new Hono();

/**
 * Admin reconciliation router - SEPARATE from conversionsRouter so the HMAC
 * webhook middleware never runs on admin reads. Mounted under appAuthMiddleware
 * + requireAdmin in server.ts; reads via getAdminDb() with admin session context (D-C).
 */
export const conversionsAdminRouter = new Hono();

function mapIngestError(message: string): { status: 422; body: { error: string } } | null {
  switch (message) {
    case 'app_not_found':
    case 'commission_rules_not_found':
    case 'attribution_not_found':
    case 'unsupported_event_type':
      // 4xx so financeiro retries/alerts - NEVER a silent 200 (D-M).
      return { status: 422, body: { error: message } };
    default:
      return null;
  }
}

// POST / - inbound sale webhook (HMAC-verified upstream).
conversionsRouter.post('/', async (c) => {
  const parsed = WebhookBodySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: 'validation_error', issues: parsed.error.flatten() }, 400);
  }
  const rawBodyHash = c.get('rawBodyHash'); // set by hmacVerifyMiddleware (D-L)
  try {
    // D-C: the webhook is a cross-tenant path with NO finder JWT - it must SELECT
    // clicks/finders/commission_rules (all tenant-scoped FORCE RLS) without a tenant
    // context. Run ingest on getAdminDb() with admin session context. The split
    // WITH CHECK(true) INSERT policies keep the app webhook path viable too, but
    // the cross-tenant READS require the admin context. No setTenantContext here.
    const result = await ingestConversion(getAdminDb(), parsed.data, rawBodyHash);
    if (result.isDuplicate) {
      return c.json({ status: 'duplicate' }, 200);
    }
    return c.json({ status: 'accepted', conversionId: result.conversion?.id }, 200);
  } catch (err) {
    const mapped = mapIngestError(err instanceof Error ? err.message : '');
    if (mapped) return c.json(mapped.body, mapped.status);
    throw err;
  }
});

// POST /refund - reverse all commissions for a conversion (admin/webhook path).
conversionsRouter.post('/refund', async (c) => {
  const parsed = RefundBodySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: 'validation_error', issues: parsed.error.flatten() }, 400);
  }
  const adminDb = getAdminDb();
  const rows: CommissionRow[] = await adminDb
    .select()
    .from(commissions)
    .where(eq(commissions.conversionId, parsed.data.conversion_id));
  let count = 0;
  for (const row of rows) {
    if (row.status === 'reversed') continue;
    await reverseCommission(adminDb, row.id, parsed.data.reason, 'system');
    count++;
  }
  return c.json({ status: 'reversed', count }, 200);
});

// GET / on the admin router -> mounted at /api/v1/conversions/admin (requireAdmin gate
// in server.ts). Resolves finder/seller display names so the UI never
// renders raw UUIDs.
conversionsAdminRouter.get('/', async (c) => {
  const source = c.req.query('source');
  const finderId = c.req.query('finderId');
  const adminDb = getAdminDb();

  const rows = await adminDb
    .select({
      id: conversions.id,
      source: conversions.source,
      externalOrderId: conversions.externalOrderId,
      eventType: conversions.eventType,
      finderId: conversions.finderId,
      finderDisplayName: finders.displayName,
      sellerId: conversions.sellerId,
      sellerDisplayName: sellers.displayName,
      productId: conversions.productId,
      realizedSetupBrl: conversions.realizedSetupBrl,
      realizedMonthlyBrl: conversions.realizedMonthlyBrl,
      closedAt: conversions.closedAt,
      createdAt: conversions.createdAt,
    })
    .from(conversions)
    .leftJoin(finders, eq(conversions.finderId, finders.id))
    .leftJoin(sellers, eq(conversions.sellerId, sellers.id))
    .orderBy(desc(conversions.createdAt));

  const filtered = rows.filter(
    (r) => (!source || r.source === source) && (!finderId || r.finderId === finderId),
  );
  return c.json({ conversions: filtered });
});
