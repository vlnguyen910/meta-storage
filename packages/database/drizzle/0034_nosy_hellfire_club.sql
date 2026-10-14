ALTER TABLE "payments" ADD COLUMN "refund_amount" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "deposit_forfeited_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_refund_amount_valid" CHECK ("payments"."refund_amount" IS NULL OR ("payments"."refund_amount" >= 0 AND "payments"."refund_amount" <= "payments"."total_amount"));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_deposit_forfeited_valid" CHECK ("payments"."deposit_forfeited_amount" >= 0 AND "payments"."deposit_forfeited_amount" <= "payments"."total_amount"
        AND ("payments"."refund_amount" IS NULL OR "payments"."refund_amount" + "payments"."deposit_forfeited_amount" <= "payments"."total_amount"));