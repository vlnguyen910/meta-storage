CREATE TABLE "inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_unit_id" uuid NOT NULL,
	"rental_id" uuid,
	"booking_id" uuid,
	"return_request_id" uuid,
	"inspected_by" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"inspection_type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"condition" varchar(20),
	"checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"checklist_version_id" uuid,
	"check_in_verification_id" uuid,
	"unit_assignment_id" uuid,
	"attempt" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"handed_over_by" uuid,
	"handed_over_at" timestamp with time zone,
	"inspected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inspections_checkInVerificationId_unique" UNIQUE("check_in_verification_id"),
	CONSTRAINT "inspections_attempt_valid" CHECK ("inspections"."attempt" > 0),
	CONSTRAINT "inspections_version_valid" CHECK ("inspections"."version" >= 0),
	CONSTRAINT "inspections_type_valid" CHECK ("inspections"."inspection_type" IN ('CHECK_IN', 'CHECK_OUT', 'MAINTENANCE')),
	CONSTRAINT "inspections_status_valid" CHECK ("inspections"."status" IN ('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED')),
	CONSTRAINT "inspections_condition_valid" CHECK ("inspections"."condition" IS NULL OR "inspections"."condition" IN ('GOOD', 'MINOR_DAMAGE', 'MAJOR_DAMAGE')),
	CONSTRAINT "inspections_context_valid" CHECK ((
        ("inspections"."inspection_type" = 'CHECK_IN' AND "inspections"."booking_id" IS NOT NULL AND "inspections"."return_request_id" IS NULL AND "inspections"."check_in_verification_id" IS NOT NULL AND "inspections"."unit_assignment_id" IS NOT NULL) OR
        ("inspections"."inspection_type" = 'CHECK_OUT' AND "inspections"."rental_id" IS NOT NULL AND "inspections"."return_request_id" IS NOT NULL AND "inspections"."booking_id" IS NULL AND "inspections"."check_in_verification_id" IS NULL AND "inspections"."unit_assignment_id" IS NULL) OR
        ("inspections"."inspection_type" = 'MAINTENANCE' AND "inspections"."return_request_id" IS NULL AND "inspections"."booking_id" IS NULL AND "inspections"."check_in_verification_id" IS NULL AND "inspections"."unit_assignment_id" IS NULL)
      )),
	CONSTRAINT "inspections_completion_valid" CHECK (("inspections"."status" IN ('PENDING', 'IN_PROGRESS') AND "inspections"."inspected_at" IS NULL) OR ("inspections"."status" IN ('PASSED', 'FAILED') AND "inspections"."inspected_at" IS NOT NULL)),
	CONSTRAINT "inspections_handover_valid" CHECK (("inspections"."handed_over_by" IS NULL AND "inspections"."handed_over_at" IS NULL) OR ("inspections"."handed_over_by" IS NOT NULL AND "inspections"."handed_over_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" varchar(50) NOT NULL,
	"owner_id" uuid NOT NULL,
	"purpose" varchar(50) NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"byte_size" integer NOT NULL,
	"cloudinary_resource_type" varchar(20) NOT NULL,
	"cloudinary_public_id" text NOT NULL,
	"cloudinary_format" varchar(30) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_cloudinaryPublicId_unique" UNIQUE("cloudinary_public_id"),
	CONSTRAINT "media_assets_size_valid" CHECK ("media_assets"."byte_size" >= 0),
	CONSTRAINT "media_assets_cloudinary_type_valid" CHECK ("media_assets"."cloudinary_resource_type" IN ('image', 'video', 'raw'))
);
--> statement-breakpoint
DROP TABLE "handover_inspections" CASCADE;--> statement-breakpoint
DROP TABLE "inspection_photos" CASCADE;--> statement-breakpoint
DROP TABLE "return_audit" CASCADE;--> statement-breakpoint
DROP TABLE "return_evidence_photos" CASCADE;--> statement-breakpoint
DROP TABLE "return_inspection_photos" CASCADE;--> statement-breakpoint
DROP TABLE "return_inspections" CASCADE;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_storage_unit_id_storage_units_id_fk" FOREIGN KEY ("storage_unit_id") REFERENCES "public"."storage_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_return_request_id_return_requests_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_inspected_by_users_id_fk" FOREIGN KEY ("inspected_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_task_id_facility_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."facility_tasks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_checklist_version_id_return_checklist_versions_id_fk" FOREIGN KEY ("checklist_version_id") REFERENCES "public"."return_checklist_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_check_in_verification_id_checkin_verifications_id_fk" FOREIGN KEY ("check_in_verification_id") REFERENCES "public"."checkin_verifications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_unit_assignment_id_unit_assignments_id_fk" FOREIGN KEY ("unit_assignment_id") REFERENCES "public"."unit_assignments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_handed_over_by_users_id_fk" FOREIGN KEY ("handed_over_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inspections_unit_idx" ON "inspections" USING btree ("storage_unit_id","created_at");--> statement-breakpoint
CREATE INDEX "inspections_rental_idx" ON "inspections" USING btree ("rental_id","created_at");--> statement-breakpoint
CREATE INDEX "inspections_task_idx" ON "inspections" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inspections_return_attempt_idx" ON "inspections" USING btree ("return_request_id","attempt");--> statement-breakpoint
CREATE INDEX "media_assets_owner_idx" ON "media_assets" USING btree ("owner_type","owner_id","purpose");--> statement-breakpoint
CREATE INDEX "media_assets_uploaded_by_idx" ON "media_assets" USING btree ("uploaded_by","created_at");--> statement-breakpoint
ALTER TABLE "return_refunds" DROP COLUMN "evidence_photo_ids";--> statement-breakpoint
ALTER TABLE "return_time_changes" DROP COLUMN "evidence_photo_ids";--> statement-breakpoint
DROP TYPE "public"."inspection_status";--> statement-breakpoint
DROP TYPE "public"."return_inspection_status";