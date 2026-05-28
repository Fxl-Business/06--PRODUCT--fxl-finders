import { and, eq, isNull, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { Webhook } from 'svix';
import { env } from '../../env.js';
import { getAdminDb } from '../../db/client.js';
import { sellers } from '../../db/schema.js';

/**
 * Clerk `user.created` webhook (Phase 05 T07, D-I/D5).
 *
 * Backfills sellers.clerk_user_id (left NULL at Phase 03 invite time) by matching
 * the new Clerk user's email to a seller's contact_email. svix verifies the webhook
 * signature against CLERK_WEBHOOK_SIGNING_SECRET BEFORE any body parse. The backfill
 * is a cross-tenant admin write → getAdminDb() (BYPASSRLS, D-C), NO setTenantContext.
 *
 * Any Clerk API call (none needed here) would use the clerkClient singleton from
 * apps/api/src/lib/clerk.ts (D-I) — never a bare @clerk/backend import.
 */
export const clerkWebhookRouter = new Hono();

type ClerkUserCreatedEvent = {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{ email_address?: string }>;
    first_name?: string | null;
    last_name?: string | null;
  };
};

clerkWebhookRouter.post('/', async (c) => {
  const payload = await c.req.text(); // raw body for svix
  const wh = new Webhook(env.CLERK_WEBHOOK_SIGNING_SECRET ?? '');

  let evt: ClerkUserCreatedEvent;
  try {
    evt = wh.verify(payload, {
      'svix-id': c.req.header('svix-id') ?? '',
      'svix-timestamp': c.req.header('svix-timestamp') ?? '',
      'svix-signature': c.req.header('svix-signature') ?? '',
    }) as ClerkUserCreatedEvent;
  } catch {
    return c.json({ error: 'invalid_signature' }, 400);
  }

  if (evt.type !== 'user.created') {
    return c.json({ status: 'ignored' }, 200);
  }

  const clerkUserId = evt.data.id;
  const email = evt.data.email_addresses?.[0]?.email_address;
  if (!email) {
    return c.json({ status: 'processed', updated: 0 }, 200);
  }

  // Backfill: match by contact_email where clerk_user_id is still unset (NULL or '').
  const updated = await getAdminDb()
    .update(sellers)
    .set({ clerkUserId, updatedAt: new Date() })
    .where(
      and(
        eq(sellers.contactEmail, email),
        or(isNull(sellers.clerkUserId), eq(sellers.clerkUserId, '')),
      ),
    )
    .returning({ id: sellers.id });

  console.log(`[clerk-webhook] user.created → backfilled ${updated.length} seller(s) for ${email}`);
  return c.json({ status: 'processed', updated: updated.length }, 200);
});
