CREATE TABLE "booking_access_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"action" text NOT NULL,
	"details" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_lifecycle_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" integer NOT NULL,
	"description" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_access_audit" ADD CONSTRAINT "booking_access_audit_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_lifecycle_settings" ADD CONSTRAINT "rental_lifecycle_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_access_audit_booking_idx" ON "booking_access_audit" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_access_audit_idempotency_idx" ON "booking_access_audit" USING btree ("booking_id","idempotency_key");