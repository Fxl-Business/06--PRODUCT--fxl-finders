-- ============================================================================
-- Single project role RLS context repair.
--
-- The standard FXL database bootstrap creates one login role that owns the
-- database and runs application migrations. Tenant tables still need forced RLS
-- because table owners otherwise bypass policies. Admin and webhook paths use an
-- application-controlled session setting on the admin DB handle:
--
--   app.fxl_admin = true
--
-- This migration intentionally does not create, alter, or grant cluster roles.
-- It also repairs databases that already applied older role-targeted policies.
-- ============================================================================

-- ── Phase 01 tenant tables ──────────────────────────────────────────────────
ALTER TABLE finders ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE finders FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS finders_tenant_isolation ON finders;--> statement-breakpoint
CREATE POLICY finders_tenant_isolation ON finders
  AS PERMISSIVE FOR ALL
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
DROP POLICY IF EXISTS finders_admin_context ON finders;--> statement-breakpoint
CREATE POLICY finders_admin_context ON finders
  AS PERMISSIVE FOR ALL
  USING (current_setting('app.fxl_admin', true) = 'true')
  WITH CHECK (current_setting('app.fxl_admin', true) = 'true');--> statement-breakpoint

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE leads FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS leads_tenant_isolation ON leads;--> statement-breakpoint
CREATE POLICY leads_tenant_isolation ON leads
  AS PERMISSIVE FOR ALL
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
DROP POLICY IF EXISTS leads_admin_context ON leads;--> statement-breakpoint
CREATE POLICY leads_admin_context ON leads
  AS PERMISSIVE FOR ALL
  USING (current_setting('app.fxl_admin', true) = 'true')
  WITH CHECK (current_setting('app.fxl_admin', true) = 'true');--> statement-breakpoint
DROP POLICY IF EXISTS leads_insert_webhook ON leads;--> statement-breakpoint
CREATE POLICY leads_insert_webhook ON leads
  AS PERMISSIVE FOR INSERT
  WITH CHECK (true);--> statement-breakpoint

-- ── Phase 04 tenant tables ──────────────────────────────────────────────────
ALTER TABLE referral_links ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE referral_links FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS referral_links_tenant_isolation ON referral_links;--> statement-breakpoint
CREATE POLICY referral_links_tenant_isolation ON referral_links
  AS PERMISSIVE FOR ALL
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
DROP POLICY IF EXISTS referral_links_admin_context ON referral_links;--> statement-breakpoint
CREATE POLICY referral_links_admin_context ON referral_links
  AS PERMISSIVE FOR ALL
  USING (current_setting('app.fxl_admin', true) = 'true')
  WITH CHECK (current_setting('app.fxl_admin', true) = 'true');--> statement-breakpoint
DROP POLICY IF EXISTS referral_links_public_lookup ON referral_links;--> statement-breakpoint
CREATE POLICY referral_links_public_lookup ON referral_links
  AS PERMISSIVE FOR SELECT
  USING (true);--> statement-breakpoint

ALTER TABLE clicks ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE clicks FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS clicks_insert_public ON clicks;--> statement-breakpoint
CREATE POLICY clicks_insert_public ON clicks
  AS PERMISSIVE FOR INSERT
  WITH CHECK (true);--> statement-breakpoint
