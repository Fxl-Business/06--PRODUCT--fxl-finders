CREATE TABLE "apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"publishable_key" text NOT NULL,
	"secret_key_hash" text NOT NULL,
	"secret_key_prefix" text NOT NULL,
	"webhook_signing_secret" text NOT NULL,
	"allowed_redirect_hosts" text[] NOT NULL,
	"attribution_window_days" integer DEFAULT 30 NOT NULL,
	"commission_hold_days" integer DEFAULT 30 NOT NULL,
	"status" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "apps_slug_unique" UNIQUE("slug"),
	CONSTRAINT "apps_publishable_key_unique" UNIQUE("publishable_key")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" text NOT NULL,
	"actor_org_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before_jsonb" jsonb,
	"after_jsonb" jsonb,
	"request_id" text,
	"prev_hash" text NOT NULL,
	"entry_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"setup_rate_pct" numeric(5, 2) NOT NULL,
	"recurring_rate_pct" numeric(5, 2) NOT NULL,
	"recurring_months" integer NOT NULL,
	"basis" text DEFAULT 'quoted_net' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "commission_rules_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
CREATE TABLE "finders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"account_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"status" text NOT NULL,
	"display_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"cpf" text,
	"phone" text,
	"pix_key" text,
	"pix_key_type" text,
	"payout_address" jsonb,
	"approved_at" timestamp with time zone,
	"approved_by_user_id" text,
	"suspended_at" timestamp with time zone,
	"suspended_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "finders_account_id_unique" UNIQUE("account_id"),
	CONSTRAINT "finders_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"click_id" text,
	"link_id" uuid,
	"customer_name" text,
	"customer_email" text,
	"customer_phone" text,
	"customer_cpf" text,
	"status" text NOT NULL,
	"anonymized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "price_bands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"component" text NOT NULL,
	"min_brl" integer NOT NULL,
	"list_brl" integer NOT NULL,
	"max_brl" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "price_bands_order_check" CHECK (min_brl <= list_brl AND list_brl <= max_brl)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"display_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "sellers_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"event_id" text NOT NULL,
	"body_hash" text NOT NULL,
	"signature_valid" boolean NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_bands" ADD CONSTRAINT "price_bands_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finders_org_id_idx" ON "finders" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "leads_org_id_idx" ON "leads" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "price_bands_product_component_idx" ON "price_bands" USING btree ("product_id","component");--> statement-breakpoint
CREATE UNIQUE INDEX "products_app_id_slug_idx" ON "products" USING btree ("app_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_source_event_id_idx" ON "webhook_events" USING btree ("source","event_id");--> statement-breakpoint
-- ============================================================================
-- RLS policies for tenant-scoped tables.
-- The standard FXL database bootstrap creates one database owner role and the
-- app runs migrations with that same DATABASE_URL. Do not create or grant
-- cluster roles in journaled migrations.
-- ============================================================================
-- ── finders ────────────────────────────────────────────────
ALTER TABLE finders ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE finders FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY finders_tenant_isolation ON finders
  AS PERMISSIVE
  FOR ALL
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
CREATE POLICY finders_admin_context ON finders
  AS PERMISSIVE
  FOR ALL
  USING (current_setting('app.fxl_admin', true) = 'true')
  WITH CHECK (current_setting('app.fxl_admin', true) = 'true');--> statement-breakpoint
-- ── leads ──────────────────────────────────────────────────
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE leads FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY leads_tenant_isolation ON leads
  AS PERMISSIVE
  FOR ALL
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
CREATE POLICY leads_admin_context ON leads
  AS PERMISSIVE
  FOR ALL
  USING (current_setting('app.fxl_admin', true) = 'true')
  WITH CHECK (current_setting('app.fxl_admin', true) = 'true');--> statement-breakpoint
-- Tables without tenant RLS:
--   sellers          - cross-org; admin role access only
--   apps             - global registry; admin-managed
--   products         - global; admin-managed
--   price_bands      - global; admin-managed
--   commission_rules - global; admin-managed
--   audit_log        - append-only; admin SELECT; system INSERT
--   webhook_events   - global; idempotency table
--
-- ── Tenant context helper (D-D) ────────────────────────────
-- Called by the service layer INSIDE each transaction:
--   SELECT set_config('app.current_org_id', $1, true);
-- The 3rd arg (true) makes it transaction-local (reset on COMMIT/ROLLBACK) - which
-- is why connection-pooled set_config is unsafe and it MUST be set per-transaction.
-- No DB function needed - setTenantContext(tx, orgId) (middleware/auth.ts) runs
-- this via Drizzle on the transaction handle.
SELECT 1;
