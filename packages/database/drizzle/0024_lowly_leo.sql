ALTER TABLE "bookings" ALTER COLUMN "customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'DRAFT';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "access_token_hash" varchar(128);--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "contact_name";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "contact_email";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "contact_phone";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "currency";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "paid_at";--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_valid_status" CHECK ("bookings"."status" IN ('DRAFT', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'CHECKED_IN'));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_after_draft" CHECK ("bookings"."status" = 'DRAFT' OR "bookings"."customer_id" IS NOT NULL);