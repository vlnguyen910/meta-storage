ALTER TYPE "public"."payment_refund_reason_code" ADD VALUE 'RENEWAL_NOT_APPLIED';--> statement-breakpoint
ALTER TABLE "rental_renewals" ADD COLUMN "setting_version_snapshot" integer NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rental_renewals_idempotency_idx" ON "rental_renewals" USING btree ("rental_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "rental_renewals_applied_term_idx" ON "rental_renewals" USING btree ("rental_id","old_end_at") WHERE "rental_renewals"."status" = 'APPLIED';--> statement-breakpoint
ALTER TABLE "rental_renewals" ADD CONSTRAINT "rental_renewals_setting_version_valid" CHECK ("rental_renewals"."setting_version_snapshot" >= 0);