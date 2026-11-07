CREATE TYPE "public"."payment_type" AS ENUM('CHARGE', 'DEPOSIT_REFUND');--> statement-breakpoint
CREATE TABLE "policy_violation_fee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_type" varchar(32),
	"reference_id" uuid,
	"violation_code" varchar(64) NOT NULL,
	"violation_name" varchar(200) NOT NULL,
	"amount" integer NOT NULL,
	"policy_version" integer NOT NULL,
	"note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "policy_violation_fee_amount_valid" CHECK ("policy_violation_fee"."amount" >= 0),
	CONSTRAINT "policy_violation_fee_version_valid" CHECK ("policy_violation_fee"."policy_version" >= 0),
	CONSTRAINT "policy_violation_fee_reference_valid" CHECK (("policy_violation_fee"."reference_type" IS NULL AND "policy_violation_fee"."reference_id" IS NULL) OR ("policy_violation_fee"."reference_type" IS NOT NULL AND "policy_violation_fee"."reference_id" IS NOT NULL AND "policy_violation_fee"."is_active" = false))
);
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_context_valid";--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "hold_token_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "provider" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "payment_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "provider_payment_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "type" "payment_type" DEFAULT 'CHARGE' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "rental_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "source_payment_id" uuid;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "policy_violation_fee_reference_code_idx" ON "policy_violation_fee" USING btree ("reference_type","reference_id","violation_code") WHERE "policy_violation_fee"."reference_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "policy_violation_fee_catalog_code_idx" ON "policy_violation_fee" USING btree ("violation_code") WHERE "policy_violation_fee"."reference_id" IS NULL;--> statement-breakpoint
CREATE INDEX "policy_violation_fee_reference_idx" ON "policy_violation_fee" USING btree ("reference_type","reference_id") WHERE "policy_violation_fee"."reference_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_source_payment_id_payments_id_fk" FOREIGN KEY ("source_payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_rental_refund_idx" ON "payments" USING btree ("rental_id") WHERE "payments"."type" = 'DEPOSIT_REFUND';--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_context_valid" CHECK (("payments"."type" = 'CHARGE' AND num_nonnulls("payments"."booking_id", "payments"."reservation_id") = 1 AND "payments"."rental_id" IS NULL AND "payments"."source_payment_id" IS NULL AND "payments"."provider" IS NOT NULL AND "payments"."payment_code" IS NOT NULL AND "payments"."hold_token_hash" IS NOT NULL) OR ("payments"."type" = 'DEPOSIT_REFUND' AND num_nonnulls("payments"."booking_id", "payments"."reservation_id") <= 1 AND "payments"."rental_id" IS NOT NULL AND "payments"."source_payment_id" IS NOT NULL AND "payments"."provider" IS NULL AND "payments"."payment_code" IS NULL AND "payments"."provider_payment_id" IS NULL AND "payments"."hold_token_hash" IS NULL AND "payments"."status" IN ('REFUND_PENDING', 'REFUNDED')));