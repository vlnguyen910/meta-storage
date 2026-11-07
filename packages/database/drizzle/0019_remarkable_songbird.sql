CREATE TYPE "public"."debt_status" AS ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'BANK_TRANSFER');--> statement-breakpoint
ALTER TYPE "public"."payment_type" ADD VALUE 'DEBT_COLLECTION';--> statement-breakpoint
CREATE TABLE "debts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_id" uuid NOT NULL,
	"original_amount" numeric(14, 2) NOT NULL,
	"paid_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" "debt_status" DEFAULT 'UNPAID' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "debts_settlementId_unique" UNIQUE("settlement_id"),
	CONSTRAINT "debts_amounts_valid" CHECK ("debts"."original_amount" > 0 AND "debts"."paid_amount" >= 0 AND "debts"."paid_amount" <= "debts"."original_amount"),
	CONSTRAINT "debts_status_valid" CHECK (("debts"."paid_amount" = 0 AND "debts"."status" = 'UNPAID') OR ("debts"."paid_amount" > 0 AND "debts"."paid_amount" < "debts"."original_amount" AND "debts"."status" = 'PARTIALLY_PAID') OR ("debts"."paid_amount" = "debts"."original_amount" AND "debts"."status" = 'PAID'))
);
--> statement-breakpoint
CREATE TABLE "return_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rental_id" uuid NOT NULL,
	"inspection_id" uuid NOT NULL,
	"source_payment_id" uuid NOT NULL,
	"deposit_amount" numeric(14, 2) NOT NULL,
	"deduction_amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"settled_by" uuid NOT NULL,
	"settled_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "return_settlements_rentalId_unique" UNIQUE("rental_id"),
	CONSTRAINT "return_settlements_inspectionId_unique" UNIQUE("inspection_id"),
	CONSTRAINT "return_settlements_amounts_valid" CHECK ("return_settlements"."deposit_amount" >= 0 AND "return_settlements"."deduction_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_context_valid";--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "debt_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "method" "payment_method";--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reference" varchar(128);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "recorded_by" uuid;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_settlement_id_return_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."return_settlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_settlements" ADD CONSTRAINT "return_settlements_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_settlements" ADD CONSTRAINT "return_settlements_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_settlements" ADD CONSTRAINT "return_settlements_source_payment_id_payments_id_fk" FOREIGN KEY ("source_payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_settlements" ADD CONSTRAINT "return_settlements_settled_by_users_id_fk" FOREIGN KEY ("settled_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_debt_id_debts_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_debt_idx" ON "payments" USING btree ("debt_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_manual_reference_valid" CHECK ("payments"."method" IS DISTINCT FROM 'BANK_TRANSFER' OR length(trim(coalesce("payments"."reference", "payments"."refund_reference", ''))) > 0);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_context_valid" CHECK (("payments"."type" = 'CHARGE' AND "payments"."debt_id" IS NULL AND num_nonnulls("payments"."booking_id", "payments"."reservation_id", "payments"."renewal_id") = 1 AND "payments"."rental_id" IS NULL AND "payments"."source_payment_id" IS NULL AND "payments"."provider" IS NOT NULL AND "payments"."payment_code" IS NOT NULL AND "payments"."provider_payment_id" IS NOT NULL AND "payments"."hold_token_hash" IS NOT NULL) OR ("payments"."type" = 'DEPOSIT_REFUND' AND "payments"."debt_id" IS NULL AND num_nonnulls("payments"."booking_id", "payments"."reservation_id") <= 1 AND "payments"."rental_id" IS NOT NULL AND "payments"."renewal_id" IS NULL AND "payments"."source_payment_id" IS NOT NULL AND "payments"."provider" IS NULL AND "payments"."payment_code" IS NULL AND "payments"."provider_payment_id" IS NULL AND "payments"."hold_token_hash" IS NULL AND "payments"."status" IN ('REFUND_PENDING', 'REFUNDED')) OR ("payments"."type" = 'DEBT_COLLECTION' AND "payments"."debt_id" IS NOT NULL AND "payments"."rental_id" IS NOT NULL AND num_nonnulls("payments"."booking_id", "payments"."reservation_id", "payments"."renewal_id", "payments"."source_payment_id", "payments"."provider", "payments"."provider_payment_id", "payments"."hold_token_hash") = 0 AND "payments"."status" = 'SUCCEEDED' AND "payments"."paid_at" IS NOT NULL AND "payments"."recorded_by" IS NOT NULL AND "payments"."method" IS NOT NULL AND "payments"."total_amount" > 0));