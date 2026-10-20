CREATE TYPE "public"."booking_contract_status" AS ENUM('UPLOADED', 'ISSUED');--> statement-breakpoint
CREATE TABLE "booking_contract_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"details" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "booking_contract_status" DEFAULT 'UPLOADED' NOT NULL,
	"filename" text NOT NULL,
	"byte_size" integer NOT NULL,
	"page_count" integer NOT NULL,
	"sha256" text NOT NULL,
	"object_key" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"issued_by" uuid,
	"issued_at" timestamp with time zone,
	"terms_snapshot" jsonb,
	CONSTRAINT "booking_contracts_objectKey_unique" UNIQUE("object_key"),
	CONSTRAINT "booking_contract_pdf_valid" CHECK ("booking_contracts"."byte_size" BETWEEN 1 AND 20971520 AND "booking_contracts"."page_count" > 0 AND "booking_contracts"."version" > 0),
	CONSTRAINT "booking_contract_issue_valid" CHECK (("booking_contracts"."status" = 'UPLOADED' AND "booking_contracts"."issued_by" IS NULL AND "booking_contracts"."issued_at" IS NULL AND "booking_contracts"."terms_snapshot" IS NULL) OR ("booking_contracts"."status" = 'ISSUED' AND "booking_contracts"."issued_by" IS NOT NULL AND "booking_contracts"."issued_at" IS NOT NULL AND "booking_contracts"."terms_snapshot" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "handover_inspections" ADD COLUMN "contract_id" uuid;--> statement-breakpoint
ALTER TABLE "booking_contract_audit" ADD CONSTRAINT "booking_contract_audit_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_contract_audit" ADD CONSTRAINT "booking_contract_audit_contract_id_booking_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."booking_contracts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_contract_audit" ADD CONSTRAINT "booking_contract_audit_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_contracts" ADD CONSTRAINT "booking_contracts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_contracts" ADD CONSTRAINT "booking_contracts_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_contracts" ADD CONSTRAINT "booking_contracts_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_contract_audit_booking_idx" ON "booking_contract_audit" USING btree ("booking_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_contract_version_idx" ON "booking_contracts" USING btree ("booking_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_contract_idempotency_idx" ON "booking_contracts" USING btree ("booking_id","idempotency_key");--> statement-breakpoint
ALTER TABLE "handover_inspections" ADD CONSTRAINT "handover_inspections_contract_id_booking_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."booking_contracts"("id") ON DELETE restrict ON UPDATE no action;