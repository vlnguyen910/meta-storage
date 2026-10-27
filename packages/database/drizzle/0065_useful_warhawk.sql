ALTER TABLE "facility_task_reports" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "facility_task_reports" CASCADE;--> statement-breakpoint
ALTER TABLE "facility_tasks" ADD COLUMN "report_id" uuid;--> statement-breakpoint
ALTER TABLE "facility_tasks" ADD COLUMN "report_content" text;--> statement-breakpoint
ALTER TABLE "facility_tasks" ADD COLUMN "report_submitted_by" uuid;--> statement-breakpoint
ALTER TABLE "facility_tasks" ADD COLUMN "report_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "facility_tasks" ADD CONSTRAINT "facility_tasks_report_submitted_by_users_id_fk" FOREIGN KEY ("report_submitted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_tasks" ADD CONSTRAINT "facility_tasks_report_valid" CHECK (("facility_tasks"."report_id" IS NULL AND "facility_tasks"."report_content" IS NULL AND "facility_tasks"."report_submitted_by" IS NULL AND "facility_tasks"."report_submitted_at" IS NULL)
        OR ("facility_tasks"."report_id" IS NOT NULL AND "facility_tasks"."report_content" IS NOT NULL AND "facility_tasks"."report_submitted_by" IS NOT NULL AND "facility_tasks"."report_submitted_at" IS NOT NULL AND length(btrim("facility_tasks"."report_content")) BETWEEN 1 AND 5000));--> statement-breakpoint
ALTER TABLE "facility_tasks" ADD CONSTRAINT "facility_tasks_report_required_for_approval" CHECK ("facility_tasks"."status" NOT IN ('AWAITING_APPROVAL', 'COMPLETED') OR "facility_tasks"."report_id" IS NOT NULL);