ALTER TABLE "booking_confirmation_emails" ADD COLUMN "payload" text;--> statement-breakpoint
ALTER TABLE "booking_confirmation_emails" ADD COLUMN "expires_at" timestamp with time zone;