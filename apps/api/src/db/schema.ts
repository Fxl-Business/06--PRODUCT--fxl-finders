/**
 * Drizzle schema — intentionally empty in the template.
 *
 * Add your tables here, then:
 *   pnpm db:generate     # creates migration in ./drizzle/
 *   pnpm db:migrate      # applies it to DATABASE_URL
 *
 * Every table MUST have:
 *   - org_id text NOT NULL (multi-tenancy key)
 *   - id text PRIMARY KEY (cuid2 or similar)
 *   - created_at timestamptz NOT NULL DEFAULT now()
 *
 * Example:
 *
 * import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
 *
 * export const items = pgTable('items', {
 *   id: text('id').primaryKey(),
 *   orgId: text('org_id').notNull(),
 *   name: text('name').notNull(),
 *   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
 * });
 */

export {};
