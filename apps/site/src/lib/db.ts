import { drizzle } from 'drizzle-orm/postgres-js';
import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import postgres from 'postgres';

/**
 * Drizzle/postgres-js connection for the Next.js Node-runtime /r/[code] handler
 * (Phase 04, T06). apps/site has no DB access elsewhere — this is a new pattern.
 *
 * Connects over DATABASE_URL as the fxl_finders_app runtime role (RLS enforced).
 * The public code lookup succeeds WITHOUT a Clerk JWT / tenant context ONLY
 * because of the referral_links_public_lookup PERMISSIVE SELECT policy (D-E).
 * The clicks INSERT succeeds without tenant context via clicks_insert_public
 * (WITH CHECK true). DATABASE_URL is backend-only — NEVER VITE_-prefixed.
 *
 * A focused subset of the apps/api schema is declared here (only the columns the
 * redirect handler touches): referral_links + apps. The source of truth remains
 * apps/api/src/db/schema.ts; this is a read/insert-only projection.
 */

export const referralLinks = pgTable('referral_links', {
  id: uuid('id').primaryKey(),
  orgId: text('org_id').notNull(),
  code: text('code').notNull(),
  finderId: uuid('finder_id').notNull(),
  appId: uuid('app_id').notNull(),
  productId: uuid('product_id').notNull(),
  quotedSetupBrl: integer('quoted_setup_brl').notNull(),
  quotedMonthlyBrl: integer('quoted_monthly_brl').notNull(),
  signature: text('signature').notNull(),
  destinationUrl: text('destination_url').notNull(),
  status: text('status').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export const apps = pgTable('apps', {
  id: uuid('id').primaryKey(),
  webhookSigningSecret: text('webhook_signing_secret').notNull(),
  allowedRedirectHosts: text('allowed_redirect_hosts').array().notNull(),
});

export const clicks = pgTable('clicks', {
  id: uuid('id').primaryKey().defaultRandom(),
  clickId: text('click_id').notNull(),
  orgId: text('org_id').notNull(),
  linkId: uuid('link_id').notNull(),
  finderId: uuid('finder_id').notNull(),
  appId: uuid('app_id').notNull(),
  productId: uuid('product_id').notNull(),
  ipHash: text('ip_hash'),
  uaFamily: text('ua_family'),
  referer: text('referer'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  country: text('country'),
});

const schema = { referralLinks, apps, clicks };

let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL not configured for apps/site');
  }
  if (!_db) {
    _client = postgres(url, { max: 5 });
    _db = drizzle(_client, { schema });
  }
  return _db;
}
