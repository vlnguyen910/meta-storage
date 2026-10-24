CREATE TYPE "public"."rental_charge_adjustment_direction" AS ENUM('INCREASE', 'REDUCTION');--> statement-breakpoint
CREATE TYPE "public"."rental_charge_event_type" AS ENUM('SUBMITTED', 'APPROVED', 'REJECTED', 'DISPUTED', 'DISPUTE_UPHELD', 'DISPUTE_REDUCED', 'DISPUTE_WAIVED', 'ADJUSTED', 'PAID', 'REFUND_CREATED', 'REFUND_CONFIRMED', 'REFUND_CANCELLED', 'VOIDED');--> statement-breakpoint
CREATE TYPE "public"."rental_charge_refund_status" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."rental_charge_category" AS ENUM('LOCK_REPLACEMENT', 'KEY_REPLACEMENT', 'ACCESS_DEVICE_REPLACEMENT', 'FACILITY_SERVICE', 'CLEANING', 'RETURN_DEBT', 'RENEWAL_RENT');--> statement-breakpoint
CREATE TYPE "public"."rental_charge_source" AS ENUM('EXTRA', 'RETURN_DEBT', 'RENEWAL');--> statement-breakpoint
CREATE TYPE "public"."rental_charge_status" AS ENUM('PENDING_APPROVAL', 'OPEN', 'DISPUTED', 'PAID', 'VOID', 'REFUND_DUE', 'PARTIALLY_REFUNDED', 'REFUNDED');--> statement-breakpoint
CREATE TABLE "rental_charge_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charge_id" uuid NOT NULL,
	"settlement_id" uuid,
	"direction" "rental_charge_adjustment_direction" NOT NULL,
	"amount" numeric(14, 0) NOT NULL,
	"reason" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rental_charge_adjustments_amount_positive" CHECK ("rental_charge_adjustments"."amount" > 0),
	CONSTRAINT "rental_charge_adjustments_reason_nonempty" CHECK (length(trim("rental_charge_adjustments"."reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "rental_charge_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charge_id" uuid NOT NULL,
	"type" "rental_charge_event_type" NOT NULL,
	"actor_id" uuid,
	"reason" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_charge_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charge_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"settlement_id" uuid,
	"amount" numeric(14, 0) NOT NULL,
	"reason" text NOT NULL,
	"status" "rental_charge_refund_status" DEFAULT 'PENDING' NOT NULL,
	"reference" text,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rental_charge_refunds_amount_positive" CHECK ("rental_charge_refunds"."amount" > 0),
	CONSTRAINT "rental_charge_refunds_reason_nonempty" CHECK (length(trim("rental_charge_refunds"."reason")) > 0),
	CONSTRAINT "rental_charge_refunds_confirmation_valid" CHECK (("rental_charge_refunds"."status" = 'PENDING' AND "rental_charge_refunds"."reference" IS NULL AND "rental_charge_refunds"."confirmed_at" IS NULL AND "rental_charge_refunds"."confirmed_by" IS NULL) OR ("rental_charge_refunds"."status" = 'CONFIRMED' AND "rental_charge_refunds"."reference" IS NOT NULL AND "rental_charge_refunds"."confirmed_at" IS NOT NULL AND "rental_charge_refunds"."confirmed_by" IS NOT NULL) OR ("rental_charge_refunds"."status" = 'CANCELLED' AND "rental_charge_refunds"."reference" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "rental_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rental_id" uuid NOT NULL,
	"source" "rental_charge_source" NOT NULL,
	"category" "rental_charge_category" NOT NULL,
	"amount" numeric(14, 0) NOT NULL,
	"currency" varchar(3) DEFAULT 'VND' NOT NULL,
	"evidence" text NOT NULL,
	"due_date" date NOT NULL,
	"status" "rental_charge_status" DEFAULT 'PENDING_APPROVAL' NOT NULL,
	"created_by" uuid NOT NULL,
	"approved_by" uuid,
	"decision_reason" text,
	"disputed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rental_charges_amount_positive" CHECK ("rental_charges"."amount" > 0),
	CONSTRAINT "rental_charges_currency_vnd" CHECK ("rental_charges"."currency" = 'VND'),
	CONSTRAINT "rental_charges_evidence_nonempty" CHECK (length(trim("rental_charges"."evidence")) > 0),
	CONSTRAINT "rental_charges_source_category_valid" CHECK (("rental_charges"."source" = 'EXTRA' AND "rental_charges"."category" IN ('LOCK_REPLACEMENT','KEY_REPLACEMENT','ACCESS_DEVICE_REPLACEMENT','FACILITY_SERVICE','CLEANING')) OR ("rental_charges"."source" = 'RETURN_DEBT' AND "rental_charges"."category" = 'RETURN_DEBT') OR ("rental_charges"."source" = 'RENEWAL' AND "rental_charges"."category" = 'RENEWAL_RENT'))
);
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_checkout_reference";--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "hold_token_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "rental_charge_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "return_settlements" ADD COLUMN "rental_charge_id" uuid;--> statement-breakpoint
ALTER TABLE "rental_charge_adjustments" ADD CONSTRAINT "rental_charge_adjustments_charge_id_rental_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."rental_charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge_adjustments" ADD CONSTRAINT "rental_charge_adjustments_settlement_id_return_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."return_settlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge_adjustments" ADD CONSTRAINT "rental_charge_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge_events" ADD CONSTRAINT "rental_charge_events_charge_id_rental_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."rental_charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge_events" ADD CONSTRAINT "rental_charge_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge_refunds" ADD CONSTRAINT "rental_charge_refunds_charge_id_rental_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."rental_charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge_refunds" ADD CONSTRAINT "rental_charge_refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge_refunds" ADD CONSTRAINT "rental_charge_refunds_settlement_id_return_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."return_settlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge_refunds" ADD CONSTRAINT "rental_charge_refunds_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charges" ADD CONSTRAINT "rental_charges_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charges" ADD CONSTRAINT "rental_charges_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charges" ADD CONSTRAINT "rental_charges_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rental_charge_adjustments_charge_idx" ON "rental_charge_adjustments" USING btree ("charge_id","created_at","id");--> statement-breakpoint
CREATE INDEX "rental_charge_events_charge_idx" ON "rental_charge_events" USING btree ("charge_id","created_at","id");--> statement-breakpoint
CREATE INDEX "rental_charge_refunds_charge_idx" ON "rental_charge_refunds" USING btree ("charge_id","created_at","id");--> statement-breakpoint
CREATE INDEX "rental_charge_refunds_status_idx" ON "rental_charge_refunds" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rental_charge_refunds_reference_idx" ON "rental_charge_refunds" USING btree ("payment_id","reference");--> statement-breakpoint
CREATE INDEX "rental_charges_rental_created_idx" ON "rental_charges" USING btree ("rental_id","created_at","id");--> statement-breakpoint
CREATE INDEX "rental_charges_status_due_idx" ON "rental_charges" USING btree ("status","due_date");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_rental_charge_id_rental_charges_id_fk" FOREIGN KEY ("rental_charge_id") REFERENCES "public"."rental_charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_settlements" ADD CONSTRAINT "return_settlements_rental_charge_id_rental_charges_id_fk" FOREIGN KEY ("rental_charge_id") REFERENCES "public"."rental_charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_rental_charge_idx" ON "payments" USING btree ("rental_charge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_pending_rental_charge_idx" ON "payments" USING btree ("rental_charge_id") WHERE "payments"."rental_charge_id" IS NOT NULL AND "payments"."status" = 'PENDING';--> statement-breakpoint
CREATE UNIQUE INDEX "payments_collected_rental_charge_idx" ON "payments" USING btree ("rental_charge_id") WHERE "payments"."rental_charge_id" IS NOT NULL AND "payments"."status" IN ('SUCCEEDED','REFUND_PENDING','REFUNDED');--> statement-breakpoint
CREATE INDEX "return_settlement_rental_charge_idx" ON "return_settlements" USING btree ("rental_charge_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_source_reference" CHECK ((
        ("payments"."booking_id" IS NOT NULL AND "payments"."draft_id" IS NULL AND "payments"."rental_charge_id" IS NULL AND "payments"."hold_token_hash" IS NOT NULL) OR
        ("payments"."booking_id" IS NULL AND "payments"."draft_id" IS NOT NULL AND "payments"."rental_charge_id" IS NULL AND "payments"."hold_token_hash" IS NOT NULL) OR
        ("payments"."booking_id" IS NULL AND "payments"."draft_id" IS NULL AND "payments"."rental_charge_id" IS NOT NULL AND "payments"."hold_token_hash" IS NULL)
      ));