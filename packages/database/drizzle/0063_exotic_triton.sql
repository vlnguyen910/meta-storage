ALTER TABLE "support_attachments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "support_audit" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "support_idempotency" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "support_messages" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "support_attachments" CASCADE;--> statement-breakpoint
DROP TABLE "support_audit" CASCADE;--> statement-breakpoint
DROP TABLE "support_idempotency" CASCADE;--> statement-breakpoint
DROP TABLE "support_messages" CASCADE;--> statement-breakpoint
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_ticket_versions_valid";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_ticket_assignment_valid";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_ticket_progress_valid";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_ticket_closure_valid";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_ticket_context_valid";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_storage_unit_id_storage_units_id_fk";
--> statement-breakpoint
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_assigned_staff_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_assigned_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_closed_by_users_id_fk";
--> statement-breakpoint
DROP INDEX "support_tickets_staff_idx";--> statement-breakpoint
DROP INDEX "support_tickets_queue_idx";--> statement-breakpoint
DROP INDEX "support_tickets_facility_idx";--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "description" text NOT NULL;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "idempotency_key" varchar(128) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "support_tickets_owner_idempotency_idx" ON "support_tickets" USING btree ("owner_user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "support_tickets_facility_idx" ON "support_tickets" USING btree ("facility_id","category","created_at","id");--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "storage_unit_id";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "priority";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "assigned_staff_id";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "assigned_by";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "assigned_at";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "assignment_version";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "version";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "first_assigned_at";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "first_onsite_started_at";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "first_bom_response_at";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "closed_by";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "closed_at";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "closure_kind";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "close_reason";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_ticket_description_valid" CHECK (length(btrim("support_tickets"."description")) BETWEEN 1 AND 5000);--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_ticket_due_valid" CHECK ("support_tickets"."action_due_at" > "support_tickets"."created_at");--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_ticket_context_valid" CHECK (("support_tickets"."category" = 'PAYMENT' AND "support_tickets"."rental_id" IS NULL) OR ("support_tickets"."category" != 'PAYMENT' AND "support_tickets"."rental_id" IS NOT NULL AND "support_tickets"."payment_id" IS NULL));--> statement-breakpoint
DROP TYPE "public"."support_closure_kind";--> statement-breakpoint
DROP TYPE "public"."support_message_kind";--> statement-breakpoint
DROP TYPE "public"."support_priority";--> statement-breakpoint
DROP TYPE "public"."support_status";