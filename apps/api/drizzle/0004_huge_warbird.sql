CREATE TABLE "commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversion_id" uuid NOT NULL,
	"org_id" text NOT NULL,
	"finder_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"basis_brl" integer NOT NULL,
	"rate_pct" numeric(5, 2) NOT NULL,
	"amount_brl" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"hold_until" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_user_id" text,
	"locked_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"paid_payout_id" uuid,
	"reversed_at" timestamp with time zone,
	"reversed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"external_order_id" text NOT NULL,
	"event_type" text DEFAULT 'sale' NOT NULL,
	"idempotency_key" text NOT NULL,
	"org_id" text NOT NULL,
	"link_id" uuid,
	"click_id" text,
	"finder_id" uuid NOT NULL,
	"seller_id" uuid,
	"app_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quoted_setup_brl" integer NOT NULL,
	"quoted_monthly_brl" integer NOT NULL,
	"realized_setup_brl" integer NOT NULL,
	"realized_monthly_brl" integer NOT NULL,
	"customer_email_hash" text,
	"customer_org_id" text,
	"hold_until" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "conversions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finder_id" uuid NOT NULL,
	"total_brl" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"csv_export_id" uuid,
	"exported_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"paid_by_user_id" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_conversion_id_conversions_id_fk" FOREIGN KEY ("conversion_id") REFERENCES "public"."conversions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_finder_id_finders_id_fk" FOREIGN KEY ("finder_id") REFERENCES "public"."finders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_link_id_referral_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."referral_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_finder_id_finders_id_fk" FOREIGN KEY ("finder_id") REFERENCES "public"."finders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_finder_id_finders_id_fk" FOREIGN KEY ("finder_id") REFERENCES "public"."finders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commissions_finder_id_status_idx" ON "commissions" USING btree ("finder_id","status");--> statement-breakpoint
CREATE INDEX "commissions_status_hold_until_idx" ON "commissions" USING btree ("status","hold_until");--> statement-breakpoint
CREATE UNIQUE INDEX "conversions_source_order_event_idx" ON "conversions" USING btree ("source","external_order_id","event_type");--> statement-breakpoint
CREATE INDEX "conversions_finder_id_created_at_idx" ON "conversions" USING btree ("finder_id","created_at");--> statement-breakpoint
CREATE INDEX "conversions_org_id_idx" ON "conversions" USING btree ("org_id");--> statement-breakpoint

-- ════════════════════════════════════════════════════════════════════════════
-- Phase 05 RLS / grants / circular FK - APPENDED INTO the journaled migration
-- (plan-brief D-F). NOT a standalone unjournaled .sql (the migrator skips those).
-- Runs as fxl_sales_owner / superuser. Runtime role: fxl_sales_app (no BYPASSRLS).
-- Admin/cross-tenant reads + state transitions use getAdminDb() BYPASSRLS (D-C).
-- ════════════════════════════════════════════════════════════════════════════

-- ── Circular FK: commissions.paid_payout_id -> payouts.id ────────────────────
-- (commissions is created before payouts, so the FK is added after both exist.)
ALTER TABLE commissions
  ADD CONSTRAINT commissions_paid_payout_id_payouts_id_fk
  FOREIGN KEY (paid_payout_id) REFERENCES payouts(id) ON DELETE SET NULL;--> statement-breakpoint

-- ── DESC index amendment (drizzle-kit index() builder emits ASC) ─────────────
-- Admin/finder conversion lists page by created_at DESC.
DROP INDEX IF EXISTS "conversions_finder_id_created_at_idx";--> statement-breakpoint
CREATE INDEX "conversions_finder_id_created_at_idx" ON "conversions" USING btree ("finder_id","created_at" DESC);--> statement-breakpoint

-- ── Phase 05 role grants ─────────────────────────────────────────────────────
-- App role (fxl_sales_app) - RLS-enforced, finder reads + webhook INSERT only:
GRANT SELECT, INSERT ON conversions TO fxl_sales_app;--> statement-breakpoint   -- no UPDATE (append-only for webhook path)
GRANT SELECT, INSERT ON commissions TO fxl_sales_app;--> statement-breakpoint   -- D-C: NO UPDATE - admin transitions run on getAdminDb() (BYPASSRLS)
GRANT SELECT ON payouts TO fxl_sales_app;--> statement-breakpoint                -- finder reads own payouts; INSERT/UPDATE via getAdminDb()
GRANT SELECT, INSERT ON audit_log TO fxl_sales_app;--> statement-breakpoint      -- append-only; re-assert (Phase 01 may have granted)

