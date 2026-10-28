CREATE TYPE "public"."appointment_status" AS ENUM('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');--> statement-breakpoint
CREATE TYPE "public"."appointment_type" AS ENUM('CHECK_IN', 'CHECK_OUT', 'SUPPORT');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"type" "appointment_type" NOT NULL,
	"scheduled_date" date NOT NULL,
	"slot_id" uuid NOT NULL,
	"status" "appointment_status" DEFAULT 'SCHEDULED' NOT NULL,
	"reservation_id" uuid,
	"rental_id" uuid,
	"support_ticket_id" uuid,
	"assigned_staff_id" uuid,
	"created_by" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_context_valid" CHECK ((
        ("appointments"."type" = 'CHECK_IN' AND "appointments"."reservation_id" IS NOT NULL AND "appointments"."rental_id" IS NULL AND "appointments"."support_ticket_id" IS NULL) OR
        ("appointments"."type" = 'CHECK_OUT' AND "appointments"."reservation_id" IS NULL AND "appointments"."rental_id" IS NOT NULL AND "appointments"."support_ticket_id" IS NULL) OR
        ("appointments"."type" = 'SUPPORT' AND "appointments"."reservation_id" IS NULL AND "appointments"."rental_id" IS NULL AND "appointments"."support_ticket_id" IS NOT NULL)
      ))
);
--> statement-breakpoint
ALTER TABLE "bookings" RENAME TO "reservations";--> statement-breakpoint
ALTER TABLE "reservations" RENAME COLUMN "booking_code" TO "reservation_code";--> statement-breakpoint
ALTER TABLE "reservations" RENAME COLUMN "user_id" TO "customer_id";--> statement-breakpoint
ALTER TABLE "checkin_verifications" RENAME COLUMN "booking_id" TO "reservation_id";--> statement-breakpoint
ALTER TABLE "inspections" RENAME COLUMN "booking_id" TO "reservation_id";--> statement-breakpoint
ALTER TABLE "notification_outbox" RENAME COLUMN "booking_id" TO "reservation_id";--> statement-breakpoint
ALTER TABLE "payments" RENAME COLUMN "booking_id" TO "reservation_id";--> statement-breakpoint
ALTER TABLE "rentals" RENAME COLUMN "booking_id" TO "reservation_id";--> statement-breakpoint
ALTER TABLE "support_tickets" RENAME COLUMN "booking_id" TO "reservation_id";--> statement-breakpoint
ALTER TABLE "unit_assignments" RENAME COLUMN "booking_id" TO "reservation_id";--> statement-breakpoint
ALTER TABLE "reservations" DROP CONSTRAINT "bookings_bookingCode_unique";--> statement-breakpoint
ALTER TABLE "reservations" DROP CONSTRAINT "bookings_qrTokenHash_unique";--> statement-breakpoint
ALTER TABLE "rentals" DROP CONSTRAINT "rentals_bookingId_unique";--> statement-breakpoint
ALTER TABLE "reservations" DROP CONSTRAINT "bookings_valid_status";--> statement-breakpoint
ALTER TABLE "reservations" DROP CONSTRAINT "bookings_phone_after_draft";--> statement-breakpoint
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_context_valid";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_source_reference";--> statement-breakpoint
ALTER TABLE "reservations" DROP CONSTRAINT "bookings_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "reservations" DROP CONSTRAINT "bookings_facility_id_facilities_id_fk";
--> statement-breakpoint
ALTER TABLE "reservations" DROP CONSTRAINT "bookings_check_in_slot_id_check_in_slots_id_fk";
--> statement-breakpoint
ALTER TABLE "reservations" DROP CONSTRAINT "bookings_assigned_staff_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "reservations" DROP CONSTRAINT "bookings_facility_id_unit_type_id_unit_types_facility_id_id_fk";
--> statement-breakpoint
ALTER TABLE "checkin_verifications" DROP CONSTRAINT "checkin_verifications_booking_id_bookings_id_fk";
--> statement-breakpoint
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_booking_id_bookings_id_fk";
--> statement-breakpoint
ALTER TABLE "notification_outbox" DROP CONSTRAINT "notification_outbox_booking_id_bookings_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_booking_id_bookings_id_fk";
--> statement-breakpoint
ALTER TABLE "rentals" DROP CONSTRAINT "rentals_booking_id_bookings_id_fk";
--> statement-breakpoint
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_booking_id_bookings_id_fk";
--> statement-breakpoint
ALTER TABLE "unit_assignments" DROP CONSTRAINT "unit_assignments_booking_id_bookings_id_fk";
--> statement-breakpoint
DROP INDEX "bookings_facility_status_idx";--> statement-breakpoint
DROP INDEX "bookings_user_idx";--> statement-breakpoint
DROP INDEX "bookings_assigned_staff_idx";--> statement-breakpoint
DROP INDEX "bookings_dates_idx";--> statement-breakpoint
DROP INDEX "bookings_check_in_slot_idx";--> statement-breakpoint
DROP INDEX "checkin_verifications_booking_status_idx";--> statement-breakpoint
DROP INDEX "payments_booking_idx";--> statement-breakpoint
DROP INDEX "unit_assignments_booking_idx";--> statement-breakpoint
DROP INDEX "unit_assignments_booking_status_idx";--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_slot_id_check_in_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."check_in_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_support_ticket_id_support_tickets_id_fk" FOREIGN KEY ("support_ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_facility_schedule_idx" ON "appointments" USING btree ("facility_id","scheduled_date","type","status");--> statement-breakpoint
CREATE INDEX "appointments_assigned_staff_idx" ON "appointments" USING btree ("assigned_staff_id","scheduled_date","status");--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_check_in_reservation_idx" ON "appointments" USING btree ("reservation_id") WHERE "appointments"."type" = 'CHECK_IN';--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_check_out_active_slot_idx" ON "appointments" USING btree ("facility_id","scheduled_date","slot_id") WHERE "appointments"."type" = 'CHECK_OUT' AND "appointments"."status" = 'CONFIRMED';--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_check_in_slot_id_check_in_slots_id_fk" FOREIGN KEY ("check_in_slot_id") REFERENCES "public"."check_in_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_facility_id_unit_type_id_unit_types_facility_id_id_fk" FOREIGN KEY ("facility_id","unit_type_id") REFERENCES "public"."unit_types"("facility_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_verifications" ADD CONSTRAINT "checkin_verifications_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_assignments" ADD CONSTRAINT "unit_assignments_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reservations_facility_status_idx" ON "reservations" USING btree ("facility_id","status");--> statement-breakpoint
CREATE INDEX "reservations_customer_idx" ON "reservations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "reservations_assigned_staff_idx" ON "reservations" USING btree ("assigned_staff_id");--> statement-breakpoint
CREATE INDEX "reservations_dates_idx" ON "reservations" USING btree ("check_in_date","rental_end_at");--> statement-breakpoint
CREATE INDEX "reservations_check_in_slot_idx" ON "reservations" USING btree ("check_in_slot_id");--> statement-breakpoint
CREATE INDEX "checkin_verifications_reservation_status_idx" ON "checkin_verifications" USING btree ("reservation_id","status");--> statement-breakpoint
CREATE INDEX "payments_reservation_idx" ON "payments" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "unit_assignments_reservation_idx" ON "unit_assignments" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "unit_assignments_reservation_status_idx" ON "unit_assignments" USING btree ("reservation_id","status");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_reservationCode_unique" UNIQUE("reservation_code");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_qrTokenHash_unique" UNIQUE("qr_token_hash");--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_reservationId_unique" UNIQUE("reservation_id");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_valid_status" CHECK ("reservations"."status" IN ('DRAFT', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'CHECKED_IN'));--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_phone_after_draft" CHECK ("reservations"."status" = 'DRAFT' OR "reservations"."contact_phone" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_context_valid" CHECK ((
        ("inspections"."inspection_type" = 'CHECK_IN' AND "inspections"."reservation_id" IS NOT NULL AND "inspections"."rental_id" IS NULL) OR
        ("inspections"."inspection_type" = 'CHECK_OUT' AND "inspections"."rental_id" IS NOT NULL AND "inspections"."reservation_id" IS NULL) OR
        ("inspections"."inspection_type" = 'MAINTENANCE' AND "inspections"."reservation_id" IS NULL)
      ));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_source_reference" CHECK ((
        ("payments"."type" = 'COLLECTION' AND "payments"."rental_id" IS NULL AND "payments"."source_payment_id" IS NULL AND "payments"."provider" IS NOT NULL AND "payments"."payment_code" IS NOT NULL AND "payments"."provider_payment_id" IS NOT NULL AND (("payments"."reservation_id" IS NOT NULL AND "payments"."rental_charge_id" IS NULL AND "payments"."hold_token_hash" IS NOT NULL) OR ("payments"."reservation_id" IS NULL AND "payments"."rental_charge_id" IS NOT NULL AND "payments"."hold_token_hash" IS NULL))) OR
        ("payments"."type" = 'RETURN_REFUND' AND "payments"."reservation_id" IS NULL AND "payments"."rental_charge_id" IS NULL AND "payments"."rental_id" IS NOT NULL AND "payments"."source_payment_id" IS NOT NULL AND "payments"."hold_token_hash" IS NULL AND "payments"."provider" IS NULL AND "payments"."payment_code" IS NULL AND "payments"."provider_payment_id" IS NULL AND "payments"."status" = 'SUCCEEDED' AND "payments"."total_amount" > 0 AND "payments"."refund_reference" IS NOT NULL AND "payments"."refunded_at" IS NOT NULL AND "payments"."refunded_by" IS NOT NULL)
      ));