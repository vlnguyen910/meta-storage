CREATE TYPE "public"."appointment_status" AS ENUM('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');--> statement-breakpoint
CREATE TYPE "public"."appointment_type" AS ENUM('CHECK_IN', 'CHECK_OUT', 'SUPPORT');--> statement-breakpoint
CREATE TYPE "public"."reservation_record_status" AS ENUM('DRAFT', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'CHECKED_IN', 'NO_SHOW');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"appointment_type" "appointment_type" NOT NULL,
	"scheduled_date" date NOT NULL,
	"slot_id" uuid NOT NULL,
	"status" "appointment_status" DEFAULT 'SCHEDULED' NOT NULL,
	"customer_id" uuid NOT NULL,
	"contact_phone" varchar(20),
	"reservation_id" uuid,
	"rental_id" uuid,
	"support_ticket_id" uuid,
	"assigned_staff_id" uuid,
	"created_by" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_context_valid" CHECK (("appointments"."appointment_type" = 'CHECK_IN' AND "appointments"."reservation_id" IS NOT NULL AND "appointments"."rental_id" IS NULL AND "appointments"."support_ticket_id" IS NULL) OR ("appointments"."appointment_type" = 'CHECK_OUT' AND "appointments"."reservation_id" IS NULL AND "appointments"."rental_id" IS NOT NULL AND "appointments"."support_ticket_id" IS NULL) OR ("appointments"."appointment_type" = 'SUPPORT' AND "appointments"."reservation_id" IS NULL AND "appointments"."rental_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"unit_type_id" uuid NOT NULL,
	"requested_months" integer NOT NULL,
	"rental_start_at" timestamp with time zone NOT NULL,
	"rental_end_at" timestamp with time zone NOT NULL,
	"monthly_rate_snapshot" integer NOT NULL,
	"rental_fee_amount" integer NOT NULL,
	"deposit_amount" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"status" "reservation_record_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_months_valid" CHECK ("reservations"."requested_months" BETWEEN 1 AND 12),
	CONSTRAINT "reservations_period_valid" CHECK ("reservations"."rental_end_at" > "reservations"."rental_start_at"),
	CONSTRAINT "reservations_amounts_valid" CHECK ("reservations"."monthly_rate_snapshot" >= 0 AND "reservations"."rental_fee_amount" >= 0 AND "reservations"."deposit_amount" >= 0 AND "reservations"."total_amount" = "reservations"."rental_fee_amount" + "reservations"."deposit_amount")
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_slot_id_check_in_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."check_in_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_support_ticket_id_support_tickets_id_fk" FOREIGN KEY ("support_ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_facility_id_unit_type_id_unit_types_facility_id_id_fk" FOREIGN KEY ("facility_id","unit_type_id") REFERENCES "public"."unit_types"("facility_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_facility_schedule_idx" ON "appointments" USING btree ("facility_id","scheduled_date","appointment_type","status");--> statement-breakpoint
CREATE INDEX "appointments_staff_schedule_idx" ON "appointments" USING btree ("assigned_staff_id","scheduled_date","status");--> statement-breakpoint
CREATE INDEX "appointments_customer_idx" ON "appointments" USING btree ("customer_id","scheduled_date");--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_check_in_reservation_idx" ON "appointments" USING btree ("reservation_id") WHERE "appointments"."appointment_type" = 'CHECK_IN';--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_check_out_slot_idx" ON "appointments" USING btree ("facility_id","scheduled_date","slot_id") WHERE "appointments"."appointment_type" = 'CHECK_OUT' AND "appointments"."status" = 'CONFIRMED';--> statement-breakpoint
CREATE INDEX "reservations_customer_idx" ON "reservations" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "reservations_facility_status_idx" ON "reservations" USING btree ("facility_id","status");