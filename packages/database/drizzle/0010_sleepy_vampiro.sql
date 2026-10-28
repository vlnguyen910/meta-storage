ALTER TABLE "rentals" DROP CONSTRAINT "rentals_return_schedule_valid";--> statement-breakpoint
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_check_in_slot_id_check_in_slots_id_fk";
--> statement-breakpoint
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_assigned_staff_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "rentals" DROP CONSTRAINT "rentals_return_slot_id_check_in_slots_id_fk";
--> statement-breakpoint
DROP INDEX "reservations_assigned_staff_idx";--> statement-breakpoint
DROP INDEX "reservations_dates_idx";--> statement-breakpoint
DROP INDEX "reservations_check_in_slot_idx";--> statement-breakpoint
DROP INDEX "rentals_return_schedule_idx";--> statement-breakpoint
DROP INDEX "rentals_return_slot_capacity_idx";--> statement-breakpoint
ALTER TABLE "reservations" DROP COLUMN "check_in_date";--> statement-breakpoint
ALTER TABLE "reservations" DROP COLUMN "check_in_slot_id";--> statement-breakpoint
ALTER TABLE "reservations" DROP COLUMN "assigned_staff_id";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "return_slot_id";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "return_date";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "return_starts_at";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "return_ends_at";--> statement-breakpoint
ALTER TABLE "rentals" DROP COLUMN "return_timezone";--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_return_state_valid" CHECK (("rentals"."return_status" IS NULL AND "rentals"."return_reason" IS NULL) OR ("rentals"."return_status" IS NOT NULL AND "rentals"."return_reason" IS NOT NULL));