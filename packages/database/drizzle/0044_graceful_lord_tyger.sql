CREATE TABLE "system_setting_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"actor_id" uuid NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_version_valid" CHECK ("system_settings"."version" >= 0),
	CONSTRAINT "system_settings_value_scalar" CHECK (jsonb_typeof("system_settings"."value") in ('number', 'string', 'boolean')),
	CONSTRAINT "system_settings_known_integer" CHECK ("system_settings"."key" not in ('EXPIRY_REMINDER_DAYS', 'ABANDONED_REVIEW_DAYS', 'OVERDUE_FEE_RATE', 'DEPOSIT_MONTHS') or (jsonb_typeof("system_settings"."value") = 'number' and ("system_settings"."value" #>> '{}')::numeric between 0 and 2147483647 and trunc(("system_settings"."value" #>> '{}')::numeric) = ("system_settings"."value" #>> '{}')::numeric)),
	CONSTRAINT "system_settings_overdue_rate" CHECK ("system_settings"."key" <> 'OVERDUE_FEE_RATE' or ("system_settings"."value" #>> '{}')::numeric between 0 and 100),
	CONSTRAINT "system_settings_deposit_policy" CHECK ("system_settings"."key" <> 'DEPOSIT_MONTHS' or (("system_settings"."value" #>> '{}')::numeric > 0 and "system_settings"."version" > 0))
);
--> statement-breakpoint
DROP TABLE "pricing_settings" CASCADE;--> statement-breakpoint
DROP TABLE "rental_lifecycle_settings" CASCADE;--> statement-breakpoint
DROP TABLE "return_overdue_settings" CASCADE;--> statement-breakpoint
ALTER TABLE "system_setting_changes" ADD CONSTRAINT "system_setting_changes_key_system_settings_key_fk" FOREIGN KEY ("key") REFERENCES "public"."system_settings"("key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_setting_changes" ADD CONSTRAINT "system_setting_changes_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "system_setting_changes_key_idx" ON "system_setting_changes" USING btree ("key","created_at");