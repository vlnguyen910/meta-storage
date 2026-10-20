CREATE TYPE "public"."return_inspection_status" AS ENUM('DRAFT', 'PASS', 'FAIL');--> statement-breakpoint
CREATE TYPE "public"."return_request_status" AS ENUM('PENDING', 'CONFIRMED', 'INSPECTING', 'FAILED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."return_time_change_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "facility_return_calendars" (
	"facility_id" uuid PRIMARY KEY NOT NULL,
	"timezone" text NOT NULL,
	"holidays" jsonb NOT NULL,
	"reminder_time" text DEFAULT '09:00' NOT NULL,
	"version" integer NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid,
	"facility_id" uuid,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"details" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_checklist_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"items" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "return_checklist_versions_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "return_inspection_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"public_id" text NOT NULL,
	"format" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"checklist_version_id" uuid NOT NULL,
	"definition" jsonb NOT NULL,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "return_inspection_status" DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"property_disposition" text DEFAULT 'NONE' NOT NULL,
	"property_receiver" text,
	"property_handled_at" timestamp with time zone,
	"property_evidence_photo_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"completed_by" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_overdue_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"rate" integer DEFAULT 25 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "return_overdue_rate_valid" CHECK ("return_overdue_settings"."id" = 'default' AND "return_overdue_settings"."rate" BETWEEN 0 AND 100 AND "return_overdue_settings"."version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "return_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"settlement_id" uuid NOT NULL,
	"amount" numeric(14, 0) NOT NULL,
	"reference" text NOT NULL,
	"evidence_photo_ids" jsonb NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"confirmed_by" uuid NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "return_refund_amount_positive" CHECK ("return_refunds"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "return_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rental_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"date" date NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"status" "return_request_status" DEFAULT 'PENDING' NOT NULL,
	"assigned_staff_id" uuid,
	"version" integer DEFAULT 0 NOT NULL,
	"reason" text NOT NULL,
	"manual_review_required" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "return_request_period_valid" CHECK ("return_requests"."ends_at" > "return_requests"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "return_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"deposit_snapshot" numeric(14, 0) NOT NULL,
	"rate_snapshot" integer NOT NULL,
	"overdue_fee_amount" numeric(14, 0) NOT NULL,
	"damage_amount" numeric(14, 0) NOT NULL,
	"unused_rent_refund_amount" numeric(14, 0) NOT NULL,
	"refund_entitlement" numeric(14, 0) NOT NULL,
	"debt_amount" numeric(14, 0) NOT NULL,
	"actual_return_at" timestamp with time zone NOT NULL,
	"refund_due_date" date NOT NULL,
	"calendar_snapshot" jsonb NOT NULL,
	"approved_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "return_settlement_amounts_valid" CHECK ("return_settlements"."deposit_snapshot" >= 0 AND "return_settlements"."rate_snapshot" BETWEEN 0 AND 100 AND "return_settlements"."overdue_fee_amount" >= 0 AND "return_settlements"."damage_amount" >= 0 AND "return_settlements"."unused_rent_refund_amount" >= 0 AND "return_settlements"."refund_entitlement" >= 0 AND "return_settlements"."debt_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "return_time_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"previous_at" timestamp with time zone,
	"proposed_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"evidence_photo_ids" jsonb NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"status" "return_time_change_status" DEFAULT 'PENDING' NOT NULL,
	"proposed_by" uuid NOT NULL,
	"decided_by" uuid,
	"decision_reason" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facility_return_calendars" ADD CONSTRAINT "facility_return_calendars_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_return_calendars" ADD CONSTRAINT "facility_return_calendars_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_audit" ADD CONSTRAINT "return_audit_request_id_return_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."return_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_audit" ADD CONSTRAINT "return_audit_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_audit" ADD CONSTRAINT "return_audit_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_checklist_versions" ADD CONSTRAINT "return_checklist_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_inspection_photos" ADD CONSTRAINT "return_inspection_photos_inspection_id_return_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."return_inspections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_inspection_photos" ADD CONSTRAINT "return_inspection_photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_inspections" ADD CONSTRAINT "return_inspections_request_id_return_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."return_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_inspections" ADD CONSTRAINT "return_inspections_checklist_version_id_return_checklist_versions_id_fk" FOREIGN KEY ("checklist_version_id") REFERENCES "public"."return_checklist_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_inspections" ADD CONSTRAINT "return_inspections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_inspections" ADD CONSTRAINT "return_inspections_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_overdue_settings" ADD CONSTRAINT "return_overdue_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_refunds" ADD CONSTRAINT "return_refunds_request_id_return_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."return_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_refunds" ADD CONSTRAINT "return_refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_refunds" ADD CONSTRAINT "return_refunds_settlement_id_return_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."return_settlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_refunds" ADD CONSTRAINT "return_refunds_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_slot_id_check_in_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."check_in_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_settlements" ADD CONSTRAINT "return_settlements_request_id_return_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."return_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_settlements" ADD CONSTRAINT "return_settlements_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_time_changes" ADD CONSTRAINT "return_time_changes_request_id_return_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."return_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_time_changes" ADD CONSTRAINT "return_time_changes_proposed_by_users_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_time_changes" ADD CONSTRAINT "return_time_changes_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "return_audit_request_idx" ON "return_audit" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "return_photo_inspection_idx" ON "return_inspection_photos" USING btree ("inspection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "return_inspection_attempt_idx" ON "return_inspections" USING btree ("request_id","attempt");--> statement-breakpoint
CREATE UNIQUE INDEX "return_refund_idempotency_idx" ON "return_refunds" USING btree ("request_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "return_refund_reference_idx" ON "return_refunds" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "return_requests_open_rental_idx" ON "return_requests" USING btree ("rental_id") WHERE "return_requests"."status" IN ('PENDING','CONFIRMED','INSPECTING','FAILED');--> statement-breakpoint
CREATE INDEX "return_requests_facility_slot_idx" ON "return_requests" USING btree ("facility_id","date","slot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "return_settlement_revision_idx" ON "return_settlements" USING btree ("request_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "return_time_change_idempotency_idx" ON "return_time_changes" USING btree ("request_id","idempotency_key");