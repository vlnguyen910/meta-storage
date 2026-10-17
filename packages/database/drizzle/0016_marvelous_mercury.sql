CREATE TYPE "public"."checkin_verification_status" AS ENUM('VERIFIED', 'CONSUMED', 'INVALIDATED');--> statement-breakpoint
CREATE TABLE "checkin_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"unit_assignment_id" uuid NOT NULL,
	"status" "checkin_verification_status" DEFAULT 'VERIFIED' NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone,
	"invalidated_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checkin_verifications" ADD CONSTRAINT "checkin_verifications_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_verifications" ADD CONSTRAINT "checkin_verifications_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_verifications" ADD CONSTRAINT "checkin_verifications_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_verifications" ADD CONSTRAINT "checkin_verifications_unit_assignment_id_unit_assignments_id_fk" FOREIGN KEY ("unit_assignment_id") REFERENCES "public"."unit_assignments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkin_verifications_booking_status_idx" ON "checkin_verifications" USING btree ("booking_id","status");--> statement-breakpoint
CREATE INDEX "checkin_verifications_facility_verified_idx" ON "checkin_verifications" USING btree ("facility_id","verified_at");