CREATE TABLE "sales_ops_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"contact" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sales_ops_payables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"sale_id" uuid NOT NULL,
	"beneficiary_name" text NOT NULL,
	"kind" text NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"amount_brl" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_ops_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"display_name" text NOT NULL,
	"contact_email" text,
	"status" text DEFAULT 'active' NOT NULL,
	"is_seller" boolean DEFAULT false NOT NULL,
	"is_finder" boolean DEFAULT false NOT NULL,
	"is_collaborator" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sales_ops_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'SaaS' NOT NULL,
	"code_suffix" text DEFAULT '0' NOT NULL,
	"open_price" boolean DEFAULT false NOT NULL,
	"setup_brl" integer DEFAULT 0 NOT NULL,
	"has_monthly" boolean DEFAULT false NOT NULL,
	"monthly_brl" integer DEFAULT 0 NOT NULL,
	"recurring_commission" boolean DEFAULT false NOT NULL,
	"has_finder_commission" boolean DEFAULT false NOT NULL,
	"seller_commission_type" text DEFAULT 'pct' NOT NULL,
	"seller_commission_value" numeric(10, 2) NOT NULL,
	"finder_commission_type" text DEFAULT 'pct' NOT NULL,
	"finder_commission_value" numeric(10, 2) NOT NULL,
	"modules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"providers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sales_ops_receivables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"sale_id" uuid NOT NULL,
	"label" text NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"amount_brl" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_ops_sale_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name_snapshot" text NOT NULL,
	"product_type_snapshot" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_brl" integer NOT NULL,
	"subtotal_brl" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_ops_sale_professionals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"sale_id" uuid NOT NULL,
	"person_id" uuid,
	"person_name_snapshot" text NOT NULL,
	"role" text NOT NULL,
	"cost_brl" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_ops_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"code" text NOT NULL,
	"client_id" uuid,
	"client_name_snapshot" text NOT NULL,
	"seller_person_id" uuid,
	"seller_name_snapshot" text NOT NULL,
	"finder_person_id" uuid,
	"finder_name_snapshot" text,
	"status" text DEFAULT 'forecast' NOT NULL,
	"payment_method" text NOT NULL,
	"condition" text NOT NULL,
	"installments" integer DEFAULT 1 NOT NULL,
	"base_date" timestamp with time zone NOT NULL,
	"notes" text,
	"total_brl" integer NOT NULL,
	"recurring_brl" integer DEFAULT 0 NOT NULL,
	"seller_commission_pct" numeric(5, 2) NOT NULL,
	"finder_commission_pct" numeric(5, 2) NOT NULL,
	"tax_pct" numeric(5, 2) NOT NULL,
	"other_costs_brl" integer DEFAULT 0 NOT NULL,
	"professional_costs_brl" integer DEFAULT 0 NOT NULL,
	"seller_commission_brl" integer DEFAULT 0 NOT NULL,
	"finder_commission_brl" integer DEFAULT 0 NOT NULL,
	"tax_brl" integer DEFAULT 0 NOT NULL,
	"net_margin_brl" integer DEFAULT 0 NOT NULL,
	"net_margin_pct" numeric(8, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sales_ops_settings" (
	"org_id" text PRIMARY KEY NOT NULL,
	"legal_name" text DEFAULT '' NOT NULL,
	"document" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"finance_email" text DEFAULT '' NOT NULL,
	"default_seller_commission_pct" numeric(5, 2) NOT NULL,
	"default_finder_commission_pct" numeric(5, 2) NOT NULL,
	"default_tax_pct" numeric(5, 2) NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"tax_regime" text DEFAULT 'Simples Nacional' NOT NULL,
	"period_closing_day" integer DEFAULT 1 NOT NULL,
	"table_density" text DEFAULT 'comfortable' NOT NULL,
	"date_format" text DEFAULT 'dd/mm/aaaa' NOT NULL,
	"language" text DEFAULT 'pt-BR' NOT NULL,
	"commission_on_recurring" boolean DEFAULT true NOT NULL,
	"seller_can_be_finder" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sales_ops_payables" ADD CONSTRAINT "sales_ops_payables_sale_id_sales_ops_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales_ops_sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_ops_receivables" ADD CONSTRAINT "sales_ops_receivables_sale_id_sales_ops_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales_ops_sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_ops_sale_items" ADD CONSTRAINT "sales_ops_sale_items_sale_id_sales_ops_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales_ops_sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_ops_sale_items" ADD CONSTRAINT "sales_ops_sale_items_product_id_sales_ops_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."sales_ops_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_ops_sale_professionals" ADD CONSTRAINT "sales_ops_sale_professionals_sale_id_sales_ops_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales_ops_sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_ops_sale_professionals" ADD CONSTRAINT "sales_ops_sale_professionals_person_id_sales_ops_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."sales_ops_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_ops_sales" ADD CONSTRAINT "sales_ops_sales_client_id_sales_ops_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."sales_ops_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_ops_sales" ADD CONSTRAINT "sales_ops_sales_seller_person_id_sales_ops_people_id_fk" FOREIGN KEY ("seller_person_id") REFERENCES "public"."sales_ops_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_ops_sales" ADD CONSTRAINT "sales_ops_sales_finder_person_id_sales_ops_people_id_fk" FOREIGN KEY ("finder_person_id") REFERENCES "public"."sales_ops_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_ops_clients_org_id_idx" ON "sales_ops_clients" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "sales_ops_payables_org_status_idx" ON "sales_ops_payables" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "sales_ops_payables_sale_id_idx" ON "sales_ops_payables" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sales_ops_people_org_id_idx" ON "sales_ops_people" USING btree ("org_id","display_name");--> statement-breakpoint
CREATE INDEX "sales_ops_products_org_id_idx" ON "sales_ops_products" USING btree ("org_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_ops_products_org_code_suffix_idx" ON "sales_ops_products" USING btree ("org_id","code_suffix");--> statement-breakpoint
CREATE INDEX "sales_ops_receivables_sale_id_idx" ON "sales_ops_receivables" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sales_ops_sale_items_sale_id_idx" ON "sales_ops_sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sales_ops_sale_professionals_sale_id_idx" ON "sales_ops_sale_professionals" USING btree ("sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_ops_sales_org_sequence_idx" ON "sales_ops_sales" USING btree ("org_id","sequence");--> statement-breakpoint
CREATE INDEX "sales_ops_sales_org_status_idx" ON "sales_ops_sales" USING btree ("org_id","status");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON sales_ops_clients TO fxl_sales_app;--> statement-breakpoint
GRANT SELECT, INSERT ON sales_ops_payables TO fxl_sales_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON sales_ops_people TO fxl_sales_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON sales_ops_products TO fxl_sales_app;--> statement-breakpoint
GRANT SELECT, INSERT ON sales_ops_receivables TO fxl_sales_app;--> statement-breakpoint
GRANT SELECT, INSERT ON sales_ops_sale_items TO fxl_sales_app;--> statement-breakpoint
GRANT SELECT, INSERT ON sales_ops_sale_professionals TO fxl_sales_app;--> statement-breakpoint
GRANT SELECT, INSERT ON sales_ops_sales TO fxl_sales_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON sales_ops_settings TO fxl_sales_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_ops_clients TO fxl_sales_admin;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_ops_payables TO fxl_sales_admin;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_ops_people TO fxl_sales_admin;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_ops_products TO fxl_sales_admin;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_ops_receivables TO fxl_sales_admin;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_ops_sale_items TO fxl_sales_admin;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_ops_sale_professionals TO fxl_sales_admin;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_ops_sales TO fxl_sales_admin;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_ops_settings TO fxl_sales_admin;--> statement-breakpoint
ALTER TABLE sales_ops_clients ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sales_ops_clients FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY sales_ops_clients_tenant_isolation ON sales_ops_clients
  AS PERMISSIVE FOR ALL TO fxl_sales_app
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
ALTER TABLE sales_ops_payables ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sales_ops_payables FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY sales_ops_payables_tenant_isolation ON sales_ops_payables
  AS PERMISSIVE FOR ALL TO fxl_sales_app
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
ALTER TABLE sales_ops_people ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sales_ops_people FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY sales_ops_people_tenant_isolation ON sales_ops_people
  AS PERMISSIVE FOR ALL TO fxl_sales_app
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
ALTER TABLE sales_ops_products ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sales_ops_products FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY sales_ops_products_tenant_isolation ON sales_ops_products
  AS PERMISSIVE FOR ALL TO fxl_sales_app
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
ALTER TABLE sales_ops_receivables ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sales_ops_receivables FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY sales_ops_receivables_tenant_isolation ON sales_ops_receivables
  AS PERMISSIVE FOR ALL TO fxl_sales_app
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
ALTER TABLE sales_ops_sale_items ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sales_ops_sale_items FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY sales_ops_sale_items_tenant_isolation ON sales_ops_sale_items
  AS PERMISSIVE FOR ALL TO fxl_sales_app
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
ALTER TABLE sales_ops_sale_professionals ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sales_ops_sale_professionals FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY sales_ops_sale_professionals_tenant_isolation ON sales_ops_sale_professionals
  AS PERMISSIVE FOR ALL TO fxl_sales_app
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
ALTER TABLE sales_ops_sales ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sales_ops_sales FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY sales_ops_sales_tenant_isolation ON sales_ops_sales
  AS PERMISSIVE FOR ALL TO fxl_sales_app
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));--> statement-breakpoint
ALTER TABLE sales_ops_settings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sales_ops_settings FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY sales_ops_settings_tenant_isolation ON sales_ops_settings
  AS PERMISSIVE FOR ALL TO fxl_sales_app
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));
