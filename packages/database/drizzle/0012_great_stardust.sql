ALTER TABLE "appointments" RENAME COLUMN "type" TO "appointment_type";--> statement-breakpoint
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_context_valid";--> statement-breakpoint
DROP INDEX "appointments_facility_schedule_idx";--> statement-breakpoint
DROP INDEX "appointments_check_in_reservation_idx";--> statement-breakpoint
DROP INDEX "appointments_check_out_active_slot_idx";--> statement-breakpoint
CREATE INDEX "appointments_facility_schedule_idx" ON "appointments" USING btree ("facility_id","scheduled_date","appointment_type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_check_in_reservation_idx" ON "appointments" USING btree ("reservation_id") WHERE "appointments"."appointment_type" = 'CHECK_IN';--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_check_out_active_slot_idx" ON "appointments" USING btree ("facility_id","scheduled_date","slot_id") WHERE "appointments"."appointment_type" = 'CHECK_OUT' AND "appointments"."status" = 'CONFIRMED';--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_context_valid" CHECK ((
        ("appointments"."appointment_type" = 'CHECK_IN' AND "appointments"."reservation_id" IS NOT NULL AND "appointments"."rental_id" IS NULL AND "appointments"."support_ticket_id" IS NULL) OR
        ("appointments"."appointment_type" = 'CHECK_OUT' AND "appointments"."reservation_id" IS NULL AND "appointments"."rental_id" IS NOT NULL AND "appointments"."support_ticket_id" IS NULL) OR
        ("appointments"."appointment_type" = 'SUPPORT' AND "appointments"."reservation_id" IS NULL AND "appointments"."rental_id" IS NULL AND "appointments"."support_ticket_id" IS NOT NULL)
      ));