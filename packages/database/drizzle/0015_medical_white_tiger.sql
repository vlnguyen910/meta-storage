ALTER TABLE "appointments" ALTER COLUMN "customer_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" DROP COLUMN "contact_phone";