-- Admin role (fxl_sales_admin, BYPASSRLS - created in Phase 01 per D-C) - cross-tenant:
GRANT SELECT, INSERT, UPDATE ON conversions TO fxl_sales_admin;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON commissions TO fxl_sales_admin;--> statement-breakpoint  -- lock/reverse/promote transitions
GRANT SELECT, INSERT, UPDATE ON payouts TO fxl_sales_admin;--> statement-breakpoint        -- payout create + mark-paid
GRANT SELECT, INSERT ON audit_log TO fxl_sales_admin;--> statement-breakpoint               -- admin money-mutation audit rows (append-only)
-- D-C: ingestConversion runs on getAdminDb() (BYPASSRLS) and must SELECT the Phase 04
-- attribution tables (clicks, referral_links). BYPASSRLS bypasses RLS policies, NOT
-- table-level GRANTs - Phase 04 granted these only to fxl_sales_app, so the admin
-- role needs an explicit SELECT here for the webhook attribution lookup.
GRANT SELECT ON clicks TO fxl_sales_admin;--> statement-breakpoint
GRANT SELECT ON referral_links TO fxl_sales_admin;--> statement-breakpoint

-- ── conversions RLS (split-INSERT pattern, D10) ──────────────────────────────
ALTER TABLE conversions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE conversions FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- INSERT path: webhook handler (no JWT, no tenant context) → allow all inserts.
CREATE POLICY conversions_insert_webhook ON conversions
  AS PERMISSIVE FOR INSERT TO fxl_sales_app
  WITH CHECK (true);--> statement-breakpoint

-- SELECT path: finder reads own conversions. Admin reads bypass RLS via the
-- fxl_sales_admin (BYPASSRLS) connection / getAdminDb() (D-C), NOT a policy.
CREATE POLICY conversions_select_tenant ON conversions
  AS PERMISSIVE FOR SELECT TO fxl_sales_app
  USING (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint

-- ── commissions RLS (split-INSERT pattern, D10) ──────────────────────────────
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE commissions FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- INSERT path: commission creation runs inside the webhook handler (no JWT).
CREATE POLICY commissions_insert_webhook ON commissions
  AS PERMISSIVE FOR INSERT TO fxl_sales_app
  WITH CHECK (true);--> statement-breakpoint

-- SELECT path: finder reads own commissions. Admin state transitions (lock/reverse)
-- run on the fxl_sales_admin (BYPASSRLS) connection via getAdminDb() (D-C).
-- D-C (LOCKED): NO `commissions_update_admin ... USING(true)` policy. The app role
-- gets NO UPDATE policy/grant on commissions, so it cannot mutate them at all
-- (defence in depth - kills the prior cross-tenant write hole).
CREATE POLICY commissions_tenant ON commissions
  AS PERMISSIVE FOR SELECT TO fxl_sales_app
  USING (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint

-- ── leads (D-L: webhook-path INSERT) ─────────────────────────────────────────
-- ingestConversion INSERTs a leads PII row from the webhook path (no JWT, no
-- tenant context). Phase 01 ships a tenant-only ALL policy on leads, which would
-- block the webhook INSERT (WITH CHECK org_id = '' fails). Add a split-INSERT
-- policy mirroring conversions/commissions. SELECT stays tenant-scoped (Phase 01
-- ALL policy still applies for finder reads - do NOT widen visibility).
DROP POLICY IF EXISTS leads_insert_webhook ON leads;--> statement-breakpoint
CREATE POLICY leads_insert_webhook ON leads
  AS PERMISSIVE FOR INSERT TO fxl_sales_app
  WITH CHECK (true);--> statement-breakpoint
GRANT INSERT ON leads TO fxl_sales_app;--> statement-breakpoint  -- re-assert; needed for the D-L converted-lead row

-- ── payouts ──────────────────────────────────────────────────────────────────
-- NO RLS on payouts - admin-managed cross-tenant (same as apps, products,
-- commission_rules). Admin endpoints use getAdminDb() (BYPASSRLS, D-C). Finder
-- reads own payouts via explicit WHERE finder_id = $finderId on the app conn.
-- (No ENABLE ROW LEVEL SECURITY on payouts in v1.0.)
