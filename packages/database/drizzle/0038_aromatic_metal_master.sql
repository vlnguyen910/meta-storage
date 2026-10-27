CREATE TABLE "return_evidence_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"public_id" text NOT NULL,
	"format" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "return_refund_reference_idx";--> statement-breakpoint
ALTER TABLE "return_evidence_photos" ADD CONSTRAINT "return_evidence_photos_request_id_return_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."return_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_evidence_photos" ADD CONSTRAINT "return_evidence_photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "return_evidence_request_idx" ON "return_evidence_photos" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "return_refund_reference_idx" ON "return_refunds" USING btree ("payment_id","reference");