DROP POLICY IF EXISTS clicks_select_tenant ON clicks;--> statement-breakpoint
CREATE POLICY clicks_select_tenant ON clicks
  AS PERMISSIVE FOR SELECT
  USING (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
DROP POLICY IF EXISTS clicks_admin_context ON clicks;--> statement-breakpoint
CREATE POLICY clicks_admin_context ON clicks
  AS PERMISSIVE FOR ALL
  USING (current_setting('app.fxl_admin', true) = 'true')
  WITH CHECK (current_setting('app.fxl_admin', true) = 'true');--> statement-breakpoint

-- ── Phase 05 tenant tables ──────────────────────────────────────────────────
ALTER TABLE conversions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE conversions FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS conversions_insert_webhook ON conversions;--> statement-breakpoint
CREATE POLICY conversions_insert_webhook ON conversions
  AS PERMISSIVE FOR INSERT
  WITH CHECK (true);--> statement-breakpoint
DROP POLICY IF EXISTS conversions_select_tenant ON conversions;--> statement-breakpoint
CREATE POLICY conversions_select_tenant ON conversions
  AS PERMISSIVE FOR SELECT
  USING (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
DROP POLICY IF EXISTS conversions_admin_context ON conversions;--> statement-breakpoint
CREATE POLICY conversions_admin_context ON conversions
  AS PERMISSIVE FOR ALL
  USING (current_setting('app.fxl_admin', true) = 'true')
  WITH CHECK (current_setting('app.fxl_admin', true) = 'true');--> statement-breakpoint

ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE commissions FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS commissions_insert_webhook ON commissions;--> statement-breakpoint
CREATE POLICY commissions_insert_webhook ON commissions
  AS PERMISSIVE FOR INSERT
  WITH CHECK (true);--> statement-breakpoint
DROP POLICY IF EXISTS commissions_tenant ON commissions;--> statement-breakpoint
CREATE POLICY commissions_tenant ON commissions
  AS PERMISSIVE FOR SELECT
  USING (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
DROP POLICY IF EXISTS commissions_admin_context ON commissions;--> statement-breakpoint
CREATE POLICY commissions_admin_context ON commissions
  AS PERMISSIVE FOR ALL
  USING (current_setting('app.fxl_admin', true) = 'true')
  WITH CHECK (current_setting('app.fxl_admin', true) = 'true');--> statement-breakpoint

-- ── Sales ops tenant tables ─────────────────────────────────────────────────
ALTER TABLE sales_ops_clients ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sales_ops_clients FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sales_ops_clients_tenant_isolation ON sales_ops_clients;--> statement-breakpoint
CREATE POLICY sales_ops_clients_tenant_isolation ON sales_ops_clients
  AS PERMISSIVE FOR ALL
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
DROP POLICY IF EXISTS sales_ops_clients_admin_context ON sales_ops_clients;--> statement-breakpoint
CREATE POLICY sales_ops_clients_admin_context ON sales_ops_clients
  AS PERMISSIVE FOR ALL
  USING (current_setting('app.fxl_admin', true) = 'true')
  WITH CHECK (current_setting('app.fxl_admin', true) = 'true');--> statement-breakpoint

ALTER TABLE sales_ops_payables ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sales_ops_payables FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sales_ops_payables_tenant_isolation ON sales_ops_payables;--> statement-breakpoint
CREATE POLICY sales_ops_payables_tenant_isolation ON sales_ops_payables
  AS PERMISSIVE FOR ALL
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
DROP POLICY IF EXISTS sales_ops_payables_admin_context ON sales_ops_payables;--> statement-breakpoint
CREATE POLICY sales_ops_payables_admin_context ON sales_ops_payables
  AS PERMISSIVE FOR ALL
  USING (current_setting('app.fxl_admin', true) = 'true')
  WITH CHECK (current_setting('app.fxl_admin', true) = 'true');--> statement-breakpoint

ALTER TABLE sales_ops_people ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sales_ops_people FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sales_ops_people_tenant_isolation ON sales_ops_people;--> statement-breakpoint
CREATE POLICY sales_ops_people_tenant_isolation ON sales_ops_people
  AS PERMISSIVE FOR ALL
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
DROP POLICY IF EXISTS sales_ops_people_admin_context ON sales_ops_people;--> statement-breakpoint
CREATE POLICY sales_ops_people_admin_context ON sales_ops_people
  AS PERMISSIVE FOR ALL
  USING (current_setting('app.fxl_admin', true) = 'true')
  WITH CHECK (current_setting('app.fxl_admin', true) = 'true');--> statement-breakpoint

ALTER TABLE sales_ops_products ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sales_ops_products FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sales_ops_products_tenant_isolation ON sales_ops_products;--> statement-breakpoint
CREATE POLICY sales_ops_products_tenant_isolation ON sales_ops_products
  AS PERMISSIVE FOR ALL
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
DROP POLICY IF EXISTS sales_ops_products_admin_context ON sales_ops_products;--> statement-breakpoint
CREATE POLICY sales_ops_products_admin_context ON sales_ops_products
  AS PERMISSIVE FOR ALL
  USING (current_setting('app.fxl_admin', true) = 'true')
  WITH CHECK (current_setting('app.fxl_admin', true) = 'true');--> statement-breakpoint

ALTER TABLE sales_ops_receivables ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sales_ops_receivables FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sales_ops_receivables_tenant_isolation ON sales_ops_receivables;--> statement-breakpoint
CREATE POLICY sales_ops_receivables_tenant_isolation ON sales_ops_receivables
  AS PERMISSIVE FOR ALL
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
DROP POLICY IF EXISTS sales_ops_receivables_admin_context ON sales_ops_receivables;--> statement-breakpoint
CREATE POLICY sales_ops_receivables_admin_context ON sales_ops_receivables
  AS PERMISSIVE FOR ALL
  USING (current_setting('app.fxl_admin', true) = 'true')
  WITH CHECK (current_setting('app.fxl_admin', true) = 'true');--> statement-breakpoint

ALTER TABLE sales_ops_sale_items ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sales_ops_sale_items FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sales_ops_sale_items_tenant_isolation ON sales_ops_sale_items;--> statement-breakpoint
CREATE POLICY sales_ops_sale_items_tenant_isolation ON sales_ops_sale_items
  AS PERMISSIVE FOR ALL
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
DROP POLICY IF EXISTS sales_ops_sale_items_admin_context ON sales_ops_sale_items;--> statement-breakpoint
CREATE POLICY sales_ops_sale_items_admin_context ON sales_ops_sale_items
  AS PERMISSIVE FOR ALL
  USING (current_setting('app.fxl_admin', true) = 'true')
  WITH CHECK (current_setting('app.fxl_admin', true) = 'true');--> statement-breakpoint

ALTER TABLE sales_ops_sale_professionals ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sales_ops_sale_professionals FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sales_ops_sale_professionals_tenant_isolation ON sales_ops_sale_professionals;--> statement-breakpoint
CREATE POLICY sales_ops_sale_professionals_tenant_isolation ON sales_ops_sale_professionals
  AS PERMISSIVE FOR ALL
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
DROP POLICY IF EXISTS sales_ops_sale_professionals_admin_context ON sales_ops_sale_professionals;--> statement-breakpoint
CREATE POLICY sales_ops_sale_professionals_admin_context ON sales_ops_sale_professionals
  AS PERMISSIVE FOR ALL
  USING (current_setting('app.fxl_admin', true) = 'true')
  WITH CHECK (current_setting('app.fxl_admin', true) = 'true');--> statement-breakpoint

ALTER TABLE sales_ops_sales ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sales_ops_sales FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sales_ops_sales_tenant_isolation ON sales_ops_sales;--> statement-breakpoint
CREATE POLICY sales_ops_sales_tenant_isolation ON sales_ops_sales
  AS PERMISSIVE FOR ALL
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
DROP POLICY IF EXISTS sales_ops_sales_admin_context ON sales_ops_sales;--> statement-breakpoint
CREATE POLICY sales_ops_sales_admin_context ON sales_ops_sales
  AS PERMISSIVE FOR ALL
  USING (current_setting('app.fxl_admin', true) = 'true')
  WITH CHECK (current_setting('app.fxl_admin', true) = 'true');--> statement-breakpoint

ALTER TABLE sales_ops_settings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sales_ops_settings FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sales_ops_settings_tenant_isolation ON sales_ops_settings;--> statement-breakpoint
CREATE POLICY sales_ops_settings_tenant_isolation ON sales_ops_settings
  AS PERMISSIVE FOR ALL
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
DROP POLICY IF EXISTS sales_ops_settings_admin_context ON sales_ops_settings;--> statement-breakpoint
CREATE POLICY sales_ops_settings_admin_context ON sales_ops_settings
  AS PERMISSIVE FOR ALL
  USING (current_setting('app.fxl_admin', true) = 'true')
  WITH CHECK (current_setting('app.fxl_admin', true) = 'true');
