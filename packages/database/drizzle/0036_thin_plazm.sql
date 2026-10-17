ALTER TABLE "handover_inspections" ADD COLUMN "checklist_version" varchar(30);--> statement-breakpoint
ALTER TABLE "handover_inspections" ADD COLUMN "checklist_results" jsonb;--> statement-breakpoint
ALTER TABLE "handover_inspections" ADD COLUMN "checklist_definition" jsonb;