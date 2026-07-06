CREATE TABLE "clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"click_id" text NOT NULL,
	"org_id" text NOT NULL,
	"link_id" uuid NOT NULL,
	"finder_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"ip_hash" text,
	"ua_family" text,
	"referer" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clicks_click_id_unique" UNIQUE("click_id")
);
--> statement-breakpoint
CREATE TABLE "referral_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"code" text NOT NULL,
	"finder_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quoted_setup_brl" integer NOT NULL,
	"quoted_monthly_brl" integer NOT NULL,
	"signature" text NOT NULL,
	"destination_url" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "referral_links_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_link_id_referral_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."referral_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_links" ADD CONSTRAINT "referral_links_finder_id_finders_id_fk" FOREIGN KEY ("finder_id") REFERENCES "public"."finders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_links" ADD CONSTRAINT "referral_links_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_links" ADD CONSTRAINT "referral_links_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clicks_click_id_idx" ON "clicks" USING btree ("click_id");--> statement-breakpoint
CREATE INDEX "clicks_link_id_created_at_idx" ON "clicks" USING btree ("link_id","created_at");--> statement-breakpoint
CREATE INDEX "clicks_finder_id_created_at_idx" ON "clicks" USING btree ("finder_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_links_code_idx" ON "referral_links" USING btree ("code");--> statement-breakpoint
CREATE INDEX "referral_links_finder_id_idx" ON "referral_links" USING btree ("finder_id","created_at");--> statement-breakpoint

-- ════════════════════════════════════════════════════════════════════════════
-- Phase 04 RLS / grants / FK-promotion - APPENDED INTO the journaled migration
-- (plan-brief D-F). NOT a standalone unjournaled .sql (the migrator skips those).
-- Runs as fxl_sales_owner. Runtime role: fxl_sales_app (no BYPASSRLS).
-- Admin/cross-tenant reads use getAdminDb() BYPASSRLS conn (plan-brief D-C).
-- ════════════════════════════════════════════════════════════════════════════

-- ── DESC index amendment (drizzle-kit index() builder emits ASC) ─────────────
-- clicks dashboards page by created_at DESC; replace the ASC composite indexes.
DROP INDEX IF EXISTS "clicks_link_id_created_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "clicks_finder_id_created_at_idx";--> statement-breakpoint
CREATE INDEX "clicks_link_id_created_at_idx" ON "clicks" USING btree ("link_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "clicks_finder_id_created_at_idx" ON "clicks" USING btree ("finder_id","created_at" DESC);--> statement-breakpoint

-- ── Phase 04 role grants ─────────────────────────────────────────────────────
-- referral_links: finder-scoped; INSERT by API, SELECT/UPDATE by fxl_sales_app
GRANT SELECT, INSERT, UPDATE ON referral_links TO fxl_sales_app;--> statement-breakpoint
-- clicks: append-only; INSERT by /r/:code (public path, app DB role), SELECT by finder
GRANT SELECT, INSERT ON clicks TO fxl_sales_app;--> statement-breakpoint
-- (no UPDATE, no DELETE on clicks - append-only)

-- ── Promote Phase 01 leads soft FKs to hard constraints ──────────────────────
-- ON DELETE SET NULL so revoking a link / (never) deleting a click does not
-- cascade-delete lead PII rows.
ALTER TABLE leads
  ADD CONSTRAINT leads_link_id_fk FOREIGN KEY (link_id) REFERENCES referral_links(id) ON DELETE SET NULL,
  ADD CONSTRAINT leads_click_id_fk FOREIGN KEY (click_id) REFERENCES clicks(click_id) ON DELETE SET NULL;--> statement-breakpoint

-- ── referral_links RLS (D-E split SELECT) ────────────────────────────────────
ALTER TABLE referral_links ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE referral_links FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- Tenant isolation for finder dashboard reads + all mutations.
CREATE POLICY referral_links_tenant_isolation ON referral_links
  AS PERMISSIVE FOR ALL TO fxl_sales_app
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint

-- Plan-brief D-E: public lookup for /r/[code] (NO JWT, NO tenant context).
-- The 10-char code is the bearer secret. SELECT-only + PERMISSIVE (OR-combines
-- with the tenant policy). Without it, /r/[code] returns 410 for every valid code.
CREATE POLICY referral_links_public_lookup ON referral_links
  AS PERMISSIVE FOR SELECT TO fxl_sales_app
  USING (true);--> statement-breakpoint

-- ── clicks RLS (split: public INSERT + tenant SELECT) ────────────────────────
ALTER TABLE clicks ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE clicks FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- Allow INSERT without tenant context (public /r/:code handler inserts directly).
CREATE POLICY clicks_insert_public ON clicks
  AS PERMISSIVE FOR INSERT TO fxl_sales_app
  WITH CHECK (true);--> statement-breakpoint

-- Allow SELECT only for own org (finder dashboard).
CREATE POLICY clicks_select_tenant ON clicks
  AS PERMISSIVE FOR SELECT TO fxl_sales_app
  USING (org_id = current_setting('app.current_org_id', true));
-- No UPDATE/DELETE policy (append-only; fxl_sales_app has no UPDATE/DELETE grant).
