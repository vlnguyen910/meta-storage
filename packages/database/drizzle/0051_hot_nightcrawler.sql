CREATE TYPE "public"."renewal_status" AS ENUM('QUOTED', 'AWAITING_PAYMENT', 'APPLIED', 'EXPIRED', 'REFUND_REQUIRED');--> statement-breakpoint
CREATE TABLE "rental_renewals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rental_id" uuid NOT NULL,
	"customer_id" uuid,
	"rental_version" integer NOT NULL,
	"charge_id" uuid,
	"payment_id" uuid,
	"idempotency_key" varchar(128) NOT NULL,
	"status" "renewal_status" DEFAULT 'QUOTED' NOT NULL,
	"months" integer NOT NULL,
	"old_end_at" timestamp with time zone NOT NULL,
	"new_end_at" timestamp with time zone NOT NULL,
	"monthly_rate" numeric(14, 0) NOT NULL,
	"amount" numeric(14, 0) NOT NULL,
	"currency" varchar(3) DEFAULT 'VND' NOT NULL,
	"timezone" text NOT NULL,
	"cutoff_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"terms_version" varchar(128) NOT NULL,
	"terms" text NOT NULL,
	"accepted_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rental_renewals_chargeId_unique" UNIQUE("charge_id"),
	CONSTRAINT "rental_renewals_paymentId_unique" UNIQUE("payment_id"),
	CONSTRAINT "rental_renewals_period_valid" CHECK ("rental_renewals"."months" between 1 and 12 and "rental_renewals"."new_end_at" = "rental_renewals"."old_end_at" + "rental_renewals"."months" * interval '720 hours'),
	CONSTRAINT "rental_renewals_amount_valid" CHECK ("rental_renewals"."monthly_rate" > 0 and "rental_renewals"."amount" = "rental_renewals"."monthly_rate" * "rental_renewals"."months" and "rental_renewals"."currency" = 'VND'),
	CONSTRAINT "rental_renewals_deadline_valid" CHECK ("rental_renewals"."expires_at" > "rental_renewals"."created_at" and "rental_renewals"."expires_at" <= "rental_renewals"."created_at" + interval '15 minutes' and "rental_renewals"."expires_at" <= "rental_renewals"."cutoff_at"),
	CONSTRAINT "rental_renewals_version_valid" CHECK ("rental_renewals"."rental_version" >= 0),
	CONSTRAINT "rental_renewals_acceptance_valid" CHECK (("rental_renewals"."charge_id" is null and "rental_renewals"."accepted_at" is null and "rental_renewals"."status" in ('QUOTED', 'EXPIRED')) or ("rental_renewals"."charge_id" is not null and "rental_renewals"."accepted_at" is not null and "rental_renewals"."status" <> 'QUOTED')),
	CONSTRAINT "rental_renewals_application_valid" CHECK (("rental_renewals"."status" = 'APPLIED' and "rental_renewals"."payment_id" is not null and "rental_renewals"."applied_at" is not null and "rental_renewals"."failure_reason" is null) or ("rental_renewals"."status" <> 'APPLIED' and "rental_renewals"."applied_at" is null))
);
--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "rental_term_version" integer;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_renewals" ADD CONSTRAINT "rental_renewals_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_renewals" ADD CONSTRAINT "rental_renewals_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_renewals" ADD CONSTRAINT "rental_renewals_charge_id_rental_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."rental_charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_renewals" ADD CONSTRAINT "rental_renewals_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rental_renewals_request_idx" ON "rental_renewals" USING btree ("rental_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "rental_renewals_applied_term_idx" ON "rental_renewals" USING btree ("rental_id","rental_version") WHERE "rental_renewals"."status" = 'APPLIED';--> statement-breakpoint
CREATE INDEX "rental_renewals_history_idx" ON "rental_renewals" USING btree ("rental_id","created_at","id");--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_version_nonnegative" CHECK ("rentals"."version" >= 0);