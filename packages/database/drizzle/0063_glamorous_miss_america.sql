ALTER TABLE "booking_contract_audit" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "booking_contracts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "booking_contract_audit" CASCADE;--> statement-breakpoint
DROP TABLE "booking_contracts" CASCADE;--> statement-breakpoint
ALTER TABLE "handover_inspections" DROP CONSTRAINT "handover_inspections_contract_id_booking_contracts_id_fk";
--> statement-breakpoint
ALTER TABLE "handover_inspections" DROP COLUMN "contract_id";--> statement-breakpoint
DROP TYPE "public"."booking_contract_status";