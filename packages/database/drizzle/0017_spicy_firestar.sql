CREATE TYPE "public"."payment_provider_event_status" AS ENUM('PROCESSED', 'IGNORED', 'FAILED');--> statement-breakpoint
CREATE TABLE "payment_provider_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_event_id" varchar(128) NOT NULL,
	"payment_id" uuid,
	"payment_code" varchar(32) NOT NULL,
	"amount" integer NOT NULL,
	"transfer_type" varchar(16) NOT NULL,
	"reference_code" varchar(128),
	"status" "payment_provider_event_status" NOT NULL,
	"payload_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "assigned_staff_id" uuid;--> statement-breakpoint
ALTER TABLE "storage_units" ADD COLUMN "floor" varchar(50);--> statement-breakpoint
ALTER TABLE "storage_units" ADD COLUMN "location_description" varchar(255);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payment_code" varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_provider_events" ADD CONSTRAINT "payment_provider_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_events_provider_event_idx" ON "payment_provider_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "payment_provider_events_payment_idx" ON "payment_provider_events" USING btree ("payment_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_assigned_staff_idx" ON "bookings" USING btree ("assigned_staff_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_paymentCode_unique" UNIQUE("payment_code");