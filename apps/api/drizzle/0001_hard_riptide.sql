ALTER TABLE "finders" ALTER COLUMN "account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "finders" ALTER COLUMN "workspace_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "finders" ADD COLUMN "lgpd_consent_essential" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "finders" ADD COLUMN "lgpd_consent_marketing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "finders" ADD COLUMN "lgpd_consent_version" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "finders" ADD COLUMN "lgpd_consented_at" timestamp with time zone;