CREATE TABLE "hub_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"encrypted_refresh_token" text NOT NULL,
	"account_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
