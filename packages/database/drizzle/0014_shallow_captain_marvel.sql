CREATE TYPE "public"."booking_email_status" AS ENUM('PENDING', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TABLE "booking_confirmation_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"recipient_email" varchar(320) NOT NULL,
	"template" varchar(80) NOT NULL,
	"status" "booking_email_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"provider_message_id" varchar(255),
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" RENAME COLUMN "qr_token" TO "qr_token_hash";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_qrToken_unique";--> statement-breakpoint
ALTER TABLE "booking_confirmation_emails" ADD CONSTRAINT "booking_confirmation_emails_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_confirmation_email_booking_template_idx" ON "booking_confirmation_emails" USING btree ("booking_id","template");--> statement-breakpoint
CREATE INDEX "booking_confirmation_email_status_idx" ON "booking_confirmation_emails" USING btree ("status");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_qrTokenHash_unique" UNIQUE("qr_token_hash");