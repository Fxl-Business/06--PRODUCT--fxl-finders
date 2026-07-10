import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { getAdminDb } from '../../../db/client.js';
import { apps, auditLog } from '../../../db/schema.js';
import {
  generatePublishableKey,
  generateSecretKeyPair,
  generateWebhookSigningSecret,
} from './keys.js';

/**
 * Admin apps service (Phase 02, T04).
 *
 * `apps` is a global admin-managed table with NO RLS. This service runs on the
 * admin DB connection and NEVER calls setTenantContext.
 */

type Db = ReturnType<typeof getAdminDb>;
type AppRow = typeof apps.$inferSelect;

/**
 * Client-safe projection of an app row. NEVER exposes `secretKeyHash` or
 * `webhookSigningSecret` - the webhook signing secret is a live HMAC credential
 * and the hash is sensitive. Only `secretKeyPrefix` (the masked display form) is
 * sent. List/get responses use this; plaintext secrets are returned ONLY by
 * createApp / rotate* (the reveal-once paths).
 */
export type PublicAppRow = Omit<AppRow, 'secretKeyHash' | 'webhookSigningSecret'>;

function toPublicApp(row: AppRow): PublicAppRow {
  const { secretKeyHash: _h, webhookSigningSecret: _w, ...rest } = row;
  void _h;
  void _w;
  return rest;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bare-hostname rule (WARN/LOCKED). NOT z.string().url() - that would accept
 * `https://host/path?x=1`, defeating the redirect-host security check. Phase 04
 * compares the redirect target host against this list by EXACT host equality.
 */
export const hostnameSchema = z
  .string()
  .min(1)
  .max(253)
  .regex(/^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i, {
    message: 'must be a bare hostname (e.g. checkout.fxlfinanciero.com.br), not a URL',
  });

export const CreateAppSchema = z.object({
  slug: z.string().min(1).max(64),
  name: z.string().min(1),
  allowedRedirectHosts: z.array(hostnameSchema).min(1),
  attributionWindowDays: z.number().int().positive().default(30),
  commissionHoldDays: z.number().int().positive().default(30),
});

// slug is immutable - omitted entirely so it can never flow through an update (D-R NIT).
export const UpdateAppSchema = CreateAppSchema.omit({ slug: true }).partial();

export const AppIdSchema = z.object({ id: z.string().uuid() });

export const AppStatusSchema = z.object({ status: z.enum(['active', 'disabled']) });

export type CreateAppInput = z.infer<typeof CreateAppSchema>;
export type UpdateAppInput = z.infer<typeof UpdateAppSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Audit helper (Phase 02 plain rows; Phase 05 wraps with hash-chain - D-R)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Writes a PLAIN audit_log row for a security-sensitive admin app mutation.
 * actor_user_id MUST come from the verified JWT (c.get('userId')), never body.
 *
 * TODO(Phase 05): route through writeAuditEntry hash-chain (D-R). For now we set
 * prev_hash/entry_hash to placeholder values so the NOT NULL columns are
 * satisfied; Phase 05 backfills the real tamper-evident chain.
 */
async function writeAppAudit(
  db: Db,
  params: {
    actorUserId: string;
    action: string;
    entityId: string;
    after?: unknown;
  },
): Promise<void> {
  const PLACEHOLDER_HASH = '0'.repeat(64);
  await db.insert(auditLog).values({
    actorUserId: params.actorUserId,
    action: params.action,
    entityType: 'app',
    entityId: params.entityId,
    afterJsonb: params.after ?? null,
    prevHash: PLACEHOLDER_HASH,
    entryHash: PLACEHOLDER_HASH,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Service functions - all run on the admin connection, NO RLS / NO
// setTenantContext (admin-managed table)
// ─────────────────────────────────────────────────────────────────────────────

export async function listApps(db: Db): Promise<PublicAppRow[]> {
  const rows = await db.select().from(apps).orderBy(desc(apps.createdAt));
  return rows.map(toPublicApp);
}

export async function getApp(db: Db, id: string): Promise<PublicAppRow | undefined> {
  const rows = await db.select().from(apps).where(eq(apps.id, id)).limit(1);
  return rows[0] ? toPublicApp(rows[0]) : undefined;
}

export async function createApp(
  db: Db,
  data: CreateAppInput,
  createdByUserId: string,
): Promise<{
  app: PublicAppRow;
  secretKeyPlaintext: string;
  webhookSigningSecretPlaintext: string;
}> {
  const publishableKey = generatePublishableKey();
  const secret = generateSecretKeyPair();
  const webhookSigningSecret = generateWebhookSigningSecret();

  const inserted = await db
    .insert(apps)
    .values({
      slug: data.slug,
      name: data.name,
      publishableKey,
      secretKeyHash: secret.hash,
      secretKeyPrefix: secret.prefix,
      webhookSigningSecret,
      allowedRedirectHosts: data.allowedRedirectHosts,
      attributionWindowDays: data.attributionWindowDays,
      commissionHoldDays: data.commissionHoldDays,
      status: 'active',
      createdByUserId,
    })
    .returning();
  // INSERT ... RETURNING always yields exactly one row.
  const app = inserted[0]!;

  await writeAppAudit(db, {
    actorUserId: createdByUserId,
    action: 'app.created',
    entityId: app.id,
    after: { slug: app.slug, name: app.name },
  });

  return {
    app: toPublicApp(app),
    secretKeyPlaintext: secret.plaintext,
    webhookSigningSecretPlaintext: webhookSigningSecret,
  };
}

export async function updateApp(
  db: Db,
  id: string,
  data: UpdateAppInput,
  actorUserId: string,
): Promise<PublicAppRow | undefined> {
  // data comes from UpdateAppSchema which OMITS slug - slug can never be mutated.
  const [app] = await db
    .update(apps)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(apps.id, id))
    .returning();
  if (!app) return undefined;
  await writeAppAudit(db, {
    actorUserId,
    action: 'app.updated',
    entityId: id,
    after: data,
  });
  return toPublicApp(app);
}

export async function rotateSecretKey(
  db: Db,
  id: string,
  actorUserId: string,
): Promise<{ secretKeyPlaintext: string } | undefined> {
  const secret = generateSecretKeyPair();
  const [app] = await db
    .update(apps)
    .set({ secretKeyHash: secret.hash, secretKeyPrefix: secret.prefix, updatedAt: new Date() })
    .where(eq(apps.id, id))
    .returning();
  if (!app) return undefined;
  await writeAppAudit(db, {
    actorUserId,
    action: 'app.rotate_secret_key',
    entityId: id,
  });
  return { secretKeyPlaintext: secret.plaintext };
}

export async function rotateWebhookSigningSecret(
  db: Db,
  id: string,
  actorUserId: string,
): Promise<{ webhookSigningSecretPlaintext: string } | undefined> {
  const webhookSigningSecret = generateWebhookSigningSecret();
  const [app] = await db
    .update(apps)
    .set({ webhookSigningSecret, updatedAt: new Date() })
    .where(eq(apps.id, id))
    .returning();
  if (!app) return undefined;
  await writeAppAudit(db, {
    actorUserId,
    action: 'app.rotate_webhook_secret',
    entityId: id,
  });
  return { webhookSigningSecretPlaintext: webhookSigningSecret };
}

export async function setAppStatus(
  db: Db,
  id: string,
  status: 'active' | 'disabled',
  actorUserId: string,
): Promise<PublicAppRow | undefined> {
  const [app] = await db
    .update(apps)
    .set({ status, updatedAt: new Date() })
    .where(eq(apps.id, id))
    .returning();
  if (!app) return undefined;
  await writeAppAudit(db, {
    actorUserId,
    action: 'app.set_status',
    entityId: id,
    after: { status },
  });
  return toPublicApp(app);
}
