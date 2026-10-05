CREATE TYPE "public"."inspection_status" AS ENUM('DRAFT', 'COMPLETED');--> statement-breakpoint
CREATE TABLE "handover_inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"physical_unit_id" uuid NOT NULL,
	"unit_assignment_id" uuid NOT NULL,
	"verification_id" uuid NOT NULL,
	"unit_code" varchar(100) NOT NULL,
	"policy_version" varchar(20) DEFAULT 'H6_V1' NOT NULL,
	"status" "inspection_status" DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"correct_unit" boolean,
	"condition_notes" text DEFAULT '' NOT NULL,
	"created_by" uuid NOT NULL,
	"completed_by" uuid,
	"completed_at" timestamp with time zone,
	"handed_over_by" uuid,
	"handed_over_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "handover_inspections_verificationId_unique" UNIQUE("verification_id")
);
--> statement-breakpoint
CREATE TABLE "inspection_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"filename" varchar(120) NOT NULL,
	"mime_type" varchar(40) NOT NULL,
	"byte_size" integer NOT NULL,
	"data_base64" text,
	"cloudinary_public_id" text,
	"cloudinary_format" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "handover_inspections" ADD CONSTRAINT "handover_inspections_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_inspections" ADD CONSTRAINT "handover_inspections_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_inspections" ADD CONSTRAINT "handover_inspections_physical_unit_id_storage_units_id_fk" FOREIGN KEY ("physical_unit_id") REFERENCES "public"."storage_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_inspections" ADD CONSTRAINT "handover_inspections_unit_assignment_id_unit_assignments_id_fk" FOREIGN KEY ("unit_assignment_id") REFERENCES "public"."unit_assignments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_inspections" ADD CONSTRAINT "handover_inspections_verification_id_checkin_verifications_id_fk" FOREIGN KEY ("verification_id") REFERENCES "public"."checkin_verifications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_inspections" ADD CONSTRAINT "handover_inspections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_inspections" ADD CONSTRAINT "handover_inspections_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_inspections" ADD CONSTRAINT "handover_inspections_handed_over_by_users_id_fk" FOREIGN KEY ("handed_over_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_inspection_id_handover_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."handover_inspections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "handover_inspections_booking_idx" ON "handover_inspections" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "inspection_photos_inspection_idx" ON "inspection_photos" USING btree ("inspection_id");