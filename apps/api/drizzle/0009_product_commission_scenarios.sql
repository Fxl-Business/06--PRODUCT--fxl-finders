ALTER TABLE "sales_ops_products" ADD COLUMN "seller_with_finder_commission_type" text;--> statement-breakpoint
ALTER TABLE "sales_ops_products" ADD COLUMN "seller_with_finder_commission_value" numeric(10, 2);--> statement-breakpoint
SELECT set_config('app.fxl_admin', 'true', true);--> statement-breakpoint
UPDATE "sales_ops_products"
SET "seller_with_finder_commission_type" = "seller_commission_type",
    "seller_with_finder_commission_value" = "seller_commission_value";--> statement-breakpoint
ALTER TABLE "sales_ops_products" ALTER COLUMN "seller_with_finder_commission_type" SET DEFAULT 'pct';--> statement-breakpoint
ALTER TABLE "sales_ops_products" ALTER COLUMN "seller_with_finder_commission_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_ops_products" ALTER COLUMN "seller_with_finder_commission_value" SET NOT NULL;
