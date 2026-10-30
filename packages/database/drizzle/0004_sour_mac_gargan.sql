CREATE TYPE "public"."payment_type" AS ENUM('COLLECTION', 'RETURN_REFUND');--> statement-breakpoint
CREATE TYPE "public"."rental_return_status" AS ENUM('PENDING', 'CONFIRMED', 'INSPECTING', 'FAILED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
ALTER TABLE "return_checklist_versions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "return_refunds" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "return_time_changes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "return_checklist_versions" CASCADE;--> statement-breakpoint
DROP TABLE "return_refunds" CASCADE;--> statement-breakpoint
DROP TABLE "return_time_changes" CASCADE;--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_source_reference";--> statement-breakpoint
ALTER TABLE "rental_charge_adjustments" DROP CONSTRAINT "rental_charge_adjustments_settlement_id_return_settlements_id_fk";
--> statement-breakpoint
ALTER TABLE "rental_charge_refunds" DROP CONSTRAINT "rental_charge_refunds_settlement_id_return_settlements_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "provider" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "payment_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "provider_payment_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "type" "payment_type" DEFAULT 'COLLECTION' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "rental_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "source_payment_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "deposit_refund_amount" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "rent_refund_amount" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "return_slot_id" uuid;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "return_date" date;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "return_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "return_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "return_timezone" text;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "return_status" "rental_return_status";--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "return_reason" text;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "return_manual_review_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "return_settlement" jsonb;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "return_settlement_approved_by" uuid;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "return_settlement_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "return_settlement_reason" text;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_source_payment_id_payments_id_fk" FOREIGN KEY ("source_payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_return_slot_id_check_in_slots_id_fk" FOREIGN KEY ("return_slot_id") REFERENCES "public"."check_in_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_return_settlement_approved_by_users_id_fk" FOREIGN KEY ("return_settlement_approved_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_refund_reference_idx" ON "payments" USING btree ("source_payment_id","refund_reference") WHERE "payments"."type" = 'RETURN_REFUND';--> statement-breakpoint
CREATE INDEX "payments_rental_idx" ON "payments" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "rentals_return_schedule_idx" ON "rentals" USING btree ("facility_id","return_date","return_slot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rentals_return_slot_capacity_idx" ON "rentals" USING btree ("facility_id","return_date","return_slot_id") WHERE "rentals"."return_status" IN ('CONFIRMED', 'INSPECTING', 'FAILED');--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_refund_allocation_valid" CHECK (("payments"."deposit_refund_amount" IS NULL AND "payments"."rent_refund_amount" IS NULL) OR ("payments"."deposit_refund_amount" >= 0 AND "payments"."rent_refund_amount" >= 0 AND "payments"."deposit_refund_amount" + "payments"."rent_refund_amount" = "payments"."total_amount"));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_source_reference" CHECK ((
        ("payments"."type" = 'COLLECTION' AND "payments"."rental_id" IS NULL AND "payments"."source_payment_id" IS NULL AND "payments"."provider" IS NOT NULL AND "payments"."payment_code" IS NOT NULL AND "payments"."provider_payment_id" IS NOT NULL AND (("payments"."booking_id" IS NOT NULL AND "payments"."rental_charge_id" IS NULL AND "payments"."hold_token_hash" IS NOT NULL) OR ("payments"."booking_id" IS NULL AND "payments"."rental_charge_id" IS NOT NULL AND "payments"."hold_token_hash" IS NULL))) OR
        ("payments"."type" = 'RETURN_REFUND' AND "payments"."booking_id" IS NULL AND "payments"."rental_charge_id" IS NULL AND "payments"."rental_id" IS NOT NULL AND "payments"."source_payment_id" IS NOT NULL AND "payments"."hold_token_hash" IS NULL AND "payments"."provider" IS NULL AND "payments"."payment_code" IS NULL AND "payments"."provider_payment_id" IS NULL AND "payments"."status" = 'SUCCEEDED' AND "payments"."total_amount" > 0 AND "payments"."refund_reference" IS NOT NULL AND "payments"."refunded_at" IS NOT NULL AND "payments"."refunded_by" IS NOT NULL)
      ));--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_return_schedule_valid" CHECK ((
        "rentals"."return_date" IS NULL AND "rentals"."return_slot_id" IS NULL AND "rentals"."return_starts_at" IS NULL AND "rentals"."return_ends_at" IS NULL AND "rentals"."return_timezone" IS NULL AND "rentals"."return_status" IS NULL AND "rentals"."return_reason" IS NULL
      ) OR (
        "rentals"."return_date" IS NOT NULL AND "rentals"."return_slot_id" IS NOT NULL AND "rentals"."return_starts_at" IS NOT NULL AND "rentals"."return_ends_at" IS NOT NULL AND "rentals"."return_timezone" IS NOT NULL AND "rentals"."return_status" IS NOT NULL AND "rentals"."return_reason" IS NOT NULL AND "rentals"."return_ends_at" > "rentals"."return_starts_at"
      ));--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_return_settlement_valid" CHECK (("rentals"."return_settlement" IS NULL AND "rentals"."return_settlement_approved_by" IS NULL AND "rentals"."return_settlement_approved_at" IS NULL AND "rentals"."return_settlement_reason" IS NULL) OR ("rentals"."return_settlement" IS NOT NULL AND "rentals"."return_settlement_approved_by" IS NOT NULL AND "rentals"."return_settlement_approved_at" IS NOT NULL AND "rentals"."return_settlement_reason" IS NOT NULL));--> statement-breakpoint
DROP TYPE "public"."return_time_change_status";