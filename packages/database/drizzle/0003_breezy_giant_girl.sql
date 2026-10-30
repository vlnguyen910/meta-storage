ALTER TABLE "inspections" DROP CONSTRAINT "inspections_checkInVerificationId_unique";--> statement-breakpoint
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_attempt_valid";--> statement-breakpoint
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_version_valid";--> statement-breakpoint
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_handover_valid";--> statement-breakpoint
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_context_valid";--> statement-breakpoint
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_completion_valid";--> statement-breakpoint
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_return_request_id_return_requests_id_fk";
--> statement-breakpoint
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_checklist_version_id_return_checklist_versions_id_fk";
--> statement-breakpoint
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_check_in_verification_id_checkin_verifications_id_fk";
--> statement-breakpoint
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_unit_assignment_id_unit_assignments_id_fk";
--> statement-breakpoint
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_handed_over_by_users_id_fk";
--> statement-breakpoint
DROP INDEX "inspections_return_attempt_idx";--> statement-breakpoint
DROP INDEX "inspections_unit_idx";--> statement-breakpoint
DROP INDEX "inspections_rental_idx";--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "inspect_done_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "inspections_unit_idx" ON "inspections" USING btree ("storage_unit_id","inspect_done_at");--> statement-breakpoint
CREATE INDEX "inspections_rental_idx" ON "inspections" USING btree ("rental_id","inspect_done_at");--> statement-breakpoint
ALTER TABLE "inspections" DROP COLUMN "return_request_id";--> statement-breakpoint
ALTER TABLE "inspections" DROP COLUMN "checklist_version_id";--> statement-breakpoint
ALTER TABLE "inspections" DROP COLUMN "check_in_verification_id";--> statement-breakpoint
ALTER TABLE "inspections" DROP COLUMN "unit_assignment_id";--> statement-breakpoint
ALTER TABLE "inspections" DROP COLUMN "attempt";--> statement-breakpoint
ALTER TABLE "inspections" DROP COLUMN "version";--> statement-breakpoint
ALTER TABLE "inspections" DROP COLUMN "handed_over_by";--> statement-breakpoint
ALTER TABLE "inspections" DROP COLUMN "handed_over_at";--> statement-breakpoint
ALTER TABLE "inspections" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_context_valid" CHECK ((
        ("inspections"."inspection_type" = 'CHECK_IN' AND "inspections"."booking_id" IS NOT NULL AND "inspections"."rental_id" IS NULL) OR
        ("inspections"."inspection_type" = 'CHECK_OUT' AND "inspections"."rental_id" IS NOT NULL AND "inspections"."booking_id" IS NULL) OR
        ("inspections"."inspection_type" = 'MAINTENANCE' AND "inspections"."booking_id" IS NULL)
      ));--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_completion_valid" CHECK (("inspections"."status" = 'PENDING' AND "inspections"."inspected_at" IS NULL AND "inspections"."inspect_done_at" IS NULL) OR ("inspections"."status" = 'IN_PROGRESS' AND "inspections"."inspected_at" IS NOT NULL AND "inspections"."inspect_done_at" IS NULL) OR ("inspections"."status" IN ('PASSED', 'FAILED') AND "inspections"."inspected_at" IS NOT NULL AND "inspections"."inspect_done_at" IS NOT NULL));