ALTER TABLE "rental_charge_adjustments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rental_charge_events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rental_charge_refunds" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rental_charges" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rental_price_ranges" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rental_renewals" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "rental_charge_adjustments" CASCADE;--> statement-breakpoint
DROP TABLE "rental_charge_events" CASCADE;--> statement-breakpoint
DROP TABLE "rental_charge_refunds" CASCADE;--> statement-breakpoint
DROP TABLE "rental_charges" CASCADE;--> statement-breakpoint
DROP TABLE "rental_price_ranges" CASCADE;--> statement-breakpoint
DROP TABLE "rental_renewals" CASCADE;--> statement-breakpoint
ALTER TABLE "rentals" RENAME COLUMN "physical_unit_id" TO "storage_unit_id";--> statement-breakpoint
ALTER TABLE "rentals" RENAME COLUMN "expected_end_at" TO "end_at";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_source_reference";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_refund_allocation_valid";--> statement-breakpoint
ALTER TABLE "rentals" DROP CONSTRAINT "rentals_version_nonnegative";--> statement-breakpoint
ALTER TABLE "rentals" DROP CONSTRAINT "rentals_return_schedule_valid";--> statement-breakpoint
ALTER TABLE "rentals" DROP CONSTRAINT "rentals_return_settlement_valid";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_rental_charge_id_rental_charges_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_rental_id_rentals_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_source_payment_id_payments_id_fk";
--> statement-breakpoint
ALTER TABLE "rentals" DROP CONSTRAINT "rentals_facility_id_facilities_id_fk";
--> statement-breakpoint
ALTER TABLE "rentals" DROP CONSTRAINT "rentals_physical_unit_id_storage_units_id_fk";
--> statement-breakpoint
ALTER TABLE "rentals" DROP CONSTRAINT "rentals_return_slot_id_check_in_slots_id_fk";
--> statement-breakpoint
ALTER TABLE "rentals" DROP CONSTRAINT "rentals_return_settlement_approved_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "rentals" DROP CONSTRAINT "rentals_booking_id_bookings_id_fk";
--> statement-breakpoint
ALTER TABLE "unit_types" DROP CONSTRAINT "unit_types_price_range_id_rental_price_ranges_id_fk";
--> statement-breakpoint
DROP TYPE "public"."pricing_change_operation";--> statement-breakpoint
CREATE TYPE "public"."pricing_change_operation" AS ENUM('DEPOSIT_POLICY', 'UNIT_TYPE_PRICE');--> statement-breakpoint
ALTER TABLE "rentals" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "rentals" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::text;--> statement-breakpoint
DROP TYPE "public"."rental_status";--> statement-breakpoint
CREATE TYPE "public"."rental_status" AS ENUM('ACTIVE', 'CLOSED');--> statement-breakpoint
ALTER TABLE "rentals" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"public"."rental_status";--> statement-breakpoint
ALTER TABLE "rentals" ALTER COLUMN "status" SET DATA TYPE "public"."rental_status" USING "status"::"public"."rental_status";--> statement-breakpoint
DROP INDEX "payments_refund_reference_idx";--> statement-breakpoint
DROP INDEX "payments_rental_charge_idx";--> statement-breakpoint
DROP INDEX "payments_rental_idx";--> statement-breakpoint
DROP INDEX "payments_pending_rental_charge_idx";--> statement-breakpoint
DROP INDEX "payments_collected_rental_charge_idx";--> statement-breakpoint
DROP INDEX "rentals_facility_idx";--> statement-breakpoint
DROP INDEX "rentals_active_unit_idx";--> statement-breakpoint
DROP INDEX "rentals_return_schedule_idx";--> statement-breakpoint
DROP INDEX "rentals_return_slot_capacity_idx";--> statement-breakpoint
DROP INDEX "unit_types_price_range_idx";--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "booking_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "hold_token_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "provider" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "payment_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "provider_payment_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_storage_unit_id_storage_units_id_fk" FOREIGN KEY ("storage_unit_id") REFERENCES "public"."storage_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rentals_user_idx" ON "rentals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rentals_unit_status_idx" ON "rentals" USING btree ("storage_unit_id","status","end_at");--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "rental_charge_id";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "rental_id";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "source_payment_id";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "deposit_refund_amount";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "rent_refund_amount";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "facility_id";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "version";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "actual_return_at";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "closed_at";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "abandoned_review_at";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "return_slot_id";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "return_date";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "return_starts_at";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "return_ends_at";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "return_timezone";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "return_status";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "return_reason";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "return_manual_review_required";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "return_settlement";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "return_settlement_approved_by";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "return_settlement_approved_at";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "return_settlement_reason";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "deposit_amount";--> statement-breakpoint
ALTER TABLE "unit_types" DROP COLUMN "price_range_id";--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_period_valid" CHECK ("rentals"."end_at" > "rentals"."start_at");--> statement-breakpoint
DROP TYPE "public"."payment_type";--> statement-breakpoint
DROP TYPE "public"."rental_charge_adjustment_direction";--> statement-breakpoint
DROP TYPE "public"."rental_charge_event_type";--> statement-breakpoint
DROP TYPE "public"."rental_charge_refund_status";--> statement-breakpoint
DROP TYPE "public"."rental_charge_category";--> statement-breakpoint
DROP TYPE "public"."rental_charge_source";--> statement-breakpoint
DROP TYPE "public"."rental_charge_status";--> statement-breakpoint
DROP TYPE "public"."renewal_status";--> statement-breakpoint
DROP TYPE "public"."rental_return_status";