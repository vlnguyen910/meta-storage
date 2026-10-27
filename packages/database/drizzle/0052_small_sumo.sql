CREATE TYPE "public"."support_category" AS ENUM('UNIT', 'LOCK', 'ACCESS_CODE', 'STORED_ITEMS', 'PAYMENT');--> statement-breakpoint
CREATE TYPE "public"."support_closure_kind" AS ENUM('RESOLVED', 'CUSTOMER_WITHDREW');--> statement-breakpoint
CREATE TYPE "public"."support_message_kind" AS ENUM('PUBLIC_REPLY', 'INTERNAL_NOTE', 'STAFF_REPORT');--> statement-breakpoint
CREATE TYPE "public"."support_priority" AS ENUM('NORMAL', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."support_status" AS ENUM('OPEN', 'IN_PROGRESS', 'CLOSED');--> statement-breakpoint
ALTER TYPE "public"."lifecycle_notification_event" ADD VALUE 'SUPPORT_CREATED' BEFORE 'PAYMENT_CONFIRMED';--> statement-breakpoint
CREATE TABLE "support_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"object_key" text NOT NULL,
	"original_filename" varchar(120) NOT NULL,
	"mime_type" varchar(32) NOT NULL,
	"byte_size" integer NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_attachments_objectKey_unique" UNIQUE("object_key"),
	CONSTRAINT "support_image_bytes_valid" CHECK ("support_attachments"."byte_size" BETWEEN 1 AND 5242880),
	CONSTRAINT "support_image_mime_valid" CHECK ("support_attachments"."mime_type" IN ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "support_image_checksum_valid" CHECK (length("support_attachments"."checksum") = 64)
);
--> statement-breakpoint
CREATE TABLE "support_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"previous_version" integer,
	"next_version" integer NOT NULL,
	"old_status" "support_status",
	"new_status" "support_status",
	"previous_staff_id" uuid,
	"next_staff_id" uuid,
	"assignment_version" integer,
	"reason" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_audit_version_valid" CHECK ("support_audit"."next_version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "support_idempotency" (
	"actor_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"ticket_id" uuid,
	"result_reference" jsonb,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_idempotency_actor_id_operation_idempotency_key_pk" PRIMARY KEY("actor_id","operation","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"kind" "support_message_kind" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_messages_ticket_id_unique" UNIQUE("ticket_id","id"),
	CONSTRAINT "support_message_content_valid" CHECK (length(btrim("support_messages"."content")) BETWEEN 1 AND 5000)
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"rental_id" uuid,
	"storage_unit_id" uuid,
	"payment_id" uuid,
	"category" "support_category" NOT NULL,
	"subject" varchar(200) NOT NULL,
	"status" "support_status" DEFAULT 'OPEN' NOT NULL,
	"priority" "support_priority" DEFAULT 'NORMAL' NOT NULL,
	"assigned_staff_id" uuid,
	"assigned_by" uuid,
	"assigned_at" timestamp (3) with time zone,
	"assignment_version" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"first_assigned_at" timestamp (3) with time zone,
	"first_onsite_started_at" timestamp (3) with time zone,
	"first_bom_response_at" timestamp (3) with time zone,
	"action_due_at" timestamp (3) with time zone NOT NULL,
	"closed_by" uuid,
	"closed_at" timestamp (3) with time zone,
	"closure_kind" "support_closure_kind",
	"close_reason" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_ticket_versions_valid" CHECK ("support_tickets"."version" >= 0 AND "support_tickets"."assignment_version" >= 0),
	CONSTRAINT "support_ticket_subject_valid" CHECK (length(btrim("support_tickets"."subject")) BETWEEN 1 AND 200),
	CONSTRAINT "support_ticket_context_valid" CHECK ("support_tickets"."category" = 'PAYMENT' OR ("support_tickets"."rental_id" IS NOT NULL AND "support_tickets"."storage_unit_id" IS NOT NULL AND "support_tickets"."payment_id" IS NULL)),
	CONSTRAINT "support_ticket_assignment_valid" CHECK (("support_tickets"."assigned_staff_id" IS NULL AND "support_tickets"."assigned_by" IS NULL AND "support_tickets"."assigned_at" IS NULL) OR ("support_tickets"."assigned_staff_id" IS NOT NULL AND "support_tickets"."assigned_by" IS NOT NULL AND "support_tickets"."assigned_at" IS NOT NULL)),
	CONSTRAINT "support_ticket_progress_valid" CHECK ("support_tickets"."status" != 'IN_PROGRESS' OR "support_tickets"."category" = 'PAYMENT' OR "support_tickets"."assigned_staff_id" IS NOT NULL),
	CONSTRAINT "support_ticket_closure_valid" CHECK (("support_tickets"."status" = 'CLOSED' AND "support_tickets"."closed_by" IS NOT NULL AND "support_tickets"."closed_at" IS NOT NULL AND "support_tickets"."closure_kind" IS NOT NULL AND "support_tickets"."close_reason" IS NOT NULL AND length(btrim("support_tickets"."close_reason")) > 0) OR ("support_tickets"."status" != 'CLOSED' AND "support_tickets"."closed_by" IS NULL AND "support_tickets"."closed_at" IS NULL AND "support_tickets"."closure_kind" IS NULL AND "support_tickets"."close_reason" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "support_ticket_id" uuid;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_message_fk" FOREIGN KEY ("ticket_id","message_id") REFERENCES "public"."support_messages"("ticket_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_audit" ADD CONSTRAINT "support_audit_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_audit" ADD CONSTRAINT "support_audit_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_audit" ADD CONSTRAINT "support_audit_previous_staff_id_users_id_fk" FOREIGN KEY ("previous_staff_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_audit" ADD CONSTRAINT "support_audit_next_staff_id_users_id_fk" FOREIGN KEY ("next_staff_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_idempotency" ADD CONSTRAINT "support_idempotency_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_idempotency" ADD CONSTRAINT "support_idempotency_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_storage_unit_id_storage_units_id_fk" FOREIGN KEY ("storage_unit_id") REFERENCES "public"."storage_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_attachments_ticket_idx" ON "support_attachments" USING btree ("ticket_id","message_id");--> statement-breakpoint
CREATE INDEX "support_audit_ticket_idx" ON "support_audit" USING btree ("ticket_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "support_messages_cursor_idx" ON "support_messages" USING btree ("ticket_id","created_at","id");--> statement-breakpoint
CREATE INDEX "support_tickets_owner_idx" ON "support_tickets" USING btree ("owner_user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "support_tickets_facility_idx" ON "support_tickets" USING btree ("facility_id","category","status","created_at","id");--> statement-breakpoint
CREATE INDEX "support_tickets_staff_idx" ON "support_tickets" USING btree ("assigned_staff_id","status","created_at","id");--> statement-breakpoint
CREATE INDEX "support_tickets_queue_idx" ON "support_tickets" USING btree ("category","status","priority","action_due_at","id");--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_support_ticket_id_support_tickets_id_fk" FOREIGN KEY ("support_ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE restrict ON UPDATE no action;