ALTER TABLE "facility_tasks" DROP CONSTRAINT "facility_tasks_version_valid";--> statement-breakpoint
ALTER TABLE "facility_tasks" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "facility_tasks" DROP COLUMN "version";