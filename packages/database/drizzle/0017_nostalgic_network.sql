CREATE TYPE "public"."rental_renewal_status" AS ENUM('QUOTED', 'PENDING_PAYMENT', 'APPLIED', 'REFUND_REQUIRED');--> statement-breakpoint
CREATE TABLE "rental_renewals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rental_id" uuid NOT NULL,
	"storage_unit_id" uuid NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"old_end_at" timestamp with time zone NOT NULL,
	"new_end_at" timestamp with time zone NOT NULL,
	"months" integer NOT NULL,
	"monthly_rate_snapshot" numeric(14, 2) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'VND' NOT NULL,
	"notice_days_snapshot" integer NOT NULL,
	"cutoff_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" "rental_renewal_status" DEFAULT 'QUOTED' NOT NULL,
	"applied_at" timestamp with time zone,
	"failure_reason" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rental_renewals_months_valid" CHECK ("rental_renewals"."months" between 1 and 12),
	CONSTRAINT "rental_renewals_period_valid" CHECK ("rental_renewals"."new_end_at" = "rental_renewals"."old_end_at" + "rental_renewals"."months" * interval '720 hours'),
	CONSTRAINT "rental_renewals_amount_valid" CHECK ("rental_renewals"."monthly_rate_snapshot" > 0 and "rental_renewals"."amount" = "rental_renewals"."monthly_rate_snapshot" * "rental_renewals"."months" and "rental_renewals"."currency" = 'VND'),
	CONSTRAINT "rental_renewals_deadline_valid" CHECK ("rental_renewals"."expires_at" <= "rental_renewals"."cutoff_at" and "rental_renewals"."notice_days_snapshot" >= 0),
	CONSTRAINT "rental_renewals_application_valid" CHECK (("rental_renewals"."status" = 'APPLIED' and "rental_renewals"."applied_at" is not null) or ("rental_renewals"."status" <> 'APPLIED' and "rental_renewals"."applied_at" is null))
);
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_context_valid";--> statement-breakpoint
ALTER TABLE "system_settings" DROP CONSTRAINT "system_settings_known_integer";--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "renewal_id" uuid;--> statement-breakpoint
ALTER TABLE "rental_renewals" ADD CONSTRAINT "rental_renewals_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_renewals" ADD CONSTRAINT "rental_renewals_storage_unit_id_storage_units_id_fk" FOREIGN KEY ("storage_unit_id") REFERENCES "public"."storage_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rental_renewals_history_idx" ON "rental_renewals" USING btree ("rental_id","created_at","id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_renewal_id_rental_renewals_id_fk" FOREIGN KEY ("renewal_id") REFERENCES "public"."rental_renewals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_renewal_charge_idx" ON "payments" USING btree ("renewal_id") WHERE "payments"."type" = 'CHARGE';--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_context_valid" CHECK (("payments"."type" = 'CHARGE' AND num_nonnulls("payments"."booking_id", "payments"."reservation_id", "payments"."renewal_id") = 1 AND "payments"."rental_id" IS NULL AND "payments"."source_payment_id" IS NULL AND "payments"."provider" IS NOT NULL AND "payments"."payment_code" IS NOT NULL AND "payments"."provider_payment_id" IS NOT NULL AND "payments"."hold_token_hash" IS NOT NULL) OR ("payments"."type" = 'DEPOSIT_REFUND' AND num_nonnulls("payments"."booking_id", "payments"."reservation_id") <= 1 AND "payments"."rental_id" IS NOT NULL AND "payments"."renewal_id" IS NULL AND "payments"."source_payment_id" IS NOT NULL AND "payments"."provider" IS NULL AND "payments"."payment_code" IS NULL AND "payments"."provider_payment_id" IS NULL AND "payments"."hold_token_hash" IS NULL AND "payments"."status" IN ('REFUND_PENDING', 'REFUNDED')));--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_known_integer" CHECK ("system_settings"."key" not in ('EXPIRY_REMINDER_DAYS', 'ABANDONED_REVIEW_DAYS', 'RENEWAL_NOTICE_DAYS', 'OVERDUE_FEE_RATE', 'DEPOSIT_MONTHS', 'OPENING_HOUR', 'CLOSING_HOUR') or (jsonb_typeof("system_settings"."value") = 'number' and ("system_settings"."value" #>> '{}')::numeric between 0 and 2147483647 and trunc(("system_settings"."value" #>> '{}')::numeric) = ("system_settings"."value" #>> '{}')::numeric));