ALTER TABLE "payments" ALTER COLUMN "draft_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "contact_name" varchar(150);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "contact_email" varchar(320);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "contact_phone" varchar(32);--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_contact_complete" CHECK (("bookings"."contact_name" IS NULL AND "bookings"."contact_email" IS NULL AND "bookings"."contact_phone" IS NULL)
        OR ("bookings"."contact_name" IS NOT NULL AND "bookings"."contact_email" IS NOT NULL AND "bookings"."contact_phone" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_checkout_reference" CHECK ("payments"."booking_id" IS NOT NULL OR "payments"."draft_id" IS NOT NULL);