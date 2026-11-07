ALTER TYPE "public"."capacity_allocation_kind" ADD VALUE 'RESERVATION';--> statement-breakpoint
ALTER TYPE "public"."facility_task_reference_type" ADD VALUE 'APPOINTMENT' BEFORE 'BOOKING';--> statement-breakpoint
ALTER TABLE "facility_tasks" DROP CONSTRAINT "facility_tasks_reference_valid";--> statement-breakpoint
DROP INDEX "appointments_check_in_reservation_idx";--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "booking_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reservation_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_check_in_reservation_idx" ON "appointments" USING btree ("reservation_id") WHERE "appointments"."appointment_type" = 'CHECK_IN' AND "appointments"."status" IN ('SCHEDULED', 'CONFIRMED');--> statement-breakpoint
ALTER TABLE "facility_tasks" ADD CONSTRAINT "facility_tasks_reference_valid" CHECK (("facility_tasks"."type" = 'CHECK_IN_HANDOVER' AND "facility_tasks"."reference_type"::text IN ('BOOKING', 'APPOINTMENT')) OR ("facility_tasks"."type" = 'UNIT_INSPECTION' AND "facility_tasks"."reference_type"::text IN ('BOOKING', 'STORAGE_UNIT', 'APPOINTMENT')) OR ("facility_tasks"."type" = 'HANDLE_SUPPORT' AND "facility_tasks"."reference_type"::text IN ('SUPPORT_TICKET', 'APPOINTMENT')));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_context_valid" CHECK (num_nonnulls("payments"."booking_id", "payments"."reservation_id") = 1);