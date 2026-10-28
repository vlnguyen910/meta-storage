DROP TABLE "return_requests" CASCADE;--> statement-breakpoint
DROP TABLE "return_settlements" CASCADE;--> statement-breakpoint
ALTER TABLE "rental_charge_adjustments" DROP COLUMN "settlement_id";--> statement-breakpoint
ALTER TABLE "rental_charge_refunds" DROP COLUMN "settlement_id";--> statement-breakpoint
DROP TYPE "public"."return_request_status";