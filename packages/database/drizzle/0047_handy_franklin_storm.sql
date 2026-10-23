CREATE TYPE "public"."facility_task_status" AS ENUM('ASSIGNED', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."facility_task_type" AS ENUM('INSPECT_UNIT', 'PRINT_DOCUMENT', 'REPORT_TO_MANAGER');--> statement-breakpoint
CREATE TYPE "public"."storage_unit_maintenance_action" AS ENUM('ENTER_MAINTENANCE', 'EXIT_MAINTENANCE');--> statement-breakpoint
CREATE TABLE "facility_task_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"submitted_by" uuid NOT NULL,
	"accepted_by" uuid,
	"accepted_at" timestamp with time zone,
	"content" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facility_task_reports_acceptance_valid" CHECK (("facility_task_reports"."accepted_by" IS NULL AND "facility_task_reports"."accepted_at" IS NULL) OR ("facility_task_reports"."accepted_by" IS NOT NULL AND "facility_task_reports"."accepted_at" IS NOT NULL)),
	CONSTRAINT "facility_task_reports_content_valid" CHECK (length(btrim("facility_task_reports"."content")) BETWEEN 1 AND 5000)
);
--> statement-breakpoint
CREATE TABLE "facility_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"type" "facility_task_type" NOT NULL,
	"status" "facility_task_status" DEFAULT 'ASSIGNED' NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"storage_unit_id" uuid,
	"booking_id" uuid,
	"assigned_staff_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_by" uuid,
	"completed_at" timestamp with time zone,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facility_tasks_version_valid" CHECK ("facility_tasks"."version" >= 0),
	CONSTRAINT "facility_tasks_lifecycle_valid" CHECK (("facility_tasks"."status" = 'ASSIGNED' AND "facility_tasks"."started_at" IS NULL AND "facility_tasks"."completed_by" IS NULL AND "facility_tasks"."completed_at" IS NULL)
        OR ("facility_tasks"."status" IN ('IN_PROGRESS', 'AWAITING_APPROVAL') AND "facility_tasks"."started_at" IS NOT NULL AND "facility_tasks"."completed_by" IS NULL AND "facility_tasks"."completed_at" IS NULL)
        OR ("facility_tasks"."status" = 'COMPLETED' AND "facility_tasks"."started_at" IS NOT NULL AND "facility_tasks"."completed_by" IS NOT NULL AND "facility_tasks"."completed_at" IS NOT NULL)),
	CONSTRAINT "facility_tasks_text_valid" CHECK (length(btrim("facility_tasks"."title")) BETWEEN 1 AND 200 AND ("facility_tasks"."description" IS NULL OR length("facility_tasks"."description") <= 2000))
);
--> statement-breakpoint
CREATE TABLE "storage_unit_maintenance_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_unit_id" uuid NOT NULL,
	"action" "storage_unit_maintenance_action" NOT NULL,
	"previous_status" "storage_unit_status" NOT NULL,
	"next_status" "storage_unit_status" NOT NULL,
	"reason" text,
	"changed_by" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facility_task_reports" ADD CONSTRAINT "facility_task_reports_task_id_facility_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."facility_tasks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_task_reports" ADD CONSTRAINT "facility_task_reports_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_task_reports" ADD CONSTRAINT "facility_task_reports_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_tasks" ADD CONSTRAINT "facility_tasks_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_tasks" ADD CONSTRAINT "facility_tasks_storage_unit_id_storage_units_id_fk" FOREIGN KEY ("storage_unit_id") REFERENCES "public"."storage_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_tasks" ADD CONSTRAINT "facility_tasks_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_tasks" ADD CONSTRAINT "facility_tasks_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_tasks" ADD CONSTRAINT "facility_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_tasks" ADD CONSTRAINT "facility_tasks_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_tasks" ADD CONSTRAINT "facility_tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_unit_maintenance_history" ADD CONSTRAINT "storage_unit_maintenance_history_storage_unit_id_storage_units_id_fk" FOREIGN KEY ("storage_unit_id") REFERENCES "public"."storage_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_unit_maintenance_history" ADD CONSTRAINT "storage_unit_maintenance_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facility_task_reports_history_idx" ON "facility_task_reports" USING btree ("task_id","submitted_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "facility_task_reports_one_accepted_per_task_idx" ON "facility_task_reports" USING btree ("task_id") WHERE "facility_task_reports"."accepted_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "facility_tasks_staff_idx" ON "facility_tasks" USING btree ("facility_id","assigned_staff_id");--> statement-breakpoint
CREATE INDEX "facility_tasks_type_idx" ON "facility_tasks" USING btree ("facility_id","type");--> statement-breakpoint
CREATE INDEX "storage_unit_maintenance_history_unit_idx" ON "storage_unit_maintenance_history" USING btree ("storage_unit_id","changed_at","id");