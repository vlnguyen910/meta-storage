CREATE TYPE "public"."pricing_change_operation" AS ENUM('DEPOSIT_POLICY', 'UNIT_TYPE_PRICE');--> statement-breakpoint
CREATE TABLE "pricing_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"operation" "pricing_change_operation" NOT NULL,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"changed_by" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_changes_version_unique" UNIQUE("version"),
	CONSTRAINT "pricing_changes_positive_version" CHECK ("pricing_changes"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "pricing_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"deposit_months" integer NOT NULL,
	"version" integer NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_settings_singleton" CHECK ("pricing_settings"."id" = 'default'),
	CONSTRAINT "pricing_settings_positive" CHECK ("pricing_settings"."deposit_months" > 0 AND "pricing_settings"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "pricing_changes" ADD CONSTRAINT "pricing_changes_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_settings" ADD CONSTRAINT "pricing_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;