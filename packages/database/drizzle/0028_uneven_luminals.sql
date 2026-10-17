ALTER TABLE "bookings" DROP CONSTRAINT "bookings_customer_after_draft";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_customer_id_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_customer_id_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "rentals" DROP CONSTRAINT "rentals_customer_id_customers_id_fk";
--> statement-breakpoint
DROP INDEX "bookings_customer_idx";--> statement-breakpoint
DROP INDEX "rentals_customer_idx";--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_user_idx" ON "bookings" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "customer_id";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "customer_id";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "customer_id";--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_contact_after_draft" CHECK ("bookings"."status" = 'DRAFT' OR ("bookings"."contact_name" IS NOT NULL AND "bookings"."contact_email" IS NOT NULL AND "bookings"."contact_phone" IS NOT NULL));