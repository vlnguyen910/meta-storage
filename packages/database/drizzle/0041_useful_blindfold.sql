CREATE TYPE "public"."lifecycle_notification_event" AS ENUM('PAYMENT_CONFIRMED', 'BOOKING_CONFIRMED', 'UPCOMING_EXPIRY', 'RENTAL_OVERDUE', 'ABANDONED_REVIEW', 'RETURN_SCHEDULED', 'RETURN_CHANGED', 'RETURN_INSPECTION', 'RETURN_SETTLED', 'RETURN_REFUND', 'RETURN_TIME_CHANGED');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('PENDING', 'PROCESSING', 'SENT', 'REVIEW_REQUIRED', 'SUPPRESSED');--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_key" text NOT NULL,
	"recipient_key" text NOT NULL,
	"event_type" "lifecycle_notification_event" NOT NULL,
	"booking_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"recipient_user_id" uuid,
	"recipient_role" text NOT NULL,
	"recipient_email" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "notification_delivery_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_attempt_at" timestamp with time zone,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"provider_message_id" text,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "abandoned_review_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_outbox_event_recipient_idx" ON "notification_outbox" USING btree ("event_key","recipient_key");--> statement-breakpoint
CREATE INDEX "notification_outbox_dispatch_idx" ON "notification_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notification_outbox_inbox_idx" ON "notification_outbox" USING btree ("recipient_user_id","occurred_at");