import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getAdminDb, getDb } from '../../db/client.js';
import { setTenantContext } from '../../middleware/auth.js';
import { resolveFinderId } from '../links/service.js';
import { payouts } from '../../db/schema.js';
import {
  CreatePayoutSchema,
  MarkPaidSchema,
  createPayoutBatch,
  getPayoutsAdmin,
  markPayoutPaid,
} from './service.js';

/**
 * Payouts domain routes (Phase 05 T08, D-Q). Admin routes run on getAdminDb()
 * (BYPASSRLS, D-C) behind requireAdmin (mounted in server.ts). Finder route runs on
 * getDb() + tx-scoped setTenantContext (D-D). The admin payouts UI is Phase 06.
 */
export const payoutsRouter = new Hono();
export const payoutsAdminRouter = new Hono();

function mapError(message: string): { status: 404 | 422; body: { error: string } } | null {
  switch (message) {
    case 'finder_payout_details_missing':
    case 'commissions_not_locked':
      return { status: 422, body: { error: message } };
    case 'finder_not_found':
    case 'payout_not_found':
      return { status: 404, body: { error: message } };
    default:
      return null;
  }
}

// ── Finder route (getDb() + setTenantContext, D-D) ───────────────────────────
payoutsRouter.get('/', async (c) => {
  const orgId = c.get('orgId');
  const clerkUserId = c.get('userId');
  try {
    const rows = await getDb().transaction(async (tx) => {
      await setTenantContext(tx as never, orgId);
      const finderId = await resolveFinderId(tx, clerkUserId);
      return tx.select().from(payouts).where(eq(payouts.finderId, finderId));
    });
    return c.json({ payouts: rows });
  } catch (err) {
    if (err instanceof Error && err.message === 'finder_not_found') {
      return c.json({ error: 'finder_not_found' }, 403);
    }
    throw err;
  }
});

// ── Admin routes (getAdminDb() BYPASSRLS, D-C; requireAdmin gate in server.ts) ─
payoutsAdminRouter.get('/', async (c) => {
  const finderId = c.req.query('finderId');
  const rows = await getPayoutsAdmin(getAdminDb(), finderId);
  return c.json({ payouts: rows });
});

payoutsAdminRouter.post('/', async (c) => {
  const parsed = CreatePayoutSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: 'validation_error', issues: parsed.error.flatten() }, 400);
  }
  try {
    const payout = await createPayoutBatch(
      getAdminDb(),
      parsed.data.finderId,
      parsed.data.commissionIds,
      c.get('userId'),
    );
    return c.json({ payout }, 201);
  } catch (err) {
    const mapped = mapError(err instanceof Error ? err.message : '');
    if (mapped) return c.json(mapped.body, mapped.status);
    throw err;
  }
});

payoutsAdminRouter.post('/:payoutId/mark-paid', async (c) => {
  const payoutId = c.req.param('payoutId');
  const parsed = MarkPaidSchema.safeParse({
    payoutId,
    ...(await c.req.json().catch(() => ({}))),
  });
  if (!parsed.success) {
    return c.json({ error: 'validation_error', issues: parsed.error.flatten() }, 400);
  }
  try {
    const payout = await markPayoutPaid(getAdminDb(), payoutId, c.get('userId'), parsed.data.note);
    return c.json({ payout });
  } catch (err) {
    const mapped = mapError(err instanceof Error ? err.message : '');
    if (mapped) return c.json(mapped.body, mapped.status);
    throw err;
  }
});
